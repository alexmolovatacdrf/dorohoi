#!/usr/bin/env python3
r"""Prepare the verified green-table subset for the Presentation Map.

The workbook is treated as a source document. This importer reads only the
columns whose Row 1 fill is solid red and writes a small reproducible JSON
fixture. It does not modify the workbook or any file in data/source/.

Example:
  python3 scripts/presentation/prepare-eugenia-presentation.py \
    --xlsx /mnt/c/Users/Alex\ Molovata/Downloads/Tabel_Verde_Comparativ_16072026_0835.xlsx \
    --output data/normalized/eugenia-presentation.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"main": MAIN_NS, "rel": OFFICE_REL_NS}


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


def column_name(index: int) -> str:
    result = ""
    value = index + 1
    while value:
        value, remainder = divmod(value - 1, 26)
        result = chr(65 + remainder) + result
    return result


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def is_red_fill(fill: dict[str, str | None]) -> bool:
    color = (fill.get("fg") or "").upper().replace("#", "")
    return fill.get("pattern") == "solid" and color[-6:] == "FF0000"


def read_styles(archive: zipfile.ZipFile) -> list[dict[str, str | None]]:
    root = ET.fromstring(archive.read("xl/styles.xml"))
    fills_node = next((node for node in root if local_name(node.tag) == "fills"), None)
    fills: list[dict[str, str | None]] = []
    for fill in fills_node if fills_node is not None else []:
        pattern = next((node for node in fill if local_name(node.tag) == "patternFill"), None)
        foreground = next((node for node in pattern if local_name(node.tag) == "fgColor"), None) if pattern is not None else None
        fills.append(
            {
                "pattern": pattern.attrib.get("patternType") if pattern is not None else None,
                "fg": (
                    foreground.attrib.get("rgb")
                    or foreground.attrib.get("indexed")
                    or foreground.attrib.get("theme")
                ) if foreground is not None else None,
            }
        )

    xfs_node = next((node for node in root if local_name(node.tag) == "cellXfs"), None)
    fill_ids = [int(xf.attrib.get("fillId", 0)) for xf in (xfs_node if xfs_node is not None else [])]
    return [fills[fill_id] if fill_id < len(fills) else {"pattern": None, "fg": None} for fill_id in fill_ids]


def cell_value(cell: ET.Element, shared_strings: list[str]) -> object:
    inline = cell.find(f"{{{MAIN_NS}}}is")
    if inline is not None:
        return "".join(text.text or "" for text in inline.iter(f"{{{MAIN_NS}}}t"))
    value_node = cell.find(f"{{{MAIN_NS}}}v")
    if value_node is None or value_node.text is None:
        return None
    value: object = value_node.text
    if cell.attrib.get("t") == "s" and value:
        return shared_strings[int(value)]
    return value


def read_red_table(path: Path) -> tuple[str, list[dict[str, object]], list[dict[str, str]]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root:
                shared_strings.append("".join(text.text or "" for text in item.iter(f"{{{MAIN_NS}}}t")))

        styles = read_styles(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall(f"{{{REL_NS}}}Relationship")
        }

        sheets = workbook.findall("main:sheets/main:sheet", NS)
        if not sheets:
            raise ValueError("The workbook has no worksheets")
        sheet = sheets[0]
        sheet_name = sheet.attrib["name"]
        target = relationship_map[sheet.attrib[f"{{{OFFICE_REL_NS}}}id"]].lstrip("/")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        root = ET.fromstring(archive.read(target))
        rows = root.findall("main:sheetData/main:row", NS)
        if not rows:
            raise ValueError("The first worksheet is empty")

        header_cells = rows[0].findall("main:c", NS)
        headers: dict[int, str] = {}
        selected: list[dict[str, str]] = []
        for cell in header_cells:
            index = column_index(cell.attrib["r"])
            header = str(cell_value(cell, shared_strings) or "").strip()
            headers[index] = header
            style_id = int(cell.attrib.get("s", 0))
            fill = styles[style_id] if style_id < len(styles) else {"pattern": None, "fg": None}
            if header and is_red_fill(fill):
                selected.append({"column": column_name(index), "header": header})

        if not selected:
            raise ValueError("No solid-red columns were found in Row 1")

        selected_indexes = {column_index(item["column"]) for item in selected}
        records: list[dict[str, object]] = []
        for row in rows[1:]:
            values = {column_index(cell.attrib["r"]): cell_value(cell, shared_strings) for cell in row.findall("main:c", NS)}
            record = {item["header"]: values.get(index) for index, item in ((column_index(item["column"]), item) for item in selected)}
            if not any(value not in (None, "") for value in record.values()):
                continue
            record["_excelRow"] = int(row.attrib.get("r", len(records) + 2))
            records.append(record)
        return sheet_name, records, selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--generated-at", default="2026-07-16")
    args = parser.parse_args()

    sheet_name, rows, selected_columns = read_red_table(args.xlsx)
    output = {
        "metadata": {
            "datasetKey": "eugenia-presentation",
            "generatedAt": args.generated_at,
            "description": (
                "Verified Eugenia presentation subset. Only columns with a solid red fill "
                "in Row 1 are included; source wording is preserved exactly."
            ),
            "sourceFiles": [{
                "fileName": args.xlsx.name,
                "format": "xlsx",
                "sha256": sha256(args.xlsx),
            }],
            "worksheet": sheet_name,
            "rowCount": len(rows),
            "selectionRule": "Only Row 1 columns with solid red fill (FF0000) are included.",
            "selectedColumns": selected_columns,
        },
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "rows": len(rows), "columns": len(selected_columns), "sha256": sha256(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
