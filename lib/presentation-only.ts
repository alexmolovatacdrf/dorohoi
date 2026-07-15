const PRESENTATION_ROUTE = /^\/presentation\/map\/?$/;
const NEXT_ASSET_ROUTE = /^\/_next(?:\/|$)/;
const HISTORICAL_ASSET_ROUTE = /^\/data\/historical-administration-full(?:\/|$)/;
const PUBLIC_SHELL_ASSET_ROUTE = /^\/(?:favicon\.ico|icon\.svg|robots\.txt|sitemap\.xml)$/;

/**
 * Paths that must remain available when a Vercel project is configured as a
 * presentation-only deployment. The application route is intentionally
 * narrow; static Next assets and the selected full-Europe snapshot resources
 * are the only additional paths needed by the Presentation Map.
 */
export function isPresentationOnlyAllowedPath(pathname: string): boolean {
  return (
    PRESENTATION_ROUTE.test(pathname) ||
    NEXT_ASSET_ROUTE.test(pathname) ||
    HISTORICAL_ASSET_ROUTE.test(pathname) ||
    PUBLIC_SHELL_ASSET_ROUTE.test(pathname)
  );
}
