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
from typing import Any, Dict, List, Optional

from .llm_client import LLMClient
from .models import AnalysisResponse, EvaluationIssue
from .video_processor import ProcessingResult

logger = logging.getLogger(__name__)

# Below this fraction of frames with a detected pose we warn the consumer that
# the analysis may be less reliable.
_RELIABILITY_THRESHOLD = 0.8

# The set of attribute names the model is allowed to return for an issue.
_ISSUE_FIELDS = {"title", "severity", "description", "affected_reps", "recommendation"}

# Static, curated coaching reference per exercise. This is deliberately a keyed
# lookup (exercise_type is an explicit, validated enum) rather than a RAG store:
# the corpus is tiny and fixed, so a dict is deterministic, zero-latency and adds
# no infra. It gives the LLM expert context to phrase feedback against, while the
# objective metrics remain the only source of numbers.
_EXERCISE_REFERENCE = {
    "squat": {
        "ideal": "Hips break below the knee crease (knee angle ~90 deg or lower), "
                 "knees tracking over toes, torso upright with a neutral spine.",
        "common_faults": ["insufficient depth", "knees caving in or driving too far forward",
                          "torso pitching forward", "heels lifting"],
        "tempo": "Controlled ~2s descent, brief pause, driven ascent.",
    },
    "push-up": {
        "ideal": "Chest lowers until elbows reach ~90 deg, body held in a straight "
                 "line from head to heels, elbows ~45 deg from the torso.",
        "common_faults": ["hips sagging or piking", "partial depth", "flaring elbows"],
        "tempo": "~2s down, controlled press up.",
    },
    "bicep_curl": {
        "ideal": "Full flexion at the top and near-full extension at the bottom "
                 "(~30-160 deg elbow range), upper arm/elbow pinned to the side.",
        "common_faults": ["elbows drifting forward", "swinging/using momentum",
                          "partial range of motion"],
        "tempo": "Controlled lift, slow ~2-3s lowering.",
    },
    "deadlift": {
        "ideal": "Full hip and knee extension at lockout, neutral (flat) spine "
                 "throughout, bar tracking close to the body.",
        "common_faults": ["rounding the lower/upper back", "incomplete hip lockout",
                          "bar drifting away from the shins"],
        "tempo": "Braced pull, controlled ~2s lowering.",
    },
    "shoulder_press": {
        "ideal": "Press to full elbow lockout overhead, ribs down with no lower-back "
                 "arch, bar lowered to shoulder height each rep.",
        "common_faults": ["arching the lower back", "not locking out", "short range at the bottom"],
        "tempo": "Controlled press and lowering.",
    },
    "lunge": {
        "ideal": "Front knee bends to ~90 deg over the ankle, torso upright, "
                 "controlled descent and drive back up.",
        "common_faults": ["shallow depth", "front knee travelling past the toes",
                          "torso leaning forward"],
        "tempo": "~2s descent, controlled return.",
    },
    "lateral_raise": {
        "ideal": "Arms raised to about shoulder height (~90 deg abduction) with a "
                 "soft-but-fixed elbow, no momentum.",
        "common_faults": ["not raising to shoulder height", "bending the elbows / swinging",
                          "shrugging the traps"],
        "tempo": "Controlled raise, slow lowering.",
    },
}


def _reference_block(exercise_type: str) -> str:
    """Render the coaching reference for an exercise as prompt context."""
    ref = _EXERCISE_REFERENCE.get((exercise_type or "").lower())
    if not ref:
        return ""
    faults = "; ".join(ref["common_faults"])
    return (
        "\nREFERENCE FORM for this exercise (general coaching context — NOT "
        "measurements from this video; never cite it as an observed number):\n"
        f"- Ideal execution: {ref['ideal']}\n"
        f"- Common faults to watch for: {faults}\n"
        f"- Typical tempo: {ref['tempo']}\n"
    )


def _build_analysis_payload(
    result: ProcessingResult, video_url: str
) -> Dict[str, Any]:
    """Collect the raw, machine-derived facts the LLM is allowed to reason over."""
    coverage = (
        result.frames_with_pose / result.frames_total
        if result.frames_total
        else 0.0
    )
    detected_faults = [
        {"fault": message, "frame_occurrences": count}
        for message, count in sorted(
            result.issue_counts.items(), key=lambda kv: kv[1], reverse=True
        )
    ]
    return {
        "exercise_type": result.exercise_type,
        "camera_side": result.side,
        "total_reps": result.total_reps,
        "average_quality": result.average_quality,  # 0-100, deterministic baseline
        "per_rep_qualities": result.per_rep_qualities,
        "detected_faults": detected_faults,
        "per_rep_details": result.rep_details,
        "pose_detection_coverage": round(coverage, 3),
        "frames_total": result.frames_total,
        "frames_with_pose": result.frames_with_pose,
        "heuristic_feedback": result.overall_feedback,
        "analized_video_url": video_url,
    }


def build_enrichment_prompt(analysis: Dict[str, Any]) -> str:
    """Build a single, purpose-built prompt for enriching the analysis.

    The prompt pins the model to the provided metrics (no invented numbers),
    fixes the output schema exactly, and gives concrete rules for each field.
    """
    facts = json.dumps(analysis, indent=2)
    reference = _reference_block(str(analysis.get("exercise_type", "")))
    return f"""You are an expert strength-and-conditioning coach and biomechanics analyst.
A computer-vision system analyzed a single exercise video and produced the
objective metrics below. Your job is to turn these raw metrics into clear,
specific, encouraging coaching feedback.

OBJECTIVE METRICS (the only ground truth you may use):
{facts}
{reference}

NOTES ON THE METRICS:
- "average_quality" and "per_rep_qualities" are 0-100 form scores from the analyzer.
- "detected_faults" lists faults the analyzer flagged and how many video frames
  each fault appeared in (higher frame_occurrences = a more persistent problem).
- "per_rep_details" gives, for each rep, its form "quality" (0-100), the range of
  motion actually reached ("min_angle"/"max_angle"/"rom", in degrees at the joint
  the analyzer measures for this exercise), the rep "duration_s" (very short =
  rushed/bounced, very long = grinding), and the "faults" that fired on that rep.
  Use it to call out specific reps (e.g. "rep 3 was shallow and rushed").
- "pose_detection_coverage" is the fraction of frames where the body was tracked;
  low coverage means some of the movement could not be measured reliably.
- "camera_side" is the body side the analyzer measured ("left" or "right").

RESPOND WITH A SINGLE JSON OBJECT AND NOTHING ELSE, matching exactly this shape:
{{
  "score": <number 0-100>,
  "isGoodTechnique": <boolean>,
  "scoreExplanation": "<1-3 sentences justifying the score from the metrics>",
  "overallSummary": "<2-4 sentence plain-language summary of the performance>",
  "positiveFeedback": ["<specific things done well>", ...],
  "issues": [
    {{
      "title": "<short fault name>",
      "severity": "low" | "medium" | "high",
      "description": "<what went wrong, in plain language>",
      "affected_reps": <integer or null>,
      "recommendation": "<targeted fix for this specific issue>"
    }}
  ],
  "recommendations": ["<actionable cues to improve next session>", ...],
  "dataReliabilityNote": "<note if coverage/reps make this less reliable, else null>",
  "cameraView": "<the camera_side value>",
  "ignoredMetrics": ["<any metric you could not assess>", ...]
}}

RULES:
- Ground every statement in the metrics above. Never invent reps, faults, or numbers.
- Use REFERENCE FORM only to phrase advice and interpret faults in expert terms;
  never present it as something measured in this specific video.
- Set "score" close to "average_quality" but you may adjust slightly for the number
  and persistence of detected faults. If "total_reps" is 0, set score to 0.
- Set "isGoodTechnique" to true only when score >= 75.
- Build one entry in "issues" per item in "detected_faults" (most frequent first),
  mapping frame_occurrences to severity (more occurrences -> higher severity).
- "positiveFeedback" must never be empty; if reps were detected, acknowledge effort
  or any well-executed aspect.
- Set "dataReliabilityNote" when pose_detection_coverage < {_RELIABILITY_THRESHOLD}
  or when total_reps is 0; otherwise use null.
- Set "cameraView" to the "camera_side" value.
- Put metrics that the data did not let you assess into "ignoredMetrics" (e.g. metrics
  for the non-visible side); use an empty list if none.
- Keep all language concise, professional and motivating. Output JSON only."""


def _coerce_issue(raw: Any) -> Optional[EvaluationIssue]:
    if not isinstance(raw, dict):
        return None
    data = {k: v for k, v in raw.items() if k in _ISSUE_FIELDS}
    title = str(data.get("title") or "").strip()
    description = str(data.get("description") or "").strip()
    if not title or not description:
        return None
    severity = str(data.get("severity") or "medium").strip().lower()
    if severity not in ("low", "medium", "high"):
        severity = "medium"
    affected = data.get("affected_reps")
    try:
        affected_reps = int(affected) if affected is not None else None
    except (TypeError, ValueError):
        affected_reps = None
    recommendation = data.get("recommendation")
    return EvaluationIssue(
        title=title,
        severity=severity,
        description=description,
        affected_reps=affected_reps,
        recommendation=str(recommendation).strip() if recommendation else None,
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

    positive = [str(p) for p in (data.get("positiveFeedback") or []) if str(p).strip()]
    recommendations = [
        str(r) for r in (data.get("recommendations") or []) if str(r).strip()
    ]
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
        recommendations=recommendations,
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
    if result.average_quality >= 80:
        positives.append("Maintained strong overall form.")
    return positives


def _deterministic_response(
    result: ProcessingResult, video_url: str
) -> AnalysisResponse:
    """Build a valid AnalysisResponse purely from the heuristics (LLM-free)."""
    score = result.average_quality if result.total_reps else 0.0

    issues: List[EvaluationIssue] = []
    max_count = max(result.issue_counts.values()) if result.issue_counts else 0
    for message, count in sorted(
        result.issue_counts.items(), key=lambda kv: kv[1], reverse=True
    ):
        if max_count and count >= 0.66 * max_count:
            severity = "high"
        elif max_count and count >= 0.33 * max_count:
            severity = "medium"
        else:
            severity = "low"
        issues.append(
            EvaluationIssue(
                title=message,
                severity=severity,
                description=f"'{message}' was flagged in {count} frame(s).",
                affected_reps=None,
                recommendation=None,
            )
        )

    recommendations = [
        msg for msg in result.issue_counts.keys()
    ] or ["Keep practicing to build consistency."]

    return AnalysisResponse(
        exerciseType=result.exercise_type,
        score=round(score, 2),
        isGoodTechnique=score >= 75,
        scoreExplanation=_default_score_explanation(result),
        overallSummary=" ".join(result.overall_feedback)
        or "Analysis completed.",
        positiveFeedback=_default_positive(result),
        issues=issues,
        recommendations=recommendations,
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
    payload = _build_analysis_payload(result, video_url)
    prompt = build_enrichment_prompt(payload)

    try:
        client = client or LLMClient()
        response = client.generate_response(
            prompt, {"format": "json", "temperature": 0.3, "num_predict": 1200}
        )
        raw_text = response.get("response") if isinstance(response, dict) else None
        if not raw_text:
            raise ValueError("Empty response from LLM")
        return _parse_llm_response(raw_text, result, video_url)
    except Exception as error:  # noqa: BLE001 - enrichment must never break the API
        logger.warning(
            "LLM enrichment failed, using deterministic response: %s", error
        )
        return _deterministic_response(result, video_url)
