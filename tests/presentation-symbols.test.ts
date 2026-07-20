import { describe, expect, it } from "vitest";
import { getEugeniaPresentationMapViewModel } from "@/lib/data/eugenia-presentation";
import { locationTypeForPlace, wjcSymbolSvg } from "@/lib/map/wjc-symbols";

describe("WJC presentation symbols and derived route grammar", () => {
  const viewModel = getEugeniaPresentationMapViewModel();

  it("keeps Dorohoi as the permanent anchor and EHRI place types distinct", () => {
    const dorohoi = viewModel.places.find((place) => place.id === "PL-CORE-DOROHOI");
    const ehriCamp = viewModel.places.find((place) => place.layer === "ehri_local" && place.placeType === "camp");
    const ehriGhetto = viewModel.places.find((place) => place.layer === "ehri_local" && place.placeType === "ghetto");

    expect(dorohoi).toBeDefined();
    expect(dorohoi && locationTypeForPlace(dorohoi)).toBe("anchor");
    expect(ehriCamp && locationTypeForPlace(ehriCamp)).toBe("camp");
    expect(ehriGhetto && locationTypeForPlace(ehriGhetto)).toBe("ghetto");
  });

  it("uses the supplied transport rule without claiming certainty beyond the Dniester", () => {
    const RomaniaTrain = viewModel.routes.find((route) => route.originName === "Rădăuți" && route.destinationName === "Târgu Jiu");
    const beyondDniester = viewModel.routes.find((route) => route.destinationName === "Scazineț");
    const returns = viewModel.routes.filter((route) => route.destinationName === "Dorohoi");

    expect(RomaniaTrain?.transportMode).toBe("train");
    expect(beyondDniester?.transportMode).toBe("unknown");
    expect(returns.length).toBeGreaterThan(0);
    expect(returns.every((route) => route.transportMode === "return")).toBe(true);
  });

  it("renders a reusable selected SVG symbol without replacing the silhouette with a colour-only marker", () => {
    const svg = wjcSymbolSvg("anchor", "#2C5C58", 24, true);

    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke="#4B3D9E"');
    expect(svg).toContain("<circle");
    expect(svg).toContain("<path");
  });
});
