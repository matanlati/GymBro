import logging
import os
import uuid
from contextlib import asynccontextmanager, contextmanager
from typing import Optional
from urllib.parse import urlsplit

# Ultralytics accesses cv2.imshow at import time (utils/patches.py), which only
# exists on GUI-enabled opencv builds -- so we can't switch to opencv-python-headless
# here. Worse, ultralytics.utils.checks.check_imshow() unconditionally *calls*
# cv2.imshow() during BaseSolution.__init__ (regardless of our show=False) to probe
# display support, gated only on Linux by `"DISPLAY" in os.environ`. WSLg auto-sets
# DISPLAY even though there's no real X server here, so it proceeds to actually open
# a window and Qt hard-aborts the process trying to load a platform plugin (this repo
# never calls imshow itself, and this opencv build's Qt only bundles "xcb", not
# "offscreen", so QT_QPA_PLATFORM=offscreen has no plugin to fall back to). Removing
# DISPLAY makes that probe's assert fail cleanly instead, so imshow is never called.
os.environ.pop("DISPLAY", None)

# Configured before the imports below so anything they log while importing is
# already formatted. This module only touches stdlib logging, so it cannot
# disturb the DISPLAY ordering the comment above depends on.
from .logging_config import setup_logging

setup_logging()

import requests as http_requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles

from . import pose_detector
from .models import AnalysisResponse, VideoRequest
from .exercises import SUPPORTED_EXERCISES
from .video_processor import ProcessingResult, process_video, process_upload, OUTPUT_DIR
from .post_processor import enrich_analysis

logger = logging.getLogger(__name__)

os.makedirs(OUTPUT_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Do the once-per-process setup here, not on the first request.

    The pose weights are the reason this hook exists: AIGym builds a YOLO per
    clip, and YOLO downloads its weights on construction, so without a startup
    fetch the first analysis on a fresh box pays for the download.
    """
    logger.info("Pose-estimation service starting")
    logger.info(
        "Output dir: %s | %d supported exercises",
        os.path.abspath(OUTPUT_DIR),
        len(SUPPORTED_EXERCISES),
    )
    try:
        pose_detector.ensure_model_weights()
    except Exception:
        # Keep serving: /health reports the model as not ready, and the first
        # analysis retries the fetch rather than the process refusing to boot.
        logger.exception("Failed to prepare pose model weights at startup")
    logger.info("Service ready")

    yield

    logger.info("Pose-estimation service shutting down")


app = FastAPI(title="Exercise Form Analysis API", lifespan=lifespan)
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")


@contextmanager
def _analysis_errors():
    """Map the pipeline's exceptions onto HTTP status codes.

    Every branch logs first: the HTTP detail string reaches the caller, but
    without this the console keeps no record of why a request failed -- and the
    catch-all would discard the traceback entirely.
    """
    try:
        yield
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning("Rejected request (422): %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except http_requests.HTTPError as e:
        logger.warning("Video download failed (400): %s", e)
        raise HTTPException(status_code=400, detail=f"Failed to download video: {e}")
    except RuntimeError as e:
        logger.warning("Pipeline error (400): %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Unhandled analysis failure (500)")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


def _respond(result: ProcessingResult, http_request: Request) -> AnalysisResponse:
    filename = os.path.basename(result.output_path)
    video_url = f"{http_request.base_url}videos/{filename}"
    response = enrich_analysis(result, video_url)
    logger.info(
        "Analysis complete: %s reps=%d avg_quality=%.1f -> %s",
        result.exercise_type,
        result.total_reps,
        result.average_quality,
        filename,
    )
    return response


def _safe_url(url: str) -> str:
    """Host + path only -- a source URL can carry a signed token in its query."""
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}{parts.path}"


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_exercise(request: VideoRequest, http_request: Request):
    logger.info(
        "POST /analyze exercise=%s side=%s source=%s",
        request.exercise_type,
        request.side,
        _safe_url(str(request.video_url)),
    )
    with _analysis_errors():
        result = process_video(
            video_url=str(request.video_url),
            exercise_type=request.exercise_type,
            side=request.side,
            output_filename=request.output_filename,
        )
    return _respond(result, http_request)


@app.post("/analyze/upload", response_model=AnalysisResponse)
async def analyze_exercise_upload(
    http_request: Request,
    file: UploadFile = File(...),
    exercise_type: str = Form("squat"),
    side: str = Form("left"),
    output_filename: Optional[str] = Form(None),
):
    logger.info(
        "POST /analyze/upload exercise=%s side=%s file=%s type=%s",
        exercise_type,
        side,
        file.filename,
        file.content_type,
    )
    if not file.content_type or not file.content_type.startswith("video/"):
        logger.warning("Rejected upload (422): content_type=%s", file.content_type)
        raise HTTPException(status_code=422, detail="Uploaded file must be a video")

    # Default per request, not per process: a default evaluated at import time
    # would hand every upload the same filename and overwrite the last one.
    output_filename = output_filename or f"{uuid.uuid4().hex}.mp4"

    with _analysis_errors():
        data = await file.read()
        logger.info("Upload received: %.1f MB", len(data) / 1e6)
        result = process_upload(
            file_data=data,
            exercise_type=exercise_type,
            side=side,
            output_filename=output_filename,
        )
    return _respond(result, http_request)


@app.get("/")
async def root():
    return {
        "message": "Exercise Form Analysis API",
        "endpoints": {
            "/analyze": "POST JSON - Analyze exercise video by URL",
            "/analyze/upload": "POST multipart/form-data - Analyze uploaded video file",
            "/videos/{filename}": "GET - Stream annotated output video",
            "/docs": "GET - API documentation",
        },
        "supported_exercises": SUPPORTED_EXERCISES,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": pose_detector.model_status()}
