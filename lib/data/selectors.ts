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
} from "@/lib/domain/schemas";
import { getResearchData } from "./repository";

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

export interface MapViewModel {
  places: MapPlaceDatum[];
  routes: MapRouteDatum[];
  persons: Array<{ id: string; label: string; dossierId: string | null; roles: string[] }>;
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
    const events = mentions.flatMap((mention) => {
      if (mention.ownerType !== "event") return [];
      const event = eventsById.get(mention.ownerId);
      return event ? [event] : [];
    });
    const roles = uniqueById(mentions).map((mention) => mention.role);
    const eventTypes = uniqueById(events).map((event) => event.eventType);
    return {
      id: place.placeId,
      label: place.displayNames.en,
      labelRo: place.displayNames.ro,
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
