import type { Metadata } from "next";
import { MapWorkspace } from "@/components/map/map-workspace";
import { EUGENIA_PRESENTATION_SOURCE, getEugeniaPresentationMapViewModel } from "@/lib/data/eugenia-presentation";

export const metadata: Metadata = { title: { absolute: "Jews Repatriated to Dorohoi" } };

export default async function PresentationMapPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; place?: string }>;
}) {
  const params = await searchParams;
  const mapData = getEugeniaPresentationMapViewModel();
  const dataSource = { ...EUGENIA_PRESENTATION_SOURCE, supportsResearchRecords: false };

  return (
    <div className="presentation-page">
      <MapWorkspace
        data={mapData}
        mode="presentation"
        dataSource={dataSource}
        initialPerson={params.person}
        initialPlace={params.place}
      />
    </div>
  );
}
