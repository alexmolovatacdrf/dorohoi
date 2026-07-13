import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getResearchData } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  const data = getResearchData();
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Document register"
        title="The scan remains the authority."
        description="Browse current documentary units and the analytical records derived from them. V1 reserves a source-viewer space; the referenced PDFs are not present in this repository."
      />
      <SectionHeader title="Current dossier records" count={data.documents.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.documents.map((document) => {
          const tasks = data.reviewTasks.filter((task) => task.dossierId === document.documentId);
          return (
            <Link key={document.documentId} href={`/documents/${document.documentId}`} className="paper-panel group overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#d9d3c6] bg-[#ebe6da] px-5 py-3">
                <span className="text-[9px] font-black tracking-[0.16em] text-[#8e563d] uppercase">{document.documentId}</span>
                <StatusBadge tone="gold">{document.mediaStatus.replaceAll("_", " ")}</StatusBadge>
              </div>
              <div className="p-6">
                <h2 className="font-editorial text-3xl font-bold text-[#173f36] group-hover:text-[#a54f32]">{document.title}</h2>
                <p className="mt-2 text-xs text-[#6d7771]">{document.fileName}</p>
                <p className="mt-4 text-sm leading-6 text-[#596760]">{document.extractionStatus}</p>
                <div className="mt-6 grid grid-cols-4 border-y border-[#ded8cc] py-4 text-center">
                  <span><strong className="font-editorial block text-xl">{document.pageCount}</strong><small className="text-[8px] font-bold uppercase">Pages</small></span>
                  <span><strong className="font-editorial block text-xl">{document.personIds.length}</strong><small className="text-[8px] font-bold uppercase">People</small></span>
                  <span><strong className="font-editorial block text-xl">{document.eventIds.length}</strong><small className="text-[8px] font-bold uppercase">Events</small></span>
                  <span><strong className="font-editorial block text-xl">{tasks.length}</strong><small className="text-[8px] font-bold uppercase">Tasks</small></span>
                </div>
                <span className="mt-5 inline-flex text-[10px] font-black tracking-[0.11em] text-[#a54f32] uppercase">Open documentary record →</span>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="mt-8 border border-dashed border-[#afa99d] bg-[#eee9de]/60 p-6">
        <p className="text-[9px] font-black tracking-[0.15em] text-[#6d5b41] uppercase">Future source viewer</p>
        <h2 className="font-editorial mt-2 text-2xl font-bold text-[#173f36]">PDF and page-image manifests can attach here.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#65716b]">The document model already retains filenames, page counts, PDF page references, printed page references and rubrics. No facsimile is synthesized when the source scan is absent.</p>
      </section>
    </div>
  );
}
