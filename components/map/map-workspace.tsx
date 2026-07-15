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
import { humanizeSlug, rawValueLabel } from "@/lib/data/format";
import type {
  MapPlaceDatum,
  MapPlacePersonContext,
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
  HISTORICAL_SOURCE_ID,
  defaultHistoricalSnapshot,
  displayRawHistoricalValue,
  formatYearMonth,
  historicalFeatureCollectionSchema,
  historicalFeaturePropertiesSchema,
  historicalManifestSchema,
  historicalManifestExtent,
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
    return [
      "match",
      ["get", "presentationCategory"],
      "sovereign_state",
      HISTORICAL_PRESENTATION_CATEGORY_COLORS.sovereign_state,
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

const PROJECT_REGION_BBOX: [number, number, number, number] = [
  19.0,
  43.3,
  34.5,
  52.6,
];

const controlClass =
  "w-full border border-[#c8c3b8] bg-white px-2.5 py-2 text-[11px] text-[#34473f] outline-none focus:border-[#2f6658]";
const basemapFallbackMessage =
  "OpenStreetMap tiles are unavailable. The local research grid, project places, routes, filters and layer controls remain active.";
const ANIMATION_SEGMENT_DURATION_MS = 3600;

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
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "historical-map-popup";

  const dateLabel = document.createElement("p");
  dateLabel.className = "historical-map-popup__date";
  dateLabel.textContent = `${formatYearMonth(properties.yearMonth)} · supplied ${properties.snapshotDate}`;

  const name = document.createElement("p");
  name.className = "historical-map-popup__name";
  name.textContent = displayRawHistoricalValue(properties.Name);

  const foreignPower = document.createElement("p");
  foreignPower.className = "historical-map-popup__detail";
  foreignPower.textContent = `Foreign_Po: ${displayRawHistoricalValue(properties.Foreign_Po)}`;

  if (properties.presentationCategory) {
    const presentationCategory = document.createElement("p");
    presentationCategory.className = "historical-map-popup__detail";
    presentationCategory.textContent = `Public category: ${properties.presentationCategory.replaceAll("_", " ")}`;
    root.append(presentationCategory);
  }

  const headOfState = document.createElement("p");
  headOfState.className = "historical-map-popup__detail";
  headOfState.textContent = `Head_of_St: ${displayRawHistoricalValue(properties.Head_of_St)}`;

  const instruction = document.createElement("p");
  instruction.className = "historical-map-popup__instruction";
  instruction.textContent = "Click for all raw fields and methodology.";

  root.append(dateLabel, name, foreignPower, headOfState, instruction);
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
  const siblings = routes
    .filter((candidate) => routeEndpointPairKey(candidate) === routeEndpointPairKey(route))
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  if (siblings.length > 1) {
    return siblings.indexOf(route) - (siblings.length - 1) / 2;
  }
  return route.sequence % 2 === 0 ? -0.5 : 0.5;
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
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      id: `progress-${route.id}`,
      geometry: {
        type: "Point",
        coordinates: routePointAtProgress(
          curvedRouteCoordinates(route, routeCurveOffset(route, routes)),
          easeInOutCubic(progress),
        ),
      },
      properties: {
        color: route.routeStatus === "partial"
          ? "#a54f32"
          : route.routeStatus === "inferred"
            ? "#7e6b8d"
            : "#236353",
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
  const value = [...context.roles, ...context.eventTypes].join(" ").toLocaleLowerCase("ro");
  if (/deces|death|mort|loss/.test(value)) return "Death or loss";
  if (/lagar|lagăr|ghetou|ghetto|camp|intern/.test(value)) return "Camp, ghetto or internment";
  if (/munca|muncă|forced|work/.test(value)) return "Forced labour";
  if (/deport|evac/.test(value)) return "Evacuation or deportation";
  if (/intoarc|întoarc|return|repatri/.test(value)) return "Return or repatriation";
  if (/nastere|naștere|birth|origin|domiciliu|residence|locuire/.test(value)) return "Birth, origin or residence";
  return "Other documented connection";
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
  };
  initialPerson?: string;
  initialPlace?: string;
}) {
  const { language, t } = useLanguage();
  const isPresentation = mode === "presentation";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const coreMarkersRef = useRef<Marker[]>([]);
  const historicalPopupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLifecycle, setMapLifecycle] = useState<MapLifecycle>("initializing");
  const [mapDiagnostic, setMapDiagnostic] = useState<string | null>(null);
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("loading");
  const [historicalManifest, setHistoricalManifest] = useState<HistoricalManifest | null>(null);
  const [historicalYearMonth, setHistoricalYearMonth] = useState("1941-08");
  const [historicalOpacity, setHistoricalOpacity] = useState(0.28);
  const [historicalLayerStatus, setHistoricalLayerStatus] = useState<HistoricalLayerStatus>("loading_manifest");
  const [historicalDiagnostic, setHistoricalDiagnostic] = useState<string | null>(null);
  const [historicalFeatureCount, setHistoricalFeatureCount] = useState(0);
  const [historicalReloadToken, setHistoricalReloadToken] = useState(0);
  const [historicalSnapshotReloadToken, setHistoricalSnapshotReloadToken] = useState(0);
  const [presentationPanelOpen, setPresentationPanelOpen] = useState(true);
  const [presentationPeoplePanelOpen, setPresentationPeoplePanelOpen] = useState(true);
  const [presentationViewport, setPresentationViewport] = useState<"europe" | "project" | "story">(
    initialPerson ? "story" : "europe",
  );
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
    inferred: false,
  }));
  const [timelineStep, setTimelineStep] = useState<number | null>(null);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
  const selectedPersonDossierMembers = useMemo(
    () => selectedPerson
      ? data.persons.filter((person) => person.dossierId === selectedPerson.dossierId && person.id !== selectedPerson.id)
      : [],
    [data.persons, selectedPerson],
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

  const visibleEhriPlaces = useMemo(
    () =>
      data.places.filter((place) => {
        if (place.layer !== "ehri_local" || !place.coordinates || !layers.localEhri || !layers.campsGhettos) return false;
        if (filters.place && place.id !== filters.place) return false;
        if (filters.person || filters.group || filters.dossier || filters.eventType || filters.fromYear || filters.toYear) return false;
        if (filters.confidence && place.confidence !== filters.confidence) return false;
        return true;
      }),
    [data.places, filters, layers.campsGhettos, layers.localEhri],
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
    if (!isPresentation || !filters.person || timelineStep === null) return null;
    return selectedPersonRoutes[timelineStep ?? 0] ?? null;
  }, [filters.person, isPresentation, selectedPersonRoutes, timelineStep]);

  const visibleRoutes = useMemo(() => {
    if (!filters.person) return preTimelineRoutes;
    if (!isPresentation) {
      if (timelineStep === null) return preTimelineRoutes;
      return preTimelineRoutes.filter((route) => route.sequence <= timelineStep);
    }
    if (timelineStep === null && !isPlaying) return preTimelineRoutes;
    const completedRouteIds = new Set(selectedPersonRoutes.slice(0, timelineStep ?? 0).map((route) => route.id));
    return preTimelineRoutes.filter((route) => completedRouteIds.has(route.id) || route.id === activePlaybackRoute?.id);
  }, [activePlaybackRoute?.id, filters.person, isPlaying, isPresentation, preTimelineRoutes, selectedPersonRoutes, timelineStep]);

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
        style: createResearchMapStyle(),
        center: isPresentation ? [18, 54] : [27.25, 48.08],
        zoom: isPresentation ? 3.2 : 6.1,
        attributionControl: false,
        fadeDuration: 0,
      });
      activeMap = map;
      mapRef.current = map;
      // The compass/pitch button is not useful for this 2D public atlas and
      // reads as a persistent arrow menu over the map. Keep only zoom controls.
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

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
              "line-opacity": 0.72,
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.55, 8, 1.25],
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
            layout: { "line-cap": "butt", "line-join": "round" },
            paint: { "line-color": "#a54f32", "line-width": 4, "line-dasharray": [2, 2], "line-opacity": 0.9 },
          });
          map.addLayer({
            id: "routes-inferred",
            type: "line",
            source: "research-routes",
            filter: ["==", ["get", "routeStatus"], "inferred"],
            paint: { "line-color": "#7e6b8d", "line-width": 3, "line-dasharray": [0.5, 2.5], "line-opacity": 0.75 },
          });
          map.addImage("route-arrow-explicit", routeArrow("#236353"));
          map.addImage("route-arrow-partial", routeArrow("#a54f32"));
          map.addImage("route-arrow-inferred", routeArrow("#7e6b8d"));

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
            id: "route-progress-halo",
            type: "circle",
            source: "route-progress",
            paint: {
              "circle-radius": 11,
              "circle-color": "rgba(255,253,248,0.92)",
              "circle-stroke-width": 1,
              "circle-stroke-color": ["get", "color"],
            },
          });
          map.addLayer({
            id: "route-progress-core",
            type: "circle",
            source: "route-progress",
            paint: {
              "circle-radius": 6,
              "circle-color": ["get", "color"],
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#ffffff",
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
          map.addLayer({
            id: "research-place-halos",
            type: "circle",
            source: "research-places",
            paint: {
              "circle-radius": 11,
              "circle-color": "rgba(255,253,248,0.88)",
              "circle-stroke-width": 1,
              "circle-stroke-color": "#173f36",
            },
          });
          map.addLayer({
            id: "research-place-cores",
            type: "circle",
            source: "research-places",
            paint: {
              "circle-radius": 6,
              "circle-color": ["get", "color"],
            },
          });
          map.addLayer({
            id: "ehri-place-halos",
            type: "circle",
            source: "ehri-places",
            paint: {
              "circle-radius": 7,
              "circle-color": "rgba(53,91,103,0.28)",
              "circle-stroke-width": 1,
              "circle-stroke-color": "#355b67",
            },
          });

          const placeLayers = ["research-place-halos", "research-place-cores", "ehri-place-halos"];
          for (const layerId of placeLayers) {
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
            map.on("click", layerId, (event) => {
              const id = event.features?.[0]?.properties?.id;
              if (typeof id === "string") setSelection({ kind: "place", id });
            });
          }
          const routeLayers = ["routes-explicit", "routes-partial", "routes-inferred", "route-direction"];
          for (const layerId of routeLayers) {
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
            map.on("click", layerId, (event) => {
              const id = event.features?.[0]?.properties?.id;
              if (typeof id === "string") setSelection({ kind: "route", id });
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
              .setDOMContent(historicalPopupContent(properties))
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
        isPresentation,
        isPresentation ? selectedPersonRoutes : visibleRoutes,
      ),
    );
    (map.getSource("route-progress") as GeoJSONSource).setData(
      activePlaybackRoute
        ? routeProgressCollection(
            activePlaybackRoute,
            timelineProgress,
            isPresentation ? selectedPersonRoutes : visibleRoutes,
          )
        : emptyPointCollection,
    );
  }, [activePlaybackRoute, familyContextPlaces, isPresentation, language, mapReady, selectedPersonRoutes, timelineProgress, visibleCorePlaces, visibleEhriPlaces, visibleRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(BASEMAP_LAYER_ID)) return;
    map.setLayoutProperty(BASEMAP_LAYER_ID, "visibility", layers.basemap ? "visible" : "none");
  }, [layers.basemap, mapReady]);

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
        setHistoricalFeatureCount(parsed.features.length);
        setHistoricalLayerStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        source.setData(emptyHistoricalCollection);
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
    const padding = isPresentation
      ? narrowPresentation
        ? { top: presentationPanelOpen ? 360 : 72, right: presentationPeoplePanelOpen ? 360 : 28, bottom: 170, left: 28 }
        : { top: 72, right: presentationPeoplePanelOpen ? 400 : 72, bottom: 170, left: presentationPanelOpen ? 400 : 72 }
      : 36;
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding,
        duration: isPresentation ? 1100 : 0,
        maxZoom: maxZoom ?? (isPresentation ? 7 : 9),
      },
    );
  }, [isPresentation, presentationPanelOpen, presentationPeoplePanelOpen]);

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
    fitMapToBbox(historicalManifestExtent(historicalManifest));
  }, [filters.person, historicalManifest, isPresentation, layers.historicalAdministration, mapReady, fitMapToBbox]);

  useEffect(() => {
    if (!isPresentation || !mapReady || !filters.person) return;
    fitPersonView();
  }, [filters.person, isPresentation, mapReady, fitPersonView]);

  useEffect(() => {
    if (!isPresentation || !mapReady || filters.person || !filters.group) return;
    fitGroupView();
  }, [filters.group, filters.person, fitGroupView, isPresentation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    coreMarkersRef.current.forEach((marker) => marker.remove());
    coreMarkersRef.current = visibleCorePlaces.flatMap((place) => {
      if (!place.coordinates) return [];
      const element = document.createElement("button");
      element.type = "button";
      element.className = "research-map-marker";
      element.setAttribute("aria-label", `Inspect ${language === "ro" ? place.labelRo : place.label}`);

      const label = document.createElement("span");
      label.className = "research-map-marker__label";
      label.textContent = language === "ro" ? place.labelRo : place.label;
      const [labelX, labelY] = mapLabelOffset(place.id);
      label.style.transform = `translate(${labelX}px, ${labelY}px)`;
      const pin = document.createElement("span");
      pin.className = "research-map-marker__pin";
      pin.style.backgroundColor = placeColor(place);
      pin.textContent = placeSymbol(place);
      element.append(label, pin);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelection({ kind: "place", id: place.id });
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
  }, [language, mapReady, visibleCorePlaces]);

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
    return [...grouped.entries()].map(([label, people]) => ({ label, people }));
  }, [data.persons, selectedPlace]);
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
  };

  const selectPresentationGroup = (groupId: string) => {
    setPresentationViewport("story");
    updateFilter("group", groupId);
    updateFilter("person", "");
    setTimelineStep(null);
    setTimelineProgress(0);
    setIsPlaying(false);
    setSelection(null);
  };

  const clearPresentationSelection = () => {
    setPresentationViewport("europe");
    updateFilter("person", "");
    updateFilter("group", "");
    setTimelineStep(null);
    setTimelineProgress(0);
    setIsPlaying(false);
    setSelection(null);
    if (isPresentation) {
      fitMapToBbox(historicalManifest ? historicalManifestExtent(historicalManifest) : [-31.2656, 27.6381, 68.6969, 81.8599]);
    }
  };

  const startPresentationPlayback = () => {
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
    setPresentationViewport("europe");
    if (historicalManifest) fitMapToBbox(historicalManifestExtent(historicalManifest));
  };

  const presentationLegend = historicalManifest?.presentationVocabulary?.legend ?? [];

  const presentationDetails = selectedPlace ? (
    <>
      <p className="presentation-card__eyebrow">Important place</p>
      <h2 className="presentation-card__title">{language === "ro" ? selectedPlace.labelRo : selectedPlace.label}</h2>
      <p className="presentation-card__body">
        {selectedPlace.categories.length
          ? selectedPlace.categories.map(publicPlaceCategoryLabel).join(" · ")
          : "A documented place in the current research collection."}
      </p>
      {selectedPlacePeople.length ? (
        <div className="presentation-place-people">
          <p className="presentation-label">People documented here</p>
          <p className="presentation-card__meta">Grouped only where the source gives an explicit person/place or event/place connection.</p>
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
      <p className="presentation-card__body">{selectedRoute.personName} · {rawValueLabel(selectedRoute.dateRaw)}</p>
      {selectedRoute.notes ? <p className="presentation-card__body">{selectedRoute.notes}</p> : null}
    </>
  ) : selectedHistorical ? (
    <>
      <p className="presentation-card__eyebrow">{formatYearMonth(selectedHistorical.yearMonth)} · {selectedHistorical.snapshotDate}</p>
      <h2 className="presentation-card__title">{displayRawHistoricalValue(selectedHistorical.Name)}</h2>
      <dl className="presentation-card__details">
        <div><dt>Public category</dt><dd>{selectedHistorical.presentationCategory?.replaceAll("_", " ") ?? "Unresolved or other"}</dd></div>
        <div><dt>Foreign_Po</dt><dd>{displayRawHistoricalValue(selectedHistorical.Foreign_Po)}</dd></div>
        <div><dt>Head_of_St</dt><dd>{displayRawHistoricalValue(selectedHistorical.Head_of_St)}</dd></div>
        <div><dt>Govt_in_Ex</dt><dd>{displayRawHistoricalValue(selectedHistorical.Govt_in_Ex)}</dd></div>
      </dl>
    </>
  ) : selectedPerson ? (
    <>
      <p className="presentation-card__eyebrow">Person / story</p>
      <h2 className="presentation-card__title">{selectedPerson.label}</h2>
      <p className="presentation-card__body">{selectedPersonRoutes.length ? `${selectedPersonRoutes.length} documented movement segments in the current research collection.` : "No documented route segments in the current research collection."}</p>
      {selectedPersonDossierMembers.length ? (
        <div className="presentation-card__family-context">
          <p className="presentation-label">Other people in this dossier</p>
          <p className="presentation-card__body">{selectedPersonDossierMembers.map((person) => person.label).join(" · ")}</p>
          <p className="presentation-card__meta">Each person remains an individual record; routes are not assigned to relatives without explicit evidence.</p>
        </div>
      ) : null}
      <p className="presentation-card__meta">The timeline below draws the route progressively and keeps the underlying evidence available in the research dossier.</p>
    </>
  ) : null;

  const presentationGroupDetails = selectedGroup ? (
    <>
      <p className="presentation-card__eyebrow">Family / dossier</p>
      <h2 className="presentation-card__title">{selectedGroup.label}</h2>
      <p className="presentation-card__body">{selectedGroup.personIds.length} people · {selectedGroupRoutes.length} documented movement segments.</p>
      <p className="presentation-card__body">Select an individual above to animate that person’s own documented route.</p>
      <p className="presentation-card__meta">Family context does not assign one person’s route to another person.</p>
    </>
  ) : null;
  const groupedPresentationPersonIds = new Set(data.groups.flatMap((group) => group.personIds));
  const ungroupedPresentationPeople = data.persons.filter((person) => !groupedPresentationPersonIds.has(person.id));

  const presentationPanel = presentationPanelOpen ? (
    <aside className="presentation-map__panel absolute top-3 left-3 z-20 w-[min(23rem,calc(100%-1.5rem))] overflow-y-auto border border-[#bdb7aa] bg-[#fffdf8]/96 p-4 shadow-[0_18px_45px_rgba(22,42,35,0.2)] backdrop-blur-md sm:top-5 sm:left-5 sm:max-h-[calc(100%-8rem)]">
      <div className="presentation-panel__header flex items-start justify-between gap-3">
        <div>
          <p className="presentation-card__eyebrow">Public presentation</p>
          <h2 className="font-editorial mt-1 text-2xl font-bold text-[#173f36]">Historical Europe</h2>
        </div>
        <button type="button" className="presentation-icon-button" onClick={() => setPresentationPanelOpen(false)} aria-label="Collapse presentation controls">−</button>
      </div>

      <p className="presentation-view-status" aria-live="polite">Active view: {presentationViewport === "europe" ? "Europe" : presentationViewport === "project" ? "Project region" : "Selected story"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {presentationMapConfig.europeView ? <button type="button" className={`presentation-secondary-button presentation-view-button${presentationViewport === "europe" ? " presentation-view-button--active" : ""}`} onClick={clearPresentationSelection} aria-pressed={presentationViewport === "europe"}>Europe view</button> : null}
        {presentationMapConfig.projectRegionView ? <button type="button" className={`presentation-secondary-button presentation-view-button${presentationViewport === "project" ? " presentation-view-button--active" : ""}`} onClick={() => { setPresentationViewport("project"); fitMapToBbox(PROJECT_REGION_BBOX, 8); }} aria-pressed={presentationViewport === "project"}>Project region</button> : null}
      </div>

      <details className="presentation-group" open={presentationMapConfig.historicalAdministration}>
        <summary>Historical context</summary>
        {presentationMapConfig.historicalAdministration ? (
          <div className="presentation-group__content">
            <LayerToggle label="Historical administration" marker="historical" checked={layers.historicalAdministration} onChange={(value) => updateLayer("historicalAdministration", value)} note={historicalLayerStatus === "ready" ? `${historicalFeatureCount} European polygons` : historicalLayerStatus === "failed" ? "Historical data unavailable" : "Monthly source snapshots"} />
            {layers.historicalAdministration ? <label className="presentation-opacity-control"><span className="presentation-label">Historical polygon opacity <strong>{Math.round(historicalOpacity * 100)}%</strong></span><input aria-label="Presentation polygon opacity" type="range" min={0.1} max={0.65} step={0.05} value={historicalOpacity} onChange={(event) => setHistoricalOpacity(Number(event.target.value))} className="w-full accent-[#76536f]" /></label> : null}
            <LayerToggle label="Modern basemap" marker="basemap" checked={layers.basemap} onChange={(value) => updateLayer("basemap", value)} note={basemapStatus === "available" ? "OpenStreetMap connected" : "Local grid remains available"} />
            {layers.historicalAdministration && historicalManifest && selectedHistoricalSnapshot ? (
              <div className="presentation-history-controls" data-testid="presentation-historical-controls">
                <label className="block">
                  <span className="presentation-label">Month and year</span>
                  <select aria-label="Presentation historical month" className={controlClass} value={historicalYearMonth} onChange={(event) => { setHistoricalYearMonth(event.target.value); setSelection(null); }} data-testid="presentation-month-select">
                    {historicalManifest.snapshots.map((snapshot) => <option key={snapshot.yearMonth} value={snapshot.yearMonth}>{formatYearMonth(snapshot.yearMonth)}{snapshot.status === "limited_static" ? " — limited/static" : ""}</option>)}
                  </select>
                </label>
                <input aria-label="Presentation historical timeline" type="range" min={0} max={historicalManifest.snapshots.length - 1} step={1} value={selectedHistoricalIndex} onChange={(event) => { const snapshot = historicalManifest.snapshots[Number(event.target.value)]; if (snapshot) { setHistoricalYearMonth(snapshot.yearMonth); setSelection(null); } }} className="mt-3 w-full accent-[#76536f]" data-testid="presentation-month-range" />
                <div className="presentation-history-controls__row"><span>{selectedHistoricalSnapshot.snapshotDate}</span><span>{selectedHistoricalSnapshot.status === "primary" ? "Primary interval" : "Limited/static"}</span></div>
                {presentationMapConfig.legend && presentationLegend.length ? <div className="presentation-legend" aria-label="Public historical legend"><p className="presentation-label">Public legend</p>{presentationLegend.map((entry) => <div key={entry.value} className="presentation-legend__item"><span style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</div>)}</div> : null}
                {selectedHistoricalSnapshot.status === "limited_static" ? <p className="presentation-warning">October 1944–May 1945 is limited/static evidence; it is not equivalent to the primary interval.</p> : null}
                <p className="presentation-method">{historicalManifest.methodologicalWarning}</p>
                <p className="presentation-attribution">{historicalManifest.source.attribution}</p>
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
          {presentationMapConfig.ehri ? <LayerToggle label="EHRI camps and ghettos" marker="ehri" checked={layers.localEhri} onChange={(value) => updateLayer("localEhri", value)} note="Supplied local registry" /> : null}
          {presentationMapConfig.unresolvedPlaces ? <LayerToggle label="Unresolved places" marker="unresolved" checked={layers.unresolved} onChange={(value) => updateLayer("unresolved", value)} note="Shown off-map when coordinates are unresolved" /> : null}
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
    <aside className="presentation-map__people absolute top-3 right-3 z-20 w-[min(24rem,calc(100%-1.5rem))] overflow-y-auto border border-[#bdb7aa] bg-[#fffdf8]/96 p-4 shadow-[0_18px_45px_rgba(22,42,35,0.2)] backdrop-blur-md sm:top-5 sm:right-5 sm:max-h-[calc(100%-8rem)]" data-testid="presentation-people-panel">
      <div className="presentation-panel__header flex items-start justify-between gap-3">
        <div>
          <p className="presentation-card__eyebrow">People and families</p>
          <h2 className="font-editorial mt-1 text-2xl font-bold text-[#173f36]">Select a story</h2>
        </div>
        <button type="button" className="presentation-icon-button" onClick={() => setPresentationPeoplePanelOpen(false)} aria-label="Collapse people and families">−</button>
      </div>
      {dataSource ? <p className="presentation-dataset-card mt-3" data-testid="presentation-data-source"><strong>{dataSource.label}</strong><br />{dataSource.description}{dataSource.sourceFile ? <><br />Source: {dataSource.sourceFile}</> : null}</p> : null}
      <p className="presentation-card__meta">The same person may be mentioned in one dossier and answer another investigation. Person records are kept linkable across dossiers; routes remain evidence-bound to that person.</p>
      <button type="button" className={`presentation-person-option presentation-person-option--all${!filters.person && !filters.group ? " presentation-person-option--selected" : ""}`} onClick={clearPresentationSelection} aria-pressed={!filters.person && !filters.group}>
        <span>All stories</span><span className="presentation-person-option__role">Europe view</span>
      </button>

      <div className="presentation-people-list">
        <p className="presentation-label">Families and mentioned people</p>
        <p className="presentation-card__meta">Each family starts with its documented head/declarant. People mentioned in the same file remain selectable individual records.</p>
        {data.groups.map((group) => {
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
          return (
            <div key={group.id} className="presentation-family-card">
              <button type="button" className={`presentation-group-option${(head ? filters.person === head.id : filters.group === group.id) ? " presentation-group-option--selected" : ""}`} onClick={() => head ? selectPresentationPerson(head.id) : selectPresentationGroup(group.id)} aria-pressed={head ? filters.person === head.id : filters.group === group.id}>
                <span><strong>{head?.label ?? group.label.replace(/\s+·\s+dosar\s+.*$/i, "")}</strong><small className="presentation-family-card__hint">{head ? "documented head / declarant" : "family or dossier group"}</small></span>
                <span className="presentation-person-option__role">{mentionedPeople.length ? `${mentionedPeople.length} mentioned` : "declarant"}</span>
              </button>
              {mentionedPeople.length ? (
                <details className="presentation-people-dossier">
                  <summary><span>People mentioned in this dossier</span><span>{mentionedPeople.length}</span></summary>
                  <div className="presentation-people-dossier__items">
                    {mentionedPeople.map((person) => (
                      <button key={person.id} type="button" className={`presentation-person-option${filters.person === person.id ? " presentation-person-option--selected" : ""}`} onClick={() => selectPresentationPerson(person.id)} aria-pressed={filters.person === person.id}>
                        <span>{person.label}</span><span className="presentation-person-option__role">{person.roles[0] ?? "mentioned person"}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
              {dossier ? <p className="presentation-family-card__meta">Internal record: {dossier.label}</p> : null}
            </div>
          );
        })}
        {ungroupedPresentationPeople.length ? <div className="presentation-family-card"><p className="presentation-label">Other individual records</p>{ungroupedPresentationPeople.map((person) => <button key={person.id} type="button" className={`presentation-person-option${filters.person === person.id ? " presentation-person-option--selected" : ""}`} onClick={() => selectPresentationPerson(person.id)} aria-pressed={filters.person === person.id}><span>{person.label}</span><span className="presentation-person-option__role">{person.roles[0] ?? "mentioned person"}</span></button>)}</div> : null}
      </div>

      {(presentationDetails || presentationGroupDetails) ? (
        <div className="presentation-people-detail" data-testid="presentation-story-card">
          <div className="mb-3 flex items-center justify-between gap-2"><p className="presentation-label">Selected detail</p><button type="button" className="presentation-icon-button" onClick={clearPresentationSelection} aria-label="Clear selected person or family">×</button></div>
          {presentationDetails ?? presentationGroupDetails}
          {selectedPerson ? <button type="button" disabled={!selectedPersonRoutes.length || isPlaying} className="presentation-primary-button mt-3" onClick={startPresentationPlayback}>{isPlaying ? "Playing route…" : selectedPersonRoutes.length ? "Play route" : "No documented route"}</button> : null}
          {selectedPlace ? <Link className="presentation-link-button" href={`/places/${selectedPlace.id}`}>Open place record</Link> : null}
          {selectedRoute ? <Link className="presentation-link-button" href={`/persons/${selectedRoute.personId}`}>Open person dossier</Link> : null}
          {selectedPerson && !selection ? <Link className="presentation-link-button" href={`/persons/${selectedPerson.id}`}>Open person dossier</Link> : null}
        </div>
      ) : null}
    </aside>
  ) : null;

  const presentationTimeline = presentationMapConfig.timeline ? (
    <section className="presentation-map__timeline absolute right-3 bottom-3 left-3 z-20 border border-[#bdb7aa] bg-[#fffdf8]/95 p-3 shadow-[0_12px_35px_rgba(22,42,35,0.18)] backdrop-blur-md sm:right-5 sm:bottom-5 sm:left-5" data-testid="presentation-timeline">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-44"><p className="presentation-card__eyebrow">Story timeline</p><p className="font-editorial text-lg font-bold text-[#173f36]">{selectedPerson?.label ?? "Select a person or story"}</p></div>
        <div className="flex min-w-0 grow items-center gap-2 overflow-x-auto py-1">{selectedPersonRoutes.length ? selectedPersonRoutes.map((route, index) => <div key={route.id} className="flex min-w-fit items-center gap-2"><span className={`grid size-7 place-items-center rounded-full border text-sm font-bold ${timelineStep !== null && index < timelineStep ? "border-[#173f36] bg-[#173f36] text-white" : "border-[#9fa69f] bg-white text-[#56645e]"}`}>{route.sequence}</span><span className="max-w-32 truncate text-sm text-[#5e6b65]">{route.destinationName}</span>{index < selectedPersonRoutes.length - 1 ? <span className="h-px w-8 bg-[#b9b3a7]" /> : null}</div>) : <p className="text-sm text-[#747f79]">No documented route selected.</p>}</div>
        <div className="flex min-w-fit gap-2"><button type="button" disabled={!filters.person || !selectedPersonRoutes.length || isPlaying} onClick={startPresentationPlayback} className="presentation-primary-button">Play once</button><button type="button" disabled={!isPlaying} onClick={() => setIsPlaying(false)} className="presentation-secondary-button">Pause</button><button type="button" onClick={resetView} className="presentation-secondary-button">Reset</button></div>
      </div>
      <p className="presentation-method mt-2">Playback is manual, slow and one-shot. Curved lines are visual guides between documented endpoints, not exact historical roads.</p>
      {activePlaybackWaypoint ? <div className="presentation-waypoint"><span className="presentation-label">Current documented place</span><strong>{language === "ro" ? activePlaybackWaypoint.labelRo : activePlaybackWaypoint.label}</strong>{activePlaybackRoute?.notes ? <span>{activePlaybackRoute.notes}</span> : null}</div> : null}
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
        className="map-workspace presentation-map-workspace relative isolate min-h-[680px] h-[calc(100vh-10rem)] overflow-hidden border-y border-[#bdb7aa] bg-[#d7d3ca]"
      >
        {renderMapCanvas()}
        {!interfaceHidden ? presentationPanel : null}
        {!interfaceHidden && !presentationPanelOpen ? <button type="button" className="presentation-map__reopen absolute top-3 left-3 z-30" onClick={() => setPresentationPanelOpen(true)}>Show controls</button> : null}
        {presentationPeoplePanel}
        {!interfaceHidden && !presentationPeoplePanelOpen && presentationMapConfig.personSelector ? <button type="button" className="presentation-map__reopen presentation-map__reopen--right absolute top-3 right-3 z-30" onClick={() => setPresentationPeoplePanelOpen(true)}>Show people</button> : null}
        {presentationTimeline}
        {interfaceHidden ? <div className="presentation-map__hidden-tools absolute top-3 left-3 z-30 flex items-center gap-2"><button type="button" className="presentation-secondary-button shadow-lg" onClick={() => setInterfaceHidden(false)}>Show interface</button>{presentationMapConfig.legend && presentationLegend.length ? <div className="presentation-compact-legend">{presentationLegend.map((entry) => <span key={entry.value} title={entry.label} style={{ backgroundColor: entry.color }} />)}</div> : null}</div> : null}
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
    <div className="map-workspace grid min-h-[760px] border-y border-[#bdb7aa] bg-[#e5e0d5] lg:h-[calc(100vh-9rem)] lg:min-h-[720px] lg:grid-cols-[260px_minmax(420px,1fr)_292px] lg:grid-rows-[minmax(480px,1fr)_auto]">
      <aside className="max-h-[36rem] overflow-y-auto border-b border-[#c8c1b4] bg-[#f6f2e9] p-4 lg:row-span-2 lg:max-h-none lg:border-r lg:border-b-0">
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
              {data.persons.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.group")}</span>
            <select className={controlClass} value={filters.group} onChange={(event) => updateFilter("group", event.target.value)}>
              <option value="">{t("common.all")}</option>
              {data.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
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
                        {formatYearMonth(historicalYearMonth)}
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
                        {formatYearMonth(snapshot.yearMonth)}{snapshot.status === "limited_static" ? " — limited/static" : ""}
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
                      Supplied {selectedHistoricalSnapshot.snapshotDate}
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
                    <p className="text-[8px] font-black tracking-[0.12em] text-[#76536f] uppercase">Foreign_Po display legend</p>
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

      <aside className="max-h-[38rem] overflow-y-auto border-t border-[#c8c1b4] bg-[#fffdf8] p-4 lg:row-span-2 lg:max-h-none lg:border-t-0 lg:border-l">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-editorial text-xl font-bold text-[#173f36]">{t("map.context")}</h2>
          {selection ? <button type="button" onClick={() => setSelection(null)} className="text-[9px] font-black tracking-[0.1em] text-[#a54f32] uppercase">{t("common.clear")}</button> : null}
        </div>
        {selectedPlace ? (
          <div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone={selectedPlace.layer === "ehri_local" ? "blue" : "green"}>{selectedPlace.placeType}</StatusBadge>
              <StatusBadge tone={selectedPlace.resolutionStatus === "unresolved" ? "rust" : "green"}>{selectedPlace.resolutionStatus.replaceAll("_", " ")}</StatusBadge>
            </div>
            <h3 className="font-editorial mt-3 text-2xl leading-7 font-bold text-[#173f36]">{language === "ro" ? selectedPlace.labelRo : selectedPlace.label}</h3>
            <p className="mt-3 text-xs leading-5 text-[#61706a]">{selectedPlace.roles.length ? selectedPlace.roles.join(" · ") : "Overlay location; no direct dossier mention in the current pilot."}</p>
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
              <div><dt className="inline font-bold">Date: </dt><dd className="inline">{rawValueLabel(selectedRoute.dateRaw)}</dd></div>
              <div><dt className="inline font-bold">Transport: </dt><dd className="inline">{selectedRoute.transportRaw ?? "Not supplied"}</dd></div>
              <div><dt className="inline font-bold">Line style: </dt><dd className="inline">{selectedRoute.routeStatus === "explicit" ? "solid" : "dashed"}</dd></div>
            </dl>
            {selectedRoute.notes ? <p className="mt-3 text-xs leading-5 text-[#61706a]">{selectedRoute.notes}</p> : null}
            <p className="mt-3 break-all text-[9px] leading-4 text-[#838b87]">{selectedRoute.sourceLabel}</p>
            <Link href={`/persons/${selectedRoute.personId}`} className="mt-4 flex justify-center bg-[#173f36] px-4 py-2.5 text-[9px] font-black tracking-[0.11em] text-white uppercase">Open person dossier</Link>
          </div>
        ) : selectedHistorical ? (
          <div data-testid="historical-feature-details">
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone="blue">Historical context</StatusBadge>
              <StatusBadge tone={selectedHistoricalSnapshot?.status === "limited_static" ? "rust" : "green"}>
                {selectedHistoricalSnapshot?.status === "limited_static" ? "limited / static" : "primary interval"}
              </StatusBadge>
            </div>
            <p className="mt-3 text-[9px] font-black tracking-[0.12em] text-[#76536f] uppercase">
              {formatYearMonth(selectedHistorical.yearMonth)} · supplied {selectedHistorical.snapshotDate}
            </p>
            <h3 className="font-editorial mt-1 text-2xl leading-7 font-bold text-[#173f36]">
              {displayRawHistoricalValue(selectedHistorical.Name)}
            </h3>
            <p className="mt-2 text-[9px] leading-4 text-[#6c746f]">
              Raw monthly DBF attributes. Field names and values are retained as supplied.
            </p>
            <dl className="mt-4 space-y-2 border-y border-[#ded8cc] py-3 text-[10px] leading-4">
              <div><dt className="font-bold text-[#4c5954]">Name</dt><dd className="break-words">{displayRawHistoricalValue(selectedHistorical.Name)}</dd></div>
              <div><dt className="font-bold text-[#4c5954]">Foreign_Po</dt><dd className="break-words">{displayRawHistoricalValue(selectedHistorical.Foreign_Po)}</dd></div>
              <div><dt className="font-bold text-[#4c5954]">Head_of_St</dt><dd className="break-words">{displayRawHistoricalValue(selectedHistorical.Head_of_St)}</dd></div>
              <div><dt className="font-bold text-[#4c5954]">Govt_in_Ex</dt><dd className="break-words">{displayRawHistoricalValue(selectedHistorical.Govt_in_Ex)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge tone="gold">{selectedHistorical.foreignPowerCategory.replaceAll("_", " ")}</StatusBadge>
              <StatusBadge tone="blue">source row {selectedHistorical.sourceFeatureIndex}</StatusBadge>
            </div>
            {selectedHistorical.editorialFlagIds.length ? (
              <div className="mt-3 border border-[#c89372] bg-[#fff5e9] p-2.5">
                <p className="text-[8px] font-black tracking-[0.11em] text-[#8c4b32] uppercase">Editorial / method flags</p>
                {selectedHistorical.editorialFlagIds.map((flag) => <p key={flag} className="mt-1 break-all text-[8px] leading-3 text-[#6b5d52]">{flag}</p>)}
              </div>
            ) : null}
            <p className="mt-3 text-[9px] leading-4 text-[#6f675f]"><code>Head_of_St</code> may identify a de facto ruler, governor, occupation official, prime minister or force rather than a constitutional head of state.</p>
            {historicalManifest ? (
              <>
                <p className="mt-3 border-t border-[#ded8cc] pt-3 text-[8px] leading-4 text-[#77716b]">{historicalManifest.methodologicalWarning}</p>
                <p className="mt-2 text-[7px] leading-3 text-[#8a837c]">{historicalManifest.source.attribution}</p>
              </>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="text-sm leading-6 text-[#65716b]">{t("map.noSelection")}</p>
            <div className="mt-5 space-y-3 border-t border-[#ddd7cb] pt-4">
              <p className="text-[9px] font-black tracking-[0.13em] text-[#756347] uppercase">Route grammar</p>
              <div className="flex items-center gap-3 text-[10px]"><span className="h-1 w-12 bg-[#236353]" /> Explicit movement</div>
              <div className="flex items-center gap-3 text-[10px]"><span className="w-12 border-t-2 border-dashed border-[#a54f32]" /> Partial movement</div>
              <div className="flex items-center gap-3 text-[10px]"><span className="w-12 border-t-2 border-dotted border-[#7e6b8d]" /> Inferred, off by default</div>
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

      <section className="border-t border-[#bdb7aa] bg-[#f8f5ed] p-4 lg:col-start-2 lg:row-start-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-44">
            <p className="text-[8px] font-black tracking-[0.13em] text-[#7b6750] uppercase">{t("map.timeline")}</p>
            <p className="font-editorial mt-1 text-lg font-bold text-[#173f36]">{selectedPerson?.label ?? "Select an individual"}</p>
          </div>
          <div className="flex min-w-0 grow items-center gap-2 overflow-x-auto py-1">
            {selectedPersonRoutes.length ? selectedPersonRoutes.map((route, index) => (
              <div key={route.id} className="flex min-w-fit items-center gap-2">
                <span className={`grid size-6 place-items-center rounded-full border text-[9px] font-bold ${timelineStep !== null && route.sequence <= timelineStep ? "border-[#173f36] bg-[#173f36] text-white" : "border-[#9fa69f] bg-white text-[#56645e]"}`}>{route.sequence}</span>
                <span className="max-w-28 truncate text-[9px] text-[#5e6b65]">{route.destinationName}</span>
                {index < selectedPersonRoutes.length - 1 ? <span className="h-px w-8 bg-[#b9b3a7]" /> : null}
              </div>
            )) : <p className="text-[10px] text-[#747f79]">No person-specific route to play.</p>}
          </div>
          <div className="flex min-w-fit gap-1.5">
            <button type="button" disabled={!filters.person || !selectedPersonRoutes.length || isPlaying} onClick={() => { if (timelineStep === null || timelineStep >= selectedPersonRoutes.length) setTimelineStep(0); setIsPlaying(true); }} className="bg-[#173f36] px-3 py-2 text-[9px] font-black tracking-[0.08em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-35">{t("map.play")}</button>
            <button type="button" disabled={!isPlaying} onClick={() => setIsPlaying(false)} className="border border-[#9fa49e] px-3 py-2 text-[9px] font-black tracking-[0.08em] uppercase disabled:opacity-35">{t("map.pause")}</button>
            <button type="button" disabled={!filters.person} onClick={() => { setIsPlaying(false); setTimelineStep(0); }} className="border border-[#9fa49e] px-3 py-2 text-[9px] font-black tracking-[0.08em] uppercase disabled:opacity-35">{t("map.reset")}</button>
          </div>
        </div>
        <p className="mt-2 text-[8px] text-[#838b87]">{t("map.noAnimation")}</p>
      </section>
    </div>
  );
}
