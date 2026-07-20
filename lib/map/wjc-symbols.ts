import type { MapLocationType, MapPlaceDatum } from "@/lib/data/selectors";

/**
 * The WJC symbol sheet is a static vector reference. These small inline SVGs
 * are the reusable web form of the same silhouettes: they stay legible in a
 * monochrome print and accept the semantic token colour at render time.
 */
export function locationTypeForPlace(place: MapPlaceDatum): MapLocationType {
  if (place.id === "PL-CORE-DOROHOI") return "anchor";
  if (place.tipLoc) return place.tipLoc;
  if (place.layer === "unresolved" || place.placeType === "unresolved") return "unresolved";
  if (place.layer === "ehri_local") return place.placeType === "ghetto" ? "ghetto" : "camp";
  if (place.placeType === "ghetto") return "ghetto";
  if (place.placeType === "camp") return "camp";
  if (place.categories.includes("death")) return "death";
  if (place.categories.includes("forced_labour")) return "forced_labour";
  if (place.categories.includes("origin")) return "origin";
  if (place.categories.includes("evacuation_deportation")) return "destination";
  return "mentioned";
}

function svgPath(type: MapLocationType): string {
  switch (type) {
    case "origin":
      return '<path d="M3 11 12 4l9 7v9H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
    case "anchor":
      return '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="6.7" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M5.2 12 12 6.8l6.8 5.2v6H5.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>';
    case "ghetto":
      return '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/>';
    case "camp":
      return '<path d="m12 4 9 16H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
    case "execution":
      return '<path d="m5 5 14 14M19 5 5 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
    case "forced_labour":
      return '<path d="m6 18 11-12M14 5l5 1-3 3M8 20c2-3 5-4 8-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    case "station":
      return '<path d="M5 16h14M5 19h14M8 14v7M12 14v7M16 14v7M12 5v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
    case "gate":
      return '<path d="M8 4H5v16h3M16 4h3v16h-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/>';
    case "death":
      return '<path d="m12 3 8 9-8 9-8-9z" fill="currentColor" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>';
    case "destination":
      return '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>';
    case "unresolved":
      return '<path d="M8 5a8 8 0 1 1-3 6M5 7V4h3M16 19a8 8 0 0 1 3-6m1-2V8h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="12" y="16" text-anchor="middle" fill="currentColor" font-family="ui-monospace,monospace" font-size="10" font-weight="700">?</text>';
    case "mentioned":
      return '<circle cx="12" cy="12" r="3" fill="currentColor"/>';
  }
}

export function wjcSymbolSvg(
  type: MapLocationType,
  color: string,
  size: 14 | 18 | 24 = 18,
  selected = false,
): string {
  const selectedRing = selected
    ? '<circle cx="12" cy="12" r="11" fill="none" stroke="#4B3D9E" stroke-width="2"/>'
    : "";
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;color:${color}">${selectedRing}${svgPath(type)}</svg>`;
}

export function wjcSymbolPriority(type: MapLocationType): number {
  switch (type) {
    case "anchor": return 12;
    case "gate": return 11;
    case "execution":
    case "death": return 10;
    case "camp":
    case "ghetto": return 9;
    default: return 1;
  }
}
