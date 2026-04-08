/**
 * Session utilities for BirLiy Kassa.
 *
 * We generate a Supabase-compatible HS256 JWT signed with SUPABASE_JWT_SECRET.
 * Supabase accepts this as a valid user token, meaning auth.uid() inside
 * PostgreSQL RLS policies will return the `sub` claim (= public.users.id).
 *
 * The token is stored in an HTTP-only cookie named "birliy-session".
 * Middleware reads and verifies it on every request.
 *
 * Additional custom claims embedded in the token allow middleware to make
 * routing decisions (role check, shop access) without a DB round-trip.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { UserRole, SessionPayload } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_COOKIE  = 'birliy-session'
export const SESSION_TTL_SEC = 60 * 60 * 24   // 24 hours

/** Embedded claims beyond the standard JWT payload */
interface BirliyClaims extends JWTPayload {
  app_role:         UserRole
  shop_ids:         string[]
  primary_shop_id:  string | null
  subscription_ok:  boolean
}

// ─── Secret key ───────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const raw = process.env.SUPABASE_JWT_SECRET
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_JWT_SECRET is required in production')
    }
    // Dev fallback — never used in production
    console.warn('[auth] SUPABASE_JWT_SECRET not set, using insecure dev fallback')
    return new TextEncoder().encode('dev-insecure-secret-change-me-now')
  }
  return new TextEncoder().encode(raw)
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export interface SignSessionOptions {
  userId:          string
  appRole:         UserRole
  shopIds:         string[]
  primaryShopId:   string | null
  subscriptionOk:  boolean
}

export async function signSession(opts: SignSessionOptions): Promise<string> {
  const { userId, appRole, shopIds, primaryShopId, subscriptionOk } = opts

  return new SignJWT({
    app_role:        appRole,
    shop_ids:        shopIds,
    primary_shop_id: primaryShopId,
    subscription_ok: subscriptionOk,
  } satisfies Omit<BirliyClaims, keyof JWTPayload>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(getSecret())
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifySession(token: string): Promise<BirliyClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      audience: 'authenticated',
    })
    return payload as BirliyClaims
  } catch {
    return null
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/**
 * Returns the correct cookie options depending on environment.
 * In Telegram Mini App (production), sameSite: 'none' + secure: true is required
 * because the app runs inside an iframe served from Telegram's domain.
 */
export function getSessionCookieOptions(overrides: { maxAge?: number } = {}) {
  const isDev = process.env.NODE_ENV === 'development'
  return {
    httpOnly: true,
    secure:   !isDev,
    sameSite: (isDev ? 'lax' : 'none') as 'lax' | 'none',
    path:     '/',
    maxAge:   overrides.maxAge ?? SESSION_TTL_SEC,
  }
}

// ─── Re-export SessionPayload for consumers ───────────────────────────────────

export type { SessionPayload, BirliyClaims as SessionClaims }
