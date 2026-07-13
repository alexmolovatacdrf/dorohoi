import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { SOURCE_FILES } from "./evidence";
import {
  AnalyticalModelSchema,
  EhriPlacesSchema,
  SourceDossierSchema,
  type EhriPlace,
  type SourceDossier,
} from "./source-schemas";

export interface SourceCorpus {
  dossier2560: SourceDossier;
  dossier2590: SourceDossier;
  ehriPlaces: EhriPlace[];
  analyticalModel: z.infer<typeof AnalyticalModelSchema>;
}

async function parseJsonFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse JSON source ${filePath}`, { cause: error });
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Source validation failed for ${filePath}:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export async function loadSourceCorpus(projectRoot = process.cwd()): Promise<SourceCorpus> {
  const sourceRoot = path.join(projectRoot, "data", "source");
  const [dossier2560, dossier2590, ehriPlaces, analyticalModel] = await Promise.all([
    parseJsonFile(path.join(sourceRoot, SOURCE_FILES.dossier2560), SourceDossierSchema),
    parseJsonFile(path.join(sourceRoot, SOURCE_FILES.dossier2590), SourceDossierSchema),
    parseJsonFile(path.join(sourceRoot, SOURCE_FILES.ehri), EhriPlacesSchema),
    parseJsonFile(
      path.join(sourceRoot, SOURCE_FILES.analyticalModel),
      AnalyticalModelSchema,
    ),
  ]);

  return { dossier2560, dossier2590, ehriPlaces, analyticalModel };
}
