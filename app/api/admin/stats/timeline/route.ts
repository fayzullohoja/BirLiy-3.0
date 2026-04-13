import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/apiGuard'
import { err, ok } from '@/lib/utils'
import type { StatsTimelineResponse, SubPlan, SubStatus } from '@/lib/types'

const DEFAULT_DAYS = 30

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const rawDays = Number.parseInt(req.nextUrl.searchParams.get('days') ?? `${DEFAULT_DAYS}`, 10)
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : DEFAULT_DAYS

  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString()
  const supabase = createServiceClient()

  const [{ data: recentRows, error: recentError }, { data: allSubscriptions, error: totalsError }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('created_at, plan')
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('status'),
  ])

  if (recentError || totalsError) {
    console.error('[admin/stats/timeline GET]', recentError ?? totalsError)
    return NextResponse.json(err('DB_ERROR', 'Failed to fetch subscription timeline'), { status: 500 })
  }

  const subscriptionsByDay = new Map<string, Record<SubPlan, number>>()
  for (const row of recentRows ?? []) {
    const day = toTashkentDate(row.created_at)
    const plan = row.plan as SubPlan
    const bucket = subscriptionsByDay.get(day) ?? { trial: 0, starter: 0, pro: 0 }
    bucket[plan] = (bucket[plan] ?? 0) + 1
    subscriptionsByDay.set(day, bucket)
  }

  const totals: StatsTimelineResponse['totals'] = {
    active: 0,
    trial: 0,
    expired: 0,
    suspended: 0,
    total: 0,
  }

  for (const row of allSubscriptions ?? []) {
    const status = row.status as SubStatus
    totals.total += 1
    totals[status] = (totals[status] ?? 0) + 1
  }

  const response: StatsTimelineResponse = {
    subscriptions_by_day: [...subscriptionsByDay.entries()].map(([date, counts]) => ([
      { date, plan: 'trial' as const, count: counts.trial ?? 0 },
      { date, plan: 'starter' as const, count: counts.starter ?? 0 },
      { date, plan: 'pro' as const, count: counts.pro ?? 0 },
    ])).flat(),
    totals,
  }

  return NextResponse.json(ok(response))
}

function toTashkentDate(input: string) {
  return new Date(new Date(input).getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}
