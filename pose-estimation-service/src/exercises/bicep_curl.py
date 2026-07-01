from .base import BaseExercise, FrameResult


class BicepCurl(BaseExercise):
    _LEFT = dict(shoulder=11, elbow=13, wrist=15)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16)  # right wrist = 16, not 15

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])
        wrist = self.lm(landmarks, idxs["wrist"])

        elbow_angle = self.calculate_angle(shoulder, elbow, wrist)
        feedback = []

        if elbow_angle > 160:
            if self.stage == "up":
                self._finish_rep()
            self.stage = "down"

        if elbow_angle < 40:
            self.stage = "up"

        if abs(elbow[0] - shoulder[0]) > 0.15:
            self._apply_penalty(feedback, 10, "Keep elbows close")

        if feedback:
            self.current_rep_feedback = feedback

        return FrameResult(
            primary_angle=elbow_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
        )

    def reset(self):
        self._reset_base()
