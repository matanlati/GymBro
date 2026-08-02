import os
import uuid
from contextlib import contextmanager
from typing import Optional

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

import requests as http_requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles

from .models import AnalysisResponse, VideoRequest
from .exercises import SUPPORTED_EXERCISES
from .video_processor import ProcessingResult, process_video, process_upload, OUTPUT_DIR
from .post_processor import enrich_analysis

os.makedirs(OUTPUT_DIR, exist_ok=True)

app = FastAPI(title="Exercise Form Analysis API")
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")


@contextmanager
def _analysis_errors():
    """Map the pipeline's exceptions onto HTTP status codes."""
    try:
        yield
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except http_requests.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download video: {e}")
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


def _respond(result: ProcessingResult, http_request: Request) -> AnalysisResponse:
    filename = os.path.basename(result.output_path)
    video_url = f"{http_request.base_url}videos/{filename}"
    return enrich_analysis(result, video_url)


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_exercise(request: VideoRequest, http_request: Request):
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
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=422, detail="Uploaded file must be a video")

    # Default per request, not per process: a default evaluated at import time
    # would hand every upload the same filename and overwrite the last one.
    output_filename = output_filename or f"{uuid.uuid4().hex}.mp4"

    with _analysis_errors():
        data = await file.read()
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
    return {"status": "healthy"}
