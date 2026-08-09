from ..pose_detector import PoseFrame
from .base import BaseExercise, FrameResult


class LateralRaise(BaseExercise):
    """Dumbbell lateral raise, analyzed from a front/side view.

    GOOD FORM
      - Raise the arms to about shoulder height (~90 deg of abduction) and no
        higher; going well above shoulder height hands the work to the traps.
      - Keep a soft but fixed elbow; the arm should not collapse into a bent
        "curl" to sling the weight up.
      - Lead with control, no swinging or heaving with the torso.
      - Slow, controlled lowering.

    COMMON FAULTS (what we score)
      - Falling short of shoulder height.
      - Raising too high / shrugging above shoulder height.
      - Bending the elbows to cheat the weight up.
      - Swinging: whipping the weight up too fast (very short rep duration).

    A raise that falls short still counts as a rep and is faulted for height,
    rather than being dropped from the count.
    """

    _LEFT = dict(hip=11, shoulder=5, elbow=7, wrist=9)
    _RIGHT = dict(hip=12, shoulder=6, elbow=8, wrist=10)

    # AIGym measures the abduction angle (hip-shoulder-elbow).
    KPTS_LEFT = [11, 5, 7]
    KPTS_RIGHT = [12, 6, 8]
    # The one movement whose published ROM transfers with no conversion: this
    # hip-shoulder-elbow angle *is* shoulder abduction, measured from the same
    # arms-down origin the literature uses (see base.py), so ~15 at a dead hang
    # up through the 70-90 band where the medial delt peaks. Applying the
    # `interior = 180 - flexion` conversion here would be a bug.
    # Loosened so a raise that stops short of shoulder height still counts, and
    # so the arms need not return to a dead hang to close the rep. Because this
    # gate no longer doubles as the height check, _HEIGHT_GOOD below took that
    # job over -- otherwise a short raise would be praised as "perfect height".
    UP_ANGLE = 60.0
    DOWN_ANGLE = 35.0
    # Unlike the presses and squats, this movement rests at the *closed* end --
    # you start and finish each rep with the arms hanging down. So a rep is
    # complete when the arms come back down, which is exactly where AIGym
    # increments, not when they reach the top.
    REP_CLOSES_AT = "down"
    # Strict tier (see base.py).
    _HEIGHT_GOOD = 80.0    # below this = the raise fell short of shoulder height
    _HEIGHT_HIGH = 110.0   # above this = raising too high / shrugging

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["hip"], idxs["shoulder"], idxs["elbow"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])

        raise_angle = pose.angle
        self._track(raise_angle)
        feedback = []
        positives = []

        self._sync_reps(pose, feedback, positives)

        # Bent elbow during the raise = using momentum / turning it into a curl.
        if raise_angle > 50 and self.visible(landmarks, idxs["wrist"]):
            wrist = self.lm(landmarks, idxs["wrist"])
            elbow_bend = self.calculate_angle(shoulder, elbow, wrist)
            if elbow_bend < 140:
                self._apply_penalty(feedback, 15, "Elbows bending - keep arms long, soft elbow")

        return self._frame(raise_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        strict_arm = not self._rep_faults  # no elbows-bending fault this rep
        peak = self.rep_max_angle
        too_high = peak is not None and peak > self._HEIGHT_HIGH
        too_low = peak is not None and peak < self._HEIGHT_GOOD
        if too_high:
            self._apply_penalty(feedback, 10, "Too high - stop at shoulder height, not above")
        elif too_low:
            self._apply_penalty(feedback, 10, "Short raise - bring the arms up to shoulder height")
        elif peak is not None:
            self._praise(positives, "Perfect height, right at the shoulder")

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 10, "Swinging up - control the raise, no momentum")
        elif rep_s is not None and rep_s >= 0.8:
            self._praise(positives, "Controlled raise, no momentum")

        if strict_arm and not too_high and not too_low:
            self._praise(positives, "Arms long, strict side-delt form")

    def reset(self):
        self._reset_base()
