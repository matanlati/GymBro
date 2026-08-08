"""Post-processing / enrichment of raw pose analysis using an LLM.

The pose pipeline produces deterministic, low-level metrics (rep count,
per-rep quality scores and a tally of detected technique faults). This module
turns those raw numbers into the richer, user-facing ``AnalysisResponse`` by
asking an LLM to act as a coach and explain the results.

The LLM is strictly an enrichment layer: any failure (service down, timeout,
bad/invalid JSON) falls back to a deterministic response built straight from
the metrics, so the API never fails because of the LLM.
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

from .llm_client import LLMClient
from .models import AnalysisResponse, EvaluationIssue
from .video_processor import ProcessingResult

logger = logging.getLogger(__name__)

# Educational "skill" doc injected into the enrichment prompt as coaching
# context. Like the reference block it is *never* a source of measured numbers -
# it only teaches the model how to phrase richer feedback.
_COACHING_SKILL_PATH = os.path.join(os.path.dirname(__file__), "coaching_skill.md")
_coaching_skill_cache: Optional[str] = None


def _load_coaching_skill() -> str:
    """Load the coaching skill doc once, caching the result.

    Returns an empty string if the file is missing or unreadable, so a lost doc
    degrades to the skill-free prompt instead of breaking enrichment.
    """
    global _coaching_skill_cache
    if _coaching_skill_cache is None:
        try:
            with open(_COACHING_SKILL_PATH, "r", encoding="utf-8") as fh:
                _coaching_skill_cache = fh.read().strip()
        except OSError as error:
            logger.warning("Could not load coaching skill doc: %s", error)
            _coaching_skill_cache = ""
    return _coaching_skill_cache

# Below this fraction of frames with a detected pose we warn the consumer that
# the analysis may be less reliable.
_RELIABILITY_THRESHOLD = 0.8

# The set of attribute names the model is allowed to return for an issue.
_ISSUE_FIELDS = {"title", "severity", "explanation", "affected_reps", "suggestion"}

# Static, curated coaching reference per exercise. This is deliberately a keyed
# lookup (exercise_type is an explicit, validated enum) rather than a RAG store:
# the corpus is tiny and fixed, so a dict is deterministic, zero-latency and adds
# no infra. Only the entry for the filmed exercise is injected.
#
# "measures" and "targets" are what make the metrics interpretable: without them
# the model sees "min_angle: 105" with no idea which joint that is or whether it
# is good. They mirror the analyzed joint and grading thresholds in the matching
# ``exercises/`` class, so edit both together.
_EXERCISE_REFERENCE = {
    "squat": {
        "trains": "Quadriceps and glutes, with the hamstrings, adductors and spinal "
                  "erectors bracing. A knee- and hip-dominant squat pattern.",
        "measures": "Knee angle (hip-knee-ankle). min_angle is the deepest point of "
                    "the rep, max_angle the standing lockout.",
        "targets": "min_angle <= 90 deg is at or below parallel; above that the rep "
                   "was shallow. Partial squats are still counted, so judge the depth "
                   "from the angle rather than from the rep count. A rep under 0.4 s "
                   "was dropped/bounced; 0.8 s or more is controlled.",
        "good_form": ["hips break below the knee crease", "knees track over the mid-foot",
                      "chest stays proud with a neutral spine",
                      "controlled 1-2 s descent, no bouncing out of the hole"],
        "common_faults": ["shallow depth", "torso pitching forward (good-morning-ing)",
                          "knees travelling well past the toes", "dropping too fast / bouncing"],
        "fixes": ["box or tempo squats to own the bottom position",
                  "ankle and hip mobility work if depth is the limiter",
                  "goblet squats to teach an upright torso",
                  "drive through the heels and brace before descending"],
    },
    "push-up": {
        "trains": "Chest, triceps and front deltoids, with the whole trunk working "
                  "as an anti-sag plank. A horizontal press performed as a moving plank.",
        "measures": "Elbow angle (shoulder-elbow-wrist). min_angle is the bottom of "
                    "the rep, max_angle the lockout at the top.",
        "targets": "min_angle <= 70 deg is full depth; above that the chest did not "
                   "come down far enough.",
        "good_form": ["chest lowers until the elbow closes to ~90 deg or less",
                      "rigid straight line from head to heels",
                      "elbows tucked ~45 deg from the torso",
                      "controlled descent, full press to near lock-out"],
        "common_faults": ["shallow depth", "hips sagging toward the floor",
                          "hips piking up into an inverted V"],
        "fixes": ["elevate the hands to keep the body line while strength builds",
                  "plank and hollow-body holds for the anti-sag brace",
                  "squeeze the glutes and pull the ribs down to lock the line",
                  "slow the lowering to 2-3 s"],
    },
    "bicep_curl": {
        "trains": "Biceps brachii and brachialis, with the forearm flexors assisting. "
                  "A single-joint elbow flexion where only the forearm should travel.",
        "measures": "Elbow angle (shoulder-elbow-wrist). min_angle is the top of the "
                    "curl (most flexed), max_angle the bottom (arm extended).",
        "targets": "min_angle <= 40 deg is a full squeeze at the top; max_angle near "
                   "150 deg or more is a full stretch at the bottom. Partial-range "
                   "curls are still counted, so judge the range from the angles.",
        "good_form": ["near-full elbow extension at the bottom of every rep",
                      "hard squeeze at the top", "upper arm and elbow pinned to the side",
                      "controlled lift with a slow 2-3 s lowering"],
        "common_faults": ["short curl, not squeezing at the top",
                          "elbows drifting forward away from the torso",
                          "swinging / using momentum to heave the weight up"],
        "fixes": ["drop the load until the elbow stays pinned",
                  "preacher or incline curls to remove the swing",
                  "stand with the back against a wall so the body cannot heave",
                  "pause one second at the top of each rep"],
    },
    "deadlift": {
        "trains": "The posterior chain - glutes, hamstrings and spinal erectors - "
                  "with the lats and grip holding the bar path. A hip hinge.",
        "measures": "Hip angle (shoulder-hip-knee). max_angle is the tall lockout, "
                    "min_angle the bottom of the hinge.",
        "targets": "max_angle >= 165 deg is a full hip lockout; below that the lifter "
                   "finished short. Partial pulls are still counted, so judge the "
                   "lockout from max_angle rather than from the rep count.",
        "good_form": ["hips and knees fully extended at a tall lock-out",
                      "hips and shoulders rise together",
                      "bar tracks close to the body over the mid-foot",
                      "braced, neutral spine throughout"],
        "common_faults": ["incomplete hip lockout at the top",
                          "hips shooting up early, dumping load on the lower back",
                          "bar or knees drifting forward away from the body"],
        "fixes": ["Romanian deadlifts to drill the hinge pattern",
                  "pause just below the knee to stop the hips outrunning the chest",
                  "finish by squeezing the glutes rather than leaning back",
                  "lighter load until the back angle holds through the pull"],
    },
    "shoulder_press": {
        "trains": "Deltoids and triceps, with the upper chest and trunk stabilizing "
                  "overhead. A vertical press to full overhead lockout.",
        "measures": "Elbow angle (shoulder-elbow-wrist). max_angle is the overhead "
                    "lockout, min_angle the bottom at shoulder height.",
        "targets": "max_angle >= 165 deg is a full lockout; min_angle <= 110 deg means "
                   "the weight came down to shoulder height. Partial presses are still "
                   "counted, so judge both ends of the range from the angles.",
        "good_form": ["press to full elbow lock-out overhead every rep",
                      "lower the weight all the way to shoulder height",
                      "ribs down and lower back neutral - no backward lean",
                      "controlled press and controlled lowering"],
        "common_faults": ["short lockout at the top", "short range at the bottom",
                          "arching the lower back to muscle the weight up"],
        "fixes": ["half-kneeling press to make the lower-back arch impossible",
                  "brace the glutes and abs before each press",
                  "lighter load so the full range is reachable",
                  "overhead mobility work if the lockout is blocked"],
    },
    "lunge": {
        "trains": "Quads and glutes of the front leg, with the trunk and rear hip "
                  "stabilizing balance. A single-leg squat pattern.",
        "measures": "Front-knee angle (hip-knee-ankle). min_angle is the bottom of "
                    "the rep.",
        "targets": "min_angle <= 100 deg puts the front thigh at parallel; above that "
                   "the rep was shallow.",
        "good_form": ["front knee bends to about 90 deg, thigh parallel to the floor",
                      "front shin stays fairly vertical, knee tracking over the ankle",
                      "torso stays tall over the hips",
                      "controlled descent, driven back up"],
        "common_faults": ["shallow depth", "front knee travelling past the toes",
                          "torso leaning forward"],
        "fixes": ["split squats to groove the depth without the balance demand",
                  "lengthen the stride so the shin stays vertical",
                  "hold a support for balance while the pattern is learned",
                  "slow the descent to 2 s"],
    },
    "lateral_raise": {
        "trains": "The lateral (side) deltoid, with the traps assisting. Shoulder "
                  "abduction - raising the arms out to the side.",
        "measures": "Abduction angle (hip-shoulder-elbow). max_angle is the top of "
                    "the raise.",
        "targets": "A peak of 80-110 deg is shoulder height, which is the target; below "
                   "80 deg the raise fell short and above 110 deg the traps take over. "
                   "Short raises are still counted, so judge the height from max_angle. "
                   "Under 0.4 s the weight was swung; 0.8 s or more is controlled.",
        "good_form": ["raise to about shoulder height and no higher",
                      "soft but fixed elbow - the arm stays long",
                      "no swinging or heaving with the torso",
                      "slow, controlled lowering"],
        "common_faults": ["falling short of shoulder height",
                          "raising too high / shrugging above shoulder height",
                          "bending the elbows to sling the weight up",
                          "swinging the weight up with momentum"],
        "fixes": ["drop to a lighter dumbbell - this is a small muscle",
                  "pause one second at shoulder height",
                  "brace the chest against an incline bench to kill the swing",
                  "take three seconds to lower each rep"],
    },
    "bench_press": {
        "trains": "Chest, triceps and front deltoids, with the upper back and legs "
                  "providing a stable base. A horizontal press.",
        "measures": "Elbow angle (shoulder-elbow-wrist). min_angle is the bar at the "
                    "chest, max_angle the lockout.",
        "targets": "min_angle <= 95 deg means the bar reached the chest; "
                   "max_angle >= 165 deg is a full lockout. A rep under 0.4 s was "
                   "bounced. Partial reps still count, so judge range from the angles.",
        "good_form": ["lower under control until the bar touches the chest",
                      "press to a full lock-out",
                      "wrist stays stacked over the elbow so the bar travels straight",
                      "shoulder blades pinned, no bouncing off the chest"],
        "common_faults": ["partial press, not touching the chest", "short lockout",
                          "bouncing the bar off the chest",
                          "bar drifting off vertical toward the head or hips"],
        "fixes": ["pause the bar on the chest for one second each rep",
                  "lighter load until the full range is clean",
                  "pick a consistent touch point on the chest and hit it every rep",
                  "keep the forearm vertical through the press"],
    },
    "lat_pulldown": {
        "trains": "The lats, with the biceps and rear delts assisting. A vertical "
                  "pull driving the elbows down and back.",
        "measures": "Elbow angle (shoulder-elbow-wrist). min_angle is the bar pulled "
                    "to the chest, max_angle the full stretch overhead.",
        "targets": "min_angle <= 90 deg is a full pull to the chest; "
                   "max_angle >= 155 deg is a full stretch at the top. Partial reps "
                   "still count, so judge range from the angles.",
        "good_form": ["start from a full stretch with the arms nearly extended overhead",
                      "pull the bar to the upper chest, driving the elbows down and back",
                      "torso stays tall and stable",
                      "controlled pull and an equally controlled release"],
        "common_faults": ["short pull, not bringing the bar to the chest",
                          "not returning to a full stretch at the top",
                          "leaning back / swinging to yank the bar down",
                          "jerky, too-fast reps"],
        "fixes": ["lighter stack so the lats do the work instead of the body",
                  "pause one second with the bar at the chest",
                  "anchor the knees firmly under the pad",
                  "think 'elbows to hips' rather than 'hands down'"],
    },
    "triceps_extension": {
        "trains": "The triceps (all three heads), isolated at the elbow. A "
                  "single-joint elbow extension with the upper arm held overhead.",
        "measures": "Elbow angle (shoulder-elbow-wrist). min_angle is the deep stretch "
                    "behind the head, max_angle the overhead lockout.",
        "targets": "min_angle <= 80 deg is a deep stretch; max_angle >= 165 deg is a "
                   "full lockout. Partial reps still count, so judge range from the angles.",
        "good_form": ["upper arm vertical and fixed by the ears - only the forearm moves",
                      "lower into a deep stretch behind the head",
                      "extend to a full lock-out, squeezing the triceps",
                      "controlled lowering, no dropping the weight"],
        "common_faults": ["incomplete lock-out at the top",
                          "short stretch, not lowering far enough behind the head",
                          "elbows flaring or the whole upper arm swinging"],
        "fixes": ["lighter load so the upper arm can stay still",
                  "a single dumbbell or cable overhead for a cleaner groove",
                  "keep the elbows pointing at the ceiling throughout",
                  "squeeze and hold the lockout for a beat"],
    },
}


def _bullets(items: list) -> str:
    return "".join(f"\n    - {item}" for item in items)


def _reference_block(exercise_type: str) -> str:
    """Render the coaching reference for the filmed exercise as prompt context."""
    ref = _EXERCISE_REFERENCE.get((exercise_type or "").lower())
    if not ref:
        return ""
    return f"""
REFERENCE FORM for this exercise (coaching context and grading thresholds — NOT
measurements from this video; never cite it as something observed):
- What it trains: {ref['trains']}
- What the analyzer measured: {ref['measures']}
- How to judge the angles: {ref['targets']}
- What good execution looks like:{_bullets(ref['good_form'])}
- Common faults for this lift:{_bullets(ref['common_faults'])}
- Proven fixes to draw recommendations from:{_bullets(ref['fixes'])}
"""


def _reps_affected(result: ProcessingResult, key: str) -> Dict[str, int]:
    """How many reps each fault/praise message touched.

    ``issue_counts`` tallies *frames*, which is not comparable across faults: a
    per-frame check like "knees past toes" racks up dozens of hits while an
    end-of-rep verdict like "too shallow" can only score once per rep. Ranking
    severity on those raw counts would bury the whole-rep faults, so we count the
    reps each message actually appeared on instead.
    """
    counts: Dict[str, int] = {}
    for rep in result.rep_details:
        for message in rep.get(key, ()):
            counts[message] = counts.get(message, 0) + 1
    return counts


def _build_analysis_payload(result: ProcessingResult) -> Dict[str, Any]:
    """Collect the raw, machine-derived facts the LLM is allowed to reason over.

    Deliberately excludes anything derivable from what is already here (per-rep
    qualities duplicate ``per_rep_details``, raw frame counts duplicate coverage)
    so the model is not re-reading the same fact in three shapes.
    """
    coverage = (
        result.frames_with_pose / result.frames_total
        if result.frames_total
        else 0.0
    )
    fault_reps = _reps_affected(result, "faults")
    praise_reps = _reps_affected(result, "praises")

    detected_faults = [
        {
            "fault": message,
            "reps_affected": fault_reps.get(message, 0),
            "frame_occurrences": frames,
        }
        for message, frames in sorted(
            result.issue_counts.items(),
            key=lambda kv: (fault_reps.get(kv[0], 0), kv[1]),
            reverse=True,
        )
    ]
    detected_strengths = [
        {"strength": message, "reps_earned": praise_reps.get(message, count)}
        for message, count in sorted(
            result.praise_counts.items(), key=lambda kv: kv[1], reverse=True
        )
    ]
    return {
        "exercise_type": result.exercise_type,
        "camera_side": result.side,
        "total_reps": result.total_reps,
        "average_quality": result.average_quality,  # 0-100, deterministic baseline
        "detected_faults": detected_faults,
        "detected_strengths": detected_strengths,
        "per_rep_details": result.rep_details,
        "pose_detection_coverage": round(coverage, 3),
    }


def build_enrichment_prompt(analysis: Dict[str, Any]) -> str:
    """Build a single, purpose-built prompt for enriching the analysis.

    The prompt pins the model to the provided metrics (no invented numbers),
    fixes the output schema exactly, and gives concrete rules for each field.
    """
    facts = json.dumps(analysis, indent=2)
    reference = _reference_block(str(analysis.get("exercise_type", "")))
    skill = _load_coaching_skill()
    skill_block = (
        f"\nCOACHING SKILL (how to coach — general context, NOT measurements "
        f"from this video):\n{skill}\n"
        if skill
        else ""
    )
    return f"""You are an expert strength-and-conditioning coach and biomechanics analyst.
A computer-vision system analyzed a single exercise video and produced the
objective metrics below. Your job is to turn these raw metrics into clear,
specific, encouraging, and educational coaching feedback.
{skill_block}
OBJECTIVE METRICS (the only ground truth you may use):
{facts}
{reference}

NOTES ON THE METRICS:
- "average_quality" is the analyzer's 0-100 form score for the set.
- "detected_faults" lists each fault with "reps_affected" (how many reps it
  touched - the comparable measure, use this for severity) and
  "frame_occurrences" (how long it persisted within those reps).
- "detected_strengths" lists what the analyzer confirmed the lifter did WELL,
  with the number of reps that earned it. These are objective positives - build
  "positiveFeedback" from them, not from guesses.
- "per_rep_details" gives, per rep: "quality" (0-100), the range of motion
  reached ("min_angle"/"max_angle"/"rom", in degrees at the joint named under
  REFERENCE FORM), "duration_s", and the "faults"/"praises" for that rep. Use it
  to call out specific reps and to describe how the set changed as it went on.
- "pose_detection_coverage" is the fraction of frames where the body was tracked.
- "camera_side" is the body side the analyzer measured ("left" or "right").

RESPOND WITH A SINGLE JSON OBJECT AND NOTHING ELSE, matching exactly this shape:
{{
  "score": <number 0-100>,
  "isGoodTechnique": <boolean>,
  "scoreExplanation": "<1-3 sentences justifying the score from the metrics>",
  "overallSummary": "<2-4 sentence plain-language summary of the performance>",
  "positiveFeedback": ["<3-5 specific things done well>", ...],
  "issues": [
    {{
      "title": "<short fault name>",
      "severity": "low" | "medium" | "high",
      "explanation": "<what went wrong and why it matters, in plain language>",
      "affected_reps": <integer or null>,
      "suggestion": "<targeted fix for this specific issue>"
    }}
  ],
  "recommendations": ["<3-5 actionable cues to improve next session>", ...],
  "techniqueTips": ["<2-4 best-practice cues for this lift in general>", ...],
  "dataReliabilityNote": "<note if coverage/reps make this less reliable, else null>",
  "cameraView": "<the camera_side value>",
  "ignoredMetrics": ["<any metric you could not assess>", ...]
}}

RULES:
- Ground every statement in the metrics above. Never invent reps, faults, angles
  or counts. REFERENCE FORM and COACHING SKILL are context for phrasing advice and
  interpreting the numbers; never present them as something measured in this video.
- Quote real angles from the metrics against the REFERENCE FORM targets rather
  than using vague words: "your deepest rep was 105 deg, 15 short of the 90 deg
  parallel target" beats "your squats were shallow".
- TWO KINDS OF CONTENT, never mixed. "issues", "positiveFeedback" and
  "scoreExplanation" describe THIS video and must come from the metrics.
  "recommendations" and "techniqueTips" are coaching drawn from REFERENCE FORM;
  they may go beyond what was measured, but must be written as general advice
  for the lift, never as a claim about what the lifter did.
- Exactly one entry in "issues" per item in "detected_faults" — never split one
  fault across several entries and never repeat the same fault under two titles.
  Order them by "reps_affected", set "affected_reps" to that number, and set
  severity from the share of the set it touched: most reps -> "high", about half
  -> "medium", one or two -> "low". Do not rank faults by "frame_occurrences".
  Each issue's "explanation" should say what went wrong AND why it costs the
  lifter (joint stress, lost range, wasted effort); "suggestion" is its fix.
- "recommendations": 3-5 entries, the things that would most improve the NEXT
  session, drawn from the REFERENCE FORM fixes and prioritising the faults that
  touched the most reps. Do not restate an issue verbatim — issues carry their
  own "suggestion"; recommendations are the drills, loads and tempos to apply.
- "techniqueTips": 2-4 entries teaching how this lift is done well, drawn from
  the REFERENCE FORM good-execution points and tempo. Include cues this camera
  angle cannot verify. Never phrase them as observations about this video.
- "positiveFeedback": 3-5 entries, never empty. Ground it in
  "detected_strengths"; if there are none but reps were detected, acknowledge
  effort or consistency honestly. Explain WHY each strength matters.
- Every entry in these lists is 1-2 sentences and must add something the others
  do not already say.
- Make "overallSummary" educational: open with what the movement trains, then a
  plain-language read of how the set went, including any trend across the reps.
- Everywhere, give the "why" behind a cue, not just the instruction.
- Set "score" close to "average_quality", adjusting slightly for how many reps the
  faults touched. If "total_reps" is 0, set score to 0.
- Set "isGoodTechnique" to true only when score >= 75.
- Set "dataReliabilityNote" when pose_detection_coverage < {_RELIABILITY_THRESHOLD}
  or when total_reps is 0; otherwise use null.
- Set "cameraView" to the "camera_side" value.
- Put things the data could not assess into "ignoredMetrics" (e.g. faults in the
  plane this camera angle cannot see); use an empty list if none.
- Output JSON only."""


def _coerce_issue(raw: Any) -> Optional[EvaluationIssue]:
    if not isinstance(raw, dict):
        return None
    data = {k: v for k, v in raw.items() if k in _ISSUE_FIELDS}
    title = str(data.get("title") or "").strip()
    explanation = str(data.get("explanation") or "").strip()
    if not title or not explanation:
        return None
    severity = str(data.get("severity") or "medium").strip().lower()
    if severity not in ("low", "medium", "high"):
        severity = "medium"
    affected = data.get("affected_reps")
    try:
        affected_reps = int(affected) if affected is not None else None
    except (TypeError, ValueError):
        affected_reps = None
    suggestion = data.get("suggestion")
    return EvaluationIssue(
        title=title,
        severity=severity,
        explanation=explanation,
        affected_reps=affected_reps,
        suggestion=str(suggestion).strip() if suggestion else None,
    )


def _parse_llm_response(
    raw_text: str, result: ProcessingResult, video_url: str
) -> AnalysisResponse:
    """Parse the model's JSON text into an AnalysisResponse.

    Raises ValueError/json errors on malformed output so the caller can fall back.
    """
    data = json.loads(raw_text)
    if not isinstance(data, dict):
        raise ValueError("LLM response was not a JSON object")

    issues = [
        issue
        for issue in (_coerce_issue(i) for i in data.get("issues", []) or [])
        if issue is not None
    ]

    score = float(data.get("score", result.average_quality))
    score = max(0.0, min(100.0, score))

    def _strings(key: str) -> List[str]:
        return [str(v).strip() for v in (data.get(key) or []) if str(v).strip()]

    positive = _strings("positiveFeedback")
    recommendations = _strings("recommendations")
    tips = _strings("techniqueTips")
    ignored = data.get("ignoredMetrics")
    ignored_list: Optional[List[str]] = (
        [str(m) for m in ignored] if isinstance(ignored, list) else None
    )

    return AnalysisResponse(
        # These are authoritative on our side - we never trust the model for them.
        exerciseType=result.exercise_type,
        analized_video_url=video_url,
        score=round(score, 2),
        isGoodTechnique=bool(data.get("isGoodTechnique", score >= 75)),
        scoreExplanation=str(data.get("scoreExplanation") or "").strip()
        or _default_score_explanation(result),
        overallSummary=str(data.get("overallSummary") or "").strip()
        or " ".join(result.overall_feedback),
        positiveFeedback=positive or _default_positive(result),
        issues=issues,
        # Both fall back to the curated reference, so a model that skips a list
        # still leaves the lifter with real coaching rather than an empty panel.
        recommendations=recommendations or _default_recommendations(result),
        techniqueTips=tips or _default_tips(result),
        dataReliabilityNote=(
            str(data["dataReliabilityNote"]).strip()
            if data.get("dataReliabilityNote")
            else _reliability_note(result)
        ),
        cameraView=str(data.get("cameraView") or result.side),
        ignoredMetrics=ignored_list,
    )


# --------------------------------------------------------------------------- #
# Deterministic fallback (no LLM)
# --------------------------------------------------------------------------- #
def _reliability_note(result: ProcessingResult) -> Optional[str]:
    if result.total_reps == 0:
        return "No complete reps were detected, so the analysis is limited."
    if result.frames_total:
        coverage = result.frames_with_pose / result.frames_total
        if coverage < _RELIABILITY_THRESHOLD:
            return (
                f"The body was only tracked in {round(coverage * 100)}% of frames; "
                "some of the movement could not be measured reliably."
            )
    return None


def _default_score_explanation(result: ProcessingResult) -> str:
    if result.total_reps == 0:
        return "No complete repetitions were detected in the video."
    return (
        f"Score reflects an average form quality of {result.average_quality}% "
        f"across {result.total_reps} detected rep(s)."
    )


def _default_positive(result: ProcessingResult) -> List[str]:
    if result.total_reps == 0:
        return ["You attempted the exercise - let's get a clearer rep next time."]
    positives = [f"Completed {result.total_reps} rep(s)."]
    # Surface the analyzer's objective strengths (most frequent first) so the
    # LLM-free path still gives real, specific praise.
    positives.extend(
        sorted(result.praise_counts, key=result.praise_counts.get, reverse=True)
    )
    if result.average_quality >= 80 and not result.praise_counts:
        positives.append("Maintained strong overall form.")
    return positives


def _default_recommendations(result: ProcessingResult) -> List[str]:
    """Coaching fixes for this exercise, straight from the curated reference.

    Used whenever the LLM is unavailable or omits the list. The reference fixes
    are real coaching text, which beats the bare fault titles this used to
    return -- an enrichment outage now degrades to something still useful.
    """
    ref = _EXERCISE_REFERENCE.get((result.exercise_type or "").lower())
    if ref:
        return list(ref["fixes"])
    return ["Keep practicing to build consistency."]


def _default_tips(result: ProcessingResult) -> List[str]:
    """General best-practice cues for this exercise, from the curated reference."""
    ref = _EXERCISE_REFERENCE.get((result.exercise_type or "").lower())
    return list(ref["good_form"]) if ref else []


def _deterministic_response(
    result: ProcessingResult, video_url: str
) -> AnalysisResponse:
    """Build a valid AnalysisResponse purely from the heuristics (LLM-free)."""
    score = result.average_quality if result.total_reps else 0.0

    # Severity from the share of the set a fault touched, not from raw frame
    # counts -- see _reps_affected for why those are not comparable.
    fault_reps = _reps_affected(result, "faults")
    issues: List[EvaluationIssue] = []
    for message, frames in sorted(
        result.issue_counts.items(),
        key=lambda kv: (fault_reps.get(kv[0], 0), kv[1]),
        reverse=True,
    ):
        reps = fault_reps.get(message, 0)
        share = reps / result.total_reps if result.total_reps else 0.0
        if share >= 0.66:
            severity = "high"
        elif share >= 0.33:
            severity = "medium"
        else:
            severity = "low"
        occurred = (
            f"on {reps} of {result.total_reps} rep(s)"
            if reps
            else f"in {frames} frame(s)"
        )
        issues.append(
            EvaluationIssue(
                title=message,
                severity=severity,
                explanation=f"'{message}' was flagged {occurred}.",
                affected_reps=reps or None,
                suggestion=None,
            )
        )

    return AnalysisResponse(
        exerciseType=result.exercise_type,
        score=round(score, 2),
        isGoodTechnique=score >= 75,
        scoreExplanation=_default_score_explanation(result),
        overallSummary=" ".join(result.overall_feedback)
        or "Analysis completed.",
        positiveFeedback=_default_positive(result),
        issues=issues,
        recommendations=_default_recommendations(result),
        techniqueTips=_default_tips(result),
        dataReliabilityNote=_reliability_note(result),
        cameraView=result.side,
        ignoredMetrics=None,
        analized_video_url=video_url,
    )


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def enrich_analysis(
    result: ProcessingResult,
    video_url: str,
    client: Optional[LLMClient] = None,
) -> AnalysisResponse:
    """Enrich a ProcessingResult into an AnalysisResponse using the LLM.

    Falls back to a deterministic response on any LLM/parse failure.
    """
    prompt = build_enrichment_prompt(_build_analysis_payload(result))

    started = time.perf_counter()
    try:
        client = client or LLMClient()
        logger.info("Requesting LLM enrichment (model=%s)", client.config.default_model)
        response = client.generate_response(
            # Headroom matters more than it looks: the prompt asks for 3-5
            # positives, 3-5 recommendations, 2-4 tips and one entry per fault,
            # and a truncated response is *silently* lossy -- the JSON fails to
            # parse and the lifter drops to the deterministic reply instead.
            prompt, {"format": "json", "temperature": 0.3, "num_predict": 2800}
        )
        raw_text = response.get("response") if isinstance(response, dict) else None
        if not raw_text:
            raise ValueError("Empty response from LLM")
        enriched = _parse_llm_response(raw_text, result, video_url)
        logger.info(
            "LLM enrichment succeeded in %.2fs", time.perf_counter() - started
        )
        return enriched
    except Exception as error:  # noqa: BLE001 - enrichment must never break the API
        logger.warning(
            "LLM enrichment failed after %.2fs, using deterministic response: %s",
            time.perf_counter() - started,
            error,
        )
        return _deterministic_response(result, video_url)
