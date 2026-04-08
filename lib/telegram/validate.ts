import crypto from 'crypto'
import type { TelegramInitData } from '../types'

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
