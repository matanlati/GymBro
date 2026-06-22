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
    def __init__(self, side: str = "left"):
        self.side = side.lower()
        self.rep_count: int = 0
        self.stage: Optional[str] = None
        self.current_quality: float = 100.0
        self.current_rep_feedback: list = []
        self.all_qualities: list = []
        self.issue_counts: dict = {}

    @staticmethod
    def calculate_angle(a, b, c) -> float:
        a, b, c = np.array(a), np.array(b), np.array(c)
        radians = (np.arctan2(c[1] - b[1], c[0] - b[0])
                   - np.arctan2(a[1] - b[1], a[0] - b[0]))
        angle = np.abs(np.degrees(radians))
        return 360.0 - angle if angle > 180.0 else angle

    @staticmethod
    def lm(landmarks, idx) -> list:
        lm = landmarks[idx]
        return [lm.x, lm.y]

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

    @abstractmethod
    def analyze_frame(self, landmarks) -> FrameResult:
        ...

    @abstractmethod
    def reset(self):
        ...
