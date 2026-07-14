import type {
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";
import { z } from "zod";

export const HISTORICAL_MANIFEST_URL =
  "/data/historical-administration/manifest.json";
export const HISTORICAL_SOURCE_ID = "historical-administration";
export const HISTORICAL_FILL_LAYER_ID = "historical-administration-fill";
export const HISTORICAL_LINE_LAYER_ID = "historical-administration-line";
export const HISTORICAL_CATEGORY_COLORS = {
  unclassified: "#aea99e",
  neutral: "#c5b98f",
  allied: "#6485a3",
  axis: "#88545a",
  axis_aligned: "#9b6b55",
  belligerent: "#8f7b5a",
  german_occupied: "#76536f",
  italian_occupied: "#9c7350",
  romanian_occupied: "#b87944",
  multinational_axis_occupied: "#714743",
  german_soviet_occupied: "#69617c",
} as const;

export const historicalSnapshotStatusSchema = z.enum([
  "primary",
  "limited_static",
]);

export const historicalSnapshotEntrySchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  snapshotDate: z.iso.date(),
  status: historicalSnapshotStatusSchema,
  file: z.string().min(1),
  url: z.string().startsWith("/data/historical-administration/"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  sourceRecordCount: z.number().int().positive(),
  regionalFeatureCount: z.number().int().nonnegative(),
});

const historicalLegendEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
});

export const historicalManifestSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    archiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
    attribution: z.string().min(1),
    useLimit: z.string().min(1),
  }),
  projection: z.object({
    source: z.literal("ESRI:102013"),
    target: z.literal("EPSG:4326"),
    coordinateOrder: z.literal("longitude, latitude"),
    transformationDescription: z.string().min(1),
    transformationDefinition: z.string().min(1),
    transformationAccuracyMetres: z.number().nonnegative(),
  }),
  processing: z.object({
    regionalBbox: z.tuple([
      z.number(),
      z.number(),
      z.number(),
      z.number(),
    ]),
    regionalScope: z.string().min(1),
    cropIsResearchWindowNotBoundary: z.literal(true),
    simplifyToleranceDegrees: z.number().positive(),
    coordinateDecimals: z.number().int().positive(),
  }).passthrough(),
  temporalCoverage: z.object({
    start: z.string().regex(/^\d{4}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}$/),
    primarySupported: z.object({
      start: z.string().regex(/^\d{4}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}$/),
    }),
    limitedStatic: z.object({
      start: z.string().regex(/^\d{4}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}$/),
      reason: z.string().min(1),
    }),
    defaultYearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  rawMonthlyAttributes: z.tuple([
    z.literal("Name"),
    z.literal("Foreign_Po"),
    z.literal("Head_of_St"),
    z.literal("Govt_in_Ex"),
  ]),
  derivedForeignPowerVocabulary: z.object({
    field: z.literal("foreignPowerCategory"),
    sourceField: z.literal("Foreign_Po"),
    method: z.string().min(1),
    rawValueMapping: z.record(z.string(), z.string()),
    legend: z.array(historicalLegendEntrySchema).min(1),
  }),
  methodologicalWarning: z.string().min(1),
  snapshots: z.array(historicalSnapshotEntrySchema).min(1),
  snapshotByYearMonth: z.record(z.string(), z.string()),
  territorialChanges: z.object({
    file: z.string().min(1),
    url: z.string().startsWith("/data/historical-administration/"),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive(),
    sourceRecordCount: z.number().int().positive(),
    regionalFeatureCount: z.number().int().nonnegative(),
  }).passthrough(),
  sourceAssertions: z.record(z.string(), z.unknown()),
}).superRefine((manifest, context) => {
  const yearMonths = manifest.snapshots.map((snapshot) => snapshot.yearMonth);
  const sortedYearMonths = [...yearMonths].sort();
  if (
    new Set(yearMonths).size !== yearMonths.length ||
    yearMonths.some((yearMonth, index) => yearMonth !== sortedYearMonths[index])
  ) {
    context.addIssue({
      code: "custom",
      message: "Historical snapshots must be unique and chronologically ordered",
      path: ["snapshots"],
    });
  }
  if (
    yearMonths[0] !== manifest.temporalCoverage.start ||
    yearMonths.at(-1) !== manifest.temporalCoverage.end
  ) {
    context.addIssue({
      code: "custom",
      message: "Temporal coverage must match the first and last snapshots",
      path: ["temporalCoverage"],
    });
  }
  for (const snapshot of manifest.snapshots) {
    if (manifest.snapshotByYearMonth[snapshot.yearMonth] !== snapshot.file) {
      context.addIssue({
        code: "custom",
        message: `Snapshot index mismatch for ${snapshot.yearMonth}`,
        path: ["snapshotByYearMonth", snapshot.yearMonth],
      });
    }
  }
  if (!yearMonths.includes(manifest.temporalCoverage.defaultYearMonth)) {
    context.addIssue({
      code: "custom",
      message: "Default historical month is not present in snapshots",
      path: ["temporalCoverage", "defaultYearMonth"],
    });
  }
});

export const historicalFeaturePropertiesSchema = z.object({
  Name: z.string(),
  Foreign_Po: z.string(),
  Head_of_St: z.string(),
  Govt_in_Ex: z.string(),
  editorialFlagIds: z.array(z.string()),
  foreignPowerCategory: z.string().min(1),
  snapshotDate: z.iso.date(),
  sourceFeatureIndex: z.number().int().nonnegative(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

const positionSchema = z.tuple([z.number().finite(), z.number().finite()]);
const linearRingSchema = z.array(positionSchema).min(4);
const polygonCoordinatesSchema = z.array(linearRingSchema).min(1);
const multiPolygonCoordinatesSchema = z.array(polygonCoordinatesSchema).min(1);

const historicalGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Polygon"),
    coordinates: polygonCoordinatesSchema,
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: multiPolygonCoordinatesSchema,
  }),
]);

export const historicalFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: historicalGeometrySchema,
  properties: historicalFeaturePropertiesSchema,
});

export const historicalFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(historicalFeatureSchema),
  metadata: z.object({
    sourceCrs: z.literal("ESRI:102013"),
    targetCrs: z.literal("EPSG:4326"),
    regionalBbox: z.tuple([
      z.number(),
      z.number(),
      z.number(),
      z.number(),
    ]),
    simplifyToleranceDegrees: z.number().positive(),
    snapshotDate: z.iso.date(),
    yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  }),
});

export type HistoricalManifest = z.infer<typeof historicalManifestSchema>;
export type HistoricalSnapshotEntry = z.infer<
  typeof historicalSnapshotEntrySchema
>;
export type HistoricalFeatureProperties = z.infer<
  typeof historicalFeaturePropertiesSchema
>;
export type HistoricalFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  HistoricalFeatureProperties
>;

export function selectHistoricalSnapshot(
  manifest: HistoricalManifest,
  yearMonth: string,
): HistoricalSnapshotEntry {
  const snapshot = manifest.snapshots.find(
    (candidate) => candidate.yearMonth === yearMonth,
  );
  if (!snapshot) {
    throw new Error(`No historical administration snapshot exists for ${yearMonth}`);
  }
  return snapshot;
}

export function defaultHistoricalSnapshot(
  manifest: HistoricalManifest,
): HistoricalSnapshotEntry {
  return selectHistoricalSnapshot(
    manifest,
    manifest.temporalCoverage.defaultYearMonth,
  );
}

export function historicalSnapshotIndex(
  manifest: HistoricalManifest,
  yearMonth: string,
): number {
  const index = manifest.snapshots.findIndex(
    (snapshot) => snapshot.yearMonth === yearMonth,
  );
  if (index < 0) {
    throw new Error(`No historical administration snapshot exists for ${yearMonth}`);
  }
  return index;
}

export function formatYearMonth(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const [, year, month] = match;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${year}-${month}-01T00:00:00Z`));
}

export function displayRawHistoricalValue(value: string): string {
  return value === "" ? "(empty in source)" : value;
}
