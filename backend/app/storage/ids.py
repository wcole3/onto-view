"""ID generation and validation helpers."""

import re
from uuid import uuid4

from app.errors import NotFoundError

_WORKSPACE_ID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def generate_workspace_id() -> str:
    """Generate a new workspace ID."""
    return str(uuid4())


def validate_workspace_id(workspace_id: str) -> str:
    """Validate a workspace ID before it is used in a filesystem path.

    Invalid IDs are treated as missing so malformed input can never be
    turned into a path traversal.
    """
    if not _WORKSPACE_ID_RE.fullmatch(workspace_id):
        raise NotFoundError("Workspace not found.")
    return workspace_id
