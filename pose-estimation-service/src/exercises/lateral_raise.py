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
      - Raising too high / shrugging above shoulder height.
      - Bending the elbows to cheat the weight up.
      - Swinging: whipping the weight up too fast (very short rep duration).

    Note: a rep only counts once the arm passes shoulder height (~80 deg), so raises
    that fall short simply do not register as reps.
    """

    _LEFT = dict(hip=23, shoulder=11, elbow=13, wrist=15)
    _RIGHT = dict(hip=24, shoulder=12, elbow=14, wrist=16)

    # Abduction gates for rep detection (unchanged from the original logic):
    # "up" once the arm passes 80 deg, "down" back under 30 deg.
    _UP_GATE = 80.0
    _DOWN_GATE = 30.0
    _HEIGHT_HIGH = 110.0   # above this = raising too high / shrugging

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["hip"], idxs["shoulder"], idxs["elbow"]):
            return self._neutral_frame()

        hip = self.lm(landmarks, idxs["hip"])
        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])

        # Abduction angle: hip-shoulder-elbow.
        raise_angle = self.calculate_angle(hip, shoulder, elbow)
        self._track(raise_angle)
        feedback = []
        positives = []

        if raise_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback, positives)
            self.stage = "up"
        elif raise_angle < self._DOWN_GATE:
            self.stage = "down"

        # Bent elbow during the raise = using momentum / turning it into a curl.
        if raise_angle > 50 and self.visible(landmarks, idxs["wrist"]):
            wrist = self.lm(landmarks, idxs["wrist"])
            elbow_bend = self.calculate_angle(shoulder, elbow, wrist)
            if elbow_bend < 140:
                self._apply_penalty(feedback, 15, "Elbows bending - keep arms long, soft elbow")

        return self._frame(raise_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        # No "elbows bending" fault fired during the raise.
        strict_arm = not self._rep_faults
        # A counted rep already passed shoulder height (80 deg gate); here we only
        # catch over-raising (traps taking over) and whipping the weight up.
        peak = self.rep_max_angle
        too_high = peak is not None and peak > self._HEIGHT_HIGH
        if too_high:
            self._apply_penalty(feedback, 10, "Too high - stop at shoulder height, not above")
        elif peak is not None:
            self._praise(positives, "Perfect height, right at the shoulder")

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 10, "Swinging up - control the raise, no momentum")
        elif rep_s is not None and rep_s >= 0.8:
            self._praise(positives, "Controlled raise, no momentum")

        if strict_arm and not too_high:
            self._praise(positives, "Arms long, strict side-delt form")

    def reset(self):
        self._reset_base()
