import claudeDemo from "@/data/demo/claude-map-demo.json";
import type {
  MapPlaceDatum,
  MapRouteDatum,
  MapViewModel,
} from "@/lib/data/selectors";

export const CLAUDE_DEMO_SOURCE = {
  key: "claude-demo",
  label: "Claude demo data",
  description: "48 persons · 11 dossiers · 15 places · 26 route segments",
  sourceFile: claudeDemo.metadata.sourceFile,
  sourceSha256: claudeDemo.metadata.sourceSha256,
} as const;

const mapData: MapViewModel = {
  places: claudeDemo.places.map((place): MapPlaceDatum => ({
    ...place,
    placeType: place.placeType as MapPlaceDatum["placeType"],
    layer: place.layer as MapPlaceDatum["layer"],
    confidence: place.confidence as MapPlaceDatum["confidence"],
    resolutionStatus: place.resolutionStatus as MapPlaceDatum["resolutionStatus"],
    categories: place.categories as MapPlaceDatum["categories"],
  })),
  routes: claudeDemo.routes.map((route): MapRouteDatum => ({
    ...route,
    dossierId: route.dossierId ? `claude-dossier-${route.dossierId}` : null,
    coordinates: [
      route.coordinates[0] as [number, number],
      route.coordinates[1] as [number, number],
    ],
    routeStatus: route.routeStatus as MapRouteDatum["routeStatus"],
    confidence: route.confidence as MapRouteDatum["confidence"],
  })),
  persons: claudeDemo.persons.map((person) => ({
    ...person,
    dossierId: person.dossierId ? `claude-dossier-${person.dossierId}` : null,
  })),
  groups: claudeDemo.groups.map((group) => ({
    ...group,
    kind: group.kind as "family" | "household",
  })),
  dossiers: claudeDemo.dossiers,
  eventTypes: claudeDemo.eventTypes,
  unresolvedMentions: claudeDemo.unresolvedMentions,
};

export function getClaudeDemoMapViewModel(): MapViewModel {
  return mapData;
}
