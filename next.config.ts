import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root: a stray bun.lock in ~ and the removed
  // package-lock.json otherwise make Next infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        // Player headshot "spots" (circular PNGs).
        protocol: "https",
        hostname: "midfield.mlbstatic.com",
        pathname: "/v1/people/**",
      },
      {
        // Team logos (SVG — served unoptimized automatically).
        protocol: "https",
        hostname: "www.mlbstatic.com",
        pathname: "/team-logos/**",
      },
    ],
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
