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

The Claude fixture contains 48 persons, 11 dossiers, 15 prototype places and
26 route segments. The map adapter adds the separate 385-record local EHRI
overlay from the normalized catalog when the EHRI layer is enabled; those
overlay places have no invented person or route associations. The fixture is
deliberately kept under `data/demo/`, outside
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

The Research Map also exposes the same switcher at `/map`. Its default remains
the normalized project collection; `/map?dataset=claude-demo` loads the isolated
Claude fixture into the advanced research interface without mixing it into
`data/normalized/`.

## Presentation-only review deployment

For a gradual external review, a separate Vercel project can set the server
environment variable `PRESENTATION_ONLY=true`. The request proxy then permits
only `/presentation/map`, Next static assets and the full historical snapshot
resources required by that page. Other application routes redirect to
Presentation Map, and the global navigation is omitted from that deployment.
The main project does not set this variable and therefore keeps the complete
Research Map and research pages.

This is route-level product separation, not a data-secrecy boundary: the
historical GeoJSON files needed by the browser remain directly requestable as
public assets. Sensitive material must not be placed in this static deployment.

The current protected review deployment is:

`https://dosare-dorohoi-presentation-o20jihmr1.vercel.app/presentation/map?dataset=project`

On the Hobby plan, share the unique deployment URL above rather than the
stable `*.vercel.app` project alias. The unique URL is the one covered by
Vercel Authentication and requires Eugenia to sign in with the invited Vercel
account.

## Public experience

The presentation mode uses
`/data/historical-administration-full/manifest.json`. Its initial historical
view fits the practical Europe camera window `[-11.0, 35.0, 62.5, 72.0]`, from
Portugal to the Ekaterinburg/Perm area, and loads August 1941 by default. The
historical layer itself retains the complete source extent; only the initial
public camera is bounded for useful viewing. Changing the month changes one
selected snapshot; the browser never loads all 88 monthly files. Project
routes, places and markers are registered above the historical polygons.

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

Europe view fits the practical Portugal–Ekaterinburg/Perm camera window.
Project region fits the documented project window `[19.0, 43.3, 34.5, 52.6]`.
Reset returns to the contextually relevant state: the selected person's route
and places, or the practical Europe window when no person is selected.
Selecting a person fits a safe camera box covering all of that person's
documented route endpoints and places while accounting for the left controls,
right people panel and bottom timeline. Closing or opening either panel does
not refit or reset the user's current camera. It does not inherit relatives'
routes. The person selector groups people under their dossier and marks the
documented head/declarant separately.
The selected-person card also lists other people in the same dossier when the
normalized data supports that relationship.

The bottom timeline uses a slow, one-shot progression of 4.6 seconds per
documented route segment. In both Presentation Map
and Research Map, each route is rendered as a smooth visual curve between its
documented endpoints, with directional arrow symbols and a moving progress
marker. Reverse or repeated movements between the same two places are assigned
separate visual lanes so they do not sit on top of one another. The curve is
explicitly a presentation aid, not a claim about the exact historical road.
Playback never starts automatically and never loops. During playback the
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
the dossier are in a collapsed subsection, visually integrated into the same
family card, and the head is not repeated there. The panel also has a name/family
search field so the visible list does not need to be navigated manually when
the collection grows. Each family card keeps the mentioned-person count on the
head/declarant row; the disclosure triangle follows that count, and expanding
it reveals only the individual names plus the secondary internal-record line.
The selected-person story card uses the same compact disclosure pattern for
other people in that dossier.
The panel header stays visible while its compact, tightly spaced list is
scrolled. Selecting an
individual fits a closer bounding box over all of that person's documented
endpoints and places, retains individual route ownership and enables that
person's timeline. Clicking a place opens grouped, source-bound person
connections when the normalized data supports them. The small anchored place
popup now lists those people as buttons; selecting a name opens a centered,
scrollable Person story dialog with source-bound profile fields, a chronological
life route, materials and testimony when the dataset supplies them. The same
dialog is available from the selected-person detail in both map modes. The
right panel also contains the compact public legend for historical territory,
movement, important-place categories, EHRI and unresolved records; the left
panel remains reserved for map settings. The global site footer is
hidden on map workspaces so it cannot reduce the map viewport; it remains
available on the editorial and research pages.

When a person is selected, clicking one of that person's visible place points
opens a compact person-at-place summary in the detail panel. It distinguishes
documented birth/origin, death/loss, camp or ghetto, forced labour,
deportation/evacuation, return and route-endpoint connections where the source
supports them, and retains the available source date, description and source
label. A route endpoint without a direct person-place mention is labelled as a
route connection rather than being upgraded to an event. The same summary is
also shown in a small MapLibre popup anchored beside the clicked place, so the
connection can be read without leaving the map; the detailed panel remains
available for provenance and the complete context. The Research Map uses the
same popup and detail summary. A second click on the same place, route or
historical polygon clears the selection and closes the synthesized detail
state; the popup close button remains available as well. Map controls keep
their readable targets but use tighter row spacing so the left panel requires
less scrolling.

Map route dates and historical snapshot dates are formatted through the shared
date formatter: English uses the English calendar convention and Romanian uses
the Romanian calendar convention. Unresolved raw date wording remains visible
when no parsed date is available.

The map zoom controls are positioned outside the open people panel on desktop
and above the bottom timeline on mobile. Layer symbols use a consistent visual
set for territory, basemap, places, routes, EHRI and unresolved records.

Historical polygon details are interaction-based: they do not open on pointer
hover. A normal click or a right-click on a polygon opens the closeable raw
attribute popup and the selected-detail panel.

## Shared people and route presentation

The right-side `Families and mentioned people` directory is available in both
map modes. It uses the same person-centred grouping: the documented head or
declarant appears as the family entry, while people mentioned in that dossier
are inside a native collapsible subsection and are selectable individually.
The directory includes name/family search and keeps dossier identifiers as
secondary internal-record metadata. In Research Map this directory is in the
right `Context` panel; advanced filters remain in the left `Filters` panel and
the route layer remains under `Layers → People and movement`.

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

The compact MapLibre attribution hover control is not used in Presentation Map:
the full source attribution remains in the historical settings and public
legend context. Research Map keeps ordinary, always-visible attribution text.

The Claude-derived person stories are generated from the embedded prototype
fields without inventing values. A profile field is omitted when the source is
empty; dates retain their source precision and use the shared English/Romanian
formatter. The normalized project selector produces the same typed story model
from person, event, place, route and document provenance.

Claude Demo uses the same EHRI overlay as Project data: 385 local catalog
records are available under More layers → EHRI camps and ghettos. They remain
an independent external/context layer and are not assigned to Claude people.

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
