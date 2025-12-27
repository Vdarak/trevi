import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://10.0.0.146:8000/:path*',
      },
    ];
  },
};

export default nextConfig;
