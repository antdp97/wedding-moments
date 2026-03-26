import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920, 2560],
    imageSizes: [96, 128, 192, 256, 384],
    remotePatterns: [
      // AWS S3 (all regions)
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Cloudflare R2
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      // Railway deployments
      { protocol: "https", hostname: "**.railway.app" },
      // Local backend in development
      { protocol: "http", hostname: "localhost", port: "4000" },
    ],
  },
};

export default nextConfig;
