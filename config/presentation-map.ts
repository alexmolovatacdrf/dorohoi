/**
 * Public map module switches.
 *
 * This is intentionally a typed file-backed configuration, not an admin UI.
 * A later presentation can select a different module combination without
 * changing the shared MapLibre workspace or the historical data contract.
 */
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

export const presentationMapConfig: PresentationMapConfig = {
  personSelector: true,
  historicalAdministration: true,
  routes: true,
  projectPlaces: true,
  ehri: true,
  unresolvedPlaces: true,
  timeline: true,
  detailsPanel: true,
  legend: true,
  fullscreen: true,
  hideInterface: true,
  europeView: true,
  projectRegionView: true,
};
