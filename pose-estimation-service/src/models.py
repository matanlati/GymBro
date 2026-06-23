from typing import List
from typing import Optional
from pydantic import BaseModel, HttpUrl


class VideoRequest(BaseModel):
    video_url: HttpUrl
    exercise_type: str = "squat"  # squat, pushup, bicep_curl, etc
    side: str = "left"  # left or right side for analysis
    output_filename: Optional[str] = None  # Optional custom output filename


class EvaluationIssue(BaseModel):
    """A single technique fault detected during the exercise."""

    title: str  # short label, e.g. "Insufficient squat depth"
    severity: str  # "low" | "medium" | "high"
    description: str  # plain-language explanation of what went wrong
    affected_reps: Optional[int] = None  # how many reps showed this issue (best effort)
    recommendation: Optional[str] = None  # targeted fix for this specific issue


class AnalysisResponse(BaseModel):
    exerciseType: str
    score: float
    isGoodTechnique: bool
    scoreExplanation: str
    overallSummary: str
    positiveFeedback: List[str]
    issues: List[EvaluationIssue]
    recommendations: List[str]
    dataReliabilityNote: Optional[str] = None
    cameraView: Optional[str] = None
    ignoredMetrics: Optional[List[str]] = None
    analized_video_url: str
