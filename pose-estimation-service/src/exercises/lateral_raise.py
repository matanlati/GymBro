from .base import BaseExercise, FrameResult


class LateralRaise(BaseExercise):
    _LEFT = dict(hip=23, shoulder=11, elbow=13, wrist=15)
    _RIGHT = dict(hip=24, shoulder=12, elbow=14, wrist=16)

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        hip = self.lm(landmarks, idxs["hip"])
        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])
        wrist = self.lm(landmarks, idxs["wrist"])

        # Abduction angle: hip-shoulder-elbow
        raise_angle = self.calculate_angle(hip, shoulder, elbow)
        # Elbow bend check: shoulder-elbow-wrist
        elbow_bend = self.calculate_angle(shoulder, elbow, wrist)
        feedback = []

        if raise_angle > 80:
            if self.stage == "down":
                self._finish_rep()
            self.stage = "up"

        if raise_angle < 30:
            self.stage = "down"

        if self.stage == "up" and raise_angle < 75:
            self._apply_penalty(feedback, 15, "Raise to shoulder height")

        # Bent elbow during raise = using momentum
        if raise_angle > 50 and elbow_bend < 140:
            self._apply_penalty(feedback, 15, "Keep arms straight")

        if feedback:
            self.current_rep_feedback = feedback

        return FrameResult(
            primary_angle=raise_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
        )

    def reset(self):
        self._reset_base()
