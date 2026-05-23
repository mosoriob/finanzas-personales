import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["open-banking-chile", "puppeteer-core", "playwright-core"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/dev.db"],
  },
};

export default nextConfig;
