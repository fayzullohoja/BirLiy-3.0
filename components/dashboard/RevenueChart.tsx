'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate, formatUZS } from '@/lib/utils'

interface RevenueChartProps {
  data: Array<{ date: string; revenue: number; orders: number }>
  height?: number
}

export default function RevenueChart({ data, height = 300 }: RevenueChartProps) {
  return (
    <div className="h-full min-h-[220px] w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid stroke="#e4ebe7" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke="#8aa898"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => formatDate(`${value}T00:00:00+05:00`)}
          />
          <YAxis
            yAxisId="revenue"
            stroke="#8aa898"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatUZS(value).replace(' сум', '')}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            stroke="#8aa898"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<RevenueTooltip />} />
          <Legend verticalAlign="bottom" height={30} />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Выручка"
            stroke="#1a8458"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            name="Заказы"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const revenue = payload.find((entry) => entry.dataKey === 'revenue')?.value ?? 0
  const orders = payload.find((entry) => entry.dataKey === 'orders')?.value ?? 0

  return (
    <div className="rounded-2xl border border-surface-border bg-white px-3 py-2 shadow-card">
      <p className="text-sm font-semibold text-ink">{label ? formatDate(`${label}T00:00:00+05:00`) : ''}</p>
      <p className="mt-1 text-sm text-ink-secondary">Выручка: <span className="font-semibold text-ink">{formatUZS(Number(revenue))}</span></p>
      <p className="text-sm text-ink-secondary">Заказы: <span className="font-semibold text-ink">{Number(orders)}</span></p>
    </div>
  )
}
