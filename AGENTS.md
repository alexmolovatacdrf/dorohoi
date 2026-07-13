# Dosare Dorohoi — instructions for Codex

## Purpose

Build an academic historical-research platform for reconstructing individual
life histories, family relations, persecution, evacuations, deportations,
forced labour, losses, deaths, returns and documentary evidence connected to
Jewish families from Dorohoi.

The individual person is the central entity. A dossier, household or family is
context, not a substitute for the person's individual history.

## Data rules

1. Never modify files in `data/source/`.
2. Write all generated data to `data/normalized/`.
3. Never invent names, dates, coordinates, relationships, routes or events.
4. Preserve source provenance, raw wording, confidence and alternative readings.
5. Do not assign one person's route to relatives without explicit evidence.
6. A mentioned place is not automatically a route stop.
7. Distinguish explicit, partial, inferred and unresolved routes.
8. Keep unresolved places and uncertain readings visible.
9. Keep documentary transcription separate from analytical normalization.
10. Future dossiers must be importable without rewriting the interface.

## Product principles

- Person-centred.
- Research-grade provenance.
- Modern and visually clear.
- Usable by non-technical researchers.
- English-first and Romanian-ready.
- No automatic map animation on page load.
- Historical and external overlays are optional layers.
- Source scans remain the documentary authority.

## Engineering

- Next.js App Router, React, strict TypeScript and Tailwind.
- MapLibre-based interactive map.
- Zod validation for imported data.
- Deterministic normalization with tests.
- Separate normalization, domain model and map rendering.
- Do not introduce a database in V1.
- Run tests, typecheck, lint and build before completion.
- Document architecture, assumptions and unresolved data.
