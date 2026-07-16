import eugeniaPresentation from "@/data/normalized/eugenia-presentation.json";
import { isReadableEhriMapLabel } from "@/lib/data/ehri-labels";
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
      "Mohyliv-Podilskyi",
      "Scazineț",
      "Pecioara",
      "Tulcin",
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

  it("sorts people alphabetically and gives region-only Transnistria rows a derived map endpoint", () => {
    const labels = data.persons.map((person) => person.label);
    expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right, "ro")));

    const transnistriaRoutes = data.routes.filter((route) => route.destinationName.includes("Transnistria"));
    expect(transnistriaRoutes.length).toBe(4);
    expect(data.places.find((place) => place.id === "PL-CORE-TRANSNISTRIA")?.coordinates).toEqual({
      latitude: 47.6245710692,
      longitude: 29.8991366689,
    });
    for (const route of transnistriaRoutes) {
      const personRoutes = data.routes.filter((candidate) => candidate.personId === route.personId);
      expect(personRoutes.at(-1)?.destinationName).toBe("Dorohoi");
    }
  });

  it("bridges unresolved intermediary stops between known route endpoints and returns to Dorohoi", () => {
    const ciobotaru = data.routes.filter((route) => route.personName === "Ciobotaru Marcu");
    expect(ciobotaru.map((route) => route.destinationName)).toEqual([
      "Mohyliv-Podilskyi",
      "Dorohoi",
    ]);
    expect(ciobotaru[0]?.routeStatus).toBe("partial");

    for (const personName of ["Cojocaru Sloim", "Roizen Bety"]) {
      const routes = data.routes.filter((route) => route.personName === personName);
      expect(routes.at(-1)?.destinationName).toBe("Dorohoi");
    }
  });

  it("uses the explicit Darabani origin and the Transnistria deportation date for the first movement", () => {
    const routes = data.routes
      .filter((route) => route.personName === "Cojocaru Sloim")
      .sort((left, right) => left.sequence - right.sequence);

    expect(routes.map((route) => [route.originName, route.destinationName])).toEqual([
      ["Darabani", "Târgu Jiu"],
      ["Târgu Jiu", "Mohyliv-Podilskyi"],
      ["Mohyliv-Podilskyi", "Dorohoi"],
    ]);
    expect(routes[0]?.dateRaw).toBe("01/06/1941");
    expect(routes[1]?.dateRaw).toBe("01/10/1941");
    expect(routes[0]?.routeStatus).toBe("explicit");
  });

  it("uses intermediary dates before the Transnistria deportation date", () => {
    const goldenberg = data.routes
      .filter((route) => route.personName === "Goldenberg Roza")
      .sort((left, right) => left.sequence - right.sequence);
    const zissman = data.routes
      .filter((route) => route.personName === "Zissman Eva")
      .sort((left, right) => left.sequence - right.sequence);

    expect(goldenberg.map((route) => route.dateRaw)).toEqual(["12/11/1941", null]);
    expect(zissman.map((route) => route.dateRaw)).toEqual(["01/07/1941", "01/10/1941", null]);
    expect(data.routes.some((route) => route.personName === "Cohn Eti" && route.destinationName === "Sharhorod")).toBe(true);
    expect(data.routes.some((route) => route.destinationName === "Edineț")).toBe(true);
  });

  it("does not expose the old verified-transcript wording in dossier labels", () => {
    expect(data.dossiers.every((dossier) => !dossier.label.includes("verified transcript"))).toBe(true);
    expect(data.dossiers.find((dossier) => dossier.id === "EUG-P-2527")?.label).toBe("Dossier 2527");
  });

  it("uses compact public Latin-script labels for every EHRI point", () => {
    const ehri = data.places.filter((place) => place.layer === "ehri_local");
    expect(ehri).toHaveLength(385);
    expect(ehri.every((place) => isReadableEhriMapLabel(place.label))).toBe(true);
    expect(data.places.find((place) => place.id === "PL-EHRI-0233")?.label).toBe("Rădăuți-Prut");
    expect(data.places.find((place) => place.id === "PL-EHRI-0383")?.label).toBe("Cernăuți");
    expect(data.places.find((place) => place.id === "PL-EHRI-0382")?.label).toBe("Mohyliv-Podilskyi");
    expect(ehri.every((place) => !/\b(?:ghetto|getto|ghetou|camp|lagar|lagăr)\b/i.test(place.label))).toBe(true);
  });
});
