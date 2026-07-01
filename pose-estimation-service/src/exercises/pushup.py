from .base import BaseExercise, FrameResult


class Pushup(BaseExercise):
    _LEFT = dict(shoulder=11, elbow=13, wrist=15, hip=23)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16, hip=24)

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])
        wrist = self.lm(landmarks, idxs["wrist"])
        hip = self.lm(landmarks, idxs["hip"])

        elbow_angle = self.calculate_angle(shoulder, elbow, wrist)
        feedback = []

        if elbow_angle > 100:
            if self.stage == "down":
                self._finish_rep()
            self.stage = "up"

        if elbow_angle < 90:
            self.stage = "down"
            if elbow_angle > 70:
                self._apply_penalty(feedback, 15, "Go lower")

        # Body alignment: shoulder-hip-knee (left knee used as fixed reference point for torso plane)
        if self.visible(landmarks, idxs["hip"], 25):
            knee = self.lm(landmarks, 25)
            body_angle = self.calculate_angle(shoulder, hip, knee)
            if body_angle < 160:
                self._apply_penalty(feedback, 15, "Keep body straight")

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
