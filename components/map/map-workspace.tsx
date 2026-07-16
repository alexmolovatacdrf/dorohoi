"use client";

import type {
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
  type Marker,
} from "maplibre-gl";
import { presentationMapConfig } from "@/config/presentation-map";
import { useLanguage } from "@/components/shell/language-provider";
import { StatusBadge, confidenceTone } from "@/components/ui/status-badge";
import { formatDateRange, formatIsoDate, humanizeSlug } from "@/lib/data/format";
import type {
  MapPlaceDatum,
  MapPlacePersonConnection,
  MapPlacePersonContext,
  MapPersonStory,
  MapRouteDatum,
  MapViewModel,
} from "@/lib/data/selectors";
import {
  HISTORICAL_CATEGORY_COLORS,
  HISTORICAL_FILL_LAYER_ID,
  HISTORICAL_PRESENTATION_CATEGORY_COLORS,
  HISTORICAL_LINE_LAYER_ID,
  FULL_HISTORICAL_MANIFEST_URL,
  HISTORICAL_MANIFEST_URL,
  HISTORICAL_PRESENTATION_NAME_COLORS,
  HISTORICAL_SOURCE_ID,
  defaultHistoricalSnapshot,
  displayRawHistoricalValue,
  formatYearMonth,
  historicalFeatureCollectionSchema,
  historicalFeaturePropertiesSchema,
  historicalManifestSchema,
  historicalSnapshotFeatureCount,
  historicalSnapshotIndex,
  selectHistoricalSnapshot,
  type HistoricalFeatureCollection,
  type HistoricalFeatureProperties,
  type HistoricalManifest,
} from "@/lib/historical-administration/schemas";
import {
  BASEMAP_LAYER_ID,
  BASEMAP_SOURCE_ID,
  BASEMAP_TILE_HOST,
  createResearchMapStyle,
} from "@/lib/map/style";

interface Filters {
  person: string;
  group: string;
  dossier: string;
  place: string;
  eventType: string;
  confidence: string;
  fromYear: string;
  toYear: string;
}

interface Layers {
  basemap: boolean;
  historicalAdministration: boolean;
  locations: boolean;
  individualRoutes: boolean;
  familyContext: boolean;
  origin: boolean;
  evacuationDeportation: boolean;
  campsGhettos: boolean;
  forcedLabour: boolean;
  death: boolean;
  return: boolean;
  unresolved: boolean;
  localEhri: boolean;
  inferred: boolean;
}

export type MapWorkspaceMode = "research" | "presentation";

type Selection =
  | { kind: "place" | "route"; id: string }
  | { kind: "historical"; properties: HistoricalFeatureProperties }
  | null;
type MapLifecycle = "initializing" | "ready" | "failed";
type BasemapStatus = "loading" | "available" | "unavailable";
type HistoricalLayerStatus = "loading_manifest" | "idle" | "loading_snapshot" | "ready" | "failed";

const emptyPointCollection: FeatureCollection<Point, GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [],
};
const emptyLineCollection: FeatureCollection<LineString, GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [],
};
const emptyHistoricalCollection: FeatureCollection<
  Polygon | MultiPolygon,
  HistoricalFeatureProperties
> = {
  type: "FeatureCollection",
  features: [],
};

function historicalFillColorExpression(
  mode: MapWorkspaceMode,
): ExpressionSpecification {
  if (mode === "presentation") {
    const categoryExpression: ExpressionSpecification = [
      "match",
      ["get", "presentationCategory"],
      "sovereign_state",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.sovereign_state,
      "neutral_state",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.neutral_state,
      "german_allied_state",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.german_allied_state,
      "romanian_occupied",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.romanian_occupied,
      "german_occupied",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.german_occupied,
      "soviet_controlled",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.soviet_controlled,
      "unresolved_other",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.unresolved_other,
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.unresolved_other,
    ];
    return [
      "match",
      ["get", "Name"],
      "Romania",
      HISTORICAL_PRESENTATION_NAME_COLORS.Romania,
      "Hungary",
      HISTORICAL_PRESENTATION_NAME_COLORS.Hungary,
      "Germany",
      HISTORICAL_PRESENTATION_NAME_COLORS.Germany,
      "Bulgaria",
      HISTORICAL_PRESENTATION_NAME_COLORS.Bulgaria,
      "Finland",
      HISTORICAL_PRESENTATION_NAME_COLORS.Finland,
      "Italy",
      HISTORICAL_PRESENTATION_NAME_COLORS.Italy,
      "Slovakia",
      HISTORICAL_PRESENTATION_NAME_COLORS.Slovakia,
      "Vichy France",
      HISTORICAL_PRESENTATION_NAME_COLORS["Vichy France"],
      "Transnistria",
      HISTORICAL_PRESENTATION_NAME_COLORS.Transnistria,
      "Reichskommissariat Ukraine",
      HISTORICAL_PRESENTATION_NAME_COLORS["Reichskommissariat Ukraine"],
      "Soviet Union",
      HISTORICAL_PRESENTATION_NAME_COLORS["Soviet Union"],
      categoryExpression,
    ] as ExpressionSpecification;
  }
  return [
    "match",
    ["get", "foreignPowerCategory"],
    "unclassified",
    HISTORICAL_CATEGORY_COLORS.unclassified,
    "neutral",
    HISTORICAL_CATEGORY_COLORS.neutral,
    "allied",
    HISTORICAL_CATEGORY_COLORS.allied,
    "axis",
    HISTORICAL_CATEGORY_COLORS.axis,
    "axis_aligned",
    HISTORICAL_CATEGORY_COLORS.axis_aligned,
    "belligerent",
    HISTORICAL_CATEGORY_COLORS.belligerent,
    "german_occupied",
    HISTORICAL_CATEGORY_COLORS.german_occupied,
    "italian_occupied",
    HISTORICAL_CATEGORY_COLORS.italian_occupied,
    "romanian_occupied",
    HISTORICAL_CATEGORY_COLORS.romanian_occupied,
    "multinational_axis_occupied",
    HISTORICAL_CATEGORY_COLORS.multinational_axis_occupied,
    "german_soviet_occupied",
    HISTORICAL_CATEGORY_COLORS.german_soviet_occupied,
    "#aea99e",
  ];
}

// The pilot opens on the Romania–Moldavia–Transnistria working area. The
// complete European extent remains available through Europe view.
const PRESENTATION_DEFAULT_BBOX: [number, number, number, number] = [
  20.0,
  43.0,
  32.0,
  50.8,
];

// The historical manifest contains distant islands and territories that are
// valid source features but outside the useful public project view. Keep the
// full data layer intact while giving Europe View a practical camera window
// from Portugal to the western Urals (Ekaterinburg / Perm area).
const PRESENTATION_EUROPE_BBOX: [number, number, number, number] = [
  -11.0,
  35.0,
  62.5,
  72.0,
];

const controlClass =
  "w-full border border-[#c8c3b8] bg-white px-2.5 py-2 text-[11px] text-[#34473f] outline-none focus:border-[#2f6658]";
const basemapFallbackMessage =
  "OpenStreetMap tiles are unavailable. The local research grid, project places, routes, filters and layer controls remain active.";
const ANIMATION_SEGMENT_DURATION_MS = 5600;
type BasemapVariant = "standard" | "light" | "muted";

const basemapVariantLabels: Record<BasemapVariant, string> = {
  standard: "Standard OSM",
  light: "Light OSM",
  muted: "Muted OSM",
};

function historicalDetailLabel(field: "Foreign_Po" | "Head_of_St" | "Govt_in_Ex"): string {
  switch (field) {
    case "Foreign_Po":
      return "Foreign power / authority";
    case "Head_of_St":
      return "Head of state / authority";
    case "Govt_in_Ex":
      return "Government in exile";
  }
}

function LayerToggle({
  label,
  checked,
  onChange,
  marker,
  disabled = false,
  note,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  marker: string;
  disabled?: boolean;
  note?: string;
}) {
  const presentationMarker = ["historical", "basemap", "places", "routes", "ehri", "unresolved"].includes(marker);
  return (
    <label className={`flex items-start gap-2.5 py-1.5 text-[10px] leading-4 ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer text-[#44534d]"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} className="mt-0.5 accent-[#2f6658]" />
      <span aria-hidden="true" className={presentationMarker ? `presentation-layer-marker presentation-layer-marker--${marker}` : "w-4 text-center font-bold text-[#9c5b3e]"}>{presentationMarker && marker === "unresolved" ? "?" : presentationMarker && marker === "routes" ? "→" : presentationMarker ? null : marker}</span>
      <span>{label}{note ? <small className="block text-[8px] text-[#838b87]">{note}</small> : null}</span>
    </label>
  );
}

function yearFromDate(value: string | null): number | null {
  return value ? Number.parseInt(value.slice(0, 4), 10) : null;
}

function errorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (typeof error === "object" && error !== null && "url" in error) {
    const url = String(error.url);
    return message.includes(url) ? message : `${message} (${url})`;
  }
  return message;
}

function historicalPopupContent(
  properties: HistoricalFeatureProperties,
  language: "en" | "ro",
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "historical-map-popup";

  const dateLabel = document.createElement("p");
  dateLabel.className = "historical-map-popup__date";
  dateLabel.textContent = `${formatYearMonth(properties.yearMonth, language)} · supplied ${formatIsoDate(properties.snapshotDate, language)}`;

  const name = document.createElement("p");
  name.className = "historical-map-popup__name";
  name.textContent = historicalMapLabel(properties);

  root.append(name, dateLabel);
  for (const [field, value] of [
    ["Foreign_Po", properties.Foreign_Po],
    ["Head_of_St", properties.Head_of_St],
    ["Govt_in_Ex", properties.Govt_in_Ex],
  ] as const) {
    if (!hasHistoricalSourceValue(value)) continue;
    root.append(popupTextElement(
      "p",
      `${historicalDetailLabel(field)}: ${value}`,
      "historical-map-popup__detail",
    ));
  }
  return root;
}

function historicalPropertiesFromRenderedFeature(
  properties: GeoJsonProperties,
): HistoricalFeatureProperties | null {
  if (!properties) return null;
  let editorialFlagIds: unknown = properties.editorialFlagIds;
  if (typeof editorialFlagIds === "string") {
    try {
      editorialFlagIds = JSON.parse(editorialFlagIds);
    } catch {
      editorialFlagIds = [];
    }
  }
  const parsed = historicalFeaturePropertiesSchema.safeParse({
    ...properties,
    editorialFlagIds,
    sourceFeatureIndex: Number(properties.sourceFeatureIndex),
  });
  return parsed.success ? parsed.data : null;
}

function historicalMapLabel(properties: HistoricalFeatureProperties): string {
  return displayRawHistoricalValue(properties.Name) === "Transnistria"
    ? "Government of Transnistria"
    : displayRawHistoricalValue(properties.Name);
}

function hasHistoricalSourceValue(value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase("en");
  return Boolean(normalized) && normalized !== "<null>" && normalized !== "null";
}

function historicalLabelOffset(name: string): [number, number] {
  if (name === "Romania") return [0, -1.15];
  return [0, 0];
}

// The historical source polygons for these countries include distant islands,
// so a bounding-box centre would place their names over the sea. These anchors
// follow the mainland/territory label positions used by ordinary map labels.
const historicalLabelPositionOverrides: Record<string, [number, number]> = {
  Portugal: [-8.281, 39.557],
  Spain: [-3.475, 39.888],
  Malta: [14.419, 35.898],
  // Same longitude as the previous placement; only move the title lower.
  Transnistria: [30.84, 47.5],
};

function ringAreaAndCentroid(ring: Array<[number, number]>): {
  area: number;
  centroid: [number, number];
} {
  let twiceArea = 0;
  let longitudeSum = 0;
  let latitudeSum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitude, latitude] = ring[index] ?? [0, 0];
    const [nextLongitude, nextLatitude] = ring[index + 1] ?? [longitude, latitude];
    const cross = longitude * nextLatitude - nextLongitude * latitude;
    twiceArea += cross;
    longitudeSum += (longitude + nextLongitude) * cross;
    latitudeSum += (latitude + nextLatitude) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) {
    const [longitude, latitude] = ring[0] ?? [0, 0];
    return { area: 0, centroid: [longitude, latitude] };
  }
  return {
    area: Math.abs(twiceArea) / 2,
    centroid: [longitudeSum / (3 * twiceArea), latitudeSum / (3 * twiceArea)],
  };
}

function historicalFeatureLabelCoordinate(
  feature: HistoricalFeatureCollection["features"][number],
): [number, number] | null {
  const override = historicalLabelPositionOverrides[feature.properties.Name];
  if (override) return override;
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  const candidates = polygons
    .map((polygon) => ringAreaAndCentroid(polygon[0] ?? []))
    .sort((left, right) => right.area - left.area);
  const center = candidates[0]?.centroid;
  if (!center) return null;
  const [longitudeOffset, latitudeOffset] = historicalLabelOffset(feature.properties.Name);
  return [center[0] + longitudeOffset, center[1] + latitudeOffset];
}

function hasWebGl2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function placeSymbol(place: MapPlaceDatum): string {
  if (place.categories.includes("death")) return "✦";
  if (place.categories.includes("forced_labour")) return "✚";
  if (place.categories.includes("evacuation_deportation")) return "◆";
  if (place.categories.includes("origin")) return "●";
  if (place.placeType === "river") return "≈";
  return "●";
}

function placeColor(place: MapPlaceDatum): string {
  if (place.layer === "ehri_local") return "#355b67";
  if (place.categories.includes("death")) return "#8d352c";
  if (place.categories.includes("forced_labour")) return "#7a5a2e";
  if (place.categories.includes("evacuation_deportation")) return "#a54f32";
  if (place.categories.includes("origin")) return "#b9883b";
  return "#236353";
}

function placeMarkerSymbol(place: MapPlaceDatum): string {
  if (place.layer === "ehri_local") return place.placeType === "camp" ? "▣" : "◆";
  return placeSymbol(place);
}

function mapLabelOffset(placeId: string): [number, number] {
  const offsets: Record<string, [number, number]> = {
    "PL-CORE-MIHAILENI": [-36, -6],
    "PL-CORE-DOROHOI": [36, -18],
    "PL-CORE-BUCECEA": [44, 14],
    "PL-CORE-MOHYLIV-PODILSKYI": [-82, -30],
    "PL-CORE-OTACI": [58, 9],
  };
  return offsets[placeId] ?? [0, 0];
}

function routeArrow(color: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 18;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  context.beginPath();
  context.moveTo(3, 3);
  context.lineTo(20, 9);
  context.lineTo(3, 15);
  context.closePath();
  context.lineWidth = 3;
  context.strokeStyle = "#fffdf8";
  context.stroke();
  context.fillStyle = color;
  context.fill();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function routeEndpointPairKey(route: MapRouteDatum): string {
  return [route.originId, route.destinationId].sort().join("::");
}

function routeCurveOffset(route: MapRouteDatum, routes: MapRouteDatum[]): number {
  // Darabani is close to Dorohoi. A stronger southward presentation bend
  // keeps the documented Darabani → Târgu Jiu segment visually separate from
  // the Dorohoi marker without changing either endpoint.
  if (route.originName === "Darabani" && route.destinationName === "Târgu Jiu") return 2.2;
  const siblings = routes
    .filter((candidate) => routeEndpointPairKey(candidate) === routeEndpointPairKey(route))
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  const sameDirection = siblings.filter(
    (candidate) => candidate.originId === route.originId && candidate.destinationId === route.destinationId,
  );
  const occurrence = Math.max(0, sameDirection.indexOf(route));
  const magnitude = 0.72 + Math.floor(occurrence / 2) * 0.52;
  // Reverse movements use the same signed offset as their corresponding
  // forward movement. Their geometric normal is reversed, which places them
  // on the opposite physical side of the visual corridor.
  return occurrence % 2 === 0 ? magnitude : -magnitude;
}

function curvedRouteCoordinates(
  route: MapRouteDatum,
  curveOffset = route.sequence % 2 === 0 ? -0.5 : 0.5,
): Array<[number, number]> {
  const [[startLongitude, startLatitude], [endLongitude, endLatitude]] = route.coordinates;
  const deltaLongitude = endLongitude - startLongitude;
  const deltaLatitude = endLatitude - startLatitude;
  const distance = Math.hypot(deltaLongitude, deltaLatitude) || 1;
  const normalLongitude = -deltaLatitude / distance;
  const normalLatitude = deltaLongitude / distance;
  const bend = Math.min(2.4, Math.max(0.25, distance * 0.12)) * curveOffset;
  const controlLongitude = (startLongitude + endLongitude) / 2 + normalLongitude * bend;
  const controlLatitude = (startLatitude + endLatitude) / 2 + normalLatitude * bend;
  const points: Array<[number, number]> = [];

  for (let index = 0; index <= 24; index += 1) {
    const t = index / 24;
    const inverse = 1 - t;
    points.push([
      inverse * inverse * startLongitude + 2 * inverse * t * controlLongitude + t * t * endLongitude,
      inverse * inverse * startLatitude + 2 * inverse * t * controlLatitude + t * t * endLatitude,
    ]);
  }

  // The curve is a presentation aid between documented endpoints, not a claim
  // about the exact historical road or railway line.
  points[0] = [startLongitude, startLatitude];
  points[points.length - 1] = [endLongitude, endLatitude];
  return points;
}

function routePointAtProgress(points: Array<[number, number]>, progress: number): [number, number] {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const position = boundedProgress * (points.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(points.length - 1, lowerIndex + 1);
  const remainder = position - lowerIndex;
  const lower = points[lowerIndex] ?? points[0];
  const upper = points[upperIndex] ?? lower;
  return [
    lower[0] + (upper[0] - lower[0]) * remainder,
    lower[1] + (upper[1] - lower[1]) * remainder,
  ];
}

function easeInOutCubic(progress: number): number {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  return boundedProgress < 0.5
    ? 4 * boundedProgress * boundedProgress * boundedProgress
    : 1 - Math.pow(-2 * boundedProgress + 2, 3) / 2;
}

function routeCollection(
  routes: MapRouteDatum[],
  partialRouteId: string | null = null,
  partialProgress = 1,
  usePresentationCurves = true,
  curveRoutes: MapRouteDatum[] = routes,
): FeatureCollection<LineString, GeoJsonProperties> {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => {
      const coordinates = usePresentationCurves
        ? curvedRouteCoordinates(route, routeCurveOffset(route, curveRoutes))
        : route.coordinates;
      const visibleCoordinates = route.id === partialRouteId
        ? coordinates.slice(0, Math.max(2, Math.ceil(easeInOutCubic(partialProgress) * (coordinates.length - 1)) + 1))
        : coordinates;
      return {
        type: "Feature",
        id: route.id,
        geometry: { type: "LineString", coordinates: visibleCoordinates },
        properties: {
          id: route.id,
          label: `${route.originName} → ${route.destinationName}`,
          personId: route.personId,
          personName: route.personName,
          routeStatus: route.routeStatus,
          confidence: route.confidence,
        },
      };
    }),
  };
}

function routeProgressCollection(
  route: MapRouteDatum | null,
  progress: number,
  routes: MapRouteDatum[] = route ? [route] : [],
): FeatureCollection<Point, GeoJsonProperties> {
  if (!route) return emptyPointCollection;
  const path = curvedRouteCoordinates(route, routeCurveOffset(route, routes));
  const easedProgress = easeInOutCubic(progress);
  const point = routePointAtProgress(path, easedProgress);
  const before = routePointAtProgress(path, Math.max(0, easedProgress - 0.025));
  const after = routePointAtProgress(path, Math.min(1, easedProgress + 0.025));
  // The arrow image points east at 0°. MapLibre rotates icons clockwise, so
  // invert the geographic latitude delta to keep the tip aligned with travel.
  const angle = -Math.atan2(after[1] - before[1], after[0] - before[0]) * (180 / Math.PI);
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      id: `progress-${route.id}`,
      geometry: {
        type: "Point",
        coordinates: point,
      },
      properties: {
        color: "#236353",
        routeStatus: route.routeStatus,
        angle,
      },
    }],
  };
}

function pointCollection(places: MapPlaceDatum[], language: "en" | "ro"): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: "FeatureCollection",
    features: places.flatMap((place) => {
      if (!place.coordinates) return [];
      return [
        {
          type: "Feature" as const,
          id: place.id,
          geometry: {
            type: "Point" as const,
            coordinates: [place.coordinates.longitude, place.coordinates.latitude],
          },
          properties: {
            id: place.id,
            label: language === "ro" ? place.labelRo : place.label,
            placeType: place.placeType,
            layer: place.layer,
            confidence: place.confidence,
            symbol: place.layer === "ehri_local" ? (place.placeType === "camp" ? "▲" : "■") : placeSymbol(place),
            color: placeColor(place),
          },
        },
      ];
    }),
  };
}

function boundsFromCoordinates(
  coordinates: Array<[number, number]>,
): [number, number, number, number] | null {
  if (!coordinates.length) return null;
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

function expandBbox(
  bbox: [number, number, number, number],
  minimumLongitudeSpan = 0.18,
  minimumLatitudeSpan = 0.12,
): [number, number, number, number] {
  const longitudeSpan = Math.max(minimumLongitudeSpan, bbox[2] - bbox[0]);
  const latitudeSpan = Math.max(minimumLatitudeSpan, bbox[3] - bbox[1]);
  const longitudeCenter = (bbox[0] + bbox[2]) / 2;
  const latitudeCenter = (bbox[1] + bbox[3]) / 2;
  return [
    longitudeCenter - longitudeSpan / 2,
    latitudeCenter - latitudeSpan / 2,
    longitudeCenter + longitudeSpan / 2,
    latitudeCenter + latitudeSpan / 2,
  ];
}

function publicPlaceCategoryLabel(category: MapPlaceDatum["categories"][number]): string {
  switch (category) {
    case "origin":
      return "Birth, origin or residence";
    case "evacuation_deportation":
      return "Evacuation or deportation";
    case "forced_labour":
      return "Forced labour";
    case "death":
      return "Death or loss";
    case "return":
      return "Return or repatriation";
    default:
      return "Documented connection";
  }
}

function publicPlaceContextLabel(context: MapPlacePersonContext): string {
  return publicPlaceContextLabelForValues(context.roles, context.eventTypes);
}

function publicPlaceContextLabelForValues(roles: string[], eventTypes: string[]): string {
  const value = [...roles, ...eventTypes].join(" ").toLocaleLowerCase("ro");
  if (/deces|death|mort|loss/.test(value)) return "Death or loss";
  if (/lagar|lagăr|ghetou|ghetto|camp|intern/.test(value)) return "Camp, ghetto or internment";
  if (/munca|muncă|forced|work/.test(value)) return "Forced labour";
  if (/deport|evac/.test(value)) return "Evacuation or deportation";
  if (/intoarc|întoarc|return|repatri/.test(value)) return "Return or repatriation";
  if (/route origin|route destination/.test(value)) return "Movement / route endpoint";
  if (/nastere|naștere|birth|origin|domiciliu|residence|locuire/.test(value)) return "Birth, origin or residence";
  return "Other documented connection";
}

function publicPlaceConnectionLabel(connection: MapPlacePersonConnection): string {
  return publicPlaceContextLabelForValues(connection.roles, connection.eventTypes);
}

function mapRouteDateLabel(route: MapRouteDatum, language: "en" | "ro"): string {
  return formatDateRange({
    raw: route.dateRaw,
    start: route.dateStart,
    end: route.dateEnd,
    precision: route.datePrecision ?? "unknown",
  }, language);
}

function popupTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function personPlacePopupContent(
  place: MapPlaceDatum,
  language: "en" | "ro",
  selectedPerson: { label: string } | null,
  context: MapPlacePersonContext | null,
  peopleGroups: Array<{ label: string; people: Array<{ id: string; label: string }> }>,
  onPersonSelect: (personId: string) => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "map-place-popup";
  root.append(
    popupTextElement("p", "Place context", "map-place-popup__eyebrow"),
    popupTextElement("h3", language === "ro" ? place.labelRo : place.label, "map-place-popup__title"),
  );

  if (selectedPerson) {
    root.append(popupTextElement("p", selectedPerson.label, "map-place-popup__person"));
    if (context?.connections.length) {
      const connections = document.createElement("div");
      connections.className = "map-place-popup__connections";
      for (const connection of context.connections) {
        const item = document.createElement("div");
        item.className = "map-place-popup__connection";
        const heading = document.createElement("div");
        heading.className = "map-place-popup__connection-heading";
        heading.append(
          popupTextElement("strong", publicPlaceConnectionLabel(connection)),
          popupTextElement("span", connection.date ? formatDateRange(connection.date, language) : "Date not supplied"),
        );
        item.append(heading);
        if (connection.description) item.append(popupTextElement("p", connection.description));
        connections.append(item);
      }
      root.append(connections);
    } else {
      root.append(popupTextElement("p", "No direct documented person-place connection in the current evidence.", "map-place-popup__muted"));
    }
  } else {
    root.append(popupTextElement(
      "p",
      place.categories.length
        ? place.categories.map(publicPlaceCategoryLabel).join(" · ")
        : "Documented place in the current collection",
      "map-place-popup__muted",
    ));
    const peopleCount = peopleGroups.reduce((total, group) => total + group.people.length, 0);
    if (peopleCount) {
      root.append(popupTextElement(
        "p",
        `${peopleCount} ${peopleCount === 1 ? "person" : "people"} connected to this place`,
        "map-place-popup__people-count",
      ));
      const people = document.createElement("div");
      people.className = "map-place-popup__people";
      for (const group of peopleGroups) {
        const groupLabel = popupTextElement("p", group.label, "map-place-popup__people-group");
        people.append(groupLabel);
        for (const person of group.people) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-place-popup__person-button";
          button.textContent = person.label;
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            onPersonSelect(person.id);
          });
          people.append(button);
        }
      }
      root.append(people);
    }
  }

  return root;
}

export function MapWorkspace({
  data,
  mode = "research",
  dataSource,
  initialPerson = "",
  initialPlace = "",
}: {
  data: MapViewModel;
  mode?: MapWorkspaceMode;
  dataSource?: {
    label: string;
    description: string;
    sourceFile: string | null;
    supportsResearchRecords?: boolean;
  };
  initialPerson?: string;
  initialPlace?: string;
}) {
  const isPresentation = mode === "presentation";
  const { language: selectedLanguage, t } = useLanguage();
  // The pilot is English-only. Research Map still follows the user's global
  // language preference.
  const language = isPresentation ? "en" : selectedLanguage;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const coreMarkersRef = useRef<Marker[]>([]);
  const historicalLabelMarkersRef = useRef<Marker[]>([]);
  const historicalPopupRef = useRef<maplibregl.Popup | null>(null);
  const placePopupRef = useRef<maplibregl.Popup | null>(null);
  const languageRef = useRef(language);
  const selectionRef = useRef<Selection>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLifecycle, setMapLifecycle] = useState<MapLifecycle>("initializing");
  const [mapDiagnostic, setMapDiagnostic] = useState<string | null>(null);
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("loading");
  const [historicalManifest, setHistoricalManifest] = useState<HistoricalManifest | null>(null);
  const [historicalYearMonth, setHistoricalYearMonth] = useState("1941-08");
  const [historicalOpacity, setHistoricalOpacity] = useState(0.18);
  const [basemapVariant, setBasemapVariant] = useState<BasemapVariant>("standard");
  const [historicalLayerStatus, setHistoricalLayerStatus] = useState<HistoricalLayerStatus>("loading_manifest");
  const [historicalDiagnostic, setHistoricalDiagnostic] = useState<string | null>(null);
  const [historicalFeatureCount, setHistoricalFeatureCount] = useState(0);
  const [historicalReloadToken, setHistoricalReloadToken] = useState(0);
  const [historicalSnapshotReloadToken, setHistoricalSnapshotReloadToken] = useState(0);
  const [presentationPanelOpen, setPresentationPanelOpen] = useState(false);
  const [presentationPeoplePanelOpen, setPresentationPeoplePanelOpen] = useState(true);
  const [presentationTimelineOpen, setPresentationTimelineOpen] = useState(true);
  const presentationPanelOpenRef = useRef(presentationPanelOpen);
  const presentationPeoplePanelOpenRef = useRef(presentationPeoplePanelOpen);
  const [presentationOpenFamilyId, setPresentationOpenFamilyId] = useState<string | null>(null);
  const [presentationViewport, setPresentationViewport] = useState<"europe" | "project" | "story">(
    initialPerson ? "story" : "project",
  );
  const [presentationPersonQuery, setPresentationPersonQuery] = useState("");
  const [interfaceHidden, setInterfaceHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selection, setSelection] = useState<Selection>(
    initialPlace ? { kind: "place", id: initialPlace } : null,
  );
  const [filters, setFilters] = useState<Filters>({
    person: data.persons.some((person) => person.id === initialPerson) ? initialPerson : "",
    group: "",
    dossier: "",
    place: data.places.some((place) => place.id === initialPlace) ? initialPlace : "",
    eventType: "",
    confidence: "",
    fromYear: "",
    toYear: "",
  });
  const [layers, setLayers] = useState<Layers>(() => ({
    basemap: true,
    historicalAdministration: isPresentation,
    locations: true,
    individualRoutes: true,
    familyContext: !isPresentation,
    origin: true,
    evacuationDeportation: true,
    campsGhettos: true,
    forcedLabour: true,
    death: true,
    return: true,
    unresolved: !isPresentation,
    localEhri: false,
    inferred: isPresentation,
  }));
  const [timelineStep, setTimelineStep] = useState<number | null>(null);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const [storyPersonId, setStoryPersonId] = useState<string | null>(null);

  // Camera-fitting callbacks must remain stable when an overlay panel opens or
  // closes. Otherwise the selection effects below interpret a layout change as
  // a new selection and reset the user's manually chosen camera.
  useEffect(() => {
    presentationPanelOpenRef.current = presentationPanelOpen;
    presentationPeoplePanelOpenRef.current = presentationPeoplePanelOpen;
    isPlayingRef.current = isPlaying;
  }, [isPlaying, presentationPanelOpen, presentationPeoplePanelOpen]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    if (!isPresentation) return;
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isPresentation]);

  useEffect(() => {
    if (!isPresentation || typeof window === "undefined" || window.innerWidth >= 720) return;
    const frame = window.requestAnimationFrame(() => setPresentationPeoplePanelOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isPresentation]);

  useEffect(() => {
    if (!isPresentation) return;
    document.body.classList.toggle("presentation-interface-hidden", interfaceHidden);
    return () => document.body.classList.remove("presentation-interface-hidden");
  }, [interfaceHidden, isPresentation]);

  const selectedGroup = data.groups.find((group) => group.id === filters.group);
  const selectedPerson = data.persons.find((person) => person.id === filters.person);
  const storyPerson = storyPersonId
    ? data.persons.find((person) => person.id === storyPersonId) ?? null
    : null;
  const story = storyPerson?.story ?? null;
  const storyFamily = storyPerson
    ? data.groups.find((group) => group.personIds.includes(storyPerson.id)) ?? null
    : null;
  const selectedPersonDossierMembers = useMemo(
    () => selectedPerson
      ? data.persons.filter((person) => person.dossierId === selectedPerson.dossierId && person.id !== selectedPerson.id)
      : [],
    [data.persons, selectedPerson],
  );
  const selectedPersonDossier = useMemo(
    () => selectedPerson?.dossierId
      ? data.dossiers.find((dossier) => dossier.id === selectedPerson.dossierId) ?? null
      : null,
    [data.dossiers, selectedPerson],
  );
  const selectedPersonRoutes = useMemo(
    () => data.routes.filter((route) => route.personId === filters.person).sort((left, right) => left.sequence - right.sequence),
    [data.routes, filters.person],
  );
  const selectedGroupRoutes = useMemo(
    () => selectedGroup
      ? data.routes.filter((route) => selectedGroup.personIds.includes(route.personId))
      : [],
    [data.routes, selectedGroup],
  );
  const selectedHistoricalSnapshot = useMemo(
    () => historicalManifest
      ? selectHistoricalSnapshot(historicalManifest, historicalYearMonth)
      : null,
    [historicalManifest, historicalYearMonth],
  );
  const selectedHistoricalIndex = useMemo(
    () => historicalManifest
      ? historicalSnapshotIndex(historicalManifest, historicalYearMonth)
      : 0,
    [historicalManifest, historicalYearMonth],
  );

  const matchesYear = (years: number[]): boolean => {
    const from = filters.fromYear ? Number(filters.fromYear) : null;
    const to = filters.toYear ? Number(filters.toYear) : null;
    if (from === null && to === null) return true;
    if (!years.length) return false;
    return years.some((year) => (from === null || year >= from) && (to === null || year <= to));
  };

  const matchesPeople = (personIds: string[]): boolean => {
    if (filters.person && !personIds.includes(filters.person)) return false;
    if (selectedGroup && !personIds.some((personId) => selectedGroup.personIds.includes(personId))) return false;
    return true;
  };

  const categoryVisible = (place: MapPlaceDatum): boolean => {
    if (!place.categories.length) return true;
    return place.categories.some((category) => {
      if (category === "origin") return layers.origin;
      if (category === "evacuation_deportation") return layers.evacuationDeportation;
      if (category === "forced_labour") return layers.forcedLabour;
      if (category === "death") return layers.death;
      return layers.return;
    });
  };

  const visibleCorePlaces = useMemo(
    () =>
      data.places.filter((place) => {
        if (place.layer === "ehri_local" || !place.coordinates || !layers.locations) return false;
        if (filters.place && place.id !== filters.place) return false;
        if (filters.dossier && !place.dossierIds.includes(filters.dossier)) return false;
        if (filters.eventType && !place.eventTypes.includes(filters.eventType)) return false;
        if (filters.confidence && place.confidence !== filters.confidence) return false;
        if (!matchesPeople(place.personIds)) return false;
        if (!matchesYear(place.years)) return false;
        if ((place.placeType === "camp" || place.placeType === "ghetto") && !layers.campsGhettos) return false;
        return categoryVisible(place);
      }),
    // The filter object is intentionally expanded through its scalar dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.places, filters.person, filters.group, filters.place, filters.dossier, filters.eventType, filters.confidence, filters.fromYear, filters.toYear, layers],
  );

  const preTimelineRoutes = useMemo(
    () =>
      data.routes.filter((route) => {
        if (!layers.individualRoutes) return false;
        if (route.routeStatus === "inferred" && !layers.inferred) return false;
        if (filters.person && route.personId !== filters.person) return false;
        if (selectedGroup && !selectedGroup.personIds.includes(route.personId)) return false;
        if (filters.dossier && route.dossierId !== filters.dossier) return false;
        if (filters.place && route.originId !== filters.place && route.destinationId !== filters.place) return false;
        if (filters.eventType && !route.eventTypes.includes(filters.eventType)) return false;
        if (filters.confidence && route.confidence !== filters.confidence) return false;
        const routeYears = [yearFromDate(route.dateStart), yearFromDate(route.dateEnd)].filter((year): year is number => year !== null);
        return matchesYear(routeYears);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.routes, filters, layers.individualRoutes, layers.inferred, selectedGroup],
  );

  const activePlaybackRoute = useMemo(() => {
    if (!filters.person || timelineStep === null) return null;
    return selectedPersonRoutes[timelineStep ?? 0] ?? null;
  }, [filters.person, selectedPersonRoutes, timelineStep]);

  const visibleRoutes = useMemo(() => {
    if (!filters.person || timelineStep === null) return preTimelineRoutes;
    const completedRouteIds = new Set(selectedPersonRoutes.slice(0, timelineStep ?? 0).map((route) => route.id));
    return preTimelineRoutes.filter((route) => completedRouteIds.has(route.id) || route.id === activePlaybackRoute?.id);
  }, [activePlaybackRoute?.id, filters.person, preTimelineRoutes, selectedPersonRoutes, timelineStep]);

  const routeEndpointPlaceIds = useMemo(
    () => new Set(visibleRoutes.flatMap((route) => [route.originId, route.destinationId])),
    [visibleRoutes],
  );

  const visibleEhriPlaces = useMemo(
    () =>
      data.places.filter((place) => {
        if (place.layer !== "ehri_local" || !place.coordinates || !layers.campsGhettos) return false;
        if (filters.place && place.id !== filters.place) return false;
        if (filters.confidence && place.confidence !== filters.confidence) return false;
        // A route endpoint remains visible and labelled even when the wider
        // EHRI overlay is collapsed/off; otherwise intermediary camps vanish
        // from the very route the visitor is inspecting.
        return layers.localEhri || routeEndpointPlaceIds.has(place.id);
      }),
    [data.places, filters.confidence, filters.place, layers.campsGhettos, layers.localEhri, routeEndpointPlaceIds],
  );

  const familyContextPlaces = useMemo(() => {
    if (!selectedGroup || !layers.familyContext) return [];
    return data.places.filter(
      (place) =>
        place.layer !== "ehri_local" &&
        place.coordinates &&
        place.personIds.some((personId) => selectedGroup.personIds.includes(personId)),
    );
  }, [data.places, layers.familyContext, selectedGroup]);

  const visibleUnresolved = useMemo(
    () =>
      layers.unresolved
        ? data.unresolvedMentions.filter((mention) => {
            if (filters.person && !mention.personIds.includes(filters.person)) return false;
            if (selectedGroup && !mention.personIds.some((id) => selectedGroup.personIds.includes(id))) return false;
            if (filters.dossier && mention.dossierId !== filters.dossier) return false;
            return true;
          })
        : [],
    [data.unresolvedMentions, filters.dossier, filters.person, layers.unresolved, selectedGroup],
  );

  useEffect(() => {
    const controller = new AbortController();
    window.queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setHistoricalLayerStatus("loading_manifest");
      setHistoricalDiagnostic(null);
    });

    const loadManifest = async () => {
      try {
        const response = await fetch(
          isPresentation ? FULL_HISTORICAL_MANIFEST_URL : HISTORICAL_MANIFEST_URL,
          {
          signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`Manifest request failed with HTTP ${response.status}`);
        }
        const parsed = historicalManifestSchema.parse(await response.json());
        const initialSnapshot = defaultHistoricalSnapshot(parsed);
        setHistoricalManifest(parsed);
        setHistoricalYearMonth(initialSnapshot.yearMonth);
        setHistoricalLayerStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        setHistoricalManifest(null);
        setHistoricalFeatureCount(0);
        setHistoricalLayerStatus("failed");
        setHistoricalDiagnostic(
          `Historical layer manifest could not be loaded: ${errorDetails(error)}`,
        );
      }
    };

    void loadManifest();
    return () => controller.abort();
  }, [historicalReloadToken, isPresentation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let activeMap: MapLibreMap | null = null;
    let basemapFailed = false;
    let disposed = false;
    let projectLayersRegistered = false;
    let basemapTimer: number | undefined;
    let styleTimer: number | undefined;

    try {
      if (!hasWebGl2()) {
        throw new Error("WebGL 2 is unavailable or disabled in this browser.");
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: createResearchMapStyle(isPresentation),
        center: isPresentation ? [26.5, 47.2] : [27.25, 48.08],
        zoom: isPresentation ? 5.2 : 6.1,
        attributionControl: false,
        fadeDuration: 0,
      });
      activeMap = map;
      mapRef.current = map;
      // The compass/pitch button is not useful for this 2D public atlas and
      // reads as a persistent arrow menu over the map. Keep only zoom controls.
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      // A compact attribution button becomes an unexplained hover menu. Keep
      // attribution visible as ordinary text on the research map, while the
      // presentation panel carries its own full source attribution.
      if (!isPresentation) map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");

      map.on("error", (event) => {
        if (disposed) return;
        const details = errorDetails(event.error);
        if (
          details.includes(BASEMAP_TILE_HOST) ||
          details.toLowerCase().includes("failed to fetch")
        ) {
          basemapFailed = true;
          if (basemapTimer !== undefined) window.clearTimeout(basemapTimer);
          setBasemapStatus("unavailable");
          setMapDiagnostic(basemapFallbackMessage);
          return;
        }
        setMapDiagnostic(`MapLibre reported an error: ${details}`);
      });

      map.on("sourcedata", (event) => {
        if (
          disposed ||
          basemapFailed ||
          event.sourceId !== BASEMAP_SOURCE_ID ||
          !event.isSourceLoaded
        ) return;
        if (basemapTimer !== undefined) window.clearTimeout(basemapTimer);
        setBasemapStatus("available");
        setMapDiagnostic((current) => current === basemapFallbackMessage ? null : current);
      });

      const initializeProjectLayers = () => {
        if (disposed || projectLayersRegistered) return;
        projectLayersRegistered = true;
        try {
          map.addSource(HISTORICAL_SOURCE_ID, {
            type: "geojson",
            data: emptyHistoricalCollection,
          });
          map.addSource("research-places", { type: "geojson", data: emptyPointCollection });
          map.addSource("ehri-places", { type: "geojson", data: emptyPointCollection });
          map.addSource("family-places", { type: "geojson", data: emptyPointCollection });
          map.addSource("research-routes", { type: "geojson", data: emptyLineCollection });
          map.addSource("route-progress", { type: "geojson", data: emptyPointCollection });

          map.addLayer({
            id: HISTORICAL_FILL_LAYER_ID,
            type: "fill",
            source: HISTORICAL_SOURCE_ID,
            layout: { visibility: "none" },
            paint: {
              "fill-color": historicalFillColorExpression(mode),
              "fill-opacity": 0.48,
            },
          });
          map.addLayer({
            id: HISTORICAL_LINE_LAYER_ID,
            type: "line",
            source: HISTORICAL_SOURCE_ID,
            layout: { visibility: "none" },
            paint: {
              "line-color": "#3f403d",
              "line-opacity": 0.9,
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 8, 1.8, 11, 2.4],
            },
          });
          map.addLayer({
            id: "routes-explicit",
            type: "line",
            source: "research-routes",
            filter: ["==", ["get", "routeStatus"], "explicit"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#236353", "line-width": 4, "line-opacity": 0.9 },
          });
          map.addLayer({
            id: "routes-partial",
            type: "line",
            source: "research-routes",
            filter: ["==", ["get", "routeStatus"], "partial"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#236353", "line-width": 4, "line-opacity": 0.9 },
          });
          map.addLayer({
            id: "routes-inferred",
            type: "line",
            source: "research-routes",
            filter: ["==", ["get", "routeStatus"], "inferred"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#236353", "line-width": 4, "line-opacity": 0.9 },
          });
          map.addImage("route-arrow-explicit", routeArrow("#236353"));
          map.addImage("route-arrow-partial", routeArrow("#236353"));
          map.addImage("route-arrow-inferred", routeArrow("#236353"));
          map.addImage("route-progress-arrow-explicit", routeArrow("#236353"));
          map.addImage("route-progress-arrow-partial", routeArrow("#236353"));
          map.addImage("route-progress-arrow-inferred", routeArrow("#236353"));

          map.addLayer({
            id: "route-direction",
            type: "symbol",
            source: "research-routes",
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 110,
              "icon-image": [
                "match",
                ["get", "routeStatus"],
                "partial",
                "route-arrow-partial",
                "inferred",
                "route-arrow-inferred",
                "route-arrow-explicit",
              ],
              "icon-size": 0.66,
              "icon-rotation-alignment": "map",
              "icon-keep-upright": false,
              "icon-allow-overlap": true,
            },
          });
          map.addLayer({
            id: "route-progress-arrow",
            type: "symbol",
            source: "route-progress",
            layout: {
              "icon-image": [
                "match",
                ["get", "routeStatus"],
                "partial",
                "route-progress-arrow-partial",
                "inferred",
                "route-progress-arrow-inferred",
                "route-progress-arrow-explicit",
              ],
              "icon-size": 0.92,
              "icon-rotate": ["get", "angle"],
              "icon-rotation-alignment": "map",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });

          map.addLayer({
            id: "family-context-rings",
            type: "circle",
            source: "family-places",
            paint: {
              "circle-radius": 18,
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#b9883b",
              "circle-stroke-opacity": 0.8,
            },
          });
          // All project and EHRI places use the same DOM marker system below.
          // This keeps every route endpoint readable and avoids two competing
          // label designs for the same journey.
          const placeLayers: string[] = [];
          const routeLayers = ["routes-explicit", "routes-partial", "routes-inferred", "route-direction"];
          for (const layerId of routeLayers) {
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
            map.on("click", layerId, (event) => {
              if (placeLayers.length && map.queryRenderedFeatures(event.point, { layers: placeLayers }).length) return;
              const id = event.features?.[0]?.properties?.id;
              if (typeof id !== "string") return;
              if (selectionRef.current?.kind === "route" && selectionRef.current.id === id) {
                setSelection(null);
              } else {
                setSelection({ kind: "route", id });
              }
            });
          }
          const projectInteractiveLayers = [...placeLayers, ...routeLayers];
          const openHistoricalPopup = (event: MapLayerMouseEvent) => {
            if (
              map.queryRenderedFeatures(event.point, {
                layers: projectInteractiveLayers,
              }).length
            ) {
              historicalPopupRef.current?.remove();
              historicalPopupRef.current = null;
              return;
            }
            const properties = historicalPropertiesFromRenderedFeature(
              event.features?.[0]?.properties ?? null,
            );
            if (!properties) return;
            map.getCanvas().style.cursor = "pointer";
            historicalPopupRef.current?.remove();
            historicalPopupRef.current = new maplibregl.Popup({
              closeButton: true,
              closeOnClick: true,
              maxWidth: "300px",
              offset: 12,
            })
              .setLngLat(event.lngLat)
              .setDOMContent(historicalPopupContent(properties, languageRef.current))
              .addTo(map);
          };
          map.on("mouseenter", HISTORICAL_FILL_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", HISTORICAL_FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("click", HISTORICAL_FILL_LAYER_ID, (event) => {
            if (
              map.queryRenderedFeatures(event.point, {
                layers: projectInteractiveLayers,
              }).length
            ) return;
            const properties = historicalPropertiesFromRenderedFeature(
              event.features?.[0]?.properties ?? null,
            );
            if (properties) {
              const currentSelection = selectionRef.current;
              const sameHistoricalFeature = currentSelection?.kind === "historical"
                && currentSelection.properties.yearMonth === properties.yearMonth
                && currentSelection.properties.sourceFeatureIndex === properties.sourceFeatureIndex;
              if (sameHistoricalFeature) {
                setSelection(null);
                historicalPopupRef.current?.remove();
                historicalPopupRef.current = null;
                return;
              }
              setSelection({ kind: "historical", properties });
              openHistoricalPopup(event);
            }
          });
          map.on("contextmenu", HISTORICAL_FILL_LAYER_ID, (event) => {
            event.originalEvent.preventDefault();
            openHistoricalPopup(event);
          });
          if (styleTimer !== undefined) window.clearTimeout(styleTimer);
          setMapReady(true);
          setMapLifecycle("ready");
        } catch (error) {
          setMapReady(false);
          setMapLifecycle("failed");
          setMapDiagnostic(`Project map layers could not be registered: ${errorDetails(error)}`);
        }
      };

      styleTimer = window.setTimeout(() => {
        if (disposed || projectLayersRegistered) return;
        setMapReady(false);
        setMapLifecycle("failed");
        setMapDiagnostic(
          "The inline map style did not initialize in time. Check browser WebGL support and console diagnostics.",
        );
      }, 8_000);
      basemapTimer = window.setTimeout(() => {
        if (disposed || basemapFailed) return;
        basemapFailed = true;
        setBasemapStatus("unavailable");
        setMapDiagnostic(basemapFallbackMessage);
      }, 10_000);

      map.on("style.load", initializeProjectLayers);
      if (map.isStyleLoaded()) initializeProjectLayers();
    } catch (error) {
      const diagnostic = `Map initialization failed: ${errorDetails(error)}`;
      window.queueMicrotask(() => {
        if (disposed) return;
        setMapReady(false);
        setMapLifecycle("failed");
        setMapDiagnostic(diagnostic);
      });
      try {
        activeMap?.remove();
      } catch {
        // A partially initialized MapLibre instance may not be removable.
      }
      activeMap = null;
      mapRef.current = null;
    }

    return () => {
      disposed = true;
      if (styleTimer !== undefined) window.clearTimeout(styleTimer);
      if (basemapTimer !== undefined) window.clearTimeout(basemapTimer);
      coreMarkersRef.current.forEach((marker) => marker.remove());
      coreMarkersRef.current = [];
      historicalLabelMarkersRef.current.forEach((marker) => marker.remove());
      historicalLabelMarkersRef.current = [];
      historicalPopupRef.current?.remove();
      historicalPopupRef.current = null;
      activeMap?.remove();
      if (mapRef.current === activeMap) mapRef.current = null;
    };
  }, [isPresentation, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    (map.getSource("research-places") as GeoJSONSource).setData(pointCollection(visibleCorePlaces, language));
    (map.getSource("ehri-places") as GeoJSONSource).setData(pointCollection(visibleEhriPlaces, language));
    (map.getSource("family-places") as GeoJSONSource).setData(pointCollection(familyContextPlaces, language));
    (map.getSource("research-routes") as GeoJSONSource).setData(
      routeCollection(
        visibleRoutes,
        activePlaybackRoute?.id ?? null,
        timelineProgress,
        true,
        filters.person ? selectedPersonRoutes : visibleRoutes,
      ),
    );
    (map.getSource("route-progress") as GeoJSONSource).setData(
      activePlaybackRoute
        ? routeProgressCollection(
            activePlaybackRoute,
            timelineProgress,
            filters.person ? selectedPersonRoutes : visibleRoutes,
          )
        : emptyPointCollection,
    );
  }, [activePlaybackRoute, familyContextPlaces, filters.person, language, mapReady, selectedPersonRoutes, timelineProgress, visibleCorePlaces, visibleEhriPlaces, visibleRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(BASEMAP_LAYER_ID)) return;
    map.setLayoutProperty(BASEMAP_LAYER_ID, "visibility", layers.basemap ? "visible" : "none");
  }, [layers.basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(BASEMAP_LAYER_ID)) return;
    const paint = basemapVariant === "standard"
      ? { opacity: isPresentation ? 0.98 : 0.88, saturation: isPresentation ? -0.02 : -0.28, contrast: isPresentation ? 0.02 : -0.06, brightnessMin: 0.1, brightnessMax: isPresentation ? 1 : 0.96 }
      : basemapVariant === "light"
        ? { opacity: 0.82, saturation: -0.72, contrast: -0.08, brightnessMin: 0.24, brightnessMax: 1 }
        : { opacity: 0.68, saturation: -1, contrast: -0.18, brightnessMin: 0.36, brightnessMax: 0.98 };
    map.setPaintProperty(BASEMAP_LAYER_ID, "raster-opacity", paint.opacity);
    map.setPaintProperty(BASEMAP_LAYER_ID, "raster-saturation", paint.saturation);
    map.setPaintProperty(BASEMAP_LAYER_ID, "raster-contrast", paint.contrast);
    map.setPaintProperty(BASEMAP_LAYER_ID, "raster-brightness-min", paint.brightnessMin);
    map.setPaintProperty(BASEMAP_LAYER_ID, "raster-brightness-max", paint.brightnessMax);
  }, [basemapVariant, isPresentation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getSource(HISTORICAL_SOURCE_ID)) return;
    const source = map.getSource(HISTORICAL_SOURCE_ID) as GeoJSONSource;
    let disposed = false;

    if (!layers.historicalAdministration) {
      source.setData(emptyHistoricalCollection);
      if (map.getLayer(HISTORICAL_FILL_LAYER_ID)) {
        map.setLayoutProperty(HISTORICAL_FILL_LAYER_ID, "visibility", "none");
      }
      if (map.getLayer(HISTORICAL_LINE_LAYER_ID)) {
        map.setLayoutProperty(HISTORICAL_LINE_LAYER_ID, "visibility", "none");
      }
      historicalLabelMarkersRef.current.forEach((marker) => marker.remove());
      historicalLabelMarkersRef.current = [];
      historicalPopupRef.current?.remove();
      historicalPopupRef.current = null;
      window.queueMicrotask(() => {
        if (disposed) return;
        setHistoricalFeatureCount(0);
        if (historicalManifest) {
          setHistoricalLayerStatus("idle");
          setHistoricalDiagnostic(null);
        }
      });
      return () => { disposed = true; };
    }

    if (!historicalManifest || !selectedHistoricalSnapshot) return;
    const controller = new AbortController();
    source.setData(emptyHistoricalCollection);
    historicalLabelMarkersRef.current.forEach((marker) => marker.remove());
    historicalLabelMarkersRef.current = [];
    map.setLayoutProperty(HISTORICAL_FILL_LAYER_ID, "visibility", "visible");
    map.setLayoutProperty(HISTORICAL_LINE_LAYER_ID, "visibility", "visible");
    window.queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setHistoricalFeatureCount(0);
      setHistoricalLayerStatus("loading_snapshot");
      setHistoricalDiagnostic(null);
    });

    const loadSnapshot = async () => {
      try {
        const response = await fetch(selectedHistoricalSnapshot.url, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Snapshot request failed with HTTP ${response.status}`);
        }
        const parsed = historicalFeatureCollectionSchema.parse(
          await response.json(),
        );
        if (parsed.metadata.yearMonth !== selectedHistoricalSnapshot.yearMonth) {
          throw new Error(
            `Snapshot metadata is ${parsed.metadata.yearMonth}, expected ${selectedHistoricalSnapshot.yearMonth}`,
          );
        }
        const expectedFeatureCount = historicalSnapshotFeatureCount(
          selectedHistoricalSnapshot,
        );
        if (parsed.features.length !== expectedFeatureCount) {
          throw new Error(
            `Snapshot feature count is ${parsed.features.length}, expected ${expectedFeatureCount}`,
          );
        }
        source.setData(parsed as HistoricalFeatureCollection);
        historicalLabelMarkersRef.current = parsed.features.flatMap((feature) => {
          const coordinates = historicalFeatureLabelCoordinate(feature);
          if (!coordinates) return [];
          const element = document.createElement("span");
          element.className = "historical-map-label";
          element.textContent = historicalMapLabel(feature.properties);
          element.setAttribute("aria-label", historicalMapLabel(feature.properties));
          return [new maplibregl.Marker({ element, anchor: "center" }).setLngLat(coordinates).addTo(map)];
        });
        setHistoricalFeatureCount(parsed.features.length);
        setHistoricalLayerStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        source.setData(emptyHistoricalCollection);
        historicalLabelMarkersRef.current.forEach((marker) => marker.remove());
        historicalLabelMarkersRef.current = [];
        setHistoricalFeatureCount(0);
        setHistoricalLayerStatus("failed");
        setHistoricalDiagnostic(
          `Historical snapshot ${selectedHistoricalSnapshot.yearMonth} could not be rendered: ${errorDetails(error)}`,
        );
      }
    };

    void loadSnapshot();
    return () => {
      disposed = true;
      controller.abort();
      historicalLabelMarkersRef.current.forEach((marker) => marker.remove());
      historicalLabelMarkersRef.current = [];
    };
  }, [
    historicalManifest,
    historicalSnapshotReloadToken,
    layers.historicalAdministration,
    mapReady,
    selectedHistoricalSnapshot,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(HISTORICAL_FILL_LAYER_ID)) return;
    map.setPaintProperty(
      HISTORICAL_FILL_LAYER_ID,
      "fill-opacity",
      historicalOpacity,
    );
    map.setPaintProperty(
      HISTORICAL_LINE_LAYER_ID,
      "line-opacity",
      Math.min(1, historicalOpacity + 0.22),
    );
  }, [historicalOpacity, mapReady]);

  const fitMapToBbox = useCallback((bbox: [number, number, number, number], maxZoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const narrowPresentation = isPresentation && typeof window !== "undefined" && window.innerWidth < 720;
    const controlsOpen = presentationPanelOpenRef.current;
    const peopleOpen = presentationPeoplePanelOpenRef.current;
    const padding = isPresentation
      ? narrowPresentation
        ? { top: controlsOpen ? 205 : 42, right: peopleOpen ? 205 : 24, bottom: isPlayingRef.current ? 145 : 92, left: 24 }
        : { top: 70, right: peopleOpen ? 340 : 24, bottom: isPlayingRef.current ? 130 : 82, left: controlsOpen ? 320 : 24 }
      : 36;
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding,
        duration: isPresentation ? 1100 : 700,
        maxZoom: maxZoom ?? (isPresentation ? 7 : 9),
      },
    );
  }, [isPresentation]);

  const fitPersonView = useCallback(() => {
    if (!filters.person) return;
    const coordinates: Array<[number, number]> = [];
    for (const route of data.routes.filter((candidate) => candidate.personId === filters.person)) {
      coordinates.push(...route.coordinates);
    }
    for (const place of data.places) {
      if (place.personIds.includes(filters.person) && place.coordinates) {
        coordinates.push([place.coordinates.longitude, place.coordinates.latitude]);
      }
    }
    const bbox = boundsFromCoordinates(coordinates);
    if (!bbox) return;
    fitMapToBbox(expandBbox(bbox), 11);
  }, [data.places, data.routes, filters.person, fitMapToBbox]);

  const fitGroupView = useCallback(() => {
    if (!selectedGroup) return;
    const coordinates: Array<[number, number]> = [];
    for (const route of data.routes.filter((candidate) => selectedGroup.personIds.includes(candidate.personId))) {
      coordinates.push(...route.coordinates);
    }
    for (const place of data.places) {
      if (place.personIds.some((personId) => selectedGroup.personIds.includes(personId)) && place.coordinates) {
        coordinates.push([place.coordinates.longitude, place.coordinates.latitude]);
      }
    }
    const bbox = boundsFromCoordinates(coordinates);
    if (bbox) fitMapToBbox(expandBbox(bbox, 0.35, 0.24), 10);
  }, [data.places, data.routes, fitMapToBbox, selectedGroup]);

  useEffect(() => {
    if (!isPresentation || !mapReady || !historicalManifest || filters.person) return;
    if (!layers.historicalAdministration) return;
    fitMapToBbox(PRESENTATION_DEFAULT_BBOX, 8);
  }, [filters.person, historicalManifest, isPresentation, layers.historicalAdministration, mapReady, fitMapToBbox]);

  useEffect(() => {
    if (!mapReady || !filters.person) return;
    fitPersonView();
  }, [filters.person, mapReady, fitPersonView]);

  useEffect(() => {
    if (!isPresentation || !mapReady || filters.person || !filters.group) return;
    fitGroupView();
  }, [filters.group, filters.person, fitGroupView, isPresentation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    coreMarkersRef.current.forEach((marker) => marker.remove());
    const markerPlaces = [...visibleCorePlaces, ...visibleEhriPlaces].filter(
      (place, index, places) => places.findIndex((candidate) => candidate.id === place.id) === index,
    );
    coreMarkersRef.current = markerPlaces.flatMap((place) => {
      if (!place.coordinates) return [];
      const element = document.createElement("button");
      element.type = "button";
      element.className = `research-map-marker${place.layer === "ehri_local" ? " research-map-marker--ehri" : ""}`;
      const placeLabel = language === "ro" ? place.labelRo : place.label;
      const roleLabel = place.roles.length ? ` · ${place.roles.join(" / ")}` : "";
      element.setAttribute("aria-label", `Inspect ${placeLabel}${roleLabel}`);
      element.title = `${placeLabel}${roleLabel}`;

      const label = document.createElement("span");
      label.className = "research-map-marker__label";
      label.textContent = language === "ro" ? place.labelRo : place.label;
      const [labelX, labelY] = mapLabelOffset(place.id);
      label.style.transform = `translate(${labelX}px, ${labelY}px)`;
      const pin = document.createElement("span");
      pin.className = `research-map-marker__pin${place.layer === "ehri_local" ? " research-map-marker__pin--ehri" : ""}`;
      pin.style.backgroundColor = placeColor(place);
      pin.textContent = placeMarkerSymbol(place);
      element.append(label);
      element.append(pin);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (selectionRef.current?.kind === "place" && selectionRef.current.id === place.id) {
          setSelection(null);
        } else {
          setSelection({ kind: "place", id: place.id });
        }
      });

      return [
        new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([place.coordinates.longitude, place.coordinates.latitude])
          .addTo(map),
      ];
    });

    return () => {
      coreMarkersRef.current.forEach((marker) => marker.remove());
      coreMarkersRef.current = [];
    };
  }, [filters.person, language, mapReady, visibleCorePlaces, visibleEhriPlaces]);

  useEffect(() => {
    if (!isPlaying || !filters.person) return;
    const step = timelineStep ?? 0;
    if (step >= selectedPersonRoutes.length) return;

    const startedAt = window.performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const rawProgress = Math.min(1, (now - startedAt) / ANIMATION_SEGMENT_DURATION_MS);
      setTimelineProgress(rawProgress);
      if (rawProgress >= 1) {
        const nextStep = step + 1;
        setTimelineStep(nextStep);
        if (nextStep >= selectedPersonRoutes.length) {
          setIsPlaying(false);
          setTimelineProgress(1);
        } else {
          setTimelineProgress(0);
        }
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [filters.person, isPlaying, selectedPersonRoutes.length, timelineStep]);

  const selectedPlace = selection?.kind === "place" ? data.places.find((place) => place.id === selection.id) : null;
  const selectedRoute = selection?.kind === "route" ? data.routes.find((route) => route.id === selection.id) : null;
  const selectedHistorical = selection?.kind === "historical" ? selection.properties : null;
  const selectedPlacePeople = useMemo(() => {
    if (!selectedPlace) return [];
    const peopleById = new Map(data.persons.map((person) => [person.id, person]));
    const contexts = selectedPlace.personContexts.length
      ? selectedPlace.personContexts
      : selectedPlace.personIds.map((personId) => ({
          personId,
          roles: [],
          eventTypes: [],
          dossierIds: [],
          connections: [],
        }));
    const grouped = new Map<string, Array<{ id: string; label: string }>>();
    for (const context of contexts) {
      const person = peopleById.get(context.personId);
      if (!person) continue;
      const label = publicPlaceContextLabel(context);
      const people = grouped.get(label) ?? [];
      if (!people.some((candidate) => candidate.id === person.id)) {
        people.push({ id: person.id, label: person.label });
      }
      grouped.set(label, people);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, language))
      .map(([label, people]) => ({
        label,
        people: people.sort((left, right) => left.label.localeCompare(right.label, language)),
      }));
  }, [data.persons, language, selectedPlace]);
  const selectPersonFromMap = useCallback((personId: string) => {
    setFilters((current) => ({ ...current, person: personId, group: "", place: "" }));
    setPresentationViewport("story");
    setTimelineStep(null);
    setTimelineProgress(0);
    setIsPlaying(false);
    setSelection(null);
    setStoryPersonId(personId);
  }, []);
  const selectedPersonPlaceContext = useMemo<MapPlacePersonContext | null>(() => {
    if (!selectedPlace || !selectedPerson) return null;
    const directContext = selectedPlace.personContexts.find((context) => context.personId === selectedPerson.id);
    const routeConnections = data.routes
      .filter(
        (route) =>
          route.personId === selectedPerson.id
          && (route.originId === selectedPlace.id || route.destinationId === selectedPlace.id),
      )
      .map((route): MapPlacePersonConnection => ({
        id: `route-${route.id}`,
        roles: [route.originId === selectedPlace.id ? "route origin" : "route destination"],
        eventTypes: route.eventTypes,
        date: {
          raw: route.dateRaw,
          start: route.dateStart,
          end: route.dateEnd,
          precision: route.datePrecision ?? "unknown",
        },
        description: route.notes,
        sourceLabel: route.sourceLabel,
      }));
    const connections = [...(directContext?.connections ?? []), ...routeConnections].filter(
      (connection) => !connection.description?.startsWith("Presentation endpoint: Dorohoi."),
    );
    // A source-bound event and the route endpoint derived from the same
    // evidence can have different IDs. The public summary should show that
    // evidence once while retaining genuinely different dates/descriptions.
    const uniqueConnections = [...new Map(connections.map((connection) => [
      [
        connection.date?.start ?? "",
        connection.date?.end ?? "",
        typeof connection.date?.raw === "string" ? connection.date.raw : "",
        connection.description ?? "",
        connection.sourceLabel,
      ].join("\u001f"),
      connection,
    ])).values()];
    return {
      personId: selectedPerson.id,
      roles: [...new Set(connections.flatMap((connection) => connection.roles))],
      eventTypes: [...new Set(connections.flatMap((connection) => connection.eventTypes))],
      dossierIds: [...new Set([...(directContext?.dossierIds ?? []), ...(selectedPerson.dossierId ? [selectedPerson.dossierId] : [])])],
      connections: uniqueConnections,
    };
  }, [data.routes, selectedPerson, selectedPlace]);
  useEffect(() => {
    const map = mapRef.current;
    placePopupRef.current?.remove();
    placePopupRef.current = null;
    if (!map || !mapReady || !selectedPlace?.coordinates) return;

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: "290px",
      offset: 16,
    })
      .setLngLat([selectedPlace.coordinates.longitude, selectedPlace.coordinates.latitude])
      .setDOMContent(personPlacePopupContent(selectedPlace, language, selectedPerson ? { label: selectedPerson.label } : null, selectedPersonPlaceContext, selectedPlacePeople, selectPersonFromMap))
      .addTo(map);
    placePopupRef.current = popup;

    return () => {
      popup.remove();
      if (placePopupRef.current === popup) placePopupRef.current = null;
    };
  }, [language, mapReady, selectedPerson, selectedPersonPlaceContext, selectedPlace, selectedPlacePeople, selectPersonFromMap]);
  const activePlaybackWaypoint = useMemo(() => {
    if (!activePlaybackRoute) return null;
    const placeId = timelineProgress >= 1 ? activePlaybackRoute.destinationId : activePlaybackRoute.originId;
    return data.places.find((place) => place.id === placeId) ?? null;
  }, [activePlaybackRoute, data.places, timelineProgress]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const updateLayer = <K extends keyof Layers>(key: K, value: Layers[K]) =>
    setLayers((current) => ({ ...current, [key]: value }));

  const selectPresentationPerson = (personId: string) => {
    setPresentationViewport("story");
    updateFilter("person", personId);
    updateFilter("group", "");
    setTimelineStep(null);
    setTimelineProgress(0);
    setIsPlaying(false);
    setSelection(null);
    setStoryPersonId(null);
  };

  const openPersonStory = (personId: string) => {
    selectPresentationPerson(personId);
    setStoryPersonId(personId);
  };

  const closePersonStory = () => setStoryPersonId(null);

  useEffect(() => {
    if (!storyPersonId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePersonStory();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [storyPersonId]);

  const selectPresentationGroup = (groupId: string) => {
    setPresentationViewport("story");
    updateFilter("group", groupId);
    updateFilter("person", "");
    setTimelineStep(null);
    setTimelineProgress(0);
    setIsPlaying(false);
    setSelection(null);
    setStoryPersonId(null);
  };

  const clearPresentationSelection = (targetViewport: "europe" | "project" = "project") => {
    setPresentationViewport(targetViewport);
    updateFilter("person", "");
    updateFilter("group", "");
    setTimelineStep(null);
    setTimelineProgress(0);
    setIsPlaying(false);
    setSelection(null);
    setStoryPersonId(null);
    if (isPresentation) {
      fitMapToBbox(targetViewport === "europe" ? PRESENTATION_EUROPE_BBOX : PRESENTATION_DEFAULT_BBOX, 8);
    }
  };

  const startRoutePlayback = () => {
    if (!filters.person || !selectedPersonRoutes.length) return;
    if (timelineStep === null || timelineStep >= selectedPersonRoutes.length) {
      setTimelineStep(0);
      setTimelineProgress(0);
    }
    setIsPlaying(true);
  };

  const toggleFullscreen = async () => {
    if (!workspaceRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await workspaceRef.current.requestFullscreen();
  };

  const resetView = () => {
    setIsPlaying(false);
    setTimelineStep(null);
    setTimelineProgress(0);
    if (!isPresentation) return;
    if (filters.person) {
      setPresentationViewport("story");
      fitPersonView();
      return;
    }
    if (filters.group) {
      setPresentationViewport("story");
      fitGroupView();
      return;
    }
    setPresentationViewport("project");
    fitMapToBbox(PRESENTATION_DEFAULT_BBOX, 8);
  };

  const presentationLegend = (historicalManifest?.presentationVocabulary?.legend ?? []).map((entry) => ({
    ...entry,
    // These representative shades match the named territories on the map.
    // Raw Foreign_Po and Name values remain unchanged in the details panel.
    color: entry.value === "soviet_controlled"
      ? HISTORICAL_PRESENTATION_NAME_COLORS["Soviet Union"]
      : entry.value === "romanian_occupied"
        ? HISTORICAL_PRESENTATION_NAME_COLORS.Transnistria
        : entry.value === "german_allied_state"
          ? HISTORICAL_PRESENTATION_NAME_COLORS.Germany
          : entry.value === "german_occupied"
            ? HISTORICAL_PRESENTATION_NAME_COLORS["Reichskommissariat Ukraine"]
            : entry.color,
  }));
  const publicMapLegend = [
    ...presentationLegend,
    { value: "origin", label: "Birth, origin or residence", color: "#b9883b" },
    { value: "movement", label: "Documented movement", color: "#236353" },
    { value: "deportation", label: "Evacuation or deportation", color: "#a54f32" },
    { value: "forced-labour", label: "Forced labour", color: "#7a5a2e" },
    { value: "death", label: "Death or loss", color: "#8d352c" },
    { value: "ehri", label: "EHRI camp or ghetto", color: "#355b67" },
    { value: "unresolved", label: "Unresolved place", color: "#7e6b8d" },
  ].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.label === entry.label) === index);
  const selectedPersonPlaceContextCard = selectedPerson && selectedPlace && selectedPersonPlaceContext ? (
    <div className="presentation-place-person-context">
      <p className="presentation-label">Selected person at this place</p>
      <p className="presentation-card__body">{selectedPerson.label} has {selectedPersonPlaceContext.connections.length ? "the following documented connection" : "no direct documented connection"} with this place.</p>
      {selectedPersonPlaceContext.connections.length ? (
        <div className="presentation-place-person-context__items">
          {selectedPersonPlaceContext.connections.map((connection) => (
            <div key={connection.id} className="presentation-place-person-context__item">
              <div className="flex items-start justify-between gap-2">
                <strong>{publicPlaceConnectionLabel(connection)}</strong>
                <span>{connection.date ? formatDateRange(connection.date, language) : "Date not supplied"}</span>
              </div>
              {connection.roles.length ? <p>Documented as: {connection.roles.join(" · ")}</p> : null}
              {connection.description ? <p>{connection.description}</p> : null}
              <p className="break-all">Source: {connection.sourceLabel}</p>
            </div>
          ))}
        </div>
      ) : <p className="presentation-card__meta">The place may be visible in the wider dossier or map context, but the current evidence does not link it directly to this person.</p>}
    </div>
  ) : null;

  const presentationDetails = selectedPlace ? (
    <>
      <p className="presentation-card__eyebrow">Important place</p>
      <h2 className="presentation-card__title">{language === "ro" ? selectedPlace.labelRo : selectedPlace.label}</h2>
      <p className="presentation-card__body">
        {selectedPlace.categories.length
          ? selectedPlace.categories.map(publicPlaceCategoryLabel).join(" · ")
          : "Documented place"}
      </p>
      {selectedPersonPlaceContextCard}
      {!selectedPerson && selectedPlacePeople.length ? (
        <div className="presentation-place-people">
          <p className="presentation-label">People documented here</p>
          <p className="presentation-card__meta">People with a documented connection</p>
          {selectedPlacePeople.map((group) => (
            <details key={group.label} className="presentation-place-people__group" open={selectedPlacePeople.length === 1}>
              <summary><span>{group.label}</span><span>{group.people.length}</span></summary>
              <div className="presentation-place-people__items">
                {group.people.map((person) => (
                  <button key={person.id} type="button" className="presentation-place-person" onClick={() => selectPresentationPerson(person.id)}>
                    {person.label}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null}
      {selectedPlace.coordinates ? (
        <p className="presentation-card__meta">{selectedPlace.coordinates.latitude.toFixed(4)}, {selectedPlace.coordinates.longitude.toFixed(4)}</p>
      ) : null}
    </>
  ) : selectedRoute ? (
    <>
      <p className="presentation-card__eyebrow">Documented movement</p>
      <h2 className="presentation-card__title">{selectedRoute.originName} <span aria-hidden="true">→</span> {selectedRoute.destinationName}</h2>
      <p className="presentation-card__body">{selectedRoute.personName} · {mapRouteDateLabel(selectedRoute, language)}</p>
      {selectedRoute.notes ? <p className="presentation-card__body">{selectedRoute.notes}</p> : null}
    </>
  ) : selectedHistorical ? (
    <>
      <h2 className="presentation-card__title">{historicalMapLabel(selectedHistorical)}</h2>
      <p className="presentation-card__eyebrow">{formatYearMonth(selectedHistorical.yearMonth, language)} · supplied {formatIsoDate(selectedHistorical.snapshotDate, language)}</p>
      <dl className="presentation-card__details">
        {hasHistoricalSourceValue(selectedHistorical.Foreign_Po) ? <div><dt>{historicalDetailLabel("Foreign_Po")}</dt><dd>{selectedHistorical.Foreign_Po}</dd></div> : null}
        {hasHistoricalSourceValue(selectedHistorical.Head_of_St) ? <div><dt>{historicalDetailLabel("Head_of_St")}</dt><dd>{selectedHistorical.Head_of_St}</dd></div> : null}
        {hasHistoricalSourceValue(selectedHistorical.Govt_in_Ex) ? <div><dt>{historicalDetailLabel("Govt_in_Ex")}</dt><dd>{selectedHistorical.Govt_in_Ex}</dd></div> : null}
      </dl>
    </>
  ) : selectedPerson ? (
    <>
      <p className="presentation-card__eyebrow">Person / story</p>
      <h2 className="presentation-card__title">{selectedPerson.label}</h2>
      <p className="presentation-card__body">{selectedPersonRoutes.length ? `${selectedPersonRoutes.length} documented movement segments in the current research collection.` : "No documented route segments in the current research collection."}</p>
      {selectedPersonDossierMembers.length ? (
        <details className="presentation-card__family-context presentation-place-people__group">
          <summary><span>Other people in this dossier</span><span>{selectedPersonDossierMembers.length}</span></summary>
          <div className="presentation-place-people__items">
            {selectedPersonDossierMembers.map((person) => (
              <button key={person.id} type="button" className="presentation-place-person" onClick={() => selectPresentationPerson(person.id)}>
                {person.label}
              </button>
            ))}
            {selectedPersonDossier ? <p className="presentation-family-card__meta">{selectedPersonDossier.label}</p> : null}
          </div>
        </details>
      ) : null}
      <button type="button" className="presentation-secondary-button mt-3 w-full" onClick={() => openPersonStory(selectedPerson.id)}>Open person story</button>
    </>
  ) : null;

  const presentationGroupDetails = selectedGroup ? (
    <>
      <p className="presentation-card__eyebrow">Family / dossier</p>
      <h2 className="presentation-card__title">{selectedGroup.label}</h2>
      <p className="presentation-card__body">{selectedGroup.personIds.length} people · {selectedGroupRoutes.length} documented movement segments.</p>
      <p className="presentation-card__body">Select a person to show their route.</p>
    </>
  ) : null;

  const storyDateLabel = (date: MapPersonStory["profile"]["birthDate"]) => {
    if (!date || (!date.start && !date.end && typeof date.raw !== "string")) return null;
    return formatDateRange(date, language);
  };

  const personStoryModal = storyPerson ? (
    <div
      className="person-story-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-story-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePersonStory();
      }}
    >
      <article className="person-story-modal__dialog">
        <header className="person-story-modal__header">
          <div>
            <p className="presentation-card__eyebrow">Person story</p>
            <h2 id="person-story-modal-title" className="person-story-modal__title">{storyPerson.label}</h2>
            <p className="person-story-modal__role">
              {story?.roles.join(" · ") || "Individual record"}
              {storyFamily ? ` · ${storyFamily.label}` : ""}
            </p>
          </div>
          <button type="button" className="presentation-icon-button" onClick={closePersonStory} aria-label="Close person story">×</button>
        </header>
        <div className="person-story-modal__body">
          <div className="person-story-modal__badges">
            {story?.profile.fate ? <StatusBadge tone="rust">{story.profile.fate}</StatusBadge> : null}
            {story?.dossierLabel ? <StatusBadge tone="blue">{story.dossierLabel}</StatusBadge> : null}
          </div>
          {story ? (
            <dl className="person-story-modal__profile">
              {[
                ["Birth", storyDateLabel(story.profile.birthDate)],
                ["Origin", story.profile.origin],
                ["Sex", story.profile.sex],
                ["Profession", story.profile.profession],
                ["Studies", story.profile.studies],
                ["Civil status", story.profile.civilStatus],
                ["Address", story.profile.address],
                ["Destination", story.profile.destination],
                ["Death place", story.profile.deathPlace],
                ["Death date", storyDateLabel(story.profile.deathDate)],
              ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          ) : <p className="presentation-card__body">No extended profile is available for this record yet.</p>}

          <section className="person-story-modal__section">
            <div className="person-story-modal__section-heading"><h3>Life route</h3><span>{story?.timeline.length ?? 0} documented moments</span></div>
            {story?.timeline.length ? (
              <ol className="person-story-timeline">
                {story.timeline.map((item) => (
                  <li key={item.id} className="person-story-timeline__item">
                    <span className="person-story-timeline__marker" aria-hidden="true" />
                    <div className="person-story-timeline__content">
                      <div className="person-story-timeline__heading">
                        <strong>{language === "ro" ? item.placeNameRo ?? item.placeName ?? "Loc nespecificat" : item.placeName ?? "Place not specified"}</strong>
                        <span>{item.date ? formatDateRange(item.date, language) : "Date not supplied"}</span>
                      </div>
                      <p className="person-story-timeline__label">{item.label}</p>
                      {item.description ? <p>{item.description}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="presentation-card__meta">No dated event or movement is linked to this person in the current dataset.</p>}
          </section>

          {story?.materials.length ? (
            <section className="person-story-modal__section">
              <div className="person-story-modal__section-heading"><h3>Materials</h3><span>{story.materials.length}</span></div>
              <div className="person-story-materials">
                {story.materials.map((material) => <div key={material.id}><strong>{material.label}</strong><span>{material.pageCount ? `${material.pageCount} pages · ` : ""}{material.sourceLabel}</span></div>)}
              </div>
            </section>
          ) : null}
          {story?.testimony ? (
            <section className="person-story-modal__section">
              <div className="person-story-modal__section-heading"><h3>Declarant testimony</h3></div>
              <p className="person-story-modal__testimony">{story.testimony}</p>
            </section>
          ) : null}
          {story?.sourceLabel ? <p className="person-story-modal__source">Source: {story.sourceLabel}</p> : null}
          <div className="person-story-modal__actions">
            {dataSource?.supportsResearchRecords !== false ? <Link href={`/persons/${storyPerson.id}`} className="presentation-link-button">Open full research record</Link> : null}
            <button type="button" className="presentation-secondary-button" onClick={closePersonStory}>Close</button>
          </div>
        </div>
      </article>
    </div>
  ) : null;
  const groupedPresentationPersonIds = new Set(data.groups.flatMap((group) => group.personIds));
  const ungroupedPresentationPeople = data.persons
    .filter((person) => !groupedPresentationPersonIds.has(person.id))
    .sort((left, right) => left.label.localeCompare(right.label, "ro"));
  const normalizedPresentationPersonQuery = presentationPersonQuery.trim().toLocaleLowerCase("ro");
  const presentationGroups = data.groups.filter((group) => {
    if (!normalizedPresentationPersonQuery) return true;
    return group.label.toLocaleLowerCase("ro").includes(normalizedPresentationPersonQuery)
      || data.persons.some(
        (person) => group.personIds.includes(person.id) && person.label.toLocaleLowerCase("ro").includes(normalizedPresentationPersonQuery),
      );
  }).sort((left, right) => left.label.localeCompare(right.label, "ro"));
  const filteredUngroupedPresentationPeople = ungroupedPresentationPeople.filter((person) =>
    !normalizedPresentationPersonQuery
      || person.label.toLocaleLowerCase("ro").includes(normalizedPresentationPersonQuery),
  );

  const peopleDirectory = (
    <details className="presentation-group presentation-people-directory" open data-testid="people-directory">
      <summary>Families and people</summary>
      <div className="presentation-group__content presentation-people-list">
        <label className="presentation-person-search">
          <span className="presentation-label">Find a person</span>
          <input
            type="search"
            value={presentationPersonQuery}
            onChange={(event) => setPresentationPersonQuery(event.target.value)}
            placeholder="Type a name…"
            aria-label="Find a person"
            data-testid="presentation-person-search"
          />
        </label>
        {presentationGroups.map((group) => {
        const groupPeople = data.persons
          .filter((person) => group.personIds.includes(person.id))
          .sort((left, right) => {
            const leftHead = left.roles.some((role) => /^declarant$|cap de familie|head/i.test(role));
            const rightHead = right.roles.some((role) => /^declarant$|cap de familie|head/i.test(role));
            return Number(rightHead) - Number(leftHead) || left.label.localeCompare(right.label);
          });
        const head = groupPeople.find((person) => person.roles.some((role) => /^declarant$|cap de familie|head/i.test(role)));
        const mentionedPeople = groupPeople.filter((person) => person.id !== head?.id);
        const dossier = data.dossiers.find((item) => item.id === (head ?? groupPeople[0])?.dossierId);
        const hasFamilyDetails = mentionedPeople.length > 0 || Boolean(dossier);
        const familyCountLabel = `${groupPeople.length} ${groupPeople.length === 1 ? "person" : "people"}`;
        const selectFamilyHead = () => {
          setPresentationOpenFamilyId(null);
          if (head) selectPresentationPerson(head.id);
          else selectPresentationGroup(group.id);
        };
        const familyHeadLabel = head?.label ?? group.label.replace(/\s+·\s+dosar\s+.*$/i, "");
        const familyHeadButton = (
          <span
            className="presentation-family-card__head"
            role="button"
            tabIndex={0}
            aria-pressed={head ? filters.person === head.id : filters.group === group.id}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectFamilyHead();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                selectFamilyHead();
              }
            }}
          >
            <strong>{familyHeadLabel}</strong>
            <small className="presentation-family-card__hint">{head ? "documented head / declarant" : "family or dossier group"}</small>
          </span>
        );
        return (
          hasFamilyDetails ? (
            <details
              key={group.id}
              className={`presentation-family-card presentation-family-card--disclosure${head && filters.person === head.id ? " presentation-family-card--selected" : ""}`}
              open={presentationOpenFamilyId === group.id}
              onToggle={(event) => {
                if (event.currentTarget.open) setPresentationOpenFamilyId(group.id);
                else if (presentationOpenFamilyId === group.id) setPresentationOpenFamilyId(null);
              }}
            >
              <summary className="presentation-family-card__summary" aria-label={`Show ${familyCountLabel} and dossier record for ${familyHeadLabel}`}>
                {familyHeadButton}
                <span className="presentation-family-card__count">{familyCountLabel}</span>
              </summary>
              <div className="presentation-family-card__items">
                {mentionedPeople.map((person) => (
                  <button key={person.id} type="button" className={`presentation-person-option${filters.person === person.id ? " presentation-person-option--selected" : ""}`} onClick={() => selectPresentationPerson(person.id)} aria-pressed={filters.person === person.id}>
                    <span>{person.label}</span><span className="presentation-person-option__role">{person.roles[0] ?? "mentioned person"}</span>
                  </button>
                ))}
                {dossier ? <p className="presentation-family-card__meta">{dossier.label}</p> : null}
              </div>
            </details>
          ) : (
              <div key={group.id} className={`presentation-family-card${head && filters.person === head.id ? " presentation-family-card--selected" : ""}`}>
              <div className="presentation-family-card__summary presentation-family-card__summary--static">
                {familyHeadButton}
                <span className="presentation-family-card__count">1 person</span>
              </div>
            </div>
          )
        );
        })}
        {filteredUngroupedPresentationPeople.length ? <div className="presentation-family-card"><p className="presentation-label">Other individual records</p>{filteredUngroupedPresentationPeople.map((person) => <button key={person.id} type="button" className={`presentation-person-option${filters.person === person.id ? " presentation-person-option--selected" : ""}`} onClick={() => selectPresentationPerson(person.id)} aria-pressed={filters.person === person.id}><span>{person.label}</span><span className="presentation-person-option__role">{person.roles[0] ?? "mentioned person"}</span></button>)}</div> : null}
        {!presentationGroups.length && !filteredUngroupedPresentationPeople.length ? <p className="presentation-card__meta">No matching people or families.</p> : null}
      </div>
    </details>
  );

  const presentationPanel = presentationPanelOpen ? (
    <aside className="presentation-map__panel absolute top-2 left-2 z-20 w-[min(18rem,calc(100%-1rem))] overflow-y-auto border border-[#bdb7aa] bg-[#fffdf8]/96 p-3 shadow-[0_14px_32px_rgba(22,42,35,0.18)] backdrop-blur-md sm:top-3 sm:left-3 sm:max-h-[calc(100%-6rem)]">
      <div className="presentation-panel__header flex items-start justify-between gap-3">
        <div>
          <p className="presentation-card__eyebrow">Map settings</p>
          <h2 className="font-editorial mt-1 text-xl font-bold text-[#173f36]">Display</h2>
        </div>
        <button type="button" className="presentation-icon-button" onClick={() => setPresentationPanelOpen(false)} aria-label="Collapse presentation controls">−</button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {presentationMapConfig.europeView ? <button type="button" className={`presentation-secondary-button presentation-view-button${presentationViewport === "europe" ? " presentation-view-button--active" : ""}`} onClick={() => clearPresentationSelection("europe")} aria-pressed={presentationViewport === "europe"}>Europe view</button> : null}
        {presentationMapConfig.projectRegionView ? <button type="button" className={`presentation-secondary-button presentation-view-button${presentationViewport === "project" ? " presentation-view-button--active" : ""}`} onClick={() => { setPresentationViewport("project"); fitMapToBbox(PRESENTATION_DEFAULT_BBOX, 8); }} aria-pressed={presentationViewport === "project"}>Project region</button> : null}
      </div>

      <details className="presentation-group" open={presentationMapConfig.historicalAdministration}>
        <summary>Historical context</summary>
        {presentationMapConfig.historicalAdministration ? (
          <div className="presentation-group__content">
            <LayerToggle label="Historical administration" marker="historical" checked={layers.historicalAdministration} onChange={(value) => updateLayer("historicalAdministration", value)} />
            {layers.historicalAdministration ? <label className="presentation-opacity-control"><span className="presentation-label">Historical opacity <strong>{Math.round(historicalOpacity * 100)}%</strong></span><input aria-label="Presentation polygon opacity" type="range" min={0.08} max={0.5} step={0.02} value={historicalOpacity} onChange={(event) => setHistoricalOpacity(Number(event.target.value))} className="w-full accent-[#76536f]" /></label> : null}
            <LayerToggle label="Modern basemap" marker="basemap" checked={layers.basemap} onChange={(value) => updateLayer("basemap", value)} />
            <label className="presentation-basemap-select">
              <span className="presentation-label">Basemap appearance</span>
              <select aria-label="Basemap appearance" className={controlClass} value={basemapVariant} onChange={(event) => setBasemapVariant(event.target.value as BasemapVariant)}>
                {(Object.keys(basemapVariantLabels) as BasemapVariant[]).map((variant) => <option key={variant} value={variant}>{basemapVariantLabels[variant]}</option>)}
              </select>
            </label>
            {layers.historicalAdministration && historicalManifest && selectedHistoricalSnapshot ? (
              <div className="presentation-history-controls" data-testid="presentation-historical-controls">
                <label className="block">
                  <span className="presentation-label">Month and year</span>
                  <select aria-label="Presentation historical month" className={controlClass} value={historicalYearMonth} onChange={(event) => { setHistoricalYearMonth(event.target.value); setSelection(null); }} data-testid="presentation-month-select">
                    {historicalManifest.snapshots.map((snapshot) => <option key={snapshot.yearMonth} value={snapshot.yearMonth}>{formatYearMonth(snapshot.yearMonth, language)}{snapshot.status === "limited_static" ? " — limited/static" : ""}</option>)}
                  </select>
                </label>
                <input aria-label="Presentation historical timeline" type="range" min={0} max={historicalManifest.snapshots.length - 1} step={1} value={selectedHistoricalIndex} onChange={(event) => { const snapshot = historicalManifest.snapshots[Number(event.target.value)]; if (snapshot) { setHistoricalYearMonth(snapshot.yearMonth); setSelection(null); } }} className="mt-3 w-full accent-[#76536f]" data-testid="presentation-month-range" />
                <div className="presentation-history-controls__row"><span>{formatIsoDate(selectedHistoricalSnapshot.snapshotDate, language)}</span><span>{selectedHistoricalSnapshot.status === "primary" ? "Primary" : "Limited"}</span></div>
              </div>
            ) : historicalLayerStatus === "loading_manifest" || historicalLayerStatus === "loading_snapshot" ? <p role="status" className="presentation-method">Loading the selected month only…</p> : historicalLayerStatus === "failed" ? <div role="alert" className="presentation-warning">{historicalDiagnostic}<button type="button" className="presentation-secondary-button mt-2" onClick={() => historicalManifest ? setHistoricalSnapshotReloadToken((value) => value + 1) : setHistoricalReloadToken((value) => value + 1)}>Retry historical layer</button></div> : null}
          </div>
        ) : null}
      </details>

      <details className="presentation-group" open>
        <summary>People and movement</summary>
        <div className="presentation-group__content">
          {presentationMapConfig.projectPlaces ? <LayerToggle label="Important places" marker="places" checked={layers.locations} onChange={(value) => updateLayer("locations", value)} /> : null}
          {presentationMapConfig.routes ? <LayerToggle label="Routes" marker="routes" checked={layers.individualRoutes} onChange={(value) => updateLayer("individualRoutes", value)} /> : null}
        </div>
      </details>

      <details className="presentation-group">
        <summary>More layers</summary>
        <div className="presentation-group__content">
          {presentationMapConfig.ehri ? <LayerToggle label="EHRI camps and ghettos" marker="ehri" checked={layers.localEhri} onChange={(value) => updateLayer("localEhri", value)} /> : null}
          {presentationMapConfig.unresolvedPlaces ? <LayerToggle label="Unresolved places" marker="unresolved" checked={layers.unresolved} onChange={(value) => updateLayer("unresolved", value)} /> : null}
        </div>
      </details>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#d6d0c4] pt-3">
        <button type="button" className="presentation-secondary-button" onClick={resetView}>Reset view</button>
        {presentationMapConfig.fullscreen ? <button type="button" className="presentation-secondary-button" onClick={() => void toggleFullscreen()}>{isFullscreen ? "Exit full screen" : "Full screen"}</button> : null}
        {presentationMapConfig.hideInterface ? <button type="button" className="presentation-secondary-button" onClick={() => setInterfaceHidden(true)}>Hide interface</button> : null}
      </div>
    </aside>
  ) : null;

  const presentationPeoplePanel = !interfaceHidden && presentationPeoplePanelOpen && presentationMapConfig.personSelector ? (
    <aside className="presentation-map__people absolute top-2 right-2 z-20 w-[min(19rem,calc(100%-1rem))] overflow-y-auto border border-[#bdb7aa] bg-[#fffdf8]/96 p-3 shadow-[0_14px_32px_rgba(22,42,35,0.18)] backdrop-blur-md sm:top-3 sm:right-3 sm:max-h-[calc(100%-6rem)]" data-testid="presentation-people-panel">
      <div className="presentation-panel__header flex items-start justify-between gap-3">
        <div>
          <p className="presentation-card__eyebrow">People</p>
          <h2 className="font-editorial mt-1 text-xl font-bold text-[#173f36]">Select a person</h2>
        </div>
        <button type="button" className="presentation-icon-button" onClick={() => setPresentationPeoplePanelOpen(false)} aria-label="Collapse people and families">−</button>
      </div>
      <button type="button" className={`presentation-person-option presentation-person-option--all${!filters.person && !filters.group ? " presentation-person-option--selected" : ""}`} onClick={() => clearPresentationSelection()} aria-pressed={!filters.person && !filters.group}>
        <span>All people</span><span className="presentation-person-option__role">Romania view</span>
      </button>
      {peopleDirectory}
      {presentationMapConfig.legend ? (
        <details className="presentation-group presentation-right-legend">
          <summary>Map legend</summary>
          <div className="presentation-group__content">
            <p className="presentation-label">Historical administration</p>
            {publicMapLegend.slice(0, presentationLegend.length || 0).map((entry) => <div key={entry.value} className="presentation-right-legend__item"><span style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</div>)}
            <p className="presentation-label presentation-right-legend__subheading">People and places</p>
            {publicMapLegend.slice(presentationLegend.length).map((entry) => <div key={entry.value} className="presentation-right-legend__item"><span style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</div>)}
          </div>
        </details>
      ) : null}

      {(presentationDetails || presentationGroupDetails) ? (
        <div className="presentation-people-detail" data-testid="presentation-story-card">
          <div className="mb-3 flex items-center justify-between gap-2"><p className="presentation-label">Selected detail</p><button type="button" className="presentation-icon-button" onClick={() => clearPresentationSelection()} aria-label="Clear selected person or family">×</button></div>
          {presentationDetails ?? presentationGroupDetails}
          {selectedPerson ? <button type="button" disabled={!selectedPersonRoutes.length || isPlaying} className="presentation-primary-button mt-3" onClick={startRoutePlayback}>{isPlaying ? "Playing route…" : selectedPersonRoutes.length ? "Play route" : "No documented route"}</button> : null}
          {selectedPlace ? <Link className="presentation-link-button" href={`/places/${selectedPlace.id}`}>Open place record</Link> : null}
          {selectedRoute && dataSource?.supportsResearchRecords !== false ? <Link className="presentation-link-button" href={`/persons/${selectedRoute.personId}`}>Open person dossier</Link> : null}
          {selectedPerson && !selection && dataSource?.supportsResearchRecords !== false ? <Link className="presentation-link-button" href={`/persons/${selectedPerson.id}`}>Open person dossier</Link> : null}
        </div>
      ) : null}
    </aside>
  ) : null;

  const presentationTimeline = presentationMapConfig.timeline ? (
    <section className={`presentation-map__timeline absolute right-2 bottom-2 left-2 z-20 border border-[#bdb7aa] bg-[#fffdf8]/95 p-1 shadow-[0_10px_24px_rgba(22,42,35,0.16)] backdrop-blur-md sm:right-3 sm:bottom-3 sm:left-3${presentationTimelineOpen ? "" : " presentation-map__timeline--collapsed"}`} data-testid="presentation-timeline">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-32 items-center gap-1.5"><button type="button" className="presentation-icon-button presentation-timeline__toggle" onClick={() => setPresentationTimelineOpen((open) => !open)} aria-expanded={presentationTimelineOpen} aria-label={presentationTimelineOpen ? "Collapse route timeline" : "Expand route timeline"}>{presentationTimelineOpen ? "−" : "+"}</button><div><p className="presentation-card__eyebrow">Route</p><p className="font-editorial text-base font-bold text-[#173f36]">{selectedPerson?.label ?? "Select a person"}</p></div></div>
        <div className="presentation-timeline__track flex min-w-0 grow items-center gap-1.5 overflow-x-auto py-0.5">{selectedPersonRoutes.length ? selectedPersonRoutes.map((route, index) => <div key={route.id} className="presentation-timeline__stop flex min-w-fit items-center gap-1.5"><span className={`grid size-6 place-items-center rounded-full border text-xs font-bold ${timelineStep !== null && index < timelineStep ? "border-[#173f36] bg-[#173f36] text-white" : "border-[#9fa69f] bg-white text-[#56645e]"}`}>{route.sequence}</span><span className="presentation-timeline__place"><strong>{route.destinationName}</strong><small>{mapRouteDateLabel(route, "en")}</small></span>{index < selectedPersonRoutes.length - 1 ? <span className="presentation-timeline__line h-px w-6 bg-[#b9b3a7]" /> : null}</div>) : <p className="text-xs text-[#747f79]">No documented route selected.</p>}</div>
        <div className="flex min-w-fit gap-2"><button type="button" disabled={!filters.person || !selectedPersonRoutes.length || isPlaying} onClick={startRoutePlayback} className="presentation-primary-button">Play once</button><button type="button" disabled={!isPlaying} onClick={() => setIsPlaying(false)} className="presentation-secondary-button">Pause</button><button type="button" onClick={resetView} className="presentation-secondary-button">Reset</button></div>
      </div>
      {presentationTimelineOpen && activePlaybackWaypoint ? <div className="presentation-waypoint"><span className="presentation-label">Current documented place</span><strong>{language === "ro" ? activePlaybackWaypoint.labelRo : activePlaybackWaypoint.label}</strong>{activePlaybackRoute?.dateStart || activePlaybackRoute?.dateRaw ? <span>{mapRouteDateLabel(activePlaybackRoute, "en")}</span> : null}{activePlaybackRoute?.notes ? <span>{activePlaybackRoute.notes}</span> : null}</div> : null}
    </section>
  ) : null;

  if (isPresentation) {
    return (
      <div
        ref={workspaceRef}
        data-interface-hidden={interfaceHidden ? "true" : "false"}
        data-people-panel-open={presentationPeoplePanelOpen ? "true" : "false"}
        data-controls-open={presentationPanelOpen ? "true" : "false"}
        data-presentation-viewport={presentationViewport}
        className="map-workspace presentation-map-workspace relative isolate min-h-[560px] h-[calc(100vh-12rem)] overflow-hidden border-y border-[#bdb7aa] bg-[#d7d3ca]"
      >
        {renderMapCanvas()}
        {!interfaceHidden ? presentationPanel : null}
        {!interfaceHidden && !presentationPanelOpen ? <button type="button" className="presentation-map__reopen absolute top-2 left-2 z-30" onClick={() => setPresentationPanelOpen(true)}>Map settings</button> : null}
        {presentationPeoplePanel}
        {!interfaceHidden && !presentationPeoplePanelOpen && presentationMapConfig.personSelector ? <button type="button" className="presentation-map__reopen presentation-map__reopen--right absolute top-2 right-2 z-30" onClick={() => setPresentationPeoplePanelOpen(true)}>People</button> : null}
        {presentationTimeline}
        {interfaceHidden ? <div className="presentation-map__hidden-tools absolute top-3 left-3 z-30 flex items-center gap-2"><button type="button" className="presentation-secondary-button shadow-lg" onClick={() => setInterfaceHidden(false)}>Show interface</button>{presentationMapConfig.legend && presentationLegend.length ? <div className="presentation-compact-legend">{presentationLegend.map((entry) => <span key={entry.value} title={entry.label} style={{ backgroundColor: entry.color }} />)}</div> : null}</div> : null}
        {personStoryModal}
      </div>
    );
  }

  function renderMapCanvas() {
    return (
    <div
      className={isPresentation
        ? "absolute inset-0 min-w-0 overflow-hidden bg-[#d7d3ca]"
        : "relative min-h-[540px] min-w-0 overflow-hidden bg-[#d7d3ca] lg:min-h-0"}
      data-map-state={mapLifecycle}
    >
      <div aria-hidden="true" className="map-local-fallback-grid absolute inset-0" />
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ position: "absolute", inset: 0 }}
        aria-label={isPresentation ? "Interactive public historical map" : "Interactive historical research map"}
        data-testid="maplibre-container"
      />
      {isPresentation ? <a className="presentation-map__attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> : null}
      {mapLifecycle === "initializing" ? (
        <div role="status" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-[#a9a397] bg-[#fffdf8]/95 px-4 py-3 text-center shadow-lg">
          <p className="text-[9px] font-black tracking-[0.12em] text-[#173f36] uppercase">Initializing map</p>
          <p className="mt-1 text-[9px] text-[#68746e]">Loading the inline fallback style and project layers…</p>
        </div>
      ) : null}
      {mapLifecycle === "failed" ? (
        <div role="alert" className="absolute top-1/2 right-4 left-4 z-10 mx-auto max-w-lg -translate-y-1/2 border-2 border-[#8d352c] bg-[#fff8f3]/97 p-5 shadow-xl">
          <p className="text-[9px] font-black tracking-[0.13em] text-[#8d352c] uppercase">Map rendering unavailable</p>
          <p className="font-editorial mt-2 text-xl font-bold text-[#173f36]">The map could not initialize.</p>
          <p className="mt-2 text-xs leading-5 text-[#5f6864]">{mapDiagnostic}</p>
          <p className="mt-3 text-[9px] leading-4 text-[#777f7b]">Research filters and layer controls remain available. Enable WebGL 2, then refresh this page.</p>
        </div>
      ) : null}
      {mapLifecycle === "ready" && mapDiagnostic && (mapDiagnostic !== basemapFallbackMessage || layers.basemap) ? (
        <div role="alert" className="pointer-events-none absolute right-3 bottom-8 left-3 z-10 border border-[#b9883b] bg-[#fff8e8]/96 px-3 py-2 shadow-lg sm:right-auto sm:max-w-md">
          <p className="text-[9px] font-black tracking-[0.11em] text-[#806024] uppercase">Local fallback active</p>
          <p className="mt-1 text-[9px] leading-4 text-[#5e665f]">{mapDiagnostic}</p>
        </div>
      ) : null}
      {mapLifecycle === "ready" && layers.historicalAdministration && historicalLayerStatus === "failed" && historicalDiagnostic ? (
        <div role="alert" className="absolute top-3 right-14 z-10 max-w-sm border border-[#9d4d3b] bg-[#fff3ee]/97 px-3 py-2 shadow-lg" data-testid="historical-map-error">
          <p className="text-[8px] font-black tracking-[0.11em] text-[#8d352c] uppercase">Historical layer unavailable</p>
          <p className="mt-1 text-[8px] leading-3 text-[#6f453a]">{historicalDiagnostic}</p>
        </div>
      ) : null}
      {!isPresentation ? <div className="pointer-events-none absolute top-3 left-3 border border-[#a9a397] bg-[#fffdf8]/92 px-3 py-2 shadow-md backdrop-blur-sm">
        <p className="text-[8px] font-black tracking-[0.13em] text-[#6f7974] uppercase">{isPresentation ? "Historical atlas" : "Visible evidence"}</p>
        <p className="mt-1 text-xs font-bold text-[#173f36]">{visibleCorePlaces.length} places · {visibleRoutes.length} routes · {visibleEhriPlaces.length} EHRI{layers.historicalAdministration ? ` · ${historicalFeatureCount} historical` : ""}</p>
        <p className="mt-1 text-[8px] text-[#707b76]" data-testid="map-service-status">
          {mapLifecycle === "ready"
            ? layers.basemap
              ? basemapStatus === "available"
                ? "Basemap connected · local fallback ready"
                : basemapStatus === "unavailable"
                  ? "Basemap unavailable · local fallback active"
                  : "Basemap loading · local fallback ready"
              : "Basemap hidden · local fallback active"
            : mapLifecycle === "failed"
              ? "Map initialization failed"
              : "Map initializing"}
        </p>
        {layers.historicalAdministration ? (
          <p className="mt-0.5 text-[8px] text-[#76536f]" data-testid="historical-map-status">
            Historical {historicalYearMonth} · {historicalLayerStatus.replaceAll("_", " ")}
          </p>
        ) : null}
        <p className="mt-0.5 text-[8px] text-[#707b76]">Research grid · no boundary claims</p>
      </div> : null}
    </div>
    );
  }

  return (
    <div className="map-workspace grid min-h-[760px] border-y border-[#bdb7aa] bg-[#e5e0d5] lg:h-[calc(100vh-12rem)] lg:min-h-[560px] lg:grid-cols-[260px_minmax(420px,1fr)_292px] lg:grid-rows-[minmax(440px,1fr)_auto]">
      <aside className="research-map__filters max-h-[36rem] overflow-y-auto border-b border-[#c8c1b4] bg-[#f6f2e9] p-4 lg:row-span-2 lg:max-h-none lg:border-r lg:border-b-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-editorial text-xl font-bold text-[#173f36]">{t("map.filters")}</h2>
          <button
            type="button"
            onClick={() => setFilters({ person: "", group: "", dossier: "", place: "", eventType: "", confidence: "", fromYear: "", toYear: "" })}
            className="text-[9px] font-black tracking-[0.1em] text-[#a54f32] uppercase"
          >
            {t("common.clear")}
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.person")}</span>
            <select
              className={controlClass}
              value={filters.person}
              onChange={(event) => {
                updateFilter("person", event.target.value);
                setTimelineStep(null);
                setIsPlaying(false);
              }}
            >
              <option value="">{t("common.all")}</option>
              {data.persons.slice().sort((left, right) => left.label.localeCompare(right.label, language)).map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.group")}</span>
            <select className={controlClass} value={filters.group} onChange={(event) => updateFilter("group", event.target.value)}>
              <option value="">{t("common.all")}</option>
              {data.groups.slice().sort((left, right) => left.label.localeCompare(right.label, language)).map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.place")}</span>
            <select className={controlClass} value={filters.place} onChange={(event) => { updateFilter("place", event.target.value); if (event.target.value) setSelection({ kind: "place", id: event.target.value }); }}>
              <option value="">{t("common.all")}</option>
              {data.places.filter((place) => place.layer !== "ehri_local").map((place) => <option key={place.id} value={place.id}>{language === "ro" ? place.labelRo : place.label}</option>)}
            </select>
          </label>
          <details className="research-control-group">
            <summary>Advanced filters</summary>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.dossier")}</span>
                <select className={controlClass} value={filters.dossier} onChange={(event) => updateFilter("dossier", event.target.value)}>
                  <option value="">{t("common.all")}</option>
                  {data.dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.id}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.event")}</span>
                <select className={controlClass} value={filters.eventType} onChange={(event) => updateFilter("eventType", event.target.value)}>
                  <option value="">{t("common.all")}</option>
                  {data.eventTypes.map((eventType) => <option key={eventType} value={eventType}>{humanizeSlug(eventType)}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.from")}</span>
                  <input className={controlClass} value={filters.fromYear} onChange={(event) => updateFilter("fromYear", event.target.value)} inputMode="numeric" placeholder="1938" />
                </label>
                <label>
                  <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.to")}</span>
                  <input className={controlClass} value={filters.toYear} onChange={(event) => updateFilter("toYear", event.target.value)} inputMode="numeric" placeholder="1944" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.confidence")}</span>
                <select className={controlClass} value={filters.confidence} onChange={(event) => updateFilter("confidence", event.target.value)}>
                  <option value="">{t("common.all")}</option>
                  {(["high", "medium", "low", "unknown"] as const).map((confidence) => <option key={confidence}>{confidence}</option>)}
                </select>
              </label>
            </div>
          </details>
        </div>

        <div className="mt-5 border-t border-[#d2ccbf] pt-4">
          <h2 className="font-editorial mb-2 text-lg font-bold text-[#173f36]">{t("map.layers")}</h2>
          <details className="research-control-group" open>
            <summary>Historical context</summary>
            <div className="mt-3">
            <LayerToggle
            label="OpenStreetMap basemap"
            marker="▦"
            checked={layers.basemap}
            onChange={(value) => updateLayer("basemap", value)}
            note={
              !layers.basemap
                ? "Hidden; local grid remains"
                : basemapStatus === "available"
                  ? "Public raster tiles · connected"
                  : basemapStatus === "unavailable"
                    ? "Unavailable; local fallback active"
              : "Loading public raster tiles"
            }
            />
            <label className="mt-2 block">
              <span className="mb-1 block text-[8px] font-black tracking-[0.1em] text-[#66736d] uppercase">Basemap appearance</span>
              <select aria-label="Research basemap appearance" className={controlClass} value={basemapVariant} onChange={(event) => setBasemapVariant(event.target.value as BasemapVariant)}>
                {(Object.keys(basemapVariantLabels) as BasemapVariant[]).map((variant) => <option key={variant} value={variant}>{basemapVariantLabels[variant]}</option>)}
              </select>
            </label>
            <LayerToggle
            label="Historical administration"
            marker="▧"
            checked={layers.historicalAdministration}
            onChange={(value) => {
              updateLayer("historicalAdministration", value);
              if (!value && selection?.kind === "historical") setSelection(null);
            }}
            note={
              historicalLayerStatus === "loading_manifest"
                ? "Loading local snapshot index"
                : layers.historicalAdministration
                  ? historicalLayerStatus === "ready"
                    ? `${historicalFeatureCount} regional polygons · ${historicalYearMonth}`
                    : historicalLayerStatus === "loading_snapshot"
                      ? `Loading ${historicalYearMonth}`
                      : historicalLayerStatus === "failed"
                        ? "Local historical data error"
                        : "Ready to load selected month"
                  : "Optional · local monthly snapshots"
            }
            />
            {layers.historicalAdministration ? (
            <div
              className="mb-3 border border-[#c9bba5] bg-[#fffaf0] p-2.5"
              data-testid="historical-administration-controls"
            >
              {historicalManifest && selectedHistoricalSnapshot ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[8px] font-black tracking-[0.12em] text-[#76536f] uppercase">
                        Monthly snapshot
                      </p>
                      <p className="font-editorial mt-0.5 text-base font-bold text-[#173f36]" data-testid="historical-snapshot-label">
                        {formatYearMonth(historicalYearMonth, language)}
                      </p>
                    </div>
                    <StatusBadge tone={selectedHistoricalSnapshot.status === "primary" ? "green" : "rust"}>
                      {selectedHistoricalSnapshot.status === "primary" ? "primary" : "limited / static"}
                    </StatusBadge>
                  </div>
                  <select
                    aria-label="Historical administration month"
                    className={`${controlClass} mt-2`}
                    value={historicalYearMonth}
                    onChange={(event) => {
                      setHistoricalYearMonth(event.target.value);
                      if (selection?.kind === "historical") setSelection(null);
                    }}
                    data-testid="historical-month-select"
                  >
                    {historicalManifest.snapshots.map((snapshot) => (
                      <option key={snapshot.yearMonth} value={snapshot.yearMonth}>
                        {formatYearMonth(snapshot.yearMonth, language)}{snapshot.status === "limited_static" ? " — limited/static" : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Historical administration timeline"
                    type="range"
                    min={0}
                    max={historicalManifest.snapshots.length - 1}
                    step={1}
                    value={selectedHistoricalIndex}
                    onChange={(event) => {
                      const snapshot = historicalManifest.snapshots[Number(event.target.value)];
                      if (snapshot) {
                        setHistoricalYearMonth(snapshot.yearMonth);
                        if (selection?.kind === "historical") setSelection(null);
                      }
                    }}
                    className="mt-2 w-full accent-[#76536f]"
                    data-testid="historical-month-range"
                  />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={selectedHistoricalIndex === 0}
                      onClick={() => {
                        setHistoricalYearMonth(historicalManifest.snapshots[selectedHistoricalIndex - 1]?.yearMonth ?? historicalYearMonth);
                        if (selection?.kind === "historical") setSelection(null);
                      }}
                      className="border border-[#b9ad9b] bg-white px-2 py-1 text-[8px] font-black uppercase disabled:opacity-35"
                    >
                      Previous
                    </button>
                    <span className="text-center text-[8px] text-[#717a75]">
                      Supplied {formatIsoDate(selectedHistoricalSnapshot.snapshotDate, language)}
                    </span>
                    <button
                      type="button"
                      disabled={selectedHistoricalIndex === historicalManifest.snapshots.length - 1}
                      onClick={() => {
                        setHistoricalYearMonth(historicalManifest.snapshots[selectedHistoricalIndex + 1]?.yearMonth ?? historicalYearMonth);
                        if (selection?.kind === "historical") setSelection(null);
                      }}
                      className="border border-[#b9ad9b] bg-white px-2 py-1 text-[8px] font-black uppercase disabled:opacity-35"
                    >
                      Next
                    </button>
                  </div>

                  <label className="mt-3 block border-t border-[#ddd0bc] pt-2">
                    <span className="flex justify-between text-[8px] font-black tracking-[0.1em] text-[#66736d] uppercase">
                      <span>Polygon opacity</span>
                      <span>{Math.round(historicalOpacity * 100)}%</span>
                    </span>
                    <input
                      aria-label="Historical administration opacity"
                      type="range"
                      min={0.1}
                      max={0.85}
                      step={0.05}
                      value={historicalOpacity}
                      onChange={(event) => setHistoricalOpacity(Number(event.target.value))}
                      className="mt-1 w-full accent-[#76536f]"
                      data-testid="historical-opacity"
                    />
                  </label>

                  <div className="mt-3 border-t border-[#ddd0bc] pt-2" aria-label="Historical administration legend">
                    <p className="text-[8px] font-black tracking-[0.12em] text-[#76536f] uppercase">Historical power / authority legend</p>
                    <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto pr-1">
                      {historicalManifest.derivedForeignPowerVocabulary.legend.map((entry) => (
                        <div key={entry.value} className="flex items-start gap-2 text-[8px] leading-3 text-[#52605a]">
                          <span aria-hidden="true" className="mt-0.5 size-2.5 shrink-0 border border-black/20" style={{ backgroundColor: entry.color }} />
                          <span>{entry.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[8px] leading-3 text-[#7b7165]">Display grouping only; no civil/military administration field exists in the monthly DBFs.</p>
                  </div>

                  {selectedHistoricalSnapshot.status === "limited_static" ? (
                    <p role="note" className="mt-2 border border-[#c9967e] bg-[#fff2eb] p-2 text-[8px] leading-3 text-[#7d3e2f]">
                      Limited/static evidence: October 1944–May 1945 lacks equivalent frontline evidence; most late geometry repeats September 1944.
                    </p>
                  ) : null}
                  <p className="mt-2 text-[8px] leading-3 text-[#655f58]">{historicalManifest.methodologicalWarning}</p>
                  <p className="mt-2 border-t border-[#ddd0bc] pt-2 text-[7px] leading-3 text-[#7f7770]">{historicalManifest.source.attribution}</p>
                </>
              ) : null}

              {historicalLayerStatus === "loading_manifest" || historicalLayerStatus === "loading_snapshot" ? (
                <p role="status" className="mt-2 text-[8px] font-bold text-[#76536f]">
                  {historicalLayerStatus === "loading_manifest" ? "Loading local historical manifest…" : `Loading ${historicalYearMonth} only…`}
                </p>
              ) : null}
              {historicalLayerStatus === "failed" && historicalDiagnostic ? (
                <div role="alert" className="mt-2 border border-[#9d4d3b] bg-[#fff3ee] p-2 text-[8px] leading-3 text-[#7d3528]" data-testid="historical-error">
                  <p>{historicalDiagnostic}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (historicalManifest) setHistoricalSnapshotReloadToken((value) => value + 1);
                      else setHistoricalReloadToken((value) => value + 1);
                    }}
                    className="mt-1.5 border border-[#9d4d3b] bg-white px-2 py-1 font-black uppercase"
                  >
                    Retry local layer
                  </button>
                </div>
              ) : null}
            </div>
            ) : null}
            </div>
          </details>
          <details className="research-control-group" open>
            <summary>People and movement</summary>
            <div className="mt-3">
              <LayerToggle label="Locations" marker="●" checked={layers.locations} onChange={(value) => updateLayer("locations", value)} />
              <LayerToggle label="Individual routes" marker="→" checked={layers.individualRoutes} onChange={(value) => updateLayer("individualRoutes", value)} />
              <LayerToggle label="Family / household context" marker="○" checked={layers.familyContext} onChange={(value) => updateLayer("familyContext", value)} note="Gold rings; requires a group filter" />
              <LayerToggle label="Origin places" marker="●" checked={layers.origin} onChange={(value) => updateLayer("origin", value)} />
              <LayerToggle label="Evacuation & deportation" marker="◆" checked={layers.evacuationDeportation} onChange={(value) => updateLayer("evacuationDeportation", value)} />
              <LayerToggle label="Camps & ghettos" marker="▲" checked={layers.campsGhettos} onChange={(value) => updateLayer("campsGhettos", value)} />
              <LayerToggle label="Forced labour" marker="✚" checked={layers.forcedLabour} onChange={(value) => updateLayer("forcedLabour", value)} />
              <LayerToggle label="Death places" marker="✦" checked={layers.death} onChange={(value) => updateLayer("death", value)} />
              <LayerToggle label="Return / repatriation" marker="↩" checked={layers.return} onChange={(value) => updateLayer("return", value)} />
            </div>
          </details>
          <details className="research-control-group">
            <summary>More layers</summary>
            <div className="mt-3">
              <LayerToggle label="Unresolved places" marker="?" checked={layers.unresolved} onChange={(value) => updateLayer("unresolved", value)} note="Listed off-map; no fabricated points" />
              <LayerToggle label="Local EHRI overlay" marker="■" checked={layers.localEhri} onChange={(value) => updateLayer("localEhri", value)} note={`${data.places.filter((place) => place.layer === "ehri_local").length} supplied records`} />
              <LayerToggle label="Inferred routes" marker="⋯" checked={layers.inferred} onChange={(value) => updateLayer("inferred", value)} note="Disabled by default; none in pilot" />
              <div className="mt-2 border-t border-[#ddd7ca] pt-2">
                <LayerToggle label="WMS / WMTS services" marker="▤" checked={false} onChange={() => undefined} disabled note="Unavailable: no service registry or source data is configured" />
                <p className="mt-1 text-xs leading-5 text-[#68746e]">This research-only placeholder is retained for future external services; it cannot be activated in the current V1 data model.</p>
              </div>
            </div>
          </details>
        </div>
      </aside>

      {renderMapCanvas()}

      <aside className="research-map__context max-h-[38rem] overflow-y-auto border-t border-[#c8c1b4] bg-[#fffdf8] p-4 lg:row-span-2 lg:max-h-none lg:border-t-0 lg:border-l">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-editorial text-xl font-bold text-[#173f36]">{t("map.context")}</h2>
          {selection ? <button type="button" onClick={() => setSelection(null)} className="text-[9px] font-black tracking-[0.1em] text-[#a54f32] uppercase">{t("common.clear")}</button> : null}
        </div>
        {peopleDirectory}
        {selectedPlace ? (
          <div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone={selectedPlace.layer === "ehri_local" ? "blue" : "green"}>{selectedPlace.placeType}</StatusBadge>
              <StatusBadge tone={selectedPlace.resolutionStatus === "unresolved" ? "rust" : "green"}>{selectedPlace.resolutionStatus.replaceAll("_", " ")}</StatusBadge>
            </div>
            <h3 className="font-editorial mt-3 text-2xl leading-7 font-bold text-[#173f36]">{language === "ro" ? selectedPlace.labelRo : selectedPlace.label}</h3>
            <p className="mt-3 text-xs leading-5 text-[#61706a]">{selectedPlace.roles.length ? selectedPlace.roles.join(" · ") : "Overlay location; no direct dossier mention in the current pilot."}</p>
            {selectedPersonPlaceContextCard}
            {selectedPlace.coordinates ? <p className="mt-3 font-mono text-[10px] text-[#73807a]">{selectedPlace.coordinates.latitude.toFixed(5)}, {selectedPlace.coordinates.longitude.toFixed(5)}</p> : <p className="mt-3 text-xs font-bold text-[#a54f32]">No coordinates assigned</p>}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-y border-[#ded8cc] py-3 text-xs">
              <div><dt className="text-[8px] font-black uppercase">People</dt><dd className="font-editorial text-xl font-bold">{selectedPlace.personIds.length}</dd></div>
              <div><dt className="text-[8px] font-black uppercase">Events</dt><dd className="font-editorial text-xl font-bold">{selectedPlace.eventTypes.length}</dd></div>
            </dl>
            <p className="mt-3 break-all text-[9px] leading-4 text-[#838b87]">{selectedPlace.sourceLabel}</p>
            <Link href={`/places/${selectedPlace.id}`} className="mt-4 flex justify-center bg-[#173f36] px-4 py-2.5 text-[9px] font-black tracking-[0.11em] text-white uppercase">Open place record</Link>
          </div>
        ) : selectedRoute ? (
          <div>
            <div className="flex gap-1.5">
              <StatusBadge tone={selectedRoute.routeStatus === "explicit" ? "green" : "gold"}>{selectedRoute.routeStatus}</StatusBadge>
              <StatusBadge tone={confidenceTone(selectedRoute.confidence)}>{selectedRoute.confidence}</StatusBadge>
            </div>
            <p className="mt-3 text-[9px] font-black tracking-[0.12em] text-[#9c5a3d] uppercase">{selectedRoute.personName}</p>
            <h3 className="font-editorial mt-1 text-2xl leading-7 font-bold text-[#173f36]">{selectedRoute.originName} <span className="text-[#a54f32]">→</span> {selectedRoute.destinationName}</h3>
            <dl className="mt-4 space-y-2 border-y border-[#ded8cc] py-3 text-xs leading-5">
              <div><dt className="inline font-bold">Date: </dt><dd className="inline">{mapRouteDateLabel(selectedRoute, language)}</dd></div>
              <div><dt className="inline font-bold">Transport: </dt><dd className="inline">{selectedRoute.transportRaw ?? "Not supplied"}</dd></div>
              <div><dt className="inline font-bold">Line style: </dt><dd className="inline">solid presentation route</dd></div>
            </dl>
            {selectedRoute.notes ? <p className="mt-3 text-xs leading-5 text-[#61706a]">{selectedRoute.notes}</p> : null}
            <p className="mt-3 break-all text-[9px] leading-4 text-[#838b87]">{selectedRoute.sourceLabel}</p>
            {dataSource?.supportsResearchRecords !== false ? <Link href={`/persons/${selectedRoute.personId}`} className="mt-4 flex justify-center bg-[#173f36] px-4 py-2.5 text-[9px] font-black tracking-[0.11em] text-white uppercase">Open person dossier</Link> : null}
          </div>
        ) : selectedHistorical ? (
          <div data-testid="historical-feature-details">
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone="blue">Historical context</StatusBadge>
              <StatusBadge tone={selectedHistoricalSnapshot?.status === "limited_static" ? "rust" : "green"}>
                {selectedHistoricalSnapshot?.status === "limited_static" ? "limited / static" : "primary interval"}
              </StatusBadge>
            </div>
            <h3 className="font-editorial mt-1 text-2xl leading-7 font-bold text-[#173f36]">
              {historicalMapLabel(selectedHistorical)}
            </h3>
            <p className="mt-2 text-[9px] font-black tracking-[0.12em] text-[#76536f] uppercase">
              {formatYearMonth(selectedHistorical.yearMonth, language)} · supplied {formatIsoDate(selectedHistorical.snapshotDate, language)}
            </p>
            <p className="mt-2 text-[9px] leading-4 text-[#6c746f]">
              Historical state or territory name followed by the supplied authority fields.
            </p>
            <dl className="mt-4 space-y-2 border-y border-[#ded8cc] py-3 text-[10px] leading-4">
              <div><dt className="font-bold text-[#4c5954]">Name</dt><dd className="break-words">{selectedHistorical.Name}</dd></div>
              {hasHistoricalSourceValue(selectedHistorical.Foreign_Po) ? <div><dt className="font-bold text-[#4c5954]">{historicalDetailLabel("Foreign_Po")}</dt><dd className="break-words">{selectedHistorical.Foreign_Po}</dd></div> : null}
              {hasHistoricalSourceValue(selectedHistorical.Head_of_St) ? <div><dt className="font-bold text-[#4c5954]">{historicalDetailLabel("Head_of_St")}</dt><dd className="break-words">{selectedHistorical.Head_of_St}</dd></div> : null}
              {hasHistoricalSourceValue(selectedHistorical.Govt_in_Ex) ? <div><dt className="font-bold text-[#4c5954]">{historicalDetailLabel("Govt_in_Ex")}</dt><dd className="break-words">{selectedHistorical.Govt_in_Ex}</dd></div> : null}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge tone="blue">source row {selectedHistorical.sourceFeatureIndex}</StatusBadge>
            </div>
            {selectedHistorical.editorialFlagIds.length ? (
              <div className="mt-3 border border-[#c89372] bg-[#fff5e9] p-2.5">
                <p className="text-[8px] font-black tracking-[0.11em] text-[#8c4b32] uppercase">Editorial / method flags</p>
                {selectedHistorical.editorialFlagIds.map((flag) => <p key={flag} className="mt-1 break-all text-[8px] leading-3 text-[#6b5d52]">{flag}</p>)}
              </div>
            ) : null}
            <p className="mt-3 text-[9px] leading-4 text-[#6f675f]">The authority field may identify a de facto ruler, governor, occupation official, prime minister or force rather than a constitutional head of state.</p>
            {historicalManifest ? (
              <>
                <p className="mt-3 border-t border-[#ded8cc] pt-3 text-[8px] leading-4 text-[#77716b]">{historicalManifest.methodologicalWarning}</p>
                <p className="mt-2 text-[7px] leading-3 text-[#8a837c]">{historicalManifest.source.attribution}</p>
              </>
            ) : null}
          </div>
        ) : !isPresentation && selectedPerson ? (
          <div>
            <p className="text-[9px] font-black tracking-[0.12em] text-[#9c5a3d] uppercase">Selected person</p>
            <h3 className="font-editorial mt-2 text-2xl leading-7 font-bold text-[#173f36]">{selectedPerson.label}</h3>
            <p className="mt-2 text-xs leading-5 text-[#61706a]">{selectedPersonRoutes.length ? `${selectedPersonRoutes.length} documented route segments are filtered on the map.` : "No documented route segments are associated with this person."}</p>
            <div className="mt-4 border-y border-[#ded8cc] py-2">
              <p className="text-[9px] font-black tracking-[0.12em] text-[#756347] uppercase">Person routes</p>
              {selectedPersonRoutes.length ? selectedPersonRoutes.map((route) => (
                <button key={route.id} type="button" className="mt-2 flex w-full items-center justify-between gap-2 border border-transparent bg-[#f6f2e9] px-2.5 py-2 text-left text-xs text-[#34473f] hover:border-[#8ba399] hover:bg-[#e9f0eb]" onClick={() => setSelection({ kind: "route", id: route.id })}>
                  <span>{route.originName} <span aria-hidden="true">→</span> {route.destinationName}</span>
                  <span className="shrink-0 text-[9px] text-[#68766e]">{route.routeStatus}</span>
                </button>
              )) : <p className="mt-2 text-xs text-[#68766e]">The person record remains available for provenance in the dossier.</p>}
            </div>
            <button type="button" className="presentation-secondary-button mt-3 w-full" onClick={() => openPersonStory(selectedPerson.id)}>Open person story</button>
            {dataSource?.supportsResearchRecords !== false ? <Link href={`/persons/${selectedPerson.id}`} className="mt-4 flex justify-center bg-[#173f36] px-4 py-2.5 text-[9px] font-black tracking-[0.11em] text-white uppercase">Open person dossier</Link> : null}
          </div>
        ) : (
          <div>
            <p className="text-sm leading-6 text-[#65716b]">{t("map.noSelection")}</p>
            <div className="mt-5 border-t border-[#ddd7cb] pt-4">
              <p className="text-[9px] font-black tracking-[0.13em] text-[#756347] uppercase">People and routes</p>
              <p className="mt-2 text-[10px] leading-4 text-[#65716b]">Choose a person or family in the Filters panel on the left. Keep Individual routes enabled under Layers → People and movement. The person’s documented routes then remain on the map; click a line to inspect its evidence here.</p>
            </div>
            <div className="mt-5 space-y-3 border-t border-[#ddd7cb] pt-4">
              <p className="text-[9px] font-black tracking-[0.13em] text-[#756347] uppercase">Route grammar</p>
              <div className="flex items-center gap-3 text-[10px]"><span className="h-1 w-12 bg-[#236353]" /> Movement route</div>
              <p className="pt-1 text-[9px] leading-4 text-[#7d8682]">Explicit, partial and inferred status remains available in the details; all routes use the same solid visual design.</p>
              <p className="pt-2 text-[9px] leading-4 text-[#7d8682]">Lines join evidence endpoints; they do not claim exact historic roads.</p>
            </div>
          </div>
        )}

        {layers.unresolved ? (
          <div className="mt-6 border-t border-[#d8d2c6] pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black tracking-[0.13em] text-[#a54f32] uppercase">Unresolved off-map</p>
              <span className="text-[9px] font-bold">{visibleUnresolved.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {visibleUnresolved.slice(0, 5).map((mention) => (
                <div key={mention.id} className="border border-dashed border-[#c9a99a] bg-[#fbf1ec] p-2.5">
                  <p className="font-serif text-xs font-bold">{mention.valueRaw}</p>
                  <p className="mt-1 text-[8px] text-[#7a746f]">{mention.role.replaceAll("_", " ")} · {mention.dossierId}</p>
                </div>
              ))}
              {!visibleUnresolved.length ? <p className="text-[10px] text-[#7a837f]">No unresolved mentions match these filters.</p> : null}
            </div>
          </div>
        ) : null}
      </aside>

      <section className="research-map__timeline border-t border-[#bdb7aa] bg-[#f8f5ed] p-3 lg:col-start-2 lg:row-start-2" data-testid="research-timeline">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-44">
            <p className="presentation-card__eyebrow">{t("map.timeline")}</p>
            <p className="font-editorial mt-1 text-lg font-bold text-[#173f36]">{selectedPerson?.label ?? "Select an individual"}</p>
          </div>
          <div className="flex min-w-0 grow items-center gap-2 overflow-x-auto py-1">
            {selectedPersonRoutes.length ? selectedPersonRoutes.map((route, index) => (
              <div key={route.id} className="flex min-w-fit items-center gap-2">
                <span className={`grid size-7 place-items-center rounded-full border text-sm font-bold ${timelineStep !== null && index < timelineStep ? "border-[#173f36] bg-[#173f36] text-white" : "border-[#9fa69f] bg-white text-[#56645e]"}`}>{route.sequence}</span>
                <span className="max-w-32 truncate text-sm text-[#5e6b65]">{route.destinationName}</span>
                {index < selectedPersonRoutes.length - 1 ? <span className="h-px w-8 bg-[#b9b3a7]" /> : null}
              </div>
            )) : <p className="text-[10px] text-[#747f79]">No person-specific route to play.</p>}
          </div>
          <div className="flex min-w-fit gap-1.5">
            <button type="button" disabled={!filters.person || !selectedPersonRoutes.length || isPlaying} onClick={startRoutePlayback} className="presentation-primary-button">{t("map.play")}</button>
            <button type="button" disabled={!isPlaying} onClick={() => setIsPlaying(false)} className="presentation-secondary-button">{t("map.pause")}</button>
            <button type="button" disabled={!filters.person} onClick={resetView} className="presentation-secondary-button">{t("map.reset")}</button>
          </div>
        </div>
        <p className="mt-2 text-[8px] text-[#838b87]">Playback is manual, slow and one-shot. Curved lines are visual guides between documented endpoints, not exact historical roads.</p>
        {activePlaybackWaypoint ? <div className="presentation-waypoint mt-2"><span className="presentation-label">Current documented place</span><strong>{language === "ro" ? activePlaybackWaypoint.labelRo : activePlaybackWaypoint.label}</strong>{activePlaybackRoute?.notes ? <span>{activePlaybackRoute.notes}</span> : null}</div> : null}
      </section>
      {personStoryModal}
    </div>
  );
}
