from .base import BaseExercise, FrameResult


class BenchPress(BaseExercise):
    """Barbell/dumbbell bench press, analyzed from a side view.

    GOOD FORM
      - Lower the bar under control to touch the chest (elbow closes to ~90 deg
        or less at the bottom), then press to a full lock-out (~170 deg).
      - The bar travels in a straight line - the wrist stays stacked over the
        elbow rather than drifting toward the head or the hips.
      - Controlled descent, no bouncing the bar off the chest.
      - Shoulder blades pinned and a stable arch (a cue a 2D side view cannot
        measure, so it lives in the coaching text, not the score).

    COMMON FAULTS (what we score)
      - Not touching the chest / pressing only a partial range (min elbow angle).
      - Not locking out at the top (max elbow angle).
      - Bouncing / pressing too fast (very short rep duration).
      - Bar drifting off the vertical - wrist not stacked over the elbow.

    Note: rep counting is deliberately FORGIVING here -- a rep is counted once the
    elbow bends past 110 deg and re-extends past 150 deg. Even a partial press
    still counts as a rep; the missing range is reflected in the score and cues,
    not by dropping the rep.
    """

    _LEFT = dict(shoulder=11, elbow=13, wrist=15)
    _RIGHT = dict(shoulder=12, elbow=14, wrist=16)

    # Elbow-angle gates for rep detection. Wider than the push-up (90/100) so a
    # partial-range bench rep still registers - see the class note.
    _DOWN_GATE = 110.0
    _UP_GATE = 150.0
    # Grading thresholds (read off the whole rep, not one frame):
    _DEPTH_GOOD = 95.0     # bar reached the chest
    _LOCKOUT_GOOD = 165.0  # arms locked out at the top
    _BAR_DRIFT = 0.12      # wrist-over-elbow horizontal offset (frac of frame)

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

        if elbow_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback, positives)
            self.stage = "up"
        elif elbow_angle < self._DOWN_GATE:
            self.stage = "down"

        # Bar path: the wrist should stay stacked over the elbow. A large
        # horizontal offset means the bar is drifting toward the face or belly.
        if self.stage == "down" and abs(wrist[0] - elbow[0]) > self._BAR_DRIFT:
            self._apply_penalty(feedback, 10, "Bar drifting - stack the wrist over your elbow")

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        straight_bar = not self._rep_faults  # no bar-drift fault during the press
        depth = self.rep_min_angle
        top = self.rep_max_angle

        if depth is not None and depth > self._DEPTH_GOOD:
            self._apply_penalty(feedback, 15, "Short press - lower the bar to your chest")
        elif depth is not None:
            self._praise(positives, "Full depth - bar to the chest")

        if top is not None and top < self._LOCKOUT_GOOD:
            self._apply_penalty(feedback, 10, "Short lockout - press to full extension")
        elif top is not None:
            self._praise(positives, "Strong lockout at the top")

        rep_s = self.rep_frames / self.fps if (self.rep_frames and self.fps) else None
        if rep_s is not None and rep_s < 0.4:
            self._apply_penalty(feedback, 5, "Don't bounce the bar - control the descent")
        elif rep_s is not None and rep_s >= 1.0:
            self._praise(positives, "Nice controlled tempo")

        if straight_bar:
            self._praise(positives, "Bar tracking straight over the elbows")

    def reset(self):
        self._reset_base()
