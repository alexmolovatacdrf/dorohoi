import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPresentationOnlyAllowedPath } from "@/lib/presentation-only";

/**
 * The main Vercel project leaves every application route unchanged. A second
 * project can set PRESENTATION_ONLY=true to expose a gradual-review link for
 * non-technical collaborators without publishing the research workspace.
 */
export function proxy(request: NextRequest) {
  if (process.env.PRESENTATION_ONLY !== "true") {
    return NextResponse.next();
  }

  if (isPresentationOnlyAllowedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const presentationUrl = request.nextUrl.clone();
  presentationUrl.pathname = "/presentation/map";
  presentationUrl.search = request.nextUrl.searchParams.has("dataset")
    ? `?dataset=${encodeURIComponent(request.nextUrl.searchParams.get("dataset") ?? "")}`
    : "";
  return NextResponse.redirect(presentationUrl);
}

export const config = {
  matcher: ["/:path*"],
};
