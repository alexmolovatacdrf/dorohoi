import { z } from "zod";

export const ConfidenceSchema = z.enum(["high", "medium", "low", "unknown"]);
export const ReviewStateSchema = z.enum([
  "not_required",
  "needs_review",
  "in_review",
  "resolved",
]);
export const AssertionStatusSchema = z.enum([
  "explicit",
  "partial",
  "inferred",
  "unresolved",
]);

export const SourceReferenceSchema = z.object({
  sourceFile: z.string().min(1),
  sourceDataset: z.enum(["dossier", "ehri_local", "curated_gazetteer"]),
  documentId: z.string().nullable(),
  dossierId: z.string().nullable(),
  pagePdf: z.number().int().positive().nullable(),
  pagePrinted: z.union([z.number(), z.string()]).nullable(),
  field: z.string().nullable(),
  sourceRecordId: z.string().nullable(),
  fragmentRaw: z.string().nullable(),
});

export const AlternativeReadingSchema = z.object({
  value: z.unknown(),
  note: z.string().nullable(),
  confidence: ConfidenceSchema,
  sourceRefs: z.array(SourceReferenceSchema),
});

const evidenceEnvelopeShape = {
  id: z.string().min(1),
  dossierId: z.string().nullable(),
  sourceRefs: z.array(SourceReferenceSchema).min(1),
  raw: z.unknown(),
  normalized: z.record(z.string(), z.unknown()),
  confidence: ConfidenceSchema,
  assertionStatus: AssertionStatusSchema,
  reviewState: ReviewStateSchema,
  alternativeReadings: z.array(AlternativeReadingSchema),
};

export const DateRangeSchema = z.object({
  raw: z.unknown(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  precision: z.enum(["day", "month", "year", "interval", "relative", "unknown"]),
});

export const PersonSchema = z.object({
  ...evidenceEnvelopeShape,
  personId: z.string().min(1),
  displayName: z.string().min(1),
  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  sex: z.enum(["male", "female", "unknown"]),
  birthDate: DateRangeSchema.nullable(),
  birthPlaceMentionId: z.string().nullable(),
  civilStatusRaw: z.string().nullable(),
  roles: z.array(z.string()),
  documentIds: z.array(z.string()),
  householdIds: z.array(z.string()),
  nameVariantIds: z.array(z.string()),
  relationshipIds: z.array(z.string()),
  eventIds: z.array(z.string()),
  routeSegmentIds: z.array(z.string()),
});

export const PersonNameVariantSchema = z.object({
  ...evidenceEnvelopeShape,
  variantId: z.string().min(1),
  personId: z.string().min(1),
  value: z.string().min(1),
  variantType: z.enum(["documentary", "alternative_reading", "search_form"]),
  language: z.string().nullable(),
  script: z.string().nullable(),
});

export const HouseholdSchema = z.object({
  ...evidenceEnvelopeShape,
  householdId: z.string().min(1),
  householdType: z.enum(["documented_household", "documented_family_group"]),
  headPersonId: z.string().nullable(),
  memberPersonIds: z.array(z.string()),
  totalPersonsRaw: z.string().nullable(),
  documentIds: z.array(z.string()),
});

export const RelationshipSchema = z.object({
  ...evidenceEnvelopeShape,
  relationshipId: z.string().min(1),
  relationshipType: z.enum(["spouse", "parent_child", "other"]),
  person1Id: z.string().min(1),
  person2Id: z.string().min(1),
  person1Role: z.string().nullable(),
  person2Role: z.string().nullable(),
  symmetric: z.boolean(),
  documentIds: z.array(z.string()),
});

export const DocumentSchema = z.object({
  ...evidenceEnvelopeShape,
  documentId: z.string().min(1),
  title: z.string().min(1),
  fileName: z.string().min(1),
  documentType: z.string().min(1),
  pageCount: z.number().int().nonnegative(),
  modelVersion: z.string(),
  extractionStatus: z.string(),
  mediaStatus: z.enum(["referenced_only", "available"]),
  personIds: z.array(z.string()),
  eventIds: z.array(z.string()),
});

export const EventSchema = z.object({
  ...evidenceEnvelopeShape,
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  date: DateRangeSchema,
  participantIds: z.array(z.string()).min(1),
  placeMentionIds: z.array(z.string()),
  descriptionRaw: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  documentIds: z.array(z.string()),
});

export const CoordinateSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().nullable(),
  accessed: z.string().nullable(),
  sourceRecordId: z.string().nullable(),
});

export const PlaceSchema = z.object({
  ...evidenceEnvelopeShape,
  placeId: z.string().min(1),
  originalName: z.string().min(1),
  normalizedName: z.string().nullable(),
  displayNames: z.object({
    en: z.string().min(1),
    ro: z.string().min(1),
  }),
  variants: z.array(z.string()),
  placeType: z.enum([
    "settlement",
    "river",
    "camp",
    "ghetto",
    "historical_region",
    "institution",
    "unresolved",
  ]),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .nullable(),
  coordinateSource: CoordinateSourceSchema.nullable(),
  coordinateConfidence: ConfidenceSchema,
  resolutionStatus: z.enum(["resolved", "partially_resolved", "unresolved"]),
  layer: z.enum(["core", "ehri_local", "unresolved"]),
  externalDatasetId: z.string().nullable(),
  relatedPlaceIds: z.array(z.string()),
});

export const PlaceMentionSchema = z.object({
  ...evidenceEnvelopeShape,
  placeMentionId: z.string().min(1),
  ownerType: z.enum(["person", "event", "document"]),
  ownerId: z.string().min(1),
  personIds: z.array(z.string()),
  role: z.string().min(1),
  valueRaw: z.string().min(1),
  placeId: z.string().nullable(),
  resolutionMethod: z.enum([
    "explicit_registry",
    "compound_registry",
    "unresolved_placeholder",
    "unresolved",
  ]),
  resolutionStatus: z.enum(["resolved", "partially_resolved", "unresolved"]),
  documentIds: z.array(z.string()),
});

export const RouteSegmentSchema = z.object({
  ...evidenceEnvelopeShape,
  routeSegmentId: z.string().min(1),
  personId: z.string().min(1),
  originPlaceId: z.string().min(1),
  destinationPlaceId: z.string().min(1),
  sequence: z.number().int().positive(),
  date: DateRangeSchema,
  transportRaw: z.string().nullable(),
  routeStatus: z.enum(["explicit", "partial", "inferred", "unresolved"]),
  lineStyle: z.enum(["solid", "dashed", "dotted"]),
  directionKnown: z.boolean(),
  evidenceEventIds: z.array(z.string()),
  notes: z.string().nullable(),
});

export const ReviewCategorySchema = z.enum([
  "unresolved_place",
  "uncertain_reading",
  "incomplete_route",
  "possible_duplicate_person",
  "questionable_relationship",
  "contradiction",
  "source_collation",
  "external_catalog_quality",
]);

export const ReviewTaskSchema = z.object({
  ...evidenceEnvelopeShape,
  reviewTaskId: z.string().min(1),
  category: ReviewCategorySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "in_review", "resolved"]),
  entityRefs: z.array(
    z.object({
      entityType: z.enum([
        "person",
        "relationship",
        "document",
        "event",
        "place",
        "place_mention",
        "route_segment",
        "dataset",
      ]),
      entityId: z.string(),
    }),
  ),
  suggestedAction: z.string().nullable(),
});

export const NormalizedBundleSchema = z.object({
  persons: z.array(PersonSchema),
  personNameVariants: z.array(PersonNameVariantSchema),
  households: z.array(HouseholdSchema),
  relationships: z.array(RelationshipSchema),
  documents: z.array(DocumentSchema),
  events: z.array(EventSchema),
  places: z.array(PlaceSchema),
  placeMentions: z.array(PlaceMentionSchema),
  routeSegments: z.array(RouteSegmentSchema),
  reviewTasks: z.array(ReviewTaskSchema),
});

export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export type AssertionStatus = z.infer<typeof AssertionStatusSchema>;
export type SourceReference = z.infer<typeof SourceReferenceSchema>;
export type AlternativeReading = z.infer<typeof AlternativeReadingSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type PersonNameVariant = z.infer<typeof PersonNameVariantSchema>;
export type Household = z.infer<typeof HouseholdSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Event = z.infer<typeof EventSchema>;
export type CoordinateSource = z.infer<typeof CoordinateSourceSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type PlaceMention = z.infer<typeof PlaceMentionSchema>;
export type RouteSegment = z.infer<typeof RouteSegmentSchema>;
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;
export type ReviewTask = z.infer<typeof ReviewTaskSchema>;
export type NormalizedBundle = z.infer<typeof NormalizedBundleSchema>;
