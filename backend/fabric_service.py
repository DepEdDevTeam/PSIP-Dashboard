"""Fabric GraphQL client and PSIP dashboard data normalization."""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable, Literal, Protocol

import requests
from azure.core.credentials import AccessToken
from azure.identity import DefaultAzureCredential, InteractiveBrowserCredential
from pydantic import BaseModel, Field

LOGGER = logging.getLogger(__name__)
FABRIC_SCOPE = "https://analysis.windows.net/powerbi/api/.default"


class FabricServiceError(RuntimeError):
    """Base error for a controlled Fabric integration failure."""


class FabricConfigurationError(FabricServiceError):
    """Raised when required environment configuration is missing."""


class FabricAuthenticationError(FabricServiceError):
    """Raised when a Fabric token cannot be acquired."""


class FabricGraphQLError(FabricServiceError):
    """Raised when Fabric rejects or cannot complete a GraphQL query."""


class TokenCredential(Protocol):
    def get_token(self, *scopes: str, **kwargs: Any) -> AccessToken: ...


class CachedTokenProvider:
    """Keep one Azure credential and reuse its token until near expiry."""

    def __init__(self, credential: TokenCredential, scope: str = FABRIC_SCOPE) -> None:
        self._credential = credential
        self._scope = scope
        self._token: AccessToken | None = None
        self._lock = threading.Lock()

    def get_token(self) -> str:
        with self._lock:
            if self._token and self._token.expires_on > time.time() + 120:
                return self._token.token
            try:
                self._token = self._credential.get_token(self._scope)
            except Exception as exc:
                raise FabricAuthenticationError(
                    "Unable to authenticate with Microsoft Fabric. Complete the Microsoft "
                    "sign-in flow and verify GraphQL API permissions."
                ) from exc
            return self._token.token


class Facilities(BaseModel):
    academic: int = 0
    workshop: int = 0
    ict_lab: int = Field(default=0, alias="ictLab")
    science_lab: int = Field(default=0, alias="scienceLab")
    audio_visual: int = Field(default=0, alias="audioVisual")
    home_economics: int = Field(default=0, alias="homeEconomics")

    model_config = {"populate_by_name": True}


Readiness = Literal["Ready", "Pending", "At risk", "Unknown"]


class PsipRecord(BaseModel):
    record_id: str = Field(alias="recordId")
    school_id: str = Field(alias="schoolId")
    school_name: str = Field(alias="schoolName")
    project_id: str | None = Field(default=None, alias="projectId")
    region: str = "Unknown region"
    division: str = "Unknown division"
    municipality: str = "Unknown municipality"
    latitude: float | None = None
    longitude: float | None = None
    building_type: str | None = Field(default=None, alias="buildingType")
    classrooms: int = 0
    facilities: Facilities = Field(default_factory=Facilities)
    readiness: Readiness = "Unknown"
    demolition: bool = False
    site_improvement: bool = Field(default=False, alias="siteImprovement")
    slope_protection: bool = Field(default=False, alias="slopeProtection")
    effective_start_date: str | None = Field(default=None, alias="effectiveStartDate")
    effective_end_date: str | None = Field(default=None, alias="effectiveEndDate")
    is_current: bool | None = Field(default=None, alias="isCurrent")

    model_config = {"populate_by_name": True}


class SummaryMetrics(BaseModel):
    record_versions: int = Field(alias="recordVersions")
    unique_schools: int = Field(alias="uniqueSchools")
    unique_projects: int = Field(alias="uniqueProjects")
    classrooms: int
    current_records: int = Field(alias="currentRecords")

    model_config = {"populate_by_name": True}


class NamedCount(BaseModel):
    name: str
    value: int


class RegionMetric(BaseModel):
    region: str
    classrooms: int
    records: int
    unique_schools: int = Field(alias="uniqueSchools")

    model_config = {"populate_by_name": True}


class FilterOptions(BaseModel):
    regions: list[str]
    divisions: list[str]
    building_types: list[str] = Field(alias="buildingTypes")
    readiness: list[Readiness]
    scopes: list[str]

    model_config = {"populate_by_name": True}


class DashboardResponse(BaseModel):
    generated_at: str = Field(alias="generatedAt")
    snapshot_date: str | None = Field(alias="snapshotDate")
    summary: SummaryMetrics
    classroom_classifications: list[NamedCount] = Field(alias="classroomClassifications")
    readiness_counts: list[NamedCount] = Field(alias="readinessCounts")
    regions: list[RegionMetric]
    options: FilterOptions
    records: list[PsipRecord]

    model_config = {"populate_by_name": True}


class SchoolResponse(BaseModel):
    school_id: str = Field(alias="schoolId")
    school_name: str = Field(alias="schoolName")
    records: list[PsipRecord]

    model_config = {"populate_by_name": True}


ENTITY_FIELDS: dict[str, tuple[str, ...]] = {
    "pSIP_Curateds": (
        "PSIPRefNo", "NoOfSites", "NoAcademicClassrooms", "NoWorkshopEq2CL",
        "NoICTLabEq2CL", "NoScienceLabEq2CL", "NoAVREq2CL",
        "NoHomeEconomicsEq2CL", "RegionName", "TotalClassrooms",
        "WithDemolitionFlag", "WithSiteImprovementFlag", "WithSlopeProtectionFlag",
        "BuildingLevel", "SchoolID", "BuildingDesign", "BuildingStory",
        "SpecialBuilding", "TypesOfBuilding", "ClassroomEquivalent",
        "EffectiveStartDate", "EffectiveEndDate", "IsCurrent", "PSIPBatch",
        "SchoolSK", "RegionSK", "DivisionSK", "ProjectSK", "Latitude", "Longitude",
    ),
    "dimProjects": (
        "ProjectSK", "PSIPRefNo", "PSIPBatch", "TotalClassrooms",
        "WithDemolitionFlag", "WithSiteImprovementFlag", "WithSlopeProtectionFlag",
        "OperationalReadinessFlag", "OperationalReadinessRemarks",
        "ScopeImplementableFlag", "BuildingLevel", "BuildingStory", "SpecialBuilding",
        "TypesOfBuilding", "EffectiveStartDate", "EffectiveEndDate", "IsCurrent",
    ),
    "dimSchoolPSIPs": (
        "SchoolSK", "SchoolID", "SchoolName", "RegionName", "DivisionName",
        "Latitude", "Longitude", "RegionSK", "DivisionSK", "EffectiveStartDate",
        "EffectiveEndDate", "IsCurrent",
    ),
    "dimSchools": (
        "SchoolSK", "SchoolID", "SchoolName", "division", "province", "municipality",
        "legislative_district", "school_subclassification", "modified_coc", "latitude",
        "longitude", "DivisionSK", "EffectiveStartDate", "EffectiveEndDate", "IsCurrent",
    ),
    "dimBuildings": (
        "BuildingSK", "SpecialBuilding", "TypesOfBuilding", "SchoolSK", "PSIPRefNo",
        "PSIPBatch", "ProjectSK", "ScopeOfWorks", "OtherDesignConfiguration",
        "BuildingDesign", "BuildingLevel", "BuildingStory", "EffectiveStartDate",
        "EffectiveEndDate", "IsCurrent",
    ),
    "dimClassrooms": (
        "ProjectSK", "ClassroomType", "Quantity", "ClassroomTypeSK", "IconClassroom",
    ),
    "dimRegions": (
        "RegionSK", "RegionName", "RegionCode", "EffectiveStartDate", "EffectiveEndDate",
        "IsCurrent", "old_region",
    ),
    "dimDivisions": (
        "DivisionSK", "DivisionName", "RegionSK", "EffectiveStartDate", "EffectiveEndDate",
        "IsCurrent",
    ),
}


class FabricGraphQLClient:
    def __init__(
        self,
        endpoint: str,
        token_provider: CachedTokenProvider,
        timeout_seconds: float = 30,
        page_size: int = 500,
        max_records: int = 100_000,
        session: requests.Session | None = None,
    ) -> None:
        self.endpoint = endpoint
        self.token_provider = token_provider
        self.timeout_seconds = timeout_seconds
        self.page_size = page_size
        self.max_records = max_records
        self.session = session or requests.Session()

    def fetch_entity(self, entity: str, fields: Iterable[str]) -> list[dict[str, Any]]:
        field_selection = "\n          ".join(fields)
        query = f"""
query Fetch{entity}($first: Int!, $after: String) {{
  {entity}(first: $first, after: $after) {{
    items {{
      {field_selection}
    }}
    hasNextPage
    endCursor
  }}
}}
""".strip()
        rows: list[dict[str, Any]] = []
        after: str | None = None

        while True:
            payload = self._execute(query, {"first": self.page_size, "after": after})
            connection = payload.get(entity)
            if not isinstance(connection, dict):
                raise FabricGraphQLError(f"Fabric response did not contain '{entity}'.")
            items = connection.get("items") or []
            if not isinstance(items, list):
                raise FabricGraphQLError(f"Fabric returned invalid items for '{entity}'.")
            rows.extend(item for item in items if isinstance(item, dict))
            if len(rows) > self.max_records:
                raise FabricGraphQLError(
                    f"'{entity}' exceeded the configured {self.max_records:,}-record limit."
                )
            if not connection.get("hasNextPage"):
                return rows
            next_cursor = connection.get("endCursor")
            if not next_cursor or next_cursor == after:
                raise FabricGraphQLError(f"Fabric returned an invalid cursor for '{entity}'.")
            after = str(next_cursor)

    def _execute(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        try:
            response = self.session.post(
                self.endpoint,
                headers={
                    "Authorization": f"Bearer {self.token_provider.get_token()}",
                    "Content-Type": "application/json",
                },
                json={"query": query, "variables": variables},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            status = getattr(exc.response, "status_code", None)
            suffix = f" with HTTP {status}" if status else ""
            raise FabricGraphQLError(f"Fabric GraphQL request failed{suffix}.") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise FabricGraphQLError("Fabric returned a non-JSON response.") from exc
        if payload.get("errors"):
            messages = "; ".join(
                str(error.get("message", "Unknown GraphQL error"))
                for error in payload["errors"]
                if isinstance(error, dict)
            )
            raise FabricGraphQLError(f"Fabric GraphQL error: {messages or 'Unknown error'}")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise FabricGraphQLError("Fabric response did not contain a data object.")
        return data


class FabricPsipService:
    def __init__(self, client: FabricGraphQLClient, cache_seconds: int = 300) -> None:
        self.client = client
        self.cache_seconds = cache_seconds
        self._dataset_cache: tuple[float, dict[str, list[dict[str, Any]]]] | None = None
        self._cache_lock = threading.Lock()

    @classmethod
    def from_environment(cls) -> "FabricPsipService":
        endpoint = os.getenv("GRAPH_QL_ENDPOINT") or os.getenv("FABRIC_GRAPHQL_ENDPOINT")
        if not endpoint:
            raise FabricConfigurationError(
                "GRAPH_QL_ENDPOINT (or FABRIC_GRAPHQL_ENDPOINT) is required."
            )
        auth_mode = os.getenv("FABRIC_AUTH_MODE", "interactive").strip().lower()
        credential: TokenCredential
        if auth_mode == "default":
            credential = DefaultAzureCredential()
        elif auth_mode == "interactive":
            credential = InteractiveBrowserCredential()
        else:
            raise FabricConfigurationError(
                "FABRIC_AUTH_MODE must be either 'interactive' or 'default'."
            )
        client = FabricGraphQLClient(
            endpoint=endpoint,
            token_provider=CachedTokenProvider(credential),
            timeout_seconds=float(os.getenv("FABRIC_REQUEST_TIMEOUT", "30")),
            page_size=int(os.getenv("FABRIC_PAGE_SIZE", "500")),
            max_records=int(os.getenv("FABRIC_MAX_RECORDS", "100000")),
        )
        return cls(client, cache_seconds=int(os.getenv("FABRIC_CACHE_SECONDS", "300")))

    def get_dashboard(
        self,
        region: str | None = None,
        division: str | None = None,
        building: str | None = None,
        readiness: str | None = None,
        scope: str | None = None,
        search: str | None = None,
    ) -> DashboardResponse:
        all_records = self._normalize(self._load_dataset())
        options = self._build_options(all_records)
        records = [
            record
            for record in all_records
            if self._matches(record, region, division, building, readiness, scope, search)
        ]
        return self._build_dashboard(records, options)

    def get_options(self) -> FilterOptions:
        return self._build_options(self._normalize(self._load_dataset()))

    def get_school(self, school_id: str) -> SchoolResponse | None:
        matches = [
            record
            for record in self._normalize(self._load_dataset())
            if record.school_id.casefold() == school_id.casefold()
        ]
        if not matches:
            return None
        matches.sort(key=lambda row: row.effective_start_date or "", reverse=True)
        return SchoolResponse(
            schoolId=matches[0].school_id,
            schoolName=matches[0].school_name,
            records=matches,
        )

    def get_buildings(self) -> list[dict[str, Any]]:
        return self._load_dataset().get("dimBuildings", [])

    def _load_dataset(self) -> dict[str, list[dict[str, Any]]]:
        now = time.monotonic()
        with self._cache_lock:
            if self._dataset_cache and self._dataset_cache[0] > now:
                return self._dataset_cache[1]
            dataset: dict[str, list[dict[str, Any]]] = {}
            for entity, fields in ENTITY_FIELDS.items():
                LOGGER.info("Fetching Fabric entity %s", entity)
                dataset[entity] = self.client.fetch_entity(entity, fields)
            self._dataset_cache = (now + self.cache_seconds, dataset)
            return dataset

    def _normalize(self, dataset: dict[str, list[dict[str, Any]]]) -> list[PsipRecord]:
        school_rows = dataset.get("dimSchoolPSIPs", [])
        school_detail_rows = dataset.get("dimSchools", [])
        project_rows = dataset.get("dimProjects", [])
        building_rows = dataset.get("dimBuildings", [])
        classroom_rows = dataset.get("dimClassrooms", [])

        schools_by_sk = _group_by(school_rows, "SchoolSK")
        schools_by_id = _group_by(school_rows, "SchoolID")
        school_details_by_sk = _group_by(school_detail_rows, "SchoolSK")
        school_details_by_id = _group_by(school_detail_rows, "SchoolID")
        projects_by_sk = _group_by(project_rows, "ProjectSK")
        projects_by_ref = _group_by(project_rows, "PSIPRefNo")
        buildings_by_project = _group_by(building_rows, "ProjectSK")
        classrooms_by_project = _group_by(classroom_rows, "ProjectSK")

        records: list[PsipRecord] = []
        for curated in dataset.get("pSIP_Curateds", []):
            start = _text(curated, "EffectiveStartDate")
            school_sk = _text(curated, "SchoolSK")
            school_id = _text(curated, "SchoolID")
            project_sk = _text(curated, "ProjectSK")
            project_ref = _text(curated, "PSIPRefNo")
            school = _select_version(
                schools_by_sk.get(school_sk, []) or schools_by_id.get(school_id, []), start
            )
            school_detail = _select_version(
                school_details_by_sk.get(school_sk, [])
                or school_details_by_id.get(school_id, []),
                start,
            )
            project = _select_version(
                projects_by_sk.get(project_sk, []) or projects_by_ref.get(project_ref, []), start
            )
            building = _select_version(buildings_by_project.get(project_sk, []), start)
            classroom_facts = classrooms_by_project.get(project_sk, [])

            canonical_school_id = (
                school_id
                or _text(school, "SchoolID")
                or _text(school_detail, "SchoolID")
                or school_sk
                or "Unknown"
            )
            canonical_project_id = project_ref or _text(project, "PSIPRefNo") or project_sk or None
            record_seed = "|".join(
                [
                    project_sk or canonical_project_id or "project",
                    start or "undated",
                    school_sk or canonical_school_id,
                ]
            )
            record_id = hashlib.sha1(record_seed.encode("utf-8")).hexdigest()[:20]
            classrooms = _integer(curated, "TotalClassrooms", "ClassroomEquivalent")
            if not classrooms:
                classrooms = sum(_integer(row, "Quantity") for row in classroom_facts)

            records.append(
                PsipRecord(
                    recordId=record_id,
                    schoolId=canonical_school_id,
                    schoolName=(
                        _text(school, "SchoolName")
                        or _text(school_detail, "SchoolName")
                        or canonical_school_id
                    ),
                    projectId=canonical_project_id,
                    region=_text(curated, "RegionName") or _text(school, "RegionName") or "Unknown region",
                    division=(
                        _text(school, "DivisionName", "division")
                        or _text(school_detail, "DivisionName", "division")
                        or "Unknown division"
                    ),
                    municipality=_text(school_detail, "municipality") or "Unknown municipality",
                    latitude=(
                        _number(curated, "Latitude")
                        or _number(school, "Latitude", "latitude")
                        or _number(school_detail, "Latitude", "latitude")
                    ),
                    longitude=(
                        _number(curated, "Longitude")
                        or _number(school, "Longitude", "longitude")
                        or _number(school_detail, "Longitude", "longitude")
                    ),
                    buildingType=(
                        _text(curated, "BuildingDesign", "TypesOfBuilding", "SpecialBuilding")
                        or _text(building, "BuildingDesign", "TypesOfBuilding", "SpecialBuilding")
                        or _text(project, "TypesOfBuilding", "SpecialBuilding")
                        or None
                    ),
                    classrooms=classrooms,
                    facilities=Facilities(
                        academic=_integer(curated, "NoAcademicClassrooms"),
                        workshop=_integer(curated, "NoWorkshopEq2CL"),
                        ictLab=_integer(curated, "NoICTLabEq2CL"),
                        scienceLab=_integer(curated, "NoScienceLabEq2CL"),
                        audioVisual=_integer(curated, "NoAVREq2CL"),
                        homeEconomics=_integer(curated, "NoHomeEconomicsEq2CL"),
                    ),
                    readiness=_readiness(_value(project, "OperationalReadinessFlag")),
                    demolition=_boolean(_value(curated, "WithDemolitionFlag", fallback=project)),
                    siteImprovement=_boolean(_value(curated, "WithSiteImprovementFlag", fallback=project)),
                    slopeProtection=_boolean(_value(curated, "WithSlopeProtectionFlag", fallback=project)),
                    effectiveStartDate=start,
                    effectiveEndDate=_text(curated, "EffectiveEndDate") or None,
                    isCurrent=_nullable_boolean(_value(curated, "IsCurrent")),
                )
            )
        records.sort(key=lambda row: (row.school_name.casefold(), row.effective_start_date or ""))
        return records

    @staticmethod
    def _matches(
        record: PsipRecord,
        region: str | None,
        division: str | None,
        building: str | None,
        readiness: str | None,
        scope: str | None,
        search: str | None,
    ) -> bool:
        if region and record.region != region:
            return False
        if division and record.division != division:
            return False
        if building and (record.building_type or "Unknown") != building:
            return False
        if readiness and record.readiness != readiness:
            return False
        if scope == "Demolition" and not record.demolition:
            return False
        if scope == "Site improvement" and not record.site_improvement:
            return False
        if scope == "Slope protection" and not record.slope_protection:
            return False
        if search:
            haystack = " ".join(
                value
                for value in [record.school_id, record.school_name, record.project_id, record.division]
                if value
            ).casefold()
            if search.casefold() not in haystack:
                return False
        return True

    @staticmethod
    def _build_options(records: list[PsipRecord]) -> FilterOptions:
        return FilterOptions(
            regions=sorted({row.region for row in records if row.region}),
            divisions=sorted({row.division for row in records if row.division}),
            buildingTypes=sorted({row.building_type or "Unknown" for row in records}),
            readiness=["Ready", "Pending", "At risk", "Unknown"],
            scopes=["Demolition", "Site improvement", "Slope protection"],
        )

    @staticmethod
    def _build_dashboard(records: list[PsipRecord], options: FilterOptions) -> DashboardResponse:
        classification: Counter[str] = Counter()
        readiness: Counter[str] = Counter()
        region_records: dict[str, list[PsipRecord]] = defaultdict(list)
        dates: list[str] = []
        for record in records:
            classification.update(
                {
                    "Academic Classroom": record.facilities.academic,
                    "Workshop": record.facilities.workshop,
                    "Computer Laboratory": record.facilities.ict_lab,
                    "Science Laboratory": record.facilities.science_lab,
                    "Audio Visual Room": record.facilities.audio_visual,
                    "Home Economics": record.facilities.home_economics,
                }
            )
            readiness[record.readiness] += 1
            region_records[record.region].append(record)
            if record.effective_start_date:
                dates.append(record.effective_start_date)

        return DashboardResponse(
            generatedAt=datetime.now(timezone.utc).isoformat(),
            snapshotDate=max(dates) if dates else None,
            summary=SummaryMetrics(
                recordVersions=len(records),
                uniqueSchools=len({row.school_id for row in records}),
                uniqueProjects=len({row.project_id for row in records if row.project_id}),
                classrooms=sum(row.classrooms for row in records),
                currentRecords=sum(row.is_current is True for row in records),
            ),
            classroomClassifications=[
                NamedCount(name=name, value=value) for name, value in classification.items()
            ],
            readinessCounts=[
                NamedCount(name=name, value=readiness[name])
                for name in ("Ready", "Pending", "At risk", "Unknown")
            ],
            regions=sorted(
                [
                    RegionMetric(
                        region=name,
                        classrooms=sum(row.classrooms for row in rows),
                        records=len(rows),
                        uniqueSchools=len({row.school_id for row in rows}),
                    )
                    for name, rows in region_records.items()
                ],
                key=lambda row: row.classrooms,
                reverse=True,
            ),
            options=options,
            records=records,
        )


def _casefold_map(row: dict[str, Any] | None) -> dict[str, Any]:
    return {str(key).casefold(): value for key, value in (row or {}).items()}


def _value(
    row: dict[str, Any] | None,
    *keys: str,
    fallback: dict[str, Any] | None = None,
) -> Any:
    values = _casefold_map(row)
    fallback_values = _casefold_map(fallback)
    for key in keys:
        candidate = values.get(key.casefold())
        if candidate is not None:
            return candidate
        candidate = fallback_values.get(key.casefold())
        if candidate is not None:
            return candidate
    return None


def _text(row: dict[str, Any] | None, *keys: str) -> str:
    value = _value(row, *keys)
    return "" if value is None else str(value).strip()


def _integer(row: dict[str, Any] | None, *keys: str) -> int:
    value = _value(row, *keys)
    if value in (None, ""):
        return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def _number(row: dict[str, Any] | None, *keys: str) -> float | None:
    value = _value(row, *keys)
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _nullable_boolean(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    return _boolean(value)


def _boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().casefold() in {"true", "yes", "y", "1", "ready"}


def _readiness(value: Any) -> Readiness:
    if value is None or value == "":
        return "Unknown"
    if isinstance(value, str):
        normalized = value.strip().casefold()
        if normalized in {"pending", "for validation", "in progress"}:
            return "Pending"
        if normalized in {"at risk", "not ready", "failed"}:
            return "At risk"
    return "Ready" if _boolean(value) else "At risk"


def _group_by(rows: Iterable[dict[str, Any]], key: str) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        value = _text(row, key)
        if value:
            grouped[value].append(row)
    return grouped


def _select_version(rows: list[dict[str, Any]], effective_date: str | None) -> dict[str, Any]:
    if not rows:
        return {}
    if effective_date:
        matching = [
            row
            for row in rows
            if (not _text(row, "EffectiveStartDate") or _text(row, "EffectiveStartDate") <= effective_date)
            and (not _text(row, "EffectiveEndDate") or _text(row, "EffectiveEndDate") >= effective_date)
        ]
        if matching:
            rows = matching
    return max(
        rows,
        key=lambda row: (
            _boolean(_value(row, "IsCurrent")),
            _text(row, "EffectiveStartDate"),
        ),
    )
