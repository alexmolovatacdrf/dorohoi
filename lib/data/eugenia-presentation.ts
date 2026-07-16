import eugeniaPresentation from "@/data/normalized/eugenia-presentation.json";
import eugeniaPresentationPlaces from "@/data/normalized/eugenia-presentation-places.json";
import normalizedPlaces from "@/data/normalized/places.json";
import type { DateRange, Place } from "@/lib/domain/schemas";
import type {
  MapPlaceDatum,
  MapPlacePersonConnection,
  MapPersonStory,
  MapRouteDatum,
  MapViewModel,
} from "@/lib/data/selectors";

type PresentationRow = Record<string, unknown> & {
  Dosar?: string;
  _excelRow?: number;
};

type FamilyMention = {
  name: string;
  role: string;
  birthYear: string | null;
  source: "Eugenia" | "transcription";
};

type RouteStop = {
  raw: string;
  placeId: string | null;
  date: DateRange | null;
  kind: "origin" | "intermediary" | "destination";
};

type PlacePersonContext = {
  personId: string;
  roles: string[];
  eventTypes: string[];
  dossierIds: string[];
  connections: MapPlacePersonConnection[];
};

const imported = eugeniaPresentation as unknown as {
  metadata: {
    sourceFiles: Array<{ fileName: string; format: string; sha256: string }>;
    rowCount: number;
    selectedColumns: Array<{ column: string; header: string }>;
  };
  rows: PresentationRow[];
};

export const EUGENIA_PRESENTATION_SOURCE = {
  key: "eugenia-presentation",
  label: "Verified Eugenia data",
  description: `${imported.metadata.rowCount} verified dossier rows · red Row 1 columns only`,
  sourceFile: imported.metadata.sourceFiles[0]?.fileName ?? "Tabel_Verde_Comparativ_16072026_0835.xlsx",
} as const;

const sourceLabel = `${EUGENIA_PRESENTATION_SOURCE.sourceFile} · red Row 1 columns only`;
const importedPresentationPlaces = eugeniaPresentationPlaces as unknown as {
  metadata: {
    coordinateSource: string;
    accessed: string;
  };
  places: Array<{
    id: string;
    rawNames: string[];
    label: string;
    coordinates: { latitude: number; longitude: number };
    sourceUrl: string;
  }>;
};

const explicitPresentationPlaces: Place[] = importedPresentationPlaces.places.map((place) => ({
  id: place.id,
  dossierId: null,
  sourceRefs: [{
    sourceFile: place.sourceUrl,
    sourceDataset: "curated_gazetteer",
    documentId: null,
    dossierId: null,
    pagePdf: null,
    pagePrinted: null,
    field: "presentation settlement coordinates",
    sourceRecordId: place.id,
    fragmentRaw: place.label,
  }],
  raw: { originalName: place.rawNames[0] ?? place.label, variants: place.rawNames },
  normalized: {
    normalizedName: place.label,
    displayNames: { en: place.label, ro: place.label },
    resolutionStatus: "resolved",
    coordinateSource: importedPresentationPlaces.metadata.coordinateSource,
  },
  confidence: "unknown",
  assertionStatus: "explicit",
  reviewState: "not_required",
  alternativeReadings: [],
  placeId: place.id,
  originalName: place.rawNames[0] ?? place.label,
  normalizedName: place.label,
  displayNames: { en: place.label, ro: place.label },
  variants: place.rawNames,
  placeType: "settlement",
  coordinates: place.coordinates,
  coordinateSource: {
    label: importedPresentationPlaces.metadata.coordinateSource,
    url: place.sourceUrl,
    accessed: importedPresentationPlaces.metadata.accessed,
    sourceRecordId: place.id,
  },
  coordinateConfidence: "unknown",
  resolutionStatus: "resolved",
  layer: "core",
  externalDatasetId: null,
  relatedPlaceIds: [],
}));

// Presentation-only coordinate supplements for explicit table values that
// cannot otherwise be drawn. These do not replace the raw source wording.
// Darabani is the source-table origin for dossier 2571 and is resolved to the
// town record below. Transnistria remains a display centroid, not a claim
// about a precise camp or settlement.
const presentationDerivedCoordinates: Record<string, {
  latitude: number;
  longitude: number;
  sourceRecordId: string;
  sourceUrl: string | null;
}> = {
  "PL-CORE-TRANSNISTRIA": {
    latitude: 47.6245710692,
    longitude: 29.8991366689,
    sourceRecordId: "1941-08-003",
    sourceUrl: null,
  },
};

const presentationDerivedPlaces: Place[] = [{
  id: "PL-PRESENTATION-DARABANI",
  dossierId: null,
  sourceRefs: [{
    sourceFile: "https://www.openstreetmap.org/way/75538886",
    sourceDataset: "curated_gazetteer",
    documentId: null,
    dossierId: null,
    pagePdf: null,
    pagePrinted: null,
    field: "presentation route origin coordinate",
    sourceRecordId: "OSM way 75538886",
    fragmentRaw: "Darabani",
  }],
  raw: { originalName: "Darabani", variants: ["Darabani"] },
  normalized: {
    normalizedName: "Darabani",
    displayNames: { en: "Darabani", ro: "Darabani" },
    resolutionStatus: "resolved",
    coordinateSource: "OpenStreetMap town record",
  },
  confidence: "high",
  assertionStatus: "explicit",
  reviewState: "not_required",
  alternativeReadings: [],
  placeId: "PL-PRESENTATION-DARABANI",
  originalName: "Darabani",
  normalizedName: "Darabani",
  displayNames: { en: "Darabani", ro: "Darabani" },
  variants: ["Darabani"],
  placeType: "settlement",
  coordinates: { latitude: 48.199792, longitude: 26.5966606 },
  coordinateSource: {
    label: "OpenStreetMap town record",
    url: "https://www.openstreetmap.org/way/75538886",
    accessed: "2026-07-16",
    sourceRecordId: "OSM way 75538886",
  },
  coordinateConfidence: "high",
  resolutionStatus: "resolved",
  layer: "core",
  externalDatasetId: null,
  relatedPlaceIds: [],
}];

const allPlaces = [
  ...(normalizedPlaces as Place[]),
  ...explicitPresentationPlaces,
  ...presentationDerivedPlaces,
].map((place) => {
  const derived = presentationDerivedCoordinates[place.placeId];
  if (!derived || place.coordinates) return place;
  return {
    ...place,
    coordinates: { latitude: derived.latitude, longitude: derived.longitude },
    coordinateSource: {
      label: "Centroid derived from the supplied August 1941 historical administration polygon",
      url: derived.sourceUrl,
      accessed: "2026-07-16",
      sourceRecordId: derived.sourceRecordId,
    },
    coordinateConfidence: "unknown",
    resolutionStatus: "partially_resolved",
  } satisfies Place;
});
const basePlaces = new Map(allPlaces.map((place) => [place.placeId, place]));

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro")
    .replace(/[()[\],;:/|]/g, " ")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yearDate(year: string, raw: string): DateRange {
  return { raw, start: `${year}-01-01`, end: `${year}-12-31`, precision: "year" };
}

function toDateRange(value: unknown): DateRange | null {
  const raw = clean(value);
  if (!raw) return null;

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return { raw, start: date, end: date, precision: "day" };
  }

  const dotted = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (dotted) {
    const date = `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
    return { raw, start: date, end: date, precision: "day" };
  }

  const onlyYear = raw.match(/\b(19\d{2}|20\d{2})\b/);
  return onlyYear ? yearDate(onlyYear[1], raw) : { raw, start: null, end: null, precision: "unknown" };
}

function personSex(value: unknown): "male" | "female" | "unknown" {
  const text = clean(value)?.toLocaleLowerCase("ro");
  if (text === "m" || text === "male" || text === "masculin") return "male";
  if (text === "f" || text === "female" || text === "feminin") return "female";
  return "unknown";
}

function tableValue(row: PresentationRow, header: string): string | null {
  return clean(row[header]);
}

function tableName(row: PresentationRow): string {
  const familyName = tableValue(row, "Name — Eugenia") ?? "Unnamed person";
  const givenName = tableValue(row, "Surname — Eugenia");
  return givenName ? `${familyName} ${givenName}`.replace(/\s+/g, " ").trim() : familyName;
}

function placeCandidateValues(place: Place): string[] {
  const values = [place.displayNames.en, place.displayNames.ro, place.originalName, ...place.variants].filter(Boolean);
  return values.flatMap((value) => {
    const full = normalizedText(value);
    const pieces = value.split(/[\/|,;()]/).map(normalizedText).filter(Boolean);
    const withoutType = normalizedText(value.replace(/\s+(?:concentration camp|camp|ghetto)$/i, ""));
    return [...new Set([full, withoutType, ...pieces])];
  });
}

const placeCandidates = new Map<string, Place[]>();
for (const place of allPlaces) {
  for (const candidate of placeCandidateValues(place)) {
    const current = placeCandidates.get(candidate) ?? [];
    current.push(place);
    placeCandidates.set(candidate, current);
  }
}

// The table's "Edinet" spelling corresponds to the supplied EHRI record
// "Edineţi concentration camp". This is an orthographic source-name alias,
// not a new place or an inferred route stop.
const sourcePlaceAliases = new Map([["edinet", "edineti"]]);

function placeIdForRaw(value: unknown, mode: "any" | "settlement" = "any"): string | null {
  const text = clean(value);
  if (!text) return null;
  const lookupKeys = [normalizedText(text), sourcePlaceAliases.get(normalizedText(text))].filter(
    (key): key is string => Boolean(key),
  );
  const candidates = [...new Set(lookupKeys.flatMap((key) => placeCandidates.get(key) ?? []))].filter((place) =>
    mode === "any" || place.placeType === "settlement" || place.placeType === "historical_region" || place.layer === "core",
  );
  const place = [...candidates].sort((left, right) => {
    const leftCore = left.layer === "core" ? 0 : 1;
    const rightCore = right.layer === "core" ? 0 : 1;
    return leftCore - rightCore || Number(Boolean(right.coordinates)) - Number(Boolean(left.coordinates));
  })[0];
  return place?.placeId ?? null;
}

function splitPlaces(value: unknown): string[] {
  const raw = clean(value);
  return raw ? raw.split(/\s*(?:,|;|→|->)\s*/).map((part) => part.trim()).filter(Boolean) : [];
}

function cleanPresentationPlaceLabel(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/\s+(?:concentration camp|camp|ghetto|historical region|regiune istorică)$/iu, "")
    .trim();
}

function presentationPlaceLabel(place: Place, language: "en" | "ro" = "en"): string {
  return cleanPresentationPlaceLabel(language === "ro" ? place.displayNames.ro : place.displayNames.en);
}

const familyRoleWords = new Set([
  "wife", "husband", "son", "daughter", "child", "children", "sister", "brother", "mother", "father",
  "soție", "sotie", "sotul", "soțul", "fiu", "fiică", "fiica", "copil", "copiii", "soră", "sora", "frate",
  "mama", "tata", "ani", "year", "years",
]);

function parseFamilyColumn(value: unknown, source: FamilyMention["source"]): FamilyMention[] {
  const raw = clean(value);
  if (!raw) return [];

  const referencedHead = raw.match(/cap familie:\s*(.+?)(?:\s+—|$)/i);
  if (referencedHead?.[1]) {
    return [{ name: referencedHead[1].trim(), role: "referenced family head", birthYear: null, source }];
  }

  return raw
    .split(";")
    .flatMap((segment) => segment.split(/\s+and\s+/i))
    .flatMap((segment) => {
      const birthYear = segment.match(/\b(19\d{2}|20\d{2})\b/)?.[1] ?? null;
      const parenthetical = segment.match(/\(([^)]*)\)/)?.[1] ?? "";
      const withoutParenthetical = segment.replace(/\([^)]*\)/g, "");
      return withoutParenthetical.split(",").map((part) => part.replace(/\b(?:19\d{2}|20\d{2})\b/g, "").trim()).filter((part) => {
        const normalized = part.toLocaleLowerCase("ro").replace(/[.?]/g, "").trim();
        return Boolean(part) && !/^\d{1,4}$/.test(normalized) && !/^\d+\s*(?:ani|years?)$/.test(normalized) && !familyRoleWords.has(normalized);
      }).map((part) => ({
        name: part.replace(/^\[.*?\]\s*/, "").trim(),
        role: parenthetical || "family member mentioned",
        birthYear,
        source,
      }));
    })
    .filter((mention) => mention.name.length > 1);
}

function mergeFamilyMentions(row: PresentationRow, headName: string): FamilyMention[] {
  const mentions = [
    ...parseFamilyColumn(row["Family members — Eugenia"], "Eugenia"),
    ...parseFamilyColumn(row["Family members — transcriere"], "transcription"),
  ];
  const merged: FamilyMention[] = [];
  const headKey = normalizedText(headName);
  for (const mention of mentions) {
    const key = normalizedText(mention.name);
    if (!key || key === headKey) continue;
    const keyParts = key.split(" ");
    const existing = merged.find((candidate) => {
      const candidateKey = normalizedText(candidate.name);
      const candidateParts = candidateKey.split(" ");
      return candidateKey === key
        || (keyParts.length === 1 && keyParts[0].length > 2 && candidateParts.includes(keyParts[0]))
        || (candidateParts.length === 1 && candidateParts[0].length > 2 && keyParts.includes(candidateParts[0]));
    });
    if (!existing) {
      merged.push(mention);
      continue;
    }
    if (mention.name.length > existing.name.length) existing.name = mention.name;
    if (!existing.birthYear && mention.birthYear) existing.birthYear = mention.birthYear;
    if (existing.source !== mention.source) existing.role = `${existing.role}; alternative source reading`;
  }
  return merged;
}

function categoriesForContext(roles: string[], eventTypes: string[]): MapPlaceDatum["categories"] {
  const text = `${roles.join(" ")} ${eventTypes.join(" ")}`.toLocaleLowerCase("ro");
  const categories: MapPlaceDatum["categories"] = [];
  if (/birth|naștere|nastere|origin/.test(text)) categories.push("origin");
  if (/deport|evacuat|evacuation|intermediary/.test(text)) categories.push("evacuation_deportation");
  return categories;
}

function rowNarrative(row: PresentationRow): string | null {
  const fields = [
    ["Deported from", row["Deported from — Eugenia"]],
    ["Intermediary deportation", row["Intermediary deportation — Eugenia"]],
    ["Date of intermediary deportation", row["Date of intermediary deportation — Eugenia"]],
    ["Deported to Transnistria", row["Deported to Transnistria — Eugenia"]],
    ["Date of deportation to Transnistria", row["Date of deportation to Transnistria — Eugenia"]],
    ["Deportation details", row["Deportation details — Eugenia"]],
    ["Family members — Eugenia", row["Family members — Eugenia"]],
    ["Family members — transcription", row["Family members — transcriere"]],
    ["Other sufferings", row["Other sufferings — Eugenia"]],
  ] as const;
  const lines = fields.map(([label, value]) => {
    const text = clean(value);
    return text ? `${label}: ${text}` : null;
  }).filter((value): value is string => Boolean(value));
  return lines.length ? lines.join("\n") : null;
}

const mapData: MapViewModel = (() => {
  const persons: MapViewModel["persons"] = [];
  const groups: MapViewModel["groups"] = [];
  const dossiers: MapViewModel["dossiers"] = [];
  const routes: MapRouteDatum[] = [];
  const stories = new Map<string, MapPersonStory>();
  const contextByPlace = new Map<string, Map<string, PlacePersonContext>>();
  const unresolvedMentions: MapViewModel["unresolvedMentions"] = [];
  const usedCorePlaceIds = new Set<string>();
  const eventTypes = new Set<string>();

  const addContext = (
    placeId: string,
    personId: string,
    dossierId: string,
    role: string,
    eventType: string,
    date: DateRange | null,
    description: string | null,
    connectionId: string,
  ) => {
    usedCorePlaceIds.add(placeId);
    eventTypes.add(eventType);
    const byPerson = contextByPlace.get(placeId) ?? new Map<string, PlacePersonContext>();
    const current = byPerson.get(personId) ?? { personId, roles: [], eventTypes: [], dossierIds: [], connections: [] };
    current.roles = [...new Set([...current.roles, role])];
    current.eventTypes = [...new Set([...current.eventTypes, eventType])];
    current.dossierIds = [...new Set([...current.dossierIds, dossierId])];
    if (!current.connections.some((connection) => connection.id === connectionId)) {
      current.connections.push({ id: connectionId, roles: [role], eventTypes: [eventType], date, description, sourceLabel });
    }
    byPerson.set(personId, current);
    contextByPlace.set(placeId, byPerson);
  };

  const addUnresolved = (id: string, value: unknown, role: string, personId: string, dossierId: string) => {
    const raw = clean(value);
    if (!raw || unresolvedMentions.some((mention) => mention.id === id)) return;
    unresolvedMentions.push({ id, valueRaw: raw, role, personIds: [personId], dossierId });
  };

  const addTimeline = (personId: string, item: MapPersonStory["timeline"][number]) => {
    stories.get(personId)?.timeline.push(item);
  };

  const addRoute = (
    personId: string,
    personName: string,
    dossierId: string,
    origin: Place,
    destination: Place,
    date: DateRange | null,
    sequence: number,
    routeStatus: MapRouteDatum["routeStatus"],
    notes: string | null,
    routeEventTypes: string[] = ["deportation"],
  ) => {
    if (!origin.coordinates || !destination.coordinates) return;
    const routeId = `eugenia-presentation-${dossierId}-${sequence}`;
    routes.push({
      id: routeId,
      personId,
      personName,
      dossierId,
      originId: origin.placeId,
      originName: presentationPlaceLabel(origin),
      destinationId: destination.placeId,
      destinationName: presentationPlaceLabel(destination),
      coordinates: [[origin.coordinates.longitude, origin.coordinates.latitude], [destination.coordinates.longitude, destination.coordinates.latitude]],
      routeStatus,
      confidence: "unknown",
      dateStart: date?.start ?? null,
      dateEnd: date?.end ?? null,
      dateRaw: date?.raw ?? null,
      datePrecision: date?.precision ?? null,
      transportRaw: null,
      sequence,
      sourceLabel,
      notes,
      eventTypes: routeEventTypes,
    });
    const eventType = routeEventTypes[0] ?? "deportation";
    addContext(origin.placeId, personId, dossierId, `${eventType} origin`, eventType, date, notes, `${routeId}-origin`);
    addContext(destination.placeId, personId, dossierId, `${eventType} destination`, eventType, date, notes, `${routeId}-destination`);
    for (const routeEventType of routeEventTypes) eventTypes.add(routeEventType);
  };

  for (const row of imported.rows) {
    const rawDossier = tableValue(row, "Dosar") ?? `row-${row._excelRow ?? persons.length + 1}`;
    const dossierId = `EUG-P-${rawDossier}`;
    const headName = tableName(row);
    const personId = `eugenia-presentation-${rawDossier}-head`;
    const birthDate = toDateRange(row["Date of Birth — Eugenia"]);
    const birthRaw = tableValue(row, "Place of birth — Eugenia");
    const birthPlaceId = placeIdForRaw(birthRaw, "settlement");
    const deportedFromRaw = tableValue(row, "Deported from — Eugenia");
    const originRaw = deportedFromRaw ?? birthRaw;
    const originFallback = !deportedFromRaw;
    const intermediateRaw = splitPlaces(row["Intermediary deportation — Eugenia"]);
    const destinationRaw = splitPlaces(row["Deported to Transnistria — Eugenia"]);
    const intermediateDate = toDateRange(row["Date of intermediary deportation — Eugenia"]);
    const destinationDate = toDateRange(row["Date of deportation to Transnistria — Eugenia"]);
    const deportationDetails = tableValue(row, "Deportation details — Eugenia");
    const mentioned = mergeFamilyMentions(row, headName);
    const familyPeople: string[] = [personId];

    const story: MapPersonStory = {
      personId,
      dossierId,
      dossierLabel: `Dossier ${rawDossier}`,
      roles: ["family head / dossier respondent"],
      profile: {
        birthDate,
        sex: personSex(row["Gender — Eugenia"]),
        profession: null,
        studies: null,
        civilStatus: null,
        address: null,
        origin: birthRaw,
        destination: tableValue(row, "Deported to Transnistria — Eugenia"),
        fate: null,
        deathPlace: null,
        deathDate: null,
      },
      timeline: [],
      materials: [{ id: `${personId}-source`, label: `Dossier ${rawDossier}`, sourceLabel, pageCount: null }],
      testimony: rowNarrative(row),
      sourceLabel,
    };
    persons.push({ id: personId, label: headName, dossierId, roles: story.roles, story });
    stories.set(personId, story);
    dossiers.push({ id: dossierId, label: `Dossier ${rawDossier}` });

    if (birthPlaceId) {
      const place = basePlaces.get(birthPlaceId);
      if (place) {
        addContext(birthPlaceId, personId, dossierId, "birth place", "birth", birthDate, null, `${personId}-birth`);
        addTimeline(personId, { id: `${personId}-birth`, placeId: birthPlaceId, placeName: place.displayNames.en, placeNameRo: place.displayNames.ro, date: birthDate, label: "Birth / origin", description: null, sourceLabel });
      }
    } else if (birthRaw) {
      addUnresolved(`${personId}-birth-place`, birthRaw, "birth place (raw)", personId, dossierId);
    }

    const stops: RouteStop[] = [];
    const originPlaceId = placeIdForRaw(originRaw, "settlement");
    stops.push({ raw: originRaw ?? "Unresolved origin", placeId: originPlaceId, date: null, kind: "origin" });
    for (const raw of intermediateRaw) stops.push({ raw, placeId: placeIdForRaw(raw), date: intermediateDate, kind: "intermediary" });
    for (const raw of destinationRaw) stops.push({ raw, placeId: placeIdForRaw(raw), date: destinationDate, kind: "destination" });

    if (!originPlaceId && originRaw) addUnresolved(`${personId}-deportation-origin`, originRaw, "deportation origin (raw)", personId, dossierId);
    for (const [index, stop] of stops.slice(1).entries()) {
      const place = stop.placeId ? basePlaces.get(stop.placeId) : null;
      const label = stop.kind === "intermediary" ? "Intermediary deportation" : "Deportation destination";
      const stopDate = index === 0 ? destinationDate ?? stop.date : stop.date;
      if (place) {
        addContext(place.placeId, personId, dossierId, label.toLocaleLowerCase("en"), "deportation", stopDate, deportationDetails, `${personId}-stop-${index + 1}`);
      } else {
        addUnresolved(`${personId}-route-stop-${index + 1}`, stop.raw, `${label.toLocaleLowerCase("en")} (raw)`, personId, dossierId);
      }
      addTimeline(personId, {
        id: `${personId}-route-stop-${index + 1}`,
        placeId: stop.placeId,
        placeName: place?.displayNames.en ?? stop.raw,
        placeNameRo: place?.displayNames.ro ?? stop.raw,
        date: stopDate,
        label,
        description: deportationDetails,
        sourceLabel,
      });
    }

    let routeSequence = 0;
    let lastResolvedPlace = originPlaceId ? basePlaces.get(originPlaceId) ?? null : null;
    let unresolvedGap = !lastResolvedPlace;
    for (let index = 1; index < stops.length; index += 1) {
      const current = stops[index];
      const currentPlace = current.placeId ? basePlaces.get(current.placeId) : null;
      if (!currentPlace?.coordinates) {
        unresolvedGap = true;
        continue;
      }
      if (!lastResolvedPlace?.coordinates) {
        lastResolvedPlace = currentPlace;
        unresolvedGap = false;
        continue;
      }
      const routeDate = routeSequence === 0 ? destinationDate ?? current.date : current.date;
      routeSequence += 1;
      addRoute(
        personId,
        headName,
        dossierId,
        lastResolvedPlace,
        currentPlace,
        routeDate,
        routeSequence,
        originFallback || unresolvedGap ? "partial" : "explicit",
        deportationDetails,
      );
      lastResolvedPlace = currentPlace;
      unresolvedGap = false;
    }

    const dorohoi = basePlaces.get("PL-CORE-DOROHOI") ?? null;
    const presentationReturnNote = "Presentation endpoint: Dorohoi. The source table does not supply a return date or a separate return record.";
    if (dorohoi && lastResolvedPlace) {
      if (lastResolvedPlace.placeId !== dorohoi.placeId) {
        routeSequence += 1;
        addRoute(
          personId,
          headName,
          dossierId,
          lastResolvedPlace,
          dorohoi,
          null,
          routeSequence,
          "inferred",
          presentationReturnNote,
          ["return"],
        );
      } else {
        addContext(dorohoi.placeId, personId, dossierId, "return destination", "return", null, presentationReturnNote, `${personId}-return-endpoint`);
      }
      addTimeline(personId, {
        id: `${personId}-return-dorohoi`,
        placeId: dorohoi.placeId,
        placeName: dorohoi.displayNames.en,
        placeNameRo: dorohoi.displayNames.ro,
        date: null,
        label: "Return / repatriation endpoint",
        description: presentationReturnNote,
        sourceLabel,
      });
    }

    for (const [index, member] of mentioned.entries()) {
      const memberId = `${personId}-mentioned-${index + 1}`;
      const memberDate = member.birthYear ? yearDate(member.birthYear, member.birthYear) : null;
      const memberStory: MapPersonStory = {
        personId: memberId,
        dossierId,
        dossierLabel: `Dossier ${rawDossier}`,
        roles: [member.role === "referenced family head" ? member.role : "family member mentioned"],
        profile: {
          birthDate: memberDate,
          sex: null,
          profession: null,
          studies: null,
          civilStatus: null,
          address: null,
          origin: null,
          destination: null,
          fate: null,
          deathPlace: null,
          deathDate: null,
        },
        timeline: [],
        materials: [{ id: `${memberId}-source`, label: `Dossier ${rawDossier}`, sourceLabel, pageCount: null }],
        testimony: `Mentioned in the Family members field (${member.source}).`,
        sourceLabel,
      };
      persons.push({ id: memberId, label: member.name, dossierId, roles: memberStory.roles, story: memberStory });
      stories.set(memberId, memberStory);
      familyPeople.push(memberId);
    }

    groups.push({ id: dossierId, label: headName, personIds: familyPeople, kind: "family" });
  }

  const places: MapPlaceDatum[] = [];
  for (const placeId of usedCorePlaceIds) {
    const place = basePlaces.get(placeId);
    if (!place) continue;
    const contexts = [...(contextByPlace.get(placeId)?.values() ?? [])];
    const roles = [...new Set(contexts.flatMap((context) => context.roles))];
    const placeEventTypes = [...new Set(contexts.flatMap((context) => context.eventTypes))];
    places.push({
      id: place.placeId,
      label: presentationPlaceLabel(place),
      labelRo: presentationPlaceLabel(place, "ro"),
      coordinates: place.coordinates,
      placeType: place.placeType,
      layer: place.layer,
      confidence: place.confidence,
      resolutionStatus: place.resolutionStatus,
      personIds: contexts.map((context) => context.personId),
      eventTypes: placeEventTypes,
      years: [...new Set(contexts.flatMap((context) => context.connections.map((connection) => connection.date?.start?.slice(0, 4)).filter(Boolean).map(Number)))],
      dossierIds: [...new Set(contexts.flatMap((context) => context.dossierIds))],
      roles,
      categories: categoriesForContext(roles, placeEventTypes),
      personContexts: contexts,
      sourceLabel,
    });
  }

  const ehriPlaces = allPlaces.filter((place) => place.layer === "ehri_local" && place.coordinates).map((place): MapPlaceDatum => ({
    id: place.placeId,
    label: presentationPlaceLabel(place),
    labelRo: presentationPlaceLabel(place, "ro"),
    coordinates: place.coordinates,
    placeType: place.placeType,
    layer: place.layer,
    confidence: place.confidence,
    resolutionStatus: place.resolutionStatus,
    personIds: [],
    eventTypes: [],
    years: [],
    dossierIds: [],
    roles: [],
    categories: [],
    personContexts: [],
    sourceLabel: place.sourceRefs[0]?.sourceFile ?? "Supplied local EHRI extract",
  }));

  return {
    places: [...places, ...ehriPlaces],
    routes,
    persons: persons
      .map((person) => ({ ...person, story: stories.get(person.id) }))
      .sort((left, right) => left.label.localeCompare(right.label, "ro")),
    groups: groups.slice().sort((left, right) => left.label.localeCompare(right.label, "ro")),
    dossiers,
    eventTypes: [...eventTypes].sort(),
    unresolvedMentions,
  };
})();

export function getEugeniaPresentationMapViewModel(): MapViewModel {
  return mapData;
}
