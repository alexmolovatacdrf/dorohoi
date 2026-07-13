import { beforeAll, describe, expect, it } from "vitest";
import { NormalizedBundleSchema, type NormalizedBundle } from "@/lib/domain/schemas";
import { stableJson } from "@/scripts/normalize";
import { PLACE_IDS } from "@/scripts/normalization/core-gazetteer";
import { loadSourceCorpus, type SourceCorpus } from "@/scripts/normalization/load-source";
import { normalizeSourceCorpus } from "@/scripts/normalization/normalize-data";

describe("deterministic dossier normalization", () => {
  let corpus: SourceCorpus;
  let bundle: NormalizedBundle;

  beforeAll(async () => {
    corpus = await loadSourceCorpus();
    bundle = normalizeSourceCorpus(corpus);
  });

  it("validates and imports the complete supplied corpus", () => {
    expect(corpus.dossier2560.persoane).toHaveLength(1);
    expect(corpus.dossier2560.evenimente).toHaveLength(13);
    expect(corpus.dossier2590.persoane).toHaveLength(3);
    expect(corpus.dossier2590.evenimente).toHaveLength(10);
    expect(corpus.ehriPlaces).toHaveLength(385);

    expect(bundle.persons).toHaveLength(4);
    expect(bundle.events).toHaveLength(23);
    expect(bundle.documents).toHaveLength(2);
    expect(bundle.places.filter((place) => place.layer === "ehri_local")).toHaveLength(385);
    expect(() => NormalizedBundleSchema.parse(bundle)).not.toThrow();
  });

  it("returns byte-identical serialization for unchanged input", () => {
    const first = normalizeSourceCorpus(corpus);
    const second = normalizeSourceCorpus(corpus);
    expect(stableJson(first)).toBe(stableJson(second));
  });

  it("adds the evidence envelope to every generated record", () => {
    for (const collection of Object.values(bundle)) {
      for (const record of collection) {
        expect(record.id).toBeTruthy();
        expect(record.sourceRefs.length).toBeGreaterThan(0);
        expect(record).toHaveProperty("raw");
        expect(record).toHaveProperty("normalized");
        expect(record).toHaveProperty("confidence");
        expect(record).toHaveProperty("assertionStatus");
        expect(record).toHaveProperty("reviewState");
        expect(record).toHaveProperty("alternativeReadings");
      }
    }
  });

  it("creates exactly the two explicit Ițic Herțanu pilot legs", () => {
    const routes = bundle.routeSegments.filter((route) => route.personId === "P-2560-001");
    expect(routes).toHaveLength(2);
    expect(routes.map((route) => [route.originPlaceId, route.destinationPlaceId])).toEqual([
      [PLACE_IDS.mihaileni, PLACE_IDS.bucecea],
      [PLACE_IDS.bucecea, PLACE_IDS.dorohoi],
    ]);
    expect(routes[0]).toMatchObject({
      routeStatus: "explicit",
      transportRaw: "pe jos",
      date: { start: "1941-06-19", end: "1941-06-19" },
    });
    expect(routes[1]).toMatchObject({
      routeStatus: "explicit",
      reviewState: "needs_review",
      date: { start: "1941-07-04", end: "1941-07-04" },
    });
  });

  it("preserves the Bucecea/Burdujeni contradiction without geocoding the alternative", () => {
    const route = bundle.routeSegments.find((item) => item.routeSegmentId === "RS-2560-002");
    const place = bundle.places.find((item) => item.placeId === PLACE_IDS.burdujeni);
    const mention = bundle.placeMentions.find(
      (item) => item.placeMentionId === "PM-E-2560-003-ORIGIN-FRAGMENT",
    );
    const task = bundle.reviewTasks.find(
      (item) => item.reviewTaskId === "RT-2560-BUCECEA-BURDUJENI",
    );

    expect(route?.originPlaceId).toBe(PLACE_IDS.bucecea);
    expect(route?.alternativeReadings).toHaveLength(1);
    expect(place).toMatchObject({ coordinates: null, resolutionStatus: "unresolved" });
    expect(mention).toMatchObject({ valueRaw: "Burdujeni", placeId: PLACE_IDS.burdujeni });
    expect(task?.category).toBe("contradiction");
  });

  it("represents Iancu Aizic's documented sequence only as partial legs", () => {
    const routes = bundle.routeSegments.filter((route) => route.personId === "P-2590-001");
    expect(routes).toHaveLength(2);
    expect(routes.map((route) => [route.originPlaceId, route.destinationPlaceId])).toEqual([
      [PLACE_IDS.dorohoi, PLACE_IDS.otaci],
      [PLACE_IDS.otaci, PLACE_IDS.mohyliv],
    ]);
    expect(routes.every((route) => route.routeStatus === "partial")).toBe(true);
    expect(routes.every((route) => route.lineStyle === "dashed")).toBe(true);
  });

  it("keeps Tropov unresolved and never creates a segment to it", () => {
    const unresolved = bundle.places.find((place) => place.placeId === PLACE_IDS.tropov);
    const mention = bundle.placeMentions.find(
      (item) => item.valueRaw === "Tropov[...]" && item.ownerType === "event",
    );
    const touchesUnresolved = bundle.routeSegments.some(
      (route) =>
        route.originPlaceId === PLACE_IDS.tropov || route.destinationPlaceId === PLACE_IDS.tropov,
    );

    expect(unresolved).toMatchObject({
      normalizedName: null,
      coordinates: null,
      coordinateSource: null,
      resolutionStatus: "unresolved",
    });
    expect(mention).toMatchObject({
      placeId: PLACE_IDS.tropov,
      resolutionStatus: "unresolved",
    });
    expect(touchesUnresolved).toBe(false);
  });

  it("does not propagate Iancu Aizic's route to Pesi or Marica", () => {
    const marica = bundle.persons.find((person) => person.personId === "P-2590-002");
    const pesi = bundle.persons.find((person) => person.personId === "P-2590-003");
    const death = bundle.events.find((event) => event.eventId === "E-2590-010");
    const deathMention = bundle.placeMentions.find(
      (mention) => mention.placeMentionId === "PM-E-2590-010-LOCATION",
    );

    expect(marica?.routeSegmentIds).toEqual([]);
    expect(pesi?.routeSegmentIds).toEqual([]);
    expect(bundle.routeSegments.some((route) => route.personId === "P-2590-002")).toBe(false);
    expect(bundle.routeSegments.some((route) => route.personId === "P-2590-003")).toBe(false);
    expect(death).toMatchObject({
      eventType: "deces",
      participantIds: ["P-2590-003"],
      date: { start: "1942-02-08", end: "1942-02-08" },
    });
    expect(deathMention).toMatchObject({ placeId: PLACE_IDS.mohyliv, personIds: ["P-2590-003"] });
  });

  it("keeps place mentions independent from routes", () => {
    expect(bundle.placeMentions.length).toBeGreaterThan(bundle.routeSegments.length);
    expect(bundle.routeSegments).toHaveLength(4);
    expect(bundle.routeSegments.some((route) => route.originPlaceId === PLACE_IDS.jijia)).toBe(false);
    expect(bundle.routeSegments.some((route) => route.destinationPlaceId === PLACE_IDS.jijia)).toBe(false);
    expect(bundle.places.find((place) => place.placeId === PLACE_IDS.jijia)).toMatchObject({
      coordinates: null,
      resolutionStatus: "partially_resolved",
    });
  });

  it("retains uncertain names and relationships as reviewable evidence", () => {
    const marica = bundle.persons.find((person) => person.personId === "P-2590-002");
    const alternative = bundle.personNameVariants.find(
      (variant) => variant.variantId === "PNV-P-2590-002-ALT-01",
    );
    const spouse = bundle.relationships.find(
      (relationship) => relationship.relationshipId === "R-2590-001",
    );

    expect(marica).toMatchObject({ displayName: "Marica Chibac", reviewState: "needs_review" });
    expect(marica?.alternativeReadings[0]?.value).toBe("Marica Aizic");
    expect(alternative).toMatchObject({ value: "Marica Aizic", assertionStatus: "unresolved" });
    expect(spouse).toMatchObject({
      relationshipType: "spouse",
      confidence: "medium",
      reviewState: "needs_review",
    });
  });

  it("imports EHRI record-for-record without silently merging catalog places", () => {
    const ehri = bundle.places.filter((place) => place.layer === "ehri_local");
    const coreMohyliv = bundle.places.find((place) => place.placeId === PLACE_IDS.mohyliv);
    const ehriMohyliv = bundle.places.find((place) => place.placeId === "PL-EHRI-0382");
    const qualityTask = bundle.reviewTasks.find(
      (task) => task.reviewTaskId === "RT-EHRI-CATALOG-QUALITY",
    );

    expect(ehri).toHaveLength(385);
    expect(coreMohyliv?.relatedPlaceIds).toContain("PL-EHRI-0382");
    expect(ehriMohyliv?.relatedPlaceIds).toContain(PLACE_IDS.mohyliv);
    expect(ehriMohyliv?.placeId).not.toBe(coreMohyliv?.placeId);
    expect(qualityTask?.category).toBe("external_catalog_quality");
  });
});
