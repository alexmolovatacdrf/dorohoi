#!/usr/bin/env python3
r"""Prepare the Eugenia export for the Presentation Map.

This script is intentionally a small, read-only importer for the supplied
workbook and JSON export. It keeps the original JSON dossier records and the
complete Excel Eugenia_brut sheet in one deployable fixture, together with
source hashes. It does not write to data/source/.

Example:
  python3 scripts/presentation/prepare-eugenia-demo.py \
    --xlsx /mnt/c/Users/Alex\ Molovata/Downloads/Export_Dosare_Eugenia.xlsx \
    --json /mnt/c/Users/Alex\ Molovata/Downloads/Export_Dosare_Eugenia.json \
    --output data/demo/eugenia-map-demo.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        raise ValueError(f"Invalid Excel cell reference: {reference}")
    result = 0
    for character in letters.group(0):
        result = result * 26 + ord(character) - ord("A") + 1
    return result - 1


def excel_date(value: str, date_1904: bool) -> str:
    number = float(value)
    # A blank/shifted numeric cell should remain raw rather than producing an
    # invalid datetime. Real Excel dates in this workbook are ordinary serial
    # values in the range below.
    if number < 1 or number > 100000:
        return value
    origin = datetime(1904, 1, 1) if date_1904 else datetime(1899, 12, 30)
    converted = origin + timedelta(days=number)
    return converted.strftime("%Y-%m-%d 00:00:00")


def read_workbook(path: Path) -> tuple[dict[str, list[dict[str, object]]], list[dict[str, object]]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("main:si", NS):
                shared_strings.append(
                    "".join(text.text or "" for text in item.iter(f"{{{NS['main']}}}t"))
                )

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        workbook_properties = workbook.find("main:workbookPr", NS)
        date_1904 = bool(
            workbook_properties is not None
            and workbook_properties.attrib.get("date1904") in {"1", "true"}
        )
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall(f"{{{REL_NS}}}Relationship")
        }

        sheets: dict[str, list[dict[str, object]]] = {}
        sheet_metadata: list[dict[str, object]] = []
        for sheet in workbook.findall("main:sheets/main:sheet", NS):
            name = sheet.attrib["name"]
            target = relationship_map[sheet.attrib[f"{{{NS['rel']}}}id"]]
            target = target.lstrip("/")
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            root = ET.fromstring(archive.read(target))
            rows: list[dict[str, object]] = []
            for row in root.findall("main:sheetData/main:row", NS):
                values: dict[int, object] = {}
                for cell in row.findall("main:c", NS):
                    cell_type = cell.attrib.get("t")
                    value_node = cell.find("main:v", NS)
                    inline_node = cell.find("main:is", NS)
                    if inline_node is not None:
                        value: object = "".join(
                            text.text or "" for text in inline_node.iter(f"{{{NS['main']}}}t")
                        )
                    elif value_node is None:
                        value = None
                    else:
                        value = value_node.text or ""
                        if cell_type == "s" and value:
                            value = shared_strings[int(value)]
                    values[column_index(cell.attrib["r"])] = value
                rows.append(values)

            if not rows:
                sheets[name] = []
                sheet_metadata.append({"name": name, "rowCount": 0})
                continue

            header_count = max(rows[0], default=-1) + 1
            headers = [str(rows[0].get(index) or "") for index in range(header_count)]
            records: list[dict[str, object]] = []
            for row in rows[1:]:
                record: dict[str, object] = {}
                for index, header in enumerate(headers):
                    if not header:
                        continue
                    value = row.get(index)
                    if value in (None, ""):
                        record[header] = None
                        continue
                    if name == "Eugenia_brut" and header in {
                        "Date of Birth",
                        "Date of intermediary deportation",
                        "Date of deportation to Transnistria",
                    }:
                        try:
                            value = excel_date(str(value), date_1904)
                        except (TypeError, ValueError):
                            pass
                    record[header] = value
                record["_excelRow"] = len(records) + 2
                records.append(record)
            sheets[name] = records
            sheet_metadata.append({"name": name, "rowCount": len(records)})

        return sheets, sheet_metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", type=Path, required=True)
    parser.add_argument("--json", dest="json_path", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--generated-at", default="2026-07-15")
    args = parser.parse_args()

    source_json = json.loads(args.json_path.read_text(encoding="utf-8"))
    if not isinstance(source_json, list):
        raise ValueError("The supplied JSON export must be a top-level array")
    workbook, sheet_metadata = read_workbook(args.xlsx)
    raw_eugenia_rows = workbook.get("Eugenia_brut", [])
    if not raw_eugenia_rows:
        raise ValueError("The workbook does not contain a non-empty Eugenia_brut sheet")

    output = {
        "metadata": {
            "datasetKey": "eugenia",
            "generatedAt": args.generated_at,
            "description": (
                "Supplied Eugenia export: the complete Excel Eugenia_brut table "
                "plus the 16 dossier records with transcript and scan-check data. "
                "The two source layers are retained separately so names are not "
                "silently merged."
            ),
            "sourceFiles": [
                {
                    "fileName": args.xlsx.name,
                    "format": "xlsx",
                    "sha256": sha256(args.xlsx),
                },
                {
                    "fileName": args.json_path.name,
                    "format": "json",
                    "sha256": sha256(args.json_path),
                },
            ],
            "workbookSheets": sheet_metadata,
        },
        "dossiers": source_json,
        "eugeniaRows": raw_eugenia_rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "dossiers": len(source_json),
                "eugeniaRows": len(raw_eugenia_rows),
                "sha256": sha256(args.output),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
