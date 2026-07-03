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

    Note: rep counting is unchanged -- a rep is counted once the elbow bends under
    100 deg at the bottom and re-extends past 160 deg at lock-out, so a partial
    press that never locks out simply does not register as a rep.
    """

    _LEFT = dict(shoulder=11, elbow=13, wrist=15, ear=7)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16, ear=8)

    # Elbow-angle gates for rep detection (unchanged from the original logic):
    # rep closes at lock-out past 160 deg, "down" once the elbow bends under 100.
    _UP_GATE = 160.0
    _DOWN_GATE = 100.0
    _LOCKOUT_GOOD = 165.0
    _BOTTOM_GOOD = 110.0

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])
        wrist = self.lm(landmarks, idxs["wrist"])

        elbow_angle = self.calculate_angle(shoulder, elbow, wrist)
        self._track(elbow_angle)
        feedback = []
        positives = []

        if elbow_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback, positives)
            self.stage = "up"
        elif elbow_angle < self._DOWN_GATE:
            self.stage = "down"

        # Lumbar arch: the ear/head drifting off from over the shoulder is the
        # side-view signature of leaning back to heave the weight overhead.
        if self.visible(landmarks, idxs["ear"]):
            ear = self.lm(landmarks, idxs["ear"])
            if abs(ear[0] - shoulder[0]) > 0.08:
                self._apply_penalty(feedback, 20, "Lower back arching - ribs down, brace hard")

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        no_arch = not self._rep_faults  # no lower-back arch fault during the press
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
