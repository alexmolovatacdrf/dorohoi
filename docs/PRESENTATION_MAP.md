# Public Presentation Map

The Presentation Map is the public, lower-density map experience at
`/presentation/map`. The advanced research workspace remains at `/map`.
Both use the shared `MapWorkspace` MapLibre component; the explicit
`mode="presentation"` selects the public dataset, controls, layout and camera
defaults without duplicating the map renderer.

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
full European extent when no person is selected. Selecting a person shows a
small story card and bottom timeline. Playback is manual, progressive, runs
once and never loops; Replay/Play once is never triggered on page load.

The left panel collapses, the story card appears only after a selection, and
the timeline stays along the bottom. Hide interface leaves the map, timeline
and compact legend visible; Show interface restores the controls. Full screen
uses the browser Fullscreen API and reports the current state to assistive
technology.

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
