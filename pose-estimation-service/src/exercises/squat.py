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
      - Shallow depth: graded from the *deepest* knee angle of the rep (not a
        single mid-movement frame), so the score reflects how deep the rep
        actually got rather than one lucky frame.
      - Torso pitching forward (good-morning-ing the squat).
      - Knees drifting well past the toes.
      - Dropping too fast / bouncing (very short rep duration).

    Note: rep counting is unchanged -- a rep is counted once the knee bends past
    100 deg and re-extends past 160 deg, so a very shallow squat that never bends
    that far simply does not register as a rep.
    """

    _LEFT = dict(hip=23, knee=25, ankle=27, shoulder=11)
    _RIGHT = dict(hip=24, knee=26, ankle=28, shoulder=12)

    # Knee-angle gates for rep detection (unchanged from the original logic):
    # the athlete is "down" once the knee bends past 100 deg and the rep closes
    # when the knee re-extends past 160 deg.
    _DOWN_GATE = 100.0
    _UP_GATE = 160.0
    # Depth grade read off the deepest knee angle of the rep. A counted rep has
    # already broken 100 deg; below ~90 is at/below parallel (ideal).
    _DEPTH_GOOD = 90.0

    def analyze_frame(self, landmarks) -> FrameResult:
        idxs = self._LEFT if self.side == "left" else self._RIGHT
        # Core joints for the knee angle must be visible or we skip the frame.
        if not self.visible(landmarks, idxs["hip"], idxs["knee"], idxs["ankle"]):
            return self._neutral_frame()

        hip = self.lm(landmarks, idxs["hip"])
        knee = self.lm(landmarks, idxs["knee"])
        ankle = self.lm(landmarks, idxs["ankle"])
        shoulder = self.lm(landmarks, idxs["shoulder"])

        knee_angle = self.calculate_angle(hip, knee, ankle)
        self._track(knee_angle)
        sign = self._facing_sign(landmarks)
        feedback = []
        positives = []

        if knee_angle > self._UP_GATE:
            if self.stage == "down":
                self._finish_rep(feedback, positives)
            self.stage = "up"
        elif knee_angle < self._DOWN_GATE:
            self.stage = "down"

        # Frontal/sagittal faults only make sense once the athlete is actually
        # descending, so we gate them on the "down" phase to avoid flagging the
        # standing lockout.
        if self.stage == "down":
            if sign * (knee[0] - ankle[0]) > 0.08:
                self._apply_penalty(feedback, 10, "Knees past toes - sit back into your heels")
            if self.visible(landmarks, idxs["shoulder"]) and sign * (shoulder[0] - hip[0]) > 0.12:
                self._apply_penalty(feedback, 10, "Chest up - stop the torso pitching forward")

        return self._frame(knee_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        # Captured before this method adds any end-of-rep faults, so it reflects
        # only the per-frame knee/torso cues from the descent.
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
