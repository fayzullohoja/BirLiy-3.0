/**
 * Next.js Middleware — runs before every request.
 *
 * Responsibilities:
 *  1. Verify the session JWT from the cookie.
 *  2. Protect role-specific routes (/waiter, /kitchen, /owner, /admin).
 *  3. Redirect unauthenticated users to / (entry page).
 *  4. Redirect users without shop access to /not-connected.
 *  5. Redirect users with expired subscriptions to /subscription-blocked.
 *  6. Inject x-user-id and x-user-role headers so API routes don't
 *     need to re-verify the JWT themselves.
 *
 * Performance:
 *  - No database calls in middleware. All decisions are based on JWT claims.
 *  - The JWT embeds: app_role, shop_ids, primary_shop_id, subscription_ok.
 *  - These are refreshed every time /api/auth is called (login / refresh).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import type { UserRole } from '@/lib/types'

// ─── Route matchers ───────────────────────────────────────────────────────────

/** Routes that require authentication */
const PROTECTED_PREFIXES = ['/waiter', '/kitchen', '/owner', '/admin']

/** Routes that are always public (no auth needed) */
const PUBLIC_PATHS = ['/', '/not-connected', '/subscription-blocked']

/** API routes that skip session verification (handled internally) */
const PUBLIC_API_PREFIXES = ['/api/auth', '/_next', '/favicon']

/** Role → allowed path prefix */
const ROLE_HOME: Record<UserRole, string> = {
  waiter:      '/waiter',
  kitchen:     '/kitchen',
  owner:       '/owner',
  super_admin: '/admin',
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public API and Next.js internals
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token   = req.cookies.get(SESSION_COOKIE)?.value
  const payload = token ? await verifySession(token) : null

  // ── Unauthenticated ─────────────────────────────────────────────────────────

  if (!payload) {
    // Allow public pages without a session
    if (PUBLIC_PATHS.includes(pathname)) {
      return NextResponse.next()
    }
    // Redirect everything else to entry
    return NextResponse.redirect(new URL('/', req.url))
  }

  // ── Authenticated user claims ───────────────────────────────────────────────

  const userId         = payload.sub!
  const role           = payload.app_role
  const shopIds        = payload.shop_ids        ?? []
  const subscriptionOk = payload.subscription_ok ?? false
  const primaryShopId  = payload.primary_shop_id ?? null

  // ── Redirect authenticated user away from entry page ───────────────────────

  if (pathname === '/') {
    // Already logged in — skip re-auth and go straight home
    return redirect(req, resolveHome(role, subscriptionOk, shopIds))
  }

  // ── Shop access gate ────────────────────────────────────────────────────────

  if (role !== 'super_admin' && shopIds.length === 0) {
    if (pathname !== '/not-connected') {
      return NextResponse.redirect(new URL('/not-connected', req.url))
    }
    return NextResponse.next()
  }

  // ── Subscription gate (non-admin, has shops but sub is blocked) ─────────────

  if (role !== 'super_admin' && !subscriptionOk) {
    if (pathname !== '/subscription-blocked') {
      return NextResponse.redirect(new URL('/subscription-blocked', req.url))
    }
    return NextResponse.next()
  }

  // ── Role-based route protection ─────────────────────────────────────────────

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (isProtected) {
    // /admin is super_admin only
    if (pathname.startsWith('/admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
    }

    // /owner is owner or super_admin
    if (pathname.startsWith('/owner') && !['owner', 'super_admin'].includes(role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
    }

    // /kitchen is accessible by kitchen, owner or super_admin
    if (pathname.startsWith('/kitchen') && !['kitchen', 'owner', 'super_admin'].includes(role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
    }

    // /waiter is accessible by waiter, owner or super_admin
    if (pathname.startsWith('/waiter') && role === 'kitchen') {
      return NextResponse.redirect(new URL(ROLE_HOME.kitchen, req.url))
    }
  }

  // ── Inject user context into request headers for API routes ─────────────────

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id',        userId)
  requestHeaders.set('x-user-role',      role)
  requestHeaders.set('x-shop-ids',       JSON.stringify(shopIds))
  requestHeaders.set('x-primary-shop-id', primaryShopId ?? '')

  return NextResponse.next({ request: { headers: requestHeaders } })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url))
}

function resolveHome(
  role:           UserRole,
  subscriptionOk: boolean,
  shopIds:        string[],
): string {
  if (role === 'super_admin') return '/admin'
  if (shopIds.length === 0)   return '/not-connected'
  if (!subscriptionOk)        return '/subscription-blocked'
  return ROLE_HOME[role]
}

// ─── Matcher config ───────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static, _next/image (Next.js internals)
     *  - favicon.ico, public/ files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)',
  ],
}
