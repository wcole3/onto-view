"""In-memory per-workspace runtime state."""

import asyncio
from dataclasses import dataclass, field


@dataclass
class WorkspaceRuntime:
    """Ephemeral state for one workspace. Never persisted to disk."""

    workspace_id: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class RuntimeRegistry:
    """Hold a runtime entry per active workspace."""

    def __init__(self) -> None:
        self._runtimes: dict[str, WorkspaceRuntime] = {}

    def get_or_create(self, workspace_id: str) -> WorkspaceRuntime:
        """Return the runtime for a workspace, creating it if needed."""
        runtime = self._runtimes.get(workspace_id)
        if runtime is None:
            runtime = WorkspaceRuntime(workspace_id=workspace_id)
            self._runtimes[workspace_id] = runtime
        return runtime

    def get(self, workspace_id: str) -> WorkspaceRuntime | None:
        """Return the runtime for a workspace, or ``None``."""
        return self._runtimes.get(workspace_id)

    def remove(self, workspace_id: str) -> None:
        """Drop a workspace's runtime entry."""
        self._runtimes.pop(workspace_id, None)

    def clear(self) -> None:
        """Drop all runtime entries."""
        self._runtimes.clear()
