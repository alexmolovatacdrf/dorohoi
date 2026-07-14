import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  HISTORICAL_CATEGORY_COLORS,
  defaultHistoricalSnapshot,
  historicalFeatureCollectionSchema,
  historicalManifestSchema,
  historicalSnapshotIndex,
  selectHistoricalSnapshot,
  type HistoricalFeatureCollection,
  type HistoricalManifest,
} from "@/lib/historical-administration/schemas";

const root = join(process.cwd(), "public/data/historical-administration");

function expectedMonths(): string[] {
  const result: string[] = [];
  let year = 1938;
  let month = 2;
  while (year < 1945 || (year === 1945 && month <= 5)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return result;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function collectPositions(value: unknown, output: Array<[number, number]>): void {
  if (!Array.isArray(value)) return;
  if (
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    output.push([value[0], value[1]]);
    return;
  }
  for (const child of value) collectPositions(child, output);
}

describe("European Borders WWII deterministic regional derivative", () => {
  let manifest: HistoricalManifest;
  const snapshots = new Map<string, HistoricalFeatureCollection>();

  beforeAll(async () => {
    manifest = historicalManifestSchema.parse(
      JSON.parse(await readFile(join(root, "manifest.json"), "utf8")),
    );
    for (const entry of manifest.snapshots) {
      const contents = await readFile(join(root, entry.file));
      snapshots.set(
        entry.yearMonth,
        historicalFeatureCollectionSchema.parse(
          JSON.parse(contents.toString("utf8")),
        ) as HistoricalFeatureCollection,
      );
    }
  });

  it("validates the complete ordered month sequence and supported intervals", () => {
    expect(manifest.snapshots.map((snapshot) => snapshot.yearMonth)).toEqual(
      expectedMonths(),
    );
    expect(manifest.snapshots).toHaveLength(88);
    expect(manifest.temporalCoverage).toMatchObject({
      start: "1938-02",
      end: "1945-05",
      primarySupported: { start: "1938-02", end: "1944-09" },
      limitedStatic: { start: "1944-10", end: "1945-05" },
    });
    expect(
      manifest.snapshots
        .filter((snapshot) => snapshot.yearMonth <= "1944-09")
        .every((snapshot) => snapshot.status === "primary"),
    ).toBe(true);
    expect(
      manifest.snapshots
        .filter((snapshot) => snapshot.yearMonth >= "1944-10")
        .every((snapshot) => snapshot.status === "limited_static"),
    ).toBe(true);
  });

  it("selects exact dates and rejects a month not supplied by the archive", () => {
    expect(defaultHistoricalSnapshot(manifest).yearMonth).toBe("1941-08");
    expect(selectHistoricalSnapshot(manifest, "1944-03").snapshotDate).toBe(
      "1944-03-31",
    );
    expect(historicalSnapshotIndex(manifest, "1938-02")).toBe(0);
    expect(historicalSnapshotIndex(manifest, "1945-05")).toBe(87);
    expect(() => selectHistoricalSnapshot(manifest, "1938-01")).toThrow(
      "No historical administration snapshot",
    );
    expect(
      historicalManifestSchema.safeParse({
        ...manifest,
        snapshots: [...manifest.snapshots].reverse(),
      }).success,
    ).toBe(false);
  });

  it("matches every derived file byte count and SHA-256 and preserves raw fields", async () => {
    for (const entry of manifest.snapshots) {
      const contents = await readFile(join(root, entry.file));
      expect(contents.byteLength, entry.yearMonth).toBe(entry.bytes);
      expect(sha256(contents), entry.yearMonth).toBe(entry.sha256);
      const collection = snapshots.get(entry.yearMonth);
      expect(collection?.features, entry.yearMonth).toHaveLength(
        entry.regionalFeatureCount,
      );
      for (const feature of collection?.features ?? []) {
        expect(feature.properties).toEqual(
          expect.objectContaining({
            Name: expect.any(String),
            Foreign_Po: expect.any(String),
            Head_of_St: expect.any(String),
            Govt_in_Ex: expect.any(String),
            yearMonth: entry.yearMonth,
            snapshotDate: entry.snapshotDate,
          }),
        );
      }
    }
  });

  it("contains only EPSG:4326 coordinates inside the documented regional crop", () => {
    const [west, south, east, north] = manifest.processing.regionalBbox;
    for (const [yearMonth, collection] of snapshots) {
      const positions: Array<[number, number]> = [];
      for (const feature of collection.features) {
        collectPositions(feature.geometry.coordinates, positions);
      }
      expect(positions.length, yearMonth).toBeGreaterThan(0);
      const longitudes = positions.map(([longitude]) => longitude);
      const latitudes = positions.map(([, latitude]) => latitude);
      expect(
        positions.every(([longitude, latitude]) =>
          Number.isFinite(longitude) && Number.isFinite(latitude)),
        yearMonth,
      ).toBe(true);
      expect(Math.min(...longitudes), `${yearMonth} west`).toBeGreaterThanOrEqual(west);
      expect(Math.max(...longitudes), `${yearMonth} east`).toBeLessThanOrEqual(east);
      expect(Math.min(...latitudes), `${yearMonth} south`).toBeGreaterThanOrEqual(south);
      expect(Math.max(...latitudes), `${yearMonth} north`).toBeLessThanOrEqual(north);
    }
    expect(manifest.projection).toMatchObject({
      source: "ESRI:102013",
      target: "EPSG:4326",
      transformationAccuracyMetres: 10,
    });
  });

  it("keeps Transnistria and Reichskommissariat Ukraine distinct", () => {
    const august = snapshots.get("1941-08")?.features ?? [];
    const augustTransnistria = august.find(
      (feature) => feature.properties.Name === "Transnistria",
    );
    expect(augustTransnistria?.properties).toMatchObject({
      Foreign_Po: "Romanian-occupied",
      Head_of_St: "Gheorghe Alexianu (Governor)",
      foreignPowerCategory: "romanian_occupied",
    });

    const september = snapshots.get("1941-09")?.features ?? [];
    const transnistria = september.find(
      (feature) => feature.properties.Name === "Transnistria",
    );
    const reichskommissariatUkraine = september.find(
      (feature) => feature.properties.Name === "Reichskommissariat Ukraine",
    );
    expect(transnistria?.id).not.toBe(reichskommissariatUkraine?.id);
    expect(reichskommissariatUkraine?.properties).toMatchObject({
      Foreign_Po: "German-occupied",
      Head_of_St: "Erich Koch (Reichskommissar)",
      foreignPowerCategory: "german_occupied",
    });
  });

  it("ends Transnistria after March 1944 without transferring its identity", () => {
    expect(
      snapshots
        .get("1944-03")
        ?.features.some((feature) => feature.properties.Name === "Transnistria"),
    ).toBe(true);
    for (const month of expectedMonths().filter((value) => value >= "1944-04")) {
      expect(
        snapshots
          .get(month)
          ?.features.some((feature) => feature.properties.Name === "Transnistria"),
        month,
      ).toBe(false);
    }
  });

  it("preserves the out-of-region October 1941 Italy anomaly as a separate editorial record", async () => {
    const editorial = JSON.parse(
      await readFile(
        join(process.cwd(), "data/editorial/historical-administration.json"),
        "utf8",
      ),
    ) as { records: Array<Record<string, unknown>> };
    const italy = editorial.records.find(
      (record) => record.id === "HA-ANOM-ITALY-1941-10-FOREIGN-PO",
    );
    expect(italy).toMatchObject({
      snapshot: "1941-10",
      featureNameRaw: "Italy",
      field: "Foreign_Po",
      valueRaw: "Allies",
      editorialValue: null,
      status: "flagged_unresolved",
    });
  });

  it("records the two required Transnistria territorial changes", async () => {
    const contents = await readFile(
      join(root, manifest.territorialChanges.file),
    );
    expect(contents.byteLength).toBe(manifest.territorialChanges.bytes);
    expect(sha256(contents)).toBe(manifest.territorialChanges.sha256);
    const collection = JSON.parse(contents.toString("utf8")) as {
      features: Array<{ properties: Record<string, string> }>;
    };
    const august = collection.features.find(
      (feature) => feature.properties.CHANGE_DAT === "19410819",
    );
    const april = collection.features.find(
      (feature) => feature.properties.CHANGE_DAT === "19440401",
    );
    expect(august?.properties).toMatchObject({
      TERRITORY_: "Transnistria",
      GOVT: "Romania",
      FORMER_GOV: "Soviet Union",
      changeDate: "1941-08-19",
    });
    expect(april?.properties).toMatchObject({
      TERRITORY_: "Transnistria",
      GOVT: "Soviet Union",
      FORMER_GOV: "Romania",
      changeDate: "1944-04-01",
    });
  });

  it("keeps the UI palette synchronized with the derived controlled vocabulary", () => {
    const manifestColors = Object.fromEntries(
      manifest.derivedForeignPowerVocabulary.legend.map((entry) => [
        entry.value,
        entry.color,
      ]),
    );
    expect(manifestColors).toEqual(HISTORICAL_CATEGORY_COLORS);
    expect(manifest.derivedForeignPowerVocabulary.method).toContain(
      "not an administration-type field",
    );
  });
});
