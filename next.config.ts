import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
