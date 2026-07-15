import { describe, expect, it } from "vitest";
import { CLAUDE_DEMO_SOURCE, getClaudeDemoMapViewModel } from "@/lib/data/claude-demo";

describe("Claude map demo fixture", () => {
  it("keeps the downloaded prototype data separate and traceable", () => {
    const data = getClaudeDemoMapViewModel();

    expect(CLAUDE_DEMO_SOURCE.sourceFile).toBe("Platforma_WJC (10).html");
    expect(CLAUDE_DEMO_SOURCE.sourceSha256).toHaveLength(64);
    expect(data.persons).toHaveLength(48);
    expect(data.dossiers).toHaveLength(11);
    expect(data.places.filter((place) => place.layer === "core")).toHaveLength(15);
    expect(data.places.filter((place) => place.layer === "ehri_local")).toHaveLength(385);
    expect(data.routes).toHaveLength(26);
  });

  it("retains dossier roles and individual route ownership for playback", () => {
    const data = getClaudeDemoMapViewModel();
    const roza = data.persons.find((person) => person.label === "Goldemberg Roza");

    expect(roza?.roles).toContain("cap de familie");
    expect(roza?.dossierId).toBe("claude-dossier-2534_2");
    expect(data.groups.find((group) => group.label.startsWith("Goldemberg Roza"))?.personIds).toContain(roza?.id);
    expect(data.routes.filter((route) => route.personId === roza?.id).length).toBeGreaterThan(0);
    expect(data.routes.find((route) => route.personId === roza?.id)?.dossierId).toBe(roza?.dossierId);
    expect(data.routes.every((route) => route.sourceLabel.includes("Claude demo"))).toBe(true);
    expect(data.places.every((place) => place.personContexts.length === place.personIds.length)).toBe(true);
  });

  it("exposes source-bound profile chronology for the central person story", () => {
    const data = getClaudeDemoMapViewModel();
    const roza = data.persons.find((person) => person.label === "Goldemberg Roza");

    expect(roza?.story?.profile).toMatchObject({
      birthDate: { precision: "year", start: "1894-01-01" },
      studies: "4 clase primare",
      origin: "Zvorâștea",
      destination: "Șargorod",
      fate: "deportat",
    });
    expect(roza?.story?.timeline.map((item) => item.label)).toEqual([
      "Birth / origin",
      "Evacuation / deportation",
      "Evacuation / deportation",
      "Evacuation / deportation",
      "Return / repatriation",
    ]);
    const zvorastea = data.places.find((place) => place.label === "Zvorâștea");
    expect(zvorastea?.personContexts.find((context) => context.personId === roza?.id)?.connections[0]).toMatchObject({
      roles: ["Birth / origin"],
      date: { precision: "year", start: "1894-01-01" },
    });
  });
});
