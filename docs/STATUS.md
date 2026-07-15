# Dosare Dorohoi V1 status

## Current branch checkpoint

The active branch is `feature/public-presentation-map`. The historical-data
checkpoint is `9430b14` (`feat: finalize full-extent historical administration
dataset`). It includes the strict regional/full schema contract, the validated
full-extent browser derivatives and tests for all 88 full monthly snapshots plus
`Territorial_Changes`. The public map work follows this checkpoint and is kept
in separate logical commits.

## Delivery status

V1 is implemented as a person-centred, static-data Next.js research platform.
The application validates and normalizes the supplied dossier extracts and
local EHRI registry, exposes the resulting evidence through typed selectors,
and presents it through searchable research pages and an interactive MapLibre
workspace. No database or source-data write-back has been introduced.

## Presentation-only collaboration deployment

A separate Vercel project, `dosare-dorohoi-presentation`, now provides a
gradual-review deployment for non-technical collaborators. It sets
`PRESENTATION_ONLY=true`, exposes only the Presentation Map route and required
full-Europe historical assets, redirects other application routes back to
Presentation Map, and hides the advanced global navigation. The current unique
deployment URL is protected by Vercel Authentication:

`https://dosare-dorohoi-presentation-pr504kmki.vercel.app/presentation/map?dataset=project`

The stable project alias is not the private sharing URL on Hobby; use the
unique deployment URL and the collaborator's invited Vercel account.

## Presentation Map feedback pass

The current presentation-map refinement keeps the Claude HTML prototype as a
visual and interaction reference only; its embedded sample data is not copied
into the normalized research collections. The useful dossier semantics are now
represented in the public selector and story card: a documented head/declarant
is distinct from other people listed in the same dossier, while each person's
routes remain individual and evidence-bound.

The public playback now draws slow, smooth visual curves between documented
endpoints, moves a progress marker along the active curve, runs once and stops.
The same curved geometry, directional arrows and separate reverse/repeated
movement lanes are now used by the Research Map route layer as well.
The MapLibre compass/pitch arrow was removed; only zoom controls remain. The
presentation status box that had been behind the left control panel is hidden
from the public canvas because its information is already available in the
controls and layer status. Historical polygon opacity starts at 28% and is
controlled directly below the historical-layer toggle so basemap detail stays
readable. Selecting a person fits the map to all of that person's documented
route endpoints and places with an eased camera transition.

The black `N` button seen during local development is the Next.js development
overlay (`Open Next.js Dev Tools`), not an application map control. It should
not be treated as part of the public interface or production screenshots.

The Presentation Map control layout now separates concerns: the left panel is
reserved for camera, period, opacity and layer settings, while the right panel
lists families, dossiers and individual people and shows the selected story
details. Map pages hide the global footer so it cannot remain in or consume the
map viewport; editorial pages retain it.

Historical polygon information no longer appears on hover. It opens only after
an explicit click or right-click and the popup has a close button. The Claude
demo adapter also normalizes its internal dossier references so the documented
head and mentioned people appear under the same family entry and their routes
remain selectable individually.

The Presentation Map now exposes a clearly labelled test-data switcher. The
Project data option uses the normalized collections. The Claude demo option
uses the derived fixture at `data/demo/claude-map-demo.json`, containing 48
persons, 11 dossiers, 15 prototype places and 26 route segments from the
embedded `Platforma_WJC (10).html` sample. Its map adapter adds the separate
385-record EHRI overlay without assigning those records to Claude persons.
The fixture remains isolated from normalized person research data and retains
the source filename and SHA-256 for traceability.

The Research Map now exposes the same Project data / Claude demo switcher. Its
default remains the normalized regional project data; `/map?dataset=claude-demo`
loads the isolated Claude fixture into the advanced research interface for
testing person selection and route playback.

The Research Map Context panel now contains the same searchable, collapsible
`Families and mentioned people` directory as Presentation Map. The left side
continues to hold the advanced research filters and collapsible layer groups;
selecting a person there or in the shared directory preserves individual route
ownership and provenance. Family cards keep the mentioned-person count and
disclosure triangle on the head/declarant row; the expanded content contains
the names and internal dossier record without a redundant heading. The selected
Presentation Map story card follows the same compact pattern.

Selecting a person and clicking a visible place now shows the documented
person-place connections in both map modes, including source date when
available, public relationship category, source wording/description and source
label. The same summary is rendered in a small anchored popup beside the
clicked map point as well as in the expanded detail panel. Route endpoints are
shown as route endpoints and are not silently reclassified as birth, death or
another event. Left-side map controls use tighter vertical spacing while
retaining their controls and readable target sizes.

Map dates use the shared localized formatter: English and Romanian interfaces
display parsed dates in their respective calendar conventions. A second click
on the same place, route or historical polygon clears its selection and closes
the synthesized map detail state. Research playback now uses the same slow
curved, arrowed, progressive route animation as Presentation Map; each segment
lasts 4.6 seconds and playback is manual, one-shot and non-looping.

The immutable boundary has been preserved: `data/source/` was inspected but not
modified. All generated research collections are written to
`data/normalized/`.

## Map acceptance correction

The original V1 checkpoint initialized MapLibre with an inline background and
research grid but no geographic source. Consequently, no style, tile, glyph or
sprite request could ever produce a basemap. Project sources were also attached
to the later `load` event and initialization errors had no visible UI state.

The corrected implementation adds an attributed public raster source, keeps
the local background/grid in the same inline style, attaches project evidence
on `style.load`, and reports both tile fallback and MapLibre/WebGL failure
states visibly. The original `v0.1.0-map-prototype` tag remains on the
pre-correction V1 checkpoint.

## European Borders WWII integration

The historical administration extension is complete on
`feature/historical-administration-layer`. The source archive was found at
`/mnt/c/Users/Alex Molovata/Downloads/EuropeanBorders_WWII.zip`; its committed
SHA-256 is
`4f934928531a57dc9e84d3a087cd21643f1232af011a4949621bcc53e099f4ea`.
The archive and extracted approximately 500 MB source tree remain in ignored
`external-data/` and are not tracked by Git.

The pinned preprocessing pipeline validates all 88 monthly shapefiles and
`Territorial_Changes`, retains raw monthly attributes, crops the documented
regional research window, transforms `ESRI:102013` to `EPSG:4326`, simplifies
conservatively and writes one compact GeoJSON per year-month. Two complete runs
produced identical derived and manifest hashes. Source geometry repairs,
projection operation, attribution, use limits, late-period limitations and
source anomalies are explicit in the manifests and methodology.

The optional MapLibre layer fetches only the selected snapshot. It is below
person routes and place markers and provides month selection, timeline slider,
opacity, legend, raw hover/click details, attribution and methodology. A failed
snapshot request leaves the basemap and project evidence usable and presents a
retryable diagnostic. October 1944–May 1945 is visibly marked limited/static.
Transnistria and Reichskommissariat Ukraine remain separate raw source
features; no civil/military administration field is invented.

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
- a visible no-key OpenStreetMap raster basemap with contributor attribution;
- an inline local background/grid fallback that keeps project places, routes,
  filters and layer controls usable when raster tiles fail, with a visible
  fallback notice;
- an explicit MapLibre/WebGL initialization diagnostic instead of a blank map;
- a locally served optional Historical administration layer with 88 selected-
  month snapshots, raw attributes, legend, opacity and methodological warning;
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
npm run historical:verify
npm test
npm run typecheck
npm run lint
npm run build
```

All commands pass. The test suite contains 31 deterministic, map-style,
research-rule, conversion, date-selection and historical-distinction tests.
The production build generates the overview, indexes, both document pages and
all four person pages, with dynamic filtered map, place and review views.

Browser verification for the corrected map covered 1440×1000 desktop and
390×844 mobile viewports. MapLibre hydrated with five visible core places, four
route legs and a connected OpenStreetMap basemap. The browser requested only
local application assets and OpenStreetMap raster PNG tiles: the inline style
does not request external style JSON, glyphs or sprites. Basemap, location,
route, unresolved and EHRI toggles; confidence filtering; person and place
selection; and one-shot timeline play/reset were exercised. Simulated raster
failure left the grid, routes, places and controls visible with a fallback
notice. Simulated WebGL 2 failure produced the diagnostic state. The only
console messages during the clean connected run were headless SwiftShader
performance warnings; there were no application errors.

The historical acceptance pass exercised 1440×1000 desktop and 390×844 mobile
widths. It verified the month selector, timeline slider, opacity, primary and
limited/static states, raw hover/click details, source warning and attribution.
The August 1941 map visibly rendered Transnistria with raw
`Romanian-occupied` and `Gheorghe Alexianu (Governor)` details while the five
core places and four person routes remained above the polygons. Network
inspection showed the manifest plus only the selected monthly GeoJSON, never
all snapshots. A forced historical-snapshot failure kept the basemap, places,
routes and controls active and exposed the retry action.

The application is not described as fully offline-capable. Without external
network access, the locally served historical snapshots, project evidence,
controls and grid remain usable, but the geographic OpenStreetMap basemap is
unavailable.

`git diff -- data/source` is empty.

## Visual artifacts

- [`overview-desktop.png`](../artifacts/screenshots/overview-desktop.png)
- [`map-desktop.png`](../artifacts/screenshots/map-desktop.png)
- [`map-working-desktop.png`](../artifacts/screenshots/map-working-desktop.png)
- [`map-working-mobile.png`](../artifacts/screenshots/map-working-mobile.png)
- [`map-local-fallback-desktop.png`](../artifacts/screenshots/map-local-fallback-desktop.png)
- [`person-iancu-aizic.png`](../artifacts/screenshots/person-iancu-aizic.png)
- [`review-desktop.png`](../artifacts/screenshots/review-desktop.png)
- [`overview-mobile.png`](../artifacts/screenshots/overview-mobile.png)
- [`historical-administration-desktop.png`](../artifacts/screenshots/historical-administration-desktop.png)
- [`historical-administration-transnistria-desktop.png`](../artifacts/screenshots/historical-administration-transnistria-desktop.png)
- [`historical-administration-mobile-controls.png`](../artifacts/screenshots/historical-administration-mobile-controls.png)
- [`historical-administration-mobile-map.png`](../artifacts/screenshots/historical-administration-mobile-map.png)

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
- WMS/WMTS services remain a disabled registry placeholder. The new European
  Borders WWII layer is local and month-aware; the default geographic basemap
  still uses public OpenStreetMap raster tiles, with the neutral local grid as
  its external-service fallback.
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
4. Add any further dated boundary datasets or licensed WMS/WMTS services
   through the layer registry with equally explicit provenance and limits.
5. Design a persistent, auditable review-decision workflow only after the
   file-backed V1 research process has been evaluated by researchers.
6. Add future dossier adapters behind the existing normalized contracts and
   keep cross-dossier identity matching candidate-only until human review.

## Presentation Map status

`/presentation/map` now uses the shared MapLibre workspace in presentation mode.
It has a full-Europe historical default, public category legend, raw historical
details, month selection, opacity, Europe/Project region camera controls,
person/story selection, route timeline, manual one-shot playback, compact
layer groups, fullscreen and hide-interface controls. `/map` remains the
advanced Research Map and now places Dossiers, Event type and Confidence under
collapsed Advanced filters; map layers are grouped without removing existing
capabilities.

The WMS/WMTS toggle is not a partially wired layer. No service registry, source
data or MapLibre source is configured for it in V1, so it is omitted from the
Presentation Map and retained only as a disabled, explanatory Research Map
placeholder. The local EHRI and historical layers are separate, valid local
data paths.

The latest presentation-map refinement keeps the people list focused on the
documented head/declarant and moves mentioned people into collapsed dossier
subsections integrated into the same family card. A person/family search field
supports larger collections. Both map panels have sticky headers, compact
directory rows, camera presets expose their active state, and zoom controls
reserve space beside the people panel. Person selection uses a closer local
fit with safe space for open panels and the timeline; opening or closing a
panel preserves the current camera. Repeated/reverse route
segments use separate visual lanes, and place details can show grouped,
source-bound people and documented context without assigning a relative's route
to another person. In the Research Map, persons are selected from Filters →
Person or Group on the left; Individual routes must remain enabled under
Layers → People and movement, and clicking a route opens its evidence in the
right Context panel.

The current refinement adds a typed, source-bound Person story dialog to both
map modes. It is opened from a map-place person button or from the selected
person detail. The dialog keeps the useful Claude prototype structure—compact
profile fields, status and dossier context, a chronological life route,
materials and testimony—while omitting fields absent from the source. The
Claude fixture now carries those profile and event records rather than only
names and routes. Its right-hand Presentation Map panel also has the compact
public legend; the left panel remains reserved for view settings.

## Final handoff verification

On 14 July 2026 the full historical output was verified again: both regional
and full derivatives passed checksum validation for 88 monthly files and
`Territorial_Changes`. `npm run normalize` completed without changing the
normalized collections. The final checks passed:

- `npm test`: 29 tests passed;
- `npm run typecheck`: passed;
- `npm run lint`: passed;
- `npm run build`: passed, including `/presentation/map` and `/map` routes;
- `npm audit --json`: 0 vulnerabilities.

Playwright/Chromium verification covered 1366×768, 1920×1080 and 390×844.
Presentation checks included full-Europe August 1941, pre-Transnistria and
March/April 1944 data checks, selected-person fitting, one-shot playback,
EHRI, reset, Europe/Project region views, fullscreen, hide/show interface and
no horizontal mobile overflow. The observed network log requested the full
manifest and only the selected `1941-08.geojson` snapshot, alongside map tiles.
The Research Map retained the regional layer and its advanced controls.

Current screenshots:

- [`presentation-europe.png`](../output/playwright/presentation-europe.png)
- [`presentation-person.png`](../output/playwright/presentation-person.png)
- [`presentation-hidden-final.png`](../output/playwright/presentation-hidden-final.png)
- [`presentation-mobile.png`](../output/playwright/presentation-mobile.png)
- [`research-map-final.png`](../output/playwright/research-map-final.png)

The development server is intentionally left running at
`http://127.0.0.1:3000`.

## Vercel access

The linked Vercel project is `dosare-dorohoi-platform-chatgpt` under the
`alexmolovatacdrfs-projects` scope. Vercel Authentication is explicitly enabled
for production deployment URLs and all previews. The current unique Production
deployment URL is protected and redirects unauthenticated visitors to Vercel
login. Eugenia should use her own Vercel account after being added as a
viewer/member to the Vercel team; a shared password is not stored in this
repository.

Important plan limitation: on Hobby, the stable project production domain can
remain publicly accessible even when standard Vercel Authentication is enabled.
For the private review use the protected unique deployment URL supplied in the
handoff, not the stable `*.vercel.app` project alias. If the stable alias must
also be private, use a Pro plan with the required Deployment Protection scope
or an eligible Password Protection add-on. The exact setting is in Vercel
Dashboard → Project → Settings → Deployment Protection. See the official
[Deployment Protection documentation](https://vercel.com/docs/deployment-protection)
and [Vercel Authentication documentation](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).
