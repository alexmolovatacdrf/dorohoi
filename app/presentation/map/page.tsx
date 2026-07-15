import type { Metadata } from "next";
import { MapWorkspace } from "@/components/map/map-workspace";
import { getMapViewModel } from "@/lib/data/selectors";

export const metadata: Metadata = { title: "Presentation Map" };

export default async function PresentationMapPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; place?: string }>;
}) {
  const params = await searchParams;
  const mapData = getMapViewModel();

  return (
    <div className="presentation-page">
      <div className="presentation-page__intro mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-7 lg:px-10">
        <div>
          <p className="text-sm font-black tracking-[0.16em] text-[#a54f32] uppercase">
            Public historical atlas
          </p>
          <h1 className="font-editorial mt-1 text-3xl font-bold text-[#173f36] sm:text-4xl">
            Presentation Map
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-5 text-[#52645c] sm:text-right">
          Explore changing European historical boundaries alongside the documented
          lives and movements connected to Dorohoi.
        </p>
      </div>
      <MapWorkspace
        data={mapData}
        mode="presentation"
        initialPerson={params.person}
        initialPlace={params.place}
      />
    </div>
  );
}
