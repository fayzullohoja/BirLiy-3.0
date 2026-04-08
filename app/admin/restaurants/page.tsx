'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import { CardSection, ListItem } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import type { Shop, Subscription, ShopUser } from '@/lib/types'

// ─── Extended type ────────────────────────────────────────────────────────────

interface ShopRow extends Shop {
  subscription: Subscription | null
  members: (ShopUser & { user?: { id: string; name: string; username: string | null; role: string } })[]
}

// ─── Sub-status helpers ───────────────────────────────────────────────────────

const SUB_LABEL: Record<string, string> = {
  trial:     'Пробный',
  active:    'Активная',
  expired:   'Истекла',
  suspended: 'Заблок.',
}

const SUB_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  trial:     'warning',
  active:    'success',
  expired:   'danger',
  suspended: 'neutral',
}

function daysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRestaurantsPage() {
  const router = useRouter()

  const [shops, setShops]     = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Create shop sheet
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName]             = useState('')
  const [address, setAddress]       = useState('')
  const [phone, setPhone]           = useState('')
  const [creating, setCreating]     = useState(false)
  const [nameError, setNameError]   = useState<string | null>(null)

  const fetchShops = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/shops')
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error.message)
        else setShops(res.data ?? [])
      })
      .catch(() => setError('Не удалось загрузить заведения'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchShops() }, [fetchShops])

  function openCreate() {
    setName(''); setAddress(''); setPhone('')
    setNameError(null)
    setCreateOpen(true)
  }

  async function handleCreate() {
    if (!name.trim()) { setNameError('Введите название'); return }
    setCreating(true); setNameError(null)
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), address: address || undefined, phone: phone || undefined }),
      }).then(r => r.json())
      if (res.error) { setNameError(res.error.message); return }
      setCreateOpen(false)
      toast.success(`Заведение «${name.trim()}» создано`)
      fetchShops()
    } finally { setCreating(false) }
  }

  const ownerOf = (shop: ShopRow) =>
    shop.members?.find(m => m.role === 'owner')?.user?.name ?? '—'

  return (
    <>
      <AppHeader
        title="Заведения"
        subtitle={loading ? '' : `${shops.length} заведений`}
        rightSlot={
          <Button variant="primary" size="sm" onClick={openCreate} aria-label="Добавить заведение">
            <PlusIcon />
          </Button>
        }
      />

      <PageContainer>
        <Section className="pt-4 pb-6">
          {loading ? (
            <ShopSkeleton />
          ) : error ? (
            <EmptyState
              title="Ошибка загрузки"
              description={error}
              action={<Button variant="secondary" size="sm" onClick={fetchShops}>Повторить</Button>}
            />
          ) : shops.length === 0 ? (
            <EmptyState
              icon={<ShopIcon />}
              title="Заведений нет"
              description="Нажмите + чтобы создать первое заведение"
            />
          ) : (
            <CardSection>
              <div className="divide-y divide-surface-border">
                {shops.map(shop => {
                  const sub  = shop.subscription
                  const days = sub ? daysLeft(sub.expires_at) : null

                  return (
                    <ListItem
                      key={shop.id}
                      leading={<ShopAvatar name={shop.name} active={shop.is_active} />}
                      title={shop.name}
                      subtitle={`Владелец: ${ownerOf(shop)}${shop.address ? ` · ${shop.address}` : ''}`}
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          {sub ? (
                            <Badge variant={SUB_BADGE[sub.status] ?? 'neutral'}>
                              {SUB_LABEL[sub.status] ?? sub.status}
                            </Badge>
                          ) : (
                            <Badge variant="neutral">Нет</Badge>
                          )}
                          {days !== null && (
                            <span className={`text-xs font-medium ${days < 7 ? 'text-danger' : 'text-ink-muted'}`}>
                              {days > 0 ? `${days} дн.` : 'Истекла'}
                            </span>
                          )}
                        </div>
                      }
                      onClick={() => router.push(`/admin/restaurants/${shop.id}`)}
                    />
                  )
                })}
              </div>
            </CardSection>
          )}
        </Section>
      </PageContainer>

      {/* Create sheet */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Новое заведение">
        <div className="px-4 py-4 flex flex-col gap-3">
          <FormField label="Название" required value={name} onChange={setName} placeholder="Ош Маркази" error={nameError ?? undefined} autoFocus />
          <FormField label="Адрес"    value={address} onChange={setAddress} placeholder="ул. Навои 12, Ташкент" />
          <FormField label="Телефон"  value={phone}   onChange={setPhone}   placeholder="+998 90 123 45 67" type="tel" />
          <Button fullWidth loading={creating} onClick={handleCreate}>Создать заведение</Button>
          <p className="text-xs text-center text-ink-muted">
            Пробный период 30 дней активируется автоматически
          </p>
        </div>
      </BottomSheet>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShopAvatar({ name, active }: { name: string; active: boolean }) {
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-brand-600' : 'bg-gray-300'}`}>
      <span className="text-sm font-bold text-white">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function ShopSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
      ))}
    </div>
  )
}

function ShopIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
