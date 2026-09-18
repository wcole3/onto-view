"""FastAPI application entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import __version__
from .api.router import api_router
from .config import Settings, get_settings
from .dependencies import build_container
from .errors import AppError, app_error_handler, validation_error_handler
from .logging_config import configure_logging


def _verify_writable(data_dir: Path) -> None:
    """Fail fast when the data directory cannot be written to."""
    probe = data_dir / ".write-test"
    probe.write_text("ok", encoding="utf-8")
    probe.unlink()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize and tear down application state."""
    settings: Settings = get_settings()
    configure_logging(settings.log_level, settings.environment)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    _verify_writable(settings.data_dir)
    app.state.container = build_container(settings)
    yield
    # Shutdown hook: runtime caches and HTTP clients are cleared here as they
    # are introduced in later stages.


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    settings = get_settings()
    application = FastAPI(
        title="Ontology Viewer API",
        version=__version__,
        lifespan=lifespan,
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_exception_handler(AppError, app_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.include_router(api_router)
    return application


app = create_app()
