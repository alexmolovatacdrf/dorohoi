import type { Metadata } from "next";
import { PersonDirectory, type PersonListItem } from "@/components/research/person-directory";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/lib/data/format";
import { getResearchData } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Persons" };

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dossier?: string }>;
}) {
  const data = getResearchData();
  const params = await searchParams;
  const items: PersonListItem[] = data.persons.map((person) => {
    const eventIds = new Set(person.eventIds);
    const mentions = data.placeMentions.filter(
      (mention) => mention.personIds.includes(person.personId) || (mention.ownerType === "event" && eventIds.has(mention.ownerId)),
    );
    const placeIds = new Set(mentions.map((mention) => mention.placeId).filter(Boolean));
    return {
      id: person.personId,
      name: person.displayName,
      birthLabel: person.birthDate ? formatDateRange(person.birthDate) : "date unresolved",
      dossierId: person.dossierId ?? "No dossier",
      roles: person.roles,
      confidence: person.confidence,
      reviewState: person.reviewState,
      eventCount: person.eventIds.length,
      routeCount: person.routeSegmentIds.length,
      relationshipCount: person.relationshipIds.length,
      places: data.places.filter((place) => placeIds.has(place.placeId)).map((place) => place.displayNames.en),
    };
  });

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Person index"
        title="Lives reconstructed one person at a time."
        description="Search documentary identities, roles and connected places. Relationships and household context never transfer another person's route or events."
      />
      <PersonDirectory people={items} initialQuery={params.q} initialDossier={params.dossier} />
    </div>
  );
}
