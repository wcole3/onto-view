"""FastAPI dependency providers.

The ``AppContainer`` holds all shared application objects (settings, storage,
services). It is built once during startup and attached to ``app.state``;
dependencies below hand pieces of it to route handlers.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from .config import Settings
from .services.workspace_service import WorkspaceService
from .storage.runtime import RuntimeRegistry
from .storage.workspace_repo import WorkspaceRepository


@dataclass
class AppContainer:
    """Shared application objects for the running process."""

    settings: Settings
    workspace_repo: WorkspaceRepository
    runtime_registry: RuntimeRegistry


def build_container(settings: Settings) -> AppContainer:
    """Construct the container and all shared objects in dependency order."""
    (settings.data_dir / "workspaces").mkdir(parents=True, exist_ok=True)
    return AppContainer(
        settings=settings,
        workspace_repo=WorkspaceRepository(settings.data_dir),
        runtime_registry=RuntimeRegistry(),
    )


def get_container(request: Request) -> AppContainer:
    """Return the application container stored on ``app.state``."""
    container = getattr(request.app.state, "container", None)
    if not isinstance(container, AppContainer):
        raise RuntimeError("Application container was not initialized during startup.")
    return container


ContainerDep = Annotated[AppContainer, Depends(get_container)]


def get_workspace_service(container: ContainerDep) -> WorkspaceService:
    """Build the workspace service on top of the shared container."""
    return WorkspaceService(
        repository=container.workspace_repo, runtimes=container.runtime_registry
    )


WorkspaceServiceDep = Annotated[WorkspaceService, Depends(get_workspace_service)]
