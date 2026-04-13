'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { OrderItemStatusBadge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { useWaiterSession } from '../../_context/WaiterSessionContext'
import { formatUZS, formatTime, PAYMENT_TYPE_LABELS, ORDER_STATUS_LABELS, pluralRu } from '@/lib/utils'
import type { Order, OrderItem, PaymentType, Table } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageData {
  table: Table
  order: Order | null
}

const LIVE_FETCH_OPTIONS: RequestInit = { cache: 'no-store' }

const SUCCESS_MESSAGES: Partial<Record<'in_kitchen' | 'ready' | 'paid' | 'cancelled', string>> = {
  in_kitchen: 'Заказ отправлен на кухню',
  ready: 'Заказ отмечен как готовый',
  paid: 'Оплата принята',
  cancelled: 'Заказ отменён',
}

interface OrderItemSummary {
  totalItems: number
  pendingItems: number
  inKitchenItems: number
  readyItems: number
}

function getOrderActionErrorMessage(
  response: Response,
  payload: { error?: { message?: string } } | null,
  fallback: string,
) {
  return (
    payload?.error?.message
    ?? (response.status === 402
      ? 'Подписка заведения неактивна. Продлите её и попробуйте снова.'
      : fallback)
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TableDetailPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const session     = useWaiterSession()
  const router      = useRouter()

  const [data, setData]               = useState<PageData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [actionLoading, setAction]    = useState(false)
  const [paymentSheet, setPaymentSheet] = useState(false)
  const liveOrderId = data?.order?.id ?? null
  const liveOrderStatus = data?.order?.status ?? null

  // Telegram back button
  const tgBack = useRef<(() => void) | null>(null)
  useEffect(() => {
    const tg = (window as Window & { Telegram?: { WebApp?: { BackButton?: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void } } } }).Telegram?.WebApp
    if (!tg?.BackButton) return
    tgBack.current = () => router.push('/waiter')
    tg.BackButton.show()
    tg.BackButton.onClick(tgBack.current)
    return () => {
      if (tgBack.current) tg.BackButton?.offClick(tgBack.current)
      tg.BackButton?.hide()
    }
  }, [router])

  const fetchData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (session.loading || !session.primaryShopId) return
    if (mode === 'initial') setLoading(true)

    try {
      const [tableRes, ordersRes] = await Promise.all([
        fetch(`/api/tables/${tableId}`, LIVE_FETCH_OPTIONS).then(r => r.json()),
        fetch(
          `/api/orders?shop_id=${session.primaryShopId}&table_id=${tableId}&status=open,in_kitchen,ready`,
          LIVE_FETCH_OPTIONS,
        ).then(r => r.json()),
      ])

      if (tableRes.error) {
        setError(tableRes.error.message)
        return
      }

      if (ordersRes.error) {
        setError(ordersRes.error.message)
        return
      }

      const activeOrder: Order | null = ordersRes.data?.[0] ?? null
      setError(null)
      setData({ table: tableRes.data, order: activeOrder })
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      if (mode === 'initial') setLoading(false)
    }
  }, [session.loading, session.primaryShopId, tableId])

  useEffect(() => {
    void fetchData('initial')
  }, [fetchData])

  useEffect(() => {
    if (session.loading || !liveOrderId || !liveOrderStatus || !['in_kitchen', 'ready'].includes(liveOrderStatus)) {
      return
    }

    const refresh = () => { void fetchData('refresh') }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const intervalId = window.setInterval(refresh, 8_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchData, liveOrderId, liveOrderStatus, session.loading])

  // ── Qty adjustment ──────────────────────────────────────────────────────────
  async function adjustQty(item: OrderItem, delta: number) {
    const newQty = item.quantity + delta
    if (newQty < 1) {
      await deleteItem(item)
      return
    }
    setAction(true)
    try {
      const response = await fetch(`/api/order-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty }),
      })
      const res = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(getOrderActionErrorMessage(response, res, 'Не удалось обновить позицию'))
        return
      }

      if (!res || res.error) {
        toast.error(res?.error?.message ?? 'Не удалось обновить позицию')
        return
      }

      setData(prev => prev ? { ...prev, order: res.data } : prev)
    } catch (e) {
      console.error('[adjustQty]', e)
      toast.error('Не удалось обновить позицию')
    } finally {
      setAction(false)
    }
  }

  // ── Delete item ─────────────────────────────────────────────────────────────
  async function deleteItem(item: OrderItem) {
    setAction(true)
    try {
      const response = await fetch(`/api/order-items/${item.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const json = await response.json().catch(() => null)
        toast.error(getOrderActionErrorMessage(response, json, 'Не удалось удалить позицию'))
        return
      }

      await fetchData('refresh')
    } catch (e) {
      console.error('[deleteItem]', e)
      toast.error('Не удалось удалить позицию')
    } finally {
      setAction(false)
    }
  }

  // ── Status transition ───────────────────────────────────────────────────────
  async function transitionOrder(status: string, paymentType?: PaymentType) {
    if (!data?.order) return
    setAction(true)
    try {
      const response = await fetch(`/api/orders/${data.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(paymentType ? { payment_type: paymentType } : {}) }),
      })
      const res = await response.json().catch(() => null)

      if (!response.ok) {
        const message = getOrderActionErrorMessage(response, res, 'Не удалось обновить заказ')
        toast.error(message)
        return
      }

      if (!res || res.error) {
        toast.error(res?.error?.message ?? 'Не удалось обновить заказ')
        return
      }

      if (SUCCESS_MESSAGES[status as keyof typeof SUCCESS_MESSAGES]) {
        toast.success(SUCCESS_MESSAGES[status as keyof typeof SUCCESS_MESSAGES]!)
      }

      if (status === 'paid' || status === 'cancelled') {
        router.push('/waiter')
      } else {
        await fetchData('refresh')
      }
    } catch (e) {
      console.error('[transitionOrder]', e)
      toast.error('Не удалось обновить заказ')
    } finally {
      setAction(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || session.loading) {
    return <PageSkeleton />
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-ink-secondary text-center">{error ?? 'Стол не найден'}</p>
        <button
          onClick={() => router.push('/waiter')}
          className="text-brand-600 font-medium"
        >
          Назад к столам
        </button>
      </div>
    )
  }

  const { table, order } = data
  const items = order?.items ?? []
  const itemSummary = getOrderItemSummary(order)
  const canAddMore = Boolean(order && !['paid', 'cancelled'].includes(order.status))

  return (
    <div className="min-h-screen flex flex-col bg-surface-muted pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface border-b border-surface-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/waiter')}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted transition-colors shrink-0"
          aria-label="Назад"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-ink truncate">{table.name}</h1>
          <p className="text-xs text-ink-muted">{table.capacity} мест</p>
        </div>
        {order && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-muted text-ink-secondary border border-surface-border">
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!order ? (
          // Free table — prompt to start order
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="12" rx="2" />
                <path d="M9 15v6M15 15v6M6 21h12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-ink">Стол свободен</p>
              <p className="text-sm text-ink-muted mt-1">Нажмите чтобы создать заказ</p>
            </div>
            <button
              onClick={() => router.push(`/waiter/table/${tableId}/menu`)}
              className="w-full max-w-xs py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-base active:scale-95 transition-transform"
            >
              Создать заказ
            </button>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {/* Order meta */}
            <div className="bg-surface rounded-2xl border border-surface-border px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-ink-secondary">Заказ #{order.id.slice(-6).toUpperCase()}</span>
              <span className="text-sm text-ink-muted">{formatTime(order.created_at)}</span>
            </div>

            {/* Order items */}
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              {items.length === 0 ? (
                <p className="text-center text-ink-muted py-8 text-sm">Нет позиций</p>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {items.map((item, idx) => (
                    <OrderItemRow
                      key={item.id}
                      item={item}
                      editable={item.status === 'pending' && !actionLoading && order.status !== 'paid' && order.status !== 'cancelled'}
                      onPlus={()  => adjustQty(item, +1)}
                      onMinus={() => adjustQty(item, -1)}
                      isLast={idx === items.length - 1}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Total */}
            <div className="bg-surface rounded-2xl border border-surface-border px-4 py-3 flex justify-between items-center">
              <span className="font-semibold text-ink">Итого</span>
              <span className="font-bold text-lg text-ink">{formatUZS(order.total_amount)}</span>
            </div>

            {/* Add more items button (only while editable) */}
            {canAddMore && (
              <button
                onClick={() => router.push(`/waiter/table/${tableId}/menu?orderId=${order.id}`)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-brand-500 text-brand-600 font-medium text-sm flex items-center justify-center gap-2 active:bg-green-50 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Добавить позиции
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      {order && (
        <ActionBar
          order={order}
          summary={itemSummary}
          loading={actionLoading}
          onTransition={transitionOrder}
          onPaymentSheet={() => setPaymentSheet(true)}
          onRefresh={() => void fetchData('refresh')}
        />
      )}

      {/* Payment bottom sheet */}
      <PaymentSheet
        open={paymentSheet}
        onClose={() => setPaymentSheet(false)}
        onPay={paymentType => {
          setPaymentSheet(false)
          transitionOrder('paid', paymentType)
        }}
        total={order?.total_amount ?? 0}
      />
    </div>
  )
}

// ─── Order Item Row ───────────────────────────────────────────────────────────

function OrderItemRow({
  item,
  editable,
  onPlus,
  onMinus,
  isLast,
}: {
  item: OrderItem
  editable: boolean
  onPlus: () => void
  onMinus: () => void
  isLast: boolean
}) {
  const name  = item.menu_item?.name ?? 'Позиция'
  const total = item.unit_price * item.quantity

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isLast ? '' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-ink truncate">{name}</p>
          <OrderItemStatusBadge status={item.status} />
        </div>
        <p className="text-xs text-ink-muted">{formatUZS(item.unit_price)} × {item.quantity}</p>
        {item.notes && (
          <p className="text-xs text-ink-secondary mt-1">{item.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editable && (
          <button
            onClick={onMinus}
            className="w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center text-ink-secondary active:scale-90 transition-transform"
            aria-label="Уменьшить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>
        )}
        <span className="text-sm font-bold text-ink w-5 text-center">{item.quantity}</span>
        {editable && (
          <button
            onClick={onPlus}
            className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Увеличить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
        <span className="text-sm font-semibold text-ink w-24 text-right">{formatUZS(total)}</span>
      </div>
    </li>
  )
}

// ─── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({
  order,
  summary,
  loading,
  onTransition,
  onPaymentSheet,
  onRefresh,
}: {
  order: Order
  summary: OrderItemSummary
  loading: boolean
  onTransition: (status: string, payment?: PaymentType) => void
  onPaymentSheet: () => void
  onRefresh: () => void
}) {
  const status = order.status
  const hasPending = summary.pendingItems > 0
  const hasKitchen = summary.inKitchenItems > 0
  const hasReady = summary.readyItems > 0
  const canPay = hasReady && !hasPending && !hasKitchen
  const canCancel = summary.totalItems > 0 && summary.pendingItems === summary.totalItems

  return (
    <div className="sticky bottom-0 bg-surface border-t border-surface-border px-4 pt-3 pb-safe flex flex-col gap-2">
      {hasPending && (
        <div className="flex gap-2">
          <button
            onClick={() => onTransition('in_kitchen')}
            disabled={loading}
            className="flex-1 py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            На кухню{summary.pendingItems > 0 ? ` · ${pluralRu(summary.pendingItems, 'позиция', 'позиции', 'позиций')}` : ''}
          </button>
        </div>
      )}

      {hasPending && hasReady && !hasKitchen && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">Есть готовые и новые позиции</p>
          <p className="text-xs text-blue-800 mt-1">
            Сначала отправьте новые позиции на кухню. Общий счёт можно закрыть только когда в заказе не останется новых или готовящихся блюд.
          </p>
        </div>
      )}

      {hasKitchen && (
        <>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">Заказ уже на кухне</p>
            <p className="text-xs text-amber-800 mt-1">
              {pluralRu(summary.inKitchenItems, 'Позиция', 'Позиции', 'Позиций')} на кухне. Когда повар отметит текущую волну готовой, статус обновится здесь автоматически.
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-surface-muted text-ink-secondary font-semibold text-sm border border-surface-border disabled:opacity-50 active:scale-95 transition-transform"
          >
            Обновить статус
          </button>
        </>
      )}

      {hasReady && (
        <>
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-semibold text-green-900">
              {canPay ? 'Заказ готов к выдаче' : 'Часть заказа уже готова'}
            </p>
            <p className="text-xs text-green-800 mt-1">
              {canPay
                ? 'Передайте заказ гостю и только потом принимайте оплату.'
                : `Готово: ${pluralRu(summary.readyItems, 'позиция', 'позиции', 'позиций')}. Оплата станет доступна, когда не останется новых или готовящихся блюд.`}
            </p>
          </div>
        </>
      )}

      {canPay && (
        <button
          onClick={onPaymentSheet}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-base disabled:opacity-50 active:scale-95 transition-transform"
        >
          Принять оплату
        </button>
      )}

      {canCancel && status === 'open' && (
        <button
          onClick={() => onTransition('cancelled')}
          disabled={loading}
          className="w-full py-2.5 rounded-2xl text-danger text-sm font-medium disabled:opacity-40 active:scale-95 transition-transform"
        >
          Отменить заказ
        </button>
      )}
    </div>
  )
}

function getOrderItemSummary(order: Order | null): OrderItemSummary {
  const items = order?.items ?? []

  return items.reduce<OrderItemSummary>((summary, item) => {
    summary.totalItems += item.quantity
    if (item.status === 'pending') summary.pendingItems += item.quantity
    if (item.status === 'in_kitchen') summary.inKitchenItems += item.quantity
    if (item.status === 'ready') summary.readyItems += item.quantity
    return summary
  }, {
    totalItems: 0,
    pendingItems: 0,
    inKitchenItems: 0,
    readyItems: 0,
  })
}

// ─── Payment Sheet ────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: { type: PaymentType; emoji: string }[] = [
  { type: 'cash',  emoji: '💵' },
  { type: 'card',  emoji: '💳' },
  { type: 'payme', emoji: '📱' },
  { type: 'click', emoji: '📲' },
]

function PaymentSheet({
  open,
  onClose,
  onPay,
  total,
}: {
  open: boolean
  onClose: () => void
  onPay: (type: PaymentType) => void
  total: number
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Способ оплаты">
      <div className="px-4 py-3">
        <p className="text-center text-2xl font-bold text-ink mb-4">{formatUZS(total)}</p>
        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => onPay(opt.type)}
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-surface-muted border border-surface-border text-ink font-medium active:scale-95 transition-transform hover:border-brand-500 hover:bg-green-50"
            >
              <span className="text-3xl" aria-hidden>{opt.emoji}</span>
              <span className="text-sm">{PAYMENT_TYPE_LABELS[opt.type]}</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="h-14 bg-surface border-b border-surface-border animate-pulse" />
      <div className="p-4 flex flex-col gap-4">
        <div className="h-12 rounded-2xl bg-surface animate-pulse" />
        <div className="h-48 rounded-2xl bg-surface animate-pulse" />
        <div className="h-12 rounded-2xl bg-surface animate-pulse" />
      </div>
    </div>
  )
}
