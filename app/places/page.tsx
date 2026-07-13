import type { Metadata } from "next";
import { PlaceDirectory, type PlaceListItem } from "@/components/research/place-directory";
import { PageHeader } from "@/components/ui/page-header";
import { getResearchData } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ layer?: string; resolution?: string }>;
}) {
  const data = getResearchData();
  const params = await searchParams;
  const items: PlaceListItem[] = data.places.map((place) => {
    const mentions = data.placeMentions.filter((mention) => mention.placeId === place.placeId);
    const eventIds = new Set(mentions.filter((mention) => mention.ownerType === "event").map((mention) => mention.ownerId));
    return {
      id: place.placeId,
      name: place.displayNames.en,
      originalName: place.originalName,
      variants: place.variants,
      placeType: place.placeType,
      layer: place.layer,
      resolutionStatus: place.resolutionStatus,
      confidence: place.confidence,
      reviewState: place.reviewState,
      personCount: new Set(mentions.flatMap((mention) => mention.personIds)).size,
      eventCount: eventIds.size,
      incomingCount: data.routeSegments.filter((route) => route.destinationPlaceId === place.placeId).length,
      outgoingCount: data.routeSegments.filter((route) => route.originPlaceId === place.placeId).length,
      coordinates: place.coordinates ? `${place.coordinates.latitude.toFixed(5)}, ${place.coordinates.longitude.toFixed(5)}` : null,
    };
  });

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Gazetteer & mentions"
        title="A place can be known, partial or unresolved."
        description="Browse canonical places, raw name variants and the optional local EHRI overlay. A mention is never converted into a route stop automatically."
      />
      <PlaceDirectory places={items} initialLayer={params.layer} initialResolution={params.resolution} />
    </div>
  );
}
