from .base import BaseExercise, FrameResult


class LatPulldown(BaseExercise):
    """Cable lat pulldown, analyzed from a front/side view.

    GOOD FORM
      - Start from a full stretch with the arms nearly extended overhead
        (elbow ~160 deg), then pull the bar down to the upper chest, driving the
        elbows down and back (elbow closes to ~80-90 deg).
      - Keep the torso tall and stable; a small lean is fine but the rep should be
        pulled with the lats, not heaved by rocking the whole body.
      - Controlled pull down and an equally controlled release back to the stretch.

    COMMON FAULTS (what we score)
      - Short pull - not bringing the bar down far enough (min elbow angle).
      - Not returning to a full stretch at the top (max elbow angle).
      - Swinging / leaning back to yank the bar down with momentum (the torso
        rocking horizontally across the rep).
      - Jerky, too-fast reps (very short rep duration).

    Note: rep counting is deliberately FORGIVING here -- a rep is counted once the
    elbow bends past 100 deg on the pull and re-extends past 150 deg at the top.
    Even a partial pull still counts; the missing range shows up in the score and
    cues, not by dropping the rep.
    """

    _LEFT = dict(shoulder=11, elbow=13, wrist=15, hip=23)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16, hip=24)

    # Elbow-angle gates for rep detection (forgiving - see the class note).
    _DOWN_GATE = 100.0   # bar pulled down to the chest
    _UP_GATE = 150.0     # arms extended back to the stretch
    # Grading thresholds read off the whole rep:
    _PULL_GOOD = 90.0     # elbow this closed = a full pull to the chest
    _STRETCH_GOOD = 155.0  # elbow this open = a full stretch at the top
    _SWAY_RANGE = 0.10     # shoulder-over-hip horizontal travel that reads as swing

    def __init__(self, side: str = "left"):
        super().__init__(side)
        self._reset_sway()

    def _reset_sway(self) -> None:
        self._sway_min = None
        self._sway_max = None

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
        positives = []

        # Track how far the shoulder rocks in front of / behind the hip so swing
        # can be judged over the whole rep in _evaluate_rep.
        if self.visible(landmarks, idxs["hip"]):
            hip = self.lm(landmarks, idxs["hip"])
            sway = shoulder[0] - hip[0]
            self._sway_min = sway if self._sway_min is None else min(self._sway_min, sway)
            self._sway_max = sway if self._sway_max is None else max(self._sway_max, sway)

        if elbow_angle < self._DOWN_GATE:
            if self.stage == "up":
                self._finish_rep(feedback, positives)
            self.stage = "down"
        elif elbow_angle > self._UP_GATE:
            self.stage = "up"

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        pull = self.rep_min_angle
        stretch = self.rep_max_angle
        swing = (self._sway_min is not None and self._sway_max is not None
                 and self._sway_max - self._sway_min > self._SWAY_RANGE)

        if pull is not None and pull > self._PULL_GOOD:
            self._apply_penalty(feedback, 15, "Short pull - bring the bar to your chest")
        elif pull is not None:
            self._praise(positives, "Great pull - elbows driven down to the chest")

        if stretch is not None and stretch < self._STRETCH_GOOD:
            self._apply_penalty(feedback, 10, "Full stretch - let the bar rise all the way up")
        elif stretch is not None:
            self._praise(positives, "Nice full stretch at the top")

        if swing:
            self._apply_penalty(feedback, 15, "Stop leaning back - pull with your lats, not momentum")
        else:
            self._praise(positives, "Solid torso, no swinging")

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 5, "Control the pull, no jerking")

        self._reset_sway()

    def reset(self):
        self._reset_base()
        self._reset_sway()
