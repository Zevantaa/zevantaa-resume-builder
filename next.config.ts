import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 10 MB resume + 5 MB photo, with room for multipart form overhead.
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
