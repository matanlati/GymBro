import cv2
import os
import subprocess
import tempfile
import requests
import imageio_ffmpeg
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, Tuple

from . import pose_detector
from . import overlay_renderer
from .exercises import get_exercise
from .exercises.base import BaseExercise

OUTPUT_DIR = "output_videos"


@dataclass
class ProcessingResult:
    output_path: str
    total_reps: int
    average_quality: float
    overall_feedback: list
    exercise_type: str = ""
    side: str = "left"
    per_rep_qualities: list = field(default_factory=list)
    issue_counts: dict = field(default_factory=dict)
    frames_total: int = 0
    frames_with_pose: int = 0


def download_video(url: str) -> str:
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    for chunk in response.iter_content(chunk_size=8192):
        tmp.write(chunk)
    tmp.close()
    return tmp.name


def save_upload(data: bytes) -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp.write(data)
    tmp.close()
    return tmp.name


def _transcode_to_h264(src: str, dst: str) -> None:
    """Re-encode a video to browser-playable H.264.

    OpenCV's bundled ffmpeg can only write MPEG-4 Part 2 ("mp4v") here, which
    HTML5 <video> cannot decode. imageio-ffmpeg ships a static ffmpeg binary
    (no system install needed) that includes libx264.
    """
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-i", src,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-an",
        dst,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"H.264 transcode failed: {proc.stderr.strip()}")


def _output_path(exercise_type: str, output_filename: Optional[str]) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if output_filename:
        return os.path.join(OUTPUT_DIR, output_filename)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return os.path.join(OUTPUT_DIR, f"{exercise_type}_{ts}.mp4")


def _run_pipeline(
    video_path: str,
    exercise: BaseExercise,
    out_path: str,
) -> Tuple[int, int]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Could not open video file")

    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # OpenCV can only write MPEG-4 Part 2 here, which browsers can't play, so
    # write to a temp file and transcode it to H.264 below.
    raw = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    raw.close()
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(raw.name, fourcc, fps, (width, height))
    model_path = pose_detector.ensure_model()

    frames_total = 0
    frames_with_pose = 0
    try:
        with pose_detector.create_landmarker(model_path) as landmarker:
            frame_idx = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                frames_total += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp_ms = int((frame_idx / fps) * 1000)
                landmarks = pose_detector.detect(landmarker, rgb, timestamp_ms)

                if landmarks is not None:
                    frames_with_pose += 1
                    frame = overlay_renderer.draw_skeleton(frame, landmarks)
                    result = exercise.analyze_frame(landmarks)
                    frame = overlay_renderer.draw_metrics(frame, result)

                writer.write(frame)
                frame_idx += 1

        cap.release()
        writer.release()
        _transcode_to_h264(raw.name, out_path)
    finally:
        try:
            os.unlink(raw.name)
        except OSError:
            pass
    return frames_total, frames_with_pose


def _build_result(
    exercise: BaseExercise,
    out_path: str,
    exercise_type: str,
    side: str,
    frames_total: int = 0,
    frames_with_pose: int = 0,
) -> ProcessingResult:
    avg_quality = (
        sum(exercise.all_qualities) / len(exercise.all_qualities)
        if exercise.all_qualities else 0.0
    )
    overall_feedback = []
    if exercise.rep_count == 0:
        overall_feedback.append("No reps detected. Ensure full range of motion.")
    elif avg_quality < 70:
        overall_feedback.append("Form needs improvement. Focus on the feedback shown in video.")
    elif avg_quality >= 90:
        overall_feedback.append("Excellent form! Keep it up.")
    else:
        overall_feedback.append("Good form overall with room for improvement.")

    return ProcessingResult(
        output_path=out_path,
        total_reps=exercise.rep_count,
        average_quality=round(avg_quality, 2),
        overall_feedback=overall_feedback,
        exercise_type=exercise_type,
        side=side,
        per_rep_qualities=[round(q, 2) for q in exercise.all_qualities],
        issue_counts=dict(exercise.issue_counts),
        frames_total=frames_total,
        frames_with_pose=frames_with_pose,
    )


def process_video(
    video_url: str,
    exercise_type: str,
    side: str = "left",
    output_filename: Optional[str] = None,
) -> ProcessingResult:
    exercise = get_exercise(exercise_type, side)
    out_path = _output_path(exercise_type, output_filename)
    video_path = None
    frames_total = frames_with_pose = 0
    try:
        video_path = download_video(video_url)
        frames_total, frames_with_pose = _run_pipeline(video_path, exercise, out_path)
    finally:
        if video_path:
            try:
                os.unlink(video_path)
            except OSError:
                pass
    return _build_result(
        exercise, out_path, exercise_type, side, frames_total, frames_with_pose
    )


def process_upload(
    file_data: bytes,
    exercise_type: str,
    side: str = "left",
    output_filename: Optional[str] = None,
) -> ProcessingResult:
    exercise = get_exercise(exercise_type, side)
    out_path = _output_path(exercise_type, output_filename)
    video_path = None
    frames_total = frames_with_pose = 0
    try:
        video_path = save_upload(file_data)
        frames_total, frames_with_pose = _run_pipeline(video_path, exercise, out_path)
    finally:
        if video_path:
            try:
                os.unlink(video_path)
            except OSError:
                pass
    return _build_result(
        exercise, out_path, exercise_type, side, frames_total, frames_with_pose
    )
