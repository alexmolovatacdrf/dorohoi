import type {
  AlternativeReading,
  Confidence,
  SourceReference,
} from "../../lib/domain/schemas";
import type { SourcePointer } from "./source-schemas";

export const SOURCE_FILES = {
  dossier2560: "DOROHOI_2560_registru_analitic_revizia_duala_v0_2.json",
  dossier2590: "DOROHOI_2590_registru_analitic_initial_v0_1.json",
  ehri: "EHRI_lagare_ghetouri_regiune.json",
  analyticalModel: "model_analitic_dorohoi_v0_2.json",
} as const;

export function dossierSourceRef(
  sourceFile: string,
  documentId: string,
  field: string,
  pointer?: SourcePointer,
  fragmentRaw?: string | null,
): SourceReference {
  return {
    sourceFile: `data/source/${sourceFile}`,
    sourceDataset: "dossier",
    documentId,
    dossierId: documentId,
    pagePdf: pointer?.pagina_pdf ?? null,
    pagePrinted: pointer?.pagina_tiparita ?? null,
    field: pointer?.rubrica ? `${pointer.rubrica} · ${field}` : field,
    sourceRecordId: null,
    fragmentRaw: fragmentRaw ?? pointer?.fragment ?? null,
  };
}

export function curatedSourceRef(
  sourceRecordId: string,
  dossierId: string | null = null,
): SourceReference {
  return {
    sourceFile: "scripts/normalization/core-gazetteer.ts",
    sourceDataset: "curated_gazetteer",
    documentId: dossierId,
    dossierId,
    pagePdf: null,
    pagePrinted: null,
    field: "CORE_GAZETTEER",
    sourceRecordId,
    fragmentRaw: null,
  };
}

export function ehriSourceRef(index: number): SourceReference {
  return {
    sourceFile: `data/source/${SOURCE_FILES.ehri}`,
    sourceDataset: "ehri_local",
    documentId: null,
    dossierId: null,
    pagePdf: null,
    pagePrinted: null,
    field: `record[${index}]`,
    sourceRecordId: `EHRI-${String(index + 1).padStart(4, "0")}`,
    fragmentRaw: null,
  };
}

export function confidenceFromRomanian(value: unknown): Confidence {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.toLocaleLowerCase("ro");
  if (normalized.startsWith("ridicat")) return "high";
  if (normalized.startsWith("medi")) return "medium";
  if (normalized.startsWith("scăzut") || normalized.startsWith("scazut")) {
    return "low";
  }
  return "unknown";
}

export function alternativeReading(
  value: unknown,
  note: string | null,
  confidence: Confidence,
  sourceRefs: SourceReference[],
): AlternativeReading {
  return { value, note, confidence, sourceRefs };
}
