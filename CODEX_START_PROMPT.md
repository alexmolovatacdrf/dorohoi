Build the first working version of the “Dosare Dorohoi” historical research
platform in this repository.

Read AGENTS.md before doing anything else.

## Source data

Use these files as read-only inputs:

- data/source/DOROHOI_2560_registru_analitic_revizia_duala_v0_2.json
- data/source/DOROHOI_2590_registru_analitic_initial_v0_1.json
- data/source/EHRI_lagare_ghetouri_regiune.json
- data/source/model_analitic_dorohoi_v0_2.json

Do not modify them. Derived data belongs in data/normalized/.

## First phase: inspect and document

Inspect all source JSON files and create:

- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/IMPLEMENTATION_PLAN.md

Document:

- person, mention, relationship, household, document, event, place and route;
- documentary data versus normalized analytical data;
- provenance and confidence;
- unresolved and alternative readings;
- the import strategy for future dossiers.

After writing the documents, continue implementation without waiting for
confirmation unless there is a destructive or genuinely blocking decision.

## Application stack

Use:

- Next.js with App Router;
- React;
- strict TypeScript;
- Tailwind CSS;
- MapLibre GL JS or a React MapLibre wrapper;
- Zod;
- automated tests for normalization.

Use JSON files in V1. Do not add PostgreSQL or PostGIS yet.

## Normalized output

Create a deterministic importer that generates at least:

- persons.json
- personNameVariants.json
- households.json
- relationships.json
- documents.json
- events.json
- places.json
- placeMentions.json
- routeSegments.json
- reviewTasks.json

Each derived object must preserve identifiers, dossier, source page or field
when available, raw value, normalized value, confidence, review state and
alternative readings.

Never propagate a declarant's route to relatives automatically.

## Initial places and routes

Build an initial gazetteer with original name, normalized name, English and
Romanian display names, variants, type, coordinates, coordinate source,
confidence and resolution status.

Initial places include:

- Dorohoi;
- Mihăileni;
- Bucecea;
- Ataki / Otaci;
- Moghilev / Mohyliv-Podilskyi;
- Jijia;
- places from the local EHRI file;
- the unresolved place following Moghilev in dossier 2590.

Do not assign coordinates to the unresolved place by name similarity alone.

Pilot routes:

1. Ițic Herțanu, dossier 2560:
   - Mihăileni to Bucecea, 19 June 1941, on foot;
   - Bucecea to Dorohoi, 4 July 1941.

2. Iancu Aizic, dossier 2590:
   - Dorohoi;
   - Ataki / Otaci;
   - Moghilev / Mohyliv-Podilskyi;
   - an unresolved subsequent place.

Do not invent a segment to the unresolved place.

Pesi Aizic's death at Moghilev must remain a separate event. Do not assume
that her complete route was identical to Iancu Aizic's route.

## Application sections

Create:

- Overview
- Map
- Persons
- Places
- Documents
- Review

Overview must contain clickable counts and links to filtered lists.

Persons must support search, roles, relationships, documents, chronology,
places, events, routes, provenance and unresolved issues.

Places must show name variants, location status, people, events, documents,
incoming and outgoing routes and identification problems.

Documents must prepare for a future PDF/source viewer.

Review must show unresolved places, uncertain readings, incomplete routes,
possible duplicate persons, questionable relationships and contradictions.

## Interactive map

The Map is the main visualization.

Layout:

- compact filter panel on the left;
- map in the centre;
- contextual details on the right;
- timeline at the bottom.

Filters:

- person;
- household/family;
- dossier;
- place;
- event type;
- time range;
- confidence.

Layer controls:

- locations;
- individual routes;
- family or household context;
- origin places;
- evacuation and deportation places;
- camps and ghettos;
- forced-labour places;
- death places;
- return or repatriation places;
- unresolved places;
- local EHRI data;
- placeholders/registry for future historical boundaries and WMS/WMTS layers.

Use line style, shape and icons as well as colour.

Represent:

- explicit routes with continuous lines and direction;
- partially documented routes with dashed lines;
- inferred routes distinctly and disabled by default;
- mentioned places as points without automatic route connections.

No animation on initial load.

Create a basic timeline with play, pause and reset. For a selected individual,
a route may draw progressively once. It must not loop automatically.

## Language and UI

V1 is primarily English, with a small translation structure and EN/RO switch.

The interface must be modern, compact, responsive and clear for researchers.
Avoid excessive popups and panels that cover the map.

## Verification and completion

Before reporting completion:

1. run normalization;
2. run tests;
3. run typecheck;
4. run lint;
5. run production build;
6. start the application locally;
7. visually inspect key pages if browser tooling is available;
8. save screenshots under artifacts/screenshots/;
9. create docs/STATUS.md with completed work, placeholders, unresolved issues,
   exact run commands and recommended next steps.

Start now by inspecting the repository and the source data.
