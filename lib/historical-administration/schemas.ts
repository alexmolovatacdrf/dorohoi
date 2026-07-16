import { z } from "zod";

export const HISTORICAL_MANIFEST_URL =
  "/data/historical-administration/manifest.json";
export const FULL_HISTORICAL_MANIFEST_URL =
  "/data/historical-administration-full/manifest.json";
export const HISTORICAL_REGIONAL_DATA_PREFIX =
  "/data/historical-administration/";
export const HISTORICAL_FULL_DATA_PREFIX =
  "/data/historical-administration-full/";
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
export const HISTORICAL_PRESENTATION_CATEGORY_COLORS = {
  sovereign_state: "#b8c4c3",
  neutral_state: "#c8b98b",
  german_allied_state: "#b07852",
  romanian_occupied: "#c87945",
  german_occupied: "#76536f",
  soviet_controlled: "#5f7894",
  unresolved_other: "#8d8b84",
} as const;

// State-specific shades keep neighbouring territories distinguishable while
// the broader presentationCategory colours continue to explain the public
// political grouping in the legend.
export const HISTORICAL_PRESENTATION_NAME_COLORS = {
  Romania: "#a87345",
  Hungary: "#b38a45",
  Germany: "#6f5369",
  Bulgaria: "#a37843",
  Finland: "#8b754c",
  Italy: "#86605a",
  Slovakia: "#b18d68",
  "Vichy France": "#987466",
  Transnistria: "#dc4d2f",
  "Reichskommissariat Ukraine": "#6b4c75",
  "Soviet Union": "#b33342",
} as const;

export const historicalScopeSchema = z.enum(["regional", "full"]);
export const historicalExtentModeSchema = z.enum([
  "regional_crop",
  "full_source",
]);
export const historicalPresentationCategorySchema = z.enum([
  "sovereign_state",
  "neutral_state",
  "german_allied_state",
  "romanian_occupied",
  "german_occupied",
  "soviet_controlled",
  "unresolved_other",
]);

const bboxSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

const historicalLegendEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
});

export const historicalSnapshotStatusSchema = z.enum([
  "primary",
  "limited_static",
]);

const historicalRegionalSnapshotEntrySchema = z.object({
  scope: z.literal("regional"),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  snapshotDate: z.iso.date(),
  status: historicalSnapshotStatusSchema,
  file: z.string().min(1),
  url: z.string().startsWith(HISTORICAL_REGIONAL_DATA_PREFIX),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  sourceRecordCount: z.number().int().positive(),
  regionalFeatureCount: z.number().int().nonnegative(),
}).passthrough();

const historicalFullSnapshotEntrySchema = z.object({
  scope: z.literal("full"),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  snapshotDate: z.iso.date(),
  status: historicalSnapshotStatusSchema,
  file: z.string().min(1),
  url: z.string().startsWith(HISTORICAL_FULL_DATA_PREFIX),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  sourceRecordCount: z.number().int().positive(),
  featureCount: z.number().int().positive(),
  dataBbox: bboxSchema,
}).passthrough();

export type HistoricalRegionalSnapshotEntry = z.infer<
  typeof historicalRegionalSnapshotEntrySchema
>;
export type HistoricalFullSnapshotEntry = z.infer<
  typeof historicalFullSnapshotEntrySchema
>;
export type HistoricalSnapshotEntry =
  | HistoricalRegionalSnapshotEntry
  | HistoricalFullSnapshotEntry;

function recordValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function inferScopeFromUrl(url: unknown): "regional" | "full" {
  return typeof url === "string" && url.startsWith(HISTORICAL_FULL_DATA_PREFIX)
    ? "full"
    : "regional";
}

function normalizeSnapshotScope(value: unknown): unknown {
  const record = recordValue(value);
  if (!record) return value;
  if (record.scope === "regional" || record.scope === "full") return value;
  return { ...record, scope: inferScopeFromUrl(record.url) };
}

const historicalSnapshotEntryUnionSchema = z.discriminatedUnion("scope", [
  historicalRegionalSnapshotEntrySchema,
  historicalFullSnapshotEntrySchema,
]);

export const historicalSnapshotEntrySchema: z.ZodType<HistoricalSnapshotEntry> =
  z.preprocess(
    normalizeSnapshotScope,
    historicalSnapshotEntryUnionSchema,
  ) as z.ZodType<HistoricalSnapshotEntry>;

const historicalRegionalProcessingSchema = z.object({
  extentMode: z.literal("regional_crop"),
  cropped: z.literal(true),
  regionalBbox: bboxSchema,
  regionalScope: z.string().min(1),
  cropIsResearchWindowNotBoundary: z.literal(true),
  simplifyToleranceDegrees: z.number().positive(),
  coordinateDecimals: z.number().int().positive(),
}).passthrough();

const historicalFullProcessingSchema = z.object({
  extentMode: z.literal("full_source"),
  cropped: z.literal(false),
  fullExtentBbox: bboxSchema,
  simplifyToleranceDegrees: z.number().positive(),
  coordinateDecimals: z.number().int().positive(),
  sourceSimplifyToleranceMetres: z.number().positive(),
}).passthrough();

export type HistoricalProcessing =
  | z.infer<typeof historicalRegionalProcessingSchema>
  | z.infer<typeof historicalFullProcessingSchema>;

function normalizeProcessingExtent(value: unknown): unknown {
  const record = recordValue(value);
  if (!record) return value;
  const isFull =
    record.extentMode === "full_source" || record.fullExtentBbox !== undefined;
  return {
    ...record,
    extentMode: isFull ? "full_source" : "regional_crop",
    cropped: isFull ? false : true,
  };
}

const historicalProcessingUnionSchema = z.discriminatedUnion("extentMode", [
  historicalRegionalProcessingSchema,
  historicalFullProcessingSchema,
]);

export const historicalProcessingSchema: z.ZodType<HistoricalProcessing> =
  z.preprocess(
    normalizeProcessingExtent,
    historicalProcessingUnionSchema,
  ) as z.ZodType<HistoricalProcessing>;

const historicalRegionalTerritorialChangesSchema = z.object({
  scope: z.literal("regional"),
  file: z.string().min(1),
  url: z.string().startsWith(HISTORICAL_REGIONAL_DATA_PREFIX),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  sourceRecordCount: z.number().int().positive(),
  regionalFeatureCount: z.number().int().nonnegative(),
}).passthrough();

const historicalFullTerritorialChangesSchema = z.object({
  scope: z.literal("full"),
  file: z.string().min(1),
  url: z.string().startsWith(HISTORICAL_FULL_DATA_PREFIX),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  sourceRecordCount: z.number().int().positive(),
  featureCount: z.number().int().positive(),
  dataBbox: bboxSchema,
}).passthrough();

function normalizeTerritorialScope(value: unknown): unknown {
  const record = recordValue(value);
  if (!record) return value;
  if (record.scope === "regional" || record.scope === "full") return value;
  return { ...record, scope: inferScopeFromUrl(record.url) };
}

export type HistoricalTerritorialChanges =
  | z.infer<typeof historicalRegionalTerritorialChangesSchema>
  | z.infer<typeof historicalFullTerritorialChangesSchema>;

const historicalTerritorialChangesUnionSchema = z.discriminatedUnion("scope", [
  historicalRegionalTerritorialChangesSchema,
  historicalFullTerritorialChangesSchema,
]);

const historicalTerritorialChangesSchema: z.ZodType<HistoricalTerritorialChanges> =
  z.preprocess(
    normalizeTerritorialScope,
    historicalTerritorialChangesUnionSchema,
  ) as z.ZodType<HistoricalTerritorialChanges>;

const historicalPresentationVocabularySchema = z.object({
  field: z.literal("presentationCategory"),
  sourceFields: z.tuple([z.literal("Name"), z.literal("Foreign_Po")]),
  method: z.string().min(1),
  rules: z.record(z.string(), z.unknown()),
  legend: z.array(historicalLegendEntrySchema).min(5),
});

function normalizeManifestScope(value: unknown): unknown {
  const record = recordValue(value);
  if (!record) return value;
  if (record.scope === "regional" || record.scope === "full") return value;
  const processing = recordValue(record.processing);
  const scope =
    processing?.extentMode === "full_source" ||
    processing?.fullExtentBbox !== undefined
      ? "full"
      : "regional";
  return { ...record, scope };
}

type HistoricalLegendEntry = z.infer<typeof historicalLegendEntrySchema>;

export type HistoricalManifest = {
  scope: HistoricalScope;
  schemaVersion: 1;
  source: {
    id: string;
    title: string;
    archiveSha256: string;
    attribution: string;
    useLimit: string;
  };
  projection: {
    source: "ESRI:102013";
    target: "EPSG:4326";
    coordinateOrder: "longitude, latitude";
    transformationDescription: string;
    transformationDefinition: string;
    transformationAccuracyMetres: number;
  };
  processing: HistoricalProcessing;
  temporalCoverage: {
    start: string;
    end: string;
    primarySupported: { start: string; end: string };
    limitedStatic: { start: string; end: string; reason: string };
    defaultYearMonth: string;
  };
  rawMonthlyAttributes: ["Name", "Foreign_Po", "Head_of_St", "Govt_in_Ex"];
  derivedForeignPowerVocabulary: {
    field: "foreignPowerCategory";
    sourceField: "Foreign_Po";
    method: string;
    rawValueMapping: Record<string, string>;
    legend: HistoricalLegendEntry[];
  };
  presentationVocabulary?: {
    field: "presentationCategory";
    sourceFields: ["Name", "Foreign_Po"];
    method: string;
    rules: Record<string, unknown>;
    legend: HistoricalLegendEntry[];
  };
  methodologicalWarning: string;
  snapshots: HistoricalSnapshotEntry[];
  snapshotByYearMonth: Record<string, string>;
  territorialChanges: HistoricalTerritorialChanges;
  sourceAssertions: Record<string, unknown>;
};

const historicalManifestBaseSchema: z.ZodType<HistoricalManifest> = z.object({
    scope: historicalScopeSchema,
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
    processing: historicalProcessingSchema,
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
    presentationVocabulary: historicalPresentationVocabularySchema.optional(),
    methodologicalWarning: z.string().min(1),
    snapshots: z.array(historicalSnapshotEntrySchema).min(1),
    snapshotByYearMonth: z.record(z.string(), z.string()),
    territorialChanges: historicalTerritorialChangesSchema,
    sourceAssertions: z.record(z.string(), z.unknown()),
}) as z.ZodType<HistoricalManifest>;

export const historicalManifestSchema: z.ZodType<HistoricalManifest> = (
  z.preprocess(
    normalizeManifestScope,
    historicalManifestBaseSchema,
  ) as z.ZodType<HistoricalManifest>
).superRefine((manifest, context) => {
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
    if (snapshot.scope !== manifest.scope) {
      context.addIssue({
        code: "custom",
        message: `Snapshot scope mismatch for ${snapshot.yearMonth}`,
        path: ["snapshots", snapshot.yearMonth, "scope"],
      });
    }
    if (manifest.snapshotByYearMonth[snapshot.yearMonth] !== snapshot.file) {
      context.addIssue({
        code: "custom",
        message: `Snapshot index mismatch for ${snapshot.yearMonth}`,
        path: ["snapshotByYearMonth", snapshot.yearMonth],
      });
    }
  }
  if (manifest.territorialChanges.scope !== manifest.scope) {
    context.addIssue({
      code: "custom",
      message: "Territorial changes scope must match the manifest scope",
      path: ["territorialChanges", "scope"],
    });
  }
  if (manifest.scope === "full" && !manifest.presentationVocabulary) {
    context.addIssue({
      code: "custom",
      message: "Full historical manifests must document presentationCategory",
      path: ["presentationVocabulary"],
    });
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
  presentationCategory: historicalPresentationCategorySchema.optional(),
  snapshotDate: z.iso.date(),
  sourceFeatureIndex: z.number().int().nonnegative(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

const historicalFullFeaturePropertiesSchema = historicalFeaturePropertiesSchema.extend({
  presentationCategory: historicalPresentationCategorySchema,
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

const historicalFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: historicalGeometrySchema,
  properties: historicalFeaturePropertiesSchema,
});

const historicalFullFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: historicalGeometrySchema,
  properties: historicalFullFeaturePropertiesSchema,
});

const historicalRegionalMetadataSchema = z.object({
  scope: z.literal("regional"),
  sourceCrs: z.literal("ESRI:102013"),
  targetCrs: z.literal("EPSG:4326"),
  extentMode: z.literal("regional_crop"),
  cropped: z.literal(true),
  regionalBbox: bboxSchema,
  simplifyToleranceDegrees: z.number().positive(),
  snapshotDate: z.iso.date(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
}).passthrough();

const historicalFullMetadataSchema = z.object({
  scope: z.literal("full"),
  sourceCrs: z.literal("ESRI:102013"),
  targetCrs: z.literal("EPSG:4326"),
  extentMode: z.literal("full_source"),
  cropped: z.literal(false),
  dataBbox: bboxSchema,
  simplifyToleranceDegrees: z.number().positive(),
  snapshotDate: z.iso.date(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
}).passthrough();

function normalizeFeatureCollectionScope(value: unknown): unknown {
  const record = recordValue(value);
  if (!record) return value;
  const metadata = recordValue(record.metadata);
  if (!metadata) return value;
  const isFull =
    metadata.extentMode === "full_source" || metadata.dataBbox !== undefined;
  return {
    ...record,
    metadata: {
      ...metadata,
      scope: isFull ? "full" : "regional",
      extentMode: isFull ? "full_source" : "regional_crop",
      cropped: isFull ? false : true,
    },
  };
}

const historicalRegionalFeatureCollectionSchema = z.preprocess(
  normalizeFeatureCollectionScope,
  z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(historicalFeatureSchema),
    metadata: historicalRegionalMetadataSchema,
  }),
);

const historicalFullFeatureCollectionSchema = z.preprocess(
  normalizeFeatureCollectionScope,
  z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(historicalFullFeatureSchema),
    metadata: historicalFullMetadataSchema,
  }),
);

export type HistoricalScope = z.infer<typeof historicalScopeSchema>;
export type HistoricalFeatureProperties = z.infer<
  typeof historicalFeaturePropertiesSchema
>;
export type HistoricalPresentationCategory = z.infer<
  typeof historicalPresentationCategorySchema
>;
export type HistoricalRegionalFeatureCollection = {
  type: "FeatureCollection";
  features: Array<z.infer<typeof historicalFeatureSchema>>;
  metadata: z.infer<typeof historicalRegionalMetadataSchema>;
};
export type HistoricalFullFeatureCollection = {
  type: "FeatureCollection";
  features: Array<z.infer<typeof historicalFullFeatureSchema>>;
  metadata: z.infer<typeof historicalFullMetadataSchema>;
};
export type HistoricalFeatureCollection =
  | HistoricalRegionalFeatureCollection
  | HistoricalFullFeatureCollection;

export const historicalFeatureCollectionSchema: z.ZodType<HistoricalFeatureCollection> =
  z.union([
    historicalRegionalFeatureCollectionSchema,
    historicalFullFeatureCollectionSchema,
  ]) as z.ZodType<HistoricalFeatureCollection>;

const historicalTerritorialFeaturePropertiesSchema = z.object({
  TERRITORY_: z.string(),
  ALT_NAME: z.string(),
  GOVT: z.string(),
  FORMER_GOV: z.string(),
  CHANGE_DAT: z.string().regex(/^\d{8}$/),
  TYPE: z.string(),
  changeDate: z.iso.date(),
  sourceFeatureIndex: z.number().int().nonnegative(),
}).passthrough();

const historicalTerritorialFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: historicalGeometrySchema,
  properties: historicalTerritorialFeaturePropertiesSchema,
});

const historicalRegionalTerritorialMetadataSchema = z.object({
  scope: z.literal("regional"),
  sourceCrs: z.literal("ESRI:102013"),
  targetCrs: z.literal("EPSG:4326"),
  extentMode: z.literal("regional_crop"),
  cropped: z.literal(true),
  regionalBbox: bboxSchema,
  simplifyToleranceDegrees: z.number().positive(),
}).passthrough();

const historicalFullTerritorialMetadataSchema = z.object({
  scope: z.literal("full"),
  sourceCrs: z.literal("ESRI:102013"),
  targetCrs: z.literal("EPSG:4326"),
  extentMode: z.literal("full_source"),
  cropped: z.literal(false),
  dataBbox: bboxSchema,
  simplifyToleranceDegrees: z.number().positive(),
}).passthrough();

function normalizeTerritorialCollectionScope(value: unknown): unknown {
  const record = recordValue(value);
  if (!record) return value;
  const metadata = recordValue(record.metadata);
  if (!metadata) return value;
  const isFull =
    metadata.extentMode === "full_source" || metadata.dataBbox !== undefined;
  return {
    ...record,
    metadata: {
      ...metadata,
      scope: isFull ? "full" : "regional",
      extentMode: isFull ? "full_source" : "regional_crop",
      cropped: isFull ? false : true,
    },
  };
}

export const historicalTerritorialFeatureCollectionSchema = z.preprocess(
  normalizeTerritorialCollectionScope,
  z.union([
    z.object({
      type: z.literal("FeatureCollection"),
      features: z.array(historicalTerritorialFeatureSchema),
      metadata: historicalRegionalTerritorialMetadataSchema,
    }),
    z.object({
      type: z.literal("FeatureCollection"),
      features: z.array(historicalTerritorialFeatureSchema),
      metadata: historicalFullTerritorialMetadataSchema,
    }),
  ]),
);

export function isFullHistoricalSnapshot(
  snapshot: HistoricalSnapshotEntry,
): snapshot is HistoricalFullSnapshotEntry {
  return snapshot.scope === "full";
}

export function isRegionalHistoricalSnapshot(
  snapshot: HistoricalSnapshotEntry,
): snapshot is HistoricalRegionalSnapshotEntry {
  return snapshot.scope === "regional";
}

export function isFullHistoricalManifest(
  manifest: HistoricalManifest,
): boolean {
  return manifest.scope === "full";
}

export function historicalSnapshotFeatureCount(
  snapshot: HistoricalSnapshotEntry,
): number {
  return isFullHistoricalSnapshot(snapshot)
    ? snapshot.featureCount
    : snapshot.regionalFeatureCount;
}

export function historicalManifestExtent(
  manifest: HistoricalManifest,
): [number, number, number, number] {
  return manifest.processing.extentMode === "full_source"
    ? manifest.processing.fullExtentBbox
    : manifest.processing.regionalBbox;
}

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

export function formatYearMonth(yearMonth: string, language: "en" | "ro" = "en"): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const [, year, month] = match;
  return new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${year}-${month}-01T00:00:00Z`));
}

export function displayRawHistoricalValue(value: string): string {
  return value === "" ? "(empty in source)" : value;
}
