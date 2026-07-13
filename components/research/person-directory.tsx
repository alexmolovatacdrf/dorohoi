"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge, confidenceTone, reviewTone } from "@/components/ui/status-badge";

export interface PersonListItem {
  id: string;
  name: string;
  birthLabel: string;
  dossierId: string;
  roles: string[];
  confidence: string;
  reviewState: string;
  eventCount: number;
  routeCount: number;
  relationshipCount: number;
  places: string[];
}

export function PersonDirectory({
  people,
  initialQuery = "",
  initialDossier = "all",
}: {
  people: PersonListItem[];
  initialQuery?: string;
  initialDossier?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [dossier, setDossier] = useState(initialDossier);
  const [role, setRole] = useState("all");
  const roles = useMemo(() => [...new Set(people.flatMap((person) => person.roles))].sort(), [people]);
  const dossiers = useMemo(() => [...new Set(people.map((person) => person.dossierId))].sort(), [people]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ro");
    return people.filter((person) => {
      const matchesText = !needle || [person.name, person.dossierId, ...person.roles, ...person.places].join(" ").toLocaleLowerCase("ro").includes(needle);
      const matchesDossier = dossier === "all" || person.dossierId === dossier;
      const matchesRole = role === "all" || person.roles.includes(role);
      return matchesText && matchesDossier && matchesRole;
    });
  }, [dossier, people, query, role]);

  return (
    <div>
      <div className="paper-panel mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_14rem_auto]">
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Search names, roles, places</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Aizic, deportat, Moghilev" className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2f6658]" />
        </label>
        <label>
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Dossier</span>
          <select value={dossier} onChange={(event) => setDossier(event.target.value)} className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm">
            <option value="all">All dossiers</option>
            {dossiers.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Document role</span>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm">
            <option value="all">All roles</option>
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { setQuery(""); setDossier("all"); setRole("all"); }} className="self-end border border-[#a9aaa4] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] uppercase hover:bg-[#ede9df]">
          Clear
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-[#65716b]">
        <span><strong className="text-[#20372f]">{filtered.length}</strong> of {people.length} persons</span>
        <span>Person-level identities; no automatic merges</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((person) => (
          <Link key={person.id} href={`/persons/${person.id}`} className="paper-panel group grid gap-4 p-5 transition hover:border-[#80968e] sm:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black tracking-[0.14em] text-[#9b5b3f] uppercase">{person.dossierId}</span>
                <StatusBadge tone={confidenceTone(person.confidence)}>{person.confidence}</StatusBadge>
                {person.reviewState === "needs_review" ? <StatusBadge tone={reviewTone(person.reviewState)}>review</StatusBadge> : null}
              </div>
              <h2 className="font-editorial mt-2 text-3xl font-bold text-[#173f36] group-hover:text-[#9d5035]">{person.name}</h2>
              <p className="mt-1 text-xs text-[#6b756f]">Born {person.birthLabel}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {person.roles.map((item) => <span key={item} className="border border-[#d6d1c6] bg-[#f3efe6] px-2 py-1 text-[9px] font-bold text-[#596660]">{item}</span>)}
              </div>
              {person.places.length ? <p className="mt-4 line-clamp-2 text-xs leading-5 text-[#65716b]">Places: {person.places.join(" · ")}</p> : null}
            </div>
            <div className="flex min-w-24 items-end justify-between gap-3 border-t border-[#ddd7ca] pt-3 text-center sm:flex-col sm:items-stretch sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
              <span><strong className="font-editorial block text-xl text-[#173f36]">{person.eventCount}</strong><small className="text-[8px] font-black tracking-[0.1em] text-[#7b847f] uppercase">Events</small></span>
              <span><strong className="font-editorial block text-xl text-[#173f36]">{person.routeCount}</strong><small className="text-[8px] font-black tracking-[0.1em] text-[#7b847f] uppercase">Routes</small></span>
              <span><strong className="font-editorial block text-xl text-[#173f36]">{person.relationshipCount}</strong><small className="text-[8px] font-black tracking-[0.1em] text-[#7b847f] uppercase">Relations</small></span>
            </div>
          </Link>
        ))}
      </div>

      {!filtered.length ? <div className="paper-panel p-10 text-center text-sm text-[#68736e]">No people match the current filters.</div> : null}
    </div>
  );
}
