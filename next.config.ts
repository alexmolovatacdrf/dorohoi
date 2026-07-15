import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Next.js development indicator is environment UI, not part of the
  // public map. Errors still surface normally when the indicator is disabled.
  devIndicators: false,
};

export default nextConfig;
