import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { OwnerApplication, OwnerApplicationStatus } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const status = body?.status as OwnerApplicationStatus | undefined
  const note = body?.note as string | null | undefined

  if (!status || !['pending', 'contacted', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json(err('VALIDATION', 'Invalid application status'), { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('owner_applications')
    .update({
      status,
      note: note?.trim() || null,
      reviewed_by: guard.value.userId,
    })
    .eq('id', id)
    .select(`
      *,
      user:users!owner_applications_telegram_user_id_fkey (id, name, username, telegram_id, role, created_at, updated_at),
      reviewer:users!owner_applications_reviewed_by_fkey (id, name, username, telegram_id, role, created_at, updated_at)
    `)
    .single()

  if (error) {
    console.error('[admin/owner-applications/[id] PATCH]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to update owner application'), { status: 500 })
  }

  const normalized = {
    ...data,
    user: Array.isArray(data.user) ? data.user[0] ?? null : data.user,
    reviewer: Array.isArray(data.reviewer) ? data.reviewer[0] ?? null : data.reviewer,
  }

  return NextResponse.json(ok<OwnerApplication>(normalized))
}
