"""Workspace service."""

from app.models.workspace import Workspace, WorkspaceCreate, WorkspaceUpdate, utcnow
from app.storage.runtime import RuntimeRegistry
from app.storage.workspace_repo import WorkspaceRepository

DEFAULT_WORKSPACE_NAME = "Untitled workspace"


class WorkspaceService:
    """Business rules for workspace lifecycle operations."""

    def __init__(self, repository: WorkspaceRepository, runtimes: RuntimeRegistry) -> None:
        self._repository = repository
        self._runtimes = runtimes

    async def create(self, payload: WorkspaceCreate) -> Workspace:
        """Create a workspace and register its runtime entry."""
        name = payload.name.strip() or DEFAULT_WORKSPACE_NAME
        workspace = Workspace(name=name)
        self._repository.create_workspace(workspace)
        self._runtimes.get_or_create(workspace.id)
        return workspace

    async def list(self) -> list[Workspace]:
        """List workspaces, most recently updated first."""
        return self._repository.list_workspaces()

    async def get(self, workspace_id: str) -> Workspace:
        """Load a workspace and ensure its runtime entry exists."""
        workspace = self._repository.get_workspace(workspace_id)
        self._runtimes.get_or_create(workspace.id)
        return workspace

    async def update(self, workspace_id: str, payload: WorkspaceUpdate) -> Workspace:
        """Rename a workspace. An empty name leaves the current name in place."""
        workspace = self._repository.get_workspace(workspace_id)
        if payload.name is not None and payload.name.strip():
            workspace.name = payload.name.strip()
        workspace.updated_at = utcnow()
        self._repository.save_workspace(workspace)
        return workspace

    async def delete(self, workspace_id: str) -> None:
        """Delete a workspace under its runtime lock and clear the runtime."""
        self._repository.get_workspace(workspace_id)
        runtime = self._runtimes.get_or_create(workspace_id)
        async with runtime.lock:
            self._repository.delete_workspace(workspace_id)
        self._runtimes.remove(workspace_id)
