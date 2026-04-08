import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import TelegramBootstrap from '@/components/shared/TelegramBootstrap'
import { Toaster } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'BirLiy Kassa',
  description: 'Система управления заказами для ресторанов',
  // Prevent indexing — this is an internal tool
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Use device color scheme for status bar
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f1f18' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-surface overflow-x-hidden">
        <TelegramBootstrap />
        <Toaster />
        {children}
      </body>
    </html>
  )
}
