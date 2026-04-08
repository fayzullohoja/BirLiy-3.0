import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { ok, err } from '@/lib/utils'

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

  const supabase  = createServiceClient()
  const primaryId = payload.primary_shop_id

  let shopName: string | null  = null
  let expiresAt: string | null = null
  let subStatus: string | null = null

  if (primaryId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, expires_at, shop:shops(name)')
      .eq('shop_id', primaryId)
      .maybeSingle()

    if (sub) {
      subStatus  = sub.status
      expiresAt  = sub.expires_at
      shopName   = (sub.shop as unknown as { name: string } | null)?.name ?? null
    }
  }

  return NextResponse.json(ok({
    user_id:         payload.sub,
    role:            payload.app_role,
    primary_shop_id: primaryId ?? null,
    shop_name:       shopName,
    expires_at:      expiresAt,
    sub_status:      subStatus,
  }))
}
