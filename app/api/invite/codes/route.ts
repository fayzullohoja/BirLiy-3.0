import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAdminAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { canManageInviteRole, getInviteManageableRoles, isManagementShopRole } from '@/lib/roles'
import { generateInviteCode } from '@/lib/inviteCodes'
import type { ShopInviteCode, ShopUserRole } from '@/lib/types'

const MAX_GENERATION_ATTEMPTS = 25

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard = await requireShopAdminAccess(shopId)
  if (!guard.ok) return guard.response

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole) {
    return NextResponse.json(err('FORBIDDEN', 'Shop management access required'), { status: 403 })
  }

  const manageableRoles = getInviteManageableRoles(actorRole)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('shop_invite_codes')
    .select('*')
    .eq('shop_id', shopId!)
    .eq('is_active', true)
    .in('role', manageableRoles)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[invite/codes GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch invite codes'), { status: 500 })
  }

  return NextResponse.json(ok<ShopInviteCode[]>(data ?? []))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const shopId = body?.shop_id as string | undefined
  const role = body?.role as ShopUserRole | undefined

  const guard = await requireShopAdminAccess(shopId)
  if (!guard.ok) return guard.response

  if (!role || !['manager', 'waiter', 'kitchen'].includes(role)) {
    return NextResponse.json(err('VALIDATION', 'role must be manager, waiter or kitchen'), { status: 400 })
  }

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole) {
    return NextResponse.json(err('FORBIDDEN', 'Shop management access required'), { status: 403 })
  }

  if (!canManageInviteRole(actorRole, role)) {
    return NextResponse.json(err('FORBIDDEN', 'You cannot manage invite codes for this role'), { status: 403 })
  }

  const supabase = createServiceClient()

  const { error: deactivateError } = await supabase
    .from('shop_invite_codes')
    .update({ is_active: false, updated_by: guard.value.userId })
    .eq('shop_id', shopId!)
    .eq('role', role)
    .eq('is_active', true)

  if (deactivateError) {
    console.error('[invite/codes POST deactivate]', deactivateError)
    return NextResponse.json(err('DB_ERROR', 'Failed to rotate invite code'), { status: 500 })
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const { data, error } = await supabase
      .from('shop_invite_codes')
      .insert({
        shop_id: shopId,
        role,
        code,
        is_active: true,
        created_by: guard.value.userId,
        updated_by: guard.value.userId,
      })
      .select('*')
      .single()

    if (!error && data) {
      return NextResponse.json(ok<ShopInviteCode>(data), { status: 201 })
    }

    if (error?.code !== '23505') {
      console.error('[invite/codes POST insert]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to create invite code'), { status: 500 })
    }
  }

  return NextResponse.json(err('INVITE_CODE_EXHAUSTED', 'Failed to generate a unique invite code'), { status: 500 })
}
