import { describe, expect, it } from "vitest";
import { isPresentationOnlyAllowedPath } from "@/lib/presentation-only";

describe("presentation-only deployment route policy", () => {
  it("allows only the Presentation Map and its required assets", () => {
    expect(isPresentationOnlyAllowedPath("/presentation/map")).toBe(true);
    expect(isPresentationOnlyAllowedPath("/presentation/map/")).toBe(true);
    expect(isPresentationOnlyAllowedPath("/_next/static/chunks/app.js")).toBe(true);
    expect(isPresentationOnlyAllowedPath("/data/historical-administration-full/manifest.json")).toBe(true);
    expect(isPresentationOnlyAllowedPath("/data/historical-administration-full/snapshots/1941-08.geojson")).toBe(true);
  });

  it("does not expose research or unrelated data routes", () => {
    expect(isPresentationOnlyAllowedPath("/")).toBe(false);
    expect(isPresentationOnlyAllowedPath("/map")).toBe(false);
    expect(isPresentationOnlyAllowedPath("/persons")).toBe(false);
    expect(isPresentationOnlyAllowedPath("/documents")).toBe(false);
    expect(isPresentationOnlyAllowedPath("/data/normalized/persons.json")).toBe(false);
    expect(isPresentationOnlyAllowedPath("/data/historical-administration/manifest.json")).toBe(false);
  });
});
