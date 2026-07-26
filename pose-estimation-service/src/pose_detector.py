"""Pose source for the analysis pipeline, backed by Ultralytics ``solutions.AIGym``.

AIGym owns the parts of the problem it already solves well: running the YOLO26
pose model, tracking people across frames, computing the primary joint angle and
running the up/down rep counter. This module is a thin adapter over it, so the
exercise modules never re-derive any of that.

What it adds on top of AIGym:

* **Lifter locking** -- AIGym reports one entry per tracked person, so a
  bystander walking through frame would shift list indices and mix two people's
  rep counts. We lock onto one track id and follow it.
* **Normalized keypoints** -- AIGym works in pixels; every fault threshold in
  ``exercises/`` is a fraction of frame width, so we surface ``xyn`` instead.
* **A landmark shape the exercises understand** -- ``Keypoint`` mirrors the
  attribute access ``BaseExercise.lm()`` and ``.visibility()`` expect.
"""

import logging
import os
from dataclasses import dataclass
from typing import Any, List, Optional

from ultralytics import solutions
from ultralytics.solutions.solutions import SolutionAnnotator
from ultralytics.utils import LOGGER as _ULTRALYTICS_LOGGER

# Ultralytics logs at INFO/WARNING per *frame* -- most visibly "No tracks found"
# on every frame where nobody is in shot, which for a full video is thousands of
# lines per request. Errors still surface.
_ULTRALYTICS_LOGGER.setLevel(logging.ERROR)

# The one angle function for the whole service. Accepts plain [x, y] lists as
# well as numpy/torch.
estimate_pose_angle = SolutionAnnotator.estimate_pose_angle

# Model size knob: n | s | m | l | x. Nano is the variant Ultralytics' own
# workout-monitoring examples use and is fast enough to keep whole-video
# analysis interactive. Weights download automatically on first use.
_MODEL_VARIANT = os.getenv("POSE_MODEL_VARIANT", "n").lower()
MODEL_NAME = f"yolo26{_MODEL_VARIANT}-pose.pt"

# COCO-17 keypoint indices, named so exercise modules and this file agree on
# what each number means. YOLO pose models emit exactly these 17 points.
NOSE = 0
LEFT_EYE, RIGHT_EYE = 1, 2
LEFT_EAR, RIGHT_EAR = 3, 4
LEFT_SHOULDER, RIGHT_SHOULDER = 5, 6
LEFT_ELBOW, RIGHT_ELBOW = 7, 8
LEFT_WRIST, RIGHT_WRIST = 9, 10
LEFT_HIP, RIGHT_HIP = 11, 12
LEFT_KNEE, RIGHT_KNEE = 13, 14
LEFT_ANKLE, RIGHT_ANKLE = 15, 16


def _resolve_device() -> str:
    """Inference device from POSE_DELEGATE ("cpu" | "gpu").

    Falls back to CPU when a GPU is asked for but CUDA is unavailable, so a
    laptop running the default config gets slow analysis rather than a hard
    failure mid-request.
    """
    if os.getenv("POSE_DELEGATE", "gpu").lower() != "gpu":
        return "cpu"

    import torch

    if not torch.cuda.is_available():
        logging.getLogger(__name__).warning(
            "POSE_DELEGATE=gpu but CUDA is unavailable; falling back to CPU."
        )
        return "cpu"
    return "cuda:0"


@dataclass
class Keypoint:
    """One body landmark in normalized [0, 1] frame coordinates.

    ``visibility`` is the model's per-keypoint confidence; ``BaseExercise`` gates
    measurements on it so an occluded joint is skipped rather than guessed at.
    """

    x: float
    y: float
    visibility: float


@dataclass
class PoseFrame:
    """One frame of AIGym output, narrowed to the lifter we are following.

    ``angle`` and ``keypoints`` are ``None`` on frames where nobody was tracked;
    ``count`` still carries the last known rep total so the counter never appears
    to go backwards when the lifter is briefly lost.
    """

    angle: Optional[float] = None
    stage: str = "-"
    count: int = 0
    keypoints: Optional[List[Keypoint]] = None
    plot_im: Any = None


class PoseTracker:
    """Runs one AIGym over a clip and reports on a single locked-on lifter."""

    def __init__(self, exercise) -> None:
        self.gym = solutions.AIGym(
            model=MODEL_NAME,
            kpts=exercise.kpts(),
            up_angle=exercise.UP_ANGLE,
            down_angle=exercise.DOWN_ANGLE,
            device=_resolve_device(),
            verbose=False,
            line_width=2,
        )
        self._locked_id: Optional[int] = None
        self._last_count: int = 0

    def _select_index(self) -> Optional[int]:
        """Index of the lifter we are following within this frame's track lists.

        Locks onto the largest bounding box the first time anyone is seen -- the
        closest subject, i.e. the person filming their set -- and sticks with
        that track id. If it leaves the frame we re-lock, which is the best
        available recovery: AIGym keys its rep state by track id, so a lost
        track restarts counting either way.
        """
        track_ids = self.gym.track_ids
        if not track_ids:
            return None

        if self._locked_id in track_ids:
            return track_ids.index(self._locked_id)

        boxes = self.gym.boxes
        largest = max(
            range(len(track_ids)),
            key=lambda i: float(
                (boxes[i][2] - boxes[i][0]) * (boxes[i][3] - boxes[i][1])
            ),
        )
        self._locked_id = track_ids[largest]
        return largest

    def _keypoints(self, index: int) -> Optional[List[Keypoint]]:
        """Normalized landmarks + confidence for the tracked lifter."""
        kps = getattr(self.gym.tracks, "keypoints", None)
        if kps is None or kps.xyn is None or index >= len(kps.xyn):
            return None

        xyn = kps.xyn[index].cpu().numpy()
        # .data is (K, 3) as [x, y, conf] when the model emits confidence; older
        # exports omit the third column, in which case we treat every detected
        # point as fully visible rather than dropping the frame.
        raw = kps.data[index].cpu().numpy() if kps.data is not None else None
        confs = raw[:, 2] if raw is not None and raw.shape[1] > 2 else None

        return [
            Keypoint(
                x=float(point[0]),
                y=float(point[1]),
                visibility=float(confs[i]) if confs is not None else 1.0,
            )
            for i, point in enumerate(xyn)
        ]

    def step(self, frame) -> PoseFrame:
        """Feed one BGR frame to AIGym and return the locked lifter's state."""
        results = self.gym(frame)

        index = self._select_index()
        if index is None:
            return PoseFrame(count=self._last_count, plot_im=results.plot_im)

        self._last_count = int(results.workout_count[index])
        return PoseFrame(
            angle=float(results.workout_angle[index]),
            stage=str(results.workout_stage[index]),
            count=self._last_count,
            keypoints=self._keypoints(index),
            plot_im=results.plot_im,
        )
