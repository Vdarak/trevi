import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [],
  output: 'standalone', // Optimized for Docker deployment
  experimental: {
    proxyTimeout: 150000, // 150 seconds
  }
}

export default nextConfig;
