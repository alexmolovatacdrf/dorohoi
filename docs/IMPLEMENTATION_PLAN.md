# Dosare Dorohoi V1 implementation plan

## Objective

Deliver a working, static Next.js research platform driven entirely by
deterministically normalized JSON, with a person-centred interface, a MapLibre
workspace, visible uncertainty and research-grade provenance.

## Phase 0 — inspect and document

Status: complete.

- Read `AGENTS.md` and `CODEX_START_PROMPT.md` in full.
- Parsed and inspected all four source JSON files.
- Audited collection sizes, source shapes and data-quality issues.
- Defined the architectural boundaries, common evidence envelope, entity model,
  route rules and future dossier strategy.
- Create a Git checkpoint containing these planning documents before application
  implementation begins.

Acceptance criteria:

- the three required documents exist;
- immutable source and generated-data boundaries are explicit;
- Pesi Aizic route non-propagation and unresolved route endpoints are explicit;
- source discrepancies and EHRI catalog caveats are documented.

## Phase 1 — project foundation

Status: complete.

- Scaffold Next.js App Router, React, strict TypeScript and Tailwind.
- Add Zod, MapLibre GL JS and a focused test runner.
- Add scripts for `normalize`, `test`, `typecheck`, `lint`, `build` and `dev`.
- Establish accessible global styles, compact research shell and EN/RO message
  structure.

Acceptance criteria:

- strict TypeScript is enabled;
- the empty shell builds;
- source files are not modified;
- generated JSON remains outside `public/` and is loaded through typed modules.

## Phase 2 — deterministic normalization

Status: complete.

- Define Zod schemas for both dossier versions, the local EHRI list, the supplied
  analytical model and all normalized collections.
- Implement a fixed source manifest and adapter functions.
- Implement the core gazetteer with explicit coordinate provenance.
- Import all 385 EHRI records as a separate optional layer without automatic
  entity merging.
- Generate the ten required JSON collections.
- Generate structured review tasks from source open problems and detected
  contradictions.
- Write sorted, stable JSON with no timestamps or environment-dependent values.

Acceptance criteria:

- normalization succeeds from a clean checkout;
- two consecutive runs are byte-identical;
- every generated object has the evidence envelope;
- unresolved `Tropov[...]` has null coordinates;
- `Jijia` does not acquire a fabricated bridge coordinate;
- no generated file appears in `data/source/`.

## Phase 3 — normalization tests and data selectors

Status: complete.

- Test source validation and normalized validation.
- Test deterministic output.
- Test entity counts and stable identifiers.
- Test exact pilot route legs and styles.
- Test that no route ends at `Tropov[...]`.
- Test that Pesi Aizic and Marica Chibac have no inherited route.
- Test that a place mention alone never produces a segment.
- Test the Bucecea/Burdujeni contradiction and alternative reading retention.
- Implement typed repository loads and pure selectors for overview counts,
  person chronology, places, documents, routes and review categories.

Acceptance criteria:

- tests cover positive and negative research invariants;
- selectors contain joins and sorting, leaving pages presentation-focused.

## Phase 4 — research interface

Status: complete.

- Build the Overview with clickable counts linked to filtered indexes.
- Build searchable Persons and detailed person pages with roles, relationships,
  documents, chronology, places, events, routes, provenance and unresolved
  issues.
- Build Places index/detail views with variants, resolution status, people,
  events, documents, route directions and identification problems.
- Build Documents index/detail views with source metadata, page/rubric evidence
  and a future scan/PDF viewer placeholder.
- Build Review grouped by unresolved places, uncertain readings, incomplete
  routes, possible duplicates, questionable relationships and contradictions.
- Add responsive navigation and EN/RO switching for interface copy.

Acceptance criteria:

- all required sections are navigable directly;
- counts link to meaningful filtered views;
- raw wording, confidence and source references are reachable without obscuring
  the main reading flow;
- required review categories include informative zero states.

## Phase 5 — MapLibre workspace

Status: complete.

- Build the three-column map layout with filter panel, map, contextual details
  and bottom timeline.
- Use a public no-key OpenStreetMap raster layer for default geographic context
  while keeping an inline background/grid fallback and project evidence layers
  independent of external tile availability.
- Expose basemap availability and MapLibre initialization failures visibly;
  never leave the map workspace as an unexplained blank region.
- Add person, household/family, dossier, place, event type, time and confidence
  filters.
- Add independent layer controls for locations, individual routes, family
  context, origin, evacuation/deportation, camps/ghettos, forced labour, death,
  return, unresolved, local EHRI and future boundary/service placeholders.
- Encode route epistemic status with line pattern as well as color, points with
  shapes, and direction markers.
- Keep inferred routes disabled by default and unresolved places off-map.
- Add one-shot play, pause and reset for a selected person's route; never start
  or loop on initial load.

Acceptance criteria:

- no automatic animation occurs;
- EHRI is optional and off by default;
- route styling remains comprehensible without relying only on color;
- selecting a feature updates a compact right-side evidence view;
- mobile layout remains usable without panels covering the whole map.

## Phase 6 — verification and handoff

Status: complete.

Run, in order:

```bash
npm run normalize
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Then:

- inspect Overview, Map, Persons, one person detail, Places, Documents and Review
  in a real browser;
- verify MapLibre layer and timeline behavior;
- verify responsive layout and the EN/RO control;
- save key screenshots under `artifacts/screenshots/`;
- check `git diff -- data/source` is empty;
- create `docs/STATUS.md` with completed scope, exact commands, placeholders,
  unresolved data and recommended next steps.

Completion criteria:

- normalization, tests, typecheck, lint and production build all pass;
- the application starts locally and key pages are visually inspected;
- screenshots and status documentation exist;
- no source file was changed;
- no known uncertainty is presented as an established fact.

## Known V1 placeholders

- source PDFs/scans are referenced but are not present in this repository;
- historical boundaries and WMS/WMTS services have registry entries and disabled
  controls only;
- the EHRI list is a supplied local extract and is not live-synchronized;
- route lines connect documented endpoints and are not claims about exact roads;
- review actions are read-only until a later persistent workflow exists;
- interface translation is deliberately small; documentary wording stays in its
  original language.

## Phase 7 — European Borders WWII historical administration layer

Status: in progress.

- Preserve the corrected V1 map as the acceptance baseline and keep the
  `v0.1.0-map-prototype` tag unchanged.
- Inventory and checksum the source archive without committing its raw or
  extracted contents.
- Document attribution, projection, methodology, use limits, temporal limits
  and all detected anomalies.
- Build a pinned, deterministic processor for validation, regional crop,
  reprojection, conservative simplification, per-month GeoJSON and checksums.
- Validate Transnistria, Reichskommissariat Ukraine and Territorial_Changes
  assertions directly from the supplied DBFs.
- Add an optional selected-month MapLibre polygon layer below person routes and
  place markers, with legend, opacity, raw details, warning and attribution.
- Validate only one selected snapshot in the browser, with abortable requests
  and a visible error state.
- Add conversion/date-selection/source-distinction tests and exercise desktop
  and mobile controls in Chromium.
- Run normalization, tests, typecheck, lint and production build; save final
  screenshots and commit the integration.

Acceptance requires the real basemap, project places, person routes and layer
controls to remain visibly usable, with the historical polygons independently
toggleable. The late `limited_static` interval must be clearly differentiated,
and no raw source field may be silently corrected.
