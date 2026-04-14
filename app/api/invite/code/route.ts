import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAdminAccess } from '@/lib/auth/apiGuard'
import { ok, err } from '@/lib/utils'
import { generateInviteCode } from '@/lib/inviteCodes'
import { canManageInviteRole, isManagementShopRole } from '@/lib/roles'

const LEGACY_ROLE = 'waiter' as const
const MAX_GENERATION_ATTEMPTS = 25

/**
 * Legacy compatibility route.
 * Maps the historical "shop invite code" flow to the new waiter invite code.
 */
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shop_id')
  const guard = await requireShopAdminAccess(shopId)
  if (!guard.ok) return guard.response

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole || !canManageInviteRole(actorRole, LEGACY_ROLE)) {
    return NextResponse.json(err('FORBIDDEN', 'Only management can view invite codes'), { status: 403 })
  }

  const supabase = createServiceClient()
  const { data: existing, error: existingError } = await supabase
    .from('shop_invite_codes')
    .select('code')
    .eq('shop_id', shopId!)
    .eq('role', LEGACY_ROLE)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    console.error('[invite/code GET existing]', existingError)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch invite code'), { status: 500 })
  }

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, name')
    .eq('id', shopId!)
    .single()

  if (shopError || !shop) {
    return NextResponse.json(err('NOT_FOUND', 'Shop not found'), { status: 404 })
  }

  if (existing?.code) {
    return NextResponse.json(ok({ code: existing.code, role: LEGACY_ROLE, shop_id: shopId, shop_name: shop.name }))
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const { data, error } = await supabase
      .from('shop_invite_codes')
      .insert({
        shop_id: shopId,
        role: LEGACY_ROLE,
        code,
        is_active: true,
        created_by: guard.value.userId,
        updated_by: guard.value.userId,
      })
      .select('code')
      .single()

    if (!error && data) {
      return NextResponse.json(ok({ code: data.code, role: LEGACY_ROLE, shop_id: shopId, shop_name: shop.name }))
    }

    if (error?.code !== '23505') {
      console.error('[invite/code GET create]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to generate invite code'), { status: 500 })
    }
  }

  return NextResponse.json(err('INVITE_CODE_EXHAUSTED', 'Failed to generate invite code'), { status: 500 })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const shopId = body?.shop_id as string | undefined
  const guard = await requireShopAdminAccess(shopId)
  if (!guard.ok) return guard.response

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole || !canManageInviteRole(actorRole, LEGACY_ROLE)) {
    return NextResponse.json(err('FORBIDDEN', 'Only management can regenerate invite codes'), { status: 403 })
  }

  const supabase = createServiceClient()
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, name')
    .eq('id', shopId!)
    .single()

  if (shopError || !shop) {
    return NextResponse.json(err('NOT_FOUND', 'Shop not found'), { status: 404 })
  }

  const { error: deactivateError } = await supabase
    .from('shop_invite_codes')
    .update({ is_active: false, updated_by: guard.value.userId })
    .eq('shop_id', shopId!)
    .eq('role', LEGACY_ROLE)
    .eq('is_active', true)

  if (deactivateError) {
    console.error('[invite/code POST deactivate]', deactivateError)
    return NextResponse.json(err('DB_ERROR', 'Failed to rotate invite code'), { status: 500 })
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const { data, error } = await supabase
      .from('shop_invite_codes')
      .insert({
        shop_id: shopId,
        role: LEGACY_ROLE,
        code,
        is_active: true,
        created_by: guard.value.userId,
        updated_by: guard.value.userId,
      })
      .select('code')
      .single()

    if (!error && data) {
      return NextResponse.json(ok({ code: data.code, role: LEGACY_ROLE, shop_id: shopId, shop_name: shop.name }))
    }

    if (error?.code !== '23505') {
      console.error('[invite/code POST create]', error)
      return NextResponse.json(err('DB_ERROR', 'Failed to regenerate invite code'), { status: 500 })
    }
  }

  return NextResponse.json(err('INVITE_CODE_EXHAUSTED', 'Failed to regenerate invite code'), { status: 500 })
}
