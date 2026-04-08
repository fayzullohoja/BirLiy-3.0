import { NextResponse } from 'next/server'
import { SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'
import { ok } from '@/lib/utils'

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. The client should redirect to / afterwards.
 */
export async function POST() {
  const response = NextResponse.json(ok({ logged_out: true }))
  response.cookies.set(SESSION_COOKIE, '', {
    ...getSessionCookieOptions({ maxAge: 0 }),
    maxAge: 0,
  })
  return response
}
