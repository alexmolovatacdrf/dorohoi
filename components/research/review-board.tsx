"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

export interface ReviewListItem {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  dossierId: string | null;
  suggestedAction: string | null;
  sourceLabel: string;
  entityLabels: string[];
}

const categories = [
  ["all", "All tasks"],
  ["unresolved_place", "Unresolved places"],
  ["uncertain_reading", "Uncertain readings"],
  ["incomplete_route", "Incomplete routes"],
  ["possible_duplicate_person", "Possible duplicates"],
  ["questionable_relationship", "Relationships"],
  ["contradiction", "Contradictions"],
  ["source_collation", "Source collation"],
  ["external_catalog_quality", "Catalog quality"],
] as const;

export function ReviewBoard({
  tasks,
  initialCategory = "all",
}: {
  tasks: ReviewListItem[];
  initialCategory?: string;
}) {
  const knownCategory = categories.some(([value]) => value === initialCategory) ? initialCategory : "all";
  const [category, setCategory] = useState(knownCategory);
  const [query, setQuery] = useState("");
  const counts = useMemo(
    () => Object.fromEntries(categories.map(([value]) => [value, value === "all" ? tasks.length : tasks.filter((task) => task.category === value).length])),
    [tasks],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en");
    return tasks.filter((task) => {
      const matchesCategory = category === "all" || task.category === category;
      const matchesQuery = !needle || [task.title, task.description, task.dossierId, ...task.entityLabels].join(" ").toLocaleLowerCase("en").includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, tasks]);

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      <aside className="paper-panel h-fit p-3 lg:sticky lg:top-24">
        <p className="px-2 pt-2 pb-3 text-[9px] font-black tracking-[0.15em] text-[#715b3b] uppercase">Queue categories</p>
        <div className="space-y-1">
          {categories.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setCategory(value)} className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-left text-xs font-bold transition ${category === value ? "bg-[#173f36] text-white" : "text-[#4f5e58] hover:bg-[#eee9de]"}`}>
              <span>{label}</span>
              <span className={`grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[9px] ${category === value ? "bg-white/15" : "bg-[#ded8ca]"}`}>{counts[value] ?? 0}</span>
            </button>
          ))}
        </div>
      </aside>

      <section>
        <div className="paper-panel mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <label className="grow">
            <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Search review evidence</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Person, dossier, issue or reading" className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2f6658]" />
          </label>
          <button type="button" onClick={() => setQuery("")} className="border border-[#a9aaa4] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] uppercase hover:bg-[#ede9df]">Clear</button>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs text-[#67736d]">
          <span><strong className="text-[#20372f]">{filtered.length}</strong> open tasks</span>
          <span>Read-only in V1</span>
        </div>

        <div className="space-y-3">
          {filtered.map((task) => (
            <article key={task.id} className="paper-panel grid overflow-hidden lg:grid-cols-[8rem_1fr]">
              <div className={`flex flex-row items-center justify-between gap-2 border-b p-4 lg:flex-col lg:items-start lg:justify-start lg:border-r lg:border-b-0 ${task.severity === "high" ? "border-[#d3a097] bg-[#f5e7e3]" : task.severity === "medium" ? "border-[#d6bc8b] bg-[#f4eddf]" : "border-[#cbd0cb] bg-[#eef0ec]"}`}>
                <StatusBadge tone={task.severity === "high" ? "red" : task.severity === "medium" ? "gold" : "slate"}>{task.severity}</StatusBadge>
                <span className="text-[9px] font-black tracking-[0.1em] text-[#66716c] uppercase">{task.dossierId ?? "Dataset"}</span>
              </div>
              <div className="p-5">
                <p className="text-[9px] font-black tracking-[0.14em] text-[#a15338] uppercase">{task.category.replaceAll("_", " ")}</p>
                <h2 className="font-editorial mt-1 text-2xl font-bold text-[#173f36]">{task.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#5d6a64]">{task.description}</p>
                {task.entityLabels.length ? <p className="mt-3 text-[10px] text-[#717b76]">Linked: {task.entityLabels.join(" · ")}</p> : null}
                {task.suggestedAction ? (
                  <div className="mt-4 border-l-2 border-[#b9883b] bg-[#f6f2e8] px-3 py-2.5 text-xs leading-5 text-[#4f5e57]">
                    <strong className="text-[#253c34]">Suggested next action:</strong> {task.suggestedAction}
                  </div>
                ) : null}
                <p className="mt-3 break-all text-[9px] text-[#8a918e]">{task.sourceLabel}</p>
              </div>
            </article>
          ))}
          {!filtered.length ? (
            <div className="paper-panel p-12 text-center">
              <p className="font-editorial text-2xl font-bold text-[#173f36]">No open tasks in this view.</p>
              <p className="mt-2 text-sm text-[#6b756f]">The category remains visible so future dossiers can populate it without changing the interface.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
