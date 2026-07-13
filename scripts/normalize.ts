import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedBundle } from "../lib/domain/schemas";
import { loadSourceCorpus } from "./normalization/load-source";
import { normalizeSourceCorpus } from "./normalization/normalize-data";

const OUTPUT_FILES: Record<keyof NormalizedBundle, string> = {
  persons: "persons.json",
  personNameVariants: "personNameVariants.json",
  households: "households.json",
  relationships: "relationships.json",
  documents: "documents.json",
  events: "events.json",
  places: "places.json",
  placeMentions: "placeMentions.json",
  routeSegments: "routeSegments.json",
  reviewTasks: "reviewTasks.json",
};

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeNormalizedData(
  bundle: NormalizedBundle,
  projectRoot = process.cwd(),
): Promise<void> {
  const outputRoot = path.join(projectRoot, "data", "normalized");
  await mkdir(outputRoot, { recursive: true });
  await Promise.all(
    (Object.keys(OUTPUT_FILES) as Array<keyof NormalizedBundle>).map((key) =>
      writeFile(path.join(outputRoot, OUTPUT_FILES[key]), stableJson(bundle[key]), "utf8"),
    ),
  );
}

async function main(): Promise<void> {
  const corpus = await loadSourceCorpus();
  const bundle = normalizeSourceCorpus(corpus);
  await writeNormalizedData(bundle);

  const counts = Object.fromEntries(
    (Object.keys(OUTPUT_FILES) as Array<keyof NormalizedBundle>).map((key) => [
      OUTPUT_FILES[key],
      bundle[key].length,
    ]),
  );
  process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("scripts/normalize.ts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
