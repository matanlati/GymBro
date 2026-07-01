from .base import BaseExercise, FrameResult


class Deadlift(BaseExercise):
    """Conventional deadlift, analyzed from a side view.

    GOOD FORM
      - Finish with hips and knees fully extended at a tall lock-out.
      - Hips and shoulders rise together; the legs drive the floor away while the
        torso angle holds, rather than the hips shooting up first.
      - Bar tracks close to the body over the mid-foot.
      - Braced, neutral spine throughout (a spine-curvature cue that a 2D side
        view cannot measure reliably, so it lives in the coaching text).

    COMMON FAULTS (what we score)
      - Not locking the hips out at the top (graded from the rep's max hip angle).
      - Hips shooting up early: the knees straighten while the torso is still
        folded over, dumping the load onto the lower back.
      - Bar/knees drifting forward away from the body.
    """

    _LEFT = dict(shoulder=11, hip=23, knee=25, ankle=27)
    _RIGHT = dict(shoulder=12, hip=24, knee=26, ankle=28)

    # Hip-angle gates for rep detection (unchanged from the original logic):
    # "down" at the bottom under 90 deg, rep closes at the top past 160 deg.
    _UP_GATE = 160.0
    _DOWN_GATE = 90.0
    _LOCKOUT_GOOD = 165.0

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["hip"], idxs["knee"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])

        # Primary angle: hip extension (shoulder-hip-knee).
        hip_angle = self.calculate_angle(shoulder, hip, knee)
        self._track(hip_angle)
        sign = self._facing_sign(landmarks)
        feedback = []

        if hip_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback)
            self.stage = "up"
        elif hip_angle < self._DOWN_GATE:
            self.stage = "down"

        # Hips shooting up early: knees already locked while the torso is still
        # folded over. Needs the knee angle too, so we compute it when the ankle
        # is visible.
        if self.stage == "down" and self.visible(landmarks, idxs["ankle"]):
            knee_angle = self.calculate_angle(hip, knee, ankle)
            if knee_angle > 160 and hip_angle < 130:
                self._apply_penalty(feedback, 15, "Hips rising too fast, drive with your legs")
            # Bar path: knees/bar drifting forward, away from the body.
            if sign * (knee[0] - ankle[0]) > 0.08:
                self._apply_penalty(feedback, 10, "Keep the bar close to your body")

        return self._frame(hip_angle, feedback)

    def _evaluate_rep(self, feedback: list) -> None:
        if self.rep_max_angle is not None and self.rep_max_angle < self._LOCKOUT_GOOD:
            self._apply_penalty(feedback, 15, "Fully extend your hips at lock-out")

    def reset(self):
        self._reset_base()
