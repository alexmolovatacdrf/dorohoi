import {
  NormalizedBundleSchema,
  type AlternativeReading,
  type DateRange,
  type Document,
  type Event,
  type Household,
  type NormalizedBundle,
  type Person,
  type PersonNameVariant,
  type Place,
  type PlaceMention,
  type Relationship,
  type ReviewCategory,
  type ReviewTask,
  type RouteSegment,
  type SourceReference,
} from "../../lib/domain/schemas";
import { buildCorePlaces, PLACE_IDS, resolvePlaceValue } from "./core-gazetteer";
import {
  alternativeReading,
  confidenceFromRomanian,
  dossierSourceRef,
  ehriSourceRef,
  SOURCE_FILES,
} from "./evidence";
import type { SourceCorpus } from "./load-source";
import type {
  EhriPlace,
  SourceDossier,
  SourceEvent,
  SourcePerson,
} from "./source-schemas";

type UnknownRecord = Record<string, unknown>;

const ROMANIAN_MONTHS: Record<string, number> = {
  ianuarie: 1,
  februarie: 2,
  febr: 2,
  martie: 3,
  aprilie: 4,
  mai: 5,
  iunie: 6,
  iulie: 7,
  august: 8,
  septembrie: 9,
  octombrie: 10,
  noiembrie: 11,
  noembrie: 11,
  decembrie: 12,
};

function sortById<T extends { id: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
}

function stringValue(record: UnknownRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function stringArray(record: UnknownRecord, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizedYear(rawYear: string): number | null {
  const value = Number.parseInt(rawYear, 10);
  if (!Number.isFinite(value)) return null;
  if (rawYear.length === 3 && value >= 900) return value + 1000;
  if (rawYear.length === 4) return value;
  return null;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRomanianDay(raw: string): string | null {
  const match = raw
    .trim()
    .replaceAll(".", "")
    .match(/^(\d{1,2})\s+([\p{L}]+)\s+(\d{3,4})$/iu);
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number.parseInt(dayRaw, 10);
  const month = ROMANIAN_MONTHS[monthRaw.toLocaleLowerCase("ro")];
  const year = normalizedYear(yearRaw);
  if (!month || !year || day < 1 || day > lastDayOfMonth(year, month)) return null;
  return isoDate(year, month, day);
}

function parseRomanianMonth(raw: string): { start: string; end: string } | null {
  const match = raw.trim().match(/^([\p{L}]+)\s+(\d{4})$/iu);
  if (!match) return null;
  const [, monthRaw, yearRaw] = match;
  const month = ROMANIAN_MONTHS[monthRaw.toLocaleLowerCase("ro")];
  const year = normalizedYear(yearRaw);
  if (!month || !year) return null;
  return {
    start: isoDate(year, month, 1),
    end: isoDate(year, month, lastDayOfMonth(year, month)),
  };
}

function yearRange(raw: string): DateRange | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number.parseInt(raw, 10);
  return {
    raw,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    precision: "year",
  };
}

function normalizeEventDate(event: SourceEvent): DateRange {
  const record = asRecord(event);
  const dataRaw = record.data_raw;
  const intervalRaw = record.interval_raw;
  const startRaw = stringValue(record, "data_start_raw");
  const endRaw = stringValue(record, "data_end_raw");

  if (typeof dataRaw === "string") {
    const year = yearRange(dataRaw);
    if (year) return year;
    const day = parseRomanianDay(dataRaw);
    if (day) return { raw: dataRaw, start: day, end: day, precision: "day" };
    return {
      raw: dataRaw,
      start: null,
      end: null,
      precision: /după|înainte|timpul/iu.test(dataRaw) ? "relative" : "unknown",
    };
  }

  if (typeof intervalRaw === "string") {
    const yearInterval = intervalRaw.match(/^(\d{4})-(\d{4})$/);
    if (yearInterval) {
      return {
        raw: intervalRaw,
        start: `${yearInterval[1]}-01-01`,
        end: `${yearInterval[2]}-12-31`,
        precision: "interval",
      };
    }

    const mixedInterval = intervalRaw.match(/^(.+?)\s*-\s*(\d{3,4})$/);
    const parsedStart = mixedInterval ? parseRomanianDay(mixedInterval[1]) : null;
    const parsedEndYear = mixedInterval ? normalizedYear(mixedInterval[2]) : null;
    if (parsedStart && parsedEndYear) {
      return {
        raw: intervalRaw,
        start: parsedStart,
        end: `${parsedEndYear}-12-31`,
        precision: "interval",
      };
    }

    return { raw: intervalRaw, start: null, end: null, precision: "unknown" };
  }

  if (startRaw || endRaw) {
    const start = startRaw ? parseRomanianMonth(startRaw) : null;
    const end = endRaw ? parseRomanianMonth(endRaw) : null;
    return {
      raw: { start: startRaw, end: endRaw },
      start: start?.start ?? null,
      end: end?.end ?? null,
      precision: start || end ? "interval" : "unknown",
    };
  }

  if (Array.isArray(dataRaw)) {
    return { raw: dataRaw, start: null, end: null, precision: "unknown" };
  }

  return { raw: dataRaw ?? null, start: null, end: null, precision: "unknown" };
}

function normalizeBirthDate(person: SourcePerson): DateRange | null {
  if (person.data_nasterii) {
    const normalized = person.data_nasterii.normalizat;
    if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return {
        raw: person.data_nasterii.raw,
        start: normalized,
        end: normalized,
        precision: "day",
      };
    }
    return {
      raw: person.data_nasterii.raw,
      start: null,
      end: null,
      precision: "unknown",
    };
  }

  if (person.an_nastere_raw) return yearRange(person.an_nastere_raw);
  return null;
}

function sourceFileForDocument(documentId: string): string {
  if (documentId === "DOROHOI-2560") return SOURCE_FILES.dossier2560;
  if (documentId === "DOROHOI-2590") return SOURCE_FILES.dossier2590;
  throw new Error(`No source-file manifest entry for ${documentId}`);
}

function buildDocuments(dossiers: SourceDossier[]): Document[] {
  return dossiers.map((dossier) => {
    const documentId = dossier.document.document_id;
    const sourceRef = dossierSourceRef(
      sourceFileForDocument(documentId),
      documentId,
      "document",
    );
    return {
      id: documentId,
      dossierId: documentId,
      sourceRefs: [sourceRef],
      raw: {
        document: dossier.document,
        modelVersion: dossier._model_versiune,
        status: dossier._status,
      },
      normalized: {
        title: `Dossier ${documentId.replace("DOROHOI-", "")}`,
        documentType: dossier.document.tip,
        mediaStatus: "referenced_only",
      },
      confidence: "high",
      assertionStatus: "explicit",
      reviewState: "not_required",
      alternativeReadings: [],
      documentId,
      title: `Dossier ${documentId.replace("DOROHOI-", "")}`,
      fileName: dossier.document.fisier_sursa,
      documentType: dossier.document.tip,
      pageCount: dossier.document.pagini_pdf,
      modelVersion: dossier._model_versiune,
      extractionStatus: dossier._status,
      mediaStatus: "referenced_only",
      personIds: dossier.persoane.map((person) => person.persoana_id),
      eventIds: dossier.evenimente.map((event) => event.eveniment_id),
    };
  });
}

function buildRelationships(dossiers: SourceDossier[]): Relationship[] {
  const relationships: Relationship[] = [];

  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);
    for (const [index, relationship] of (dossier.relatii ?? []).entries()) {
      const isParentChild = Boolean(relationship.parinte && relationship.copil);
      const person1Id = relationship.persoana_1 ?? relationship.parinte;
      const person2Id = relationship.persoana_2 ?? relationship.copil;
      if (!person1Id || !person2Id) {
        throw new Error(`Relationship ${relationship.relatie_id} is missing participants`);
      }
      const sourceRef = dossierSourceRef(
        sourceFile,
        documentId,
        `relatii[${index}]`,
        relationship.sursa,
      );
      const confidence = confidenceFromRomanian(relationship.incredere);
      const spouse = relationship.tip === "soți";

      relationships.push({
        id: relationship.relatie_id,
        dossierId: documentId,
        sourceRefs: [sourceRef],
        raw: relationship,
        normalized: {
          relationshipType: spouse ? "spouse" : isParentChild ? "parent_child" : "other",
          person1Id,
          person2Id,
        },
        confidence,
        assertionStatus: "explicit",
        reviewState: confidence === "high" ? "not_required" : "needs_review",
        alternativeReadings: [],
        relationshipId: relationship.relatie_id,
        relationshipType: spouse ? "spouse" : isParentChild ? "parent_child" : "other",
        person1Id,
        person2Id,
        person1Role: isParentChild ? "parent" : spouse ? "spouse" : null,
        person2Role: isParentChild ? "child" : spouse ? "spouse" : null,
        symmetric: spouse,
        documentIds: [documentId],
      });
    }
  }

  return relationships;
}

function buildHouseholds(dossiers: SourceDossier[]): Household[] {
  const households: Household[] = [];
  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);
    for (const [index, household] of (dossier.gospodarii ?? []).entries()) {
      const sourceRef = dossierSourceRef(sourceFile, documentId, `gospodarii[${index}]`);
      households.push({
        id: household.gospodarie_id,
        dossierId: documentId,
        sourceRefs: [sourceRef],
        raw: household,
        normalized: {
          headPersonId: household.cap_persoana_id ?? null,
          memberPersonIds: household.membri,
        },
        confidence: "high",
        assertionStatus: "explicit",
        reviewState: "not_required",
        alternativeReadings: [],
        householdId: household.gospodarie_id,
        householdType: "documented_household",
        headPersonId: household.cap_persoana_id ?? null,
        memberPersonIds: household.membri,
        totalPersonsRaw: household.total_persoane_raw ?? null,
        documentIds: [documentId],
      });
    }
  }
  return households;
}

function eventAttributes(event: SourceEvent): UnknownRecord {
  const omitted = new Set([
    "eveniment_id",
    "tip",
    "participant",
    "sursa",
    "data_raw",
    "date_raw",
    "interval_raw",
    "data_start_raw",
    "data_end_raw",
    "descriere_raw",
  ]);
  return Object.fromEntries(Object.entries(event).filter(([key]) => !omitted.has(key)));
}

function buildEvents(dossiers: SourceDossier[]): Event[] {
  const events: Event[] = [];
  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);
    for (const [index, sourceEvent] of dossier.evenimente.entries()) {
      const record = asRecord(sourceEvent);
      const sourceRef = dossierSourceRef(
        sourceFile,
        documentId,
        `evenimente[${index}]`,
        sourceEvent.sursa,
      );
      const contradiction = sourceEvent.eveniment_id === "E-2560-003";
      const alternatives: AlternativeReading[] = contradiction
        ? [
            alternativeReading(
              { origin: "Burdujeni" },
              "The quoted fragment conflicts with the normalized origine_raw value Bucecea.",
              "medium",
              [sourceRef],
            ),
          ]
        : [];

      events.push({
        id: sourceEvent.eveniment_id,
        dossierId: documentId,
        sourceRefs: [sourceRef],
        raw: sourceEvent,
        normalized: {
          eventType: sourceEvent.tip,
          date: normalizeEventDate(sourceEvent),
          participantIds: [sourceEvent.participant],
        },
        confidence: contradiction ? "medium" : "high",
        assertionStatus: "explicit",
        reviewState:
          contradiction || sourceEvent.eveniment_id === "E-2590-004"
            ? "needs_review"
            : "not_required",
        alternativeReadings: alternatives,
        eventId: sourceEvent.eveniment_id,
        eventType: sourceEvent.tip,
        date: normalizeEventDate(sourceEvent),
        participantIds: [sourceEvent.participant],
        placeMentionIds: [],
        descriptionRaw: stringValue(record, "descriere_raw"),
        attributes: eventAttributes(sourceEvent),
        documentIds: [documentId],
      });
    }
  }
  return events;
}

interface MentionInput {
  id: string;
  dossierId: string;
  ownerType: PlaceMention["ownerType"];
  ownerId: string;
  personIds: string[];
  role: string;
  valueRaw: string;
  sourceRefs: SourceReference[];
  documentIds: string[];
  alternativeReadings?: AlternativeReading[];
}

function createPlaceMention(input: MentionInput): PlaceMention {
  const resolution = resolvePlaceValue(input.valueRaw);
  return {
    id: input.id,
    dossierId: input.dossierId,
    sourceRefs: input.sourceRefs,
    raw: { value: input.valueRaw, role: input.role },
    normalized: {
      placeId: resolution.placeId,
      resolutionStatus: resolution.resolutionStatus,
      role: input.role,
    },
    confidence:
      resolution.resolutionStatus === "resolved"
        ? "high"
        : resolution.resolutionStatus === "partially_resolved"
          ? "medium"
          : "unknown",
    assertionStatus:
      resolution.resolutionStatus === "resolved"
        ? "explicit"
        : resolution.resolutionStatus === "partially_resolved"
          ? "partial"
          : "unresolved",
    reviewState:
      resolution.resolutionStatus === "unresolved" ? "needs_review" : "not_required",
    alternativeReadings: input.alternativeReadings ?? [],
    placeMentionId: input.id,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    personIds: input.personIds,
    role: input.role,
    valueRaw: input.valueRaw,
    placeId: resolution.placeId,
    resolutionMethod: resolution.resolutionMethod,
    resolutionStatus: resolution.resolutionStatus,
    documentIds: input.documentIds,
  };
}

function buildPlaceMentions(dossiers: SourceDossier[]): PlaceMention[] {
  const mentions: PlaceMention[] = [];

  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);

    for (const [personIndex, person] of dossier.persoane.entries()) {
      if (!person.loc_nastere_raw) continue;
      mentions.push(
        createPlaceMention({
          id: `PM-${person.persoana_id}-BIRTH`,
          dossierId: documentId,
          ownerType: "person",
          ownerId: person.persoana_id,
          personIds: [person.persoana_id],
          role: "birth_place",
          valueRaw: person.loc_nastere_raw,
          sourceRefs: [
            dossierSourceRef(sourceFile, documentId, `persoane[${personIndex}].loc_nastere_raw`),
          ],
          documentIds: [documentId],
        }),
      );
    }

    for (const [eventIndex, event] of dossier.evenimente.entries()) {
      const record = asRecord(event);
      const pointer = event.sursa;
      const base = {
        dossierId: documentId,
        ownerType: "event" as const,
        ownerId: event.eveniment_id,
        personIds: [event.participant],
        documentIds: [documentId],
      };
      const scalarFields: Array<[string, string, string]> = [
        ["origine_raw", "origin", "ORIGIN"],
        ["destinatie_raw", "destination", "DESTINATION"],
        ["loc_raw", "event_place", "LOCATION"],
        ["institutie_raw", "institution", "INSTITUTION"],
      ];

      for (const [field, role, suffix] of scalarFields) {
        const value = stringValue(record, field);
        if (!value) continue;
        mentions.push(
          createPlaceMention({
            ...base,
            id: `PM-${event.eveniment_id}-${suffix}`,
            role,
            valueRaw: value,
            sourceRefs: [
              dossierSourceRef(sourceFile, documentId, `evenimente[${eventIndex}].${field}`, pointer),
            ],
          }),
        );
      }

      const arrayFields: Array<[string, string, string]> = [
        ["destinatii_raw", "destination", "DESTINATION"],
        ["locuri_raw", "event_place", "LOCATION"],
      ];
      for (const [field, role, suffix] of arrayFields) {
        for (const [valueIndex, value] of stringArray(record, field).entries()) {
          mentions.push(
            createPlaceMention({
              ...base,
              id: `PM-${event.eveniment_id}-${suffix}-${String(valueIndex + 1).padStart(2, "0")}`,
              role,
              valueRaw: value,
              sourceRefs: [
                dossierSourceRef(
                  sourceFile,
                  documentId,
                  `evenimente[${eventIndex}].${field}[${valueIndex}]`,
                  pointer,
                ),
              ],
            }),
          );
        }
      }

      if (event.eveniment_id === "E-2560-003") {
        const fragmentSource = dossierSourceRef(
          sourceFile,
          documentId,
          `evenimente[${eventIndex}].sursa.fragment`,
          pointer,
          pointer?.fragment ?? null,
        );
        mentions.push(
          createPlaceMention({
            ...base,
            id: "PM-E-2560-003-ORIGIN-FRAGMENT",
            role: "alternative_origin_reading",
            valueRaw: "Burdujeni",
            sourceRefs: [fragmentSource],
            alternativeReadings: [
              alternativeReading(
                "Bucecea",
                "The structured origine_raw field names Bucecea.",
                "medium",
                [fragmentSource],
              ),
            ],
          }),
        );
      }
    }

    for (const [index, placeSummary] of dossier.locuri_mentionate.entries()) {
      mentions.push(
        createPlaceMention({
          id: `PM-${documentId}-SUMMARY-${String(index + 1).padStart(2, "0")}`,
          dossierId: documentId,
          ownerType: "document",
          ownerId: documentId,
          personIds: [],
          role: placeSummary.roluri.join("; ") || "document_place_summary",
          valueRaw: placeSummary.raw,
          sourceRefs: [dossierSourceRef(sourceFile, documentId, `locuri_mentionate[${index}]`)],
          documentIds: [documentId],
        }),
      );
    }
  }

  return mentions;
}

function attachPlaceMentions(events: Event[], mentions: PlaceMention[]): Event[] {
  const byEvent = new Map<string, string[]>();
  for (const mention of mentions) {
    if (mention.ownerType !== "event") continue;
    byEvent.set(mention.ownerId, [...(byEvent.get(mention.ownerId) ?? []), mention.placeMentionId]);
  }
  return events.map((event) => ({
    ...event,
    placeMentionIds: (byEvent.get(event.eventId) ?? []).sort(),
  }));
}

function buildRouteSegments(events: Event[]): RouteSegment[] {
  const byId = new Map(events.map((event) => [event.eventId, event]));
  const required = (eventId: string): Event => {
    const event = byId.get(eventId);
    if (!event) throw new Error(`Missing route evidence event ${eventId}`);
    return event;
  };
  const first = required("E-2560-002");
  const second = required("E-2560-003");
  const deportation = required("E-2590-004");
  const frontier = required("E-2590-007");

  return [
    {
      id: "RS-2560-001",
      dossierId: "DOROHOI-2560",
      sourceRefs: first.sourceRefs,
      raw: first.raw,
      normalized: {
        originPlaceId: PLACE_IDS.mihaileni,
        destinationPlaceId: PLACE_IDS.bucecea,
        routeStatus: "explicit",
      },
      confidence: "high",
      assertionStatus: "explicit",
      reviewState: "not_required",
      alternativeReadings: [],
      routeSegmentId: "RS-2560-001",
      personId: "P-2560-001",
      originPlaceId: PLACE_IDS.mihaileni,
      destinationPlaceId: PLACE_IDS.bucecea,
      sequence: 1,
      date: { raw: "19 Iunie 1941", start: "1941-06-19", end: "1941-06-19", precision: "day" },
      transportRaw: "pe jos",
      routeStatus: "explicit",
      lineStyle: "solid",
      directionKnown: true,
      evidenceEventIds: [first.eventId],
      notes: null,
    },
    {
      id: "RS-2560-002",
      dossierId: "DOROHOI-2560",
      sourceRefs: second.sourceRefs,
      raw: second.raw,
      normalized: {
        originPlaceId: PLACE_IDS.bucecea,
        destinationPlaceId: PLACE_IDS.dorohoi,
        routeStatus: "explicit",
      },
      confidence: "medium",
      assertionStatus: "explicit",
      reviewState: "needs_review",
      alternativeReadings: [
        alternativeReading(
          { originPlaceId: PLACE_IDS.burdujeni, originRaw: "Burdujeni" },
          "The quoted fragment says Burdujeni while the structured origin says Bucecea.",
          "medium",
          second.sourceRefs,
        ),
      ],
      routeSegmentId: "RS-2560-002",
      personId: "P-2560-001",
      originPlaceId: PLACE_IDS.bucecea,
      destinationPlaceId: PLACE_IDS.dorohoi,
      sequence: 2,
      date: { raw: "4 Iulie 1941", start: "1941-07-04", end: "1941-07-04", precision: "day" },
      transportRaw: null,
      routeStatus: "explicit",
      lineStyle: "solid",
      directionKnown: true,
      evidenceEventIds: [second.eventId],
      notes: "Origin is under review because the source fragment names Burdujeni.",
    },
    {
      id: "RS-2590-001",
      dossierId: "DOROHOI-2590",
      sourceRefs: [...deportation.sourceRefs, ...frontier.sourceRefs],
      raw: { deportation: deportation.raw, frontier: frontier.raw },
      normalized: {
        originPlaceId: PLACE_IDS.dorohoi,
        destinationPlaceId: PLACE_IDS.otaci,
        routeStatus: "partial",
      },
      confidence: "medium",
      assertionStatus: "partial",
      reviewState: "needs_review",
      alternativeReadings: [],
      routeSegmentId: "RS-2590-001",
      personId: "P-2590-001",
      originPlaceId: PLACE_IDS.dorohoi,
      destinationPlaceId: PLACE_IDS.otaci,
      sequence: 1,
      date: { raw: "10 Noembrie 941", start: "1941-11-10", end: "1941-11-10", precision: "day" },
      transportRaw: null,
      routeStatus: "partial",
      lineStyle: "dashed",
      directionKnown: true,
      evidenceEventIds: [deportation.eventId, frontier.eventId],
      notes: "Dorohoi origin and Ataki frontier presence are explicit; the exact intervening path is not.",
    },
    {
      id: "RS-2590-002",
      dossierId: "DOROHOI-2590",
      sourceRefs: [...frontier.sourceRefs, ...deportation.sourceRefs],
      raw: { frontier: frontier.raw, deportation: deportation.raw },
      normalized: {
        originPlaceId: PLACE_IDS.otaci,
        destinationPlaceId: PLACE_IDS.mohyliv,
        routeStatus: "partial",
      },
      confidence: "medium",
      assertionStatus: "partial",
      reviewState: "needs_review",
      alternativeReadings: [],
      routeSegmentId: "RS-2590-002",
      personId: "P-2590-001",
      originPlaceId: PLACE_IDS.otaci,
      destinationPlaceId: PLACE_IDS.mohyliv,
      sequence: 2,
      date: { raw: null, start: null, end: null, precision: "unknown" },
      transportRaw: null,
      routeStatus: "partial",
      lineStyle: "dashed",
      directionKnown: true,
      evidenceEventIds: [frontier.eventId, deportation.eventId],
      notes: "Ataki presence and Moghilev destination are explicit; travel date and exact path are not.",
    },
  ];
}

function buildNameVariants(dossiers: SourceDossier[]): PersonNameVariant[] {
  const variants: PersonNameVariant[] = [];
  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);
    for (const [index, person] of dossier.persoane.entries()) {
      const personRef = dossierSourceRef(sourceFile, documentId, `persoane[${index}].nume_afisat`);
      const primaryId = `PNV-${person.persoana_id}-PRIMARY`;
      variants.push({
        id: primaryId,
        dossierId: documentId,
        sourceRefs: [personRef],
        raw: person.nume_afisat,
        normalized: { value: person.nume_afisat, variantType: "documentary" },
        confidence: confidenceFromRomanian(person.incredere_identitate),
        assertionStatus: "explicit",
        reviewState: "not_required",
        alternativeReadings: [],
        variantId: primaryId,
        personId: person.persoana_id,
        value: person.nume_afisat,
        variantType: "documentary",
        language: "ro",
        script: "Latn",
      });

      for (const [alternativeIndex, value] of (person.lecturi_alternative ?? []).entries()) {
        const variantId = `PNV-${person.persoana_id}-ALT-${String(alternativeIndex + 1).padStart(2, "0")}`;
        variants.push({
          id: variantId,
          dossierId: documentId,
          sourceRefs: [personRef],
          raw: value,
          normalized: { value, variantType: "alternative_reading" },
          confidence: "medium",
          assertionStatus: "unresolved",
          reviewState: "needs_review",
          alternativeReadings: [
            alternativeReading(person.nume_afisat, "Primary documentary reading", "medium", [personRef]),
          ],
          variantId,
          personId: person.persoana_id,
          value,
          variantType: "alternative_reading",
          language: "ro",
          script: "Latn",
        });
      }
    }

    for (const [matchIndex, match] of (dossier.potriviri_de_verificat ?? []).entries()) {
      const matchRecord = asRecord(match);
      const personId = stringValue(matchRecord, "persoana_id");
      const person = dossier.persoane.find((candidate) => candidate.persoana_id === personId);
      if (!personId || !person) continue;
      const matchRef = dossierSourceRef(
        sourceFile,
        documentId,
        `potriviri_de_verificat[${matchIndex}].cautare_recomandata`,
      );
      const searchValues = stringArray(matchRecord, "cautare_recomandata").filter(
        (value) => value !== person.nume_afisat,
      );
      for (const [searchIndex, value] of searchValues.entries()) {
        const variantId = `PNV-${personId}-SEARCH-${String(searchIndex + 1).padStart(2, "0")}`;
        variants.push({
          id: variantId,
          dossierId: documentId,
          sourceRefs: [matchRef],
          raw: value,
          normalized: { value, variantType: "search_form" },
          confidence: "medium",
          assertionStatus: "partial",
          reviewState: "needs_review",
          alternativeReadings: [],
          variantId,
          personId,
          value,
          variantType: "search_form",
          language: "ro",
          script: "Latn",
        });
      }
    }
  }
  return variants;
}

function buildPersons(
  dossiers: SourceDossier[],
  relationships: Relationship[],
  households: Household[],
  events: Event[],
  routes: RouteSegment[],
  nameVariants: PersonNameVariant[],
): Person[] {
  const persons: Person[] = [];
  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);
    for (const [index, person] of dossier.persoane.entries()) {
      const sourceRef = dossierSourceRef(sourceFile, documentId, `persoane[${index}]`);
      const confidence = confidenceFromRomanian(person.incredere_identitate);
      const alternatives = (person.lecturi_alternative ?? []).map((value) =>
        alternativeReading(value, "Alternative source reading", "medium", [sourceRef]),
      );
      const personRelationships = relationships
        .filter(
          (relationship) =>
            relationship.person1Id === person.persoana_id ||
            relationship.person2Id === person.persoana_id,
        )
        .map((relationship) => relationship.relationshipId);
      const personHouseholds = households
        .filter((household) => household.memberPersonIds.includes(person.persoana_id))
        .map((household) => household.householdId);
      const personEvents = events
        .filter((event) => event.participantIds.includes(person.persoana_id))
        .map((event) => event.eventId);
      const personRoutes = routes
        .filter((route) => route.personId === person.persoana_id)
        .map((route) => route.routeSegmentId);
      const personVariants = nameVariants
        .filter((variant) => variant.personId === person.persoana_id)
        .map((variant) => variant.variantId);
      const sex = person.sex === "M" ? "male" : person.sex === "F" ? "female" : "unknown";

      persons.push({
        id: person.persoana_id,
        dossierId: documentId,
        sourceRefs: [sourceRef],
        raw: person,
        normalized: {
          displayName: person.nume_afisat,
          givenName: person.prenume ?? null,
          familyName: person.nume_familie ?? null,
          sex,
          birthDate: normalizeBirthDate(person),
        },
        confidence,
        assertionStatus: "explicit",
        reviewState: alternatives.length > 0 ? "needs_review" : "not_required",
        alternativeReadings: alternatives,
        personId: person.persoana_id,
        displayName: person.nume_afisat,
        givenName: person.prenume ?? null,
        familyName: person.nume_familie ?? null,
        sex,
        birthDate: normalizeBirthDate(person),
        birthPlaceMentionId: person.loc_nastere_raw ? `PM-${person.persoana_id}-BIRTH` : null,
        civilStatusRaw: person.stare_civila_raw ?? null,
        roles: person.roluri_in_document,
        documentIds: [documentId],
        householdIds: personHouseholds.sort(),
        nameVariantIds: personVariants.sort(),
        relationshipIds: personRelationships.sort(),
        eventIds: personEvents.sort(),
        routeSegmentIds: personRoutes.sort(),
      });
    }
  }
  return persons;
}

function normalizeEhriPlace(sourcePlace: EhriPlace, index: number): Place {
  const placeId = `PL-EHRI-${String(index + 1).padStart(4, "0")}`;
  const sourceRef = ehriSourceRef(index);
  const variants = unique([
    ...sourcePlace.alt.map((name) => name.trim()).filter(Boolean),
    ...(sourcePlace.in_dosare ? [sourcePlace.in_dosare] : []),
  ]);
  const allLabels = [sourcePlace.nume, ...sourcePlace.alt].join(" ");
  const labelSuggestsGhetto = /(ghetto|ghetou|geto|getto|гетто|גטו|געטא)/iu.test(allLabels);
  const typeConflict = sourcePlace.tip === "lagar" && labelSuggestsGhetto;
  const relatedPlaceIds = index === 381 ? [PLACE_IDS.mohyliv] : [];

  return {
    id: placeId,
    dossierId: null,
    sourceRefs: [sourceRef],
    raw: sourcePlace,
    normalized: {
      name: sourcePlace.nume.trim(),
      variants,
      type: sourcePlace.tip === "lagar" ? "camp" : "ghetto",
    },
    confidence: "medium",
    assertionStatus: "explicit",
    reviewState: typeConflict ? "needs_review" : "not_required",
    alternativeReadings: [],
    placeId,
    originalName: sourcePlace.nume,
    normalizedName: sourcePlace.nume.trim(),
    displayNames: { en: sourcePlace.nume.trim(), ro: sourcePlace.nume.trim() },
    variants,
    placeType: sourcePlace.tip === "lagar" ? "camp" : "ghetto",
    coordinates: { latitude: sourcePlace.lat, longitude: sourcePlace.lng },
    coordinateSource: {
      label: "Supplied local EHRI extract (upstream coordinate source not stated)",
      url: null,
      accessed: null,
      sourceRecordId: sourceRef.sourceRecordId,
    },
    coordinateConfidence: "unknown",
    resolutionStatus: "resolved",
    layer: "ehri_local",
    externalDatasetId: sourceRef.sourceRecordId,
    relatedPlaceIds,
  };
}

function reviewCategoryForProblem(problem: string): ReviewCategory {
  if (/localită|localita|identificarea/i.test(problem)) return "unresolved_place";
  if (/relați|relati/i.test(problem)) return "questionable_relationship";
  if (/lectur|nume|ocupați|ocupati|cuvânt|cuvant/i.test(problem)) return "uncertain_reading";
  return "source_collation";
}

function createReviewTask(input: {
  id: string;
  dossierId: string | null;
  sourceRefs: SourceReference[];
  raw: unknown;
  category: ReviewCategory;
  title: string;
  description: string;
  severity: ReviewTask["severity"];
  entityRefs: ReviewTask["entityRefs"];
  suggestedAction: string | null;
  confidence?: ReviewTask["confidence"];
}): ReviewTask {
  return {
    id: input.id,
    dossierId: input.dossierId,
    sourceRefs: input.sourceRefs,
    raw: input.raw,
    normalized: { category: input.category, status: "open" },
    confidence: input.confidence ?? "high",
    assertionStatus: "explicit",
    reviewState: "needs_review",
    alternativeReadings: [],
    reviewTaskId: input.id,
    category: input.category,
    title: input.title,
    description: input.description,
    severity: input.severity,
    status: "open",
    entityRefs: input.entityRefs,
    suggestedAction: input.suggestedAction,
  };
}

function buildReviewTasks(
  dossiers: SourceDossier[],
  relationships: Relationship[],
  ehriPlaces: EhriPlace[],
): ReviewTask[] {
  const tasks: ReviewTask[] = [];

  for (const dossier of dossiers) {
    const documentId = dossier.document.document_id;
    const sourceFile = sourceFileForDocument(documentId);
    for (const [index, problem] of dossier.probleme_deschise.entries()) {
      const category = reviewCategoryForProblem(problem);
      tasks.push(
        createReviewTask({
          id: `RT-${documentId.replace("DOROHOI-", "")}-SOURCE-${String(index + 1).padStart(2, "0")}`,
          dossierId: documentId,
          sourceRefs: [dossierSourceRef(sourceFile, documentId, `probleme_deschise[${index}]`)],
          raw: problem,
          category,
          title:
            category === "unresolved_place"
              ? "Place identification requires review"
              : category === "uncertain_reading"
                ? "Documentary reading requires review"
                : "Source collation remains open",
          description: problem,
          severity: category === "unresolved_place" ? "high" : "medium",
          entityRefs: [{ entityType: "document", entityId: documentId }],
          suggestedAction: "Consult the source scan and record the reviewed reading without replacing the raw extraction.",
        }),
      );
    }

    for (const [index, match] of (dossier.potriviri_de_verificat ?? []).entries()) {
      const matchRecord = asRecord(match);
      const personId = stringValue(matchRecord, "persoana_id") ?? "";
      tasks.push(
        createReviewTask({
          id: `RT-${documentId.replace("DOROHOI-", "")}-MATCH-${String(index + 1).padStart(2, "0")}`,
          dossierId: documentId,
          sourceRefs: [dossierSourceRef(sourceFile, documentId, `potriviri_de_verificat[${index}]`)],
          raw: match,
          category: "possible_duplicate_person",
          title: "External identity match not yet checked",
          description: `Search forms: ${stringArray(matchRecord, "cautare_recomandata").join(", ")}.`,
          severity: "low",
          entityRefs: personId ? [{ entityType: "person", entityId: personId }] : [],
          suggestedAction: "Search the named repatriate list and record evidence before linking identities.",
          confidence: "unknown",
        }),
      );
    }
  }

  const unresolvedSource = dossierSourceRef(
    SOURCE_FILES.dossier2590,
    "DOROHOI-2590",
    "evenimente[3].destinatii_raw[1]",
  );
  tasks.push(
    createReviewTask({
      id: "RT-2590-UNRESOLVED-TROPOV",
      dossierId: "DOROHOI-2590",
      sourceRefs: [unresolvedSource],
      raw: "Tropov[...]",
      category: "unresolved_place",
      title: "Identify the place written after Moghilev",
      description: "The current reading is Tropov[…]. No coordinates or route segment have been assigned.",
      severity: "high",
      entityRefs: [{ entityType: "place", entityId: PLACE_IDS.tropov }],
      suggestedAction: "Collate the scan and compare historically plausible names without resolving by similarity alone.",
    }),
  );
  tasks.push(
    createReviewTask({
      id: "RT-2590-INCOMPLETE-ROUTE",
      dossierId: "DOROHOI-2590",
      sourceRefs: [unresolvedSource],
      raw: "Dorohoi; Ataki; Moghilev; Tropov[...]",
      category: "incomplete_route",
      title: "Iancu Aizic deportation route is incomplete",
      description: "Two partial legs are shown. The subsequent unresolved place remains a mention with no segment.",
      severity: "high",
      entityRefs: [
        { entityType: "person", entityId: "P-2590-001" },
        { entityType: "route_segment", entityId: "RS-2590-001" },
        { entityType: "route_segment", entityId: "RS-2590-002" },
      ],
      suggestedAction: "Resolve the reading and seek explicit movement evidence before adding another leg.",
    }),
  );

  const contradictionSource = dossierSourceRef(
    SOURCE_FILES.dossier2560,
    "DOROHOI-2560",
    "evenimente[2]",
    undefined,
    "origine_raw: Bucecea; fragment: din Burdujeni la Dorohoi",
  );
  tasks.push(
    createReviewTask({
      id: "RT-2560-BUCECEA-BURDUJENI",
      dossierId: "DOROHOI-2560",
      sourceRefs: [contradictionSource],
      raw: { structuredOrigin: "Bucecea", fragmentOrigin: "Burdujeni" },
      category: "contradiction",
      title: "Bucecea/Burdujeni route-origin conflict",
      description: "The analytical origin field says Bucecea, but its quoted fragment says Burdujeni.",
      severity: "high",
      entityRefs: [
        { entityType: "event", entityId: "E-2560-003" },
        { entityType: "route_segment", entityId: "RS-2560-002" },
        { entityType: "place", entityId: PLACE_IDS.burdujeni },
      ],
      suggestedAction: "Inspect PDF page 9 and retain both readings until the transcription is collated.",
    }),
  );

  for (const relationship of relationships.filter((item) => item.reviewState === "needs_review")) {
    tasks.push(
      createReviewTask({
        id: `RT-${relationship.relationshipId}-CONFIDENCE`,
        dossierId: relationship.dossierId,
        sourceRefs: relationship.sourceRefs,
        raw: relationship.raw,
        category: "questionable_relationship",
        title: "Relationship requires confirmation",
        description: "The spouse relationship is present in the analytical source at medium confidence.",
        severity: "medium",
        entityRefs: [{ entityType: "relationship", entityId: relationship.relationshipId }],
        suggestedAction: "Verify the family table and preserve any competing name or relationship reading.",
        confidence: relationship.confidence,
      }),
    );
  }

  const typeConflicts = ehriPlaces.filter((place) => {
    const labels = [place.nume, ...place.alt].join(" ");
    return place.tip === "lagar" && /(ghetto|ghetou|geto|getto|гетто|גטו|געטא)/iu.test(labels);
  }).length;
  const leadingWhitespaceVariants = ehriPlaces.reduce(
    (count, place) => count + place.alt.filter((variant) => variant !== variant.trim()).length,
    0,
  );
  const coordinateCounts = new Map<string, number>();
  for (const place of ehriPlaces) {
    const key = `${place.lat},${place.lng}`;
    coordinateCounts.set(key, (coordinateCounts.get(key) ?? 0) + 1);
  }
  const sharedCoordinateGroups = [...coordinateCounts.values()].filter((count) => count > 1).length;
  tasks.push(
    createReviewTask({
      id: "RT-EHRI-CATALOG-QUALITY",
      dossierId: null,
      sourceRefs: [ehriSourceRef(0), ehriSourceRef(ehriPlaces.length - 1)],
      raw: { typeConflicts, leadingWhitespaceVariants, sharedCoordinateGroups },
      category: "external_catalog_quality",
      title: "Local EHRI overlay needs catalog-level quality review",
      description: `${typeConflicts} records have a ghetto-like label but are coded as camp; ${leadingWhitespaceVariants} alternatives contain outer whitespace; ${sharedCoordinateGroups} coordinate pairs are shared by multiple records. Supplied values remain preserved.`,
      severity: "medium",
      entityRefs: [{ entityType: "dataset", entityId: "EHRI-LOCAL" }],
      suggestedAction: "Compare the local extract with upstream identifiers and provenance before merging or correcting records.",
    }),
  );

  return tasks;
}

export function normalizeSourceCorpus(corpus: SourceCorpus): NormalizedBundle {
  const dossiers = [corpus.dossier2560, corpus.dossier2590];
  const documents = buildDocuments(dossiers);
  const relationships = buildRelationships(dossiers);
  const households = buildHouseholds(dossiers);
  const initialEvents = buildEvents(dossiers);
  const placeMentions = buildPlaceMentions(dossiers);
  const events = attachPlaceMentions(initialEvents, placeMentions);
  const routeSegments = buildRouteSegments(events);
  const personNameVariants = buildNameVariants(dossiers);
  const persons = buildPersons(
    dossiers,
    relationships,
    households,
    events,
    routeSegments,
    personNameVariants,
  );
  const corePlaces = buildCorePlaces();
  const ehriPlaces = corpus.ehriPlaces.map(normalizeEhriPlace);
  const places = [...corePlaces, ...ehriPlaces];
  const reviewTasks = buildReviewTasks(dossiers, relationships, corpus.ehriPlaces);

  const bundle: NormalizedBundle = {
    persons: sortById(persons),
    personNameVariants: sortById(personNameVariants),
    households: sortById(households),
    relationships: sortById(relationships),
    documents: sortById(documents),
    events: sortById(events),
    places: sortById(places),
    placeMentions: sortById(placeMentions),
    routeSegments: sortById(routeSegments),
    reviewTasks: sortById(reviewTasks),
  };

  return NormalizedBundleSchema.parse(bundle);
}
