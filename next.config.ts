import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

export default nextConfig;
