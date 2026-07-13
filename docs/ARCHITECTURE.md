# Dosare Dorohoi V1 architecture

## 1. Purpose and architectural stance

Dosare Dorohoi is a person-centred historical-research application. Its primary
job is not to display dossiers as indivisible stories, but to let researchers
reconstruct and compare evidence about individual people while retaining the
household, family, documentary and geographic contexts in which that evidence
appears.

V1 is a static, file-backed research application. Read-only source JSON is
validated and transformed by a deterministic importer into normalized JSON.
Next.js server components read those normalized files, selectors assemble page
views, and client components provide search, filters, language switching and
MapLibre interaction. There is no database and no write-back review workflow in
V1.

The architectural boundary that matters most is:

```text
data/source (documentary authority; immutable)
       |
       | Zod validation + deterministic normalization
       v
data/normalized (analytical claims; reproducible)
       |
       | typed repository + selectors
       v
Next.js pages and MapLibre presentation
```

No interface component reads or interprets a source dossier directly. No map
component decides whether a place mention is a route stop. Those decisions live
in normalization, are typed, carry provenance and are testable.

## 2. Source audit

The repository contains four source files.

| File | Observed shape | V1 treatment |
| --- | --- | --- |
| `DOROHOI_2560_registru_analitic_revizia_duala_v0_2.json` | One document, one person, one household, 13 events, five aggregate place entries, one match-to-check and five open problems | Imported as dossier evidence; the analytical extraction remains distinct from any future diplomatic transcription or scan |
| `DOROHOI_2590_registru_analitic_initial_v0_1.json` | One document, three people, two relationships, 10 events, five aggregate place entries and five open problems | Imported as dossier evidence with medium-confidence spouse/name readings and an incomplete deportation route |
| `EHRI_lagare_ghetouri_regiune.json` | 385 georeferenced records: 240 coded `lagar`, 145 coded `ghetou`; eight include `in_dosare` | Imported record-for-record as an optional external/local EHRI overlay; not silently merged with dossier places |
| `model_analitic_dorohoi_v0_2.json` | Empty entity arrays plus record templates for claims, events, people and entity matches | Used as model guidance and input-shape validation context, not treated as documentary evidence |

The inspection identified issues that must remain visible rather than being
silently corrected:

- dossier 2590 contains the unresolved reading `Tropov[...]` after Moghilev;
- `Marica Chibac` has `Marica Aizic` as an alternative reading and the spouse
  relationship is medium confidence;
- Pesi Aizic's death is explicit at Moghilev, but her full route is not;
- the dossier 2560 second route event has normalized origin `Bucecea`, while its
  quoted fragment says `din Burdujeni la Dorohoi`;
- `Jijia` identifies a river in a forced-labour statement, not a securely
  geolocated bridge or route stop;
- some EHRI alternatives contain leading whitespace, some labels say “ghetto”
  while the supplied `tip` is `lagar`, several records share coordinates, and
  some coordinates are conspicuously low precision. V1 preserves the supplied
  values and flags catalog-level quality review; it does not repair them by
  guesswork.

## 3. Repository layout

The intended V1 layout is:

```text
app/
  layout.tsx                 global research shell
  page.tsx                   Overview
  map/page.tsx               main map workspace
  persons/page.tsx           searchable person index
  persons/[personId]/page.tsx
  places/page.tsx            place index
  places/[placeId]/page.tsx
  documents/page.tsx         documentary index
  documents/[documentId]/page.tsx
  review/page.tsx            review queue and zero-state categories
components/
  map/                       MapLibre renderer, filters, details, timeline
  research/                  cards, evidence and provenance views
  shell/                     navigation and language controls
  ui/                        small reusable presentation primitives
data/
  source/                    immutable supplied inputs
  normalized/                generated JSON only
docs/                        architecture, model, plan and status
lib/
  data/                      typed normalized-data repository and selectors
  domain/                    Zod schemas and shared domain types
  i18n/                      small EN/RO message catalog
scripts/
  normalize.ts               deterministic import entry point
  normalization/             source schemas, transforms and curated registry
tests/                       normalization and invariant tests
artifacts/screenshots/       completion screenshots
```

## 4. Processing pipeline

### 4.1 Input validation

Each supplied JSON shape has a Zod schema. Validation occurs before any output
is written. Unknown fields are retained in each record's `raw` payload where
appropriate, so adding a source field does not erase evidence. A failed source
parse aborts the run with a file and field path.

### 4.2 Normalization

The importer:

1. reads source files from fixed manifest entries in sorted order;
2. validates them;
3. creates entity records with stable source-derived identifiers;
4. attaches a common evidence envelope to every generated object;
5. resolves only gazetteer mappings explicitly registered in code;
6. creates place mentions independently from route segments;
7. creates only the explicitly configured pilot route legs;
8. converts open problems and detected invariants into review tasks;
9. sorts every collection by stable identifier; and
10. serializes JSON with fixed indentation and a final newline.

The command rewrites only `data/normalized/`. Running it twice against unchanged
inputs must produce byte-identical files.

### 4.3 Normalized repository

Application code loads the ten generated collections through a single typed
repository module. Zod validates normalized data at load time during development,
tests and production builds. Selectors—not page components—perform joins such as
person-to-events, place-to-mentions, incoming/outgoing routes and
document-to-people.

This keeps entity modeling independent from the interface and makes future
storage replacement possible without rewriting pages.

### 4.4 Presentation

Next.js App Router pages are server-rendered by default. Interactive search,
filters, the language switch and the map are bounded client components. The
normalized repository is the only application data source.

The map receives purpose-built, serializable view data. MapLibre rendering is
separate from route semantics:

- the default base is a deterministic local latitude/longitude research grid;
  it makes no political, administrative or historical boundary claim and does
  not depend on a third-party style service;
- resolved place mentions are points;
- unresolved place mentions appear in the side panel and unresolved layer
  registry, never at fabricated coordinates;
- explicit routes are solid directional lines;
- partial routes are dashed directional lines;
- inferred routes use a separate style and are off by default;
- family/household context is a point overlay, not an automatic shared route;
- local EHRI records are optional and disabled by default to prevent the
  385-record overlay from overwhelming dossier evidence.

Historical boundaries, WMS/WMTS services and other external cartography remain
disabled registry placeholders in V1. They can later be added as optional
layers with their own source, date, license and confidence metadata, without
changing person, event, mention or route records.

The initial map does not animate. A selected person's timeline can play once,
pause and reset; playback never loops automatically.

## 5. Routes and non-propagation rules

Route creation is allow-listed rather than inferred from all place fields.

- Ițic Herțanu receives a dated Mihăileni–Bucecea route leg and a dated
  Bucecea–Dorohoi leg. The second leg retains the conflicting `Burdujeni`
  fragment and remains under review.
- Iancu Aizic receives a partial Dorohoi–Ataki/Otaci–Moghilev sequence. The
  dossier establishes origin, frontier presence and destination but does not
  document all intervening movement, so these legs are styled as partial.
- `Tropov[...]` remains an unresolved place mention. There is no segment from
  Moghilev to it.
- Pesi Aizic's death at Moghilev creates a death event and a place mention only.
  It does not create or inherit Iancu's route.
- Marica Chibac does not inherit Iancu's route through a spouse relationship.

Automated tests enforce these negative assertions.

## 6. Provenance and documentary authority

Every normalized object contains its source file, document/dossier identifier
when applicable, page and printed page when available, field/rubric or source
record index, raw value, normalized value, confidence, assertion status, review
state and alternative readings. The source scan—not the analytical extraction
and not the normalized JSON—remains the documentary authority.

V1 document pages therefore expose scan metadata and a viewer placeholder but
do not pretend that the PDFs are present. A future media manifest can attach
page images or PDFs without changing person, event or place identifiers.

## 7. Internationalization

English is the default. A small typed message dictionary provides English and
Romanian navigation, headings, filters and common status labels. Historical raw
wording is never translated or replaced. Entity records can hold distinct
English and Romanian display names; both fall back transparently to the supplied
or normalized label.

V1 stores the language choice in the URL or browser state. This is deliberately
small enough to be replaced by full locale routing later.

## 8. Future dossier import

Future dossiers enter through a source-adapter registry. Each adapter maps a
versioned source shape to the same normalized domain. Adding a dossier should
require:

1. adding the immutable source file;
2. registering its parser/adapter and document metadata;
3. adding explicit place resolutions where evidence supports them;
4. adding route rules only where documentary evidence supports movement; and
5. adding fixtures/invariant tests.

Pages, map layers and selectors operate on the normalized model and should not
need dossier-specific edits. Candidate person matches remain review tasks; the
importer never merges people automatically.

## 9. Deferred architecture

V1 deliberately defers:

- database persistence and collaborative review writes;
- authentication, permissions and audit logs;
- OCR, diplomatic transcription and scan ingestion;
- automated entity resolution;
- historical boundary data and live WMS/WMTS integration;
- route interpolation or historically accurate road geometry; and
- a full translation/localized-content system.

Layer registries and source/media references are included now so these features
can be added without collapsing documentary, analytical and rendering concerns.
