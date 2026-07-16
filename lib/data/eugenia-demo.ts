import eugeniaExport from "@/data/demo/eugenia-map-demo.json";
import normalizedPlaces from "@/data/normalized/places.json";
import type { DateRange, Place } from "@/lib/domain/schemas";
import { ehriMapLabel } from "@/lib/data/ehri-labels";
import type {
  MapPlaceDatum,
  MapPlacePersonConnection,
  MapPersonStory,
  MapRouteDatum,
  MapViewModel,
} from "@/lib/data/selectors";

type EugeniaPersonRow = {
  dosar: string;
  nume: string;
  rol: string;
  sex: string;
  an_nastere?: string;
  rudenie?: string;
  profesie?: string;
};

type EugeniaVictimRow = {
  dosar: string;
  nume: string;
  sex: string;
  rudenie?: string;
  cauza?: string;
  loc_si_data?: string;
};

type EugeniaDossier = {
  dosar: string;
  tip: string;
  nume: string;
  prenume: string;
  sex: string;
  an_nastere?: string;
  loc_nastere?: string;
  stare_civila?: string;
  profesie?: string;
  deportat_cand?: string;
  deportat_din?: string;
  deportat_la?: string;
  munca_fortata?: string;
  nr_victime?: number;
  semnatura?: string;
  data_declaratiei?: string;
  pagini_procesate?: number;
  nume_la_eugenia?: string;
  persoane: EugeniaPersonRow[];
  victime: EugeniaVictimRow[];
  eugenia: Record<string, string | null | undefined>;
};

type EugeniaTableRow = Record<string, string | number | null> & {
  dosar?: string;
  _excelRow?: number;
};

type EugeniaExport = {
  metadata: {
    sourceFiles: Array<{ fileName: string; format: string; sha256: string }>;
  };
  dossiers: EugeniaDossier[];
  eugeniaRows: EugeniaTableRow[];
};

const imported = eugeniaExport as unknown as EugeniaExport;

export const EUGENIA_DEMO_SOURCE = {
  key: "eugenia",
  label: "Eugenia export · verified dossier data",
  description:
    "52 Eugenia table rows · 16 transcript/scan-checked dossiers · 65 named people · 27 victims · explicit routes only",
  sourceFile: "Export_Dosare_Eugenia.xlsx + Export_Dosare_Eugenia.json",
} as const;

const sourceLabel = "Export_Dosare_Eugenia.json / Export_Dosare_Eugenia.xlsx";
const basePlaces = new Map((normalizedPlaces as Place[]).map((place) => [place.placeId, place]));
const dorohoi = basePlaces.get("PL-CORE-DOROHOI");
const mohyliv = basePlaces.get("PL-CORE-MOHYLIV-PODILSKYI");

if (!dorohoi || !mohyliv) {
  throw new Error("The Eugenia demo requires the curated Dorohoi and Mohyliv places.");
}

const romanianMonths: Record<string, number> = {
  ianuarie: 1,
  februarie: 2,
  martie: 3,
  aprilie: 4,
  mai: 5,
  iunie: 6,
  iulie: 7,
  august: 8,
  septembrie: 9,
  septembri: 9,
  octombrie: 10,
  noiembrie: 11,
  noembrie: 11,
  decembrie: 12,
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function yearDate(year: string, raw: string): DateRange {
  return {
    raw,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    precision: "year",
  };
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

  const english = raw.match(/\b(\w+)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  const romanian = raw.match(/\b(\d{1,2})\s+([A-Za-zăâîșţțĂÂÎȘŢȚ]+)\s+(\d{4})\b/i);
  const yearMonth = raw.match(/\b(\w+)\s+(\d{4})\b/i);
  const monthName = english?.[1] ?? romanian?.[2] ?? yearMonth?.[1];
  const year = english?.[3] ?? romanian?.[3] ?? yearMonth?.[2];
  const month = monthName
    ? romanianMonths[monthName.toLocaleLowerCase("ro")]
      ?? {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      }[monthName.toLocaleLowerCase("en")]
    : undefined;
  if (month && year) {
    const day = english?.[2] ?? romanian?.[1];
    if (day) {
      const date = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
      return { raw, start: date, end: date, precision: "day" };
    }
    return {
      raw,
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: null,
      precision: "month",
    };
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

function placeIdForRaw(value: unknown): string | null {
  const text = clean(value)?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro");
  if (!text) return null;
  // Keep compound or administrative descriptions unresolved. For example,
  // "Sargorod Jud. Moghilău" is not the same place as Mohyliv-Podilskyi and
  // "Zvorastea, Dorohoi" should not be silently reduced to Dorohoi.
  if (/sargorod|zvorastea|yvorastea|mileanca/.test(text)) return null;
  if (/doroho/.test(text) && !/[;,]/.test(text)) return dorohoi?.placeId ?? null;
  if (/moghil|mogilev/.test(text) && !/[;,]/.test(text)) return mohyliv?.placeId ?? null;
  return null;
}

function routeDate(dossier: EugeniaDossier): DateRange | null {
  return toDateRange(
    dossier.eugenia["Date of deportation to Transnistria"]
      ?? dossier.deportat_cand,
  );
}

function tableName(row: EugeniaTableRow): string {
  const familyName = clean(row.Name) ?? "Unnamed person";
  const givenName = clean(row.Surname);
  return givenName ? `${familyName} ${givenName}` : familyName;
}

function tableNarrative(row: EugeniaTableRow): string | null {
  const fields = [
    ["Deportation details", row["Deportation details"]],
    ["Forced labor", row["Forced labor"]],
    ["Other sufferings", row["Other sufferings"]],
    ["Family members", row[" Family members"]],
    ["Family members who died", row["Family members who died"]],
  ] as const;
  const text = fields
    .map(([label, value]) => {
      const cleaned = clean(value);
      return cleaned ? `${label}: ${cleaned}` : null;
    })
    .filter((value): value is string => Boolean(value));
  return text.length ? text.join("\n") : null;
}

function categoriesForContext(roles: string[], eventTypes: string[]): MapPlaceDatum["categories"] {
  const text = `${roles.join(" ")} ${eventTypes.join(" ")}`.toLocaleLowerCase("ro");
  const categories: MapPlaceDatum["categories"] = [];
  if (/birth|naștere|nastere|origin/.test(text)) categories.push("origin");
  if (/deport|evacuat|evacuation/.test(text)) categories.push("evacuation_deportation");
  if (/forced|muncă|munca/.test(text)) categories.push("forced_labour");
  if (/death|deces|mort|loss/.test(text)) categories.push("death");
  if (/return|repatri/.test(text)) categories.push("return");
  return categories;
}

const mapData: MapViewModel = (() => {
  const persons: MapViewModel["persons"] = [];
  const groups: MapViewModel["groups"] = [];
  const dossiers: MapViewModel["dossiers"] = [];
  const routes: MapRouteDatum[] = [];
  const stories = new Map<string, MapPersonStory>();
  const contextByPlace = new Map<string, Map<string, {
    personId: string;
    roles: string[];
    eventTypes: string[];
    dossierIds: string[];
    connections: MapPlacePersonConnection[];
  }>>();
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
    connectionId?: string,
  ) => {
    usedCorePlaceIds.add(placeId);
    eventTypes.add(eventType);
    const byPerson = contextByPlace.get(placeId) ?? new Map();
    const current = byPerson.get(personId) ?? {
      personId,
      roles: [],
      eventTypes: [],
      dossierIds: [],
      connections: [],
    };
    current.roles = [...new Set([...current.roles, role])];
    current.eventTypes = [...new Set([...current.eventTypes, eventType])];
    current.dossierIds = [...new Set([...current.dossierIds, dossierId])];
    current.connections.push({
      id: connectionId ?? `eugenia-context-${placeId}-${personId}-${current.connections.length}`,
      roles: [role],
      eventTypes: [eventType],
      date,
      description,
      sourceLabel,
    });
    byPerson.set(personId, current);
    contextByPlace.set(placeId, byPerson);
  };

  const addUnresolved = (id: string, value: unknown, role: string, personId: string, dossierId: string) => {
    const raw = clean(value);
    if (!raw) return;
    unresolvedMentions.push({ id, valueRaw: raw, role, personIds: [personId], dossierId });
  };

  const addPerson = (person: MapViewModel["persons"][number], story: MapPersonStory) => {
    persons.push(person);
    stories.set(person.id, story);
  };

  const addTimeline = (personId: string, item: MapPersonStory["timeline"][number]) => {
    const story = stories.get(personId);
    if (!story) return;
    story.timeline.push(item);
  };

  const addRoute = (
    personId: string,
    personName: string,
    dossierId: string,
    originId: string,
    destinationId: string,
    date: DateRange | null,
    notes: string | null,
    routeId: string,
  ) => {
    const origin = basePlaces.get(originId);
    const destination = basePlaces.get(destinationId);
    if (!origin?.coordinates || !destination?.coordinates) return;
    const route: MapRouteDatum = {
      id: routeId,
      personId,
      personName,
      dossierId,
      originId,
      originName: origin.displayNames.en,
      destinationId,
      destinationName: destination.displayNames.en,
      coordinates: [
        [origin.coordinates.longitude, origin.coordinates.latitude],
        [destination.coordinates.longitude, destination.coordinates.latitude],
      ],
      routeStatus: "explicit",
      confidence: "medium",
      dateStart: date?.start ?? null,
      dateEnd: date?.end ?? null,
      dateRaw: date?.raw ?? null,
      datePrecision: date?.precision ?? null,
      transportRaw: null,
      sequence: 1,
      sourceLabel,
      notes,
      eventTypes: ["deportation"],
    };
    routes.push(route);
    // Give route endpoint contexts the same stable identity used by the UI's
    // route connection. This prevents one endpoint being rendered once from
    // the place context and once again from the route layer.
    addContext(originId, personId, dossierId, "deportation origin", "deportation", date, notes, `route-${routeId}`);
    addContext(destinationId, personId, dossierId, "deportation destination", "deportation", date, notes, `route-${routeId}`);
    eventTypes.add("deportation");
    addTimeline(personId, {
      id: `${routeId}-timeline`,
      placeId: destinationId,
      placeName: destination.displayNames.en,
      placeNameRo: destination.displayNames.ro,
      date,
      label: "Documented deportation",
      description: notes,
      sourceLabel,
    });
  };

  const createStory = (
    personId: string,
    dossierId: string,
    label: string,
    roles: string[],
    profile: MapPersonStory["profile"],
    testimony: string | null,
    pageCount: number | null,
  ): MapPersonStory => ({
    personId,
    dossierId,
    dossierLabel: dossierId ? `Dossier ${dossierId.replace(/^EUG-(?:D|T)-/, "")}` : null,
    roles,
    profile,
    timeline: [],
    materials: [{ id: `${personId}-source`, label, sourceLabel, pageCount }],
    testimony,
    sourceLabel,
  });

  for (const dossier of imported.dossiers) {
    const dossierId = `EUG-D-${dossier.dosar}`;
    dossiers.push({ id: dossierId, label: `Dossier ${dossier.dosar}` });
    const idsByRawName = new Map<string, string>();
    const groupPersonIds: string[] = [];
    const headSource = dossier.persoane.find((person) => person.rol === "declarant") ?? dossier.persoane[0];
    let headId = "";

    const addVerifiedPerson = (
      row: EugeniaPersonRow | EugeniaVictimRow,
      index: number,
      isVictim: boolean,
    ) => {
      const personRow = isVictim ? null : row as EugeniaPersonRow;
      const victimRow = isVictim ? row as EugeniaVictimRow : null;
      const rawName = clean(row.nume) ?? `Unnamed person ${index + 1}`;
      const identityKey = rawName.toLocaleLowerCase("ro");
      const existingId = idsByRawName.get(identityKey);
      if (existingId) {
        const existing = persons.find((person) => person.id === existingId);
        if (existing) {
          existing.roles = [...new Set([...existing.roles, isVictim ? "victim mentioned" : personRow?.rol ?? "family member"])];
        }
        return existingId;
      }
      const personId = `eugenia-dossier-${dossier.dosar}-person-${index + 1}`;
      const role = isVictim
        ? "victim mentioned"
        : personRow?.rol === "declarant"
          ? "family head / declarant"
          : personRow?.rol === "cap de familie (dosar B)"
            ? "mentioned family head"
            : "family member";
      const date = isVictim ? toDateRange(victimRow?.loc_si_data) : toDateRange(personRow?.an_nastere);
      const deathDate = isVictim ? toDateRange(victimRow?.loc_si_data) : null;
      const placeValue = isVictim ? victimRow?.loc_si_data : row === headSource ? dossier.loc_nastere : null;
      const placeId = placeIdForRaw(placeValue);
      const story = createStory(
        personId,
        dossierId,
        `${rawName} · dossier ${dossier.dosar}`,
        [role],
        {
          birthDate: isVictim ? null : date,
          sex: personSex(row.sex ?? dossier.sex),
          profession: isVictim ? null : clean(personRow?.profesie ?? dossier.profesie),
          studies: clean(dossier.eugenia["Educational level"]),
          civilStatus: isVictim ? null : clean(dossier.stare_civila),
          address: row === headSource ? clean(dossier.eugenia["Address in 1945, after repatriation (in Dorohoi)"]) : null,
          origin: placeId === dorohoi?.placeId && !isVictim ? dorohoi?.displayNames.en ?? null : clean(placeValue),
          destination: isVictim ? null : clean(dossier.deportat_la ?? dossier.eugenia["Deported to Transnistria"]),
          fate: isVictim ? clean(victimRow?.cauza) : null,
          deathPlace: isVictim ? clean(victimRow?.loc_si_data) : null,
          deathDate,
        },
        isVictim
          ? [clean(victimRow?.cauza), clean(victimRow?.loc_si_data)].filter((value): value is string => Boolean(value)).join(" · ") || null
          : [clean(personRow?.rudenie), clean(dossier.eugenia["Deportation details"]), clean(dossier.eugenia["Forced labor"]), clean(dossier.eugenia["Other sufferings"]), clean(dossier.eugenia["Family members who died"])].filter((value): value is string => Boolean(value)).join("\n") || null,
        dossier.pagini_procesate ?? null,
      );
      addPerson({ id: personId, label: rawName, dossierId, roles: [role], story }, story);
      idsByRawName.set(identityKey, personId);
      groupPersonIds.push(personId);
      if (!isVictim && row === headSource) headId = personId;
      if (placeId) {
        addContext(placeId, personId, dossierId, isVictim ? "death place" : "birth place", isVictim ? "death" : "birth", isVictim ? deathDate : date, isVictim ? clean(victimRow?.cauza) : null);
        addTimeline(personId, {
          id: `${personId}-${isVictim ? "death" : "birth"}`,
          placeId,
          placeName: basePlaces.get(placeId)?.displayNames.en ?? null,
          placeNameRo: basePlaces.get(placeId)?.displayNames.ro ?? null,
          date: isVictim ? deathDate : date,
          label: isVictim ? "Death / loss" : "Birth / origin",
          description: isVictim ? clean(victimRow?.cauza) : null,
          sourceLabel,
        });
      } else if (placeValue) {
        addUnresolved(`${personId}-place`, placeValue, isVictim ? "death place (raw)" : "birth place (raw)", personId, dossierId);
      }
      return personId;
    };

    dossier.persoane.forEach((person, index) => addVerifiedPerson(person, index, false));
    dossier.victime.forEach((victim, index) => addVerifiedPerson(victim, dossier.persoane.length + index, true));
    const originId = placeIdForRaw(dossier.deportat_din);
    const destinationId = placeIdForRaw(dossier.deportat_la);
    const familyOnlyDeportation = /soția|copiii|wife|children/i.test(dossier.deportat_cand ?? "");
    const canDrawRoute = Boolean(headId && originId && destinationId && !familyOnlyDeportation);
    if (!canDrawRoute && originId && headId && !familyOnlyDeportation) addContext(originId, headId, dossierId, "deportation origin", "deportation", routeDate(dossier), dossier.deportat_cand ?? null);
    else if (!originId && dossier.deportat_din && headId) addUnresolved(`${dossierId}-deportation-origin`, dossier.deportat_din, "deportation origin (raw)", headId, dossierId);
    if (!canDrawRoute && destinationId && headId && !familyOnlyDeportation) addContext(destinationId, headId, dossierId, "deportation destination", "deportation", routeDate(dossier), dossier.deportat_cand ?? null);
    else if (!destinationId && dossier.deportat_la && headId) addUnresolved(`${dossierId}-deportation-destination`, dossier.deportat_la, "deportation destination (raw)", headId, dossierId);
    if (dossier.munca_fortata && headId) addUnresolved(`${dossierId}-forced-labour`, dossier.munca_fortata, "forced labour locations (raw)", headId, dossierId);

    if (canDrawRoute && headId && originId && destinationId) {
      addRoute(headId, dossier.nume + " " + dossier.prenume, dossierId, originId, destinationId, routeDate(dossier), dossier.deportat_cand ?? null, `${dossierId}-deportation`);
    }
    const forcedLabor = clean(dossier.eugenia["Forced labor"]);
    if (headId && forcedLabor) {
      addTimeline(headId, {
        id: `${dossierId}-forced-labour`,
        placeId: null,
        placeName: null,
        placeNameRo: null,
        date: toDateRange(forcedLabor),
        label: "Forced labour",
        description: forcedLabor,
        sourceLabel,
      });
      eventTypes.add("forced_labour");
    }
    groups.push({ id: dossierId, label: `${dossier.nume} ${dossier.prenume}`, personIds: [...new Set(groupPersonIds)], kind: "family" });
  }

  for (const [index, row] of imported.eugeniaRows.entries()) {
    const rawDossierId = clean(row.dosar) ?? `row-${index + 1}`;
    const dossierId = `EUG-T-${rawDossierId}`;
    const personId = `eugenia-table-${rawDossierId}`;
    const name = tableName(row);
    dossiers.push({ id: dossierId, label: `Eugenia table row · ${rawDossierId}` });
    const birthDate = toDateRange(row["Date of Birth"]);
    const originRaw = row["Place of birth"];
    const originId = placeIdForRaw(originRaw);
    const deportationOriginId = placeIdForRaw(row["Deported from"]);
    const destinationId = placeIdForRaw(row["Deported to Transnistria"]);
    const story = createStory(
      personId,
      dossierId,
      `${name} · Eugenia table row ${rawDossierId}`,
      ["Eugenia table person"],
      {
        birthDate,
        sex: personSex(row.Gender),
        profession: clean(row["Profession (before deportation)"]),
        studies: clean(row["Educational level"]),
        civilStatus: null,
        address: clean(row["Address in 1945, after repatriation (in Dorohoi)"]),
        origin: clean(originRaw),
        destination: clean(row["Deported to Transnistria"]),
        fate: null,
        deathPlace: null,
        deathDate: null,
      },
      tableNarrative(row),
      null,
    );
    addPerson({ id: personId, label: name, dossierId, roles: ["Eugenia table person"], story }, story);
    groups.push({ id: dossierId, label: name, personIds: [personId], kind: "family" });
    if (originId) addContext(originId, personId, dossierId, "birth place", "birth", birthDate, null);
    else if (originRaw) addUnresolved(`${personId}-birth-place`, originRaw, "birth place (raw)", personId, dossierId);
    const tableRouteDate = toDateRange(row["Date of deportation to Transnistria"]);
    if (deportationOriginId && destinationId) {
      addRoute(personId, name, dossierId, deportationOriginId, destinationId, tableRouteDate, clean(row["Deportation details"]), `${dossierId}-deportation`);
    } else {
      if (deportationOriginId) addContext(deportationOriginId, personId, dossierId, "deportation origin", "deportation", tableRouteDate, clean(row["Deportation details"]));
      else if (row["Deported from"]) addUnresolved(`${personId}-deportation-origin`, row["Deported from"], "deportation origin (raw)", personId, dossierId);
      if (destinationId) addContext(destinationId, personId, dossierId, "deportation destination", "deportation", tableRouteDate, clean(row["Deportation details"]));
      else if (row["Deported to Transnistria"]) addUnresolved(`${personId}-deportation-destination`, row["Deported to Transnistria"], "deportation destination (raw)", personId, dossierId);
    }
    if (row["Forced labor"]) addUnresolved(`${personId}-forced-labour`, row["Forced labor"], "forced labour locations (raw)", personId, dossierId);
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
      label: ehriMapLabel(place),
      labelRo: ehriMapLabel(place, "ro"),
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

  const ehriPlaces = (normalizedPlaces as Place[])
    .filter((place) => place.layer === "ehri_local" && place.coordinates)
    .map((place): MapPlaceDatum => ({
      id: place.placeId,
      label: ehriMapLabel(place),
      labelRo: ehriMapLabel(place, "ro"),
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
    persons: persons.map((person) => ({ ...person, story: stories.get(person.id) })),
    groups,
    dossiers,
    eventTypes: [...eventTypes].sort(),
    unresolvedMentions,
  };
})();

export function getEugeniaDemoMapViewModel(): MapViewModel {
  return mapData;
}
