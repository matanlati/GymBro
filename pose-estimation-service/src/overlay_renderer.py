import cv2
from .pose_detector import POSE_CONNECTIONS
from .exercises.base import FrameResult


def draw_skeleton(frame, landmarks):
    h, w, _ = frame.shape
    for start_idx, end_idx in POSE_CONNECTIONS:
        if start_idx < len(landmarks) and end_idx < len(landmarks):
            s = landmarks[start_idx]
            e = landmarks[end_idx]
            cv2.line(frame,
                     (int(s.x * w), int(s.y * h)),
                     (int(e.x * w), int(e.y * h)),
                     (0, 255, 0), 2)
    for lm in landmarks:
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 5, (0, 0, 255), -1)
    return frame


def _text_box(frame, text, position, font_scale=0.6, thickness=2,
              bg_color=(0, 0, 0), text_color=(255, 255, 255)) -> int:
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    x, y = position
    cv2.rectangle(frame, (x - 5, y - th - 5), (x + tw + 5, y + baseline + 5), bg_color, -1)
    cv2.putText(frame, text, (x, y), font, font_scale, text_color, thickness)
    return th + baseline + 10


def draw_metrics(frame, result: FrameResult):
    h, w, _ = frame.shape
    y = 30

    y += _text_box(frame, f"Reps: {result.rep_count}", (10, y),
                   font_scale=1.0, thickness=2, bg_color=(0, 100, 0))

    y += _text_box(frame, f"Stage: {result.stage.upper()}", (10, y),
                   font_scale=0.7, thickness=2)

    if result.stage not in ("start", "error"):
        q = result.current_quality
        q_color = (0, 255, 0) if q >= 80 else (0, 165, 255) if q >= 60 else (0, 0, 255)
        y += _text_box(frame, f"Quality: {int(q)}%", (10, y),
                       font_scale=0.7, thickness=2, bg_color=q_color)

        # Live rep tempo so lifters can see whether they are grinding through the
        # rep or bouncing/swinging (very low seconds = too fast).
        if result.tempo_s is not None:
            y += _text_box(frame, f"Tempo: {result.tempo_s:.1f}s", (10, y),
                           font_scale=0.7, thickness=2)

    feedback_y = h - 20
    for fb in reversed(result.feedback[-3:]):
        _text_box(frame, fb, (10, feedback_y),
                  font_scale=0.6, thickness=2, bg_color=(0, 0, 150))
        feedback_y -= 30

    if result.primary_angle is not None:
        _text_box(frame, f"Angle: {int(result.primary_angle)}", (w - 160, 30),
                  font_scale=0.7, thickness=2)

    return frame
