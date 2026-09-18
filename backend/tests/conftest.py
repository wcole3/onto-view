"""Shared test fixtures."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    """Test settings with an isolated data directory and network disabled."""
    return Settings(
        environment="test",
        log_level="WARNING",
        data_dir=tmp_path / "data",
        network_imports_enabled=False,
        _env_file=None,
    )


@pytest.fixture()
def client(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """FastAPI test client wired to the isolated settings."""
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    with TestClient(app) as test_client:
        yield test_client
