"""Console logging setup for the service.

Uvicorn only configures its own ``uvicorn*`` loggers and leaves the root logger
alone, so without this module every ``logger.info`` in ``src/`` is dropped and
warnings escape unformatted through logging's ``lastResort`` handler. We attach
one stdout handler to the root logger instead of a dictConfig: uvicorn's config
sets ``disable_existing_loggers: False`` and marks its own loggers
``propagate: False``, so its access/error lines are not duplicated by ours.

stdout (not stderr) so PM2 files these under the app's out log; PYTHONUNBUFFERED
is already set in ``ecosystem.config.js``, so lines flush as they are written.
"""

import logging
import os
import sys
from contextlib import contextmanager
from typing import Iterator

# Uvicorn --reload re-imports the app module in the same process; without this
# guard every reload would stack another handler and duplicate every line.
_CONFIGURED = False


def setup_logging() -> None:
    """Attach a stdout handler to the root logger. Safe to call more than once."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
        )
    )

    root = logging.getLogger()
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    root.addHandler(handler)

    # torch and ultralytics emit warnings.warn() straight to stderr (e.g. the
    # per-request "Can't initialize NVML" on CPU-only boxes), which lands in the
    # middle of the log unformatted and unattributed. Route them through the
    # same handler as everything else.
    logging.captureWarnings(True)

    _CONFIGURED = True


@contextmanager
def ultralytics_log_level(level: int) -> Iterator[None]:
    """Temporarily un-mute Ultralytics' own logger.

    ``pose_detector`` pins it to ERROR because it logs per *frame* during
    analysis, but that also hides its download progress. Startup wraps the
    one-time weights fetch in this so the download is visible, then restores the
    quiet level.
    """
    from ultralytics.utils import LOGGER as ultralytics_logger

    previous = ultralytics_logger.level
    ultralytics_logger.setLevel(level)
    try:
        yield
    finally:
        ultralytics_logger.setLevel(previous)
