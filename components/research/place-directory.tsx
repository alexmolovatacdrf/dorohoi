"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge, reviewTone } from "@/components/ui/status-badge";

export interface PlaceListItem {
  id: string;
  name: string;
  originalName: string;
  variants: string[];
  placeType: string;
  layer: string;
  resolutionStatus: string;
  confidence: string;
  reviewState: string;
  personCount: number;
  eventCount: number;
  incomingCount: number;
  outgoingCount: number;
  coordinates: string | null;
}

export function PlaceDirectory({
  places,
  initialLayer = "research",
  initialResolution = "all",
}: {
  places: PlaceListItem[];
  initialLayer?: string;
  initialResolution?: string;
}) {
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState(initialLayer);
  const [resolution, setResolution] = useState(initialResolution);
  const [type, setType] = useState("all");
  const types = useMemo(() => [...new Set(places.map((place) => place.placeType))].sort(), [places]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ro");
    return places.filter((place) => {
      const matchesText = !needle || [place.name, place.originalName, ...place.variants].join(" ").toLocaleLowerCase("ro").includes(needle);
      const matchesLayer = layer === "all" || (layer === "research" ? place.layer !== "ehri_local" : place.layer === layer);
      const matchesResolution = resolution === "all" || place.resolutionStatus === resolution;
      const matchesType = type === "all" || place.placeType === type;
      return matchesText && matchesLayer && matchesResolution && matchesType;
    });
  }, [layer, places, query, resolution, type]);

  return (
    <div>
      <div className="paper-panel mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_13rem_13rem_13rem_auto]">
        <label>
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Search names and variants</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Ataki, Moghilev, ghetto" className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2f6658]" />
        </label>
        <label>
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Dataset layer</span>
          <select value={layer} onChange={(event) => setLayer(event.target.value)} className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm">
            <option value="research">Research core</option>
            <option value="ehri_local">Local EHRI</option>
            <option value="unresolved">Unresolved only</option>
            <option value="all">All places</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Resolution</span>
          <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm">
            <option value="all">All statuses</option>
            <option value="resolved">Resolved</option>
            <option value="partially_resolved">Partially resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[9px] font-black tracking-[0.13em] text-[#5e6c66] uppercase">Place type</span>
          <select value={type} onChange={(event) => setType(event.target.value)} className="w-full border border-[#c9c4b8] bg-white px-3 py-2.5 text-sm">
            <option value="all">All types</option>
            {types.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { setQuery(""); setLayer("research"); setResolution("all"); setType("all"); }} className="self-end border border-[#a9aaa4] px-4 py-2.5 text-[10px] font-black tracking-[0.1em] uppercase hover:bg-[#ede9df]">Clear</button>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#65716b]">
        <span><strong className="text-[#20372f]">{filtered.length}</strong> of {places.length} place records</span>
        <span>EHRI records remain separate even when names or coordinates coincide.</span>
      </div>

      <div className="paper-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="research-table min-w-[780px]">
            <thead>
              <tr>
                <th>Name / variants</th>
                <th>Type</th>
                <th>Resolution</th>
                <th>Connections</th>
                <th>Coordinates</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((place) => (
                <tr key={place.id} className="transition hover:bg-[#f5f1e8]">
                  <td>
                    <Link href={`/places/${place.id}`} className="font-editorial text-lg font-bold text-[#173f36] hover:text-[#a54f32]">{place.name}</Link>
                    <p className="mt-1 max-w-lg text-[10px] leading-4 text-[#78817c]">{place.variants.slice(0, 4).join(" · ") || "No supplied variants"}</p>
                  </td>
                  <td>
                    <StatusBadge tone={place.layer === "ehri_local" ? "blue" : "green"}>{place.placeType}</StatusBadge>
                    <p className="mt-1 text-[9px] font-bold tracking-[0.08em] text-[#7a837f] uppercase">{place.layer.replaceAll("_", " ")}</p>
                  </td>
                  <td>
                    <StatusBadge tone={place.resolutionStatus === "unresolved" ? "rust" : place.resolutionStatus === "partially_resolved" ? "gold" : "green"}>{place.resolutionStatus.replaceAll("_", " ")}</StatusBadge>
                    {place.reviewState === "needs_review" ? <div className="mt-1"><StatusBadge tone={reviewTone(place.reviewState)}>review</StatusBadge></div> : null}
                  </td>
                  <td className="text-xs leading-5 text-[#52605a]">
                    {place.personCount} people · {place.eventCount} events<br />
                    {place.incomingCount} in / {place.outgoingCount} out
                  </td>
                  <td className="font-mono text-[10px] text-[#5d6b64]">{place.coordinates ?? "not assigned"}</td>
                  <td><Link aria-label={`Open ${place.name}`} href={`/places/${place.id}`} className="text-lg text-[#a54f32]">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <div className="p-10 text-center text-sm text-[#68736e]">No place records match the current filters.</div> : null}
      </div>
    </div>
  );
}
