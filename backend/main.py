"""FastAPI boundary for the PSIP Fabric GraphQL integration."""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Annotated, Any, Callable, Literal, TypeVar

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from fabric_service import (
    DatabaseTableInfo,
    DatabaseTablePage,
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


_service_instance: FabricPsipService | None = None
_service_lock = threading.Lock()


def get_service() -> FabricPsipService:
    global _service_instance
    if _service_instance is None:
        with _service_lock:
            if _service_instance is None:
                _service_instance = FabricPsipService.from_environment()
    return _service_instance


def service_or_http_error() -> FabricPsipService:
    try:
        return get_service()
    except FabricAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
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


def require_database_browser() -> None:
    enabled = os.getenv("ENABLE_DATABASE_BROWSER", "false").strip().lower()
    if enabled not in {"1", "true", "yes", "on"}:
        raise HTTPException(status_code=404, detail="Not found")


def add_timing_headers(response: Response, cache_status: str, fabric_ms: float, normalization_ms: float) -> None:
    response.headers["X-PSIP-Cache"] = cache_status
    response.headers["Server-Timing"] = (
        f"fabric;dur={fabric_ms:.1f}, normalize;dur={normalization_ms:.1f}"
    )


@app.get("/")
def home() -> dict[str, str]:
    return {"message": "PSIP Fabric API is running", "docs": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard", response_model=DashboardResponse, response_model_by_alias=True)
def dashboard(
    response: Response,
    region: Annotated[str | None, Query()] = None,
    division: Annotated[str | None, Query()] = None,
    building: Annotated[str | None, Query()] = None,
    readiness: Annotated[str | None, Query()] = None,
    scope: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
) -> DashboardResponse:
    service = service_or_http_error()
    result, timing = run_service(
        lambda: service.get_dashboard_with_timing(
            region, division, building, readiness, scope, search
        )
    )
    add_timing_headers(
        response,
        timing.cache_status,
        timing.fabric_ms,
        timing.normalization_ms,
    )
    return result


@app.get("/api/options", response_model=FilterOptions, response_model_by_alias=True)
def options(response: Response) -> FilterOptions:
    service = service_or_http_error()
    result, timing = run_service(service.get_options_with_timing)
    add_timing_headers(
        response,
        timing.cache_status,
        timing.fabric_ms,
        timing.normalization_ms,
    )
    return result


@app.get("/api/database/tables", response_model=list[DatabaseTableInfo])
def database_tables() -> list[DatabaseTableInfo]:
    require_database_browser()
    service = service_or_http_error()
    return run_service(service.get_database_tables)


@app.get(
    "/api/database/{table}",
    response_model=DatabaseTablePage,
    response_model_by_alias=True,
)
def database_table(
    table: str,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=10, le=200)] = 50,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_order: Annotated[Literal["asc", "desc"], Query(alias="sortOrder")] = "asc",
) -> DatabaseTablePage:
    require_database_browser()
    service = service_or_http_error()
    try:
        return run_service(
            lambda: service.get_database_table(
                table, page, page_size, search, sort_by, sort_order
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get(
    "/api/schools/{school_id}", response_model=SchoolResponse, response_model_by_alias=True
)
def school(school_id: str, response: Response) -> SchoolResponse:
    service = service_or_http_error()
    result, timing = run_service(lambda: service.get_school_with_timing(school_id))
    add_timing_headers(
        response,
        timing.cache_status,
        timing.fabric_ms,
        timing.normalization_ms,
    )
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
