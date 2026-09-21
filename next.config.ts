import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin pulls in jwks-rsa -> jose, which ships an ESM build that
  // conflicts with jwks-rsa's require() calls when bundled by
  // Turbopack/webpack for the serverless function. Keeping it external
  // makes Next.js require() it directly from node_modules at runtime
  // instead of bundling it.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
