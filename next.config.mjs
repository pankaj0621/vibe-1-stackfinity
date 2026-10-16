import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  // Only use `.next-dev` when running the local development server (`next dev`).
  // Production builds (`next build`) will always output to standard `.next`.
  ...(phase === PHASE_DEVELOPMENT_SERVER ? { distDir: ".next-dev" } : { distDir: ".next" }),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
});

export default nextConfig;

