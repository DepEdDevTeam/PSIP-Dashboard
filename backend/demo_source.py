"""Temporary offline data source for the PSIP demo workbook."""

from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable


class WorkbookDatasetClient:
    def __init__(self, path: Path) -> None:
        self.dataset = load_workbook_dataset(path)

    def fetch_entity(self, entity: str, fields: Iterable[str]) -> list[dict[str, Any]]:
        del fields
        return self.dataset.get(entity, [])


def load_workbook_dataset(path: Path) -> dict[str, list[dict[str, Any]]]:
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rel_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in rels}
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            strings = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = ["".join(n.text or "" for n in item.iter(f"{{{ns}}}t")) for item in strings]
        sheet = next(iter(workbook.find(f"{{{ns}}}sheets")))
        target = targets[sheet.attrib[f"{{{rel_ns}}}id"]].lstrip("/")
        worksheet = ET.fromstring(archive.read(target if target.startswith("xl/") else f"xl/{target}"))

    def cell_value(cell: ET.Element) -> str:
        if cell.attrib.get("t") == "inlineStr":
            inline = cell.find(f"{{{ns}}}is")
            return "" if inline is None else "".join(n.text or "" for n in inline.iter(f"{{{ns}}}t"))
        raw = cell.find(f"{{{ns}}}v")
        value = "" if raw is None or raw.text is None else raw.text
        return shared[int(value)] if cell.attrib.get("t") == "s" and value else value

    def column_number(reference: str) -> int:
        letters = "".join(c for c in reference if c.isalpha())
        result = 0
        for c in letters.upper():
            result = result * 26 + ord(c) - 64
        return result - 1

    rows = worksheet.findall(f".//{{{ns}}}sheetData/{{{ns}}}row")
    headers = [cell_value(c).strip() for c in rows[0].findall(f"{{{ns}}}c")]
    records: list[dict[str, Any]] = []
    for row in rows[1:]:
        record = {header: "" for header in headers if header}
        for cell in row.findall(f"{{{ns}}}c"):
            index = column_number(cell.attrib.get("r", "A1"))
            if index < len(headers) and headers[index]:
                record[headers[index]] = cell_value(cell).strip()
        if any(record.values()):
            records.append(record)

    def get(row: dict[str, Any], *keys: str) -> str:
        return next((str(row[k]) for k in keys if row.get(k)), "")

    curated: list[dict[str, Any]] = []
    schools: list[dict[str, Any]] = []
    projects: list[dict[str, Any]] = []
    buildings: list[dict[str, Any]] = []
    classrooms: list[dict[str, Any]] = []
    for row in records:
        ref = get(row, "PSIPRefNo", "ID")
        school_id = get(row, "SchoolID", "SCHOOL ID")
        curated.append({
            "PSIPRefNo": ref, "RegionName": get(row, "RegionName", "REGION"),
            "SchoolID": school_id, "SchoolName": get(row, "SchoolName", "NAME OF SCHOOL"),
            "Municipality": get(row, "Municipality", "MUNICIPALITY/ LOCATION"),
            "Latitude": get(row, "Latitude"), "Longitude": get(row, "Longitude"),
            "NoAcademicClassrooms": get(row, "NoAcademicClassrooms", "NO. OF ACADEMIC CLASSROOMS"),
            "NoWorkshopEq2CL": get(row, "NoWorkshopEq2CL", "NO. OF WORKSHOP (equivalent to 2-CL)"),
            "NoICTLabEq2CL": get(row, "NoICTLabEq2CL", "NO. OF ICT/COMPUTER LABORATORY (equivalent to 2-CL)"),
            "NoScienceLabEq2CL": get(row, "NoScienceLabEq2CL", "NO. OF SCIENCE LABORATORY (equivalent to 2-CL)"),
            "NoAVREq2CL": get(row, "NoAVREq2CL", "NO. OF AVR (equivalent to 2-CL)"),
            "NoHomeEconomicsEq2CL": get(row, "NoHomeEconomicsEq2CL", "NO. OF HOME ECONOMICS (equivalent to 2-CL)"),
            "TotalClassrooms": get(row, "TotalClassrooms", "TOTAL CLASSROOMS"),
            "WithDemolitionFlag": get(row, "WithDemolitionFlag", "WITH DEMOLITION? YES/ NO"),
            "WithSiteImprovementFlag": get(row, "WithSiteImprovementFlag", "WITH SITE IMPROVEMENT? YES/ NO"),
            "WithSlopeProtectionFlag": get(row, "WithSlopeProtectionFlag", "WITH SLOPE PROTECTION? YES/NO"),
            "ProjectSK": ref, "SchoolSK": school_id,
        })
        schools.append({"SchoolSK": school_id, "SchoolID": school_id,
            "SchoolName": get(row, "SchoolName", "NAME OF SCHOOL"),
            "RegionName": get(row, "RegionName", "REGION"),
            "DivisionName": get(row, "DivisionName", "DIVISION"),
            "division": get(row, "DivisionName", "DIVISION"),
            "municipality": get(row, "Municipality", "MUNICIPALITY/ LOCATION"),
            "Latitude": get(row, "Latitude"), "Longitude": get(row, "Longitude")})
        projects.append({"ProjectSK": ref, "PSIPRefNo": ref})
        buildings.append({"ProjectSK": ref, "BuildingDesign": get(row, "BuildingDesign", "ScopeOfWorks", "SCOPE OF WORKS")})
        classrooms.append({"ProjectSK": ref, "Quantity": get(row, "TotalClassrooms", "TOTAL CLASSROOMS")})
    return {"pSIP_Curateds": curated, "dimSchoolPSIPs": schools, "dimSchools": schools,
            "dimProjects": projects, "dimBuildings": buildings, "dimClassrooms": classrooms,
            "dimRegions": [], "dimDivisions": []}
