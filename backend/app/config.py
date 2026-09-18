"""Application settings loaded from environment variables.

All settings use the ``ONTOVIEW_`` environment variable prefix. Never read
environment variables directly elsewhere in the application; go through
``get_settings()``.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the ontology viewer backend."""

    model_config = SettingsConfigDict(env_prefix="ONTOVIEW_", env_file=".env", extra="ignore")

    # Application identity
    app_name: str = "Ontology Viewer"
    environment: str = "development"
    log_level: str = "INFO"

    # Storage
    data_dir: Path = Field(default=Path("data"))

    # CORS
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Upload limits
    max_upload_bytes: int = 50 * 1024 * 1024
    max_workspace_bytes: int = 500 * 1024 * 1024
    max_source_count: int = 100

    # Import limits
    max_import_depth: int = 5
    max_imported_sources: int = 50

    # Graph limits
    max_graph_nodes: int = 20_000
    max_graph_edges: int = 100_000
    max_evidence_per_element: int = 20

    # Projection cache
    projection_cache_size: int = 32

    # Network imports (disabled by default)
    network_imports_enabled: bool = False
    network_host_allowlist: list[str] = []
    network_timeout_seconds: float = 15.0
    network_max_bytes: int = 50 * 1024 * 1024

    # Import resolution paths
    xml_catalog_paths: list[Path] = []
    local_import_roots: list[Path] = []

    # Labels
    preferred_label_languages: list[str] = ["en"]

    @model_validator(mode="after")
    def _validate(self) -> "Settings":
        positive_ints = {
            "max_upload_bytes": self.max_upload_bytes,
            "max_workspace_bytes": self.max_workspace_bytes,
            "max_source_count": self.max_source_count,
            "max_import_depth": self.max_import_depth,
            "max_imported_sources": self.max_imported_sources,
            "max_graph_nodes": self.max_graph_nodes,
            "max_graph_edges": self.max_graph_edges,
            "max_evidence_per_element": self.max_evidence_per_element,
            "projection_cache_size": self.projection_cache_size,
        }
        for name, value in positive_ints.items():
            if value <= 0:
                raise ValueError(f"{name} must be a positive integer")
        if self.network_timeout_seconds <= 0:
            raise ValueError("network_timeout_seconds must be positive")
        if self.network_max_bytes <= 0:
            raise ValueError("network_max_bytes must be a positive integer")
        return self

    @model_validator(mode="after")
    def _normalize_paths(self) -> "Settings":
        self.data_dir = Path(self.data_dir).expanduser().resolve()
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings."""
    return Settings()
