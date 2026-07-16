import type {
  Document,
  Event,
  Household,
  NormalizedBundle,
  Person,
  PersonNameVariant,
  Place,
  PlaceMention,
  Relationship,
  ReviewTask,
  RouteSegment,
  DateRange,
} from "@/lib/domain/schemas";
import { getResearchData } from "./repository";
import { ehriMapLabel } from "./ehri-labels";

function byDate(left: Event, right: Event): number {
  const leftDate = left.date.start ?? "9999-99-99";
  const rightDate = right.date.start ?? "9999-99-99";
  return leftDate < rightDate ? -1 : leftDate > rightDate ? 1 : left.eventId.localeCompare(right.eventId);
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function tasksTouching(task: ReviewTask, ids: Set<string>): boolean {
  return task.entityRefs.some((reference) => ids.has(reference.entityId));
}

export interface OverviewStats {
  persons: number;
  documents: number;
  events: number;
  places: number;
  corePlaces: number;
  ehriPlaces: number;
  routes: number;
  openReviewTasks: number;
  unresolvedPlaces: number;
}

export function getOverviewStats(data = getResearchData()): OverviewStats {
  return {
    persons: data.persons.length,
    documents: data.documents.length,
    events: data.events.length,
    places: data.places.length,
    corePlaces: data.places.filter((place) => place.layer !== "ehri_local").length,
    ehriPlaces: data.places.filter((place) => place.layer === "ehri_local").length,
    routes: data.routeSegments.length,
    openReviewTasks: data.reviewTasks.filter((task) => task.status === "open").length,
    unresolvedPlaces: data.places.filter((place) => place.resolutionStatus === "unresolved").length,
  };
}

export interface RelatedPerson {
  relationship: Relationship;
  person: Person;
  role: string | null;
}

export interface PersonDetail {
  person: Person;
  nameVariants: PersonNameVariant[];
  households: Household[];
  relationships: RelatedPerson[];
  documents: Document[];
  events: Event[];
  mentions: PlaceMention[];
  places: Place[];
  routes: RouteSegment[];
  reviewTasks: ReviewTask[];
}

export function getPersonDetail(personId: string, data = getResearchData()): PersonDetail | null {
  const person = data.persons.find((item) => item.personId === personId);
  if (!person) return null;
  const nameVariants = data.personNameVariants.filter((variant) => variant.personId === personId);
  const households = data.households.filter((household) => household.memberPersonIds.includes(personId));
  const relationshipRecords = data.relationships.filter(
    (relationship) => relationship.person1Id === personId || relationship.person2Id === personId,
  );
  const relationships = relationshipRecords.flatMap((relationship) => {
    const otherId = relationship.person1Id === personId ? relationship.person2Id : relationship.person1Id;
    const related = data.persons.find((item) => item.personId === otherId);
    if (!related) return [];
    return [
      {
        relationship,
        person: related,
        role:
          relationship.person1Id === otherId
            ? relationship.person1Role
            : relationship.person2Role,
      },
    ];
  });
  const events = data.events.filter((event) => event.participantIds.includes(personId)).sort(byDate);
  const eventIds = new Set(events.map((event) => event.eventId));
  const mentions = data.placeMentions.filter(
    (mention) =>
      mention.personIds.includes(personId) ||
      (mention.ownerType === "event" && eventIds.has(mention.ownerId)) ||
      (mention.ownerType === "person" && mention.ownerId === personId),
  );
  const placeIds = new Set(mentions.map((mention) => mention.placeId).filter(Boolean));
  const places = data.places.filter((place) => placeIds.has(place.placeId));
  const routes = data.routeSegments
    .filter((route) => route.personId === personId)
    .sort((left, right) => left.sequence - right.sequence);
  const documents = data.documents.filter((document) => person.documentIds.includes(document.documentId));
  const linkedIds = new Set([
    personId,
    ...events.map((event) => event.eventId),
    ...mentions.map((mention) => mention.placeMentionId),
    ...routes.map((route) => route.routeSegmentId),
    ...relationshipRecords.map((relationship) => relationship.relationshipId),
    ...places.map((place) => place.placeId),
  ]);
  const reviewTasks = data.reviewTasks.filter((task) => tasksTouching(task, linkedIds));

  return {
    person,
    nameVariants,
    households,
    relationships,
    documents,
    events,
    mentions,
    places,
    routes,
    reviewTasks,
  };
}

export interface PlaceDetail {
  place: Place;
  mentions: PlaceMention[];
  persons: Person[];
  events: Event[];
  documents: Document[];
  incomingRoutes: RouteSegment[];
  outgoingRoutes: RouteSegment[];
  reviewTasks: ReviewTask[];
}

export function getPlaceDetail(placeId: string, data = getResearchData()): PlaceDetail | null {
  const place = data.places.find((item) => item.placeId === placeId);
  if (!place) return null;
  const mentions = data.placeMentions.filter((mention) => mention.placeId === placeId);
  const personIds = new Set(mentions.flatMap((mention) => mention.personIds));
  const eventIds = new Set(
    mentions.filter((mention) => mention.ownerType === "event").map((mention) => mention.ownerId),
  );
  const documentIds = new Set(mentions.flatMap((mention) => mention.documentIds));
  const incomingRoutes = data.routeSegments.filter((route) => route.destinationPlaceId === placeId);
  const outgoingRoutes = data.routeSegments.filter((route) => route.originPlaceId === placeId);
  const routeIds = [...incomingRoutes, ...outgoingRoutes].map((route) => route.routeSegmentId);
  const linkedIds = new Set([placeId, ...mentions.map((mention) => mention.placeMentionId), ...routeIds]);

  return {
    place,
    mentions,
    persons: data.persons.filter((person) => personIds.has(person.personId)),
    events: data.events.filter((event) => eventIds.has(event.eventId)).sort(byDate),
    documents: data.documents.filter((document) => documentIds.has(document.documentId)),
    incomingRoutes,
    outgoingRoutes,
    reviewTasks: data.reviewTasks.filter((task) => tasksTouching(task, linkedIds)),
  };
}

export interface DocumentDetail {
  document: Document;
  persons: Person[];
  events: Event[];
  mentions: PlaceMention[];
  places: Place[];
  reviewTasks: ReviewTask[];
}

export function getDocumentDetail(
  documentId: string,
  data = getResearchData(),
): DocumentDetail | null {
  const document = data.documents.find((item) => item.documentId === documentId);
  if (!document) return null;
  const events = data.events.filter((event) => event.documentIds.includes(documentId)).sort(byDate);
  const mentions = data.placeMentions.filter((mention) => mention.documentIds.includes(documentId));
  const placeIds = new Set(mentions.map((mention) => mention.placeId).filter(Boolean));
  const linkedIds = new Set([
    documentId,
    ...events.map((event) => event.eventId),
    ...mentions.map((mention) => mention.placeMentionId),
  ]);
  return {
    document,
    persons: data.persons.filter((person) => person.documentIds.includes(documentId)),
    events,
    mentions,
    places: data.places.filter((place) => placeIds.has(place.placeId)),
    reviewTasks: data.reviewTasks.filter(
      (task) => task.dossierId === documentId || tasksTouching(task, linkedIds),
    ),
  };
}

export interface MapPlaceDatum {
  id: string;
  label: string;
  labelRo: string;
  coordinates: { latitude: number; longitude: number } | null;
  placeType: Place["placeType"];
  layer: Place["layer"];
  confidence: Place["confidence"];
  resolutionStatus: Place["resolutionStatus"];
  personIds: string[];
  eventTypes: string[];
  years: number[];
  dossierIds: string[];
  roles: string[];
  categories: Array<"origin" | "evacuation_deportation" | "forced_labour" | "death" | "return">;
  personContexts: MapPlacePersonContext[];
  sourceLabel: string;
}

export interface MapPlacePersonContext {
  personId: string;
  roles: string[];
  eventTypes: string[];
  dossierIds: string[];
  connections: MapPlacePersonConnection[];
}

export interface MapPlacePersonConnection {
  id: string;
  roles: string[];
  eventTypes: string[];
  date: DateRange | null;
  description: string | null;
  sourceLabel: string;
}

export interface MapRouteDatum {
  id: string;
  personId: string;
  personName: string;
  dossierId: string | null;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  coordinates: [[number, number], [number, number]];
  routeStatus: RouteSegment["routeStatus"];
  confidence: RouteSegment["confidence"];
  dateStart: string | null;
  dateEnd: string | null;
  dateRaw: unknown;
  datePrecision: DateRange["precision"] | null;
  transportRaw: string | null;
  sequence: number;
  sourceLabel: string;
  notes: string | null;
  eventTypes: string[];
}

export interface MapGroupDatum {
  id: string;
  label: string;
  personIds: string[];
  kind: "household" | "family";
}

export interface MapPersonStoryProfile {
  birthDate: DateRange | null;
  sex: string | null;
  profession: string | null;
  studies: string | null;
  civilStatus: string | null;
  address: string | null;
  origin: string | null;
  destination: string | null;
  fate: string | null;
  deathPlace: string | null;
  deathDate: DateRange | null;
}

export interface MapPersonStoryTimelineItem {
  id: string;
  placeId: string | null;
  placeName: string | null;
  placeNameRo: string | null;
  date: DateRange | null;
  label: string;
  description: string | null;
  sourceLabel: string;
}

export interface MapPersonStoryMaterial {
  id: string;
  label: string;
  sourceLabel: string;
  pageCount: number | null;
}

export interface MapPersonStory {
  personId: string;
  dossierId: string | null;
  dossierLabel: string | null;
  roles: string[];
  profile: MapPersonStoryProfile;
  timeline: MapPersonStoryTimelineItem[];
  materials: MapPersonStoryMaterial[];
  testimony: string | null;
  sourceLabel: string;
}

export interface MapViewModel {
  places: MapPlaceDatum[];
  routes: MapRouteDatum[];
  persons: Array<{
    id: string;
    label: string;
    dossierId: string | null;
    roles: string[];
    story?: MapPersonStory;
  }>;
  groups: MapGroupDatum[];
  dossiers: Array<{ id: string; label: string }>;
  eventTypes: string[];
  unresolvedMentions: Array<{
    id: string;
    valueRaw: string;
    role: string;
    personIds: string[];
    dossierId: string | null;
  }>;
}

function categoriesForPlace(roles: string[], eventTypes: string[]): MapPlaceDatum["categories"] {
  const categories: MapPlaceDatum["categories"] = [];
  const joinedRoles = roles.join(" ").toLocaleLowerCase("ro");
  const joinedEvents = eventTypes.join(" ");
  if (/naștere|nastere|domiciliu|origin/.test(joinedRoles)) categories.push("origin");
  if (/evac|deport|internare/.test(joinedEvents + joinedRoles)) categories.push("evacuation_deportation");
  if (/munca|muncă|forced/.test(joinedEvents + joinedRoles)) categories.push("forced_labour");
  if (/deces|death|deced/.test(joinedEvents + joinedRoles)) categories.push("death");
  if (/return|repatri|întoarc|intoarc/.test(joinedEvents + joinedRoles)) categories.push("return");
  return categories;
}

function rawString(raw: unknown, keys: string[]): string | null {
  if (!raw || typeof raw !== "object") return null;
  for (const key of keys) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function publicEventLabel(eventType: string): string {
  const value = eventType.toLocaleLowerCase("ro");
  if (/naștere|nastere|birth/.test(value)) return "Birth / origin";
  if (/evacu|deport|intern/.test(value)) return "Evacuation / deportation";
  if (/muncă|munca|forced/.test(value)) return "Forced labour";
  if (/ghetou|ghetto|lagăr|lagar|camp/.test(value)) return "Camp / ghetto";
  if (/deces|death|mort/.test(value)) return "Death / loss";
  if (/întoarc|intoarc|return|repatri/.test(value)) return "Return / repatriation";
  return eventType.replaceAll("_", " ");
}

export function getMapPersonStory(
  personId: string,
  data = getResearchData(),
): MapPersonStory | null {
  const detail = getPersonDetail(personId, data);
  if (!detail) return null;
  const placesById = new Map(detail.places.map((place) => [place.placeId, place]));
  const placeMentionById = new Map(data.placeMentions.map((mention) => [mention.placeMentionId, mention]));
  const birthMention = detail.mentions.find((mention) => mention.placeMentionId === detail.person.birthPlaceMentionId);
  const birthPlace = birthMention?.placeId ? placesById.get(birthMention.placeId) : undefined;
  const eventTimeline = detail.events.flatMap((event): MapPersonStoryTimelineItem[] => {
    const linkedMentions = event.placeMentionIds
      .map((mentionId) => placeMentionById.get(mentionId))
      .filter((mention): mention is PlaceMention => Boolean(mention));
    const linkedPlaces = linkedMentions
      .map((mention) => mention.placeId ? placesById.get(mention.placeId) : undefined)
      .filter((place): place is Place => Boolean(place));
    const places = linkedPlaces.length ? linkedPlaces : [undefined];
    return places.map((place) => ({
      id: `${event.eventId}-${place?.placeId ?? "no-place"}`,
      placeId: place?.placeId ?? null,
      placeName: place?.displayNames.en ?? null,
      placeNameRo: place?.displayNames.ro ?? null,
      date: event.date,
      label: publicEventLabel(event.eventType),
      description: event.descriptionRaw,
      sourceLabel: event.sourceRefs[0]?.sourceFile ?? "Source unavailable",
    }));
  });
  const routeTimeline = detail.routes
    .filter((route) => !eventTimeline.some((item) => item.placeId === route.destinationPlaceId && item.date?.start === route.date.start))
    .map((route): MapPersonStoryTimelineItem => ({
      id: `route-${route.routeSegmentId}`,
      placeId: route.destinationPlaceId,
      placeName: placesById.get(route.destinationPlaceId)?.displayNames.en ?? null,
      placeNameRo: placesById.get(route.destinationPlaceId)?.displayNames.ro ?? null,
      date: route.date,
      label: "Documented movement",
      description: route.notes,
      sourceLabel: route.sourceRefs[0]?.sourceFile ?? "Source unavailable",
    }));
  const timeline = [...eventTimeline, ...routeTimeline].sort((left, right) => {
    const leftDate = left.date?.start ?? "9999-99-99";
    const rightDate = right.date?.start ?? "9999-99-99";
    return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id);
  });
  const deathEvent = detail.events.find((event) => /deces|death|mort/i.test(event.eventType));
  const deathMention = deathEvent?.placeMentionIds
    .map((mentionId) => placeMentionById.get(mentionId))
    .find((mention) => Boolean(mention?.placeId));
  const deathPlace = deathMention?.placeId ? placesById.get(deathMention.placeId) : undefined;
  const raw = detail.person.raw;
  return {
    personId,
    dossierId: detail.person.dossierId,
    dossierLabel: detail.documents[0]?.title ?? detail.person.dossierId,
    roles: detail.person.roles,
    profile: {
      birthDate: detail.person.birthDate,
      sex: rawString(raw, ["sex", "sex_raw"]) ?? detail.person.sex,
      profession: rawString(raw, ["profesie", "profession", "profesie_raw"]),
      studies: rawString(raw, ["studii", "studies"]),
      civilStatus: detail.person.civilStatusRaw,
      address: rawString(raw, ["adresa", "address", "domiciliu_raw"]),
      origin: birthPlace?.displayNames.en ?? rawString(raw, ["origine", "loc_nastere_raw"]),
      destination: rawString(raw, ["destinatie", "destination", "deportation_destination"]),
      fate: rawString(raw, ["soarta", "fate"]),
      deathPlace: deathPlace?.displayNames.en ?? rawString(raw, ["loc_deces", "death_place"]),
      deathDate: deathEvent?.date ?? null,
    },
    timeline,
    materials: detail.documents.map((document) => ({
      id: document.documentId,
      label: document.title,
      sourceLabel: document.sourceRefs[0]?.sourceFile ?? document.fileName,
      pageCount: document.pageCount,
    })),
    testimony: rawString(raw, ["testimony", "marturie", "declaratie", "narativ"]),
    sourceLabel: detail.person.sourceRefs[0]?.sourceFile ?? "Source unavailable",
  };
}

export function getMapViewModel(data: NormalizedBundle = getResearchData()): MapViewModel {
  const eventsById = new Map(data.events.map((event) => [event.eventId, event]));
  const peopleById = new Map(data.persons.map((person) => [person.personId, person]));
  const mentionsByPlace = new Map<string, PlaceMention[]>();
  for (const mention of data.placeMentions) {
    if (!mention.placeId) continue;
    mentionsByPlace.set(mention.placeId, [...(mentionsByPlace.get(mention.placeId) ?? []), mention]);
  }

  const places: MapPlaceDatum[] = data.places.map((place) => {
    const mentions = mentionsByPlace.get(place.placeId) ?? [];
    const contexts = new Map<string, MapPlacePersonContext>();
    for (const mention of mentions) {
      const event = mention.ownerType === "event" ? eventsById.get(mention.ownerId) : undefined;
      const mentionedPersonIds = mention.personIds.length
        ? mention.personIds
        : mention.ownerType === "person"
          ? [mention.ownerId]
          : event?.participantIds ?? [];
      for (const personId of mentionedPersonIds) {
        const current = contexts.get(personId) ?? {
          personId,
          roles: [],
          eventTypes: [],
          dossierIds: [],
          connections: [],
        };
        current.roles = [...new Set([...current.roles, mention.role])];
        if (event) current.eventTypes = [...new Set([...current.eventTypes, event.eventType])];
        current.dossierIds = [...new Set([...current.dossierIds, ...mention.documentIds])];
        const birthDate = peopleById.get(personId)?.birthDate;
        const date = event
          ? event.date
          : mention.ownerType === "person" && birthDate
            ? birthDate
            : null;
        current.connections.push({
          id: mention.placeMentionId,
          roles: [mention.role],
          eventTypes: event ? [event.eventType] : [],
          date,
          description: event?.descriptionRaw ?? null,
          sourceLabel: event?.sourceRefs[0]?.sourceFile ?? mention.sourceRefs[0]?.sourceFile ?? "Source unavailable",
        });
        contexts.set(personId, current);
      }
    }
    const events = mentions.flatMap((mention) => {
      if (mention.ownerType !== "event") return [];
      const event = eventsById.get(mention.ownerId);
      return event ? [event] : [];
    });
    const roles = uniqueById(mentions).map((mention) => mention.role);
    const eventTypes = uniqueById(events).map((event) => event.eventType);
    return {
      id: place.placeId,
      label: ehriMapLabel(place),
      labelRo: ehriMapLabel(place, "ro"),
      coordinates: place.coordinates,
      placeType: place.placeType,
      layer: place.layer,
      confidence: place.confidence,
      resolutionStatus: place.resolutionStatus,
      personIds: [...new Set(mentions.flatMap((mention) => mention.personIds))],
      eventTypes,
      years: [
        ...new Set(
          events
            .map((event) => event.date.start?.slice(0, 4))
            .filter((year): year is string => Boolean(year))
            .map(Number),
        ),
      ],
      dossierIds: [...new Set(mentions.flatMap((mention) => mention.documentIds))],
      roles,
      categories: categoriesForPlace(roles, eventTypes),
      personContexts: [...contexts.values()],
      sourceLabel: place.sourceRefs[0]?.sourceFile ?? "Source unavailable",
    };
  });

  const placesById = new Map(data.places.map((place) => [place.placeId, place]));
  const routes: MapRouteDatum[] = data.routeSegments.flatMap((route) => {
    const origin = placesById.get(route.originPlaceId);
    const destination = placesById.get(route.destinationPlaceId);
    const person = peopleById.get(route.personId);
    if (!origin?.coordinates || !destination?.coordinates || !person) return [];
    return [
      {
        id: route.routeSegmentId,
        personId: route.personId,
        personName: person.displayName,
        dossierId: route.dossierId,
        originId: route.originPlaceId,
        originName: origin.displayNames.en,
        destinationId: route.destinationPlaceId,
        destinationName: destination.displayNames.en,
        coordinates: [
          [origin.coordinates.longitude, origin.coordinates.latitude],
          [destination.coordinates.longitude, destination.coordinates.latitude],
        ],
        routeStatus: route.routeStatus,
        confidence: route.confidence,
        dateStart: route.date.start,
        dateEnd: route.date.end,
        dateRaw: route.date.raw,
        datePrecision: route.date.precision,
        transportRaw: route.transportRaw,
        sequence: route.sequence,
        sourceLabel: route.sourceRefs.map((source) => source.field).filter(Boolean).join("; "),
        notes: route.notes,
        eventTypes: route.evidenceEventIds
          .map((eventId) => eventsById.get(eventId)?.eventType)
          .filter((eventType): eventType is string => Boolean(eventType)),
      },
    ];
  });

  const groups: MapGroupDatum[] = [
    ...data.households.map((household) => ({
      id: household.householdId,
      label: `Household ${household.householdId.replace("H-", "")}`,
      personIds: household.memberPersonIds,
      kind: "household" as const,
    })),
    {
      id: "FAMILY-AIZIC-2590",
      label: "Aizic family context (documented relationships)",
      personIds: ["P-2590-001", "P-2590-002", "P-2590-003"],
      kind: "family" as const,
    },
  ];

  return {
    places,
    routes,
    persons: data.persons.map((person) => ({
      id: person.personId,
      label: person.displayName,
      dossierId: person.dossierId,
      roles: person.roles,
      story: getMapPersonStory(person.personId, data) ?? undefined,
    })),
    groups,
    dossiers: data.documents.map((document) => ({ id: document.documentId, label: document.title })),
    eventTypes: [...new Set(data.events.map((event) => event.eventType))].sort(),
    unresolvedMentions: data.placeMentions
      .filter((mention) => mention.resolutionStatus === "unresolved")
      .map((mention) => ({
        id: mention.placeMentionId,
        valueRaw: mention.valueRaw,
        role: mention.role,
        personIds: mention.personIds,
        dossierId: mention.dossierId,
      })),
  };
}
