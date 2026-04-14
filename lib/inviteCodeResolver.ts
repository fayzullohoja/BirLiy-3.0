import { createServiceClient } from '@/lib/supabase/server'
import type { ShopUserRole } from '@/lib/types'

type InviteCodeShop = {
  id: string
  name: string
  is_active: boolean
}

type InviteCodeRow = {
  id: string
  shop_id: string
  role: ShopUserRole
  code: string
  is_active: boolean
  shop: InviteCodeShop | InviteCodeShop[] | null
}

export interface ResolvedInviteCode {
  id: string
  shop_id: string
  role: ShopUserRole
  code: string
  is_active: boolean
  shop: InviteCodeShop | null
}

function normalizeShopRelation(shop: InviteCodeRow['shop']): InviteCodeShop | null {
  if (Array.isArray(shop)) {
    return shop[0] ?? null
  }

  return shop ?? null
}

function toResolvedInviteCode(row: InviteCodeRow): ResolvedInviteCode {
  return {
    id: row.id,
    shop_id: row.shop_id,
    role: row.role,
    code: row.code,
    is_active: row.is_active,
    shop: normalizeShopRelation(row.shop),
  }
}

export async function resolveInviteCodeByCode(code: string) {
  const supabase = createServiceClient()

  const { data: inviteCodeRow, error: inviteError } = await supabase
    .from('shop_invite_codes')
    .select(`
      id, shop_id, role, code, is_active,
      shop:shops (id, name, is_active)
    `)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle<InviteCodeRow>()

  if (inviteError) {
    return {
      inviteCode: null,
      error: inviteError,
      source: 'shop_invite_codes' as const,
    }
  }

  if (inviteCodeRow) {
    return {
      inviteCode: toResolvedInviteCode(inviteCodeRow),
      error: null,
      source: 'shop_invite_codes' as const,
    }
  }

  const { data: legacyShop, error: legacyError } = await supabase
    .from('shops')
    .select('id, name, is_active, invite_code')
    .eq('invite_code', code)
    .maybeSingle<{
      id: string
      name: string
      is_active: boolean
      invite_code: string | null
    }>()

  if (legacyError) {
    return {
      inviteCode: null,
      error: legacyError,
      source: 'legacy_shop_code' as const,
    }
  }

  if (!legacyShop) {
    return {
      inviteCode: null,
      error: null,
      source: 'legacy_shop_code' as const,
    }
  }

  return {
    inviteCode: {
      id: `legacy:${legacyShop.id}`,
      shop_id: legacyShop.id,
      role: 'waiter',
      code,
      is_active: true,
      shop: {
        id: legacyShop.id,
        name: legacyShop.name,
        is_active: legacyShop.is_active,
      },
    } satisfies ResolvedInviteCode,
    error: null,
    source: 'legacy_shop_code' as const,
  }
}
