# Public Presentation Map

The Presentation Map is the public, lower-density map experience at
`/presentation/map`. The advanced research workspace remains at `/map`.
Both use the shared `MapWorkspace` MapLibre component; the explicit
`mode="presentation"` selects the public dataset, controls, layout and camera
defaults without duplicating the map renderer.

## Test datasets

The presentation page has a visible test-data switcher:

- `/presentation/map?dataset=project` uses the current normalized, evidence-bound
  project collections;
- `/presentation/map?dataset=claude-demo` uses the separate map fixture derived
  from the embedded data in `Platforma_WJC (10).html`.

The Claude fixture contains 48 persons, 11 dossiers, 15 places and 26 route
segments. It is deliberately kept under `data/demo/`, outside
`data/normalized/`; it is suitable for testing person selection, dossier
context, camera fitting and playback, but it is not a normalized research
dataset. Its source SHA-256 is recorded in
`data/demo/claude-map-demo.json`. The fixture can be regenerated from the
downloaded HTML with:

```bash
node scripts/presentation/derive-claude-demo-map.mjs > data/demo/claude-map-demo.json
```

The command expects the source at
`/mnt/c/Users/Alex Molovata/Downloads/Platforma_WJC (10).html`; no source data
is written back. This is an explicitly isolated demo fixture, not part of the
normalized research bundle.

## Public experience

The presentation mode uses
`/data/historical-administration-full/manifest.json`. Its initial historical
view fits the full European extent from the manifest and loads August 1941 by
default. Changing the month changes one selected snapshot; the browser never
loads all 88 monthly files. Project routes, places and markers are registered
above the historical polygons.

The visible controls are intentionally limited to:

- person/story selector;
- month/year and polygon opacity;
- historical context and modern basemap;
- persons, routes and important places;
- collapsed-by-default EHRI and unresolved-place layers;
- EN/RO site language control, reset, full screen and hide-interface controls.

The public map does not expose dossiers, event type or confidence filters. The
research map retains those capabilities under its collapsed Advanced filters
group. Public labels avoid source IDs, schema names and confidence codes while
selected historical polygons still expose the raw documentary fields in the
details card: `Name`, `Foreign_Po`, `Head_of_St`, `Govt_in_Ex`, snapshot month,
public category and attribution.

## Camera, timeline and interface

Europe view fits the full historical-data extent. Project region fits the
documented project window `[19.0, 43.3, 34.5, 52.6]`. Reset returns to the
contextually relevant state: the selected person's route and places, or the
full European extent when no person is selected. Selecting a person animates
to a bounding box covering all of that person's documented route endpoints and
places; it does not inherit relatives' routes. The person selector groups
people under their dossier and marks the documented head/declarant separately.
The selected-person card also lists other people in the same dossier when the
normalized data supports that relationship.

The bottom timeline uses a slow, one-shot progression. Each route is rendered
as a smooth visual curve between its documented endpoints, with a moving
progress marker; reverse or repeated movements between the same two places are
assigned separate visual lanes so they do not sit on top of one another. The
curve is explicitly a presentation aid, not a claim about the exact historical
road. Playback never starts automatically and never loops. During playback the
current documented place and the route note are shown in the timeline card.

The left panel collapses, the right people panel can also collapse, and the
timeline stays along the bottom. Selected story details appear in the people
panel after a selection. Hide interface leaves the map, timeline
and compact legend visible; Show interface restores the controls. Full screen
uses the browser Fullscreen API and reports the current state to assistive
technology.

The left presentation panel contains only map-view controls: camera presets,
historical month, opacity and layers. Europe view and Project region expose an
explicit pressed/active state. People, families and dossier members are
selected in the separate right-side People and families panel. A family card
shows only its documented head/declarant by default; people mentioned inside
the dossier are in a collapsed subsection and the head is not repeated there.
The panel header stays visible while its list is scrolled. Selecting an
individual fits a closer bounding box over all of that person's documented
endpoints and places, retains individual route ownership and enables that
person's timeline. Clicking a place opens grouped, source-bound person
connections when the normalized data supports them. The global site footer is
hidden on map workspaces so it cannot reduce the map viewport; it remains
available on the editorial and research pages.

The map zoom controls are positioned outside the open people panel on desktop
and above the bottom timeline on mobile. Layer symbols use a consistent visual
set for territory, basemap, places, routes, EHRI and unresolved records.

Historical polygon details are interaction-based: they do not open on pointer
hover. A normal click or a right-click on a polygon opens the closeable raw
attribute popup and the selected-detail panel.

## Typed module configuration

Public modules are controlled by the typed file-backed configuration in
`config/presentation-map.ts`:

```ts
export interface PresentationMapConfig {
  personSelector: boolean;
  historicalAdministration: boolean;
  routes: boolean;
  projectPlaces: boolean;
  ehri: boolean;
  unresolvedPlaces: boolean;
  timeline: boolean;
  detailsPanel: boolean;
  legend: boolean;
  fullscreen: boolean;
  hideInterface: boolean;
  europeView: boolean;
  projectRegionView: boolean;
}
```

Change the exported values for a future presentation variant. There is no
visual admin editor in V1. The configuration changes which modules are exposed;
it does not weaken validation, invent coordinates or change source data.

## Public historical legend and limits

The legend is driven by the full manifest's `presentationVocabulary`, not by
silently replacing `Foreign_Po`. Its categories are sovereign/state territory,
Romanian-occupied or administered territory, German-occupied or administered
territory, Soviet-controlled territory, and unresolved/other classification.
The raw source fields remain authoritative in the details panel.

The historical layer is a set of monthly analytical boundary snapshots. It is
not a complete frontline record and the source does not provide a dedicated
civil/military administration field. February 1938–September 1944 is the
primary interval; October 1944–May 1945 is marked limited/static. Transnistria
and Reichskommissariat Ukraine remain separate source features where present;
Transnistria is absent from April 1944 onward. These distinctions are tested
in `tests/historical-administration.test.ts`.

The public basemap is an external OpenStreetMap raster source. If it is
unavailable, the locally rendered neutral grid and project evidence remain
usable. The local EHRI extract is not a live synchronized catalog, and
unresolved places never receive fabricated coordinates.

The historical polygon opacity slider is shown directly beneath the Historical
administration toggle. It starts at 28%, which keeps city, river and basemap
detail legible; the public range is 10–65%.

The map uses zoom controls only. The MapLibre compass/pitch arrow has been
removed because the public map is a flat 2D atlas. A black `N` button visible
when running `next dev` belongs to the Next.js development overlay, not to the
map application; it is not present in a production build.

## Verification and screenshots

Useful commands:

```bash
npm run normalize
npm run historical:verify
npm test
npm run typecheck
npm run lint
npm run build
```

Browser verification should cover Europe view, selected-person view, August
1941, a pre-Transnistria month, March 1944 and April 1944, both viewport sizes
and hide-interface/fullscreen behavior. Screenshots captured for the current
handoff are stored under `output/playwright/`.
