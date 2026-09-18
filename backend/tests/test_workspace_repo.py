"""Unit tests for the workspace file repository."""

from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.errors import AppError, NotFoundError
from app.models.workspace import Workspace
from app.storage.workspace_repo import WorkspaceRepository


@pytest.fixture()
def repository(tmp_path: Path) -> WorkspaceRepository:
    return WorkspaceRepository(tmp_path / "data")


def make_workspace(name: str = "Test", updated_at: datetime | None = None) -> Workspace:
    workspace = Workspace(name=name)
    if updated_at is not None:
        workspace.updated_at = updated_at
    return workspace


def test_create_and_get_roundtrip(repository: WorkspaceRepository) -> None:
    workspace = make_workspace("Alpha")
    repository.create_workspace(workspace)

    loaded = repository.get_workspace(workspace.id)
    assert loaded == workspace


def test_create_writes_expected_layout(repository: WorkspaceRepository) -> None:
    workspace = make_workspace()
    repository.create_workspace(workspace)

    workspace_dir = repository.workspaces_dir / workspace.id
    assert (workspace_dir / "workspace.json").is_file()


def test_list_sorted_by_updated_at_desc(repository: WorkspaceRepository) -> None:
    old = make_workspace("Old", updated_at=datetime(2026, 1, 1, tzinfo=UTC))
    new = make_workspace("New", updated_at=datetime(2026, 6, 1, tzinfo=UTC))
    repository.create_workspace(old)
    repository.create_workspace(new)

    listed = repository.list_workspaces()
    assert [w.name for w in listed] == ["New", "Old"]


def test_list_empty_when_no_workspaces(repository: WorkspaceRepository) -> None:
    assert repository.list_workspaces() == []


def test_get_missing_raises_not_found(repository: WorkspaceRepository) -> None:
    with pytest.raises(NotFoundError):
        repository.get_workspace("123e4567-e89b-42d3-a456-426614174000")


def test_invalid_ids_are_rejected(repository: WorkspaceRepository) -> None:
    for bad_id in ("../etc", "a/b", "UPPER", "", "not-a-uuid"):
        with pytest.raises(NotFoundError):
            repository.get_workspace(bad_id)


def test_save_overwrites_record(repository: WorkspaceRepository) -> None:
    workspace = make_workspace("Before")
    repository.create_workspace(workspace)

    workspace.name = "After"
    repository.save_workspace(workspace)

    assert repository.get_workspace(workspace.id).name == "After"


def test_delete_removes_directory(repository: WorkspaceRepository) -> None:
    workspace = make_workspace()
    repository.create_workspace(workspace)
    workspace_dir = repository.workspaces_dir / workspace.id

    repository.delete_workspace(workspace.id)

    assert not workspace_dir.exists()
    with pytest.raises(NotFoundError):
        repository.get_workspace(workspace.id)


def test_delete_missing_raises_not_found(repository: WorkspaceRepository) -> None:
    with pytest.raises(NotFoundError):
        repository.delete_workspace("123e4567-e89b-42d3-a456-426614174000")


def test_no_temp_files_left_after_writes(repository: WorkspaceRepository) -> None:
    workspace = make_workspace()
    repository.create_workspace(workspace)
    workspace.name = "Renamed"
    repository.save_workspace(workspace)

    leftovers = list((repository.workspaces_dir / workspace.id).glob("*.tmp"))
    assert leftovers == []


def test_corrupt_record_raises_app_error(repository: WorkspaceRepository) -> None:
    workspace = make_workspace()
    repository.create_workspace(workspace)
    (repository.workspaces_dir / workspace.id / "workspace.json").write_text(
        "{not json", encoding="utf-8"
    )

    with pytest.raises(AppError):
        repository.get_workspace(workspace.id)
