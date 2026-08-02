"""Pose source for the analysis pipeline, backed by Ultralytics ``solutions.AIGym``.

AIGym owns the parts of the problem it already solves well: running the YOLO26
pose model, tracking people across frames, computing the primary joint angle and
running the up/down rep counter. This module is a thin adapter over it, so the
exercise modules never re-derive any of that.

What it adds on top of AIGym:

* **Lifter locking** -- AIGym reports one entry per tracked person, so a
  bystander walking through frame would shift list indices and mix two people's
  rep counts. We pick the lifter by center-weighted bounding-box size, confirm
  the choice over a few frames before committing, and follow that track id --
  with a grace window so a brief dropout doesn't hand the lock to a bystander.
  BoT-SORT + ReID (see ``botsort_reid.yaml``) keeps that id stable across
  occlusion and people crossing, so the lock rarely has to re-select at all.
* **Normalized keypoints** -- AIGym works in pixels; every fault threshold in
  ``exercises/`` is a fraction of frame width, so we surface ``xyn`` instead.
* **A landmark shape the exercises understand** -- ``Keypoint`` mirrors the
  attribute access ``BaseExercise.lm()`` and ``.visibility()`` expect.
* **Jitter smoothing** -- the pose model predicts each frame independently, so
  even a motionless joint drifts a little frame to frame. A One Euro Filter
  (see ``_OneEuroFilter``) is applied per keypoint, tuned to damp that
  still-frame noise without lagging behind a fast-moving joint mid-rep.
"""

import logging
import math
import os
from dataclasses import dataclass
from typing import Any, List, Optional, Tuple

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
_MODEL_VARIANT = os.getenv("POSE_MODEL_VARIANT", "x").lower()
MODEL_NAME = f"yolo26{_MODEL_VARIANT}-pose.pt"

# Tracker config passed to AIGym. Defaults to our BoT-SORT + ReID file next to
# this module, which keeps the lifter's track id stable across occlusion and
# people crossing. Override with POSE_TRACKER to fall back to stock
# "botsort.yaml" / "bytetrack.yaml" or to point at another config.
TRACKER_CFG = os.getenv(
    "POSE_TRACKER",
    os.path.join(os.path.dirname(__file__), "botsort_reid.yaml"),
)

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


# Smoothing knobs for the One Euro Filter (see `_OneEuroFilter`). min_cutoff
# trades lag for jitter on a still joint; beta trades jitter for lag on a fast
# one. Casiez et al.'s defaults (1.0 / 0.007) are tuned for mouse-pointer
# smoothing; lifts move faster than a cursor, so beta is raised to keep the
# skeleton from lagging behind a barbell during the concentric phase.
_SMOOTH_MIN_CUTOFF = float(os.getenv("POSE_SMOOTH_MIN_CUTOFF", "1.0"))
_SMOOTH_BETA = float(os.getenv("POSE_SMOOTH_BETA", "0.1"))


class _OneEuroFilter:
    """Adaptive low-pass filter for one scalar signal (Casiez et al., 2012).

    Plain exponential smoothing needs a fixed cutoff: low enough to kill
    still-frame jitter, but that same cutoff then lags behind a fast-moving
    joint. This filter raises its own cutoff in proportion to the signal's
    estimated speed, so a still keypoint gets smoothed hard while a keypoint
    mid-rep is barely delayed.
    """

    def __init__(self, freq: float, min_cutoff: float, beta: float, d_cutoff: float = 1.0):
        self._freq = freq
        self._min_cutoff = min_cutoff
        self._beta = beta
        self._d_cutoff = d_cutoff
        self._x_prev: Optional[float] = None
        self._dx_prev: float = 0.0

    @staticmethod
    def _alpha(cutoff: float, freq: float) -> float:
        tau = 1.0 / (2 * math.pi * cutoff)
        te = 1.0 / freq
        return 1.0 / (1.0 + tau / te)

    def __call__(self, x: float) -> float:
        if self._x_prev is None:
            self._x_prev = x
            return x

        dx = (x - self._x_prev) * self._freq
        a_d = self._alpha(self._d_cutoff, self._freq)
        dx_hat = a_d * dx + (1 - a_d) * self._dx_prev

        cutoff = self._min_cutoff + self._beta * abs(dx_hat)
        a = self._alpha(cutoff, self._freq)
        x_hat = a * x + (1 - a) * self._x_prev

        self._x_prev, self._dx_prev = x_hat, dx_hat
        return x_hat


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


# Distinct from any real track id (including `None`, used pre-lock) so the
# smoother is always (re)built the first time `_keypoints` runs.
_NO_SMOOTHER_BUILT_YET = object()


class PoseTracker:
    """Runs one AIGym over a clip and reports on a single locked-on lifter."""

    # Frames the same candidate must win before we commit the lock, so a person
    # crossing frame before the lifter settles cannot steal it.
    _CONFIRM_FRAMES = 5
    # Frames the locked lifter may be missing before we give up and re-select.
    # BoT-SORT's track_buffer usually restores the same id within this window,
    # so we hold the lock across brief occlusions/exits instead of grabbing a
    # bystander the moment the lifter blinks out.
    _RELOCK_GRACE = 15

    def __init__(self, exercise) -> None:
        self.gym = solutions.AIGym(
            model=MODEL_NAME,
            kpts=exercise.kpts(),
            up_angle=exercise.UP_ANGLE,
            down_angle=exercise.DOWN_ANGLE,
            device=_resolve_device(),
            tracker=TRACKER_CFG,
            verbose=False,
            line_width=2,
        )
        self._locked_id: Optional[int] = None
        self._last_count: int = 0
        # Lock-selection state.
        self._last_winner: Optional[int] = None
        self._streak: int = 0
        self._missing_frames: int = 0
        # Per-keypoint jitter smoothing (17 (x, y) filter pairs), rebuilt
        # whenever the locked identity changes so we never blend one person's
        # trajectory into another's after a re-lock.
        self._fps: float = getattr(exercise, "fps", 30.0) or 30.0
        self._smoothers: Optional[List[Tuple[_OneEuroFilter, _OneEuroFilter]]] = None
        self._smoothed_track_id: Any = _NO_SMOOTHER_BUILT_YET

    @staticmethod
    def _subject_score(box, width: int, height: int) -> float:
        """Bounding-box area weighted by how centered it is in the frame.

        Area alone picks the closest person, but a large bystander at the edge
        would beat a centered lifter; multiplying by a center-proximity factor
        (1 at the middle, falling to 0 toward the corners) keeps the subject the
        clip is actually framed around.
        """
        area = (box[2] - box[0]) * (box[3] - box[1])
        cx, cy = (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0
        dist = (((cx - width / 2.0) / width) ** 2
                + ((cy - height / 2.0) / height) ** 2) ** 0.5
        return float(area) * max(0.0, 1.0 - dist)

    def _select_index(self, width: int, height: int) -> Optional[int]:
        """Index of the lifter we are following within this frame's track lists.

        Once locked we simply follow that track id. Choosing it is the careful
        part: we score every track by center-weighted size and require the same
        candidate to win ``_CONFIRM_FRAMES`` frames in a row before committing,
        so a bystander who appears first or briefly looms large cannot capture
        the lock. While the locked lifter is missing we hold the lock for
        ``_RELOCK_GRACE`` frames (ReID usually brings the same id back) before
        re-selecting; AIGym keys rep state by track id, so a true re-lock
        restarts counting either way.
        """
        track_ids = self.gym.track_ids
        if not track_ids:
            if self._locked_id is not None:
                self._missing_frames += 1
                if self._missing_frames > self._RELOCK_GRACE:
                    self._reset_selection()
            return None

        if self._locked_id in track_ids:
            self._missing_frames = 0
            return track_ids.index(self._locked_id)

        # Locked lifter not in this frame: keep waiting out the grace window
        # before we consider handing the lock to someone else.
        if self._locked_id is not None:
            self._missing_frames += 1
            if self._missing_frames <= self._RELOCK_GRACE:
                return None
            self._reset_selection()

        boxes = self.gym.boxes
        best = max(
            range(len(track_ids)),
            key=lambda i: self._subject_score(boxes[i], width, height),
        )
        winner_id = track_ids[best]

        if winner_id == self._last_winner:
            self._streak += 1
        else:
            self._last_winner, self._streak = winner_id, 1
        if self._streak >= self._CONFIRM_FRAMES:
            self._locked_id = winner_id
            self._missing_frames = 0

        # Follow the provisional best during the warm-up: a rep cannot complete
        # in _CONFIRM_FRAMES frames, so reading its state early is harmless.
        return best

    def _reset_selection(self) -> None:
        """Drop the lock and its selection state so re-selection starts clean."""
        self._locked_id = None
        self._last_winner = None
        self._streak = 0
        self._missing_frames = 0

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

        # A fresh identity (new lock, or lock lost then re-acquired) must not
        # be smoothed against the previous lifter's trajectory.
        if self._smoothed_track_id != self._locked_id:
            self._smoothers = [
                (
                    _OneEuroFilter(self._fps, _SMOOTH_MIN_CUTOFF, _SMOOTH_BETA),
                    _OneEuroFilter(self._fps, _SMOOTH_MIN_CUTOFF, _SMOOTH_BETA),
                )
                for _ in range(len(xyn))
            ]
            self._smoothed_track_id = self._locked_id

        return [
            Keypoint(
                x=self._smoothers[i][0](float(point[0])),
                y=self._smoothers[i][1](float(point[1])),
                visibility=float(confs[i]) if confs is not None else 1.0,
            )
            for i, point in enumerate(xyn)
        ]

    def step(self, frame) -> PoseFrame:
        """Feed one BGR frame to AIGym and return the locked lifter's state."""
        results = self.gym(frame)

        height, width = frame.shape[:2]
        index = self._select_index(width, height)
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
