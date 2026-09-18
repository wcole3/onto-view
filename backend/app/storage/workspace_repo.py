"""File-based workspace repository."""

import json
import os
import shutil
import tempfile
from contextlib import suppress
from pathlib import Path

from pydantic import ValidationError

from app.errors import AppError, NotFoundError
from app.models.workspace import Workspace
from app.storage.ids import validate_workspace_id


class WorkspaceRepository:
    """Persist workspaces as JSON files under ``data/workspaces``."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._workspaces_dir = data_dir / "workspaces"

    @property
    def workspaces_dir(self) -> Path:
        """Directory containing one subdirectory per workspace."""
        return self._workspaces_dir

    def _workspace_dir(self, workspace_id: str) -> Path:
        return self._workspaces_dir / validate_workspace_id(workspace_id)

    def _workspace_file(self, workspace_id: str) -> Path:
        return self._workspace_dir(workspace_id) / "workspace.json"

    @staticmethod
    def _atomic_write_json(path: Path, payload: str) -> None:
        """Write JSON to a temporary file and rename it into place."""
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
            os.replace(tmp_name, path)
        except BaseException:
            with suppress(OSError):
                os.unlink(tmp_name)
            raise

    @staticmethod
    def _load_workspace(path: Path) -> Workspace:
        try:
            return Workspace.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError, json.JSONDecodeError) as exc:
            raise AppError(f"Stored workspace record is unreadable: {path.name}") from exc

    def create_workspace(self, workspace: Workspace) -> Workspace:
        """Persist a new workspace."""
        self._atomic_write_json(
            self._workspace_file(workspace.id), workspace.model_dump_json(indent=2)
        )
        return workspace

    def list_workspaces(self) -> list[Workspace]:
        """List all workspaces, most recently updated first."""
        if not self._workspaces_dir.is_dir():
            return []
        workspaces: list[Workspace] = []
        for entry in sorted(self._workspaces_dir.iterdir()):
            workspace_file = entry / "workspace.json"
            if entry.is_dir() and workspace_file.is_file():
                workspaces.append(self._load_workspace(workspace_file))
        workspaces.sort(key=lambda workspace: workspace.updated_at, reverse=True)
        return workspaces

    def get_workspace(self, workspace_id: str) -> Workspace:
        """Load a workspace by ID."""
        path = self._workspace_file(workspace_id)
        if not path.is_file():
            raise NotFoundError("Workspace not found.")
        return self._load_workspace(path)

    def save_workspace(self, workspace: Workspace) -> None:
        """Overwrite the stored record for an existing workspace."""
        self._atomic_write_json(
            self._workspace_file(workspace.id), workspace.model_dump_json(indent=2)
        )

    def delete_workspace(self, workspace_id: str) -> None:
        """Delete a workspace directory and everything inside it."""
        workspace_dir = self._workspace_dir(workspace_id)
        if not workspace_dir.is_dir():
            raise NotFoundError("Workspace not found.")
        shutil.rmtree(workspace_dir)
