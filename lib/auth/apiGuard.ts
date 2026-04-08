/**
 * Shared guards for API route handlers.
 *
 * Every route handler that touches shop data should:
 *  1. Call requireAuth()     → get the RequestUser (from middleware headers)
 *  2. Call requireShopAccess()  → verify the user actually belongs to the requested shop
 *
 * super_admin bypasses all shop checks and is treated as 'owner' everywhere.
 */

import { NextResponse } from 'next/server'
import { getRequestUser, verifyShopAccess } from './getUser'
import { err } from '@/lib/utils'
import type { RequestUser } from '@/lib/types'

// ─── Auth guard ───────────────────────────────────────────────────────────────

type GuardResult<T> =
  | { ok: true;  value: T;              response: null }
  | { ok: false; value: null;           response: NextResponse }

/**
 * Returns the current user or a 401 NextResponse.
 */
export async function requireAuth(): Promise<GuardResult<RequestUser>> {
  const user = await getRequestUser()
  if (!user) {
    return {
      ok:       false,
      value:    null,
      response: NextResponse.json(err('UNAUTHENTICATED', 'Authentication required'), { status: 401 }),
    }
  }
  return { ok: true, value: user, response: null }
}

// ─── Shop access guard ────────────────────────────────────────────────────────

export interface ShopGuardResult {
  userId:    string
  shopRole:  'owner' | 'waiter'
}

/**
 * Verifies the user has access to the given shop.
 * Returns 401 if not authenticated, 403 if no shop access, 400 if shopId missing.
 */
export async function requireShopAccess(
  shopId: string | null | undefined,
): Promise<GuardResult<ShopGuardResult>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return authResult as GuardResult<ShopGuardResult>

  const { userId, role } = authResult.value

  if (!shopId) {
    return {
      ok:       false,
      value:    null,
      response: NextResponse.json(err('MISSING_PARAM', 'shop_id is required'), { status: 400 }),
    }
  }

  const shopRole = await verifyShopAccess(userId, role, shopId)
  if (!shopRole) {
    return {
      ok:       false,
      value:    null,
      response: NextResponse.json(
        err('FORBIDDEN', 'You do not have access to this shop'),
        { status: 403 },
      ),
    }
  }

  return {
    ok:       true,
    value:    { userId, shopRole },
    response: null,
  }
}

/**
 * Requires the current user to be a super_admin.
 * Returns 401 if not authenticated, 403 if not super_admin.
 */
export async function requireSuperAdmin(): Promise<GuardResult<RequestUser>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return authResult

  if (authResult.value.role !== 'super_admin') {
    return {
      ok:       false,
      value:    null,
      response: NextResponse.json(
        err('FORBIDDEN', 'Super admin access required'),
        { status: 403 },
      ),
    }
  }

  return authResult
}

/**
 * Like requireShopAccess but also requires the user to be an owner (or super_admin).
 */
export async function requireOwnerAccess(
  shopId: string | null | undefined,
): Promise<GuardResult<ShopGuardResult>> {
  const result = await requireShopAccess(shopId)
  if (!result.ok) return result

  if (result.value.shopRole !== 'owner') {
    return {
      ok:       false,
      value:    null,
      response: NextResponse.json(
        err('FORBIDDEN', 'Owner access required'),
        { status: 403 },
      ),
    }
  }

  return result
}
