import Link from 'next/link'
import Button from '@/components/ui/Button'

export default function DashboardNotAuthorizedPage() {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center justify-center">
        <div className="w-full rounded-[28px] border border-surface-border bg-white p-8 text-center shadow-card-lg">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-600">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink">Доступ ограничен</h1>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            Web dashboard предназначен только для владельцев заведений и супер-администраторов. Если тебе нужен доступ, назначь роль через админку или открой свой рабочий mini app.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/dashboard/login">
              <Button variant="secondary">Войти под другим аккаунтом</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Вернуться на старт</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
