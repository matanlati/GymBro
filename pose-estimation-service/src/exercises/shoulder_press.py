from ..pose_detector import PoseFrame
from .base import BaseExercise, FrameResult


class ShoulderPress(BaseExercise):
    """Overhead shoulder press, analyzed from a side view.

    GOOD FORM
      - Press to full elbow lock-out overhead every rep (~170 deg).
      - Lower the weight all the way to shoulder height at the bottom (~90 deg).
      - Ribs stay down and the lower back stays neutral: no big backward lean /
        lumbar arch to muscle the weight up.
      - Controlled press and controlled lowering.

    COMMON FAULTS (what we score)
      - Not locking out at the top (graded from the rep's max elbow angle).
      - Short range at the bottom, not lowering to shoulder height (min angle).
      - Arching the lower back (head/ear travelling away from over the shoulder).

    A partial press still counts as a rep; the missing lockout or short bottom
    range shows up in the score and cues rather than by dropping the rep.
    """

    _LEFT = dict(shoulder=5, elbow=7, wrist=9, ear=3)
    _RIGHT = dict(shoulder=6, elbow=8, wrist=10, ear=4)

    # AIGym measures the elbow angle (shoulder-elbow-wrist).
    KPTS_LEFT = [5, 7, 9]
    KPTS_RIGHT = [6, 8, 10]
    # The elbow sweeps ~80-90 at the shoulders (90-100 deg of flexion) up to
    # ~172 at lockout overhead.
    # DOWN_ANGLE sits above the 110 deg bottom grade below, so a press that stops
    # short of shoulder height still counts and is then faulted for it. UP_ANGLE
    # stays at 150 rather than dropping to DOWN + 20, to leave the lockout grade
    # room to fail.
    UP_ANGLE = 150.0
    DOWN_ANGLE = 130.0
    # A press rests at the *flexed* end: the bar starts racked at the shoulders
    # and returns there between reps, so the rep is complete when it comes back
    # down, which is exactly where AIGym increments. Closing at "up" instead
    # deferred each grade to the next lockout, which put the back-arch cue below
    # on the wrong rep. Same shape as lateral_raise; see REP_CLOSES_AT in
    # base.py for what that offset breaks.
    REP_CLOSES_AT = "down"
    # Strict tier (see base.py).
    _LOCKOUT_GOOD = 165.0  # locked out overhead
    _BOTTOM_GOOD = 110.0   # lowered to shoulder height

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])

        elbow_angle = pose.angle
        self._track(elbow_angle)
        feedback = []
        positives = []

        self._sync_reps(pose, feedback, positives)

        # The ear drifting off from over the shoulder is the side-view signature
        # of leaning back to heave the weight overhead.
        if self.visible(landmarks, idxs["ear"]):
            ear = self.lm(landmarks, idxs["ear"])
            if abs(ear[0] - shoulder[0]) > 0.08:
                self._apply_penalty(feedback, 20, "Lower back arching - ribs down, brace hard")

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        no_arch = not self._rep_faults  # no lower-back arch fault this rep
        if self.rep_max_angle is not None and self.rep_max_angle < self._LOCKOUT_GOOD:
            self._apply_penalty(feedback, 15, "Short lockout - press fully overhead")
        elif self.rep_max_angle is not None:
            self._praise(positives, "Full lockout overhead")

        if self.rep_min_angle is not None and self.rep_min_angle > self._BOTTOM_GOOD:
            self._apply_penalty(feedback, 10, "Short range - lower to shoulder height each rep")
        elif self.rep_min_angle is not None:
            self._praise(positives, "Full depth to the shoulders")

        if no_arch:
            self._praise(positives, "Ribs down, tight core - no back arch")

    def reset(self):
        self._reset_base()
