from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from ..pose_detector import PoseFrame, estimate_pose_angle


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
    # Positive coaching cues ("Great depth!", "Strong lockout") for things the
    # lifter did *well* this frame/rep. Kept separate from ``feedback`` (which is
    # faults) so the overlay can render praise in green and the LLM can ground its
    # positive feedback. Purely informational: praise never changes the score.
    positives: list = field(default_factory=list)


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
    # Positive cues that fired on this rep (the praise twin of ``faults``), so the
    # LLM can call out specific reps done well ("rep 2 hit full depth and locked out").
    praises: list = field(default_factory=list)


class BaseExercise(ABC):
    """Form scoring for one exercise, on top of AIGym's angle/stage/rep counter.

    The division of labour: ``solutions.AIGym`` measures the movement (primary
    joint angle, up/down stage, rep count) and this class judges it (technique
    faults, per-rep grading, a 0-100 quality score). Subclasses therefore never
    compute the primary angle or run a rep state machine -- they declare which
    three keypoints AIGym should watch and at which angles a rep turns over, then
    read the answers off the ``PoseFrame``.
    """

    # Minimum per-landmark visibility for a joint to be trusted this frame.
    # Below this the joint is likely occluded / out of frame, so we skip the
    # measurement rather than fabricate a fault from a guessed position.
    VIS_THRESHOLD: float = 0.5
    # Exponential-moving-average factor for landmark smoothing. Higher = more
    # responsive (less smoothing); lower = smoother but laggier. 0.5 halves the
    # frame-to-frame jitter that otherwise inflates the fault counts.
    EMA_ALPHA: float = 0.5

    # --- AIGym configuration, overridden by every subclass ------------------
    # The three COCO-17 keypoints whose angle defines this movement, per side.
    KPTS_LEFT: list = []
    KPTS_RIGHT: list = []
    # Rep turnover gates in degrees. AIGym counts a rep when the angle drops
    # below DOWN_ANGLE having previously been above UP_ANGLE, so DOWN_ANGLE is
    # always the smaller of the two regardless of which end of the movement the
    # exercise itself calls "down".
    UP_ANGLE: float = 160.0
    DOWN_ANGLE: float = 90.0

    def kpts(self) -> list:
        """The keypoint triplet AIGym should measure for the analyzed side."""
        return self.KPTS_LEFT if self.side == "left" else self.KPTS_RIGHT

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
        # Tally of positive cues across the whole set (the praise twin of
        # ``issue_counts``); surfaced to the LLM as "detected_strengths".
        self.praise_counts: dict = {}
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
        self._rep_praises: list = []
        # Last rep total seen from AIGym, so we can spot the increments that
        # mean "a rep just closed" (see _sync_reps).
        self._last_count: int = 0

    # Ultralytics' three-point angle, re-exported so subclasses can measure the
    # *secondary* angles AIGym does not provide (it computes exactly one angle,
    # from its configured keypoint triplet). Same math the primary angle uses.
    calculate_angle = staticmethod(estimate_pose_angle)

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

    # COCO-17 indices used only for orientation, not for any exercise's
    # primary angle: nose and the left/right ankle.
    _NOSE = 0
    _ANKLE = {"left": 15, "right": 16}

    def _facing_sign(self, landmarks) -> int:
        """Which way the athlete faces the camera, as +1 (toward +x) or -1.

        Every left/right check ("knee past toes", "torso pitching forward")
        is a statement about the *forward* direction, which flips depending on
        whether the lifter is filmed from their left or right and which way they
        point. We infer it from the nose relative to the hip. Defaults to +1 when
        that is not usable, matching the original left-facing assumption.

        Note: this used to prefer the toe relative to the ankle, since feet point
        the way you face. COCO-17 has no foot/toe keypoints, so the nose-vs-hip
        method that was the fallback is now the only signal -- weaker when the
        lifter faces squarely toward or away from the camera.
        """
        hip_idx = 11 if self.side == "left" else 12
        if self.visible(landmarks, self._NOSE, hip_idx):
            nose = self.lm(landmarks, self._NOSE)
            hip = self.lm(landmarks, hip_idx)
            if abs(nose[0] - hip[0]) > 0.02:
                return 1 if nose[0] >= hip[0] else -1
        return 1

    def _sync_reps(self, pose: PoseFrame, feedback: list, positives: list) -> None:
        """Close a rep whenever AIGym's own counter advances.

        AIGym is the single source of truth for *when* a rep happened; this just
        mirrors its counter into our per-rep grading. It increments at the flexed
        end of the movement (angle dropping past DOWN_ANGLE after having been
        above UP_ANGLE), so a rep window runs bottom-to-bottom and still contains
        one full extension and one full flexion -- which is all ``_evaluate_rep``
        needs to grade depth, lock-out and tempo.
        """
        if pose.stage != "-":
            self.stage = pose.stage
        # Loop rather than assume a single step: a dropped frame can advance the
        # count by more than one, and every rep still deserves its grading pass.
        while self._last_count < pose.count:
            self._last_count += 1
            self._finish_rep(feedback, positives)

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
            positives=[],
        )

    def _frame(
        self,
        primary_angle: Optional[float],
        feedback: list,
        positives: Optional[list] = None,
    ) -> "FrameResult":
        """Build the per-frame result, stamping live stage/quality/tempo.

        ``positives`` are praise cues for what went right this frame; they are
        optional so exercises that only track faults need not pass them.
        """
        if feedback:
            self.current_rep_feedback = feedback
        return FrameResult(
            primary_angle=primary_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
            tempo_s=self._tempo_s(),
            positives=positives or [],
        )

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        """Hook: grade range-of-motion / tempo for the rep that just closed.

        Subclasses inspect ``rep_min_angle`` / ``rep_max_angle`` / ``rep_frames``
        and call ``_apply_penalty`` for anything the per-frame checks cannot see
        (e.g. a squat that never reached depth), or ``_praise`` for a whole-rep
        success (full depth, clean lockout, controlled tempo). Messages appended
        to ``feedback`` / ``positives`` surface on the closing frame's overlay.
        Default: no end-of-rep grading.
        """
        return None

    def _finish_rep(self, feedback: Optional[list] = None,
                    positives: Optional[list] = None):
        """Close the current rep: grade its ROM/tempo, record it, then reset.

        ``feedback`` / ``positives`` are the closing frame's fault and praise
        lists; end-of-rep cues are appended to them so they render on the video at
        the moment the rep ends.
        """
        end_feedback: list = []
        end_positives: list = []
        self._evaluate_rep(end_feedback, end_positives)
        if feedback is not None:
            feedback.extend(end_feedback)
        if positives is not None:
            positives.extend(end_positives)
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
                praises=list(dict.fromkeys(self._rep_praises)),
            )
        )

        # Reset per-rep accumulators for the next repetition.
        self.current_quality = 100.0
        self.current_rep_feedback = []
        self._rep_faults = []
        self._rep_praises = []
        self.rep_min_angle = None
        self.rep_max_angle = None
        self.rep_frames = 0

    def _apply_penalty(self, feedback: list, penalty: float, message: str):
        feedback.append(message)
        self.current_quality = min(self.current_quality, 100.0 - penalty)
        self.issue_counts[message] = self.issue_counts.get(message, 0) + 1
        self._rep_faults.append(message)

    def _praise(self, positives: list, message: str):
        """Record a positive cue: the praise twin of ``_apply_penalty``.

        Surfaces the cue on the overlay and tallies it for the LLM, but never
        touches ``current_quality`` - praise recognises good work, it does not
        inflate the score.
        """
        positives.append(message)
        self.praise_counts[message] = self.praise_counts.get(message, 0) + 1
        self._rep_praises.append(message)

    def _reset_base(self):
        self.rep_count = 0
        self.stage = None
        self.current_quality = 100.0
        self.current_rep_feedback = []
        self.all_qualities = []
        self.issue_counts = {}
        self.praise_counts = {}
        self.rep_details = []
        self._ema = {}
        self.rep_min_angle = None
        self.rep_max_angle = None
        self.rep_frames = 0
        self._rep_faults = []
        self._rep_praises = []
        self._last_count = 0

    @abstractmethod
    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        ...

    @abstractmethod
    def reset(self):
        ...
