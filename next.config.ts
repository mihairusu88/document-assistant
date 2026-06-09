import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Node-based text extractors out of the bundle; load them at runtime.
  serverExternalPackages: [
    "pdfreader",
    "mammoth",
    "word-extractor",
    "@qdrant/js-client-rest",
  ],
};

export default nextConfig;
