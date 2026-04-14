import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { getUserContext } from '@/lib/auth/getUser'
import { signSession } from '@/lib/auth/session'

const MAGIC_TTL_SEC = 60 * 10 // 10 minutes

/**
 * POST /api/auth/magic
 *
 * Generates a short-lived JWT (10 min) for the current user so they can
 * open the web dashboard without going through Telegram Login Widget.
 *
 * Flow:
 *   Mini App → POST /api/auth/magic
 *           → { url: "https://…/dashboard/auth?token=XXX" }
 *           → Telegram.WebApp.openLink(url)
 *           → /dashboard/auth validates token, sets session cookie, redirects
 */
export async function POST() {
  const authResult = await requireAuth()
  if (!authResult.ok) return authResult.response

  const { userId, role } = authResult.value

  if (!['owner', 'manager', 'super_admin'].includes(role)) {
    return NextResponse.json(
      err('FORBIDDEN', 'Веб-панель доступна только владельцам и менеджерам'),
      { status: 403 },
    )
  }

  try {
    const ctx = await getUserContext(userId)

    const token = await signSession({
      userId,
      appRole:        ctx.appRole,
      shopIds:        ctx.shopAccess.map((entry) => entry.shop_id),
      primaryShopId:  ctx.primaryShopId,
      subscriptionOk: ctx.subscriptionOk,
      ttlSec:         MAGIC_TTL_SEC,
    })

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    return NextResponse.json(ok({
      url:        `${baseUrl}/dashboard/auth?token=${token}`,
      expires_in: MAGIC_TTL_SEC,
    }))
  } catch (e) {
    console.error('[auth/magic POST]', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Не удалось создать ссылку'), { status: 500 })
  }
}
