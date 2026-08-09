from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from ..pose_detector import PoseFrame, estimate_pose_angle


@dataclass
class FrameResult:
    """One frame's worth of coaching state, rendered by the overlay.

    ``feedback`` holds faults and ``positives`` holds praise; they are kept apart
    so the overlay can colour them differently and because praise is purely
    informational -- it never changes the score.
    """

    primary_angle: Optional[float]
    feedback: list
    stage: str
    rep_count: int
    current_quality: float
    tempo_s: Optional[float] = None
    positives: list = field(default_factory=list)


@dataclass
class RepDetail:
    """Per-rep summary produced the moment a rep completes.

    Surfaced to the LLM so feedback can talk about *specific* reps ("rep 3 was
    shallow and fast") instead of only whole-set averages.
    """

    index: int
    quality: float
    min_angle: Optional[float] = None
    max_angle: Optional[float] = None
    rom: Optional[float] = None
    duration_s: Optional[float] = None
    faults: list = field(default_factory=list)
    praises: list = field(default_factory=list)


class BaseExercise(ABC):
    """Form scoring for one exercise, on top of AIGym's angle/stage/rep counter.

    The division of labour: ``solutions.AIGym`` measures the movement (primary
    joint angle, up/down stage, rep count) and this class judges it (technique
    faults, per-rep grading, a 0-100 quality score). Subclasses therefore never
    compute the primary angle or run a rep state machine -- they declare which
    three keypoints AIGym should watch and at which angles a rep turns over, then
    read the answers off the ``PoseFrame``.
    """

    # Below this confidence a joint is likely occluded, so we skip the
    # measurement rather than fabricate a fault from a guessed position.
    VIS_THRESHOLD: float = 0.5
    # Landmark smoothing factor. Higher = more responsive, lower = smoother.
    # 0.5 halves the frame-to-frame jitter that otherwise inflates fault counts.
    EMA_ALPHA: float = 0.5

    # --- AIGym configuration, overridden by every subclass ------------------
    # The COCO-17 keypoint triplet whose angle defines this movement, per side.
    KPTS_LEFT: list = []
    KPTS_RIGHT: list = []
    # Rep turnover gates in degrees. AIGym counts a rep when the angle drops
    # below DOWN_ANGLE having previously been above UP_ANGLE, so DOWN_ANGLE is
    # always the smaller of the two regardless of which end of the movement the
    # exercise itself calls "down".
    #
    # "down"/"up" name the JOINT ANGLE, not the lifter's direction: "down" is
    # flexed (small angle), "up" is extended (large angle). A curl is the case
    # that makes this jarring -- the lifter's "up" (the squeeze) is AIGym's
    # "down", and its on-video caption says so. Read every threshold in these
    # files as the *interior* three-point angle, where 180 deg is a straight
    # limb. Published ROM figures are flexion, measured from the other end, so
    # they convert as `interior = 180 - flexion`; lateral raise is the one
    # exception, since hip-shoulder-elbow already *is* abduction and its
    # numbers transfer directly.
    #
    # TWO TIERS OF THRESHOLD LIVE IN THESE FILES, TUNED IN OPPOSITE DIRECTIONS.
    #
    # TIER 1, these gates: GRACEFUL. They decide only whether a rep
    # *happened*, so they are set forgivingly: a lifter who stops a little short,
    # or whose angle reads shallow because of camera foreshortening, should still
    # see their rep counted. Judging the range is the grading thresholds' job
    # (``_DEPTH_GOOD`` and friends), and a short rep gets a fault there rather
    # than silently vanishing from the count -- a missing rep is confusing, a
    # counted-but-faulted rep is coaching. Two rules follow:
    #
    #   * Every gate must be LOOSER than the grade target it feeds, and by a
    #     margin of ~15 deg, not merely on the correct side of it. DOWN_ANGLE
    #     stays above every min-angle target and UP_ANGLE below every max-angle
    #     one. A gate level with its target makes the fault dead code -- lunge
    #     briefly ran DOWN_ANGLE = _DEPTH_GOOD = 100, so every counted rep was
    #     deeper than 100 by construction, "too shallow" could never fire and its
    #     praise fired unconditionally. A gate only ~10 deg clear is nearly as
    #     bad: the fault then catches near-misses and nothing else.
    #   * Keep the two gates ~20 deg apart. The band used to be 30, on the theory
    #     that a wider one is safer, but the cost landed on the wrong side: since
    #     a rep only closes once the angle crosses back past UP_ANGLE, a high gate
    #     meant a lifter who stopped short of lock-out re-armed nothing and the
    #     whole set counted zero reps, and it pinned every rep's max angle just
    #     under the lock-out grade so that grade could barely fail. Roughly
    #     20 deg keeps partial reps counted and leaves the grades room to work.
    #     The accepted cost: a narrower band sits closer to keypoint jitter, so a
    #     lifter pausing right at a gate may produce a phantom rep. A duplicated
    #     rep is visible and self-correcting; a missing one is just confusing.
    #
    # TIER 2, the grading thresholds each subclass evaluates for itself
    # (``_DEPTH_GOOD``, ``_LOCKOUT_GOOD``, ``_TOP_GATE``, ``_STRETCH_GOOD``,
    # ...): STRICT. That is where the coaching happens, so they sit at the real
    # standard rather than at what is easy to hit. Keeping tier 1 loose is what
    # buys the room to be strict here: the partial rep is counted, and then told
    # it was partial.
    #
    # But STRICT IS NOT THE SAME AS UNREACHABLE. A threshold set past what a 2D
    # side view can physically produce is not demanding, it is broken -- its
    # praise becomes dead code and its fault fires on 100% of reps, including
    # perfect ones, which teaches the lifter nothing. bicep_curl's _TOP_GATE sat
    # at 40 deg, a goniometer figure the camera never reads through soft tissue
    # and foreshortening, so every curl was called short. Sanity-check a new
    # threshold against the angles the model actually emits, not against
    # anatomy: a message that fires on every rep, or on none, is outside the
    # measurable range.
    UP_ANGLE: float = 160.0
    DOWN_ANGLE: float = 90.0
    # The resting end of the movement, where the lifter starts and returns to,
    # and therefore where a rep is complete enough to grade. See ``_sync_reps``
    # for why grading waits for it. The test is simply "which end does the
    # lifter rest at?" -- "up" suits everything that rests extended, while the
    # three movements that rest flexed override to "down": lateral raise (arms
    # hanging), deadlift (bar on the floor) and shoulder press (bar racked at
    # the shoulders).
    #
    # Getting this wrong does not break the rep count -- AIGym owns that -- so
    # it fails silently, which is how deadlift and shoulder press stayed wrong
    # for a while. It fails *subtly*, too: closing at the far end offsets each
    # graded window by half a rep, but the boundary still lands on the UP_ANGLE
    # crossing, so the window keeps enclosing exactly one peak and one trough
    # and ``rep_min_angle`` / ``rep_max_angle`` / ``rom`` still look right. What
    # actually goes wrong is the other two:
    #
    #   * Per-frame faults -- the ones gated on ``self.stage`` -- land one rep
    #     early, because the phase the offset window contains belongs to the
    #     *next* rep. A "hips shooting up" on rep 3's pull was reported as rep 2.
    #   * ``duration_s`` is wrong at the set's boundaries: the first rep's window
    #     also swallows the opening phase (~+45%) and the last is cut short by
    #     ``finish_set`` (~-35%).
    REP_CLOSES_AT: str = "up"

    def __init__(self, side: str = "left"):
        self.side = side.lower()
        # Overwritten by the pipeline so per-rep durations come out in seconds.
        self.fps: float = 30.0
        self.rep_count: int = 0
        self.stage: Optional[str] = None
        self.current_quality: float = 100.0
        self.all_qualities: list = []
        # Whole-set tallies, surfaced to the LLM as "detected_faults" / "detected_strengths".
        self.issue_counts: dict = {}
        self.praise_counts: dict = {}
        self.rep_details: list = []
        self._ema: dict = {}
        # Accumulated across the rep in progress. Depth, lock-out and tempo are
        # properties of the *whole* rep, so ``_evaluate_rep`` grades them from
        # these rather than from a single mid-movement frame.
        self.rep_min_angle: Optional[float] = None
        self.rep_max_angle: Optional[float] = None
        self.rep_frames: int = 0
        self._rep_faults: list = []
        self._rep_praises: list = []
        self._last_count: int = 0
        self._pending_reps: int = 0

    def kpts(self) -> list:
        """The keypoint triplet AIGym should measure for the analyzed side."""
        return self.KPTS_LEFT if self.side == "left" else self.KPTS_RIGHT

    # Ultralytics' three-point angle, re-exported so subclasses can measure the
    # *secondary* angles AIGym does not provide -- it computes exactly one.
    calculate_angle = staticmethod(estimate_pose_angle)

    def lm(self, landmarks, idx) -> list:
        """Return an EMA-smoothed ``[x, y]`` for a landmark index."""
        p = landmarks[idx]
        prev = self._ema.get(idx)
        if prev is None:
            sx, sy = p.x, p.y
        else:
            a = self.EMA_ALPHA
            sx = a * p.x + (1 - a) * prev[0]
            sy = a * p.y + (1 - a) * prev[1]
        self._ema[idx] = (sx, sy)
        return [sx, sy]

    @staticmethod
    def visibility(landmarks, idx) -> float:
        """Per-landmark visibility in [0, 1]; 1.0 if the model omits it."""
        return float(getattr(landmarks[idx], "visibility", 1.0))

    def visible(self, landmarks, *idxs) -> bool:
        """True only when every given landmark clears VIS_THRESHOLD."""
        return all(self.visibility(landmarks, i) >= self.VIS_THRESHOLD for i in idxs)

    _NOSE = 0

    def _facing_sign(self, landmarks) -> int:
        """Which way the athlete faces the camera, as +1 (toward +x) or -1.

        Every left/right check ("knee past toes", "torso pitching forward") is a
        statement about the *forward* direction, which flips with the filming
        side. COCO-17 has no toe keypoints, so we infer it from the nose relative
        to the hip -- weakest when the lifter faces squarely toward or away from
        the camera. Defaults to +1, the left-facing assumption.
        """
        hip_idx = 11 if self.side == "left" else 12
        if self.visible(landmarks, self._NOSE, hip_idx):
            nose = self.lm(landmarks, self._NOSE)
            hip = self.lm(landmarks, hip_idx)
            if abs(nose[0] - hip[0]) > 0.02:
                return 1 if nose[0] >= hip[0] else -1
        return 1

    def _sync_reps(self, pose: PoseFrame, feedback: list, positives: list) -> None:
        """Mirror AIGym's counter, grading each rep once the movement completes.

        AIGym is the single source of truth for *how many* reps happened -- we
        never second-guess its counter. What we do choose is *when* to grade one:
        its increment lands mid-movement at the DOWN_ANGLE crossing, so grading
        there would measure range-of-motion at the gate rather than at the real
        extremum. Instead we bank the increment and grade it when the lifter
        returns to ``REP_CLOSES_AT``, so each graded window spans one full
        rest-to-rest rep and ``_evaluate_rep`` sees the true depth, lock-out and
        duration.
        """
        # Add the delta rather than assume a single step: a dropped frame can
        # advance the count by more than one, and each rep deserves grading.
        if pose.count > self._last_count:
            self._pending_reps += pose.count - self._last_count
            self._last_count = pose.count

        if pose.stage != "-" and pose.stage != self.stage:
            self.stage = pose.stage
            if self.stage == self.REP_CLOSES_AT:
                self._close_pending(feedback, positives)

    def _close_pending(self, feedback: Optional[list] = None,
                       positives: Optional[list] = None) -> None:
        """Grade every rep AIGym has counted but we have not scored yet."""
        while self._pending_reps > 0:
            self._pending_reps -= 1
            self._finish_rep(feedback, positives)

    def finish_set(self) -> None:
        """Grade a trailing rep the clip ended before completing.

        A video that cuts out at the bottom of the last rep leaves it banked but
        ungraded. Flushing here keeps our rep total equal to AIGym's count; the
        cost is that this final rep is graded on a partial window, which is
        strictly better than dropping it from the set.
        """
        self._close_pending()

    def _track(self, angle: Optional[float]) -> None:
        """Fold a measured primary angle into the current rep's extrema/tempo."""
        if angle is None:
            return
        self.rep_frames += 1
        if self.rep_min_angle is None or angle < self.rep_min_angle:
            self.rep_min_angle = angle
        if self.rep_max_angle is None or angle > self.rep_max_angle:
            self.rep_max_angle = angle

    def _tempo_s(self) -> Optional[float]:
        """Elapsed real time in the rep in progress, or None if unknown."""
        if not self.fps:
            return None
        return round(self.rep_frames / self.fps, 2)

    def _neutral_frame(self, primary_angle: Optional[float] = None) -> "FrameResult":
        """A no-op frame for when core joints are not reliably visible.

        No rep transition and no penalty are applied, so occluded frames can no
        longer manufacture faults or miscount reps.
        """
        return FrameResult(
            primary_angle=primary_angle,
            feedback=[],
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
            tempo_s=self._tempo_s(),
            positives=[],
        )

    def _frame(
        self,
        primary_angle: Optional[float],
        feedback: list,
        positives: Optional[list] = None,
    ) -> "FrameResult":
        """Build the per-frame result, stamping live stage/quality/tempo.

        ``positives`` are optional so exercises that only track faults need not
        pass them.
        """
        return FrameResult(
            primary_angle=primary_angle,
            feedback=feedback,
            stage=self.stage or "start",
            rep_count=self.rep_count,
            current_quality=self.current_quality,
            tempo_s=self._tempo_s(),
            positives=positives or [],
        )

    def _evaluate_rep(self, feedback: list, positives: list) -> None:
        """Hook: grade range-of-motion / tempo for the rep that just closed.

        Subclasses inspect ``rep_min_angle`` / ``rep_max_angle`` / ``rep_frames``
        and call ``_apply_penalty`` for anything the per-frame checks cannot see
        (e.g. a squat that never reached depth), or ``_praise`` for a whole-rep
        success (full depth, clean lockout, controlled tempo). Messages appended
        to ``feedback`` / ``positives`` surface on the closing frame's overlay.
        Default: no end-of-rep grading.
        """
        return None

    def _finish_rep(self, feedback: Optional[list] = None,
                    positives: Optional[list] = None):
        """Close the current rep: grade its ROM/tempo, record it, then reset.

        ``feedback`` / ``positives`` are the closing frame's fault and praise
        lists; end-of-rep cues are appended to them so they render on the video at
        the moment the rep ends.
        """
        end_feedback: list = []
        end_positives: list = []
        self._evaluate_rep(end_feedback, end_positives)
        if feedback is not None:
            feedback.extend(end_feedback)
        if positives is not None:
            positives.extend(end_positives)

        self.rep_count += 1
        self.all_qualities.append(self.current_quality)
        self.rep_details.append(
            RepDetail(
                index=self.rep_count,
                quality=round(self.current_quality, 1),
                min_angle=round(self.rep_min_angle, 1) if self.rep_min_angle is not None else None,
                max_angle=round(self.rep_max_angle, 1) if self.rep_max_angle is not None else None,
                rom=round(self.rep_max_angle - self.rep_min_angle, 1)
                if self.rep_min_angle is not None and self.rep_max_angle is not None
                else None,
                duration_s=self._tempo_s(),
                faults=list(dict.fromkeys(self._rep_faults)),
                praises=list(dict.fromkeys(self._rep_praises)),
            )
        )

        # Reset per-rep accumulators for the next repetition.
        self.current_quality = 100.0
        self._rep_faults = []
        self._rep_praises = []
        self.rep_min_angle = None
        self.rep_max_angle = None
        self.rep_frames = 0

    def _apply_penalty(self, feedback: list, penalty: float, message: str):
        feedback.append(message)
        self.current_quality = min(self.current_quality, 100.0 - penalty)
        self.issue_counts[message] = self.issue_counts.get(message, 0) + 1
        self._rep_faults.append(message)

    def _praise(self, positives: list, message: str):
        """Record a positive cue: the praise twin of ``_apply_penalty``.

        Surfaces the cue on the overlay and tallies it for the LLM, but never
        touches ``current_quality`` - praise recognises good work, it does not
        inflate the score.
        """
        positives.append(message)
        self.praise_counts[message] = self.praise_counts.get(message, 0) + 1
        self._rep_praises.append(message)

    def _reset_base(self):
        self.rep_count = 0
        self.stage = None
        self.current_quality = 100.0
        self.all_qualities = []
        self.issue_counts = {}
        self.praise_counts = {}
        self.rep_details = []
        self._ema = {}
        self.rep_min_angle = None
        self.rep_max_angle = None
        self.rep_frames = 0
        self._rep_faults = []
        self._rep_praises = []
        self._last_count = 0
        self._pending_reps = 0

    @abstractmethod
    def analyze_frame(self, pose: PoseFrame) -> FrameResult:
        ...

    @abstractmethod
    def reset(self):
        ...
