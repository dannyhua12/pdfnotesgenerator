import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.pdf$/,
      type: 'asset/resource'
    });
    return config;
  },
  // Ignore test files during build
  experimental: {
  }
};

export default nextConfig;
