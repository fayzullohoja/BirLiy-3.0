import { NextRequest, NextResponse } from 'next/server'
import { err, ok } from '@/lib/utils'
import { getSessionUser, getUserContext } from '@/lib/auth/getUser'
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
export async function POST(req: NextRequest) {
  // Use getSessionUser (reads cookie directly) — middleware skips header injection
  // for /api/auth/* routes, so requireAuth() would always return 401 here.
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(err('UNAUTHENTICATED', 'Authentication required'), { status: 401 })
  }

  const { userId, role } = user

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

    const forwardedProto = req.headers.get('x-forwarded-proto')
    const forwardedHost = req.headers.get('x-forwarded-host')
    const requestOrigin =
      forwardedProto && forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : req.nextUrl.origin
    const baseUrl = requestOrigin || 'http://localhost:3000'

    return NextResponse.json(ok({
      url:        `${baseUrl}/dashboard/auth?token=${token}`,
      expires_in: MAGIC_TTL_SEC,
    }))
  } catch (e) {
    console.error('[auth/magic POST]', e)
    return NextResponse.json(err('INTERNAL_ERROR', 'Не удалось создать ссылку'), { status: 500 })
  }
}
