import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireShopAdminAccess } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import { canManageInviteRole, isManagementShopRole } from '@/lib/roles'
import type { ShopInviteCode } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const nextActive = body?.is_active

  if (typeof nextActive !== 'boolean') {
    return NextResponse.json(err('VALIDATION', 'is_active must be boolean'), { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: codeRow, error: codeError } = await supabase
    .from('shop_invite_codes')
    .select('*')
    .eq('id', id)
    .single()

  if (codeError || !codeRow) {
    return NextResponse.json(err('NOT_FOUND', 'Invite code not found'), { status: 404 })
  }

  const guard = await requireShopAdminAccess(codeRow.shop_id)
  if (!guard.ok) return guard.response

  const actorRole = guard.value.platformRole === 'super_admin'
    ? 'super_admin'
    : isManagementShopRole(guard.value.shopRole)
      ? guard.value.shopRole
      : null

  if (!actorRole) {
    return NextResponse.json(err('FORBIDDEN', 'Shop management access required'), { status: 403 })
  }

  if (!canManageInviteRole(actorRole, codeRow.role)) {
    return NextResponse.json(err('FORBIDDEN', 'You cannot manage invite codes for this role'), { status: 403 })
  }

  if (nextActive) {
    const { error: deactivateError } = await supabase
      .from('shop_invite_codes')
      .update({ is_active: false, updated_by: guard.value.userId })
      .eq('shop_id', codeRow.shop_id)
      .eq('role', codeRow.role)
      .eq('is_active', true)
      .neq('id', codeRow.id)

    if (deactivateError) {
      console.error('[invite/codes/[id] PATCH deactivate]', deactivateError)
      return NextResponse.json(err('DB_ERROR', 'Failed to activate invite code'), { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('shop_invite_codes')
    .update({ is_active: nextActive, updated_by: guard.value.userId })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[invite/codes/[id] PATCH]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to update invite code'), { status: 500 })
  }

  return NextResponse.json(ok<ShopInviteCode>(data))
}
