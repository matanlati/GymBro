from ..pose_detector import PoseFrame
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

    Only a pull that barely breaks 115 deg of hip bend fails to register; partial
    pulls count and are graded on their lockout.
    """

    _LEFT = dict(shoulder=5, hip=11, knee=13, ankle=15)
    _RIGHT = dict(shoulder=6, hip=12, knee=14, ankle=16)

    # AIGym measures hip extension (shoulder-hip-knee).
    KPTS_LEFT = [5, 11, 13]
    KPTS_RIGHT = [6, 12, 14]
    # Loose enough that a partial or rack pull still counts; the lockout grade
    # below is what judges whether the hips actually finished.
    UP_ANGLE = 155.0
    DOWN_ANGLE = 115.0
    _LOCKOUT_GOOD = 165.0  # hips fully extended at the top

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["hip"], idxs["knee"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])

        hip_angle = pose.angle
        self._track(hip_angle)
        sign = self._facing_sign(landmarks)
        feedback = []
        positives = []

        self._sync_reps(pose, feedback, positives)

        if self.stage == "down" and self.visible(landmarks, idxs["ankle"]):
            # Hips shooting up early: knees already locked while the torso is
            # still folded over.
            knee_angle = self.calculate_angle(hip, knee, ankle)
            if knee_angle > 160 and hip_angle < 130:
                self._apply_penalty(feedback, 15, "Hips shooting up - drive the floor with your legs")
            if sign * (knee[0] - ankle[0]) > 0.08:
                self._apply_penalty(feedback, 10, "Bar drifting out - keep it close to your body")

        return self._frame(hip_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        clean_pull = not self._rep_faults  # no hips-shooting-up / bar-drift fault
        if self.rep_max_angle is not None and self.rep_max_angle < self._LOCKOUT_GOOD:
            self._apply_penalty(feedback, 15, "Short lockout - fully extend your hips at the top")
        elif self.rep_max_angle is not None:
            self._praise(positives, "Strong lockout, hips fully extended")

        if clean_pull:
            self._praise(positives, "Hips and shoulders rose together, bar close")

    def reset(self):
        self._reset_base()
