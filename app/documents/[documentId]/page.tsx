import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTimeline } from "@/components/research/event-timeline";
import { ProvenanceList } from "@/components/research/provenance-list";
import { SectionHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDocumentDetail } from "@/lib/data/selectors";
import { getResearchData } from "@/lib/data/repository";

export function generateStaticParams() {
  return getResearchData().documents.map((document) => ({ documentId: document.documentId }));
}

export async function generateMetadata({ params }: { params: Promise<{ documentId: string }> }): Promise<Metadata> {
  const { documentId } = await params;
  const detail = getDocumentDetail(documentId);
  return { title: detail?.document.title ?? "Document" };
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const detail = getDocumentDetail(documentId);
  if (!detail) notFound();
  const { document } = detail;

  return (
    <div className="page-shell">
      <nav className="mb-6 text-[10px] font-bold tracking-[0.08em] text-[#72807a] uppercase" aria-label="Breadcrumb">
        <Link href="/documents" className="hover:text-[#a54f32]">Documents</Link> <span className="mx-2">/</span> {document.title}
      </nav>
      <header className="paper-panel mb-8 grid overflow-hidden lg:grid-cols-[1fr_22rem]">
        <div className="p-6 sm:p-9">
          <p className="text-[10px] font-black tracking-[0.17em] text-[#a54f32] uppercase">{document.documentId} · model {document.modelVersion}</p>
          <h1 className="font-editorial mt-3 text-5xl leading-none font-bold text-[#173f36] sm:text-6xl">{document.title}</h1>
          <p className="mt-4 text-sm text-[#596760]">{document.fileName} · {document.documentType}</p>
          <p className="mt-4 max-w-3xl border-l-2 border-[#b9883b] pl-4 text-sm leading-6 text-[#58665f]">{document.extractionStatus}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <StatusBadge tone="gold">{document.mediaStatus.replaceAll("_", " ")}</StatusBadge>
            <StatusBadge tone="green">{document.pageCount} pages</StatusBadge>
          </div>
        </div>
        <div className="grid min-h-64 place-items-center border-t border-[#c9c2b4] bg-[#ddd7cb] p-7 text-center lg:border-t-0 lg:border-l">
          <div>
            <span className="font-editorial mx-auto grid size-20 place-items-center border-2 border-[#756f63] text-2xl font-bold text-[#514d45]">PDF</span>
            <p className="mt-4 text-[10px] font-black tracking-[0.14em] text-[#68665f] uppercase">Source viewer placeholder</p>
            <p className="mt-2 text-xs leading-5 text-[#6c706b]">The referenced scan is not in the repository. No facsimile is generated.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_19rem]">
        <div className="space-y-10">
          <section>
            <SectionHeader kicker="Named identities" title="Persons in this dossier" count={detail.persons.length} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {detail.persons.map((person) => <Link key={person.personId} href={`/persons/${person.personId}`} className="paper-panel p-4"><p className="text-[8px] font-black tracking-[0.12em] text-[#9b5a3d] uppercase">{person.personId}</p><h3 className="font-editorial mt-1 text-xl font-bold text-[#173f36]">{person.displayName}</h3><p className="mt-2 text-[10px] leading-4 text-[#6d7771]">{person.roles.join(" · ")}</p></Link>)}
            </div>
          </section>
          <section>
            <SectionHeader kicker="Document chronology" title="Extracted events" count={detail.events.length} />
            <EventTimeline events={detail.events} mentions={detail.mentions} places={detail.places} />
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <SectionHeader title="Place register" count={detail.places.length} />
            <div className="space-y-2">
              {detail.places.map((place) => <Link key={place.placeId} href={`/places/${place.placeId}`} className="paper-panel block p-3"><span className="font-editorial text-lg font-bold text-[#173f36]">{place.displayNames.en}</span><span className="mt-1 block text-[9px] text-[#77817c]">{place.resolutionStatus.replaceAll("_", " ")} · {place.placeType}</span></Link>)}
            </div>
          </section>
          <section>
            <SectionHeader title="Open questions" count={detail.reviewTasks.length} />
            <div className="space-y-2">
              {detail.reviewTasks.map((task) => <Link key={task.reviewTaskId} href={`/review?category=${task.category}`} className="block border-l-2 border-[#a54f32] bg-[#f5e8e2] p-3 text-xs leading-5 font-bold text-[#44524c]">{task.title}</Link>)}
            </div>
          </section>
          <section>
            <SectionHeader title="Document provenance" />
            <ProvenanceList sourceRefs={document.sourceRefs} raw={document.raw} />
          </section>
        </aside>
      </div>
    </div>
  );
}
