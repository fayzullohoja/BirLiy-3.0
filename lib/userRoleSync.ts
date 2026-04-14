import { createServiceClient } from '@/lib/supabase/server'
import type { ShopUserRole, UserRole } from '@/lib/types'

export const UNAUTHORIZED_USER_ROLE = 'unauthorized' as const

type NonSuperAdminUserRole = Exclude<UserRole, 'super_admin'>

export async function setNonSuperAdminUserRole(
  userId: string,
  role: NonSuperAdminUserRole,
) {
  const supabase = createServiceClient()

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (userError) return { error: userError, role: null as UserRole | null }
  if (!user) return { error: null, role: null as UserRole | null }
  if (user.role === 'super_admin') {
    return { error: null, role: 'super_admin' as const }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)

  if (updateError) return { error: updateError, role: null as UserRole | null }

  return { error: null, role }
}

export async function syncUserRoleFromMemberships(
  userId: string,
  fallbackRole: NonSuperAdminUserRole = UNAUTHORIZED_USER_ROLE,
) {
  const supabase = createServiceClient()

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (userError) return { error: userError, role: null as UserRole | null }
  if (!user) return { error: null, role: null as UserRole | null }
  if (user.role === 'super_admin') {
    return { error: null, role: 'super_admin' as const }
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('shop_users')
    .select('role, created_at')
    .eq('user_id', userId)

  if (membershipsError) return { error: membershipsError, role: null as UserRole | null }

  const nextRole = [...(memberships ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.role
    ?? fallbackRole

  const { error: updateError } = await supabase
    .from('users')
    .update({ role: nextRole })
    .eq('id', userId)

  if (updateError) return { error: updateError, role: null as UserRole | null }

  return { error: null, role: nextRole as ShopUserRole | typeof UNAUTHORIZED_USER_ROLE }
}
