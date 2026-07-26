from typing import List, Optional

from pydantic import BaseModel, HttpUrl


class VideoRequest(BaseModel):
    video_url: HttpUrl
    exercise_type: str = "squat"  # see exercises.SUPPORTED_EXERCISES
    side: str = "left"  # body side to analyze: "left" or "right"
    output_filename: Optional[str] = None


class EvaluationIssue(BaseModel):
    """A single technique fault detected during the exercise.

    ``explanation`` / ``suggestion`` are named for the consumers: the backend
    ``EvaluationIssue`` type and the AiCoach renderer both read those keys, and
    nothing between here and the browser remaps them.
    """

    title: str  # short label, e.g. "Insufficient squat depth"
    severity: str  # "low" | "medium" | "high"
    explanation: str
    affected_reps: Optional[int] = None  # best effort; None when unknown
    suggestion: Optional[str] = None


class AnalysisResponse(BaseModel):
    exerciseType: str
    score: float
    isGoodTechnique: bool
    scoreExplanation: str
    overallSummary: str
    positiveFeedback: List[str]
    issues: List[EvaluationIssue]
    # Fixes for what went wrong in THIS set. Distinct from techniqueTips, which
    # is general best-practice coaching for the lift regardless of performance.
    recommendations: List[str]
    techniqueTips: List[str] = []
    dataReliabilityNote: Optional[str] = None
    cameraView: Optional[str] = None
    ignoredMetrics: Optional[List[str]] = None
    analized_video_url: str
