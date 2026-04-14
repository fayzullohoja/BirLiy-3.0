import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { OwnerApplication } from '@/lib/types'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (!authResult.ok) return authResult.response

  const body = await req.json().catch(() => ({}))
  const applicantName = String(body?.applicant_name ?? '').trim()
  const restaurantName = String(body?.restaurant_name ?? '').trim()
  const phone = String(body?.phone ?? '').trim()

  if (!applicantName || !restaurantName || !phone) {
    return NextResponse.json(
      err('MISSING_FIELDS', 'applicant_name, restaurant_name and phone are required'),
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, telegram_id')
    .eq('id', authResult.value.userId)
    .single()

  if (userError || !user) {
    return NextResponse.json(err('NOT_FOUND', 'User not found'), { status: 404 })
  }

  const { data, error } = await supabase
    .from('owner_applications')
    .insert({
      telegram_user_id: user.id,
      telegram_id: user.telegram_id,
      applicant_name: applicantName,
      restaurant_name: restaurantName,
      phone,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[owner-applications POST]', error)
    return NextResponse.json(err('DB_ERROR', 'Failed to submit owner application'), { status: 500 })
  }

  return NextResponse.json(ok<OwnerApplication>(data), { status: 201 })
}
