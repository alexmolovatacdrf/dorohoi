import Link from "next/link";
import { ProvenanceList } from "./provenance-list";
import { StatusBadge, confidenceTone, reviewTone } from "@/components/ui/status-badge";
import { formatDateRange, humanizeSlug, rawValueLabel } from "@/lib/data/format";
import type { Event, Place, PlaceMention } from "@/lib/domain/schemas";

export function EventTimeline({
  events,
  mentions,
  places,
}: {
  events: Event[];
  mentions: PlaceMention[];
  places: Place[];
}) {
  const mentionsByEvent = new Map<string, PlaceMention[]>();
  for (const mention of mentions) {
    if (mention.ownerType !== "event") continue;
    mentionsByEvent.set(mention.ownerId, [...(mentionsByEvent.get(mention.ownerId) ?? []), mention]);
  }
  const placesById = new Map(places.map((place) => [place.placeId, place]));

  return (
    <div className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[6.5rem] before:w-px before:bg-[#c9c2b3] max-sm:before:left-3">
      {events.map((event) => {
        const eventMentions = mentionsByEvent.get(event.eventId) ?? [];
        return (
          <article key={event.eventId} className="relative grid gap-3 sm:grid-cols-[5.5rem_1fr] sm:gap-8">
            <div className="relative z-10 max-sm:pl-8 sm:text-right">
              <span className="absolute top-2 left-[6.1rem] size-3 rounded-full border-2 border-[#f4f1e8] bg-[#a54f32] max-sm:left-[0.45rem]" />
              <p className="text-[10px] leading-4 font-black text-[#57645e]">{formatDateRange(event.date)}</p>
              <p className="mt-1 text-[8px] font-bold tracking-[0.08em] text-[#8b928f] uppercase">{event.date.precision}</p>
            </div>
            <div className="paper-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black tracking-[0.13em] text-[#9c5b3e] uppercase">{event.eventId}</p>
                  <h3 className="font-editorial mt-1 text-xl font-bold text-[#173f36]">{humanizeSlug(event.eventType)}</h3>
                </div>
                <div className="flex gap-1.5">
                  <StatusBadge tone={confidenceTone(event.confidence)}>{event.confidence}</StatusBadge>
                  {event.reviewState === "needs_review" ? <StatusBadge tone={reviewTone(event.reviewState)}>review</StatusBadge> : null}
                </div>
              </div>
              {event.descriptionRaw ? <p className="mt-3 border-l-2 border-[#b9883b] pl-3 font-serif text-sm leading-6 text-[#4d473d]">{event.descriptionRaw}</p> : null}
              {eventMentions.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {eventMentions.map((mention) => {
                    const place = mention.placeId ? placesById.get(mention.placeId) : null;
                    const content = (
                      <span className="inline-flex gap-1 border border-[#d6d0c4] bg-[#f4f0e7] px-2 py-1 text-[10px] text-[#47564f]">
                        <strong>{mention.role.replaceAll("_", " ")}:</strong> {place?.displayNames.en ?? mention.valueRaw}
                      </span>
                    );
                    return place ? <Link key={mention.placeMentionId} href={`/places/${place.placeId}`}>{content}</Link> : <span key={mention.placeMentionId}>{content}</span>;
                  })}
                </div>
              ) : null}
              {Object.keys(event.attributes).length ? (
                <dl className="mt-4 grid gap-x-5 gap-y-2 border-t border-[#e0dbcf] pt-3 sm:grid-cols-2">
                  {Object.entries(event.attributes).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-[8px] font-black tracking-[0.09em] text-[#858d89] uppercase">{key.replaceAll("_", " ")}</dt>
                      <dd className="mt-0.5 text-[11px] leading-4 text-[#4f5e57]">{rawValueLabel(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="mt-4">
                <ProvenanceList sourceRefs={event.sourceRefs} raw={event.raw} alternatives={event.alternativeReadings} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
