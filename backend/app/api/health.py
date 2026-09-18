"""Health and capability endpoints."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .. import __version__
from ..dependencies import ContainerDep

router = APIRouter(tags=["health"])

SUPPORTED_RDF_FORMATS = ["xml", "turtle", "nt", "nquads", "trig", "jsonld"]
SUPPORTED_LINKML_FORMATS = ["yaml", "json"]


@router.get("/healthz")
def healthz() -> dict[str, str]:
    """Report process health."""
    return {"status": "ok"}


@router.get("/readyz")
def readyz(container: ContainerDep) -> JSONResponse:
    """Report data-directory and service readiness."""
    data_dir = container.settings.data_dir
    if not data_dir.is_dir():
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "data directory missing"},
        )
    probe = data_dir / ".readyz"
    try:
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
    except OSError as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": f"data directory not writable: {exc}"},
        )
    return JSONResponse(status_code=200, content={"status": "ready"})


@router.get("/capabilities")
def capabilities(container: ContainerDep) -> dict[str, object]:
    """Report supported formats and configured limits."""
    settings = container.settings
    return {
        "version": __version__,
        "rdf_formats": SUPPORTED_RDF_FORMATS,
        "linkml_formats": SUPPORTED_LINKML_FORMATS,
        "max_upload_bytes": settings.max_upload_bytes,
        "max_graph_nodes": settings.max_graph_nodes,
        "max_graph_edges": settings.max_graph_edges,
        "network_imports_enabled": settings.network_imports_enabled,
        "profiles": ["generic"],
    }
