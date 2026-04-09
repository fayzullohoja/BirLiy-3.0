import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { ok, err } from '@/lib/utils'
import { getUserContext } from '@/lib/auth/getUser'
import type { AuthStatusPayload } from '@/lib/types'

/**
 * GET /api/auth/status
 *
 * Returns lightweight session state for the current user.
 * Used by gateway pages (subscription-blocked, not-connected) to show
 * context-appropriate messaging without a full page reload.
 *
 * Returns 401 if no valid session.
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) {
    return NextResponse.json(err('UNAUTHENTICATED', 'No session'), { status: 401 })
  }

  const payload = await verifySession(token)
  if (!payload || !payload.sub) {
    return NextResponse.json(err('INVALID_SESSION', 'Session invalid or expired'), { status: 401 })
  }

  const context = await getUserContext(payload.sub)
  const primaryShop = context.shopAccess.find((entry) => entry.shop_id === context.primaryShopId) ?? null
  const subscription = primaryShop?.shop.subscription ?? null
  const needsRefresh =
    payload.app_role !== context.appRole
    || (payload.primary_shop_id ?? null) !== context.primaryShopId
    || (payload.subscription_ok ?? false) !== context.subscriptionOk

  return NextResponse.json(ok<AuthStatusPayload>({
    user_id:         payload.sub,
    role:            context.appRole,
    primary_shop_id: context.primaryShopId,
    shop_name:       primaryShop?.shop.name ?? null,
    expires_at:      subscription?.expires_at ?? null,
    sub_status:      subscription?.status ?? null,
    needs_refresh:   needsRefresh,
  }))
}
