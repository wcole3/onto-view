"""API smoke tests for health and capability endpoints."""

from fastapi.testclient import TestClient


def test_healthz(client: TestClient) -> None:
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz(client: TestClient) -> None:
    response = client.get("/api/v1/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_capabilities(client: TestClient) -> None:
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    body = response.json()
    assert "turtle" in body["rdf_formats"]
    assert "trig" in body["rdf_formats"]
    assert body["linkml_formats"] == ["yaml", "json"]
    assert body["max_upload_bytes"] > 0
    assert body["network_imports_enabled"] is False
    assert body["profiles"] == ["generic"]
