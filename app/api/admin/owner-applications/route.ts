import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { OwnerApplication } from '@/lib/types'

export async function GET() {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('owner_applications')
    .select(`
      *,
      user:users!owner_applications_telegram_user_id_fkey (id, name, username, telegram_id, role, created_at, updated_at),
      reviewer:users!owner_applications_reviewed_by_fkey (id, name, username, telegram_id, role, created_at, updated_at)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/owner-applications GET]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch owner applications'), { status: 500 })
  }

  const normalized = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
    reviewer: Array.isArray(row.reviewer) ? row.reviewer[0] ?? null : row.reviewer,
  }))

  return NextResponse.json(ok<OwnerApplication[]>(normalized))
}
