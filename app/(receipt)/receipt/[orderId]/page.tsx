'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BrandLogo from '@/components/brand/BrandLogo'
import { formatUZS, formatDate, formatTime, PAYMENT_TYPE_LABELS } from '@/lib/utils'
import type { PublicReceiptOrder } from '@/lib/types'

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<PublicReceiptOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/receipt/${orderId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setOrder(res.data)
      })
      .catch(() => setError('Не удалось загрузить чек'))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Загружаем чек...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <p className="text-lg font-bold text-gray-800">Чек не найден</p>
          <p className="text-sm text-gray-500 mt-1">{error ?? 'Заказ не существует или у вас нет доступа'}</p>
        </div>
      </div>
    )
  }

  const items = order.items ?? []
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

  return (
    <>
      {/* Action bar — hidden in print */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-2 z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-900 text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            <PrintIcon />
            Печать
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                void navigator.share({ title: 'Чек BirLiy', url: window.location.href })
              } else {
                void navigator.clipboard.writeText(window.location.href)
                alert('Ссылка скопирована')
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold active:scale-95 transition-transform"
          >
            <ShareIcon />
            Поделиться
          </button>
        </div>
        <button
          onClick={() => router.push('/waiter')}
          className="w-full py-2.5 rounded-2xl text-gray-500 text-sm font-medium active:bg-gray-50 transition-colors"
        >
          К столам
        </button>
      </div>

      {/* Receipt */}
      <div className="min-h-screen bg-gray-100 print:bg-white py-8 print:py-0 flex justify-center">
        <div className="w-full max-w-sm bg-white print:shadow-none shadow-xl rounded-2xl print:rounded-none overflow-hidden pb-36 print:pb-4">

          {/* Header */}
          <div className="text-center px-6 pt-8 pb-5 border-b border-dashed border-gray-300">
            <BrandLogo size={56} className="mx-auto mb-3 rounded-2xl" priority />
            <h1 className="text-xl font-bold text-gray-900">BirLiy Kassa</h1>
            <p className="text-sm text-gray-500 mt-0.5">Кассовый чек</p>
          </div>

          {/* Order info */}
          <div className="px-6 py-4 space-y-2 border-b border-dashed border-gray-300">
            <ReceiptRow label="Дата" value={formatDate(order.created_at)} />
            <ReceiptRow label="Время" value={formatTime(order.created_at)} />
            <ReceiptRow label="Стол" value={order.table?.name ?? `#${order.table_id.slice(-4)}`} />
            {order.waiter?.name && (
              <ReceiptRow label="Официант" value={order.waiter.name} />
            )}
            <ReceiptRow label="Номер заказа" value={`#${order.id.slice(-6).toUpperCase()}`} />
          </div>

          {/* Items */}
          <div className="px-6 py-4 border-b border-dashed border-gray-300">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Состав заказа</p>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className="text-sm text-gray-400 w-5 shrink-0">{item.quantity}×</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {item.menu_item?.name ?? 'Позиция'}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
                    {formatUZS(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 space-y-2 border-b border-dashed border-gray-300">
            {subtotal !== order.total_amount && (
              <ReceiptRow label="Подытог" value={formatUZS(subtotal)} />
            )}
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-gray-900">ИТОГО</span>
              <span className="text-xl font-black text-gray-900 tabular-nums">
                {formatUZS(order.total_amount)}
              </span>
            </div>
            {order.payment_type && (
              <ReceiptRow
                label="Оплата"
                value={PAYMENT_TYPE_LABELS[order.payment_type] ?? order.payment_type}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-5 text-center">
            <p className="text-xs text-gray-400">Спасибо за визит!</p>
            <p className="text-[10px] text-gray-300 mt-2">Powered by BirLiy Kassa</p>
          </div>
        </div>
      </div>
    </>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  )
}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}
