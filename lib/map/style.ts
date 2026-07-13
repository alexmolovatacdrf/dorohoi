import type { FeatureCollection, GeoJsonProperties, LineString } from "geojson";
import type { StyleSpecification } from "maplibre-gl";

export const BASEMAP_SOURCE_ID = "openstreetmap-basemap";
export const BASEMAP_LAYER_ID = "openstreetmap-basemap";
export const BASEMAP_TILE_HOST = "tile.openstreetmap.org";
export const BASEMAP_TILE_URL = `https://${BASEMAP_TILE_HOST}/{z}/{x}/{y}.png`;
export const RESEARCH_GRID_SOURCE_ID = "research-grid";
export const RESEARCH_GRID_LAYER_ID = "research-grid";

const researchGrid: FeatureCollection<LineString, GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [
    ...[24, 25, 26, 27, 28, 29, 30].map((longitude) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [[longitude, 45], [longitude, 51]],
      },
      properties: {},
    })),
    ...[45, 46, 47, 48, 49, 50, 51].map((latitude) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [[23, latitude], [31, latitude]],
      },
      properties: {},
    })),
  ],
};

/**
 * Returns a fresh inline style for each MapLibre instance.
 *
 * The public raster source supplies ordinary geographic context when the
 * network is available. The background and research grid are deliberately
 * local, so a failed tile request cannot remove project routes or places.
 * Glyphs and sprites are not required: raster labels are part of the tiles and
 * project symbols are generated locally.
 */
export function createResearchMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Dosare Dorohoi resilient research map",
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: "raster",
        tiles: [BASEMAP_TILE_URL],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      },
      [RESEARCH_GRID_SOURCE_ID]: {
        type: "geojson",
        data: researchGrid,
      },
    },
    layers: [
      {
        id: "research-paper",
        type: "background",
        paint: { "background-color": "#dfe3dc" },
      },
      {
        id: BASEMAP_LAYER_ID,
        type: "raster",
        source: BASEMAP_SOURCE_ID,
        paint: {
          "raster-opacity": 0.88,
          "raster-saturation": -0.28,
          "raster-contrast": -0.06,
          "raster-brightness-min": 0.1,
          "raster-brightness-max": 0.96,
          "raster-fade-duration": 0,
        },
      },
      {
        id: RESEARCH_GRID_LAYER_ID,
        type: "line",
        source: RESEARCH_GRID_SOURCE_ID,
        paint: {
          "line-color": "#49675c",
          "line-width": 1,
          "line-opacity": 0.23,
          "line-dasharray": [2, 3],
        },
      },
    ],
  };
}
