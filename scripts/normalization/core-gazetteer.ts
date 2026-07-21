import type { Place, SourceReference } from "../../lib/domain/schemas";
import { curatedSourceRef, dossierSourceRef, SOURCE_FILES } from "./evidence";

const ACCESSED = "2026-07-13";

const coreDefinitions: Array<{
  placeId: string;
  dossierId: string | null;
  originalName: string;
  normalizedName: string | null;
  displayNames: { en: string; ro: string };
  variants: string[];
  placeType: Place["placeType"];
  coordinates: Place["coordinates"];
  coordinateSource: Place["coordinateSource"];
  coordinateConfidence: Place["coordinateConfidence"];
  resolutionStatus: Place["resolutionStatus"];
  layer: Place["layer"];
  reviewState: Place["reviewState"];
  assertionStatus: Place["assertionStatus"];
  confidence: Place["confidence"];
  dossierRefs: SourceReference[];
  relatedPlaceIds?: string[];
}> = [
  {
    placeId: "PL-CORE-DOROHOI",
    dossierId: null,
    originalName: "Dorohoi",
    normalizedName: "Dorohoi",
    displayNames: { en: "Dorohoi", ro: "Dorohoi" },
    variants: ["Dorohoi, beciul poliției"],
    placeType: "settlement",
    coordinates: { latitude: 47.95, longitude: 26.4 },
    coordinateSource: {
      label: "GeoNames — Dorohoi",
      url: "https://www.geonames.org/679065/dorohoi.html",
      accessed: ACCESSED,
      sourceRecordId: "679065",
    },
    coordinateConfidence: "high",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2560, "DOROHOI-2560", "locuri_mentionate"),
      dossierSourceRef(SOURCE_FILES.dossier2590, "DOROHOI-2590", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-MIHAILENI",
    dossierId: "DOROHOI-2560",
    originalName: "Mihăileni jud. Dorohoi",
    normalizedName: "Mihăileni",
    displayNames: { en: "Mihăileni", ro: "Mihăileni" },
    variants: ["Mihăileni", "Mihaileni"],
    placeType: "settlement",
    coordinates: { latitude: 47.967, longitude: 26.133 },
    coordinateSource: {
      label: "Wikidata/Wikipedia — Mihăileni, Botoșani",
      url: "https://en.wikipedia.org/wiki/Mih%C4%83ileni%2C_Boto%C8%99ani",
      accessed: ACCESSED,
      sourceRecordId: "Mihăileni, Botoșani",
    },
    coordinateConfidence: "medium",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2560, "DOROHOI-2560", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-BUCECEA",
    dossierId: "DOROHOI-2560",
    originalName: "Bucecea",
    normalizedName: "Bucecea",
    displayNames: { en: "Bucecea", ro: "Bucecea" },
    variants: ["Bucsecsea"],
    placeType: "settlement",
    coordinates: { latitude: 47.77265, longitude: 26.43977 },
    coordinateSource: {
      label: "OpenStreetMap — Bucecea",
      url: "https://www.openstreetmap.org/node/2043991244",
      accessed: ACCESSED,
      sourceRecordId: "node/2043991244",
    },
    coordinateConfidence: "high",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2560, "DOROHOI-2560", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-OTACI",
    dossierId: "DOROHOI-2590",
    originalName: "Ataki",
    normalizedName: "Otaci",
    displayNames: { en: "Otaci (Ataki)", ro: "Otaci (Ataki)" },
    variants: ["Ataki", "Otaci", "Otach-Tyrg", "Атаки"],
    placeType: "settlement",
    coordinates: { latitude: 48.432847, longitude: 27.799124 },
    coordinateSource: {
      label: "GeoNames — Otaci / Ataki",
      url: "https://www.geonames.org/search.html?country=MD&q=Ocni%C8%9Ba%2C+Raionul",
      accessed: ACCESSED,
      sourceRecordId: "Otaci",
    },
    coordinateConfidence: "high",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2590, "DOROHOI-2590", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-MOHYLIV-PODILSKYI",
    dossierId: "DOROHOI-2590",
    originalName: "Moghilev",
    normalizedName: "Mohyliv-Podilskyi",
    // Keep the historical/documentary Romanian form on the public map. The
    // modern Ukrainian name remains the normalized identity and a search
    // variant, so the two naming layers are not conflated.
    displayNames: { en: "Moghilev", ro: "Moghilev" },
    variants: ["Moghilev", "Mogilev-Podolsk", "Moghilău", "Mohyliv-Podilskyi"],
    placeType: "settlement",
    coordinates: { latitude: 48.44278, longitude: 27.79975 },
    coordinateSource: {
      label: "GeoNames — Mohyliv-Podilskyi",
      url: "https://www.geonames.org/search.html?country=UA&q=Vinnytska",
      accessed: ACCESSED,
      sourceRecordId: "Mohyliv-Podilskyi",
    },
    coordinateConfidence: "high",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2590, "DOROHOI-2590", "locuri_mentionate"),
    ],
    relatedPlaceIds: ["PL-EHRI-0382"],
  },
  {
    placeId: "PL-CORE-JIJIA",
    dossierId: "DOROHOI-2560",
    originalName: "Jijia",
    normalizedName: "Jijia River",
    displayNames: { en: "Jijia River (exact bridge unresolved)", ro: "Râul Jijia (pod neidentificat)" },
    variants: ["Jijia", "râul Jijia"],
    placeType: "river",
    coordinates: null,
    coordinateSource: null,
    coordinateConfidence: "unknown",
    resolutionStatus: "partially_resolved",
    layer: "core",
    reviewState: "needs_review",
    assertionStatus: "partial",
    confidence: "medium",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2560, "DOROHOI-2560", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-TRANSNISTRIA",
    dossierId: "DOROHOI-2590",
    originalName: "Transnistria",
    normalizedName: "Transnistria Governorate (historical region)",
    displayNames: { en: "Transnistria (historical region)", ro: "Transnistria (regiune istorică)" },
    variants: ["Transnistria"],
    placeType: "historical_region",
    coordinates: null,
    coordinateSource: null,
    coordinateConfidence: "unknown",
    resolutionStatus: "partially_resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "partial",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2590, "DOROHOI-2590", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-BNR",
    dossierId: "DOROHOI-2560",
    originalName: "Banca Națională a României",
    normalizedName: "Banca Națională a României",
    displayNames: { en: "National Bank of Romania", ro: "Banca Națională a României" },
    variants: ["Banca Națională a României"],
    placeType: "institution",
    coordinates: null,
    coordinateSource: null,
    coordinateConfidence: "unknown",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2560, "DOROHOI-2560", "locuri_mentionate"),
    ],
  },
  {
    placeId: "PL-CORE-CFR",
    dossierId: "DOROHOI-2560",
    originalName: "C.F.R.",
    normalizedName: "Căile Ferate Române",
    displayNames: { en: "Romanian Railways (C.F.R.)", ro: "Căile Ferate Române (C.F.R.)" },
    variants: ["C.F.R."],
    placeType: "institution",
    coordinates: null,
    coordinateSource: null,
    coordinateConfidence: "unknown",
    resolutionStatus: "resolved",
    layer: "core",
    reviewState: "not_required",
    assertionStatus: "explicit",
    confidence: "high",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2560, "DOROHOI-2560", "evenimente.locuri_raw"),
    ],
  },
  {
    placeId: "PL-UNRESOLVED-TROPOV-2590",
    dossierId: "DOROHOI-2590",
    originalName: "Tropov[...]",
    normalizedName: null,
    displayNames: { en: "Tropov[…] — unresolved", ro: "Tropov[…] — neidentificat" },
    variants: ["Tropov[...]"],
    placeType: "unresolved",
    coordinates: null,
    coordinateSource: null,
    coordinateConfidence: "unknown",
    resolutionStatus: "unresolved",
    layer: "unresolved",
    reviewState: "needs_review",
    assertionStatus: "unresolved",
    confidence: "low",
    dossierRefs: [
      dossierSourceRef(SOURCE_FILES.dossier2590, "DOROHOI-2590", "evenimente.destinatii_raw"),
    ],
  },
  {
    placeId: "PL-UNRESOLVED-BURDUJENI-2560",
    dossierId: "DOROHOI-2560",
    originalName: "Burdujeni",
    normalizedName: null,
    displayNames: { en: "Burdujeni — conflicting source reading", ro: "Burdujeni — lectură în conflict" },
    variants: ["Burdujeni"],
    placeType: "unresolved",
    coordinates: null,
    coordinateSource: null,
    coordinateConfidence: "unknown",
    resolutionStatus: "unresolved",
    layer: "unresolved",
    reviewState: "needs_review",
    assertionStatus: "unresolved",
    confidence: "medium",
    dossierRefs: [
      dossierSourceRef(
        SOURCE_FILES.dossier2560,
        "DOROHOI-2560",
        "evenimente[2].sursa.fragment",
        undefined,
        "iar la 4 Iulie 1941 din Burdujeni la Dorohoi",
      ),
    ],
  },
];

export const PLACE_IDS = {
  dorohoi: "PL-CORE-DOROHOI",
  mihaileni: "PL-CORE-MIHAILENI",
  bucecea: "PL-CORE-BUCECEA",
  otaci: "PL-CORE-OTACI",
  mohyliv: "PL-CORE-MOHYLIV-PODILSKYI",
  jijia: "PL-CORE-JIJIA",
  transnistria: "PL-CORE-TRANSNISTRIA",
  bnr: "PL-CORE-BNR",
  cfr: "PL-CORE-CFR",
  tropov: "PL-UNRESOLVED-TROPOV-2590",
  burdujeni: "PL-UNRESOLVED-BURDUJENI-2560",
} as const;

export function buildCorePlaces(): Place[] {
  return coreDefinitions.map((definition) => ({
    id: definition.placeId,
    dossierId: definition.dossierId,
    sourceRefs: [curatedSourceRef(definition.placeId, definition.dossierId), ...definition.dossierRefs],
    raw: {
      originalName: definition.originalName,
      variants: definition.variants,
    },
    normalized: {
      normalizedName: definition.normalizedName,
      displayNames: definition.displayNames,
      resolutionStatus: definition.resolutionStatus,
    },
    confidence: definition.confidence,
    assertionStatus: definition.assertionStatus,
    reviewState: definition.reviewState,
    alternativeReadings: [],
    placeId: definition.placeId,
    originalName: definition.originalName,
    normalizedName: definition.normalizedName,
    displayNames: definition.displayNames,
    variants: definition.variants,
    placeType: definition.placeType,
    coordinates: definition.coordinates,
    coordinateSource: definition.coordinateSource,
    coordinateConfidence: definition.coordinateConfidence,
    resolutionStatus: definition.resolutionStatus,
    layer: definition.layer,
    externalDatasetId: null,
    relatedPlaceIds: definition.relatedPlaceIds ?? [],
  }));
}

export function resolvePlaceValue(rawValue: string): {
  placeId: string | null;
  resolutionMethod: "explicit_registry" | "compound_registry" | "unresolved_placeholder" | "unresolved";
  resolutionStatus: "resolved" | "partially_resolved" | "unresolved";
} {
  const value = rawValue.trim();
  const exact = new Map<string, string>([
    ["Dorohoi", PLACE_IDS.dorohoi],
    ["Mihăileni", PLACE_IDS.mihaileni],
    ["Mihăileni jud. Dorohoi", PLACE_IDS.mihaileni],
    ["Bucecea", PLACE_IDS.bucecea],
    ["Ataki", PLACE_IDS.otaci],
    ["Otaci", PLACE_IDS.otaci],
    ["Moghilev", PLACE_IDS.mohyliv],
    ["Mohyliv-Podilskyi", PLACE_IDS.mohyliv],
    ["Jijia", PLACE_IDS.jijia],
    ["Transnistria", PLACE_IDS.transnistria],
    ["Banca Națională a României", PLACE_IDS.bnr],
    ["C.F.R.", PLACE_IDS.cfr],
  ]);

  const exactMatch = exact.get(value);
  if (exactMatch) {
    const partiallyResolved = exactMatch === PLACE_IDS.jijia || exactMatch === PLACE_IDS.transnistria;
    return {
      placeId: exactMatch,
      resolutionMethod: "explicit_registry",
      resolutionStatus: partiallyResolved ? "partially_resolved" : "resolved",
    };
  }

  if (value === "Tropov[...]") {
    return {
      placeId: PLACE_IDS.tropov,
      resolutionMethod: "unresolved_placeholder",
      resolutionStatus: "unresolved",
    };
  }

  if (value === "Burdujeni") {
    return {
      placeId: PLACE_IDS.burdujeni,
      resolutionMethod: "unresolved_placeholder",
      resolutionStatus: "unresolved",
    };
  }

  if (value.startsWith("Dorohoi,")) {
    return {
      placeId: PLACE_IDS.dorohoi,
      resolutionMethod: "compound_registry",
      resolutionStatus: "partially_resolved",
    };
  }

  return {
    placeId: null,
    resolutionMethod: "unresolved",
    resolutionStatus: "unresolved",
  };
}
