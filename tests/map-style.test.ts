import { describe, expect, it } from "vitest";
import {
  BASEMAP_LAYER_ID,
  BASEMAP_SOURCE_ID,
  BASEMAP_TILE_URL,
  RESEARCH_GRID_LAYER_ID,
  RESEARCH_GRID_SOURCE_ID,
  createResearchMapStyle,
} from "@/lib/map/style";

describe("resilient research map style", () => {
  it("uses a public no-key OpenStreetMap raster basemap with attribution", () => {
    const style = createResearchMapStyle();
    const source = style.sources[BASEMAP_SOURCE_ID];

    expect(source.type).toBe("raster");
    if (source.type !== "raster") throw new Error("Expected a raster basemap source");
    expect(source.tiles).toEqual([BASEMAP_TILE_URL]);
    expect(source.tileSize).toBe(256);
    expect(source.attribution).toContain("OpenStreetMap");
  });

  it("keeps an inline background and GeoJSON grid beneath project evidence", () => {
    const style = createResearchMapStyle();
    const layerIds = style.layers.map((layer) => layer.id);
    const gridSource = style.sources[RESEARCH_GRID_SOURCE_ID];

    expect(layerIds).toEqual([
      "research-paper",
      BASEMAP_LAYER_ID,
      RESEARCH_GRID_LAYER_ID,
    ]);
    expect(gridSource.type).toBe("geojson");
    if (gridSource.type !== "geojson") throw new Error("Expected a local GeoJSON grid");
    expect(gridSource.data).toMatchObject({ type: "FeatureCollection" });
  });

  it("does not depend on a remote style JSON, glyph endpoint or sprite sheet", () => {
    const first = createResearchMapStyle();
    const second = createResearchMapStyle();

    expect(first).not.toBe(second);
    expect(first).not.toHaveProperty("glyphs");
    expect(first).not.toHaveProperty("sprite");
  });
});
