from .base import BaseExercise, FrameResult


class BicepCurl(BaseExercise):
    """Standing dumbbell/barbell curl, analyzed from a side view.

    GOOD FORM
      - Full range each rep: near-full elbow extension at the bottom (~160 deg)
        and a hard squeeze at the top (~40 deg or less).
      - The upper arm/elbow stays pinned to the side; only the forearm moves.
      - The weight is curled by the biceps, not swung up with the torso/shoulder.
      - Controlled lift, slow (~2-3 s) lowering.

    COMMON FAULTS (what we score)
      - Elbows drifting forward away from the torso.
      - Swinging / using momentum: the elbow sweeps horizontally across the rep
        as the body heaves the weight up.

    Note: a rep only counts once the arm reaches near-full flexion (~40 deg) and
    re-extends (~160 deg), so partial-range curls simply do not register as reps.
    """

    _LEFT = dict(shoulder=11, elbow=13, wrist=15)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16)  # right wrist = 16, not 15

    # Elbow-angle gates for rep detection (unchanged from the original logic):
    # the top of the curl is reached under 40 deg and the rep closes when the arm
    # re-extends past 160 deg.
    _TOP_GATE = 40.0
    _BOTTOM_GATE = 160.0
    _SWING_RANGE = 0.12  # horizontal elbow travel (frac of frame) that reads as swing

    def __init__(self, side: str = "left"):
        super().__init__(side)
        self._reset_swing()

    def _reset_swing(self) -> None:
        self._elbow_off_min = None
        self._elbow_off_max = None

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])
        wrist = self.lm(landmarks, idxs["wrist"])

        elbow_angle = self.calculate_angle(shoulder, elbow, wrist)
        self._track(elbow_angle)
        feedback = []

        # Accumulate how far the elbow sits in front of / behind the shoulder so
        # we can judge swing over the whole rep in _evaluate_rep.
        offset = elbow[0] - shoulder[0]
        self._elbow_off_min = offset if self._elbow_off_min is None else min(self._elbow_off_min, offset)
        self._elbow_off_max = offset if self._elbow_off_max is None else max(self._elbow_off_max, offset)

        if elbow_angle > self._BOTTOM_GATE:
            if self.stage == "up":
                self._finish_rep(feedback)
            self.stage = "down"
        elif elbow_angle < self._TOP_GATE:
            self.stage = "up"

        if abs(offset) > 0.15:
            self._apply_penalty(feedback, 10, "Keep elbows pinned to your sides")

        return self._frame(elbow_angle, feedback)

    def _evaluate_rep(self, feedback: list) -> None:
        # Swing / momentum: the elbow sweeping horizontally across the rep means
        # the body heaved the weight up rather than the biceps curling it.
        if (self._elbow_off_min is not None and self._elbow_off_max is not None
                and self._elbow_off_max - self._elbow_off_min > self._SWING_RANGE):
            self._apply_penalty(feedback, 15, "Stop swinging, control the weight")
        self._reset_swing()

    def reset(self):
        self._reset_base()
        self._reset_swing()
