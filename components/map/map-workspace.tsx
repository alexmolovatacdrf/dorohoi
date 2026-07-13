"use client";

import type { FeatureCollection, GeoJsonProperties, LineString, Point } from "geojson";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
} from "maplibre-gl";
import { useLanguage } from "@/components/shell/language-provider";
import { StatusBadge, confidenceTone } from "@/components/ui/status-badge";
import { humanizeSlug, rawValueLabel } from "@/lib/data/format";
import type { MapPlaceDatum, MapRouteDatum, MapViewModel } from "@/lib/data/selectors";
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

type Selection = { kind: "place" | "route"; id: string } | null;
type MapLifecycle = "initializing" | "ready" | "failed";
type BasemapStatus = "loading" | "available" | "unavailable";

const emptyPointCollection: FeatureCollection<Point, GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [],
};
const emptyLineCollection: FeatureCollection<LineString, GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [],
};

const controlClass =
  "w-full border border-[#c8c3b8] bg-white px-2.5 py-2 text-[11px] text-[#34473f] outline-none focus:border-[#2f6658]";
const basemapFallbackMessage =
  "OpenStreetMap tiles are unavailable. The local research grid, project places, routes, filters and layer controls remain active.";

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
  return (
    <label className={`flex items-start gap-2.5 py-1.5 text-[10px] leading-4 ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer text-[#44534d]"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} className="mt-0.5 accent-[#2f6658]" />
      <span aria-hidden="true" className="w-4 text-center font-bold text-[#9c5b3e]">{marker}</span>
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

function routeCollection(routes: MapRouteDatum[]): FeatureCollection<LineString, GeoJsonProperties> {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      id: route.id,
      geometry: { type: "LineString", coordinates: route.coordinates },
      properties: {
        id: route.id,
        label: `${route.originName} → ${route.destinationName}`,
        personId: route.personId,
        personName: route.personName,
        routeStatus: route.routeStatus,
        confidence: route.confidence,
      },
    })),
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

export function MapWorkspace({
  data,
  initialPerson = "",
  initialPlace = "",
}: {
  data: MapViewModel;
  initialPerson?: string;
  initialPlace?: string;
}) {
  const { language, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const coreMarkersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapLifecycle, setMapLifecycle] = useState<MapLifecycle>("initializing");
  const [mapDiagnostic, setMapDiagnostic] = useState<string | null>(null);
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("loading");
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
  const [layers, setLayers] = useState<Layers>({
    basemap: true,
    locations: true,
    individualRoutes: true,
    familyContext: true,
    origin: true,
    evacuationDeportation: true,
    campsGhettos: true,
    forcedLabour: true,
    death: true,
    return: true,
    unresolved: true,
    localEhri: false,
    inferred: false,
  });
  const [timelineStep, setTimelineStep] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedGroup = data.groups.find((group) => group.id === filters.group);
  const selectedPerson = data.persons.find((person) => person.id === filters.person);
  const selectedPersonRoutes = useMemo(
    () => data.routes.filter((route) => route.personId === filters.person).sort((left, right) => left.sequence - right.sequence),
    [data.routes, filters.person],
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

  const visibleRoutes = useMemo(() => {
    if (!filters.person || timelineStep === null) return preTimelineRoutes;
    return preTimelineRoutes.filter((route) => route.sequence <= timelineStep);
  }, [filters.person, preTimelineRoutes, timelineStep]);

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
        center: [27.25, 48.08],
        zoom: 6.1,
        attributionControl: false,
        fadeDuration: 0,
      });
      activeMap = map;
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
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
          map.addSource("research-places", { type: "geojson", data: emptyPointCollection });
          map.addSource("ehri-places", { type: "geojson", data: emptyPointCollection });
          map.addSource("family-places", { type: "geojson", data: emptyPointCollection });
          map.addSource("research-routes", { type: "geojson", data: emptyLineCollection });

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
          for (const layerId of ["routes-explicit", "routes-partial", "routes-inferred", "route-direction"]) {
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
            map.on("click", layerId, (event) => {
              const id = event.features?.[0]?.properties?.id;
              if (typeof id === "string") setSelection({ kind: "route", id });
            });
          }
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
      activeMap?.remove();
      if (mapRef.current === activeMap) mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    (map.getSource("research-places") as GeoJSONSource).setData(pointCollection(visibleCorePlaces, language));
    (map.getSource("ehri-places") as GeoJSONSource).setData(pointCollection(visibleEhriPlaces, language));
    (map.getSource("family-places") as GeoJSONSource).setData(pointCollection(familyContextPlaces, language));
    (map.getSource("research-routes") as GeoJSONSource).setData(routeCollection(visibleRoutes));
  }, [familyContextPlaces, language, mapReady, visibleCorePlaces, visibleEhriPlaces, visibleRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(BASEMAP_LAYER_ID)) return;
    map.setLayoutProperty(BASEMAP_LAYER_ID, "visibility", layers.basemap ? "visible" : "none");
  }, [layers.basemap, mapReady]);

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
    const timer = window.setTimeout(() => {
      const nextStep = step + 1;
      setTimelineStep(nextStep);
      if (nextStep >= selectedPersonRoutes.length) setIsPlaying(false);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [filters.person, isPlaying, selectedPersonRoutes.length, timelineStep]);

  const selectedPlace = selection?.kind === "place" ? data.places.find((place) => place.id === selection.id) : null;
  const selectedRoute = selection?.kind === "route" ? data.routes.find((route) => route.id === selection.id) : null;

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const updateLayer = <K extends keyof Layers>(key: K, value: Layers[K]) =>
    setLayers((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid min-h-[760px] border-y border-[#bdb7aa] bg-[#e5e0d5] lg:h-[calc(100vh-9rem)] lg:min-h-[720px] lg:grid-cols-[260px_minmax(420px,1fr)_292px] lg:grid-rows-[minmax(480px,1fr)_auto]">
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
            <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.dossier")}</span>
            <select className={controlClass} value={filters.dossier} onChange={(event) => updateFilter("dossier", event.target.value)}>
              <option value="">{t("common.all")}</option>
              {data.dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.id}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[8px] font-black tracking-[0.12em] text-[#66736d] uppercase">{t("map.place")}</span>
            <select className={controlClass} value={filters.place} onChange={(event) => { updateFilter("place", event.target.value); if (event.target.value) setSelection({ kind: "place", id: event.target.value }); }}>
              <option value="">{t("common.all")}</option>
              {data.places.filter((place) => place.layer !== "ehri_local").map((place) => <option key={place.id} value={place.id}>{language === "ro" ? place.labelRo : place.label}</option>)}
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

        <div className="mt-5 border-t border-[#d2ccbf] pt-4">
          <h2 className="font-editorial mb-2 text-lg font-bold text-[#173f36]">{t("map.layers")}</h2>
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
          <LayerToggle label="Locations" marker="●" checked={layers.locations} onChange={(value) => updateLayer("locations", value)} />
          <LayerToggle label="Individual routes" marker="→" checked={layers.individualRoutes} onChange={(value) => updateLayer("individualRoutes", value)} />
          <LayerToggle label="Family / household context" marker="○" checked={layers.familyContext} onChange={(value) => updateLayer("familyContext", value)} note="Gold rings; requires a group filter" />
          <LayerToggle label="Origin places" marker="●" checked={layers.origin} onChange={(value) => updateLayer("origin", value)} />
          <LayerToggle label="Evacuation & deportation" marker="◆" checked={layers.evacuationDeportation} onChange={(value) => updateLayer("evacuationDeportation", value)} />
          <LayerToggle label="Camps & ghettos" marker="▲" checked={layers.campsGhettos} onChange={(value) => updateLayer("campsGhettos", value)} />
          <LayerToggle label="Forced labour" marker="✚" checked={layers.forcedLabour} onChange={(value) => updateLayer("forcedLabour", value)} />
          <LayerToggle label="Death places" marker="✦" checked={layers.death} onChange={(value) => updateLayer("death", value)} />
          <LayerToggle label="Return / repatriation" marker="↩" checked={layers.return} onChange={(value) => updateLayer("return", value)} />
          <LayerToggle label="Unresolved places" marker="?" checked={layers.unresolved} onChange={(value) => updateLayer("unresolved", value)} note="Listed off-map; no fabricated points" />
          <LayerToggle label="Local EHRI overlay" marker="■" checked={layers.localEhri} onChange={(value) => updateLayer("localEhri", value)} note={`${data.places.filter((place) => place.layer === "ehri_local").length} supplied records`} />
          <LayerToggle label="Inferred routes" marker="⋯" checked={layers.inferred} onChange={(value) => updateLayer("inferred", value)} note="Disabled by default; none in pilot" />
          <div className="mt-2 border-t border-[#ddd7ca] pt-2">
            <LayerToggle label="Historical boundaries" marker="▧" checked={false} onChange={() => undefined} disabled note="Registry placeholder" />
            <LayerToggle label="WMS / WMTS services" marker="▤" checked={false} onChange={() => undefined} disabled note="Registry placeholder" />
          </div>
        </div>
      </aside>

      <div
        className="relative min-h-[540px] min-w-0 overflow-hidden bg-[#d7d3ca] lg:min-h-0"
        data-map-state={mapLifecycle}
      >
        <div aria-hidden="true" className="map-local-fallback-grid absolute inset-0" />
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ position: "absolute", inset: 0 }}
          aria-label="Interactive historical research map"
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
        <div className="pointer-events-none absolute top-3 left-3 border border-[#a9a397] bg-[#fffdf8]/92 px-3 py-2 shadow-md backdrop-blur-sm">
          <p className="text-[8px] font-black tracking-[0.13em] text-[#6f7974] uppercase">Visible evidence</p>
          <p className="mt-1 text-xs font-bold text-[#173f36]">{visibleCorePlaces.length} core · {visibleRoutes.length} routes · {visibleEhriPlaces.length} EHRI</p>
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
          <p className="mt-0.5 text-[8px] text-[#707b76]">Research grid · no boundary claims</p>
        </div>
      </div>

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
