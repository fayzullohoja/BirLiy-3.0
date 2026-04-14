/**
 * Telegram WebApp SDK utilities.
 *
 * The Telegram WebApp object is injected by the Telegram client at
 * window.Telegram.WebApp. This module provides typed helpers that
 * safely access it — the app must work without it during local dev.
 */

import type { TelegramInitData, TelegramUser } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: TelegramInitData
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  isClosingConfirmationEnabled: boolean

  ready(): void
  expand(): void
  close(): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void

  BackButton: {
    isVisible: boolean
    show(): void
    hide(): void
    onClick(fn: () => void): void
    offClick(fn: () => void): void
  }

  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText(text: string): void
    onClick(fn: () => void): void
    offClick(fn: () => void): void
    show(): void
    hide(): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
  }

  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }

  showAlert(message: string, callback?: () => void): void
  showConfirm(message: string, callback: (confirmed: boolean) => void): void
  openLink(url: string): void
  showPopup(params: {
    title?: string
    message: string
    buttons?: Array<{ id?: string; type?: string; text?: string }>
  }, callback?: (buttonId: string) => void): void
}

// ─── Accessors ────────────────────────────────────────────────────────────────

/**
 * Returns the Telegram WebApp instance or null if not in Telegram context.
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

/**
 * Returns true if running inside the Telegram WebApp context.
 */
export function isInTelegram(): boolean {
  return getTelegramWebApp() !== null
}

/**
 * Returns the Telegram user from initDataUnsafe.
 * NOTE: initDataUnsafe is not verified — validate initData on the server.
 */
export function getTelegramUser(): TelegramUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null
}

/**
 * Returns the raw initData string for server-side validation.
 */
export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Call once on app mount to signal Telegram the app is ready and to expand it.
 */
export function bootstrapTelegramApp() {
  const twa = getTelegramWebApp()
  if (!twa) return

  twa.ready()
  twa.expand()
  twa.enableClosingConfirmation()
}

// ─── Haptics ─────────────────────────────────────────────────────────────────

export function hapticLight() {
  getTelegramWebApp()?.HapticFeedback.impactOccurred('light')
}

export function hapticMedium() {
  getTelegramWebApp()?.HapticFeedback.impactOccurred('medium')
}

export function hapticSuccess() {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred('success')
}

export function hapticError() {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred('error')
}

export function hapticWarning() {
  getTelegramWebApp()?.HapticFeedback.notificationOccurred('warning')
}

// ─── Back Button ─────────────────────────────────────────────────────────────

export function showBackButton(handler: () => void) {
  const twa = getTelegramWebApp()
  if (!twa) return
  twa.BackButton.onClick(handler)
  twa.BackButton.show()
}

export function hideBackButton(handler?: () => void) {
  const twa = getTelegramWebApp()
  if (!twa) return
  if (handler) twa.BackButton.offClick(handler)
  twa.BackButton.hide()
}

// ─── Main Button ─────────────────────────────────────────────────────────────

export function showMainButton(text: string, handler: () => void) {
  const twa = getTelegramWebApp()
  if (!twa) return
  twa.MainButton.setText(text)
  twa.MainButton.onClick(handler)
  twa.MainButton.show()
}

export function hideMainButton(handler?: () => void) {
  const twa = getTelegramWebApp()
  if (!twa) return
  if (handler) twa.MainButton.offClick(handler)
  twa.MainButton.hide()
}

// ─── Server-Side Init Data Validation ────────────────────────────────────────

/**
 * Parse the raw Telegram initData string into a key-value map.
 * Used server-side to validate authenticity via HMAC-SHA256.
 */
export function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}
