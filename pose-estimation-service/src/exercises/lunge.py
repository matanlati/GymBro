from ..pose_detector import PoseFrame
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
    """

    _LEFT = dict(hip=11, knee=13, ankle=15, shoulder=5)
    _RIGHT = dict(hip=12, knee=14, ankle=16, shoulder=6)

    # AIGym measures the front-knee angle (hip-knee-ankle).
    KPTS_LEFT = [11, 13, 15]
    KPTS_RIGHT = [12, 14, 16]
    DOWN_ANGLE = 100.0
    UP_ANGLE = 155.0
    _DEPTH_GOOD = 100.0  # front thigh at parallel

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["hip"], idxs["knee"], idxs["ankle"]):
            return self._neutral_frame()

        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])
        shoulder = self.lm(landmarks, idxs["shoulder"])

        knee_angle = pose.angle
        self._track(knee_angle)
        sign = self._facing_sign(landmarks)
        feedback = []
        positives = []

        self._sync_reps(pose, feedback, positives)

        if self.stage == "down":
            if sign * (knee[0] - ankle[0]) > 0.06:
                self._apply_penalty(feedback, 15, "Front knee past toes - track it over your ankle")
            if self.visible(landmarks, idxs["shoulder"]) and sign * (shoulder[0] - hip[0]) > 0.1:
                self._apply_penalty(feedback, 10, "Torso leaning - stay tall over your hips")

        return self._frame(knee_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        clean_form = not self._rep_faults  # no knee-past-toes / torso-lean fault
        depth = self.rep_min_angle
        if depth is None:
            return
        if depth > self._DEPTH_GOOD:
            self._apply_penalty(feedback, 15, "Too shallow - drop until front thigh is parallel")
        else:
            self._praise(positives, "Great depth - front thigh to parallel")

        if clean_form:
            self._praise(positives, "Tall torso, knee tracking over the ankle")

    def reset(self):
        self._reset_base()
