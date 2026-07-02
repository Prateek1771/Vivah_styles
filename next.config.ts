import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static marketing landing page lives at public/index.html; Next doesn't
  // auto-serve public/index.html at /, so rewrite the root to it.
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
  images: {
    // InsForge storage host (e.g. 68bdfaz8.ap-southeast.insforge.app) for next/image.
    remotePatterns: [{ protocol: 'https', hostname: '**.insforge.app' }],
  },
};

export default nextConfig;
