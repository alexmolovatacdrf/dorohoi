import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTimeline } from "@/components/research/event-timeline";
import { ProvenanceList } from "@/components/research/provenance-list";
import { RouteEvidenceList } from "@/components/research/route-evidence-list";
import { SectionHeader } from "@/components/ui/page-header";
import { StatusBadge, confidenceTone, reviewTone } from "@/components/ui/status-badge";
import { formatDateRange, humanizeSlug } from "@/lib/data/format";
import { getPersonDetail } from "@/lib/data/selectors";
import { getResearchData } from "@/lib/data/repository";

export function generateStaticParams() {
  return getResearchData().persons.map((person) => ({ personId: person.personId }));
}

export async function generateMetadata({ params }: { params: Promise<{ personId: string }> }): Promise<Metadata> {
  const { personId } = await params;
  const detail = getPersonDetail(personId);
  return { title: detail?.person.displayName ?? "Person" };
}

export default async function PersonDetailPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const detail = getPersonDetail(personId);
  if (!detail) notFound();
  const { person } = detail;

  return (
    <div className="page-shell">
      <nav className="mb-6 text-[10px] font-bold tracking-[0.08em] text-[#72807a] uppercase" aria-label="Breadcrumb">
        <Link href="/persons" className="hover:text-[#a54f32]">Persons</Link> <span className="mx-2">/</span> {person.displayName}
      </nav>

      <header className="paper-panel relative mb-8 overflow-hidden">
        <div className="absolute top-0 right-0 h-full w-2 bg-[#a54f32]" />
        <div className="grid lg:grid-cols-[1fr_20rem]">
          <div className="p-6 sm:p-9">
            <p className="text-[10px] font-black tracking-[0.18em] text-[#a54f32] uppercase">{person.dossierId} · {person.personId}</p>
            <h1 className="font-editorial mt-3 text-5xl leading-none font-bold text-[#173f36] sm:text-6xl">{person.displayName}</h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge tone={confidenceTone(person.confidence)}>{person.confidence} identity confidence</StatusBadge>
              <StatusBadge tone={person.assertionStatus === "explicit" ? "green" : "gold"}>{person.assertionStatus}</StatusBadge>
              {person.reviewState === "needs_review" ? <StatusBadge tone={reviewTone(person.reviewState)}>needs review</StatusBadge> : null}
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-[#596760]">Document roles: {person.roles.join(" · ")}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href={`/map?person=${person.personId}`} className="bg-[#173f36] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] text-white uppercase">View on map</Link>
              <Link href={`/documents/${person.documentIds[0]}`} className="border border-[#173f36] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] text-[#173f36] uppercase">Open dossier</Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 border-t border-[#d8d2c5] bg-[#ebe6da]/70 p-6 lg:grid-cols-1 lg:border-t-0 lg:border-l">
            <div className="border-b border-[#d7d0c2] pb-3">
              <dt className="text-[8px] font-black tracking-[0.13em] text-[#78827d] uppercase">Birth</dt>
              <dd className="font-editorial mt-1 text-lg font-bold">{person.birthDate ? formatDateRange(person.birthDate) : "Unresolved"}</dd>
            </div>
            <div className="border-b border-[#d7d0c2] px-3 pb-3 lg:px-0 lg:pt-3">
              <dt className="text-[8px] font-black tracking-[0.13em] text-[#78827d] uppercase">Civil status, raw</dt>
              <dd className="mt-1 text-sm font-semibold">{person.civilStatusRaw ?? "Not supplied"}</dd>
            </div>
            <div className="pt-3">
              <dt className="text-[8px] font-black tracking-[0.13em] text-[#78827d] uppercase">Evidence graph</dt>
              <dd className="mt-1 text-xs leading-5">{detail.events.length} events · {detail.routes.length} routes · {detail.relationships.length} relations</dd>
            </div>
            <div className="px-3 pt-3 lg:px-0">
              <dt className="text-[8px] font-black tracking-[0.13em] text-[#78827d] uppercase">Name forms</dt>
              <dd className="mt-1 text-xs leading-5">{detail.nameVariants.map((variant) => variant.value).join(" · ")}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_19rem]">
        <div className="space-y-10">
          <section>
            <SectionHeader kicker="Individual chronology" title="Events" count={detail.events.length} />
            <EventTimeline events={detail.events} mentions={detail.mentions} places={detail.places} />
          </section>

          <section>
            <SectionHeader kicker="Movement evidence" title="Route segments" count={detail.routes.length} action={<span className="text-[9px] font-bold tracking-[0.08em] text-[#77817c] uppercase">Solid = explicit · dashed = partial</span>} />
            <RouteEvidenceList routes={detail.routes} places={getResearchData().places} />
          </section>

          <section>
            <SectionHeader kicker="Geographic evidence" title="Places & mentions" count={detail.mentions.length} />
            <div className="paper-panel overflow-hidden">
              <table className="research-table">
                <thead><tr><th>Raw mention</th><th>Role</th><th>Resolved identity</th><th>Status</th></tr></thead>
                <tbody>
                  {detail.mentions.map((mention) => {
                    const place = detail.places.find((item) => item.placeId === mention.placeId);
                    return (
                      <tr key={mention.placeMentionId}>
                        <td className="font-serif text-sm">{mention.valueRaw}</td>
                        <td className="text-xs">{mention.role.replaceAll("_", " ")}</td>
                        <td className="text-xs">{place ? <Link className="font-bold text-[#2f6658] hover:text-[#a54f32]" href={`/places/${place.placeId}`}>{place.displayNames.en}</Link> : "Not resolved"}</td>
                        <td><StatusBadge tone={mention.resolutionStatus === "unresolved" ? "rust" : mention.resolutionStatus === "partially_resolved" ? "gold" : "green"}>{mention.resolutionStatus.replaceAll("_", " ")}</StatusBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <SectionHeader title="Relationships" count={detail.relationships.length} />
            <div className="space-y-2">
              {detail.relationships.map(({ relationship, person: related, role }) => (
                <Link key={relationship.relationshipId} href={`/persons/${related.personId}`} className="paper-panel block p-4">
                  <p className="text-[9px] font-black tracking-[0.12em] text-[#9a5c3e] uppercase">{humanizeSlug(relationship.relationshipType)} · {role}</p>
                  <h3 className="font-editorial mt-1 text-xl font-bold text-[#173f36]">{related.displayName}</h3>
                  <div className="mt-2"><StatusBadge tone={confidenceTone(relationship.confidence)}>{relationship.confidence}</StatusBadge></div>
                </Link>
              ))}
              {!detail.relationships.length ? <p className="border border-dashed border-[#bbb5a9] p-4 text-xs text-[#6d7772]">No relationship is stated in the current source.</p> : null}
            </div>
          </section>

          <section>
            <SectionHeader title="Review issues" count={detail.reviewTasks.length} />
            <div className="space-y-2">
              {detail.reviewTasks.map((task) => (
                <Link key={task.reviewTaskId} href={`/review?category=${task.category}`} className="block border-l-2 border-[#a54f32] bg-[#f5eae4] p-3">
                  <p className="text-[8px] font-black tracking-[0.1em] text-[#9b5b40] uppercase">{humanizeSlug(task.category)}</p>
                  <p className="mt-1 text-xs leading-5 font-bold text-[#3f4e47]">{task.title}</p>
                </Link>
              ))}
              {!detail.reviewTasks.length ? <p className="text-xs text-[#6d7772]">No linked open review tasks.</p> : null}
            </div>
          </section>

          <section>
            <SectionHeader title="Identity provenance" />
            <ProvenanceList sourceRefs={person.sourceRefs} raw={person.raw} alternatives={person.alternativeReadings} />
          </section>
        </aside>
      </div>
    </div>
  );
}
