"""FastAPI boundary for the PSIP Fabric GraphQL integration."""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Callable, TypeVar

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from fabric_service import (
    DashboardResponse,
    FabricAuthenticationError,
    FabricConfigurationError,
    FabricGraphQLError,
    FabricPsipService,
    FilterOptions,
    SchoolResponse,
)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="PSIP Fabric API", version="2.0.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)


@lru_cache(maxsize=1)
def get_service() -> FabricPsipService:
    return FabricPsipService.from_environment()


def service_or_http_error() -> FabricPsipService:
    try:
        return get_service()
    except FabricConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


ResultT = TypeVar("ResultT")


def run_service(call: Callable[[], ResultT]) -> ResultT:
    try:
        return call()
    except FabricAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except FabricGraphQLError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except FabricConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/")
def home() -> dict[str, str]:
    return {"message": "PSIP Fabric API is running", "docs": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard", response_model=DashboardResponse, response_model_by_alias=True)
def dashboard(
    region: Annotated[str | None, Query()] = None,
    division: Annotated[str | None, Query()] = None,
    building: Annotated[str | None, Query()] = None,
    readiness: Annotated[str | None, Query()] = None,
    scope: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
) -> DashboardResponse:
    service = service_or_http_error()
    return run_service(
        lambda: service.get_dashboard(region, division, building, readiness, scope, search)
    )


@app.get("/api/options", response_model=FilterOptions, response_model_by_alias=True)
def options() -> FilterOptions:
    service = service_or_http_error()
    return run_service(service.get_options)


@app.get(
    "/api/schools/{school_id}", response_model=SchoolResponse, response_model_by_alias=True
)
def school(school_id: str) -> SchoolResponse:
    service = service_or_http_error()
    result = run_service(lambda: service.get_school(school_id))
    if result is None:
        raise HTTPException(status_code=404, detail="School was not found.")
    return result


# Backwards-compatible diagnostics, now backed by Fabric instead of ODBC.
@app.get("/building")
def buildings() -> list[dict[str, Any]]:
    service = service_or_http_error()
    return run_service(lambda: service.get_buildings()[:10])


@app.get("/buildings/{building_id}")
def building(building_id: str) -> dict[str, Any]:
    service = service_or_http_error()
    rows = run_service(service.get_buildings)
    match = next(
        (row for row in rows if str(row.get("BuildingSK", "")) == building_id), None
    )
    if match is None:
        raise HTTPException(status_code=404, detail="Building was not found.")
    return match
