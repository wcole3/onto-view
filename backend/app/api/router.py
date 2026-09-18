"""Versioned API router."""

from fastapi import APIRouter

from .health import router as health_router
from .workspaces import router as workspaces_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(workspaces_router)
