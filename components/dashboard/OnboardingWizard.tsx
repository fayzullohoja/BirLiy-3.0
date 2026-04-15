'use client'

/**
 * OnboardingWizard
 *
 * Appears automatically on the owner dashboard when the shop has no tables
 * AND no menu items (i.e. freshly set up). Can be dismissed (stored in
 * localStorage so it stays hidden after first close).
 *
 * Steps:
 *  0 — Welcome
 *  1 — Add first table(s)
 *  2 — Add first menu category + item
 *  3 — Done
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/Toast'

const LS_KEY = 'birliy:onboarding:dismissed'

interface SetupState {
  hasTables: boolean
  hasMenu: boolean
}

interface Props {
  shopId: string
  shopName: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingWizard({ shopId, shopName }: Props) {
  const [setup, setSetup]       = useState<SetupState | null>(null)
  const [open, setOpen]         = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep]         = useState(0)
  const loaded                  = useRef(false)

  // Check if already dismissed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem(LS_KEY)
      if (val === shopId) {
        setDismissed(true)
        return
      }
    }

    async function checkSetup() {
      try {
        const [tablesRes, menuRes] = await Promise.all([
          fetch(`/api/tables?shop_id=${shopId}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/menu?shop_id=${shopId}`, { cache: 'no-store' }).then(r => r.json()),
        ])

        const hasTables = (tablesRes.data?.length ?? 0) > 0
        const hasMenu   = (menuRes.data?.length   ?? 0) > 0

        setSetup({ hasTables, hasMenu })

        // Auto-open wizard only if BOTH are empty (brand new shop)
        if (!hasTables && !hasMenu) {
          setOpen(true)
        }
      } catch {
        // silent — wizard is non-critical
      }
    }

    if (!loaded.current) {
      loaded.current = true
      void checkSetup()
    }
  }, [shopId])

  function dismiss() {
    localStorage.setItem(LS_KEY, shopId)
    setDismissed(true)
    setOpen(false)
  }

  // If dismissed, show nothing
  if (dismissed) return null

  // While loading or fully set up (has both tables and menu), show nothing
  if (!setup || (setup.hasTables && setup.hasMenu)) return null

  // Partial setup: show a banner
  if (!open) {
    return (
      <SetupBanner
        setup={setup}
        onOpen={() => { setStep(0); setOpen(true) }}
        onDismiss={dismiss}
      />
    )
  }

  // Full wizard modal
  return (
    <WizardModal
      step={step}
      shopId={shopId}
      shopName={shopName}
      setup={setup}
      onStepChange={setStep}
      onSetupChange={(next) => setSetup(s => s ? { ...s, ...next } : s)}
      onDismiss={dismiss}
    />
  )
}

// ─── Setup Banner (collapsed state) ──────────────────────────────────────────

function SetupBanner({ setup, onOpen, onDismiss }: { setup: SetupState; onOpen: () => void; onDismiss: () => void }) {
  const missing: string[] = []
  if (!setup.hasTables) missing.push('столы')
  if (!setup.hasMenu)   missing.push('меню')

  return (
    <div className="flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
        <WandIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900">Настройте заведение</p>
        <p className="mt-1 text-sm text-amber-800">
          Не настроено: <strong>{missing.join(', ')}</strong>. Завершите базовую настройку, чтобы официанты и кухня могли работать.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpen}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 active:scale-95 transition-transform"
        >
          Настроить
        </button>
        <button
          onClick={onDismiss}
          className="rounded-xl px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          aria-label="Скрыть"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Wizard Modal ─────────────────────────────────────────────────────────────

const STEPS = ['Добро пожаловать', 'Столы', 'Меню', 'Готово']

interface WizardModalProps {
  step: number
  shopId: string
  shopName: string
  setup: SetupState
  onStepChange: (s: number) => void
  onSetupChange: (partial: Partial<SetupState>) => void
  onDismiss: () => void
}

function WizardModal({ step, shopId, shopName, setup, onStepChange, onSetupChange, onDismiss }: WizardModalProps) {
  const router = useRouter()

  function nextStep() { onStepChange(step + 1) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1.5 bg-surface-muted">
          <div
            className="h-full bg-brand-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-brand-600 text-white' :
                  i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-400' :
                  'bg-surface-muted text-ink-muted'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-5 ${i < step ? 'bg-brand-400' : 'bg-surface-border'}`} />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={onDismiss}
            className="rounded-xl p-1.5 text-ink-muted hover:bg-surface-muted transition-colors"
            aria-label="Закрыть"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step content */}
        <div className="px-6 py-6">
          {step === 0 && (
            <StepWelcome shopName={shopName} onNext={nextStep} />
          )}
          {step === 1 && (
            <StepTables
              shopId={shopId}
              hasTables={setup.hasTables}
              onCreated={() => onSetupChange({ hasTables: true })}
              onNext={nextStep}
            />
          )}
          {step === 2 && (
            <StepMenu
              shopId={shopId}
              hasMenu={setup.hasMenu}
              onCreated={() => onSetupChange({ hasMenu: true })}
              onNext={nextStep}
            />
          )}
          {step === 3 && (
            <StepDone
              setup={{ ...setup }}
              router={router}
              onDismiss={onDismiss}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ shopName, onNext }: { shopName: string; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="w-16 h-16 rounded-3xl bg-brand-600 flex items-center justify-center">
        <span className="text-3xl font-bold text-white">B</span>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-ink">Добро пожаловать!</h2>
        <p className="mt-2 text-sm text-ink-secondary max-w-sm">
          Это <strong>{shopName}</strong>. Давайте за пару минут настроим всё необходимое: столы, меню — и вы сможете принимать первые заказы.
        </p>
      </div>
      <div className="w-full text-left bg-surface-muted rounded-2xl p-4 space-y-2.5">
        <CheckItem text="Создать хотя бы один стол" />
        <CheckItem text="Добавить первую позицию меню" />
        <CheckItem text="Пригласить официантов через раздел Персонал" />
      </div>
      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold hover:bg-brand-700 active:scale-95 transition-transform"
      >
        Начать настройку →
      </button>
    </div>
  )
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 text-xs font-bold">✓</span>
      {text}
    </div>
  )
}

// ─── Step 1: Tables ───────────────────────────────────────────────────────────

function StepTables({
  shopId,
  hasTables,
  onCreated,
  onNext,
}: {
  shopId: string
  hasTables: boolean
  onCreated: () => void
  onNext: () => void
}) {
  const [name, setName]       = useState('')
  const [capacity, setCapacity] = useState('4')
  const [saving, setSaving]   = useState(false)
  const [created, setCreated] = useState(hasTables)

  async function create() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, number: 1, name: name.trim(), capacity: Number(capacity) || 4 }),
      }).then(r => r.json())

      if (res.error) {
        toast.error(res.error.message ?? 'Не удалось создать стол')
      } else {
        toast.success('Стол создан')
        setCreated(true)
        onCreated()
        setName('')
      }
    } catch {
      toast.error('Не удалось создать стол')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-ink">Добавьте столы</h2>
        <p className="mt-1 text-sm text-ink-secondary">Создайте хотя бы один стол, чтобы официанты могли принимать заказы.</p>
      </div>

      {created && (
        <div className="flex items-center gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-800">
          <span>✓</span> Стол добавлен! Можно добавить ещё или продолжить.
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void create()}
          placeholder="Название стола (напр. Стол 1)"
          className="flex-1 rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          type="number"
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
          min={1}
          max={20}
          className="w-20 rounded-xl border border-surface-border bg-surface-muted px-3 py-2.5 text-sm text-center text-ink focus:outline-none focus:ring-2 focus:ring-brand-400"
          title="Кол-во мест"
        />
        <button
          onClick={void create}
          disabled={saving || !name.trim()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-brand-700 active:scale-95 transition-transform"
        >
          {saving ? '...' : '+ Добавить'}
        </button>
      </div>
      <p className="text-xs text-ink-muted">Второй столбец — количество мест. Столов можно добавить сколько угодно в разделе «Столы».</p>

      <div className="flex gap-2 pt-1">
        {created ? (
          <button
            onClick={onNext}
            className="flex-1 py-3 rounded-2xl bg-brand-600 text-white font-semibold hover:bg-brand-700 active:scale-95 transition-transform"
          >
            Далее →
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex-1 py-3 rounded-2xl border border-surface-border text-ink-secondary text-sm font-medium hover:bg-surface-muted transition-colors"
          >
            Пропустить
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Step 2: Menu ─────────────────────────────────────────────────────────────

function StepMenu({
  shopId,
  hasMenu,
  onCreated,
  onNext,
}: {
  shopId: string
  hasMenu: boolean
  onCreated: () => void
  onNext: () => void
}) {
  const [categoryName, setCategoryName] = useState('')
  const [itemName, setItemName]         = useState('')
  const [price, setPrice]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [created, setCreated]           = useState(hasMenu)

  async function create() {
    if (!categoryName.trim() || !itemName.trim() || !price.trim()) return
    setSaving(true)
    try {
      // 1. Create category
      const catRes = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, name: categoryName.trim(), sort_order: 1 }),
      }).then(r => r.json())

      if (catRes.error) {
        toast.error(catRes.error.message ?? 'Не удалось создать категорию')
        return
      }

      const categoryId = catRes.data?.id
      if (!categoryId) { toast.error('Ошибка создания категории'); return }

      // 2. Create menu item
      const itemRes = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          category_id: categoryId,
          name: itemName.trim(),
          price: Number(price.replace(/\D/g, '')) || 0,
          is_available: true,
          sort_order: 1,
        }),
      }).then(r => r.json())

      if (itemRes.error) {
        toast.error(itemRes.error.message ?? 'Не удалось добавить блюдо')
        return
      }

      toast.success('Меню создано')
      setCreated(true)
      onCreated()
    } catch {
      toast.error('Не удалось создать меню')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-ink">Добавьте меню</h2>
        <p className="mt-1 text-sm text-ink-secondary">Создайте первую категорию и первое блюдо. Расширите меню в разделе «Меню».</p>
      </div>

      {created && (
        <div className="flex items-center gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-800">
          <span>✓</span> Меню создано! Продолжите добавлять блюда в разделе «Меню».
        </div>
      )}

      {!created && (
        <div className="flex flex-col gap-3">
          <input
            value={categoryName}
            onChange={e => setCategoryName(e.target.value)}
            placeholder="Название категории (напр. Горячие блюда)"
            className="rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <div className="flex gap-2">
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="Название блюда"
              className="flex-1 rounded-xl border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Цена"
              type="number"
              min={0}
              className="w-28 rounded-xl border border-surface-border bg-surface-muted px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <button
            onClick={void create}
            disabled={saving || !categoryName.trim() || !itemName.trim() || !price.trim()}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-brand-700 active:scale-95 transition-transform"
          >
            {saving ? 'Создаю...' : 'Создать категорию и блюдо'}
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onNext}
          className={`flex-1 py-3 rounded-2xl font-semibold active:scale-95 transition-transform ${
            created
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'border border-surface-border text-ink-secondary text-sm hover:bg-surface-muted'
          }`}
        >
          {created ? 'Далее →' : 'Пропустить'}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Done ─────────────────────────────────────────────────────────────

function StepDone({
  setup,
  router,
  onDismiss,
}: {
  setup: SetupState
  router: ReturnType<typeof useRouter>
  onDismiss: () => void
}) {
  const allDone = setup.hasTables && setup.hasMenu

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
        {allDone ? '🎉' : '✅'}
      </div>
      <div>
        <h2 className="text-2xl font-bold text-ink">{allDone ? 'Всё готово!' : 'Хорошее начало!'}</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          {allDone
            ? 'Заведение настроено. Пригласите персонал и начните принимать заказы.'
            : 'Вы заполнили часть настроек. Остальное можно добавить позже в соответствующих разделах.'}
        </p>
      </div>
      <div className="w-full text-left space-y-2">
        <DoneItem label="Столы" done={setup.hasTables} href="/dashboard/owner/tables" router={router} onDismiss={onDismiss} />
        <DoneItem label="Меню" done={setup.hasMenu} href="/dashboard/owner/menu" router={router} onDismiss={onDismiss} />
        <DoneItem label="Персонал" done={false} href="/dashboard/owner/staff" router={router} onDismiss={onDismiss} optional />
      </div>
      <button
        onClick={onDismiss}
        className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-semibold hover:bg-brand-700 active:scale-95 transition-transform"
      >
        Перейти в панель управления
      </button>
    </div>
  )
}

function DoneItem({
  label,
  done,
  href,
  router,
  onDismiss,
  optional,
}: {
  label: string
  done: boolean
  href: string
  router: ReturnType<typeof useRouter>
  onDismiss: () => void
  optional?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-muted px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-surface-border text-ink-muted'}`}>
          {done ? '✓' : '○'}
        </span>
        <span className="text-sm font-medium text-ink">{label}</span>
        {optional && <span className="text-xs text-ink-muted">(необязательно)</span>}
      </div>
      {!done && (
        <button
          onClick={() => { onDismiss(); router.push(href) }}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
        >
          Настроить →
        </button>
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function WandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
      <path d="M17.8 11.8 19 13" /><path d="M15 9h.01" /><path d="M17.8 6.2 19 5" />
      <path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
    </svg>
  )
}
