"""API tests for workspace endpoints."""

from fastapi.testclient import TestClient

from app.main import app

PREFIX = "/api/v1/workspaces"


def test_create_returns_201_with_identity(client: TestClient) -> None:
    response = client.post(PREFIX, json={"name": "My ontology"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "My ontology"
    assert len(body["id"]) == 36
    assert body["schema_version"] == 1
    assert body["created_at"] and body["updated_at"]


def test_create_with_empty_name_uses_default(client: TestClient) -> None:
    response = client.post(PREFIX, json={"name": "   "})

    assert response.status_code == 201
    assert response.json()["name"] == "Untitled workspace"


def test_list_contains_created_workspace(client: TestClient) -> None:
    created = client.post(PREFIX, json={"name": "First"}).json()
    client.post(PREFIX, json={"name": "Second"})

    response = client.get(PREFIX)
    assert response.status_code == 200
    names = [w["name"] for w in response.json()]
    assert created["id"] in [w["id"] for w in response.json()]
    assert set(names) == {"First", "Second"}


def test_get_unknown_workspace_returns_404_error_shape(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/123e4567-e89b-42d3-a456-426614174000")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"


def test_get_rejects_path_traversal_id(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/..%2Fetc")

    assert response.status_code == 404


def test_patch_renames_and_bumps_updated_at(client: TestClient) -> None:
    created = client.post(PREFIX, json={"name": "Before"}).json()

    response = client.patch(f"{PREFIX}/{created['id']}", json={"name": "After"})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "After"
    assert body["updated_at"] >= created["updated_at"]


def test_patch_with_empty_name_keeps_current_name(client: TestClient) -> None:
    created = client.post(PREFIX, json={"name": "Keep me"}).json()

    response = client.patch(f"{PREFIX}/{created['id']}", json={"name": ""})

    assert response.status_code == 200
    assert response.json()["name"] == "Keep me"


def test_delete_returns_204_then_404(client: TestClient) -> None:
    created = client.post(PREFIX, json={"name": "Doomed"}).json()

    delete_response = client.delete(f"{PREFIX}/{created['id']}")
    assert delete_response.status_code == 204

    get_response = client.get(f"{PREFIX}/{created['id']}")
    assert get_response.status_code == 404


def test_delete_unknown_workspace_returns_404(client: TestClient) -> None:
    response = client.delete(f"{PREFIX}/123e4567-e89b-42d3-a456-426614174000")

    assert response.status_code == 404


def test_workspace_persists_across_restart(client: TestClient) -> None:
    created = client.post(PREFIX, json={"name": "Durable"}).json()

    with TestClient(app) as restarted:
        response = restarted.get(f"{PREFIX}/{created['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == "Durable"
