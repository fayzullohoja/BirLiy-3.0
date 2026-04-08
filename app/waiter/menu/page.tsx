'use client'

import { useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatUZS } from '@/lib/utils'
import { useWaiterSession } from '../_context/WaiterSessionContext'
import type { MenuCategory, MenuItem } from '@/lib/types'

type CategoryWithItems = MenuCategory & { items: MenuItem[] }

export default function WaiterMenuPage() {
  const session = useWaiterSession()

  const [grouped, setGrouped] = useState<CategoryWithItems[]>([])
  const [uncategorized, setUncategorized] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (session.loading) return
    let cancelled = false

    fetch(`/api/menu?shop_id=${session.primaryShopId}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
          return
        }

        const items: MenuItem[] = res.data ?? []
        const categoryMap = new Map<string, CategoryWithItems>()
        const noCategory: MenuItem[] = []

        for (const item of items) {
          if (item.category) {
            const existing = categoryMap.get(item.category.id)
            if (existing) {
              existing.items.push(item)
            } else {
              categoryMap.set(item.category.id, {
                ...item.category,
                shop_id: item.shop_id,
                created_at: item.category.created_at,
                items: [item],
              })
            }
          } else {
            noCategory.push(item)
          }
        }

        const sorted = Array.from(categoryMap.values()).sort(
          (a, b) => a.sort_order - b.sort_order,
        )

        if (!cancelled) {
          setGrouped(sorted)
          setUncategorized(noCategory)
        }
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить меню') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [session.loading, session.primaryShopId])

  const isEmpty = !loading && !error && grouped.length === 0 && uncategorized.length === 0

  return (
    <>
      <AppHeader title="Меню" />

      <PageContainer>
        <div className="pt-4 pb-6 space-y-5">
          {loading || session.loading ? (
            <MenuSkeleton />
          ) : error ? (
            <EmptyState title="Ошибка" description={error} />
          ) : isEmpty ? (
            <EmptyState
              title="Меню пусто"
              description="Позиции меню ещё не добавлены"
            />
          ) : (
            <>
              {grouped.map(category => (
                <Section key={category.id} title={category.name}>
                  <CardSection>
                    <div className="divide-y divide-surface-border">
                      {category.items.map(item => (
                        <MenuRow key={item.id} item={item} />
                      ))}
                    </div>
                  </CardSection>
                </Section>
              ))}
              {uncategorized.length > 0 && (
                <Section title="Без категории">
                  <CardSection>
                    <div className="divide-y divide-surface-border">
                      {uncategorized.map(item => (
                        <MenuRow key={item.id} item={item} />
                      ))}
                    </div>
                  </CardSection>
                </Section>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </>
  )
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <ListItem
      title={item.name}
      trailing={
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-bold text-ink">{formatUZS(item.price)}</span>
          {!item.is_available && <Badge variant="neutral">Нет</Badge>}
        </div>
      }
    />
  )
}

function MenuSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-4 w-24 bg-surface-muted rounded animate-pulse mx-4 mb-3" />
          <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden divide-y divide-surface-border">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-14 bg-surface animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
