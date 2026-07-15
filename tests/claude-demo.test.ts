import { describe, expect, it } from "vitest";
import { CLAUDE_DEMO_SOURCE, getClaudeDemoMapViewModel } from "@/lib/data/claude-demo";

describe("Claude map demo fixture", () => {
  it("keeps the downloaded prototype data separate and traceable", () => {
    const data = getClaudeDemoMapViewModel();

    expect(CLAUDE_DEMO_SOURCE.sourceFile).toBe("Platforma_WJC (10).html");
    expect(CLAUDE_DEMO_SOURCE.sourceSha256).toHaveLength(64);
    expect(data.persons).toHaveLength(48);
    expect(data.dossiers).toHaveLength(11);
    expect(data.places).toHaveLength(15);
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
});
