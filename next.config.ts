import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [],
  output: 'standalone', // Optimized for Docker deployment
  experimental: {
    proxyTimeout: 150000, // 150 seconds
  },
  async rewrites() {
    return [
      {
        source: '/mkc/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
