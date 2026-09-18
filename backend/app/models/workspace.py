"""Workspace models."""

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(UTC)


class Workspace(BaseModel):
    """A named collection of ontology sources and view state."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    schema_version: int = 1


class WorkspaceCreate(BaseModel):
    """Payload for creating a workspace."""

    name: str = Field(default="", max_length=200)


class WorkspaceUpdate(BaseModel):
    """Payload for updating a workspace."""

    name: str | None = Field(default=None, max_length=200)
