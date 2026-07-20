#!/usr/bin/env python3
"""Deterministically derive monthly GeoJSON from EuropeanBorders_WWII.

The source archive and its extracted contents stay in ignored ``external-data``.
Compact EPSG:4326 derivatives are written as two independent browser datasets:
the established regional research window and a simplified, uncropped full-
source extent for the public Presentation Map.
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path, PurePosixPath
from typing import Any

import pyproj
import shapefile
import shapely
from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon, box, mapping, shape
from shapely.ops import transform as transform_geometry
from shapely.ops import unary_union
from shapely.validation import explain_validity


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_MANIFEST = REPO_ROOT / "data/manifests/european-borders-wwii.source.json"
EDITORIAL_RECORDS = REPO_ROOT / "data/editorial/historical-administration.json"
DEFAULT_EXTERNAL_DIR = REPO_ROOT / "external-data/european-borders-wwii"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "public/data/historical-administration"
DEFAULT_FULL_OUTPUT_DIR = REPO_ROOT / "public/data/historical-administration-full"

SOURCE_CRS = "ESRI:102013"
TARGET_CRS = "EPSG:4326"
REGIONAL_BBOX = (19.0, 43.3, 34.5, 52.6)
SIMPLIFY_TOLERANCE_DEGREES = 0.005
FULL_SIMPLIFY_TOLERANCE_DEGREES = 0.015
FULL_SOURCE_SIMPLIFY_TOLERANCE_METRES = 1_250.0
COORDINATE_DECIMALS = 5
PRIMARY_END = "1944-09"

MONTH_RE = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|November|December)_(\d{2})_(\d{4})$"
)
REQUIRED_MONTHLY_FIELDS = ("Name", "Foreign_Po", "Head_of_St", "Govt_in_Ex")
EXPECTED_MONTHLY_SCHEMA = (
    ("Name", "C", 100, 0),
    ("Foreign_Po", "C", 254, 0),
    ("Head_of_St", "C", 100, 0),
    ("Govt_in_Ex", "C", 100, 0),
    ("Shape_Leng", "F", 19, 11),
    ("Shape_Area", "F", 19, 11),
)

# This is a display vocabulary derived only from the exact Foreign_Po value.
# It is not a claim about civil or military administration.
FOREIGN_POWER_CATEGORIES: dict[str, str] = {
    "": "unclassified",
    "<Null>": "unclassified",
    "Allied": "allied",
    "Allies": "allied",
    "Axis": "axis",
    "Axis and German, Italian-occupied": "multinational_axis_occupied",
    "Axis and German-occupied": "multinational_axis_occupied",
    "Axis, German, Italian-occupied": "multinational_axis_occupied",
    "Axis-aligned": "axis_aligned",
    "Belligerent": "belligerent",
    "German Protectorate": "german_occupied",
    "German, Bulgarian-occupied": "multinational_axis_occupied",
    "German, Italian, Bulgarian-occupied": "multinational_axis_occupied",
    "German, Italian-occupied": "multinational_axis_occupied",
    "German,Soviet-occupied": "german_soviet_occupied",
    "German-occupied": "german_occupied",
    "Italian Protectorate": "italian_occupied",
    "Italian-occupied": "italian_occupied",
    "Neutral": "neutral",
    "Romanian-occupied": "romanian_occupied",
    "War with Soviet Union": "axis_aligned",
}

CATEGORY_LEGEND = (
    ("unclassified", "Not classified in Foreign_Po", "#aea99e"),
    ("neutral", "Neutral", "#c5b98f"),
    ("allied", "Allied / Allies (raw)", "#6485a3"),
    ("axis", "Axis", "#88545a"),
    ("axis_aligned", "Axis-aligned / at war with USSR", "#9b6b55"),
    ("belligerent", "Belligerent", "#8f7b5a"),
    ("german_occupied", "German-occupied / protectorate", "#76536f"),
    ("italian_occupied", "Italian-occupied / protectorate", "#9c7350"),
    ("romanian_occupied", "Romanian-occupied", "#b87944"),
    ("multinational_axis_occupied", "Multiple Axis occupiers", "#714743"),
    ("german_soviet_occupied", "German and Soviet occupied (raw)", "#69617c"),
)

# A deliberately small public legend. This remains a derived presentation
# vocabulary, never a replacement for Name or Foreign_Po. The exact rules are
# emitted in the full-extent manifest and the raw values remain on every feature.
PRESENTATION_CATEGORY_LEGEND = (
    ("sovereign_state", "Sovereign or state territory", "#b8c4c3"),
    ("neutral_state", "Neutral state territory", "#c8b98b"),
    ("german_allied_state", "German-allied / Axis-aligned state", "#b07852"),
    ("romanian_occupied", "Romanian-occupied / administered", "#c87945"),
    ("german_occupied", "German-occupied / administered", "#76536f"),
    ("soviet_controlled", "Soviet-controlled territory", "#5f7894"),
    ("unresolved_other", "Unresolved or other source classification", "#8d8b84"),
)

PRESENTATION_SOVEREIGN_RAW_VALUES = {
    "Allied",
    "Allies",
    "Belligerent",
    "Neutral",
}
PRESENTATION_GERMAN_ALLIED_RAW_VALUES = {
    "Axis",
    "Axis-aligned",
    "War with Soviet Union",
}
PRESENTATION_GERMAN_RAW_VALUES = {
    "Axis and German, Italian-occupied",
    "Axis and German-occupied",
    "Axis, German, Italian-occupied",
    "German Protectorate",
    "German, Bulgarian-occupied",
    "German, Italian, Bulgarian-occupied",
    "German, Italian-occupied",
    "German-occupied",
}

ATTRIBUTION = (
    "European Borders during World War II (Stanford Spatial History Lab / "
    "Holocaust Geographies Project; Michael De Groot and Erik Steiner). "
    "Derived regional adaptation by Dosare Dorohoi."
)
FULL_EXTENT_ATTRIBUTION = (
    "European Borders during World War II (Stanford Spatial History Lab / "
    "Holocaust Geographies Project; Michael De Groot and Erik Steiner). "
    "Derived full-extent presentation adaptation by Dosare Dorohoi."
)
METHODOLOGICAL_WARNING = (
    "These are monthly analytical boundary snapshots, not comprehensive front lines and not an "
    "explicit civil/military administration dataset. Name, Foreign_Po, Head_of_St and Govt_in_Ex "
    "are preserved as supplied. Head_of_St can identify a de facto authority rather than a "
    "constitutional head of state. October 1944–May 1945 is limited/static evidence."
)


@dataclass(frozen=True)
class SnapshotSource:
    year_month: str
    supplied_date: str
    stem: str
    shp: Path
    shx: Path | None
    dbf: Path
    prj: Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def write_stable_json(path: Path, value: Any) -> bytes:
    payload = stable_json_bytes(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return payload


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def expected_year_months() -> list[str]:
    result: list[str] = []
    year, month = 1938, 2
    while (year, month) <= (1945, 5):
        result.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            year += 1
            month = 1
    return result


def verify_archive(archive_path: Path, source_manifest: dict[str, Any]) -> None:
    archive = source_manifest["archive"]
    if not archive_path.is_file():
        raise FileNotFoundError(f"Source archive not found: {archive_path}")
    if archive_path.stat().st_size != archive["sizeBytes"]:
        raise ValueError("Source archive byte size differs from the committed source manifest")
    actual_hash = sha256_file(archive_path)
    if actual_hash != archive["sha256"]:
        raise ValueError(f"Source archive SHA-256 mismatch: {actual_hash}")
    with zipfile.ZipFile(archive_path) as archive_file:
        files = [entry for entry in archive_file.infolist() if not entry.is_dir()]
        if len(files) != archive["entryCount"]:
            raise ValueError("Source archive entry count differs from the committed source manifest")
        if sum(entry.file_size for entry in files) != archive["uncompressedSizeBytes"]:
            raise ValueError("Source archive uncompressed size differs from the committed source manifest")
        damaged = archive_file.testzip()
        if damaged is not None:
            raise ValueError(f"CRC verification failed for archive entry: {damaged}")


def safe_destination(root: Path, member_name: str) -> Path:
    member = PurePosixPath(member_name)
    if member.is_absolute() or ".." in member.parts:
        raise ValueError(f"Unsafe archive path: {member_name}")
    destination = (root / Path(*member.parts)).resolve()
    if root.resolve() not in destination.parents and destination != root.resolve():
        raise ValueError(f"Archive path escapes extraction directory: {member_name}")
    return destination


def extracted_tree_matches(archive_path: Path, raw_dir: Path, expected_hash: str) -> bool:
    marker = raw_dir / ".source-archive.sha256"
    if not marker.is_file() or marker.read_text(encoding="ascii").strip() != expected_hash:
        return False
    with zipfile.ZipFile(archive_path) as archive_file:
        for entry in archive_file.infolist():
            if entry.is_dir():
                continue
            destination = safe_destination(raw_dir, entry.filename)
            if not destination.is_file() or destination.stat().st_size != entry.file_size:
                return False
    return True


def extract_archive(archive_path: Path, external_dir: Path, expected_hash: str) -> Path:
    raw_dir = external_dir / "raw"
    if extracted_tree_matches(archive_path, raw_dir, expected_hash):
        return raw_dir / "EuropeanBorders_WWII"

    external_dir.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix="raw-staging-", dir=external_dir))
    try:
        with zipfile.ZipFile(archive_path) as archive_file:
            for entry in archive_file.infolist():
                destination = safe_destination(staging, entry.filename)
                if entry.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive_file.open(entry) as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target, length=1024 * 1024)
        (staging / ".source-archive.sha256").write_text(expected_hash + "\n", encoding="ascii")
        if raw_dir.exists():
            shutil.rmtree(raw_dir)
        staging.replace(raw_dir)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return raw_dir / "EuropeanBorders_WWII"


def parse_snapshot_stem(stem: str) -> tuple[str, str]:
    match = MONTH_RE.fullmatch(stem)
    if match is None:
        raise ValueError(f"Unexpected monthly filename: {stem}")
    month_name, day_text, year_text = match.groups()
    month = list(calendar.month_name).index(month_name)
    year, day = int(year_text), int(day_text)
    supplied = date(year, month, day)
    expected_day = calendar.monthrange(year, month)[1]
    allowed_august_30 = month == 8 and year in (1938, 1939) and day == 30
    allowed_february_28 = month == 2 and day == 28
    if day != expected_day and not allowed_august_30 and not allowed_february_28:
        raise ValueError(f"Unexpected snapshot day in {stem}")
    return f"{year:04d}-{month:02d}", supplied.isoformat()


def inventory_snapshots(source_dir: Path) -> tuple[list[SnapshotSource], Path]:
    snapshots: list[SnapshotSource] = []
    for dbf in sorted(source_dir.glob("*.dbf")):
        if dbf.stem == "Territorial_Changes":
            continue
        year_month, supplied_date = parse_snapshot_stem(dbf.stem)
        components = {suffix: dbf.with_suffix(suffix) for suffix in (".shp", ".shx", ".prj")}
        for required_suffix in (".shp", ".shx", ".prj"):
            if not components[required_suffix].is_file():
                raise FileNotFoundError(f"Missing {required_suffix} for {dbf.stem}")
        snapshots.append(
            SnapshotSource(
                year_month=year_month,
                supplied_date=supplied_date,
                stem=dbf.stem,
                shp=components[".shp"],
                shx=components[".shx"],
                dbf=dbf,
                prj=components[".prj"],
            )
        )
    snapshots.sort(key=lambda snapshot: snapshot.year_month)
    observed = [snapshot.year_month for snapshot in snapshots]
    if observed != expected_year_months():
        raise ValueError("Monthly snapshots are not the complete February 1938–May 1945 sequence")
    territorial_stem = source_dir / "Territorial_Changes"
    for suffix in (".shp", ".dbf", ".prj"):
        if not territorial_stem.with_suffix(suffix).is_file():
            raise FileNotFoundError(f"Missing Territorial_Changes{suffix}")
    return snapshots, territorial_stem


def reader_for(stem: Path, *, require_shx: bool) -> shapefile.Reader:
    kwargs: dict[str, Any] = {
        "shp": str(stem.with_suffix(".shp")),
        "dbf": str(stem.with_suffix(".dbf")),
        "encoding": "cp1252",
        "encodingErrors": "strict",
    }
    shx = stem.with_suffix(".shx")
    if shx.is_file():
        kwargs["shx"] = str(shx)
    elif require_shx:
        raise FileNotFoundError(f"Missing shapefile index: {shx}")
    return shapefile.Reader(**kwargs)


def field_schema(reader: shapefile.Reader) -> tuple[tuple[str, str, int, int], ...]:
    return tuple((str(field[0]), str(field[1]), int(field[2]), int(field[3])) for field in reader.fields[1:])


def validate_projection(prj_path: Path, expected_wkt: str) -> None:
    observed = prj_path.read_text(encoding="ascii").strip()
    if observed != expected_wkt:
        raise ValueError(f"Projection WKT differs from source manifest: {prj_path.name}")


def polygonal_only(geometry: Any) -> Polygon | MultiPolygon | None:
    if geometry.is_empty:
        return None
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry

    polygons: list[Polygon] = []

    def collect(value: Any) -> None:
        if value.is_empty:
            return
        if isinstance(value, Polygon):
            polygons.append(value)
            return
        if isinstance(value, MultiPolygon):
            polygons.extend(part for part in value.geoms if not part.is_empty)
            return
        # make_valid can produce nested GeometryCollections when source rings
        # contain both polygonal and line remnants. Traverse all collection
        # levels and retain only polygonal evidence.
        if hasattr(value, "geoms"):
            for part in value.geoms:
                collect(part)

    collect(geometry)
    if not polygons:
        return None
    merged = unary_union(polygons)
    return merged if isinstance(merged, (Polygon, MultiPolygon)) else None


def bounds_overlap(
    feature_bounds: Iterable[float] | None,
    crop_bounds: tuple[float, float, float, float],
) -> bool:
    if feature_bounds is None:
        return False
    values = tuple(float(value) for value in feature_bounds)
    if len(values) != 4:
        return False
    min_x, min_y, max_x, max_y = values
    crop_min_x, crop_min_y, crop_max_x, crop_max_y = crop_bounds
    return not (
        max_x < crop_min_x
        or min_x > crop_max_x
        or max_y < crop_min_y
        or min_y > crop_max_y
    )


def round_coordinates(value: Any) -> Any:
    if isinstance(value, (list, tuple)):
        if value and all(isinstance(item, (int, float)) for item in value):
            return [round(float(item), COORDINATE_DECIMALS) for item in value]
        return [round_coordinates(item) for item in value]
    return value


def derive_geometry(
    source_geometry: dict[str, Any],
    transformer: Transformer,
    source_crop_bounds: tuple[float, float, float, float],
    crop: Polygon,
) -> tuple[dict[str, Any] | None, list[str]]:
    repairs: list[str] = []
    geometry = shape(source_geometry)
    if not geometry.is_valid:
        repairs.append(f"source invalid: {explain_validity(geometry)}")
        geometry = shapely.make_valid(geometry)
    min_x, min_y, max_x, max_y = geometry.bounds
    crop_min_x, crop_min_y, crop_max_x, crop_max_y = source_crop_bounds
    if max_x < crop_min_x or min_x > crop_max_x or max_y < crop_min_y or min_y > crop_max_y:
        return None, repairs
    # Clip cheaply in the source projection before reprojecting. This avoids
    # transforming the very detailed vertices for the rest of Europe. The
    # exact geographic crop is still applied after transformation.
    source_clipped = shapely.clip_by_rect(
        geometry,
        crop_min_x,
        crop_min_y,
        crop_max_x,
        crop_max_y,
    )
    if source_clipped.is_empty:
        return None, repairs
    if not source_clipped.is_valid:
        repairs.append(f"source pre-clip invalid: {explain_validity(source_clipped)}")
        source_clipped = shapely.make_valid(source_clipped)
    projected = transform_geometry(transformer.transform, source_clipped)
    if not projected.is_valid:
        repairs.append(f"reprojected invalid: {explain_validity(projected)}")
        projected = shapely.make_valid(projected)
    clipped = projected.intersection(crop)
    if clipped.is_empty:
        return None, repairs
    if not clipped.is_valid:
        repairs.append(f"clipped invalid: {explain_validity(clipped)}")
        clipped = shapely.make_valid(clipped)
    simplified = clipped.simplify(SIMPLIFY_TOLERANCE_DEGREES, preserve_topology=True)
    polygonal = polygonal_only(simplified)
    if polygonal is None or polygonal.is_empty:
        return None, repairs
    if not polygonal.is_valid:
        repairs.append(f"simplified invalid: {explain_validity(polygonal)}")
        polygonal = polygonal_only(shapely.make_valid(polygonal))
        if polygonal is None:
            return None, repairs
    result = mapping(polygonal)
    return {"type": result["type"], "coordinates": round_coordinates(result["coordinates"])}, repairs


def derive_full_geometry(
    source_geometry: dict[str, Any],
    transformer: Transformer,
) -> tuple[dict[str, Any] | None, tuple[float, float, float, float] | None, list[str]]:
    """Reproject and simplify a source polygon without applying a crop."""

    repairs: list[str] = []
    geometry = shape(source_geometry)
    if not geometry.is_valid:
        repairs.append(f"source invalid: {explain_validity(geometry)}")
        geometry = shapely.make_valid(geometry)
    polygonal_source = polygonal_only(geometry)
    if polygonal_source is None:
        return None, None, repairs
    # Reduce the very detailed continent-wide source vertices before the CRS
    # transform. This is topology-preserving generalization, not clipping.
    geometry = polygonal_source.simplify(
        FULL_SOURCE_SIMPLIFY_TOLERANCE_METRES,
        preserve_topology=True,
    )
    projected = transform_geometry(transformer.transform, geometry)
    if not projected.is_valid:
        repairs.append(f"reprojected invalid: {explain_validity(projected)}")
        projected = shapely.make_valid(projected)
    simplified = projected.simplify(
        FULL_SIMPLIFY_TOLERANCE_DEGREES,
        preserve_topology=True,
    )
    polygonal = polygonal_only(simplified)
    if polygonal is None or polygonal.is_empty:
        return None, None, repairs
    if not polygonal.is_valid:
        repairs.append(f"simplified invalid: {explain_validity(polygonal)}")
        polygonal = polygonal_only(shapely.make_valid(polygonal))
        if polygonal is None:
            return None, None, repairs
    result = mapping(polygonal)
    bounds = tuple(float(value) for value in polygonal.bounds)
    return (
        {
            "type": result["type"],
            "coordinates": round_coordinates(result["coordinates"]),
        },
        (bounds[0], bounds[1], bounds[2], bounds[3]),
        repairs,
    )


def presentation_category(name_raw: str, foreign_power_raw: str) -> str:
    """Return a documented public-display category while retaining raw values."""

    if name_raw == "Soviet Union":
        return "soviet_controlled"
    if foreign_power_raw == "Romanian-occupied":
        return "romanian_occupied"
    if foreign_power_raw in PRESENTATION_GERMAN_RAW_VALUES:
        return "german_occupied"
    if foreign_power_raw in PRESENTATION_GERMAN_ALLIED_RAW_VALUES:
        return "german_allied_state"
    if foreign_power_raw == "Neutral":
        return "neutral_state"
    if foreign_power_raw in PRESENTATION_SOVEREIGN_RAW_VALUES:
        return "sovereign_state"
    return "unresolved_other"


def editorial_flags(editorial: dict[str, Any], year_month: str, name_raw: str) -> list[str]:
    flags: list[str] = []
    for record in editorial.get("records", []):
        if record.get("snapshot") not in (None, year_month):
            continue
        if record.get("featureNameRaw") not in (None, name_raw):
            continue
        flags.append(str(record["id"]))
    return sorted(flags)


def convert_snapshot(
    snapshot: SnapshotSource,
    transformer: Transformer,
    source_crop_bounds: tuple[float, float, float, float],
    crop: Polygon,
    source_wkt: str,
    editorial: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_projection(snapshot.prj, source_wkt)
    reader = reader_for(snapshot.dbf.with_suffix(""), require_shx=True)
    schema = field_schema(reader)
    if schema != EXPECTED_MONTHLY_SCHEMA:
        raise ValueError(f"Unexpected DBF schema in {snapshot.dbf.name}: {schema}")
    field_names = [field[0] for field in schema]
    if any(required not in field_names for required in REQUIRED_MONTHLY_FIELDS):
        raise ValueError(f"Required monthly attributes missing from {snapshot.dbf.name}")

    features: list[dict[str, Any]] = []
    repair_notes: list[dict[str, Any]] = []
    source_count = len(reader)
    for source_index, shape_record in enumerate(reader.iterShapeRecords()):
        record = shape_record.record.as_dict()
        raw = {field: str(record.get(field) or "") for field in REQUIRED_MONTHLY_FIELDS}
        category = FOREIGN_POWER_CATEGORIES.get(raw["Foreign_Po"])
        if category is None:
            raise ValueError(
                f"Undocumented Foreign_Po value {raw['Foreign_Po']!r} in {snapshot.dbf.name}"
            )
        if not bounds_overlap(shape_record.shape.bbox, source_crop_bounds):
            continue
        geometry, repairs = derive_geometry(
            shape_record.shape.__geo_interface__, transformer, source_crop_bounds, crop
        )
        if repairs:
            repair_notes.append({"sourceFeatureIndex": source_index, "notes": repairs})
        if geometry is None:
            continue
        feature_id = f"{snapshot.year_month}-{source_index:03d}"
        properties = {
            **raw,
            "editorialFlagIds": editorial_flags(editorial, snapshot.year_month, raw["Name"]),
            "foreignPowerCategory": category,
            "snapshotDate": snapshot.supplied_date,
            "sourceFeatureIndex": source_index,
            "yearMonth": snapshot.year_month,
        }
        features.append(
            {"type": "Feature", "id": feature_id, "geometry": geometry, "properties": properties}
        )
    features.sort(key=lambda feature: (feature["properties"]["Name"], feature["properties"]["sourceFeatureIndex"]))
    collection = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "sourceCrs": SOURCE_CRS,
            "targetCrs": TARGET_CRS,
            "regionalBbox": list(REGIONAL_BBOX),
            "simplifyToleranceDegrees": SIMPLIFY_TOLERANCE_DEGREES,
            "snapshotDate": snapshot.supplied_date,
            "yearMonth": snapshot.year_month,
        },
    }
    report = {
        "sourceRecordCount": source_count,
        "regionalFeatureCount": len(features),
        "geometryRepairs": repair_notes,
    }
    reader.close()
    return collection, report


def convert_full_snapshot(
    snapshot: SnapshotSource,
    transformer: Transformer,
    source_wkt: str,
    editorial: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Convert every polygon in one monthly source file without spatial cropping."""

    validate_projection(snapshot.prj, source_wkt)
    reader = reader_for(snapshot.dbf.with_suffix(""), require_shx=True)
    schema = field_schema(reader)
    if schema != EXPECTED_MONTHLY_SCHEMA:
        raise ValueError(f"Unexpected DBF schema in {snapshot.dbf.name}: {schema}")
    field_names = [field[0] for field in schema]
    if any(required not in field_names for required in REQUIRED_MONTHLY_FIELDS):
        raise ValueError(f"Required monthly attributes missing from {snapshot.dbf.name}")

    features: list[dict[str, Any]] = []
    repair_notes: list[dict[str, Any]] = []
    feature_bounds: list[tuple[float, float, float, float]] = []
    source_count = len(reader)
    for source_index, shape_record in enumerate(reader.iterShapeRecords()):
        record = shape_record.record.as_dict()
        raw = {field: str(record.get(field) or "") for field in REQUIRED_MONTHLY_FIELDS}
        category = FOREIGN_POWER_CATEGORIES.get(raw["Foreign_Po"])
        if category is None:
            raise ValueError(
                f"Undocumented Foreign_Po value {raw['Foreign_Po']!r} in {snapshot.dbf.name}"
            )
        geometry, bounds, repairs = derive_full_geometry(
            shape_record.shape.__geo_interface__,
            transformer,
        )
        if repairs:
            repair_notes.append({"sourceFeatureIndex": source_index, "notes": repairs})
        if geometry is None or bounds is None:
            continue
        feature_bounds.append(bounds)
        properties = {
            **raw,
            "editorialFlagIds": editorial_flags(editorial, snapshot.year_month, raw["Name"]),
            "foreignPowerCategory": category,
            "presentationCategory": presentation_category(raw["Name"], raw["Foreign_Po"]),
            "snapshotDate": snapshot.supplied_date,
            "sourceFeatureIndex": source_index,
            "yearMonth": snapshot.year_month,
        }
        features.append(
            {
                "type": "Feature",
                "id": f"{snapshot.year_month}-{source_index:03d}",
                "geometry": geometry,
                "properties": properties,
            }
        )
    reader.close()
    if not feature_bounds:
        raise ValueError(f"No full-extent polygon survived conversion for {snapshot.dbf.name}")
    data_bbox = [
        min(bounds[0] for bounds in feature_bounds),
        min(bounds[1] for bounds in feature_bounds),
        max(bounds[2] for bounds in feature_bounds),
        max(bounds[3] for bounds in feature_bounds),
    ]
    features.sort(
        key=lambda feature: (
            feature["properties"]["Name"],
            feature["properties"]["sourceFeatureIndex"],
        )
    )
    collection = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "sourceCrs": SOURCE_CRS,
            "targetCrs": TARGET_CRS,
            "extentMode": "full_source",
            "cropped": False,
            "dataBbox": data_bbox,
            "sourceSimplifyToleranceMetres": FULL_SOURCE_SIMPLIFY_TOLERANCE_METRES,
            "simplifyToleranceDegrees": FULL_SIMPLIFY_TOLERANCE_DEGREES,
            "snapshotDate": snapshot.supplied_date,
            "yearMonth": snapshot.year_month,
        },
    }
    report = {
        "sourceRecordCount": source_count,
        "featureCount": len(features),
        "dataBbox": data_bbox,
        "geometryRepairs": repair_notes,
    }
    if len(features) != source_count:
        raise ValueError(
            f"Full-extent conversion lost source records for {snapshot.dbf.name}: "
            f"{len(features)} of {source_count}"
        )
    return collection, report


def serialize_territorial_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y%m%d")
    if value is None:
        return ""
    if isinstance(value, float):
        return format(value, ".11g")
    return str(value)


def convert_territorial_changes(
    stem: Path,
    transformer: Transformer,
    source_crop_bounds: tuple[float, float, float, float],
    crop: Polygon,
    source_wkt: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_projection(stem.with_suffix(".prj"), source_wkt)
    reader = reader_for(stem, require_shx=False)
    fields = [str(field[0]) for field in reader.fields[1:]]
    required = {"TERRITORY_", "ALT_NAME", "GOVT", "FORMER_GOV", "CHANGE_DAT", "TYPE"}
    if not required.issubset(fields):
        raise ValueError("Territorial_Changes is missing required fields")
    features: list[dict[str, Any]] = []
    repairs: list[dict[str, Any]] = []
    for source_index, shape_record in enumerate(reader.iterShapeRecords()):
        properties = {
            key: serialize_territorial_value(value)
            for key, value in shape_record.record.as_dict().items()
        }
        change_raw = properties["CHANGE_DAT"]
        if not re.fullmatch(r"\d{8}", change_raw):
            raise ValueError(f"Invalid Territorial_Changes date: {change_raw!r}")
        properties.update(
            {
                "changeDate": f"{change_raw[:4]}-{change_raw[4:6]}-{change_raw[6:]}",
                "sourceFeatureIndex": source_index,
            }
        )
        if not bounds_overlap(shape_record.shape.bbox, source_crop_bounds):
            continue
        geometry, geometry_repairs = derive_geometry(
            shape_record.shape.__geo_interface__, transformer, source_crop_bounds, crop
        )
        if geometry_repairs:
            repairs.append({"sourceFeatureIndex": source_index, "notes": geometry_repairs})
        if geometry is None:
            continue
        features.append(
            {
                "type": "Feature",
                "id": f"territorial-change-{source_index:03d}",
                "geometry": geometry,
                "properties": properties,
            }
        )
    features.sort(key=lambda feature: (feature["properties"]["CHANGE_DAT"], feature["properties"]["TERRITORY_"], feature["properties"]["sourceFeatureIndex"]))
    collection = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "sourceCrs": SOURCE_CRS,
            "targetCrs": TARGET_CRS,
            "regionalBbox": list(REGIONAL_BBOX),
            "simplifyToleranceDegrees": SIMPLIFY_TOLERANCE_DEGREES,
        },
    }
    report = {
        "sourceRecordCount": len(reader),
        "regionalFeatureCount": len(features),
        "geometryRepairs": repairs,
        "missingShxReadMode": "sequential",
    }
    reader.close()
    return collection, report


def convert_full_territorial_changes(
    stem: Path,
    transformer: Transformer,
    source_wkt: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_projection(stem.with_suffix(".prj"), source_wkt)
    reader = reader_for(stem, require_shx=False)
    fields = [str(field[0]) for field in reader.fields[1:]]
    required = {"TERRITORY_", "ALT_NAME", "GOVT", "FORMER_GOV", "CHANGE_DAT", "TYPE"}
    if not required.issubset(fields):
        raise ValueError("Territorial_Changes is missing required fields")
    features: list[dict[str, Any]] = []
    repairs: list[dict[str, Any]] = []
    feature_bounds: list[tuple[float, float, float, float]] = []
    for source_index, shape_record in enumerate(reader.iterShapeRecords()):
        properties = {
            key: serialize_territorial_value(value)
            for key, value in shape_record.record.as_dict().items()
        }
        change_raw = properties["CHANGE_DAT"]
        if not re.fullmatch(r"\d{8}", change_raw):
            raise ValueError(f"Invalid Territorial_Changes date: {change_raw!r}")
        properties.update(
            {
                "changeDate": f"{change_raw[:4]}-{change_raw[4:6]}-{change_raw[6:]}",
                "sourceFeatureIndex": source_index,
            }
        )
        geometry, bounds, geometry_repairs = derive_full_geometry(
            shape_record.shape.__geo_interface__,
            transformer,
        )
        if geometry_repairs:
            repairs.append({"sourceFeatureIndex": source_index, "notes": geometry_repairs})
        if geometry is None or bounds is None:
            continue
        feature_bounds.append(bounds)
        features.append(
            {
                "type": "Feature",
                "id": f"territorial-change-{source_index:03d}",
                "geometry": geometry,
                "properties": properties,
            }
        )
    source_count = len(reader)
    reader.close()
    if len(features) != source_count or not feature_bounds:
        raise ValueError(
            f"Full Territorial_Changes conversion retained {len(features)} of {source_count} records"
        )
    features.sort(
        key=lambda feature: (
            feature["properties"]["CHANGE_DAT"],
            feature["properties"]["TERRITORY_"],
            feature["properties"]["sourceFeatureIndex"],
        )
    )
    data_bbox = [
        min(bounds[0] for bounds in feature_bounds),
        min(bounds[1] for bounds in feature_bounds),
        max(bounds[2] for bounds in feature_bounds),
        max(bounds[3] for bounds in feature_bounds),
    ]
    collection = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "sourceCrs": SOURCE_CRS,
            "targetCrs": TARGET_CRS,
            "extentMode": "full_source",
            "cropped": False,
            "dataBbox": data_bbox,
            "sourceSimplifyToleranceMetres": FULL_SOURCE_SIMPLIFY_TOLERANCE_METRES,
            "simplifyToleranceDegrees": FULL_SIMPLIFY_TOLERANCE_DEGREES,
        },
    }
    report = {
        "sourceRecordCount": source_count,
        "featureCount": len(features),
        "dataBbox": data_bbox,
        "geometryRepairs": repairs,
        "missingShxReadMode": "sequential",
    }
    return collection, report


def validate_source_assertions(source_dir: Path) -> dict[str, Any]:
    row_cache: dict[str, list[dict[str, Any]]] = {}

    def rows(year_month: str) -> list[dict[str, Any]]:
        if year_month in row_cache:
            return row_cache[year_month]
        candidates = [path for path in source_dir.glob("*.dbf") if path.stem != "Territorial_Changes" and parse_snapshot_stem(path.stem)[0] == year_month]
        if len(candidates) != 1:
            raise ValueError(f"Expected one DBF for {year_month}")
        reader = reader_for(candidates[0].with_suffix(""), require_shx=True)
        result = [record.as_dict() for record in reader.iterRecords()]
        reader.close()
        row_cache[year_month] = result
        return result

    august_1941 = rows("1941-08")
    transnistria = [row for row in august_1941 if row["Name"] == "Transnistria"]
    if len(transnistria) != 1:
        raise ValueError("Transnistria is not separately present in August 1941")
    if transnistria[0]["Foreign_Po"] != "Romanian-occupied" or "Gheorghe Alexianu" not in transnistria[0]["Head_of_St"]:
        raise ValueError("August 1941 Transnistria attributes do not match the supplied archive")

    september_1941 = rows("1941-09")
    rku = [row for row in september_1941 if row["Name"] == "Reichskommissariat Ukraine"]
    if len(rku) != 1 or rku[0]["Foreign_Po"] != "German-occupied":
        raise ValueError("Reichskommissariat Ukraine is not separately German-occupied")

    transnistria_months: list[str] = []
    for year_month in expected_year_months():
        if any(row["Name"] == "Transnistria" for row in rows(year_month)):
            transnistria_months.append(year_month)
    if transnistria_months != expected_year_months()[expected_year_months().index("1941-08"):expected_year_months().index("1944-03") + 1]:
        raise ValueError("Transnistria presence is not exactly August 1941–March 1944")

    observed_foreign_power_values = {
        str(row.get("Foreign_Po") or "")
        for year_month in expected_year_months()
        for row in rows(year_month)
    }
    if observed_foreign_power_values != set(FOREIGN_POWER_CATEGORIES):
        missing = sorted(observed_foreign_power_values - set(FOREIGN_POWER_CATEGORIES))
        extra = sorted(set(FOREIGN_POWER_CATEGORIES) - observed_foreign_power_values)
        raise ValueError(f"Foreign_Po vocabulary mismatch; missing={missing}, extra={extra}")

    territorial_reader = reader_for(source_dir / "Territorial_Changes", require_shx=False)
    territorial_rows = [record.as_dict() for record in territorial_reader.iterRecords()]
    territorial_reader.close()
    territorial_dates = {
        value.strftime("%Y%m%d") if isinstance(value, (date, datetime)) else str(value)
        for value in (row["CHANGE_DAT"] for row in territorial_rows)
    }
    for required_date in ("19410819", "19440401"):
        if required_date not in territorial_dates:
            raise ValueError(f"Territorial_Changes does not contain {required_date}")

    return {
        "transnistriaPresence": {"start": "1941-08", "end": "1944-03", "monthCount": len(transnistria_months)},
        "transnistriaAugust1941": {
            field: str(transnistria[0][field] or "") for field in REQUIRED_MONTHLY_FIELDS
        },
        "reichskommissariatUkraineSeptember1941": {
            field: str(rku[0][field] or "") for field in REQUIRED_MONTHLY_FIELDS
        },
        "territorialDatesVerified": ["19410819", "19440401"],
        "foreignPowerRawValuesVerified": sorted(observed_foreign_power_values),
    }


def historical_territorial_periods(source_dir: Path) -> list[dict[str, str]]:
    """Summarize consecutive monthly intervals for unchanged source attributes.

    The monthly GeoJSON remains the browser's selected-month data. This compact
    manifest metadata lets the details panel explain the full interval for a
    territory without downloading every monthly snapshot.
    """

    row_cache: dict[str, list[dict[str, Any]]] = {}

    def rows(year_month: str) -> list[dict[str, Any]]:
        if year_month in row_cache:
            return row_cache[year_month]
        candidates = [
            path
            for path in source_dir.glob("*.dbf")
            if path.stem != "Territorial_Changes"
            and parse_snapshot_stem(path.stem)[0] == year_month
        ]
        if len(candidates) != 1:
            raise ValueError(f"Expected one DBF for {year_month}")
        reader = reader_for(candidates[0].with_suffix(""), require_shx=True)
        result = [record.as_dict() for record in reader.iterRecords()]
        reader.close()
        row_cache[year_month] = result
        return result

    periods: list[dict[str, str]] = []
    active_period_by_key: dict[tuple[str, ...], int] = {}
    previous_month: str | None = None
    for year_month in expected_year_months():
        current_period_by_key: dict[tuple[str, ...], int] = {}
        for row in rows(year_month):
            raw = {field: str(row.get(field) or "") for field in REQUIRED_MONTHLY_FIELDS}
            key = (
                raw["Name"],
                raw["Foreign_Po"],
                raw["Head_of_St"],
                raw["Govt_in_Ex"],
                presentation_category(raw["Name"], raw["Foreign_Po"]),
            )
            if key in current_period_by_key:
                continue
            period_index = (
                active_period_by_key.get(key)
                if previous_month is not None
                else None
            )
            if period_index is None:
                period_index = len(periods)
                periods.append(
                    {
                        **raw,
                        "presentationCategory": key[-1],
                        "start": year_month,
                        "end": year_month,
                    }
                )
            else:
                periods[period_index]["end"] = year_month
            current_period_by_key[key] = period_index
        active_period_by_key = current_period_by_key
        previous_month = year_month

    periods.sort(
        key=lambda period: (
            period["Name"],
            period["start"],
            period["Foreign_Po"],
            period["Head_of_St"],
            period["Govt_in_Ex"],
        )
    )
    return periods


def relative_url(path: Path, output_dir: Path) -> str:
    relative = path.relative_to(output_dir).as_posix()
    return f"/data/historical-administration/{relative}"


def projected_crop_bounds() -> tuple[float, float, float, float]:
    reverse = Transformer.from_crs(
        TARGET_CRS,
        SOURCE_CRS,
        always_xy=True,
        allow_ballpark=False,
        only_best=True,
    )
    west, south, east, north = REGIONAL_BBOX
    points: list[tuple[float, float]] = []
    for step in range(65):
        ratio = step / 64
        longitude = west + (east - west) * ratio
        latitude = south + (north - south) * ratio
        points.extend(
            [
                (longitude, south),
                (longitude, north),
                (west, latitude),
                (east, latitude),
            ]
        )
    source_x, source_y = reverse.transform(
        [point[0] for point in points], [point[1] for point in points]
    )
    return min(source_x), min(source_y), max(source_x), max(source_y)


def replace_output(staging: Path, output_dir: Path) -> None:
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    backup = output_dir.with_name(output_dir.name + ".previous")
    if backup.exists():
        shutil.rmtree(backup)
    if output_dir.exists():
        output_dir.replace(backup)
    staging.replace(output_dir)
    if backup.exists():
        shutil.rmtree(backup)


def build(
    archive_path: Path,
    external_dir: Path,
    output_dir: Path,
) -> None:
    source_manifest = load_json(SOURCE_MANIFEST)
    editorial = load_json(EDITORIAL_RECORDS)
    verify_archive(archive_path, source_manifest)
    source_dir = extract_archive(archive_path, external_dir, source_manifest["archive"]["sha256"])
    snapshots, territorial_stem = inventory_snapshots(source_dir)
    source_assertions = validate_source_assertions(source_dir)
    territorial_periods = historical_territorial_periods(source_dir)

    transformer = Transformer.from_crs(
        SOURCE_CRS,
        TARGET_CRS,
        always_xy=True,
        allow_ballpark=False,
        only_best=True,
    )
    source_crop_bounds = projected_crop_bounds()
    crop = box(*REGIONAL_BBOX)
    staging = Path(tempfile.mkdtemp(prefix="historical-administration-", dir=output_dir.parent))
    try:
        snapshot_entries: list[dict[str, Any]] = []
        all_repairs: list[dict[str, Any]] = []
        for snapshot in snapshots:
            collection, report = convert_snapshot(
                snapshot,
                transformer,
                source_crop_bounds,
                crop,
                source_manifest["projection"]["sourceWkt"],
                editorial,
            )
            target = staging / "snapshots" / f"{snapshot.year_month}.geojson"
            payload = write_stable_json(target, collection)
            status = "primary" if snapshot.year_month <= PRIMARY_END else "limited_static"
            entry = {
                "yearMonth": snapshot.year_month,
                "snapshotDate": snapshot.supplied_date,
                "status": status,
                "file": f"snapshots/{snapshot.year_month}.geojson",
                "url": relative_url(target, staging),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "bytes": len(payload),
                **{key: value for key, value in report.items() if key != "geometryRepairs"},
            }
            snapshot_entries.append(entry)
            print(f"Converted {snapshot.year_month}: {entry['regionalFeatureCount']} regional features", flush=True)
            if report["geometryRepairs"]:
                all_repairs.append({"yearMonth": snapshot.year_month, "features": report["geometryRepairs"]})

        territorial_collection, territorial_report = convert_territorial_changes(
            territorial_stem,
            transformer,
            source_crop_bounds,
            crop,
            source_manifest["projection"]["sourceWkt"],
        )
        territorial_target = staging / "territorial-changes.geojson"
        territorial_payload = write_stable_json(territorial_target, territorial_collection)
        operation = transformer.get_last_used_operation()

        category_values = sorted(set(FOREIGN_POWER_CATEGORIES.values()))
        legend_values = [item[0] for item in CATEGORY_LEGEND]
        if category_values != sorted(legend_values):
            raise ValueError("Foreign-power category mapping and legend are inconsistent")

        manifest = {
            "schemaVersion": 1,
            "source": {
                "id": source_manifest["sourceId"],
                "title": source_manifest["title"],
                "archiveSha256": source_manifest["archive"]["sha256"],
                "attribution": ATTRIBUTION,
                "useLimit": source_manifest["useLimit"],
            },
            "projection": {
                "source": SOURCE_CRS,
                "target": TARGET_CRS,
                "coordinateOrder": "longitude, latitude",
                "transformationDescription": operation.description,
                "transformationDefinition": operation.definition,
                "transformationAccuracyMetres": operation.accuracy,
            },
            "processing": {
                "regionalBbox": list(REGIONAL_BBOX),
                "regionalScope": "Romania, Moldova, Transnistria, western Ukraine and the Southern Bug research region",
                "cropIsResearchWindowNotBoundary": True,
                "simplifyToleranceDegrees": SIMPLIFY_TOLERANCE_DEGREES,
                "coordinateDecimals": COORDINATE_DECIMALS,
                "geometryRepairPolicy": "Invalid geometries are detected, reported and repaired with Shapely make_valid before polygon-only clipping; source files are unchanged.",
                "geometryRepairs": all_repairs,
                "tools": {
                    "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                    "pyproj": pyproj.__version__,
                    "pyshp": shapefile.__version__,
                    "shapely": shapely.__version__,
                },
            },
            "temporalCoverage": {
                "start": "1938-02",
                "end": "1945-05",
                "primarySupported": {"start": "1938-02", "end": PRIMARY_END},
                "limitedStatic": {
                    "start": "1944-10",
                    "end": "1945-05",
                    "reason": source_manifest["limitedInterval"]["reason"],
                },
                "defaultYearMonth": "1941-08",
            },
            "rawMonthlyAttributes": list(REQUIRED_MONTHLY_FIELDS),
            "derivedForeignPowerVocabulary": {
                "field": "foreignPowerCategory",
                "sourceField": "Foreign_Po",
                "method": "Exact, documented lookup of the unmodified raw Foreign_Po string; this is not an administration-type field.",
                "rawValueMapping": FOREIGN_POWER_CATEGORIES,
                "legend": [
                    {"value": value, "label": label, "color": color}
                    for value, label, color in CATEGORY_LEGEND
                ],
            },
            "methodologicalWarning": METHODOLOGICAL_WARNING,
            "snapshots": snapshot_entries,
            "snapshotByYearMonth": {entry["yearMonth"]: entry["file"] for entry in snapshot_entries},
            "territorialChanges": {
                "file": "territorial-changes.geojson",
                "url": relative_url(territorial_target, staging),
                "sha256": hashlib.sha256(territorial_payload).hexdigest(),
                "bytes": len(territorial_payload),
                **territorial_report,
            },
            "territorialPeriods": territorial_periods,
            "sourceAssertions": source_assertions,
        }
        manifest_payload = write_stable_json(staging / "manifest.json", manifest)

        checksum_lines = [
            f"{entry['sha256']}  {entry['file']}" for entry in snapshot_entries
        ]
        checksum_lines.extend(
            [
                f"{manifest['territorialChanges']['sha256']}  territorial-changes.geojson",
                f"{hashlib.sha256(manifest_payload).hexdigest()}  manifest.json",
            ]
        )
        (staging / "derived.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="ascii")
        replace_output(staging, output_dir)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def build_full(
    archive_path: Path,
    external_dir: Path,
    output_dir: Path,
) -> None:
    """Build the uncropped, conservatively simplified browser derivative."""

    source_manifest = load_json(SOURCE_MANIFEST)
    editorial = load_json(EDITORIAL_RECORDS)
    verify_archive(archive_path, source_manifest)
    source_dir = extract_archive(
        archive_path,
        external_dir,
        source_manifest["archive"]["sha256"],
    )
    snapshots, territorial_stem = inventory_snapshots(source_dir)
    source_assertions = validate_source_assertions(source_dir)
    territorial_periods = historical_territorial_periods(source_dir)
    transformer = Transformer.from_crs(
        SOURCE_CRS,
        TARGET_CRS,
        always_xy=True,
        allow_ballpark=False,
        only_best=True,
    )
    staging = Path(
        tempfile.mkdtemp(
            prefix="historical-administration-full-",
            dir=output_dir.parent,
        )
    )
    try:
        snapshot_entries: list[dict[str, Any]] = []
        all_repairs: list[dict[str, Any]] = []
        for snapshot in snapshots:
            collection, report = convert_full_snapshot(
                snapshot,
                transformer,
                source_manifest["projection"]["sourceWkt"],
                editorial,
            )
            target = staging / "snapshots" / f"{snapshot.year_month}.geojson"
            payload = write_stable_json(target, collection)
            entry = {
                "yearMonth": snapshot.year_month,
                "snapshotDate": snapshot.supplied_date,
                "status": "primary" if snapshot.year_month <= PRIMARY_END else "limited_static",
                "file": f"snapshots/{snapshot.year_month}.geojson",
                "url": f"/data/historical-administration-full/snapshots/{snapshot.year_month}.geojson",
                "sha256": hashlib.sha256(payload).hexdigest(),
                "bytes": len(payload),
                **{
                    key: value
                    for key, value in report.items()
                    if key != "geometryRepairs"
                },
            }
            snapshot_entries.append(entry)
            print(
                f"Converted full {snapshot.year_month}: {entry['featureCount']} source features",
                flush=True,
            )
            if report["geometryRepairs"]:
                all_repairs.append(
                    {
                        "yearMonth": snapshot.year_month,
                        "features": report["geometryRepairs"],
                    }
                )

        territorial_collection, territorial_report = convert_full_territorial_changes(
            territorial_stem,
            transformer,
            source_manifest["projection"]["sourceWkt"],
        )
        territorial_target = staging / "territorial-changes.geojson"
        territorial_payload = write_stable_json(
            territorial_target,
            territorial_collection,
        )
        operation = transformer.get_last_used_operation()
        full_extent_bbox = [
            min(entry["dataBbox"][0] for entry in snapshot_entries),
            min(entry["dataBbox"][1] for entry in snapshot_entries),
            max(entry["dataBbox"][2] for entry in snapshot_entries),
            max(entry["dataBbox"][3] for entry in snapshot_entries),
        ]

        category_values = sorted(set(FOREIGN_POWER_CATEGORIES.values()))
        legend_values = [item[0] for item in CATEGORY_LEGEND]
        if category_values != sorted(legend_values):
            raise ValueError("Foreign-power category mapping and legend are inconsistent")

        manifest = {
            "schemaVersion": 1,
            "source": {
                "id": source_manifest["sourceId"],
                "title": source_manifest["title"],
                "archiveSha256": source_manifest["archive"]["sha256"],
                "attribution": FULL_EXTENT_ATTRIBUTION,
                "useLimit": source_manifest["useLimit"],
            },
            "projection": {
                "source": SOURCE_CRS,
                "target": TARGET_CRS,
                "coordinateOrder": "longitude, latitude",
                "transformationDescription": operation.description,
                "transformationDefinition": operation.definition,
                "transformationAccuracyMetres": operation.accuracy,
            },
            "processing": {
                "extentMode": "full_source",
                "cropped": False,
                "fullExtentBbox": full_extent_bbox,
                "scope": "Every polygon present in each original monthly shapefile; no regional crop is applied.",
                "simplifyToleranceDegrees": FULL_SIMPLIFY_TOLERANCE_DEGREES,
                "sourceSimplifyToleranceMetres": FULL_SOURCE_SIMPLIFY_TOLERANCE_METRES,
                "coordinateDecimals": COORDINATE_DECIMALS,
                "geometryRepairPolicy": "Invalid geometries are detected, reported and repaired with Shapely make_valid before topology-preserving simplification; source files are unchanged.",
                "geometryRepairs": all_repairs,
                "tools": {
                    "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                    "pyproj": pyproj.__version__,
                    "pyshp": shapefile.__version__,
                    "shapely": shapely.__version__,
                },
            },
            "temporalCoverage": {
                "start": "1938-02",
                "end": "1945-05",
                "primarySupported": {"start": "1938-02", "end": PRIMARY_END},
                "limitedStatic": {
                    "start": "1944-10",
                    "end": "1945-05",
                    "reason": source_manifest["limitedInterval"]["reason"],
                },
                "defaultYearMonth": "1941-08",
            },
            "rawMonthlyAttributes": list(REQUIRED_MONTHLY_FIELDS),
            "derivedForeignPowerVocabulary": {
                "field": "foreignPowerCategory",
                "sourceField": "Foreign_Po",
                "method": "Exact, documented lookup of the unmodified raw Foreign_Po string; this is not an administration-type field.",
                "rawValueMapping": FOREIGN_POWER_CATEGORIES,
                "legend": [
                    {"value": value, "label": label, "color": color}
                    for value, label, color in CATEGORY_LEGEND
                ],
            },
            "presentationVocabulary": {
                "field": "presentationCategory",
                "sourceFields": ["Name", "Foreign_Po"],
                "method": "Public display grouping only. Soviet Union is matched by exact raw Name; Romanian and German occupation groupings use exact listed raw Foreign_Po strings; Neutral and German-allied / Axis-aligned values have distinct public categories; remaining documented state-status values are grouped as sovereign/state territory; every other raw combination remains unresolved/other.",
                "rules": {
                    "sovietControlledExactNames": ["Soviet Union"],
                    "romanianOccupiedExactForeignPowerValues": ["Romanian-occupied"],
                    "germanOccupiedExactForeignPowerValues": sorted(PRESENTATION_GERMAN_RAW_VALUES),
                    "germanAlliedExactForeignPowerValues": sorted(PRESENTATION_GERMAN_ALLIED_RAW_VALUES),
                    "neutralExactForeignPowerValues": ["Neutral"],
                    "sovereignStateExactForeignPowerValues": sorted(PRESENTATION_SOVEREIGN_RAW_VALUES),
                    "fallback": "unresolved_other",
                },
                "legend": [
                    {"value": value, "label": label, "color": color}
                    for value, label, color in PRESENTATION_CATEGORY_LEGEND
                ],
            },
            "methodologicalWarning": METHODOLOGICAL_WARNING,
            "snapshots": snapshot_entries,
            "snapshotByYearMonth": {
                entry["yearMonth"]: entry["file"] for entry in snapshot_entries
            },
            "territorialChanges": {
                "file": "territorial-changes.geojson",
                "url": "/data/historical-administration-full/territorial-changes.geojson",
                "sha256": hashlib.sha256(territorial_payload).hexdigest(),
                "bytes": len(territorial_payload),
                **{
                    key: value
                    for key, value in territorial_report.items()
                    if key != "geometryRepairs"
                },
            },
            "territorialPeriods": territorial_periods,
            "sourceAssertions": source_assertions,
        }
        manifest_payload = write_stable_json(staging / "manifest.json", manifest)
        checksum_lines = [
            f"{entry['sha256']}  {entry['file']}" for entry in snapshot_entries
        ]
        checksum_lines.extend(
            [
                f"{manifest['territorialChanges']['sha256']}  territorial-changes.geojson",
                f"{hashlib.sha256(manifest_payload).hexdigest()}  manifest.json",
            ]
        )
        (staging / "derived.sha256").write_text(
            "\n".join(checksum_lines) + "\n",
            encoding="ascii",
        )
        replace_output(staging, output_dir)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def verify_output(output_dir: Path) -> None:
    manifest = load_json(output_dir / "manifest.json")
    entries = [
        *manifest["snapshots"],
        {
            "file": manifest["territorialChanges"]["file"],
            "sha256": manifest["territorialChanges"]["sha256"],
            "bytes": manifest["territorialChanges"]["bytes"],
        },
    ]
    for entry in entries:
        path = output_dir / entry["file"]
        if not path.is_file():
            raise FileNotFoundError(f"Missing derived file: {path}")
        if path.stat().st_size != entry["bytes"]:
            raise ValueError(f"Derived byte count mismatch: {path}")
        if sha256_file(path) != entry["sha256"]:
            raise ValueError(f"Derived SHA-256 mismatch: {path}")
    checksum_path = output_dir / "derived.sha256"
    expected: dict[str, str] = {}
    for line in checksum_path.read_text(encoding="ascii").splitlines():
        digest, filename = line.split("  ", 1)
        expected[filename] = digest
    for filename, digest in expected.items():
        if sha256_file(output_dir / filename) != digest:
            raise ValueError(f"Checksum file mismatch: {filename}")
    print(f"Verified {len(manifest['snapshots'])} monthly files and Territorial_Changes in {output_dir}")


def update_period_metadata(output_dir: Path, periods: list[dict[str, str]]) -> None:
    """Add source-derived territorial periods without rewriting GeoJSON files."""

    manifest_path = output_dir / "manifest.json"
    manifest = load_json(manifest_path)
    manifest["territorialPeriods"] = periods
    manifest_payload = write_stable_json(manifest_path, manifest)
    checksum_path = output_dir / "derived.sha256"
    lines = [
        line
        for line in checksum_path.read_text(encoding="ascii").splitlines()
        if not line.endswith("  manifest.json")
    ]
    lines.append(f"{hashlib.sha256(manifest_payload).hexdigest()}  manifest.json")
    checksum_path.write_text("\n".join(lines) + "\n", encoding="ascii")


def parse_args() -> argparse.Namespace:
    source_manifest = load_json(SOURCE_MANIFEST)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--archive",
        type=Path,
        default=Path(source_manifest["archive"]["observedLocalPath"]),
        help="Path to EuropeanBorders_WWII.zip",
    )
    parser.add_argument("--external-dir", type=Path, default=DEFAULT_EXTERNAL_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--full-output-dir",
        type=Path,
        default=DEFAULT_FULL_OUTPUT_DIR,
    )
    parser.add_argument(
        "--scope",
        choices=("regional", "full", "all"),
        default="all",
        help="Build or verify the regional derivative, the uncropped full derivative, or both",
    )
    parser.add_argument("--verify-output", action="store_true", help="Verify committed derivatives without reading the source archive")
    parser.add_argument(
        "--update-period-metadata",
        action="store_true",
        help="Update compact source-derived territorial periods without rewriting monthly GeoJSON",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.verify_output:
        if args.scope in ("regional", "all"):
            verify_output(args.output_dir.resolve())
        if args.scope in ("full", "all"):
            verify_output(args.full_output_dir.resolve())
        return
    archive = args.archive.resolve()
    external = args.external_dir.resolve()
    if args.update_period_metadata:
        source_manifest = load_json(SOURCE_MANIFEST)
        verify_archive(archive, source_manifest)
        source_dir = extract_archive(
            archive,
            external,
            source_manifest["archive"]["sha256"],
        )
        periods = historical_territorial_periods(source_dir)
        if args.scope in ("regional", "all"):
            regional_output = args.output_dir.resolve()
            update_period_metadata(regional_output, periods)
            verify_output(regional_output)
        if args.scope in ("full", "all"):
            full_output = args.full_output_dir.resolve()
            update_period_metadata(full_output, periods)
            verify_output(full_output)
        return
    if args.scope in ("regional", "all"):
        regional_output = args.output_dir.resolve()
        build(archive, external, regional_output)
        verify_output(regional_output)
    if args.scope in ("full", "all"):
        full_output = args.full_output_dir.resolve()
        build_full(archive, external, full_output)
        verify_output(full_output)


if __name__ == "__main__":
    main()
