import type { Metadata } from "next";
import { ReviewBoard, type ReviewListItem } from "@/components/research/review-board";
import { PageHeader } from "@/components/ui/page-header";
import { getResearchData } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const data = getResearchData();
  const params = await searchParams;
  const labels = new Map<string, string>([
    ...data.persons.map((person) => [person.personId, person.displayName] as const),
    ...data.places.map((place) => [place.placeId, place.displayNames.en] as const),
    ...data.events.map((event) => [event.eventId, event.eventType] as const),
    ...data.relationships.map((relationship) => [relationship.relationshipId, relationship.relationshipType] as const),
    ...data.routeSegments.map((route) => [route.routeSegmentId, route.routeSegmentId] as const),
    ...data.documents.map((document) => [document.documentId, document.title] as const),
  ]);
  const tasks: ReviewListItem[] = data.reviewTasks.map((task) => ({
    id: task.reviewTaskId,
    category: task.category,
    title: task.title,
    description: task.description,
    severity: task.severity,
    dossierId: task.dossierId,
    suggestedAction: task.suggestedAction,
    sourceLabel: task.sourceRefs.map((source) => source.sourceFile).join(" · "),
    entityLabels: task.entityRefs.map((reference) => labels.get(reference.entityId) ?? reference.entityId),
  }));

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Research review"
        title="Uncertainty is part of the record."
        description="Review unresolved places, competing readings, incomplete routes, candidate identity matches, relationships and contradictions without overwriting documentary wording."
      />
      <ReviewBoard tasks={tasks} initialCategory={params.category} />
    </div>
  );
}
