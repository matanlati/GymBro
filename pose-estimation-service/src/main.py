import os
import requests as http_requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles
from typing import Optional

from .models import AnalysisResponse, VideoRequest
from .exercises import SUPPORTED_EXERCISES
from .video_processor import process_video, process_upload, OUTPUT_DIR
from .post_processor import enrich_analysis
import uuid

os.makedirs(OUTPUT_DIR, exist_ok=True)

app = FastAPI(title="Exercise Form Analysis API")
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_exercise(request: VideoRequest, http_request: Request):
    try:
        result = process_video(
            video_url=str(request.video_url),
            exercise_type=request.exercise_type,
            side=request.side,
            output_filename=request.output_filename,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except http_requests.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download video: {e}")
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    filename = os.path.basename(result.output_path)
    video_url = str(http_request.base_url) + f"videos/{filename}"

    return enrich_analysis(result, video_url)


@app.post("/analyze/upload", response_model=AnalysisResponse)
async def analyze_exercise_upload(
    http_request: Request,
    file: UploadFile = File(...),
    exercise_type: str = Form("squat"),
    side: str = Form("left"),
    output_filename: Optional[str] = Form(uuid.uuid4().hex + ".mp4"),
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=422, detail="Uploaded file must be a video")

    try:
        data = await file.read()
        result = process_upload(
            file_data=data,
            exercise_type=exercise_type,
            side=side,
            output_filename=output_filename,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    filename = os.path.basename(result.output_path)
    video_url = str(http_request.base_url) + f"videos/{filename}"

    return enrich_analysis(result, video_url)


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
