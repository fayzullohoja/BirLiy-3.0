'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useWaiterSession } from '../../../_context/WaiterSessionContext'
import { formatUZS } from '@/lib/utils'
import type { MenuCategory, MenuItem } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Cart = Map<string, number>  // menu_item_id → quantity

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuSelectionPage() {
  const { tableId }    = useParams<{ tableId: string }>()
  const searchParams   = useSearchParams()
  const orderId        = searchParams.get('orderId')
  const session        = useWaiterSession()
  const router         = useRouter()

  const [items, setItems]             = useState<MenuItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [activeCategory, setCategory] = useState<string | null>(null)
  const [cart, setCart]               = useState<Cart>(new Map())

  // Telegram back button
  const tgBack = useRef<(() => void) | null>(null)
  useEffect(() => {
    const tg = (window as Window & { Telegram?: { WebApp?: { BackButton?: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void } } } }).Telegram?.WebApp
    if (!tg?.BackButton) return
    tgBack.current = () => router.back()
    tg.BackButton.show()
    tg.BackButton.onClick(tgBack.current)
    return () => {
      if (tgBack.current) tg.BackButton?.offClick(tgBack.current)
      tg.BackButton?.hide()
    }
  }, [router])

  const fetchMenu = useCallback(() => {
    if (session.loading) return
    setLoading(true)
    fetch(`/api/menu?shop_id=${session.primaryShopId}&available_only=true`)
      .then(r => r.json())
      .then(res => {
        if (!res.error) setItems(res.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session.loading, session.primaryShopId])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  // Build category list from items
  const categories: MenuCategory[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (item.category && !seen.has(item.category.id)) {
      seen.add(item.category.id)
      categories.push(item.category)
    }
  }
  // Sort by sort_order
  categories.sort((a, b) => a.sort_order - b.sort_order)

  const filteredItems = activeCategory
    ? items.filter(i => i.category_id === activeCategory)
    : items

  // ── Cart helpers ────────────────────────────────────────────────────────────
  function setQty(itemId: string, delta: number) {
    setCart(prev => {
      const next  = new Map(prev)
      const cur   = next.get(itemId) ?? 0
      const newQt = Math.max(0, cur + delta)
      if (newQt === 0) {
        next.delete(itemId)
      } else {
        next.set(itemId, newQt)
      }
      return next
    })
  }

  const cartTotal = Array.from(cart.entries()).reduce((sum, [id, qty]) => {
    const item = items.find(i => i.id === id)
    return sum + (item?.price ?? 0) * qty
  }, 0)

  const cartCount = Array.from(cart.values()).reduce((a, b) => a + b, 0)

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (cart.size === 0) return
    setSubmitting(true)

    const cartItems = Array.from(cart.entries()).map(([menu_item_id, quantity]) => ({
      menu_item_id,
      quantity,
    }))

    try {
      if (orderId) {
        // Add to existing order
        const res = await fetch(`/api/orders/${orderId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cartItems }),
        }).then(r => r.json())

        if (res.error) throw new Error(res.error.message)
      } else {
        // Create new order
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop_id:  session.primaryShopId,
            table_id: tableId,
            items:    cartItems,
          }),
        }).then(r => r.json())

        if (res.error) throw new Error(res.error.message)
      }

      router.push(`/waiter/table/${tableId}`)
    } catch (e) {
      console.error('[menu submit]', e)
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-surface-muted">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface border-b border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted transition-colors shrink-0"
            aria-label="Назад"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="flex-1 text-base font-bold text-ink">
            {orderId ? 'Добавить позиции' : 'Новый заказ'}
          </h1>
        </div>

        {/* Category chips */}
        {!loading && categories.length > 0 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === null
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-muted text-ink-secondary border border-surface-border'
              }`}
            >
              Все
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted text-ink-secondary border border-surface-border'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto pb-36">
        {loading || session.loading ? (
          <MenuSkeleton />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-ink-muted">
            <p className="text-sm">Нет позиций в этой категории</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-border bg-surface mt-0">
            {filteredItems.map(item => (
              <MenuItemRow
                key={item.id}
                item={item}
                qty={cart.get(item.id) ?? 0}
                onPlus={()  => setQty(item.id, +1)}
                onMinus={() => setQty(item.id, -1)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Floating submit bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-surface-border px-4 pt-3 pb-safe flex gap-3 items-center z-30">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink-muted">{cartCount} позиц.</p>
            <p className="font-bold text-ink">{formatUZS(cartTotal)}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 rounded-2xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform whitespace-nowrap"
          >
            {submitting
              ? 'Отправляем...'
              : orderId
              ? 'Добавить к заказу'
              : 'Создать заказ'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Menu Item Row ────────────────────────────────────────────────────────────

function MenuItemRow({
  item,
  qty,
  onPlus,
  onMinus,
}: {
  item: MenuItem
  qty: number
  onPlus: () => void
  onMinus: () => void
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{item.name}</p>
        <p className="text-xs text-brand-600 font-semibold mt-0.5">{formatUZS(item.price)}</p>
        {item.category && (
          <p className="text-xs text-ink-muted">{item.category.name}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {qty > 0 ? (
          <>
            <button
              onClick={onMinus}
              className="w-8 h-8 rounded-full bg-surface-muted border border-surface-border flex items-center justify-center text-ink-secondary active:scale-90 transition-transform"
              aria-label="Убрать"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>
            <span className="text-sm font-bold text-ink w-5 text-center">{qty}</span>
            <button
              onClick={onPlus}
              className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white active:scale-90 transition-transform"
              aria-label="Добавить"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </>
        ) : (
          <button
            onClick={onPlus}
            className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Добавить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
    </li>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MenuSkeleton() {
  return (
    <ul className="bg-surface divide-y divide-surface-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="h-4 w-2/3 bg-surface-muted rounded animate-pulse mb-1.5" />
            <div className="h-3 w-1/3 bg-surface-muted rounded animate-pulse" />
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-muted animate-pulse" />
        </li>
      ))}
    </ul>
  )
}
