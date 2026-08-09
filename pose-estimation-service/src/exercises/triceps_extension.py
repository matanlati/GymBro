from ..pose_detector import PoseFrame
from .base import BaseExercise, FrameResult


class TricepsExtension(BaseExercise):
    """Overhead triceps extension, analyzed from a side view.

    GOOD FORM
      - Keep the upper arm vertical and fixed by the ears; only the forearm moves.
      - Lower the weight behind the head into a deep stretch (elbow closes to
        ~80 deg or less), then extend to a full lock-out overhead (~170 deg),
        squeezing the triceps.
      - Elbows stay pointing up and tucked in - they should not flare out or the
        whole upper arm swing to help lift the weight.
      - Controlled lowering, no dropping the weight behind the head.

    COMMON FAULTS (what we score)
      - Not locking out at the top / partial extension (max elbow angle).
      - Short stretch - not lowering the weight far enough (min elbow angle).
      - Elbows flaring / the upper arm drifting instead of staying fixed.
      - Dropping the weight too fast (very short rep duration).

    Rep counting is deliberately FORGIVING here: even a partial extension counts
    as a rep, with the missing range showing up in the score and cues rather than
    by dropping the rep.
    """

    _LEFT = dict(shoulder=5, elbow=7, wrist=9)
    _RIGHT = dict(shoulder=6, elbow=8, wrist=10)

    # AIGym measures the elbow angle (shoulder-elbow-wrist).
    KPTS_LEFT = [5, 7, 9]
    KPTS_RIGHT = [6, 8, 10]
    # The elbow sweeps ~170 at lockout down to ~60-80 in the stretch behind the
    # head (100-120 deg of flexion).
    DOWN_ANGLE = 110.0   # forearm lowered behind the head
    UP_ANGLE = 135.0     # arm extended toward lock-out
    # Grading thresholds, strict tier (see base.py), read off the whole rep:
    _LOCKOUT_GOOD = 165.0  # full extension overhead
    _STRETCH_GOOD = 80.0   # deep stretch behind the head
    _FLARE_RANGE = 0.10    # upper-arm (elbow-over-shoulder) horizontal travel

    def __init__(self, side: str = "left"):
        super().__init__(side)
        self._reset_flare()

    def _reset_flare(self) -> None:
        self._elbow_off_min = None
        self._elbow_off_max = None

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])

        elbow_angle = pose.angle
        self._track(elbow_angle)
        feedback = []
        positives = []

        # Accumulated so a flaring upper arm is judged over the whole rep.
        offset = elbow[0] - shoulder[0]
        self._elbow_off_min = offset if self._elbow_off_min is None else min(self._elbow_off_min, offset)
        self._elbow_off_max = offset if self._elbow_off_max is None else max(self._elbow_off_max, offset)

        self._sync_reps(pose, feedback, positives)

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        top = self.rep_max_angle
        stretch = self.rep_min_angle
        # None when the upper arm was never tracked this rep, which is not the
        # same as "tracked and steady" -- see the flare verdict below.
        flare_range = (
            self._elbow_off_max - self._elbow_off_min
            if self._elbow_off_min is not None and self._elbow_off_max is not None
            else None
        )

        if top is not None and top < self._LOCKOUT_GOOD:
            self._apply_penalty(feedback, 15, "Short lockout - fully extend and squeeze the triceps")
        elif top is not None:
            self._praise(positives, "Full lockout - strong triceps squeeze")

        if stretch is not None and stretch > self._STRETCH_GOOD:
            self._apply_penalty(feedback, 10, "Lower the weight further behind your head")
        elif stretch is not None:
            self._praise(positives, "Nice deep stretch behind the head")

        # Only judge the upper arm when we actually tracked it.
        if flare_range is not None:
            if flare_range > self._FLARE_RANGE:
                self._apply_penalty(feedback, 10, "Keep your elbows in and pointing up")
            else:
                self._praise(positives, "Elbows locked in - clean isolation")

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 5, "Control the lowering, don't drop the weight")

        self._reset_flare()

    def reset(self):
        self._reset_base()
        self._reset_flare()
