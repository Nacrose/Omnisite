import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Strip console.log/warn from production builds (keep error)
  compiler: {
    removeConsole: { exclude: ['error'] },
  },
  // Tree-shake large icon libraries
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Security headers are set in src/middleware.ts (runs on every request,
  // including API routes). This avoids duplication between middleware and
  // next.config headers().
};

export default withBundleAnalyzer(nextConfig);
