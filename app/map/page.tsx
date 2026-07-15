import type { Metadata } from "next";
import Link from "next/link";
import { MapWorkspace } from "@/components/map/map-workspace";
import { CLAUDE_DEMO_SOURCE, getClaudeDemoMapViewModel } from "@/lib/data/claude-demo";
import { getMapViewModel } from "@/lib/data/selectors";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; place?: string; dataset?: string }>;
}) {
  const params = await searchParams;
  const isClaudeDemo = params.dataset === "claude-demo";
  const mapData = isClaudeDemo ? getClaudeDemoMapViewModel() : getMapViewModel();
  const dataSource = isClaudeDemo
    ? CLAUDE_DEMO_SOURCE
    : {
        label: "Project normalized data",
        description: "Current evidence-bound project collections",
        sourceFile: null,
      };
  return (
    <div>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-7 lg:px-12">
        <div>
          <p className="text-sm font-black tracking-[0.17em] text-[#a54f32] uppercase">Main visualization</p>
          <h1 className="font-editorial mt-1 text-3xl font-bold text-[#173f36]">Evidence map</h1>
        </div>
        <p className="max-w-2xl text-sm leading-5 text-[#52645c] sm:text-right">
          Points show places and mentions. Lines show only person-specific movement evidence. The local EHRI overlay and inferred-route registry are off by default.
        </p>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 pb-3 sm:px-7 lg:px-12" aria-label="Map test data">
        <span className="text-xs font-black tracking-[0.12em] text-[#756347] uppercase">Test data</span>
        <Link href="/map" aria-current={!isClaudeDemo ? "page" : undefined} className={`border px-3 py-1.5 text-xs font-bold ${!isClaudeDemo ? "border-[#173f36] bg-[#e4eee8] text-[#173f36]" : "border-[#bdb7aa] bg-white text-[#52645c]"}`}>Project data</Link>
        <Link href="/map?dataset=claude-demo" aria-current={isClaudeDemo ? "page" : undefined} className={`border px-3 py-1.5 text-xs font-bold ${isClaudeDemo ? "border-[#173f36] bg-[#e4eee8] text-[#173f36]" : "border-[#bdb7aa] bg-white text-[#52645c]"}`}>Claude demo</Link>
      </div>
      <MapWorkspace data={mapData} dataSource={dataSource} initialPerson={params.person} initialPlace={params.place} />
    </div>
  );
}
