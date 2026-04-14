'use client'

import { useEffect, useRef, useState } from 'react'
import { getTelegramUser } from '@/lib/telegram/webapp'
import { normalizeInviteCode } from '@/lib/inviteCodes'
import { refreshTelegramSession, resolveAuthDestination } from '@/lib/auth/clientAuth'

type ViewMode = 'actions' | 'employee' | 'application' | 'application-success'

export default function NotConnectedPage() {
  const [telegramName, setTelegramName] = useState('')
  const [mode, setMode] = useState<ViewMode>('actions')

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [autoJoining, setAutoJoining] = useState(false)

  const [applicationForm, setApplicationForm] = useState({
    applicant_name: '',
    restaurant_name: '',
    phone: '',
  })
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [submittingApplication, setSubmittingApplication] = useState(false)

  const didAutoJoin = useRef(false)

  useEffect(() => {
    const tgUser = getTelegramUser()
    if (tgUser) {
      setTelegramName(tgUser.first_name)
      setApplicationForm((prev) => ({
        ...prev,
        applicant_name: prev.applicant_name || tgUser.first_name,
      }))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any).Telegram?.WebApp
    const startParam: string | undefined = tg?.initDataUnsafe?.start_param
    const normalizedStartParam = startParam ? normalizeInviteCode(startParam) : ''

    if (normalizedStartParam.length === 8 && !didAutoJoin.current) {
      didAutoJoin.current = true
      setCode(normalizedStartParam)
      setMode('employee')
      setAutoJoining(true)
      void submitJoin(normalizedStartParam)
    }
  }, [])

  async function submitJoin(inviteCode: string) {
    const normalizedCode = normalizeInviteCode(inviteCode)
    if (normalizedCode.length !== 8) {
      setJoinError('Введите 8-значный код сотрудника')
      return
    }

    setJoining(true)
    setJoinError(null)

    try {
      const res = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || json?.error) {
        setJoinError(json?.error?.message ?? 'Неверный код. Проверьте и попробуйте снова.')
        setAutoJoining(false)
        return
      }

      const auth = await refreshTelegramSession()
      window.location.replace(resolveAuthDestination(auth))
    } catch {
      setJoinError('Ошибка соединения. Попробуйте снова.')
      setAutoJoining(false)
    } finally {
      setJoining(false)
    }
  }

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault()
    setApplicationError(null)

    const payload = {
      applicant_name: applicationForm.applicant_name.trim(),
      restaurant_name: applicationForm.restaurant_name.trim(),
      phone: applicationForm.phone.trim(),
    }

    if (!payload.applicant_name || !payload.restaurant_name || !payload.phone) {
      setApplicationError('Заполните все поля заявки')
      return
    }

    setSubmittingApplication(true)
    try {
      const res = await fetch('/api/owner-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || json?.error) {
        setApplicationError(json?.error?.message ?? 'Не удалось отправить заявку')
        return
      }

      setMode('application-success')
    } catch {
      setApplicationError('Ошибка соединения. Попробуйте снова.')
    } finally {
      setSubmittingApplication(false)
    }
  }

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submitJoin(code)
  }

  if (autoJoining && !joinError) {
    return (
      <div className="w-full max-w-sm mx-auto text-center animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto mb-6">
          <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a8458" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink mb-2">Подключаемся…</h1>
        <p className="text-sm text-ink-secondary">Проверяем код сотрудника и обновляем доступы</p>
      </div>
    )
  }

  if (mode === 'application-success') {
    return (
      <div className="w-full max-w-sm mx-auto text-center animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1a8458" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink mb-2">Заявка отправлена</h1>
        <p className="text-sm text-ink-secondary leading-relaxed mb-6">
          Спасибо за заявку, наши менеджеры свяжутся с вами и подключат заведение.
        </p>
        <button
          onClick={() => setMode('actions')}
          className="w-full h-12 rounded-2xl border border-surface-border text-ink-secondary font-semibold text-sm hover:bg-surface-muted transition-colors"
        >
          Вернуться назад
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      </div>

      <h1 className="text-xl font-bold text-ink mb-2 text-center">
        {telegramName ? `${telegramName}, выберите сценарий` : 'Доступ ещё не подключён'}
      </h1>
      <p className="text-sm text-ink-secondary leading-relaxed mb-6 text-center">
        Если вы сотрудник заведения, введите код роли. Если хотите подключить своё заведение, отправьте заявку владельца.
      </p>

      {mode === 'actions' && (
        <div className="space-y-3 mb-6">
          <ActionCard
            title="Я сотрудник"
            description="У меня есть 8-значный код роли от владельца или менеджера"
            onClick={() => setMode('employee')}
          />
          <ActionCard
            title="Подать заявку на регистрацию"
            description="Хочу подключить своё заведение и получить доступ владельца"
            onClick={() => setMode('application')}
          />
          <RetryButton />
        </div>
      )}

      {mode === 'employee' && (
        <div className="space-y-4">
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(normalizeInviteCode(e.target.value))
                if (joinError) setJoinError(null)
              }}
              placeholder="12345678"
              maxLength={8}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={[
                'w-full h-14 rounded-2xl border bg-surface',
                'text-center text-2xl font-bold tracking-[0.3em] text-ink',
                'placeholder:text-ink-muted placeholder:text-lg placeholder:font-normal placeholder:tracking-normal',
                'px-4 outline-none transition-colors',
                joinError ? 'border-red-400 focus:border-red-500' : 'border-surface-border focus:border-brand-500',
              ].join(' ')}
            />
            {joinError && <p className="text-sm text-red-500 text-center -mt-1">{joinError}</p>}
            <button
              type="submit"
              disabled={joining || code.length !== 8}
              className="w-full h-12 rounded-2xl bg-brand-600 text-white font-semibold text-base disabled:opacity-50 active:scale-95 transition-all"
            >
              {joining ? 'Подключаемся...' : 'Войти по коду'}
            </button>
          </form>

          <button
            onClick={() => {
              setMode('actions')
              setJoinError(null)
            }}
            className="w-full h-12 rounded-2xl border border-surface-border text-ink-secondary font-semibold text-sm hover:bg-surface-muted transition-colors"
          >
            Назад
          </button>
        </div>
      )}

      {mode === 'application' && (
        <form onSubmit={submitApplication} className="space-y-3">
          <TextInput
            label="Ваше имя"
            value={applicationForm.applicant_name}
            onChange={(value) => setApplicationForm((prev) => ({ ...prev, applicant_name: value }))}
            placeholder="ФИО или имя"
          />
          <TextInput
            label="Название заведения"
            value={applicationForm.restaurant_name}
            onChange={(value) => setApplicationForm((prev) => ({ ...prev, restaurant_name: value }))}
            placeholder="Например, Osh Markaz"
          />
          <TextInput
            label="Контактный номер"
            value={applicationForm.phone}
            onChange={(value) => setApplicationForm((prev) => ({ ...prev, phone: value }))}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
          />
          {applicationError && <p className="text-sm text-red-500">{applicationError}</p>}
          <button
            type="submit"
            disabled={submittingApplication}
            className="w-full h-12 rounded-2xl bg-brand-600 text-white font-semibold text-base disabled:opacity-50 active:scale-95 transition-all"
          >
            {submittingApplication ? 'Отправляем...' : 'Отправить заявку'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('actions')
              setApplicationError(null)
            }}
            className="w-full h-12 rounded-2xl border border-surface-border text-ink-secondary font-semibold text-sm hover:bg-surface-muted transition-colors"
          >
            Назад
          </button>
        </form>
      )}
    </div>
  )
}

function ActionCard({
  title,
  description,
  onClick,
}: {
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-3xl border border-surface-border bg-surface px-4 py-4 text-left transition-colors hover:bg-surface-muted"
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-secondary leading-relaxed">{description}</p>
    </button>
  )
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full h-12 rounded-2xl border border-surface-border bg-surface px-4 text-sm text-ink outline-none transition-colors focus:border-brand-500"
      />
    </label>
  )
}

function RetryButton() {
  const [loading, setLoading] = useState(false)

  async function handleRetry() {
    setLoading(true)
    try {
      const auth = await refreshTelegramSession()
      window.location.replace(resolveAuthDestination(auth))
    } catch {
      window.location.replace('/')
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="w-full h-12 rounded-2xl border border-surface-border text-ink-secondary font-semibold text-sm hover:bg-surface-muted transition-colors disabled:opacity-60"
    >
      {loading ? 'Проверяем...' : 'Проверить снова'}
    </button>
  )
}
