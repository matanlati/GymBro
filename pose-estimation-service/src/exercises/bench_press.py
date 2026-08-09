from ..pose_detector import PoseFrame
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

    Rep counting is deliberately FORGIVING here: even a partial press counts as
    a rep, with the missing range reflected in the score and cues rather than by
    dropping the rep.
    """

    _LEFT = dict(shoulder=5, elbow=7, wrist=9)
    _RIGHT = dict(shoulder=6, elbow=8, wrist=10)

    # AIGym measures the elbow angle (shoulder-elbow-wrist). Wider gates than
    # the push-up so a partial-range rep still registers - see the class note.
    KPTS_LEFT = [5, 7, 9]
    KPTS_RIGHT = [6, 8, 10]
    # The elbow sweeps ~175 (locked out) down to ~70-90 with the bar on the
    # chest. NB: the "45-75 deg" figures in bench-press coaching articles are
    # elbow *flare relative to the torso*, a frontal-plane measure this
    # shoulder-elbow-wrist angle cannot see at all. Don't copy them here.
    DOWN_ANGLE = 120.0
    UP_ANGLE = 140.0
    # Grading thresholds, strict tier (see base.py), read off the whole rep
    # rather than one frame:
    _DEPTH_GOOD = 95.0     # bar reached the chest
    _LOCKOUT_GOOD = 165.0  # arms locked out at the top
    _BAR_DRIFT = 0.12      # wrist-over-elbow horizontal offset (frac of frame)

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        elbow = self.lm(landmarks, idxs["elbow"])
        wrist = self.lm(landmarks, idxs["wrist"])

        elbow_angle = pose.angle
        self._track(elbow_angle)
        feedback = []
        positives = []

        self._sync_reps(pose, feedback, positives)

        # A large wrist-over-elbow offset means the bar is drifting toward the
        # face or the belly rather than travelling straight.
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
