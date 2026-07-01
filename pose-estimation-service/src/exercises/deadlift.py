from .base import BaseExercise, FrameResult


class Deadlift(BaseExercise):
    _LEFT = dict(shoulder=11, hip=23, knee=25, ankle=27)
    _RIGHT = dict(shoulder=12, hip=24, knee=26, ankle=28)

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["hip"], idxs["knee"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])

        # Primary angle: hip extension (shoulder-hip-knee)
        hip_angle = self.calculate_angle(shoulder, hip, knee)
        feedback = []

        if hip_angle > 160:
            if self.stage == "down":
                self._finish_rep()
            self.stage = "up"

        if hip_angle < 90:
            self.stage = "down"

        if self.stage == "up" and hip_angle < 155:
            self._apply_penalty(feedback, 15, "Fully extend hips at top")

        # Back rounding: shoulder y significantly below hip y (y increases downward in image coords)
        if shoulder[1] > hip[1] + 0.15:
            self._apply_penalty(feedback, 20, "Keep chest up, avoid rounding")

        # Bar drift: knees shooting forward during descent
        if (self.stage == "down" and self.visible(landmarks, idxs["ankle"])
                and knee[0] > ankle[0] + 0.08):
            self._apply_penalty(feedback, 10, "Keep bar close to body")

        if feedback:
            self.current_rep_feedback = feedback

        return FrameResult(
            primary_angle=hip_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
        )

    def reset(self):
        self._reset_base()
