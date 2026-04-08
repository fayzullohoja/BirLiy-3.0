import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disable x-powered-by header
  poweredByHeader: false,

  // Required for Telegram Mini App iframe embedding
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Allow embedding in Telegram
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.telegram.org https://t.me",
          },
          // General security
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
