'use client'

import { useEffect } from 'react'
import { bootstrapTelegramApp } from '@/lib/telegram/webapp'

/**
 * Client component mounted once in the root layout.
 * Calls Telegram WebApp ready() + expand() after hydration.
 * Has no visible output.
 */
export default function TelegramBootstrap() {
  useEffect(() => {
    bootstrapTelegramApp()
  }, [])

  return null
}
