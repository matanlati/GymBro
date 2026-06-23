"""HTTP client for an Ollama-style LLM service.

Ported from the project's reference TypeScript client. Talks to the
`/api/generate` and `/api/tags` endpoints using HTTP Basic auth, with
bounded retries, exponential backoff and typed errors so callers can
react to specific failure modes (auth, timeout, connection, parsing).
"""

import base64
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #
class LLMServiceError(Exception):
    """Base class for all LLM client errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        cause: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.cause = cause


class LLMConnectionError(LLMServiceError):
    """Could not reach the LLM service."""


class LLMAuthenticationError(LLMServiceError):
    """Authentication with the LLM service failed (HTTP 401)."""


class LLMTimeoutError(LLMServiceError):
    """The request to the LLM service timed out."""


class LLMParsingError(LLMServiceError):
    """The LLM response body could not be parsed as JSON."""


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
@dataclass
class LLMClientConfig:
    base_url: str
    username: str
    password: str
    default_model: str
    timeout: float  # seconds
    max_retries: int

    @classmethod
    def from_env(cls) -> "LLMClientConfig":
        return cls(
            base_url=os.getenv("LLM_BASE_URL", "http://10.10.248.41"),
            username=os.getenv("LLM_USERNAME", "student1"),
            password=os.getenv("LLM_PASSWORD", "pass123"),
            default_model=os.getenv("LLM_MODEL", "llama3.1:8b"),
            # TS used milliseconds; we use seconds, which is what requests expects.
            timeout=float(os.getenv("LLM_TIMEOUT", "30")),
            max_retries=int(os.getenv("LLM_MAX_RETRIES", "3")),
        )


class LLMClient:
    def __init__(self, config: Optional[LLMClientConfig] = None):
        self.config = config or LLMClientConfig.from_env()
        credentials = f"{self.config.username}:{self.config.password}"
        encoded = base64.b64encode(credentials.encode("utf-8")).decode("ascii")
        self.auth_header = f"Basic {encoded}"

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def generate_response(
        self, prompt: str, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate a completion from the LLM.

        ``options`` mirrors the reference client: ``format`` controls the
        response format ("json" by default) and the remaining keys are passed
        through to the model's ``options`` block (temperature, top_p, ...).
        """
        options = options or {}
        model_options = {
            "temperature": options.get("temperature", 0.7),
            "top_p": options.get("top_p", 0.9),
            "num_predict": options.get("num_predict", 1000),
        }
        # Allow callers to pass extra model options through.
        for key, value in options.items():
            if key not in ("temperature", "top_p", "num_predict", "format"):
                model_options[key] = value

        request: Dict[str, Any] = {
            "model": self.config.default_model,
            "prompt": prompt.strip(),
            "stream": False,
            "format": options.get("format", "json"),
            "options": model_options,
        }
        return self._make_request("/api/generate", "POST", request)

    def list_available_models(self) -> Dict[str, Any]:
        return self._make_request("/api/tags", "GET")

    def is_healthy(self) -> bool:
        try:
            response = self._make_request("/api/tags", "GET")
            return isinstance(response, dict)
        except Exception as error:  # noqa: BLE001 - health check must not raise
            logger.error("LLM health check failed: %s", error)
            return False

    def test_connection(self) -> Dict[str, Any]:
        try:
            response = self.generate_response(
                "Hello", {"temperature": 0.1, "num_predict": 50}
            )
            if response and response.get("response"):
                return {"success": True, "message": "Connection successful"}
            return {"success": False, "message": "Invalid response format"}
        except Exception as error:  # noqa: BLE001
            return {"success": False, "message": str(error)}

    def get_config(self) -> Dict[str, Any]:
        """Return non-sensitive config for debugging (password excluded)."""
        return {
            "base_url": self.config.base_url,
            "username": self.config.username,
            "default_model": self.config.default_model,
            "timeout": self.config.timeout,
            "max_retries": self.config.max_retries,
        }

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _make_request(
        self, endpoint: str, method: str, body: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        url = f"{self.config.base_url.rstrip('/')}{endpoint}"
        headers = {
            "Authorization": self.auth_header,
            "Content-Type": "application/json",
        }

        last_error: Optional[Exception] = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                response = requests.request(
                    method,
                    url,
                    headers=headers,
                    json=body if method == "POST" else None,
                    timeout=self.config.timeout,
                )

                if not response.ok:
                    self._handle_error_response(response, attempt)

                try:
                    return response.json()
                except ValueError as parse_error:
                    raise LLMParsingError(
                        "Failed to parse JSON response", cause=parse_error
                    )

            except requests.exceptions.Timeout as error:
                last_error = LLMTimeoutError(
                    f"Request timeout after {self.config.timeout}s", cause=error
                )
            except requests.exceptions.ConnectionError as error:
                last_error = LLMConnectionError(
                    "Failed to connect to LLM service", cause=error
                )
            except LLMAuthenticationError:
                # Auth failures are not going to succeed on retry.
                raise
            except LLMServiceError as error:
                last_error = error
            except Exception as error:  # noqa: BLE001
                last_error = LLMServiceError(
                    f"Unexpected error: {error}", cause=error
                )

            if attempt < self.config.max_retries:
                logger.warning(
                    "LLM request failed (attempt %d/%d): %s",
                    attempt,
                    self.config.max_retries,
                    last_error,
                )
                self._delay(2**attempt)
            else:
                if last_error is not None:
                    raise last_error

        raise LLMServiceError("Max retries exceeded")

    def _handle_error_response(self, response: requests.Response, attempt: int) -> None:
        try:
            error_text = response.text
        except Exception:  # noqa: BLE001
            error_text = "No error details"

        if response.status_code == 401:
            raise LLMAuthenticationError("Authentication failed. Check credentials.")

        raise LLMServiceError(
            f"HTTP {response.status_code}: {error_text}",
            status_code=response.status_code,
        )

    @staticmethod
    def _delay(seconds: float) -> None:
        time.sleep(seconds)
