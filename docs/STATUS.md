# Dosare Dorohoi V1 status

## Delivery status

V1 is implemented as a person-centred, static-data Next.js research platform.
The application validates and normalizes the supplied dossier extracts and
local EHRI registry, exposes the resulting evidence through typed selectors,
and presents it through searchable research pages and an interactive MapLibre
workspace. No database or source-data write-back has been introduced.

The immutable boundary has been preserved: `data/source/` was inspected but not
modified. All generated research collections are written to
`data/normalized/`.

## Completed scope

- strict Next.js App Router, React, TypeScript and Tailwind foundation;
- Zod validation for every supplied source shape and every normalized entity;
- fixed-manifest, deterministic normalization with stable IDs and stable sort
  order;
- common provenance, raw wording, confidence, assertion status, review state
  and alternative-reading envelope on every normalized record;
- person, name-variant, household, relationship, document, event, place,
  mention, route-segment and review-task collections;
- searchable Persons and Places indexes plus person, place and document detail
  views;
- review queue with category counts, search, evidence links, suggested actions
  and informative zero states;
- MapLibre research workspace with person, family/household, dossier, place,
  event, date and confidence filters;
- independently controlled research layers, with the 385-record local EHRI
  registry and inferred routes off by default;
- explicit, partial and inferred route grammar encoded by line pattern as well
  as color, plus direction markers;
- unresolved places listed off-map and never assigned invented coordinates;
- one-shot person route playback that never starts or loops automatically;
- English interface with a Romanian-ready message layer and working EN/RO
  state;
- responsive desktop and mobile layouts with keyboard-accessible controls and
  no horizontal page overflow at a 390-pixel viewport;
- a deterministic local map grid that remains usable without an external
  basemap and makes no boundary claims;
- dependency audit remediation by overriding Next's nested PostCSS 8.4.31 with
  the compatible patched 8.5.19 already used elsewhere in the project.

## Normalized inventory

| Collection | Records |
| --- | ---: |
| Persons | 4 |
| Person name variants | 7 |
| Households | 1 |
| Relationships | 2 |
| Documents | 2 |
| Events | 23 |
| Places | 396 |
| Place mentions | 32 |
| Route segments | 4 |
| Review tasks | 16 |

The 396 places comprise 11 research-core or unresolved identities and 385 local
EHRI registry records. The EHRI records remain separate even where labels or
coordinates coincide.

## Research safeguards verified

- Ițic Herțanu has two explicit individual legs: Mihăileni to Bucecea and the
  reviewed structured reading Bucecea to Dorohoi. The conflicting source
  fragment naming Burdujeni remains a structured alternative.
- Iancu Aizic has only the two defensible partial legs Dorohoi to Otaci and
  Otaci to Moghilev. The lines join evidence endpoints and do not claim exact
  historic roads.
- No route segment ends at unresolved `Tropov[...]`.
- Pesi Aizic's death at Moghilev is an event and place mention, not an inherited
  version of Iancu's route.
- Marica Chibac receives no route through the probable spouse relationship.
- The Jijia mention retains its unresolved exact bridge and has no fabricated
  point.
- A place mention alone never creates a route segment.

## Verification

The final verification sequence on 13 July 2026 is:

```bash
npm run normalize
npm test
npm run typecheck
npm run lint
npm run build
npm audit --json
npm run start -- --hostname 127.0.0.1
```

All commands pass. The test suite contains 11 deterministic and research-rule
tests. The production build generates the overview, indexes, both document
pages and all four person pages, with dynamic filtered map, place and review
views. `npm audit --json` reports zero known vulnerabilities. The production
server starts successfully at `http://127.0.0.1:3000`.

Browser verification covered Overview, Map, Persons, an individual dossier,
Places, Documents and Review; person search, the separate EHRI filter, map
person filtering, one-shot timeline playback and the EN/RO control were
exercised. MapLibre hydrated with five visible core points and four route legs
at the default state. Desktop and 390-pixel mobile layouts were checked. The
only browser console messages were headless SwiftShader performance warnings
while capturing the WebGL map; there were no application errors.

`git diff -- data/source` is empty.

## Visual artifacts

- [`overview-desktop.png`](../artifacts/screenshots/overview-desktop.png)
- [`map-desktop.png`](../artifacts/screenshots/map-desktop.png)
- [`person-iancu-aizic.png`](../artifacts/screenshots/person-iancu-aizic.png)
- [`review-desktop.png`](../artifacts/screenshots/review-desktop.png)
- [`overview-mobile.png`](../artifacts/screenshots/overview-mobile.png)

## Known placeholders and unresolved research

- The referenced dossier PDFs/scans are not present. Document pages reserve a
  source-viewer area but never synthesize a facsimile or claim scan collation.
- The Bucecea/Burdujeni origin conflict requires consultation of the scan and a
  diplomatic transcription.
- `Tropov[...]` remains unidentified, un-geocoded and off-map.
- The exact bridge on the Jijia remains unresolved.
- Marica Chibac/Aizic's name reading and probable spouse relationship require
  documentary confirmation.
- Several rubrics and annex fragments require source collation, represented by
  explicit review tasks.
- The 385-place EHRI file is a supplied local extract, not a live synchronized
  catalog. Its type-label conflicts, duplicate/shared coordinates and upstream
  provenance require catalog-level review before any merge.
- Historical boundaries and WMS/WMTS services are disabled registry
  placeholders. The default map intentionally uses a neutral local grid.
- Review actions are read-only in V1; there is no persistent adjudication or
  merge workflow.
- Romanian coverage currently applies to interface messages. Documentary
  wording remains in its source language and should not be silently translated.

## Recommended next steps

1. Add an explicit media manifest for the actual PDFs/page images and produce
   scan-linked diplomatic transcriptions.
2. Resolve the Bucecea/Burdujeni, `Tropov[...]`, Jijia and Marica readings with
   documented adjudication records rather than overwriting current evidence.
3. Reconcile the local EHRI extract with authoritative upstream identifiers,
   provenance and licenses before matching or merging places.
4. Add optional dated historical boundaries and licensed WMS/WMTS services
   through the layer registry.
5. Design a persistent, auditable review-decision workflow only after the
   file-backed V1 research process has been evaluated by researchers.
6. Add future dossier adapters behind the existing normalized contracts and
   keep cross-dossier identity matching candidate-only until human review.
