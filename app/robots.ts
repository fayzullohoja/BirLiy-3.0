import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/privacy'],
        disallow: [
          '/',
          '/dashboard/',
          '/waiter/',
          '/kitchen/',
          '/owner/',
          '/admin/',
          '/api/',
          '/receipt/',
        ],
      },
    ],
  }
}
