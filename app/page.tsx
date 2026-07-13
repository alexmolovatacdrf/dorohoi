import Link from "next/link";
import { SectionHeader } from "@/components/ui/page-header";
import { StatusBadge, confidenceTone } from "@/components/ui/status-badge";
import { humanizeSlug } from "@/lib/data/format";
import { getOverviewStats } from "@/lib/data/selectors";
import { getResearchData } from "@/lib/data/repository";

function MetricCard({
  href,
  value,
  label,
  note,
  accent,
}: {
  href: string;
  value: number;
  label: string;
  note: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden border border-[#d3cdbf] bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#8a9e96] hover:shadow-[0_18px_35px_rgba(25,56,47,0.09)]"
    >
      <span className={`absolute top-0 left-0 h-1 w-16 transition-all group-hover:w-full ${accent}`} />
      <span className="font-editorial block text-4xl font-bold text-[#173f36]">{value}</span>
      <span className="mt-2 block text-[11px] font-black tracking-[0.12em] text-[#344a42] uppercase">{label}</span>
      <span className="mt-2 block text-xs leading-5 text-[#707a75]">{note}</span>
      <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-black tracking-[0.1em] text-[#9b5337] uppercase">
        Open collection <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export default function OverviewPage() {
  const data = getResearchData();
  const stats = getOverviewStats(data);
  const priorityTasks = data.reviewTasks
    .filter((task) => task.severity === "high")
    .slice(0, 4);

  return (
    <>
      <section className="overflow-hidden border-b border-[#cfc8b9] bg-[#173f36] text-[#f7f1e5]">
        <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <div className="absolute top-8 right-8 hidden text-[9px] tracking-[0.18em] text-[#9ab2aa] uppercase sm:block">
              Dorohoi · 1941–1944 · V1
            </div>
            <p className="mb-5 flex items-center gap-3 text-[10px] font-black tracking-[0.2em] text-[#e0bc73] uppercase">
              <span className="h-px w-9 bg-[#e0bc73]" /> Reconstructing individual histories
            </p>
            <h1 className="font-editorial max-w-4xl text-[clamp(3rem,7vw,6.8rem)] leading-[0.86] font-bold tracking-[-0.055em]">
              Lives before <span className="text-[#dcb46a]">files.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-[#cbd7d2] sm:text-lg">
              Trace people, family relations, persecution, movement, loss and documentary evidence—without turning uncertainty into fact.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/map" className="bg-[#e1ba70] px-5 py-3 text-xs font-black tracking-[0.08em] text-[#173f36] uppercase transition hover:bg-[#f0cc87]">
                Explore the map
              </Link>
              <Link href="/persons" className="border border-white/25 px-5 py-3 text-xs font-black tracking-[0.08em] text-white uppercase transition hover:border-white/60 hover:bg-white/5">
                Browse people
              </Link>
            </div>
          </div>

          <div className="page-grid-lines relative min-h-80 border-t border-white/10 bg-[#123129] lg:min-h-full lg:border-t-0 lg:border-l">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 520" role="img" aria-label="Schematic of the pilot routes, not a geographic map">
              <path d="M80 140 C180 185 205 325 335 300" fill="none" stroke="#dcb46a" strokeWidth="4" />
              <path d="M335 300 C430 282 455 170 535 155" fill="none" stroke="#cb7454" strokeWidth="4" strokeDasharray="12 10" />
              <path d="M335 300 C390 355 468 402 530 435" fill="none" stroke="#8fb4aa" strokeWidth="3" strokeDasharray="5 9" />
              {[
                [80, 140, "Mihăileni"],
                [335, 300, "Dorohoi"],
                [535, 155, "Otaci"],
                [530, 435, "Moghilev"],
              ].map(([x, y, label]) => (
                <g key={String(label)}>
                  <circle cx={Number(x)} cy={Number(y)} r="9" fill="#f7f1e5" stroke="#dcb46a" strokeWidth="4" />
                  <text
                    x={Number(x) > 480 ? Number(x) - 16 : Number(x) + 16}
                    y={Number(y) - 14}
                    fill="#dbe5e1"
                    fontSize="12"
                    fontFamily="Arial"
                    letterSpacing="1.2"
                    textAnchor={Number(x) > 480 ? "end" : "start"}
                  >
                    {label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="absolute right-6 bottom-6 left-6 border border-white/12 bg-[#173f36]/85 p-4 backdrop-blur-sm">
              <p className="text-[9px] font-black tracking-[0.18em] text-[#dcb46a] uppercase">Reading rule 06</p>
              <p className="mt-2 text-sm leading-5 text-[#d1dcd7]">
                A named place is evidence of a mention. It becomes a route only when movement is documented.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell">
        <div className="mb-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard href="/persons" value={stats.persons} label="Persons" note="Individual research identities" accent="bg-[#2f6658]" />
          <MetricCard href="/places" value={stats.places} label="Places" note={`${stats.corePlaces} research-core · ${stats.ehriPlaces} EHRI`} accent="bg-[#3c6572]" />
          <MetricCard href="/documents" value={stats.documents} label="Documents" note={`${stats.events} source-linked events`} accent="bg-[#b9883b]" />
          <MetricCard href="/review" value={stats.openReviewTasks} label="Review tasks" note={`${stats.unresolvedPlaces} unresolved place identities`} accent="bg-[#a54f32]" />
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.55fr_0.85fr]">
          <section>
            <SectionHeader
              kicker="People at the centre"
              title="Pilot life histories"
              count={data.persons.length}
              action={<Link className="text-[10px] font-black tracking-[0.1em] text-[#a54f32] uppercase" href="/persons">View all →</Link>}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {data.persons.map((person) => {
                const personEvents = data.events.filter((event) => event.participantIds.includes(person.personId));
                const firstDate = personEvents.map((event) => event.date.start).filter(Boolean).sort()[0];
                return (
                  <Link key={person.personId} href={`/persons/${person.personId}`} className="paper-panel group flex min-h-48 flex-col p-5 transition hover:border-[#80988f]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black tracking-[0.15em] text-[#9a5b3e] uppercase">{person.dossierId}</p>
                        <h2 className="font-editorial mt-1 text-2xl font-bold text-[#173f36] group-hover:text-[#a54f32]">{person.displayName}</h2>
                      </div>
                      <StatusBadge tone={confidenceTone(person.confidence)}>{person.confidence}</StatusBadge>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[#65716b]">{person.roles.join(" · ")}</p>
                    <div className="mt-auto flex items-end justify-between border-t border-[#ded8cb] pt-4">
                      <span className="text-[10px] text-[#75807a]">{personEvents.length} events · {person.routeSegmentIds.length} route legs</span>
                      <span className="text-sm text-[#a54f32]">→</span>
                    </div>
                    {firstDate ? <span className="sr-only">Earliest normalized event {firstDate}</span> : null}
                  </Link>
                );
              })}
            </div>
          </section>

          <aside>
            <SectionHeader kicker="Research queue" title="Priority review" count={priorityTasks.length} />
            <div className="paper-panel divide-y divide-[#ded8cc]">
              {priorityTasks.map((task) => (
                <Link href={`/review?category=${task.category}`} key={task.reviewTaskId} className="block p-4 transition hover:bg-[#f5efe4]">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge tone="red">{humanizeSlug(task.category)}</StatusBadge>
                    <span className="text-[9px] font-bold text-[#8b928e]">{task.dossierId ?? "CATALOG"}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold leading-5 text-[#243a32]">{task.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6b746f]">{task.description}</p>
                </Link>
              ))}
              <Link href="/review" className="block bg-[#173f36] px-4 py-3 text-center text-[10px] font-black tracking-[0.12em] text-white uppercase">
                Open full review queue
              </Link>
            </div>
          </aside>
        </div>

        <section className="mt-10">
          <SectionHeader kicker="Documentary units" title="Current dossiers" count={data.documents.length} />
          <div className="grid gap-3 lg:grid-cols-2">
            {data.documents.map((document) => (
              <Link key={document.documentId} href={`/documents/${document.documentId}`} className="grid gap-4 border border-[#d4cebf] bg-[#e9e4d8]/70 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <span className="font-editorial grid size-14 place-items-center border border-[#a69a83] bg-[#f8f4e9] text-xl font-bold text-[#173f36]">{document.documentId.slice(-2)}</span>
                <span>
                  <span className="block text-[9px] font-black tracking-[0.14em] text-[#9b5d40] uppercase">{document.documentType}</span>
                  <span className="font-editorial mt-1 block text-xl font-bold">{document.title}</span>
                  <span className="mt-1 block text-xs text-[#6d7771]">{document.pageCount} PDF pages · {document.personIds.length} people · {document.eventIds.length} events</span>
                </span>
                <span className="text-xl text-[#9b5d40]">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 border border-[#c9c2b2] bg-[#fffdf8] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[9px] font-black tracking-[0.17em] text-[#a54f32] uppercase">Method note</p>
            <h2 className="font-editorial mt-2 text-2xl font-bold text-[#173f36]">Analytical normalization never replaces the document.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#62706a]">
              Every entity retains source file, page or rubric where available, raw wording, normalized values, confidence, review state and alternatives. PDF scans are referenced but not present in this repository.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/documents" className="border border-[#173f36] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] text-[#173f36] uppercase">Document register</Link>
            <Link href="/review" className="bg-[#173f36] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] text-white uppercase">Review evidence</Link>
          </div>
        </section>
      </div>
    </>
  );
}
