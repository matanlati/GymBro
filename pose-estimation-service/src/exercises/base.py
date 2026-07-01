from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
import numpy as np


@dataclass
class FrameResult:
    primary_angle: Optional[float]
    feedback: list
    stage: str
    rep_count: int
    current_quality: float
    # Seconds elapsed in the rep currently in progress (frames / fps). Lets the
    # overlay show live tempo so lifters can see whether they are grinding or
    # bouncing through the movement.
    tempo_s: Optional[float] = None


@dataclass
class RepDetail:
    """Per-rep summary produced the moment a rep completes.

    These are the facts a coach reads off a single repetition: how deep it went
    (``min_angle``), how far it locked out (``max_angle``), the range of motion,
    how long it took, and which faults fired during it. They are surfaced to the
    LLM so feedback can talk about *specific* reps ("rep 3 was shallow and fast")
    instead of only whole-set averages.
    """

    index: int
    quality: float
    min_angle: Optional[float] = None
    max_angle: Optional[float] = None
    rom: Optional[float] = None
    duration_s: Optional[float] = None
    faults: list = field(default_factory=list)


class BaseExercise(ABC):
    # Minimum per-landmark visibility for a joint to be trusted this frame.
    # Below this the joint is likely occluded / out of frame, so we skip the
    # measurement rather than fabricate a fault from a guessed position.
    VIS_THRESHOLD: float = 0.5
    # Exponential-moving-average factor for landmark smoothing. Higher = more
    # responsive (less smoothing); lower = smoother but laggier. 0.5 halves the
    # frame-to-frame jitter that otherwise inflates the fault counts.
    EMA_ALPHA: float = 0.5

    def __init__(self, side: str = "left"):
        self.side = side.lower()
        # Frame rate of the source clip; the pipeline overwrites this before
        # processing so per-rep durations come out in real seconds, not frames.
        self.fps: float = 30.0
        self.rep_count: int = 0
        self.stage: Optional[str] = None
        self.current_quality: float = 100.0
        self.current_rep_feedback: list = []
        self.all_qualities: list = []
        self.issue_counts: dict = {}
        self.rep_details: list = []
        self._ema: dict = {}
        # Extrema and frame tally accumulated across the rep in progress. Depth,
        # lock-out and tempo are properties of the *whole* rep, so we evaluate
        # them from these at the moment the rep closes (see ``_evaluate_rep``),
        # not from a single mid-movement frame.
        self.rep_min_angle: Optional[float] = None
        self.rep_max_angle: Optional[float] = None
        self.rep_frames: int = 0
        self._rep_faults: list = []

    @staticmethod
    def calculate_angle(a, b, c) -> float:
        a, b, c = np.array(a), np.array(b), np.array(c)
        radians = (np.arctan2(c[1] - b[1], c[0] - b[0])
                   - np.arctan2(a[1] - b[1], a[0] - b[0]))
        angle = np.abs(np.degrees(radians))
        return 360.0 - angle if angle > 180.0 else angle

    def lm(self, landmarks, idx) -> list:
        """Return an EMA-smoothed ``[x, y]`` for a landmark index."""
        p = landmarks[idx]
        prev = self._ema.get(idx)
        if prev is None:
            sx, sy = p.x, p.y
        else:
            a = self.EMA_ALPHA
            sx = a * p.x + (1 - a) * prev[0]
            sy = a * p.y + (1 - a) * prev[1]
        self._ema[idx] = (sx, sy)
        return [sx, sy]

    @staticmethod
    def visibility(landmarks, idx) -> float:
        """Per-landmark visibility in [0, 1]; 1.0 if the model omits it."""
        return float(getattr(landmarks[idx], "visibility", 1.0))

    def visible(self, landmarks, *idxs) -> bool:
        """True only when every given landmark clears VIS_THRESHOLD."""
        return all(self.visibility(landmarks, i) >= self.VIS_THRESHOLD for i in idxs)

    # MediaPipe indices used only for orientation, not for any exercise's
    # primary angle: nose, and the left/right ankle + foot-index (toe).
    _NOSE = 0
    _ANKLE = {"left": 27, "right": 28}
    _TOE = {"left": 31, "right": 32}

    def _facing_sign(self, landmarks) -> int:
        """Which way the athlete faces the camera, as +1 (toward +x) or -1.

        Every left/right check ("knee past toes", "torso pitching forward")
        is a statement about the *forward* direction, which flips depending on
        whether the lifter is filmed from their left or right and which way they
        point. We infer it from the toe relative to the ankle (feet point the way
        you face), falling back to the nose relative to the mid-hip. Defaults to
        +1 when neither is usable, matching the original left-facing assumption.
        """
        toe_idx, ankle_idx = self._TOE[self.side], self._ANKLE[self.side]
        if self.visible(landmarks, toe_idx, ankle_idx):
            toe = self.lm(landmarks, toe_idx)
            ankle = self.lm(landmarks, ankle_idx)
            if abs(toe[0] - ankle[0]) > 0.02:
                return 1 if toe[0] >= ankle[0] else -1
        hip_idx = 23 if self.side == "left" else 24
        if self.visible(landmarks, self._NOSE, hip_idx):
            nose = self.lm(landmarks, self._NOSE)
            hip = self.lm(landmarks, hip_idx)
            if abs(nose[0] - hip[0]) > 0.02:
                return 1 if nose[0] >= hip[0] else -1
        return 1

    def _track(self, angle: Optional[float]) -> None:
        """Fold a measured primary angle into the current rep's extrema/tempo."""
        if angle is None:
            return
        self.rep_frames += 1
        if self.rep_min_angle is None or angle < self.rep_min_angle:
            self.rep_min_angle = angle
        if self.rep_max_angle is None or angle > self.rep_max_angle:
            self.rep_max_angle = angle

    def _tempo_s(self) -> Optional[float]:
        """Elapsed real time in the rep in progress, or None if unknown."""
        if not self.fps:
            return None
        return round(self.rep_frames / self.fps, 2)

    def _neutral_frame(self, primary_angle: Optional[float] = None) -> "FrameResult":
        """A no-op frame for when core joints are not reliably visible.

        No rep transition and no penalty are applied, so occluded frames can no
        longer manufacture faults or miscount reps.
        """
        return FrameResult(
            primary_angle=primary_angle,
            feedback=[],
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
            tempo_s=self._tempo_s(),
        )

    def _frame(self, primary_angle: Optional[float], feedback: list) -> "FrameResult":
        """Build the per-frame result, stamping live stage/quality/tempo."""
        if feedback:
            self.current_rep_feedback = feedback
        return FrameResult(
            primary_angle=primary_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
            tempo_s=self._tempo_s(),
        )

    def _evaluate_rep(self, feedback: list) -> None:
        """Hook: grade range-of-motion / tempo for the rep that just closed.

        Subclasses inspect ``rep_min_angle`` / ``rep_max_angle`` / ``rep_frames``
        and call ``_apply_penalty`` for anything the per-frame checks cannot see
        (e.g. a squat that never reached depth). Messages appended to ``feedback``
        surface on the closing frame's overlay. Default: no end-of-rep grading.
        """
        return None

    def _finish_rep(self, feedback: Optional[list] = None):
        """Close the current rep: grade its ROM/tempo, record it, then reset.

        ``feedback`` is the closing frame's feedback list; end-of-rep cues are
        appended to it so they render on the video at the moment the rep ends.
        """
        end_feedback: list = []
        self._evaluate_rep(end_feedback)
        if feedback is not None:
            feedback.extend(end_feedback)
        if end_feedback:
            self.current_rep_feedback = end_feedback

        self.rep_count += 1
        self.all_qualities.append(self.current_quality)
        self.rep_details.append(
            RepDetail(
                index=self.rep_count,
                quality=round(self.current_quality, 1),
                min_angle=round(self.rep_min_angle, 1) if self.rep_min_angle is not None else None,
                max_angle=round(self.rep_max_angle, 1) if self.rep_max_angle is not None else None,
                rom=round(self.rep_max_angle - self.rep_min_angle, 1)
                if self.rep_min_angle is not None and self.rep_max_angle is not None
                else None,
                duration_s=self._tempo_s(),
                faults=list(dict.fromkeys(self._rep_faults)),
            )
        )

        # Reset per-rep accumulators for the next repetition.
        self.current_quality = 100.0
        self.current_rep_feedback = []
        self._rep_faults = []
        self.rep_min_angle = None
        self.rep_max_angle = None
        self.rep_frames = 0

    def _apply_penalty(self, feedback: list, penalty: float, message: str):
        feedback.append(message)
        self.current_quality = min(self.current_quality, 100.0 - penalty)
        self.issue_counts[message] = self.issue_counts.get(message, 0) + 1
        self._rep_faults.append(message)

    def _reset_base(self):
        self.rep_count = 0
        self.stage = None
        self.current_quality = 100.0
        self.current_rep_feedback = []
        self.all_qualities = []
        self.issue_counts = {}
        self.rep_details = []
        self._ema = {}
        self.rep_min_angle = None
        self.rep_max_angle = None
        self.rep_frames = 0
        self._rep_faults = []

    @abstractmethod
    def analyze_frame(self, landmarks) -> FrameResult:
        ...

    @abstractmethod
    def reset(self):
        ...
