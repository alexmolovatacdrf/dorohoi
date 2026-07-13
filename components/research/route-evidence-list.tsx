import Link from "next/link";
import { ProvenanceList } from "./provenance-list";
import { StatusBadge, confidenceTone } from "@/components/ui/status-badge";
import { formatDateRange } from "@/lib/data/format";
import type { Place, RouteSegment } from "@/lib/domain/schemas";

export function RouteEvidenceList({ routes, places }: { routes: RouteSegment[]; places: Place[] }) {
  const byId = new Map(places.map((place) => [place.placeId, place]));
  if (!routes.length) {
    return <div className="border border-dashed border-[#bcb6aa] bg-[#eee9df]/60 p-6 text-sm text-[#68736e]">No person-specific route is documented in the current source.</div>;
  }
  return (
    <div className="space-y-3">
      {routes.map((route) => {
        const origin = byId.get(route.originPlaceId);
        const destination = byId.get(route.destinationPlaceId);
        return (
          <article key={route.routeSegmentId} className="paper-panel p-5">
            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
              <span className={`grid size-11 place-items-center rounded-full border-2 font-editorial text-lg font-bold ${route.routeStatus === "explicit" ? "border-[#2f6658] text-[#2f6658]" : "border-dashed border-[#a06645] text-[#a06645]"}`}>
                {route.sequence}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={route.routeStatus === "explicit" ? "green" : "gold"}>{route.routeStatus}</StatusBadge>
                  <StatusBadge tone={confidenceTone(route.confidence)}>{route.confidence} confidence</StatusBadge>
                  <span className="text-[9px] font-bold text-[#7d8681]">{formatDateRange(route.date)}</span>
                </div>
                <h3 className="font-editorial mt-2 text-2xl font-bold text-[#173f36]">
                  <Link href={`/places/${route.originPlaceId}`} className="hover:text-[#a54f32]">{origin?.displayNames.en ?? route.originPlaceId}</Link>
                  <span className="mx-3 text-[#a54f32]">→</span>
                  <Link href={`/places/${route.destinationPlaceId}`} className="hover:text-[#a54f32]">{destination?.displayNames.en ?? route.destinationPlaceId}</Link>
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#62706a]">{route.transportRaw ? `Transport: ${route.transportRaw}. ` : ""}{route.notes}</p>
              </div>
              <span className={`h-1 w-full min-w-20 md:w-28 ${route.lineStyle === "solid" ? "bg-[#2f6658]" : "border-t-2 border-dashed border-[#a06645]"}`} aria-label={`${route.lineStyle} route line`} />
            </div>
            <div className="mt-4">
              <ProvenanceList sourceRefs={route.sourceRefs} raw={route.raw} alternatives={route.alternativeReadings} label="Route evidence & alternatives" />
            </div>
          </article>
        );
      })}
    </div>
  );
}
