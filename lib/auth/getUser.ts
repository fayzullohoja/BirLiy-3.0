/**
 * Server-side user extraction utilities.
 *
 * Two usage patterns:
 *  1. In API Route Handlers → read user from request headers injected by middleware
 *  2. In Server Components / Server Actions → read session cookie directly
 */

import { headers, cookies } from 'next/headers'
import { verifySession } from './session'
import { SESSION_COOKIE } from './session'
import { createServiceClient } from '@/lib/supabase/server'
import type { RequestUser, UserContext, ShopAccessEntry, UserRole } from '@/lib/types'

// ─── Request-level user (set by middleware via headers) ───────────────────────

/**
 * Returns the authenticated user injected by middleware into request headers.
 * Use in Route Handlers — zero DB cost.
 * Returns null if called outside a middleware-protected route.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  const h = await headers()
  const userId = h.get('x-user-id')
  const role   = h.get('x-user-role') as UserRole | null
  if (!userId || !role) return null
  return { userId, role }
}

/**
 * Like getRequestUser but throws a 401-friendly error if no user found.
 * Use when the route REQUIRES authentication.
 */
export async function requireRequestUser(): Promise<RequestUser> {
  const user = await getRequestUser()
  if (!user) throw new AuthError('UNAUTHENTICATED', 'Authentication required')
  return user
}

// ─── Cookie-level user (Server Components) ───────────────────────────────────

/**
 * Reads and verifies the session cookie.
 * Use in Server Components and Server Actions.
 * Returns null if no valid session.
 */
export async function getSessionUser(): Promise<RequestUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const payload = await verifySession(token)
  if (!payload || !payload.sub) return null

  return {
    userId: payload.sub,
    role:   payload.app_role,
  }
}

// ─── Full user context (includes shop access and subscription) ────────────────

/**
 * Fetches the full UserContext from the DB for a given userId.
 * Used for:
 *  - Entry page redirect decisions
 *  - Refreshing the session JWT after shop/subscription changes
 *
 * Performance: 2 parallel DB queries.
 */
export async function getUserContext(userId: string): Promise<UserContext> {
  const supabase = createServiceClient()

  const [userRes, accessRes] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single(),
    supabase
      .from('shop_users')
      .select(`
        shop_id,
        role,
        created_at,
        shop:shops (
          id, name, address, phone, is_active, created_at, updated_at,
          subscription:subscriptions (
            id, shop_id, status, plan, expires_at, created_at, updated_at
          )
        )
      `)
      .eq('user_id', userId),
  ])

  if (userRes.error || !userRes.data) {
    throw new AuthError('USER_NOT_FOUND', `User ${userId} not found in public.users`)
  }

  const rawAccess = (accessRes.data ?? []) as unknown as Array<{
    shop_id: string
    role:    'owner' | 'waiter' | 'kitchen'
    created_at: string
    shop:    (typeof userRes.data) & {
      subscription: { id: string; shop_id: string; status: string; plan: string; expires_at: string; created_at: string; updated_at: string } | null
    }
  }>

  const sortedAccess = [...rawAccess].sort((a, b) => {
    const aActive = hasActiveSubscription(a.shop.subscription)
    const bActive = hasActiveSubscription(b.shop.subscription)

    if (aActive !== bActive) {
      return aActive ? -1 : 1
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const shopAccess: ShopAccessEntry[] = sortedAccess.map((row) => ({
    shop_id: row.shop_id,
    role:    row.role,
    shop:    {
      ...row.shop,
      subscription: row.shop.subscription ?? null,
    } as ShopAccessEntry['shop'],
  }))

  // Super-admin always has access; others need at least one shop entry
  const hasShopAccess =
    userRes.data.role === 'super_admin' || shopAccess.length > 0

  // Primary shop = first active subscription, otherwise the oldest membership.
  const primaryAccess = shopAccess[0] ?? null
  const subscriptionOk =
    userRes.data.role === 'super_admin' ||
    hasActiveSubscription(primaryAccess?.shop.subscription ?? null)
  const appRole: UserRole =
    userRes.data.role === 'super_admin'
      ? 'super_admin'
      : primaryAccess?.role ?? 'waiter'

  return {
    user:           userRes.data,
    shopAccess,
    appRole,
    primaryShopRole: primaryAccess?.role ?? null,
    hasShopAccess,
    subscriptionOk,
    primaryShopId:  primaryAccess?.shop_id ?? null,
  }
}

// ─── Shop access guard ────────────────────────────────────────────────────────

/**
 * Verifies the current request user has access to the given shop.
 * super_admin always passes.
 * Returns the user's role in the shop, or null if no access.
 */
export async function verifyShopAccess(
  userId: string,
  role:   UserRole,
  shopId: string,
): Promise<'owner' | 'waiter' | 'kitchen' | null> {
  if (role === 'super_admin') return 'owner' // super_admin treated as owner everywhere

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('shop_users')
    .select('role')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .single()

  return (data?.role as 'owner' | 'waiter' | 'kitchen' | undefined) ?? null
}

// ─── AuthError ────────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

function hasActiveSubscription(
  subscription: { status: string; expires_at: string } | null | undefined,
) {
  if (!subscription) return false

  return (
    (subscription.status === 'active' || subscription.status === 'trial') &&
    new Date(subscription.expires_at) > new Date()
  )
}
