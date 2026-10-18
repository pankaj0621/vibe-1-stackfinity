import path from "node:path";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  // Only use `.next-dev` when running the local development server (`next dev`).
  // Production builds (`next build`) will always output to standard `.next`.
  ...(phase === PHASE_DEVELOPMENT_SERVER ? { distDir: ".next-dev" } : { distDir: ".next" }),
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd(), "src"),
    };
    return config;
  },
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

