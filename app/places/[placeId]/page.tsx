import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTimeline } from "@/components/research/event-timeline";
import { ProvenanceList } from "@/components/research/provenance-list";
import { SectionHeader } from "@/components/ui/page-header";
import { StatusBadge, confidenceTone, reviewTone } from "@/components/ui/status-badge";
import { formatDateRange, humanizeSlug } from "@/lib/data/format";
import { getPlaceDetail } from "@/lib/data/selectors";
import { getResearchData } from "@/lib/data/repository";

export async function generateMetadata({ params }: { params: Promise<{ placeId: string }> }): Promise<Metadata> {
  const { placeId } = await params;
  const detail = getPlaceDetail(placeId);
  return { title: detail?.place.displayNames.en ?? "Place" };
}

export default async function PlaceDetailPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const detail = getPlaceDetail(placeId);
  if (!detail) notFound();
  const { place } = detail;

  return (
    <div className="page-shell">
      <nav className="mb-6 text-[10px] font-bold tracking-[0.08em] text-[#72807a] uppercase" aria-label="Breadcrumb">
        <Link href="/places" className="hover:text-[#a54f32]">Places</Link> <span className="mx-2">/</span> {place.displayNames.en}
      </nav>

      <header className="paper-panel mb-8 grid overflow-hidden lg:grid-cols-[1fr_21rem]">
        <div className="p-6 sm:p-9">
          <p className="text-[10px] font-black tracking-[0.17em] text-[#a54f32] uppercase">{place.layer.replaceAll("_", " ")} · {place.placeId}</p>
          <h1 className="font-editorial mt-3 text-4xl leading-none font-bold text-[#173f36] sm:text-6xl">{place.displayNames.en}</h1>
          {place.displayNames.ro !== place.displayNames.en ? <p className="font-editorial mt-2 text-xl text-[#66736d]">RO: {place.displayNames.ro}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge tone={place.resolutionStatus === "unresolved" ? "rust" : place.resolutionStatus === "partially_resolved" ? "gold" : "green"}>{place.resolutionStatus.replaceAll("_", " ")}</StatusBadge>
            <StatusBadge tone="blue">{place.placeType}</StatusBadge>
            <StatusBadge tone={confidenceTone(place.confidence)}>{place.confidence} identity confidence</StatusBadge>
            {place.reviewState === "needs_review" ? <StatusBadge tone={reviewTone(place.reviewState)}>needs review</StatusBadge> : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {place.variants.map((variant) => <span key={variant} className="border border-[#d4cec1] bg-[#f3efe6] px-2.5 py-1 text-[10px] text-[#58665f]">{variant}</span>)}
          </div>
          <div className="mt-7 flex gap-2">
            <Link href={`/map?place=${place.placeId}`} className="bg-[#173f36] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] text-white uppercase">Open on map</Link>
            {place.relatedPlaceIds.map((relatedId) => <Link key={relatedId} href={`/places/${relatedId}`} className="border border-[#173f36] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] text-[#173f36] uppercase">Related catalog record</Link>)}
          </div>
        </div>
        <div className="border-t border-[#d9d3c7] bg-[#173f36] p-6 text-[#f7f1e6] lg:border-t-0 lg:border-l">
          <p className="text-[9px] font-black tracking-[0.15em] text-[#dcb46a] uppercase">Location status</p>
          {place.coordinates ? (
            <>
              <p className="font-editorial mt-4 text-3xl font-bold">{place.coordinates.latitude.toFixed(5)}° N</p>
              <p className="font-editorial text-3xl font-bold">{place.coordinates.longitude.toFixed(5)}° E</p>
            </>
          ) : <p className="font-editorial mt-4 text-3xl font-bold">No point assigned</p>}
          <p className="mt-5 text-xs leading-5 text-[#c5d1cc]">{place.coordinateSource?.label ?? "Coordinates intentionally absent; no location is inferred from similarity."}</p>
          {place.coordinateSource?.url ? <a href={place.coordinateSource.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[9px] font-black tracking-[0.1em] text-[#e3c27e] uppercase">Coordinate source ↗</a> : null}
          <p className="mt-6 border-t border-white/15 pt-4 text-[10px] leading-5 text-[#aabbb4]">Coordinate confidence: {place.coordinateConfidence}. Identity and coordinate confidence are tracked separately.</p>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_19rem]">
        <div className="space-y-10">
          <section>
            <SectionHeader kicker="Document occurrences" title="Place mentions" count={detail.mentions.length} />
            {detail.mentions.length ? (
              <div className="paper-panel overflow-hidden">
                <table className="research-table">
                  <thead><tr><th>Raw wording</th><th>Role</th><th>People</th><th>Document</th></tr></thead>
                  <tbody>
                    {detail.mentions.map((mention) => (
                      <tr key={mention.placeMentionId}>
                        <td className="font-serif text-sm">{mention.valueRaw}</td>
                        <td className="text-xs">{mention.role.replaceAll("_", " ")}</td>
                        <td className="text-xs">{mention.personIds.map((id) => detail.persons.find((person) => person.personId === id)?.displayName ?? id).join(" · ") || "Document context"}</td>
                        <td className="text-xs">{mention.dossierId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="border border-dashed border-[#bbb5a9] bg-[#eee9df]/60 p-6 text-sm text-[#66726c]">This imported overlay record has no direct dossier mention in the current pilot.</div>}
          </section>

          {detail.events.length ? (
            <section>
              <SectionHeader kicker="Chronology at this place" title="Events" count={detail.events.length} />
              <EventTimeline events={detail.events} mentions={detail.mentions} places={getResearchData().places} />
            </section>
          ) : null}

          <section>
            <SectionHeader kicker="Directed movement" title="Incoming & outgoing routes" count={detail.incomingRoutes.length + detail.outgoingRoutes.length} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="paper-panel p-5">
                <p className="text-[9px] font-black tracking-[0.14em] text-[#7a6650] uppercase">Incoming</p>
                <div className="mt-3 space-y-3">
                  {detail.incomingRoutes.map((route) => {
                    const origin = getResearchData().places.find((item) => item.placeId === route.originPlaceId);
                    return <Link key={route.routeSegmentId} href={`/persons/${route.personId}`} className="block border-l-2 border-[#2f6658] pl-3 text-sm"><strong>{origin?.displayNames.en}</strong> → here <span className="block text-[10px] text-[#71807a]">{formatDateRange(route.date)} · {route.routeStatus}</span></Link>;
                  })}
                  {!detail.incomingRoutes.length ? <p className="text-xs text-[#717b76]">No documented incoming route.</p> : null}
                </div>
              </div>
              <div className="paper-panel p-5">
                <p className="text-[9px] font-black tracking-[0.14em] text-[#7a6650] uppercase">Outgoing</p>
                <div className="mt-3 space-y-3">
                  {detail.outgoingRoutes.map((route) => {
                    const destination = getResearchData().places.find((item) => item.placeId === route.destinationPlaceId);
                    return <Link key={route.routeSegmentId} href={`/persons/${route.personId}`} className="block border-l-2 border-[#a54f32] pl-3 text-sm">Here → <strong>{destination?.displayNames.en}</strong><span className="block text-[10px] text-[#71807a]">{formatDateRange(route.date)} · {route.routeStatus}</span></Link>;
                  })}
                  {!detail.outgoingRoutes.length ? <p className="text-xs text-[#717b76]">No documented outgoing route.</p> : null}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <SectionHeader title="People" count={detail.persons.length} />
            <div className="space-y-2">
              {detail.persons.map((person) => <Link key={person.personId} href={`/persons/${person.personId}`} className="paper-panel block p-3"><span className="font-editorial text-lg font-bold text-[#173f36]">{person.displayName}</span><span className="mt-1 block text-[9px] text-[#7a847f]">{person.dossierId}</span></Link>)}
              {!detail.persons.length ? <p className="text-xs text-[#6e7873]">No person-level link in current dossiers.</p> : null}
            </div>
          </section>
          <section>
            <SectionHeader title="Identification issues" count={detail.reviewTasks.length} />
            <div className="space-y-2">
              {detail.reviewTasks.map((task) => <Link key={task.reviewTaskId} href={`/review?category=${task.category}`} className="block border-l-2 border-[#a54f32] bg-[#f5e8e2] p-3"><span className="text-[8px] font-black tracking-[0.1em] text-[#945039] uppercase">{humanizeSlug(task.category)}</span><span className="mt-1 block text-xs leading-5 font-bold">{task.title}</span></Link>)}
              {!detail.reviewTasks.length ? <p className="text-xs text-[#6e7873]">No linked review task.</p> : null}
            </div>
          </section>
          <section>
            <SectionHeader title="Place provenance" />
            <ProvenanceList sourceRefs={place.sourceRefs} raw={place.raw} alternatives={place.alternativeReadings} />
          </section>
        </aside>
      </div>
    </div>
  );
}
