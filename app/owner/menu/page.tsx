'use client'

import { useCallback, useEffect, useState } from 'react'
import AppHeader from '@/components/layout/AppHeader'
import PageContainer, { Section, EmptyState } from '@/components/ui/PageContainer'
import Badge from '@/components/ui/Badge'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { formatUZS } from '@/lib/utils'
import { useOwnerSession } from '../_context/OwnerSessionContext'
import type { MenuCategory, MenuItem } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetMode = 'none' | 'item-create' | 'item-edit' | 'cat-create' | 'cat-edit'

interface ItemForm {
  name:         string
  price:        string
  category_id:  string
  is_available: boolean
}

const EMPTY_ITEM: ItemForm = { name: '', price: '', category_id: '', is_available: true }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerMenuPage() {
  const session = useOwnerSession()

  const [items, setItems]         = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [sheetMode, setSheetMode] = useState<SheetMode>('none')
  const [editItem, setEditItem]   = useState<MenuItem | null>(null)
  const [editCat, setEditCat]     = useState<MenuCategory | null>(null)
  const [itemForm, setItemForm]   = useState<ItemForm>(EMPTY_ITEM)
  const [catName, setCatName]     = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [deleteTarget, setDelete] = useState<{ type: 'item' | 'cat'; id: string; name: string } | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(() => {
    if (session.loading) return
    setLoading(true)
    Promise.all([
      fetch(`/api/menu?shop_id=${session.primaryShopId}`).then(r => r.json()),
      fetch(`/api/categories?shop_id=${session.primaryShopId}`).then(r => r.json()),
    ])
      .then(([itemsRes, catsRes]) => {
        if (itemsRes.error) { setError(itemsRes.error.message); return }
        setItems(itemsRes.data ?? [])
        setCategories((catsRes.data ?? []).sort((a: MenuCategory, b: MenuCategory) => a.sort_order - b.sort_order))
      })
      .catch(() => setError('Не удалось загрузить меню'))
      .finally(() => setLoading(false))
  }, [session.loading, session.primaryShopId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Item CRUD ───────────────────────────────────────────────────────────────
  function openItemCreate() {
    setItemForm({ ...EMPTY_ITEM, category_id: activeCat ?? '' })
    setFormError(null); setEditItem(null); setSheetMode('item-create')
  }

  function openItemEdit(item: MenuItem) {
    setItemForm({ name: item.name, price: String(item.price), category_id: item.category_id ?? '', is_available: item.is_available })
    setFormError(null); setEditItem(item); setSheetMode('item-edit')
  }

  async function saveItem() {
    const priceNum = parseInt(itemForm.price, 10)
    if (!itemForm.name.trim())         { setFormError('Введите название'); return }
    if (isNaN(priceNum) || priceNum < 0) { setFormError('Введите корректную цену'); return }

    setSaving(true); setFormError(null)
    const body = {
      shop_id: session.primaryShopId,
      name: itemForm.name.trim(), price: priceNum,
      category_id: itemForm.category_id || null, is_available: itemForm.is_available,
    }
    const isEdit = sheetMode === 'item-edit' && editItem
    const res = await fetch(
      isEdit ? `/api/menu/${editItem.id}` : '/api/menu',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    ).then(r => r.json()).finally(() => setSaving(false))

    if (res.error) { setFormError(res.error.message); return }
    setSheetMode('none'); fetchAll()
  }

  // ── Category CRUD ───────────────────────────────────────────────────────────
  function openCatCreate() { setCatName(''); setFormError(null); setEditCat(null); setSheetMode('cat-create') }
  function openCatEdit(cat: MenuCategory) { setCatName(cat.name); setFormError(null); setEditCat(cat); setSheetMode('cat-edit') }

  async function saveCat() {
    if (!catName.trim()) { setFormError('Введите название'); return }
    setSaving(true); setFormError(null)
    const isEdit = sheetMode === 'cat-edit' && editCat
    const res = await fetch(
      isEdit ? `/api/categories/${editCat.id}` : '/api/categories',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop_id: session.primaryShopId, name: catName.trim() }) },
    ).then(r => r.json()).finally(() => setSaving(false))
    if (res.error) { setFormError(res.error.message); return }
    setSheetMode('none'); fetchAll()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    await fetch(
      deleteTarget.type === 'item' ? `/api/menu/${deleteTarget.id}` : `/api/categories/${deleteTarget.id}`,
      { method: 'DELETE' },
    ).finally(() => setSaving(false))
    setDelete(null)
    if (activeCat === deleteTarget.id) setActiveCat(null)
    fetchAll()
  }

  async function toggleAvailable(item: MenuItem) {
    await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !item.is_available }),
    })
    fetchAll()
  }

  const filtered = activeCat ? items.filter(i => i.category_id === activeCat) : items

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <AppHeader
        title="Меню"
        subtitle={loading ? '' : `${items.length} позиций`}
        rightSlot={
          <button onClick={openItemCreate} className="w-9 h-9 flex items-center justify-center rounded-xl bg-brand-600 text-white" aria-label="Добавить позицию">
            <PlusIcon />
          </button>
        }
      />

      <PageContainer>
        {/* Category chips + manage */}
        {!loading && (
          <div className="px-4 pt-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveCat(null)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCat === null ? 'bg-brand-600 text-white' : 'bg-surface text-ink-secondary border border-surface-border'}`}>Все</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCat === cat.id ? 'bg-brand-600 text-white' : 'bg-surface text-ink-secondary border border-surface-border'}`}>{cat.name}</button>
            ))}
            <button onClick={openCatCreate} className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium bg-surface-muted text-ink-muted border border-dashed border-surface-border">+ Категория</button>
          </div>
        )}

        {/* Active category actions */}
        {activeCat && (() => {
          const cat = categories.find(c => c.id === activeCat)
          return cat ? (
            <div className="px-4 pb-1 flex gap-4">
              <button onClick={() => openCatEdit(cat)} className="text-xs text-brand-600 font-medium">Изменить</button>
              <button onClick={() => setDelete({ type: 'cat', id: cat.id, name: cat.name })} className="text-xs text-danger font-medium">Удалить категорию</button>
            </div>
          ) : null
        })()}

        <Section className="pt-3 pb-6">
          {loading || session.loading ? (
            <MenuSkeleton />
          ) : error ? (
            <EmptyState title="Ошибка" description={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Нет позиций"
              description={activeCat ? 'В этой категории нет позиций' : 'Добавьте первую позицию меню'}
              action={<button onClick={openItemCreate} className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-semibold">Добавить позицию</button>}
            />
          ) : (
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              <ul className="divide-y divide-surface-border">
                {filtered.map(item => (
                  <MenuItemRow key={item.id} item={item} onEdit={() => openItemEdit(item)} onToggle={() => toggleAvailable(item)} />
                ))}
              </ul>
            </div>
          )}
        </Section>
      </PageContainer>

      {/* Item sheet */}
      <BottomSheet open={sheetMode === 'item-create' || sheetMode === 'item-edit'} onClose={() => setSheetMode('none')} title={sheetMode === 'item-edit' ? 'Изменить позицию' : 'Новая позиция'}>
        <div className="px-4 py-4 flex flex-col gap-4">
          <Field label="Название" placeholder="Лагман" value={itemForm.name} onChange={v => setItemForm(p => ({ ...p, name: v }))} />
          <Field label="Цена (сум)" placeholder="28000" type="number" value={itemForm.price} onChange={v => setItemForm(p => ({ ...p, price: v }))} />
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Категория</label>
            <select value={itemForm.category_id} onChange={e => setItemForm(p => ({ ...p, category_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">— Без категории —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-ink">Доступно для заказа</span>
            <Toggle checked={itemForm.is_available} onChange={v => setItemForm(p => ({ ...p, is_available: v }))} />
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button onClick={saveItem} disabled={saving} className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Сохраняем...' : sheetMode === 'item-edit' ? 'Сохранить' : 'Добавить'}
          </button>
          {sheetMode === 'item-edit' && editItem && (
            <button onClick={() => { setSheetMode('none'); setDelete({ type: 'item', id: editItem.id, name: editItem.name }) }} className="w-full py-2.5 text-danger text-sm font-medium">
              Удалить позицию
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Category sheet */}
      <BottomSheet open={sheetMode === 'cat-create' || sheetMode === 'cat-edit'} onClose={() => setSheetMode('none')} title={sheetMode === 'cat-edit' ? 'Изменить категорию' : 'Новая категория'}>
        <div className="px-4 py-4 flex flex-col gap-4">
          <Field label="Название категории" placeholder="Супы / Основные / Напитки" value={catName} onChange={setCatName} />
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button onClick={saveCat} disabled={saving} className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </BottomSheet>

      {/* Delete confirmation */}
      <BottomSheet open={!!deleteTarget} onClose={() => setDelete(null)} title="Удалить?">
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-ink-secondary">
            Удалить <strong>{deleteTarget?.name}</strong>?{' '}
            {deleteTarget?.type === 'cat' && 'Позиции этой категории останутся без изменений.'}
          </p>
          <button onClick={handleDelete} disabled={saving} className="w-full py-3.5 rounded-2xl bg-danger text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Удаляем...' : 'Удалить'}
          </button>
          <button onClick={() => setDelete(null)} className="w-full py-3 text-ink-secondary text-sm font-medium">Отмена</button>
        </div>
      </BottomSheet>
    </>
  )
}

// ─── Menu item row ────────────────────────────────────────────────────────────

function MenuItemRow({ item, onEdit, onToggle }: { item: MenuItem; onEdit: () => void; onToggle: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium ${item.is_available ? 'text-ink' : 'text-ink-muted line-through'}`}>{item.name}</p>
        <p className="text-xs text-brand-600 font-semibold mt-0.5">{formatUZS(item.price)}</p>
        {item.category && <p className="text-xs text-ink-muted">{item.category.name}</p>}
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {!item.is_available && <Badge variant="danger">Нет</Badge>}
        <Toggle checked={item.is_available} onChange={onToggle} />
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-muted text-ink-secondary" aria-label="Изменить"><PencilIcon /></button>
      </div>
    </li>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-xl bg-surface-muted border border-surface-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (() => void) | ((v: boolean) => void) }) {
  return (
    <button type="button" onClick={() => (onChange as (v: boolean) => void)(!checked)} className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-surface-border'}`} role="switch" aria-checked={checked}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function MenuSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 border-b border-surface-border animate-pulse bg-surface-muted last:border-0" />
      ))}
    </div>
  )
}

function PlusIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}
