from .base import BaseExercise, FrameResult
from .squat import Squat
from .pushup import Pushup
from .bicep_curl import BicepCurl
from .deadlift import Deadlift
from .shoulder_press import ShoulderPress
from .lunge import Lunge
from .lateral_raise import LateralRaise

_REGISTRY: dict = {
    "squat": Squat,
    "push-up": Pushup,
    "bicep_curl": BicepCurl,
    "deadlift": Deadlift,
    "shoulder_press": ShoulderPress,
    "lunge": Lunge,
    "lateral_raise": LateralRaise,
}

SUPPORTED_EXERCISES = list(_REGISTRY.keys())


def get_exercise(exercise_type: str, side: str = "left") -> BaseExercise:
    cls = _REGISTRY.get(exercise_type.lower())
    if cls is None:
        supported = ", ".join(sorted(_REGISTRY))
        raise ValueError(
            f"Unknown exercise '{exercise_type}'. Supported: {supported}"
        )
    return cls(side=side)
