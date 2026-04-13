import crypto from 'crypto'
import type { TelegramInitData } from '../types'

export interface TelegramWidgetData {
  id:         number
  first_name: string
  last_name?: string
  username?:  string
  photo_url?: string
  auth_date:  number
  hash:       string
}

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * Must run server-side only.
 *
 * Algorithm per Telegram docs:
 * 1. Extract `hash` from initData params.
 * 2. Sort remaining params as "key=value" lines alphabetically.
 * 3. HMAC-SHA256 the data-check-string with key = HMAC-SHA256("WebAppData", botToken).
 * 4. Compare result hex with the extracted hash.
 */
export function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
): { valid: boolean; data: TelegramInitData | null } {
  try {
    const params = new URLSearchParams(rawInitData)
    const hash = params.get('hash')
    if (!hash) return { valid: false, data: null }

    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (computedHash !== hash) return { valid: false, data: null }

    // Check auth_date is not older than 1 hour
    const authDate = parseInt(params.get('auth_date') ?? '0', 10)
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds - authDate > 3600) return { valid: false, data: null }

    const userRaw = params.get('user')
    const parsed: TelegramInitData = {
      user: userRaw ? JSON.parse(userRaw) : undefined,
      chat_instance: params.get('chat_instance') ?? undefined,
      chat_type: params.get('chat_type') ?? undefined,
      auth_date: authDate,
      hash,
      start_param: params.get('start_param') ?? undefined,
    }

    return { valid: true, data: parsed }
  } catch {
    return { valid: false, data: null }
  }
}

/**
 * Validates data received from the Telegram Login Widget.
 *
 * Widget auth differs from Mini App initData:
 *  - secret key = SHA256(botToken)
 *  - payload is a plain object, not URLSearchParams
 *  - freshness window is 24h
 */
export function validateTelegramWidgetData(
  data: Record<string, unknown>,
  botToken: string,
): { valid: boolean; data: TelegramWidgetData | null } {
  try {
    const hash = typeof data.hash === 'string' ? data.hash : null
    if (!hash) return { valid: false, data: null }

    const dataCheckString = Object.keys(data)
      .filter((key) => key !== 'hash' && typeof data[key] !== 'undefined')
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n')

    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest()

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (computedHash !== hash) return { valid: false, data: null }

    const authDate = Number(data.auth_date)
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (!Number.isFinite(authDate) || nowSeconds - authDate > 86400) {
      return { valid: false, data: null }
    }

    const parsed: TelegramWidgetData = {
      id:         Number(data.id),
      first_name: String(data.first_name ?? ''),
      last_name:  data.last_name ? String(data.last_name) : undefined,
      username:   data.username ? String(data.username) : undefined,
      photo_url:  data.photo_url ? String(data.photo_url) : undefined,
      auth_date:  authDate,
      hash,
    }

    if (!parsed.id || !parsed.first_name) {
      return { valid: false, data: null }
    }

    return { valid: true, data: parsed }
  } catch {
    return { valid: false, data: null }
  }
}
