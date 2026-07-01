import os
import pathlib
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

_ROOT = pathlib.Path(__file__).parent.parent

# Model variant. "full" is far more accurate than "lite" for the same landmark
# schema; override with POSE_MODEL_VARIANT ("lite" | "full" | "heavy") if needed.
_MODEL_VARIANT = os.getenv("POSE_MODEL_VARIANT", "full").lower()
_MODEL_FILE = f"pose_landmarker_{_MODEL_VARIANT}.task"
MODEL_PATH = str(_ROOT / _MODEL_FILE)
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    f"pose_landmarker_{_MODEL_VARIANT}/float16/latest/{_MODEL_FILE}"
)

POSE_CONNECTIONS = [
    (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),  # arms
    (11, 23), (12, 24), (23, 24),                        # torso
    (23, 25), (25, 27), (27, 29), (27, 31),              # left leg
    (24, 26), (26, 28), (28, 30), (28, 32),              # right leg
]


def ensure_model() -> str:
    if not os.path.exists(MODEL_PATH):
        print(f"Downloading pose model to {MODEL_PATH}...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Model downloaded.")
    return MODEL_PATH


def _resolve_delegate() -> "mp_python.BaseOptions.Delegate":
    """Pick the inference delegate from POSE_DELEGATE ("cpu" | "gpu").

    Dev machines run on CPU; the production GPU server sets POSE_DELEGATE=gpu.
    Falls back to CPU on any unrecognized value.
    """
    delegate = os.getenv("POSE_DELEGATE", "cpu").lower()
    if delegate == "gpu":
        return mp_python.BaseOptions.Delegate.GPU
    return mp_python.BaseOptions.Delegate.CPU


def create_landmarker(model_path: str) -> vision.PoseLandmarker:
    base_options = mp_python.BaseOptions(
        model_asset_path=model_path,
        delegate=_resolve_delegate(),
    )
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return vision.PoseLandmarker.create_from_options(options)


def detect(landmarker: vision.PoseLandmarker, rgb_frame, timestamp_ms: int):
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    result = landmarker.detect_for_video(mp_image, timestamp_ms)
    if result.pose_landmarks:
        return result.pose_landmarks[0]
    return None
