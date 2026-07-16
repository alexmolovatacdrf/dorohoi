import eugeniaPresentation from "@/data/normalized/eugenia-presentation.json";
import { EUGENIA_PRESENTATION_SOURCE, getEugeniaPresentationMapViewModel } from "@/lib/data/eugenia-presentation";
import { describe, expect, it } from "vitest";

describe("verified Eugenia Presentation Map dataset", () => {
  const data = getEugeniaPresentationMapViewModel();

  it("contains only the 20 source rows and only Row 1 red columns", () => {
    expect(eugeniaPresentation.metadata.rowCount).toBe(20);
    expect(eugeniaPresentation.rows).toHaveLength(20);
    expect(eugeniaPresentation.metadata.selectedColumns).toHaveLength(15);
    expect(eugeniaPresentation.metadata.selectedColumns.map((column) => column.column)).toEqual([
      "A", "C", "E", "G", "I", "K", "M", "O", "Q", "R", "T", "W", "AE", "AF", "AH",
    ]);
    expect(EUGENIA_PRESENTATION_SOURCE.sourceFile).toBe("Tabel_Verde_Comparativ_16072026_0835.xlsx");
  });

  it("exposes one table person per dossier and keeps mentioned family people grouped below them", () => {
    expect(data.groups).toHaveLength(20);
    expect(data.dossiers).toHaveLength(20);
    expect(data.persons.filter((person) => person.roles.includes("family head / dossier respondent"))).toHaveLength(20);
    expect(data.groups.find((group) => group.id === "EUG-P-2532")?.personIds.length).toBe(3);
    expect(data.persons.some((person) => person.label === "Clara")).toBe(true);
    expect(data.persons.some((person) => person.label === "Bianca")).toBe(true);
    expect(data.persons.every((person) => !person.id.startsWith("eugenia-dossier-"))).toBe(true);
  });

  it("uses birth place when Deported from is blank and preserves unresolved raw places", () => {
    const fallbackPeople = ["Roizen Tili", "Roizen Bety", "Ancel Maria", "Zissman Eva"];
    for (const personName of fallbackPeople) {
      expect(data.routes.some((route) => route.personName === personName && route.routeStatus === "partial")).toBe(true);
    }
    expect(data.routes.some((route) => route.personName === "Roizen Tili" && route.originName === "Rădăuți")).toBe(true);
    expect(data.routes.some((route) => route.personName === "Roizen Bety" && route.originName === "Dumbrăveni")).toBe(true);
    expect(data.routes.some((route) => route.personName === "Ancel Maria" && route.originName === "Herța")).toBe(true);
    expect(data.routes.some((route) => route.personName === "Zissman Eva" && route.originName === "Rădăuți-Prut")).toBe(true);
    expect(data.routes.some((route) => route.personName === "Poplicher Iancu" && route.originName === "Dorohoi")).toBe(true);
    expect(data.unresolvedMentions.some((mention) => mention.valueRaw === "Tropova")).toBe(true);
  });

  it("keeps multiple Deported to locations in source order", () => {
    const bacaluRoutes = data.routes
      .filter((route) => route.personName === "Bacalu Avram Moise" && route.eventTypes.includes("deportation"))
      .sort((left, right) => left.sequence - right.sequence);
    expect(bacaluRoutes.map((route) => route.destinationName)).toEqual([
      "Mohyliv-Podilskyi (Moghilev)",
      "Scazineţ concentration camp",
      "Pecioara concentration camp",
      "Tulcin concentration camp",
    ]);
    expect(bacaluRoutes.map((route) => route.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("adds the requested Dorohoi presentation endpoint after each drawable route", () => {
    const routes = data.routes.filter((route) => route.personName === "Bacalu Avram Moise").sort((left, right) => left.sequence - right.sequence);
    const returnRoute = routes.at(-1);
    expect(returnRoute?.destinationName).toBe("Dorohoi");
    expect(returnRoute?.routeStatus).toBe("inferred");
    expect(returnRoute?.eventTypes).toEqual(["return"]);
    expect(returnRoute?.notes).toContain("source table does not supply a return date");
  });

  it("does not expose the old verified-transcript wording in dossier labels", () => {
    expect(data.dossiers.every((dossier) => !dossier.label.includes("verified transcript"))).toBe(true);
    expect(data.dossiers.find((dossier) => dossier.id === "EUG-P-2527")?.label).toBe("Dossier 2527");
  });
});
