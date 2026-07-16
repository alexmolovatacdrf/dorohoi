import type { Place } from "@/lib/domain/schemas";

/**
 * Public EHRI map labels. Raw/original catalog values remain unchanged; this
 * layer only chooses a readable English/Romanian label for the map surface.
 */
const EHRI_PUBLIC_LABEL_OVERRIDES: Record<string, string> = {
  // Records without a Latin-script alias in the supplied catalog.
  "PL-EHRI-0158": "Chernivtsi (Vinnytsia Oblast)",
  "PL-EHRI-0168": "Zlatopil",
  "PL-EHRI-0185": "Oleksandrivka",
  "PL-EHRI-0195": "Bilohiria",
  "PL-EHRI-0247": "Chornyi Ostriv",
  "PL-EHRI-0251": "Zinkiv",
  "PL-EHRI-0268": "Terebovlia",
  "PL-EHRI-0326": "Ivanopil",
  "PL-EHRI-0336": "Kalius",
  "PL-EHRI-0373": "Zhuravno",

  // Curated names already present in the project or in the record's raw
  // dossier field. These keep EHRI and route labels consistent.
  "PL-EHRI-0233": "Rădăuți-Prut",
  "PL-EHRI-0382": "Mohyliv-Podilskyi",
  "PL-EHRI-0383": "Cernăuți",
  "PL-EHRI-0384": "Sharhorod",
};

const nonLatinScriptPattern = /[\u0370-\u03ff\u0400-\u052f\u0590-\u05ff]/u;
const latinLetterPattern = /[A-Za-zÀ-ÖØ-öø-ÿĂÂÎȘȚăâîșțŢĂÂÎȘȚ]/u;

function rawStringValues(place: Place): string[] {
  if (!place.raw || typeof place.raw !== "object" || Array.isArray(place.raw)) return [];
  const raw = place.raw as Record<string, unknown>;
  return ["in_dosare", "nume", "name"].flatMap((key) => (
    typeof raw[key] === "string" && raw[key].trim() ? [raw[key].trim()] : []
  ));
}

function hasLatinScript(value: string): boolean {
  return latinLetterPattern.test(value) && !nonLatinScriptPattern.test(value);
}

function normalizeRomanianLegacyLetters(value: string): string {
  return value.replaceAll("ţ", "ț").replaceAll("Ţ", "Ț").replaceAll("ş", "ș").replaceAll("Ş", "Ș");
}

function cleanEhriCandidate(value: string): string {
  const cleaned = normalizeRomanianLegacyLetters(value)
    .replace(/\s*\([^)]*\)\s*/gu, " ")
    .replace(/^(?:the\s+)?(?:ghetto|ghetoul|gheto|getto|gettó|camp|lagăr|lagar)(?:\s+(?:of|di|de|van|in))?\s+/iu, "")
    .replace(/\s+(?:concentration\s+camp|ghetto|ghetoul|gheto|getto|gettó|camp|lagăr|lagar)\s*$/iu, "")
    .replace(/,\s*(?:ghetto|ghetoul|gheto|getto|gettó|camp|lagăr|lagar)\s*$/iu, "")
    .split(/\s*,\s*/u)[0]
    .replace(/\s+/gu, " ")
    .trim();
  const canonical = cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("ro");
  if (canonical === "edineti") return "Edineț";
  if (canonical === "sargorod" || canonical === "scharhorod") return "Sharhorod";
  return cleaned;
}

function candidateScore(value: string, source: "raw" | "variant" | "display"): number {
  const cleaned = cleanEhriCandidate(value);
  if (!cleaned || !hasLatinScript(cleaned)) return -Infinity;
  // The catalog's display/original name is normally the most useful public
  // name. Variants are a fallback, not a reason to replace a readable name
  // with a long institutional description such as "Lagăre de ...".
  let score = source === "display" ? 50 : source === "raw" ? 45 : 30;
  if (/(?:ghetou|lagăr|lagar)/iu.test(value)) score += 8;
  if (/[ăâîșț]/iu.test(cleaned)) score += 3;
  return score;
}

function derivedEhriLabel(place: Place): string {
  const candidates: Array<{ value: string; source: "raw" | "variant" | "display" }> = [
    ...rawStringValues(place).map((value) => ({ value, source: "raw" as const })),
    ...place.variants.map((value) => ({ value, source: "variant" as const })),
    { value: place.displayNames.en, source: "display" },
    { value: place.displayNames.ro, source: "display" },
    { value: place.originalName, source: "display" },
    { value: place.normalizedName ?? "", source: "display" },
  ];
  const best = candidates
    .map((candidate, index) => ({ ...candidate, index, score: candidateScore(candidate.value, candidate.source) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0];
  return best && best.score > -Infinity ? cleanEhriCandidate(best.value) : "EHRI place";
}

export function ehriMapLabel(place: Place, _language: "en" | "ro" = "en"): string {
  if (place.layer !== "ehri_local") return _language === "ro" ? place.displayNames.ro : place.displayNames.en;
  return EHRI_PUBLIC_LABEL_OVERRIDES[place.placeId] ?? derivedEhriLabel(place);
}

export function isReadableEhriMapLabel(label: string): boolean {
  return hasLatinScript(label);
}
