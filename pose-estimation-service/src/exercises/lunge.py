from .base import BaseExercise, FrameResult


class Lunge(BaseExercise):
    """Forward/stationary lunge, analyzed from a side view on the front leg.

    GOOD FORM
      - Front knee bends to about 90 deg, thigh roughly parallel to the floor.
      - Front shin stays fairly vertical; the knee tracks over the ankle rather
        than shooting well past the toes.
      - Torso stays tall and upright over the hips through the descent.
      - Controlled down, driven back up.

    COMMON FAULTS (what we score)
      - Shallow depth, graded from the deepest front-knee angle of the rep.
      - Front knee travelling past the toes.
      - Torso leaning forward.

    Note: rep counting is unchanged -- a rep is counted once the front knee bends
    past 110 deg and re-extends past 160 deg.
    """

    _LEFT = dict(hip=23, knee=25, ankle=27, shoulder=11)
    _RIGHT = dict(hip=24, knee=26, ankle=28, shoulder=12)

    # Front-knee gates for rep detection (unchanged from the original logic):
    # "down" once the knee bends past 110 deg, rep closes past 160 deg.
    _DOWN_GATE = 110.0
    _UP_GATE = 160.0
    _DEPTH_GOOD = 100.0

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        # Core joints for the front-knee angle must be visible or we skip the frame.
        if not self.visible(landmarks, idxs["hip"], idxs["knee"], idxs["ankle"]):
            return self._neutral_frame()

        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])
        shoulder = self.lm(landmarks, idxs["shoulder"])

        knee_angle = self.calculate_angle(hip, knee, ankle)
        self._track(knee_angle)
        sign = self._facing_sign(landmarks)
        feedback = []

        if knee_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback)
            self.stage = "up"
        elif knee_angle < self._DOWN_GATE:
            self.stage = "down"

        if self.stage == "down":
            if sign * (knee[0] - ankle[0]) > 0.06:
                self._apply_penalty(feedback, 15, "Front knee past toes")
            if self.visible(landmarks, idxs["shoulder"]) and sign * (shoulder[0] - hip[0]) > 0.1:
                self._apply_penalty(feedback, 10, "Keep torso upright")

        return self._frame(knee_angle, feedback)

    def _evaluate_rep(self, feedback: list) -> None:
        depth = self.rep_min_angle
        if depth is None:
            return
        if depth > self._DEPTH_GOOD:
            self._apply_penalty(feedback, 15, "Lunge deeper, front thigh to parallel")

    def reset(self):
        self._reset_base()
