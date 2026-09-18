"""Workspace endpoints."""

from fastapi import APIRouter
from fastapi.responses import Response

from ..dependencies import WorkspaceServiceDep
from ..models.workspace import Workspace, WorkspaceCreate, WorkspaceUpdate

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[Workspace])
async def list_workspaces(service: WorkspaceServiceDep) -> list[Workspace]:
    """List all workspaces, most recently updated first."""
    return await service.list()


@router.post("", response_model=Workspace, status_code=201)
async def create_workspace(
    payload: WorkspaceCreate, service: WorkspaceServiceDep
) -> Workspace:
    """Create a new workspace."""
    return await service.create(payload)


@router.get("/{workspace_id}", response_model=Workspace)
async def get_workspace(workspace_id: str, service: WorkspaceServiceDep) -> Workspace:
    """Load a single workspace."""
    return await service.get(workspace_id)


@router.patch("/{workspace_id}", response_model=Workspace)
async def update_workspace(
    workspace_id: str, payload: WorkspaceUpdate, service: WorkspaceServiceDep
) -> Workspace:
    """Rename a workspace."""
    return await service.update(workspace_id, payload)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: str, service: WorkspaceServiceDep) -> Response:
    """Delete a workspace and all of its data."""
    await service.delete(workspace_id)
    return Response(status_code=204)
