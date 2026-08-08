from ..pose_detector import PoseFrame
from .base import BaseExercise, FrameResult


class Squat(BaseExercise):
    """Back/air squat, analyzed from a side view.

    GOOD FORM
      - Hips break to at least parallel: the knee angle (hip-knee-ankle) closes
        to ~90 deg or below at the bottom.
      - Torso stays proud over the hips; some forward lean is normal but the
        chest should not collapse toward the floor.
      - Shins/knees track over the mid-foot; the knee travelling far past the
        toes shifts load onto the joint.
      - Controlled ~1-2 s descent, no bouncing out of the hole.

    COMMON FAULTS (what we score)
      - Shallow depth, graded from the *deepest* knee angle of the rep.
      - Torso pitching forward (good-morning-ing the squat).
      - Knees drifting well past the toes.
      - Dropping too fast / bouncing (very short rep duration).

    Only a squat too shallow to bend the knee past 120 deg -- barely a dip --
    fails to register as a rep; anything deeper counts and is graded on depth.
    """

    _LEFT = dict(hip=11, knee=13, ankle=15, shoulder=5)
    _RIGHT = dict(hip=12, knee=14, ankle=16, shoulder=6)

    # AIGym measures the knee angle (hip-knee-ankle).
    KPTS_LEFT = [11, 13, 15]
    KPTS_RIGHT = [12, 14, 16]
    # Forgiving enough that a partial squat still counts and gets coached; the
    # depth grade below is what judges how deep it actually went.
    DOWN_ANGLE = 120.0
    UP_ANGLE = 140.0
    _DEPTH_GOOD = 90.0  # at or below parallel

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

        # Gated on the "down" phase so the standing lockout is never flagged.
        if self.stage == "down":
            if sign * (knee[0] - ankle[0]) > 0.08:
                self._apply_penalty(feedback, 10, "Knees past toes - sit back into your heels")
            if self.visible(landmarks, idxs["shoulder"]) and sign * (shoulder[0] - hip[0]) > 0.12:
                self._apply_penalty(feedback, 10, "Chest up - stop the torso pitching forward")

        return self._frame(knee_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        # Read before this method adds its own faults, so it reflects only the
        # per-frame knee/torso cues from the descent.
        clean_descent = not self._rep_faults
        depth = self.rep_min_angle
        if depth is None:
            return

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if depth > self._DEPTH_GOOD:
            self._apply_penalty(feedback, 15, "Too shallow - break parallel, drive the hips down")
        else:
            self._praise(positives, "Great depth - at or below parallel")

        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 5, "Descent too fast - control it, don't bounce")
        elif rep_s is not None and rep_s >= 0.8:
            self._praise(positives, "Controlled tempo, no bouncing")

        if clean_descent:
            self._praise(positives, "Knees tracking well, chest tall")

    def reset(self):
        self._reset_base()
