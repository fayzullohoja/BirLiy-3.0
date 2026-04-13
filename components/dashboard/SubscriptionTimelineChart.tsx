'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate } from '@/lib/utils'

interface TimelineDatum {
  date: string
  trial: number
  starter: number
  pro: number
}

interface SubscriptionTimelineChartProps {
  data: TimelineDatum[]
  height?: number
}

export default function SubscriptionTimelineChart({
  data,
  height = 320,
}: SubscriptionTimelineChartProps) {
  return (
    <div className="h-full min-h-[220px] w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid stroke="#e4ebe7" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke="#8aa898"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => formatDate(`${value}T00:00:00+05:00`)}
          />
          <YAxis stroke="#8aa898" tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TimelineTooltip />} />
          <Legend verticalAlign="bottom" height={30} />
          <Bar dataKey="trial" stackId="subscriptions" name="Trial" fill="#60a5fa" radius={[8, 8, 0, 0]} />
          <Bar dataKey="starter" stackId="subscriptions" name="Starter" fill="#1a8458" radius={[8, 8, 0, 0]} />
          <Bar dataKey="pro" stackId="subscriptions" name="Pro" fill="#f59e0b" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-2xl border border-surface-border bg-white px-3 py-2 shadow-card">
      <p className="text-sm font-semibold text-ink">
        {label ? formatDate(`${label}T00:00:00+05:00`) : ''}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p key={entry.name} className="text-sm text-ink-secondary">
            <span className="font-semibold text-ink">{entry.name}:</span> {Number(entry.value ?? 0)}
          </p>
        ))}
      </div>
    </div>
  )
}
