import "server-only";

import documents from "@/data/normalized/documents.json";
import events from "@/data/normalized/events.json";
import households from "@/data/normalized/households.json";
import personNameVariants from "@/data/normalized/personNameVariants.json";
import persons from "@/data/normalized/persons.json";
import placeMentions from "@/data/normalized/placeMentions.json";
import places from "@/data/normalized/places.json";
import relationships from "@/data/normalized/relationships.json";
import reviewTasks from "@/data/normalized/reviewTasks.json";
import routeSegments from "@/data/normalized/routeSegments.json";
import { NormalizedBundleSchema, type NormalizedBundle } from "@/lib/domain/schemas";

const data: NormalizedBundle = NormalizedBundleSchema.parse({
  persons,
  personNameVariants,
  households,
  relationships,
  documents,
  events,
  places,
  placeMentions,
  routeSegments,
  reviewTasks,
});

export function getResearchData(): NormalizedBundle {
  return data;
}
