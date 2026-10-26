import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone bundle for the Azure Container Apps image; set in the Dockerfile (Windows can't symlink it locally).
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  transpilePackages: ["@sylvia/core", "@sylvia/ui"],
};

export default nextConfig;
