'use client'

import { useEffect, useMemo, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { toast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import DataTable, { type ColumnDef } from '@/components/dashboard/DataTable'
import SearchInput from '@/components/dashboard/SearchInput'
import { SkeletonCard } from '@/components/dashboard/Skeleton'
import { useDashboardSession } from '@/components/dashboard/DashboardSessionContext'
import type { MenuCategory, MenuItem } from '@/lib/types'
import { formatUZS } from '@/lib/utils'

type CategoryFilter = 'all' | string
type EditorMode = 'none' | 'item-create' | 'item-edit' | 'category-create' | 'category-edit'

interface ItemFormState {
  name: string
  category_id: string
  price: string
  is_available: boolean
}

interface CategoryFormState {
  name: string
  sort_order: string
}

const EMPTY_ITEM_FORM: ItemFormState = {
  name: '',
  category_id: '',
  price: '',
  is_available: true,
}

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: '',
  sort_order: '0',
}

interface MenuRow extends MenuItem {
  category_label: string
}

export default function DashboardOwnerMenuPage() {
  const session = useDashboardSession()
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')

  const [editorMode, setEditorMode] = useState<EditorMode>('none')
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'item'; value: MenuItem }
    | { type: 'category'; value: MenuCategory }
    | null
  >(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!session.selectedShopId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [categoriesRes, itemsRes] = await Promise.all([
          fetch(`/api/categories?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json()),
          fetch(`/api/menu?shop_id=${session.selectedShopId}`, { cache: 'no-store' }).then((response) => response.json()),
        ])

        if (cancelled) return

        if (categoriesRes.error) {
          setError(categoriesRes.error.message)
          return
        }
        if (itemsRes.error) {
          setError(itemsRes.error.message)
          return
        }

        setCategories((categoriesRes.data ?? []).sort((left: MenuCategory, right: MenuCategory) => left.sort_order - right.sort_order))
        setItems(itemsRes.data ?? [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить меню заведения')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session.selectedShopId])

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false
      if (!needle) return true

      return item.name.toLowerCase().includes(needle)
        || item.category?.name?.toLowerCase().includes(needle)
    })
  }, [categoryFilter, items, search])

  const menuRows = useMemo<MenuRow[]>(() => (
    visibleItems.map((item) => ({
      ...item,
      category_label: item.category?.name ?? 'Без категории',
    }))
  ), [visibleItems])

  const columns: ColumnDef<MenuRow>[] = [
    {
      key: 'name',
      header: 'Название',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.name}</p>
          <p className="mt-1 text-xs text-ink-muted">ID: {row.id.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'category_label',
      header: 'Категория',
      sortable: true,
      render: (row) => row.category_label,
    },
    {
      key: 'price',
      header: 'Цена',
      sortable: true,
      render: (row) => formatUZS(row.price),
    },
    {
      key: 'is_available',
      header: 'Доступно',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void toggleAvailability(row)
          }}
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.is_available ? 'bg-green-100 text-green-700' : 'bg-surface-muted text-ink-secondary'}`}
        >
          {row.is_available ? 'Да' : 'Нет'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              openEditItem(row)
            }}
          >
            Изменить
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget({ type: 'item', value: row })
            }}
          >
            Удалить
          </Button>
        </div>
      ),
    },
  ]

  function openCreateItem() {
    setEditingItem(null)
    setItemForm(EMPTY_ITEM_FORM)
    setEditorMode('item-create')
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      category_id: item.category_id ?? '',
      price: String(item.price),
      is_available: item.is_available,
    })
    setEditorMode('item-edit')
  }

  function openCreateCategory() {
    setEditingCategory(null)
    setCategoryForm({
      name: '',
      sort_order: String(categories.length),
    })
    setEditorMode('category-create')
  }

  function openEditCategory(category: MenuCategory) {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      sort_order: String(category.sort_order),
    })
    setEditorMode('category-edit')
  }

  async function toggleAvailability(item: MenuItem) {
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !item.is_available }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      setItems((prev) => prev.map((current) => current.id === item.id ? res.data : current))
      toast.success(!item.is_available ? 'Позиция снова доступна' : 'Позиция скрыта из меню')
    } catch {
      toast.error('Не удалось обновить доступность позиции')
    }
  }

  async function handleSaveItem() {
    if (!session.selectedShopId) return
    if (!itemForm.name.trim()) {
      toast.error('Введите название позиции')
      return
    }

    const price = Number.parseInt(itemForm.price, 10)
    if (!Number.isInteger(price) || price < 0) {
      toast.error('Введите корректную цену')
      return
    }

    setSaving(true)
    try {
      const url = editorMode === 'item-create' ? '/api/menu' : `/api/menu/${editingItem?.id}`
      const res = await fetch(url, {
        method: editorMode === 'item-create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: session.selectedShopId,
          name: itemForm.name.trim(),
          category_id: itemForm.category_id || null,
          price,
          is_available: itemForm.is_available,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      const nextItem = res.data as MenuItem
      setItems((prev) => {
        const next = editorMode === 'item-create'
          ? [nextItem, ...prev]
          : prev.map((item) => item.id === nextItem.id ? nextItem : item)
        return next
      })
      setEditorMode('none')
      toast.success(editorMode === 'item-create' ? 'Позиция добавлена' : 'Позиция обновлена')
    } catch {
      toast.error('Не удалось сохранить позицию')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveCategory() {
    if (!session.selectedShopId) return
    if (!categoryForm.name.trim()) {
      toast.error('Введите название категории')
      return
    }

    const sortOrder = Number.parseInt(categoryForm.sort_order, 10)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error('Введите корректный порядок сортировки')
      return
    }

    setSaving(true)
    try {
      const url = editorMode === 'category-create'
        ? '/api/categories'
        : `/api/categories/${editingCategory?.id}`
      const res = await fetch(url, {
        method: editorMode === 'category-create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: session.selectedShopId,
          name: categoryForm.name.trim(),
          sort_order: sortOrder,
        }),
      }).then((response) => response.json())

      if (res.error) {
        toast.error(res.error.message)
        return
      }

      const nextCategory = res.data as MenuCategory
      setCategories((prev) => {
        const next = editorMode === 'category-create'
          ? [...prev, nextCategory]
          : prev.map((category) => category.id === nextCategory.id ? nextCategory : category)
        return next.sort((left, right) => left.sort_order - right.sort_order)
      })
      setItems((prev) => prev.map((item) => (
        item.category_id === nextCategory.id
          ? {
              ...item,
              category: nextCategory,
            }
          : item
      )))
      setEditorMode('none')
      toast.success(editorMode === 'category-create' ? 'Категория добавлена' : 'Категория обновлена')
    } catch {
      toast.error('Не удалось сохранить категорию')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const url = deleteTarget.type === 'item'
        ? `/api/menu/${deleteTarget.value.id}`
        : `/api/categories/${deleteTarget.value.id}`
      const res = await fetch(url, { method: 'DELETE' })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error?.message ?? 'Не удалось удалить запись')
        return
      }

      if (deleteTarget.type === 'item') {
        setItems((prev) => prev.filter((item) => item.id !== deleteTarget.value.id))
        toast.success('Позиция удалена')
      } else {
        setCategories((prev) => prev.filter((category) => category.id !== deleteTarget.value.id))
        setItems((prev) => prev.map((item) => item.category_id === deleteTarget.value.id ? { ...item, category_id: null, category: undefined } : item))
        if (categoryFilter === deleteTarget.value.id) {
          setCategoryFilter('all')
        }
        toast.success('Категория удалена')
      }

      setDeleteTarget(null)
    } catch {
      toast.error('Не удалось удалить запись')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {loading || session.loading ? (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <SkeletonCard className="h-[520px]" />
          <SkeletonCard className="h-[520px]" />
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Категории</p>
                <h2 className="mt-2 text-xl font-bold text-ink">Структура меню</h2>
              </div>
              <Button size="sm" onClick={openCreateCategory}>+ Категория</Button>
            </div>

            <div className="mt-5 space-y-2">
              <CategoryButton
                label="Все позиции"
                count={items.length}
                active={categoryFilter === 'all'}
                onClick={() => setCategoryFilter('all')}
              />
              {categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2">
                  <CategoryButton
                    label={category.name}
                    count={items.filter((item) => item.category_id === category.id).length}
                    active={categoryFilter === category.id}
                    onClick={() => setCategoryFilter(category.id)}
                  />
                  <button
                    type="button"
                    onClick={() => openEditCategory(category)}
                    aria-label={`Изменить ${category.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border text-ink-secondary hover:bg-surface-muted"
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: 'category', value: category })}
                    aria-label={`Удалить ${category.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border text-ink-secondary hover:bg-surface-muted"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-3xl border border-surface-border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Поиск по названию позиции или категории"
                  className="w-full max-w-md"
                />
                <Button onClick={openCreateItem}>Добавить позицию</Button>
              </div>
            </div>

            <DataTable<MenuRow>
              columns={columns}
              data={menuRows}
              keyField="id"
              emptyText="Позиции для выбранного фильтра пока не найдены"
              pageSize={12}
            />
          </section>
        </div>
      )}

      {(editorMode === 'item-create' || editorMode === 'item-edit') && (
        <RightDrawer
          title={editorMode === 'item-create' ? 'Новая позиция' : 'Изменить позицию'}
          onClose={() => setEditorMode('none')}
        >
          <div className="space-y-4">
            <FormField
              label="Название"
              required
              value={itemForm.name}
              onChange={(value) => setItemForm((prev) => ({ ...prev, name: value }))}
            />
            <FormField
              as="select"
              label="Категория"
              value={itemForm.category_id}
              onChange={(value) => setItemForm((prev) => ({ ...prev, category_id: value }))}
            >
              <option value="">Без категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </FormField>
            <FormField
              label="Цена, сум"
              type="number"
              required
              value={itemForm.price}
              onChange={(value) => setItemForm((prev) => ({ ...prev, price: value }))}
            />

            <label className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">Доступно в меню</p>
                <p className="mt-1 text-xs text-ink-secondary">Если выключить, позиция останется в истории, но исчезнет из выдачи официанту.</p>
              </div>
              <button
                type="button"
                onClick={() => setItemForm((prev) => ({ ...prev, is_available: !prev.is_available }))}
                className={`inline-flex h-8 min-w-[72px] items-center justify-center rounded-full px-3 text-xs font-semibold ${itemForm.is_available ? 'bg-brand-600 text-white' : 'bg-white text-ink-secondary border border-surface-border'}`}
              >
                {itemForm.is_available ? 'Вкл' : 'Выкл'}
              </button>
            </label>

            <div className="pt-2">
              <Button fullWidth loading={saving} onClick={handleSaveItem}>
                {editorMode === 'item-create' ? 'Создать позицию' : 'Сохранить изменения'}
              </Button>
            </div>
          </div>
        </RightDrawer>
      )}

      {(editorMode === 'category-create' || editorMode === 'category-edit') && (
        <DialogShell
          title={editorMode === 'category-create' ? 'Новая категория' : 'Изменить категорию'}
          onClose={() => setEditorMode('none')}
        >
          <div className="space-y-4">
            <FormField
              label="Название категории"
              required
              value={categoryForm.name}
              onChange={(value) => setCategoryForm((prev) => ({ ...prev, name: value }))}
            />
            <FormField
              label="Порядок сортировки"
              type="number"
              value={categoryForm.sort_order}
              onChange={(value) => setCategoryForm((prev) => ({ ...prev, sort_order: value }))}
            />
            <div className="flex justify-end">
              <Button loading={saving} onClick={handleSaveCategory}>
                {editorMode === 'category-create' ? 'Создать категорию' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </DialogShell>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'category' ? 'Удалить категорию?' : 'Удалить позицию?'}
        description={
          deleteTarget?.type === 'category'
            ? 'Позиции останутся в меню, но будут отвязаны от категории.'
            : 'Позиция будет удалена из меню. Если у неё уже есть история заказов, backend переключит её в unavailable.'
        }
        confirmLabel="Удалить"
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  )
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-border bg-white text-ink hover:bg-surface-muted'}`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <Badge variant={active ? 'default' : 'neutral'}>{count}</Badge>
    </button>
  )
}

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Закрыть форму"
      />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-surface-border bg-white p-6 shadow-card-md">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function RightDrawer({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Закрыть панель"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-surface-border bg-white p-6 shadow-card-md">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Меню</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
    </svg>
  )
}
