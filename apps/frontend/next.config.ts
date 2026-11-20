import type { NextConfig } from "next";

const cdnUrl =
  process.env.NEXT_PUBLIC_MEDIA_CDN_URL ||
  process.env.AWS_PUBLIC_URL ||
  "";

const cdnPattern = (() => {
  if (!cdnUrl) {
    return [];
  }

  try {
    const parsedUrl = new URL(cdnUrl);
    return [
      {
        protocol: parsedUrl.protocol.replace(":", "") as "http" | "https",
        hostname: parsedUrl.hostname,
        ...(parsedUrl.port ? { port: parsedUrl.port } : {}),
      },
    ];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920, 2560],
    qualities: [25, 50, 60, 70, 75],
    imageSizes: [96, 128, 192, 256, 384],
    remotePatterns: [
      ...cdnPattern,
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
