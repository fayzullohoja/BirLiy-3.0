import { NextRequest, NextResponse } from 'next/server'
import { verifySession, signSession, SESSION_COOKIE } from '@/lib/auth/session'

const DASHBOARD_SESSION_TTL_SEC = 7 * 24 * 60 * 60 // 7 days

/**
 * GET /dashboard/auth?token=XXX
 *
 * Landing page for the magic-link flow.
 * Validates the short-lived JWT from the Mini App, issues a fresh 7-day
 * dashboard session cookie, then redirects to the correct dashboard section.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard/login?error=missing_token', req.url))
  }

  const payload = await verifySession(token)

  if (!payload || !payload.sub) {
    return NextResponse.redirect(new URL('/dashboard/login?error=invalid_token', req.url))
  }

  // Re-sign with a longer TTL suitable for browser sessions
  const freshToken = await signSession({
    userId:         payload.sub,
    appRole:        payload.app_role,
    shopIds:        payload.shop_ids,
    primaryShopId:  payload.primary_shop_id,
    subscriptionOk: payload.subscription_ok,
    ttlSec:         DASHBOARD_SESSION_TTL_SEC,
  })

  let destination = '/dashboard/not-authorized'
  if (payload.app_role === 'super_admin') {
    destination = '/dashboard/admin'
  } else if (payload.app_role === 'owner' || payload.app_role === 'manager') {
    destination = '/dashboard/owner'
  }

  const response = NextResponse.redirect(new URL(destination, req.url))
  response.cookies.set(SESSION_COOKIE, freshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV !== 'development',
    sameSite: 'lax', // browser context — lax is correct
    path:     '/',
    maxAge:   DASHBOARD_SESSION_TTL_SEC,
  })

  return response
}
