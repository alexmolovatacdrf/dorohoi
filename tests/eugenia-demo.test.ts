import eugeniaExport from "@/data/demo/eugenia-map-demo.json";
import { EUGENIA_DEMO_SOURCE, getEugeniaDemoMapViewModel } from "@/lib/data/eugenia-demo";
import { describe, expect, it } from "vitest";

describe("Eugenia Presentation Map dataset", () => {
  const data = getEugeniaDemoMapViewModel();

  it("retains both the complete Eugenia table and the verified dossier subset", () => {
    expect(eugeniaExport.metadata.sourceFiles).toHaveLength(2);
    expect(eugeniaExport.dossiers).toHaveLength(16);
    expect(eugeniaExport.eugeniaRows).toHaveLength(52);
    expect(eugeniaExport.dossiers.reduce((total, dossier) => total + dossier.persoane.length, 0)).toBe(65);
    expect(eugeniaExport.dossiers.reduce((total, dossier) => total + dossier.victime.length, 0)).toBe(27);
    expect(EUGENIA_DEMO_SOURCE.sourceFile).toContain("Export_Dosare_Eugenia.xlsx");
    expect(data.persons.filter((person) => person.id.startsWith("eugenia-table-")).length).toBe(52);
    expect(data.groups.filter((group) => group.id.startsWith("EUG-T-")).length).toBe(52);
  });

  it("exposes selectable dossier families and individual mentioned people", () => {
    const dossier2526 = data.groups.find((group) => group.id === "EUG-D-2526");
    expect(dossier2526?.label).toContain("Popsingher Isidor");
    expect(dossier2526?.personIds.length).toBeGreaterThanOrEqual(7);
    expect(data.persons.some((person) => person.label === "Iancu" && person.dossierId === "EUG-D-2526")).toBe(true);
    expect(data.persons.some((person) => person.label === "Clara" && person.roles.includes("victim mentioned"))).toBe(true);
  });

  it("keeps map geometry evidence-bound and does not assign the 2526 family statement to Isidor", () => {
    expect(data.places.filter((place) => place.layer !== "ehri_local").map((place) => place.id)).toEqual([
      "PL-CORE-DOROHOI",
      "PL-CORE-MOHYLIV-PODILSKYI",
    ]);
    expect(data.places.filter((place) => place.layer === "ehri_local")).toHaveLength(385);
    expect(data.routes.some((route) => route.personName === "Popsingher Isidor")).toBe(false);
    expect(data.routes.some((route) => route.personName === "Goldemberg Roza")).toBe(false);
    expect(data.unresolvedMentions.some((mention) => mention.valueRaw.includes("Brăila"))).toBe(true);
  });

  it("includes explicit deportation routes for people whose source gives both endpoints", () => {
    expect(data.routes.length).toBeGreaterThan(0);
    expect(data.routes.every((route) => typeof route.dateRaw !== "number")).toBe(true);
    expect(data.routes.some((route) => route.personName === "Popsingher Iancu" && route.originName === "Dorohoi")).toBe(true);
    expect(data.routes.every((route) => route.routeStatus === "explicit")).toBe(true);
  });

  it("does not duplicate an Eugenia route endpoint in the person-place summary", () => {
    const dorohoi = data.places.find((place) => place.id === "PL-CORE-DOROHOI");
    const hoisieIds = data.persons.filter((person) => person.label === "Hoisie Bercu").map((person) => person.id);
    expect(hoisieIds).toHaveLength(2);
    for (const personId of hoisieIds) {
      const context = dorohoi?.personContexts.find((candidate) => candidate.personId === personId);
      expect(context?.connections).toHaveLength(1);
      expect(context?.connections[0]?.id).toMatch(/^route-/);
    }
  });
});
