from .base import BaseExercise, FrameResult


class TricepsExtension(BaseExercise):
    """Overhead triceps extension, analyzed from a side view.

    GOOD FORM
      - Keep the upper arm vertical and fixed by the ears; only the forearm moves.
      - Lower the weight behind the head into a deep stretch (elbow closes to
        ~80 deg or less), then extend to a full lock-out overhead (~170 deg),
        squeezing the triceps.
      - Elbows stay pointing up and tucked in - they should not flare out or the
        whole upper arm swing to help lift the weight.
      - Controlled lowering, no dropping the weight behind the head.

    COMMON FAULTS (what we score)
      - Not locking out at the top / partial extension (max elbow angle).
      - Short stretch - not lowering the weight far enough (min elbow angle).
      - Elbows flaring / the upper arm drifting instead of staying fixed.
      - Dropping the weight too fast (very short rep duration).

    Note: rep counting is deliberately FORGIVING here -- a rep is counted once the
    elbow bends past 90 deg and re-extends past 150 deg. Even a partial extension
    still counts; the missing range shows up in the score and cues, not by
    dropping the rep.
    """

    _LEFT = dict(shoulder=11, elbow=13, wrist=15)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16)

    # Elbow-angle gates for rep detection (forgiving - see the class note).
    _DOWN_GATE = 90.0    # forearm lowered behind the head
    _UP_GATE = 150.0     # arm extended toward lock-out
    # Grading thresholds read off the whole rep:
    _LOCKOUT_GOOD = 165.0  # full extension overhead
    _STRETCH_GOOD = 80.0   # deep stretch behind the head
    _FLARE_RANGE = 0.10    # upper-arm (elbow-over-shoulder) horizontal travel

    def __init__(self, side: str = "left"):
        super().__init__(side)
        self._reset_flare()

    def _reset_flare(self) -> None:
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
        positives = []

        # Track how far the elbow drifts horizontally from the shoulder so a
        # moving/flaring upper arm can be judged over the whole rep.
        offset = elbow[0] - shoulder[0]
        self._elbow_off_min = offset if self._elbow_off_min is None else min(self._elbow_off_min, offset)
        self._elbow_off_max = offset if self._elbow_off_max is None else max(self._elbow_off_max, offset)

        if elbow_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback, positives)
            self.stage = "up"
        elif elbow_angle < self._DOWN_GATE:
            self.stage = "down"

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        top = self.rep_max_angle
        stretch = self.rep_min_angle
        flare = (self._elbow_off_min is not None and self._elbow_off_max is not None
                 and self._elbow_off_max - self._elbow_off_min > self._FLARE_RANGE)

        if top is not None and top < self._LOCKOUT_GOOD:
            self._apply_penalty(feedback, 15, "Short lockout - fully extend and squeeze the triceps")
        elif top is not None:
            self._praise(positives, "Full lockout - strong triceps squeeze")

        if stretch is not None and stretch > self._STRETCH_GOOD:
            self._apply_penalty(feedback, 10, "Lower the weight further behind your head")
        elif stretch is not None:
            self._praise(positives, "Nice deep stretch behind the head")

        if flare:
            self._apply_penalty(feedback, 10, "Keep your elbows in and pointing up")
        else:
            self._praise(positives, "Elbows locked in - clean isolation")

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 5, "Control the lowering, don't drop the weight")

        self._reset_flare()

    def reset(self):
        self._reset_base()
        self._reset_flare()
