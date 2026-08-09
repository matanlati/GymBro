from ..pose_detector import PoseFrame
from .base import BaseExercise, FrameResult


class BicepCurl(BaseExercise):
    """Standing dumbbell/barbell curl, analyzed from a side view.

    GOOD FORM
      - Full range each rep: near-full elbow extension at the bottom (~160 deg)
        and a hard squeeze at the top (~60 deg or less, as a side view reads it).
      - The upper arm/elbow stays pinned to the side; only the forearm moves.
      - The weight is curled by the biceps, not swung up with the torso/shoulder.
      - Controlled lift, slow (~2-3 s) lowering.

    COMMON FAULTS (what we score)
      - Short curl: not reaching a hard squeeze at the top.
      - Elbows drifting forward away from the torso.
      - Swinging / using momentum: the elbow sweeps horizontally across the rep
        as the body heaves the weight up.

    Only a curl that barely bends the arm fails to register; a partial-range curl
    counts and is graded on how hard it squeezed at the top.
    """

    _LEFT = dict(shoulder=5, elbow=7, wrist=9)
    _RIGHT = dict(shoulder=6, elbow=8, wrist=10)

    # AIGym measures the elbow angle (shoulder-elbow-wrist). It names the
    # *flexed* end "down", going by joint angle rather than where the weight is,
    # so its caption reads "down" at the top of a curl. Nothing keys off that.
    KPTS_LEFT = [5, 7, 9]
    KPTS_RIGHT = [6, 8, 10]
    # Elbow flexion ROM is ~150 deg (Physiopedia goniometry), i.e. an interior
    # floor near 30 deg -- but that is a goniometer on a bare arm. Read through
    # joint centres on a foreshortened side view, the elbow sweeps roughly 170
    # (arm hanging) down to only 55-60 at the squeeze. Both gates therefore sit
    # in the middle of that measured sweep: DOWN at 70 was only ~12 deg off the
    # deepest angle a real curl produces, so a slightly shorter curl crossed
    # nothing and counted zero reps, and UP at 150 demanded an almost straight
    # arm to re-arm the next one.
    DOWN_ANGLE = 90.0
    UP_ANGLE = 115.0
    # Strict tier (see base.py): the full-squeeze grade in _evaluate_rep. Held
    # at the bottom of what the camera can resolve, not at the anatomical limit
    # -- this sat at 40 deg, below the ~58 floor the comment above describes, so
    # the praise was dead code and every curl was faulted as short.
    _TOP_GATE = 60.0
    _SWING_RANGE = 0.12  # horizontal elbow travel (frac of frame) that reads as swing

    def __init__(self, side: str = "left"):
        super().__init__(side)
        self._reset_swing()

    def _reset_swing(self) -> None:
        self._elbow_off_min = None
        self._elbow_off_max = None

    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        landmarks = pose.keypoints
        if landmarks is None or pose.angle is None:
            return self._neutral_frame()

        idxs = self._LEFT if self.side == "left" else self._RIGHT
        if not self.visible(landmarks, idxs["shoulder"], idxs["elbow"], idxs["wrist"]):
            return self._neutral_frame()

        shoulder = self.lm(landmarks, idxs["shoulder"])
        elbow = self.lm(landmarks, idxs["elbow"])

        elbow_angle = pose.angle
        self._track(elbow_angle)
        feedback = []
        positives = []

        # Accumulated so swing can be judged over the whole rep, not per frame.
        offset = elbow[0] - shoulder[0]
        self._elbow_off_min = offset if self._elbow_off_min is None else min(self._elbow_off_min, offset)
        self._elbow_off_max = offset if self._elbow_off_max is None else max(self._elbow_off_max, offset)

        self._sync_reps(pose, feedback, positives)

        if abs(offset) > 0.15:
            self._apply_penalty(feedback, 10, "Elbow drifting forward - pin it to your side")

        return self._frame(elbow_angle, feedback, positives)

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        clean_form = not self._rep_faults  # no elbow-drift fault during the rep
        # Swing / momentum: the elbow sweeping horizontally across the rep means
        # the body heaved the weight up rather than the biceps curling it. None
        # when the elbow was never tracked, so we neither fault nor praise it.
        swing_range = (
            self._elbow_off_max - self._elbow_off_min
            if self._elbow_off_min is not None and self._elbow_off_max is not None
            else None
        )
        swing = swing_range is not None and swing_range > self._SWING_RANGE
        if swing:
            self._apply_penalty(feedback, 15, "Swinging - kill the momentum, control the weight")

        # The rep gate is deliberately forgiving, so a partial curl gets counted;
        # this is what tells the lifter it was partial. Without it a short curl
        # would simply miss out on praise and be given no reason why.
        if self.rep_min_angle is not None:
            if self.rep_min_angle <= self._TOP_GATE:
                self._praise(positives, "Full squeeze at the top")
            else:
                self._apply_penalty(feedback, 10, "Short curl - bring it all the way up and squeeze")
        if clean_form and swing_range is not None and not swing:
            self._praise(positives, "Elbows pinned, clean strict curl")
        self._reset_swing()

    def reset(self):
        self._reset_base()
        self._reset_swing()
