/**
 * Design tokens supplied in Design_Tokens_WJC.md.
 *
 * This module intentionally contains only values present in that document.
 * Presentation-specific code may consume these tokens without changing the
 * research map's existing visual vocabulary.
 */
export const wjcDesignTokens = {
  color: {
    paper: "#E7EAEE",
    paperCard: "#F3F5F7",
    ink: "#141A22",
    inkMuted: "#5C6875",
    line: "#C9CFD8",
    stamp: "#4B3D9E",
  },
  semantic: {
    origin: "#2C5C58",
    labour: "#9A6E15",
    deportation: "#38598B",
    death: "#6E1F2A",
    ghetto: "#6A4E9C",
    ehri: "#7A5C9E",
    unresolved: "#8B96A2",
  },
  historical: {
    romania: "#C08A1E",
    hungary: "#7D7D2F",
    ussr: "#A03434",
    germanOccupied: "#3F4147",
    transnistria: "#4B3D9E",
    transnistriaDashArray: [7, 5],
  },
  typography: {
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    serif: "'IBM Plex Serif', Georgia, serif",
    sans: "'IBM Plex Sans', system-ui, sans-serif",
  },
  route: {
    standardWidth: 3,
    flowMaxWidth: 12,
    unknownWidth: 1.5,
    returnWidth: 2.6,
    walkingDashArray: [2, 7],
    trainTickLength: 7,
    trainTickRepeat: 16,
  },
  basemap: {
    historicalLayerOpacity: 0.38,
  },
  animation: {
    trainStepMilliseconds: 12,
    walkingStepMilliseconds: 40,
    documentedStationPauseMilliseconds: 600,
  },
} as const;
