from ..pose_detector import PoseFrame
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

    _LEFT = dict(shoulder=5, elbow=7, wrist=9, hip=11, knee=13)
    _RIGHT = dict(shoulder=6, elbow=8, wrist=10, hip=12, knee=14)

    # AIGym measures the elbow angle (shoulder-elbow-wrist) and turns a rep over
    # on it: "down" once the elbow bends past 90 deg, "up" when it re-opens past
    # 100 deg. Depth is graded off the deepest elbow angle: below ~70 deg is a
    # full-depth push-up.
    KPTS_LEFT = [5, 7, 9]
    KPTS_RIGHT = [6, 8, 10]
    DOWN_ANGLE = 90.0
    UP_ANGLE = 100.0
    _DEPTH_GOOD = 70.0

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])

        elbow_angle = pose.angle
        self._track(elbow_angle)
        feedback = []
        positives = []

        self._sync_reps(pose, feedback, positives)

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
                    self._apply_penalty(feedback, 15, "Hips sagging - brace your core, ribs down")
                elif hip[1] < mid_y - 0.03:
                    self._apply_penalty(feedback, 15, "Hips piking up - drop them into a straight line")
                else:
                    self._apply_penalty(feedback, 15, "Body bending - hold one line, head to heels")

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        # Whether the plank held (no sag/pike faults fired during the descent).
        solid_plank = not self._rep_faults
        depth = self.rep_min_angle
        if depth is None:
            return
        if depth > self._DEPTH_GOOD:
            self._apply_penalty(feedback, 15, "Too shallow - lower your chest toward the floor")
        else:
            self._praise(positives, "Full depth - chest to the floor")

        if solid_plank:
            self._praise(positives, "Rock-solid plank, straight line held")

    def reset(self):
        self._reset_base()
