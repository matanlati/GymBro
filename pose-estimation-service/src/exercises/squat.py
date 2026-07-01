from .base import BaseExercise, FrameResult


class Squat(BaseExercise):
    _LEFT = dict(hip=23, knee=25, ankle=27, shoulder=11)
    _RIGHT = dict(hip=24, knee=26, ankle=28, shoulder=12)

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        # Core joints for the knee angle must be visible or we skip the frame.
        if not self.visible(landmarks, idxs["hip"], idxs["knee"], idxs["ankle"]):
            return self._neutral_frame()

        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])
        shoulder = self.lm(landmarks, idxs["shoulder"])

        knee_angle = self.calculate_angle(hip, knee, ankle)
        feedback = []

        if knee_angle > 160:
            if self.stage == "down":
                self._finish_rep()
            self.stage = "up"

        if knee_angle < 100:
            self.stage = "down"
            if knee_angle > 90:
                self._apply_penalty(feedback, 15, "Go deeper")
            if knee[0] > ankle[0] + 0.05:
                self._apply_penalty(feedback, 10, "Knees too far forward")

        if self.visible(landmarks, idxs["shoulder"]) and abs(shoulder[0] - hip[0]) > 0.1:
            self._apply_penalty(feedback, 10, "Keep torso upright")

        if feedback:
            self.current_rep_feedback = feedback

        return FrameResult(
            primary_angle=knee_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
        )

    def reset(self):
        self._reset_base()
