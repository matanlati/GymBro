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
        self.rep_count: int = 0
        self.stage: Optional[str] = None
        self.current_quality: float = 100.0
        self.current_rep_feedback: list = []
        self.all_qualities: list = []
        self.issue_counts: dict = {}
        self._ema: dict = {}

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
        )

    def _finish_rep(self):
        self.rep_count += 1
        self.all_qualities.append(self.current_quality)
        self.current_quality = 100.0
        self.current_rep_feedback = []

    def _apply_penalty(self, feedback: list, penalty: float, message: str):
        feedback.append(message)
        self.current_quality = min(self.current_quality, 100.0 - penalty)
        self.issue_counts[message] = self.issue_counts.get(message, 0) + 1

    def _reset_base(self):
        self.rep_count = 0
        self.stage = None
        self.current_quality = 100.0
        self.current_rep_feedback = []
        self.all_qualities = []
        self.issue_counts = {}
        self._ema = {}

    @abstractmethod
    def analyze_frame(self, landmarks) -> FrameResult:
        ...

    @abstractmethod
    def reset(self):
        ...
