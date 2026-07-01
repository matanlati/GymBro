from .base import BaseExercise, FrameResult


class ShoulderPress(BaseExercise):
    _LEFT = dict(shoulder=11, elbow=13, wrist=15, ear=7)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16, ear=8)

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
            if self.stage == "down":
                self._finish_rep()
            self.stage = "up"

        if elbow_angle < 100:
            self.stage = "down"

        if self.stage == "up" and elbow_angle < 150:
            self._apply_penalty(feedback, 15, "Lock out elbows at top")

        # Lumbar arch: head/ear drifts significantly behind shoulder
        if self.visible(landmarks, idxs["ear"]):
            ear = self.lm(landmarks, idxs["ear"])
            if abs(ear[0] - shoulder[0]) > 0.08:
                self._apply_penalty(feedback, 20, "Avoid arching lower back")

        if self.stage == "down" and elbow_angle > 115:
            self._apply_penalty(feedback, 10, "Lower bar to shoulder height")

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
