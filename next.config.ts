import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  watchOptions: {
    pollIntervalMs: 1000,
  },
}

export default nextConfig
