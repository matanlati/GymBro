from .base import BaseExercise, FrameResult


class Pushup(BaseExercise):
    """Push-up, analyzed from a side view.

    GOOD FORM
      - Chest lowers until the elbow closes to ~90 deg or less at the bottom.
      - Body holds a rigid straight line from head to heels: hips neither sag
        toward the floor nor pike up into an inverted-V.
      - Elbows tucked ~45 deg from the torso (a frontal-plane cue we cannot see
        from the side, so it is left to the coaching text, not scored here).
      - Controlled descent, full press to near lock-out at the top.

    COMMON FAULTS (what we score)
      - Shallow depth, graded from the deepest elbow angle of the rep.
      - Hips sagging (lower back over-extends).
      - Hips piking up (cheating the range by bending at the hips).

    Note: rep counting is unchanged -- a rep is counted once the elbow bends past
    90 deg and re-opens past 100 deg.
    """

    _LEFT = dict(shoulder=11, elbow=13, wrist=15, hip=23, knee=25)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16, hip=24, knee=26)

    # Elbow-angle gates for rep detection (unchanged from the original logic):
    # "down" once the elbow bends past 90 deg, rep closes when it re-opens past
    # 100 deg. Depth is graded off the deepest elbow angle: below ~70 deg is a
    # full-depth push-up.
    _DOWN_GATE = 90.0
    _UP_GATE = 100.0
    _DEPTH_GOOD = 70.0

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

        if elbow_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback)
            self.stage = "up"
        elif elbow_angle < self._DOWN_GATE:
            self.stage = "down"

        # Body line: with a roughly horizontal body, the hip should sit on the
        # line between the shoulder and knee. y grows downward in image coords,
        # so a hip below that midline means the hips are sagging; above it means
        # they are piking. This distinguishes the two faults instead of lumping
        # them into one vague "keep straight" cue.
        if self.visible(landmarks, idxs["hip"], idxs["knee"]):
            hip = self.lm(landmarks, idxs["hip"])
            knee = self.lm(landmarks, idxs["knee"])
            body_angle = self.calculate_angle(shoulder, hip, knee)
            if body_angle < 160:
                mid_y = (shoulder[1] + knee[1]) / 2
                if hip[1] > mid_y + 0.03:
                    self._apply_penalty(feedback, 15, "Hips sagging, brace your core")
                elif hip[1] < mid_y - 0.03:
                    self._apply_penalty(feedback, 15, "Hips piking, keep body in a straight line")
                else:
                    self._apply_penalty(feedback, 15, "Keep body in a straight line")

        return self._frame(elbow_angle, feedback)

    def _evaluate_rep(self, feedback: list) -> None:
        depth = self.rep_min_angle
        if depth is None:
            return
        if depth > self._DEPTH_GOOD:
            self._apply_penalty(feedback, 15, "Go lower, chest toward the floor")

    def reset(self):
        self._reset_base()
