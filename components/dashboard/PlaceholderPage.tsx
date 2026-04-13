import Link from 'next/link'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface PlaceholderPageProps {
  title: string
  description: string
  bullets?: string[]
  ctaHref?: string
  ctaLabel?: string
}

export default function PlaceholderPage({
  title,
  description,
  bullets = [],
  ctaHref = '/dashboard',
  ctaLabel = 'Вернуться к разделу',
}: PlaceholderPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">{description}</p>
      </div>

      <Card className="border-dashed">
        <div className="grid gap-5 md:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Статус
            </h2>
            <p className="mt-2 text-base font-semibold text-ink">
              Каркас страницы готов. Здесь удобно продолжать бизнес-логику из `WEB_DASHBOARD_SPEC.md`.
            </p>
            {bullets.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Следующий шаг</p>
            <p className="mt-2 text-sm text-ink-secondary">
              Подключить реальные API-вызовы, фильтры и таблицы данных в следующих фазах dashboard.
            </p>
            <Link href={ctaHref} className="mt-4 inline-flex">
              <Button variant="secondary" size="sm">{ctaLabel}</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
