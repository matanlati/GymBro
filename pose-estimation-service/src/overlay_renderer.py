"""Coaching overlay drawn on top of AIGym's annotated frame.

AIGym owns the measurement layer of the render: it highlights the monitored joint
and stamps the angle, rep count and stage next to it. None of that is redrawn
here -- duplicating it would put two copies of the same numbers on the frame that
could disagree, and AIGym's are the authoritative ones.

This module draws only what AIGym has no notion of: the form quality score, the
rep tempo, and the fault/praise coaching cues.
"""

import cv2
from .exercises.base import FrameResult


def _text_box(frame, text, position, font_scale=0.6, thickness=2,
              bg_color=(0, 0, 0), text_color=(255, 255, 255)) -> int:
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    x, y = position
    cv2.rectangle(frame, (x - 5, y - th - 5), (x + tw + 5, y + baseline + 5), bg_color, -1)
    cv2.putText(frame, text, (x, y), font, font_scale, text_color, thickness)
    return th + baseline + 10


def draw_metrics(frame, result: FrameResult):
    h, _, _ = frame.shape
    y = 30

    # Reps, stage and the joint angle are AIGym's caption, drawn beside the
    # monitored joint -- see the module docstring.
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

    # Faults stack up from the bottom-left in red...
    feedback_y = h - 20
    for fb in reversed(result.feedback[-3:]):
        _text_box(frame, fb, (10, feedback_y),
                  font_scale=0.6, thickness=2, bg_color=(0, 0, 150))
        feedback_y -= 30

    # ...and praise for what went right stacks above them in green, so the two
    # never overlap and the lifter can see the good and the bad at a glance.
    for pos in reversed(result.positives[-2:]):
        _text_box(frame, pos, (10, feedback_y),
                  font_scale=0.6, thickness=2, bg_color=(0, 128, 0))
        feedback_y -= 30

    return frame
