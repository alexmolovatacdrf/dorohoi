import type { Metadata } from "next";
import { MapWorkspace } from "@/components/map/map-workspace";
import { getMapViewModel } from "@/lib/data/selectors";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; place?: string }>;
}) {
  const params = await searchParams;
  const mapData = getMapViewModel();
  return (
    <div>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-7 lg:px-12">
        <div>
          <p className="text-[9px] font-black tracking-[0.17em] text-[#a54f32] uppercase">Main visualization</p>
          <h1 className="font-editorial mt-1 text-3xl font-bold text-[#173f36]">Evidence map</h1>
        </div>
        <p className="max-w-2xl text-[10px] leading-4 text-[#66736d] sm:text-right">
          Points show places and mentions. Lines show only person-specific movement evidence. The local EHRI overlay and inferred-route registry are off by default.
        </p>
      </div>
      <MapWorkspace data={mapData} initialPerson={params.person} initialPlace={params.place} />
    </div>
  );
}
