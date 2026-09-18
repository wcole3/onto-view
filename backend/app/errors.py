"""Application error types and FastAPI exception handlers.

Every application error carries a machine-readable code, a human-readable
message, an HTTP status, and optional details. The API returns errors in the
shape ``{"error": {"code", "message", "details"}}``.
"""

from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for all application errors."""

    code: str = "app_error"
    status_code: int = 500

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    """The requested resource does not exist."""

    code = "not_found"
    status_code = 404


class ConflictError(AppError):
    """The request conflicts with the current state of a resource."""

    code = "conflict"
    status_code = 409


class InvalidSourceError(AppError):
    """A source document is invalid for the requested operation."""

    code = "invalid_source"
    status_code = 422


class UnsupportedFormatError(AppError):
    """The document format is not supported by this application."""

    code = "unsupported_format"
    status_code = 415


class ParseSourceError(AppError):
    """A source document could not be parsed."""

    code = "source_parse_failed"
    status_code = 422


class LimitExceededError(AppError):
    """A configured size, count, or depth limit was exceeded."""

    code = "limit_exceeded"
    status_code = 413


class ImportResolutionError(AppError):
    """Import resolution failed for one or more imports."""

    code = "import_resolution_failed"
    status_code = 422


class UnsafeRemoteResourceError(AppError):
    """A remote resource was rejected by the safety policy."""

    code = "unsafe_remote_resource"
    status_code = 403


def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Render application errors in the standard error shape."""
    if not isinstance(exc, AppError):
        raise exc
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Render request validation errors in the standard error shape."""
    if not isinstance(exc, RequestValidationError):
        raise exc
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "The request failed validation.",
                "details": {"errors": exc.errors()},
            }
        },
    )
