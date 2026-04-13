# BirLiy Kassa — Web Dashboard
## Техническое задание для разработки

**Версия:** 2.0  
**Статус:** Готово к разработке  
**Архитектор:** Claude  
**Аудитория:** Codex (разработчик)

---

## 1. Назначение документа

Этот документ — исчерпывающая инструкция для реализации web-панели управления BirLiy Kassa. Разработчик должен быть способен реализовать весь функционал, опираясь только на этот документ, без дополнительных уточнений.

**Что входит в scope:**
- Маршруты `/dashboard/admin/*` и `/dashboard/owner/*`
- Telegram Login Widget авторизация для браузера
- Новые компоненты (`components/dashboard/`)
- 2 новых API-роута
- Изменения в `middleware.ts` и `app/api/auth/route.ts`

**Что НЕ входит в scope:**
- Telegram Mini App (`/waiter`, `/kitchen`, `/owner`, `/admin`) — не трогать
- Мобильное приложение или PWA
- Email/password аутентификация
- WebSocket / Supabase Realtime

---

## 2. Обзор решения

### Где строится

Новая route group `(dashboard)` внутри существующего Next.js 15 проекта:

```
app/
├── (gateway)/          ← Telegram Mini App: entry/auth/blocked — НЕ ТРОГАТЬ
├── waiter/             ← НЕ ТРОГАТЬ
├── kitchen/            ← НЕ ТРОГАТЬ
├── owner/              ← НЕ ТРОГАТЬ
├── admin/              ← НЕ ТРОГАТЬ
└── (dashboard)/        ← СОЗДАТЬ — вся новая функциональность здесь
```

### Что переиспользуется vs создаётся

| Категория | Переиспользуется | Создаётся |
|---|---|---|
| API-роуты | Все 24 существующих без изменений | 2 новых (`/api/analytics/extended`, `/api/admin/stats/timeline`) |
| UI-компоненты | `Button`, `FormField`, `Toast`, `Badge`, `Card`, `ConfirmSheet` | 12 новых в `components/dashboard/` |
| Утилиты | `formatUZS`, `formatDate`, `formatTime`, `pluralRu`, `cn` из `lib/utils.ts` | — |
| Типы | Все из `lib/types.ts` | 2 новых interface для новых API |
| Auth логика | `upsertUserAndRespond()`, `signSession()`, `getUserContext()` | `validateTelegramWidgetData()` |
| Middleware | Существующий файл расширяется | Dashboard-блок (15 строк) |

---

## 3. Аутентификация

### 3.1 Метод: Telegram Login Widget

Пользователь заходит на `/dashboard/login` в обычном браузере. На странице отображается официальная кнопка Telegram Login Widget. После нажатия Telegram открывает диалог подтверждения и передаёт данные пользователя в callback-функцию.

### 3.2 Отличие алгоритма от Mini App

| Параметр | Mini App (`initData`) | Login Widget |
|---|---|---|
| Формат входных данных | URL-encoded строка | JSON-объект |
| Секретный ключ | `HMAC-SHA256("WebAppData", botToken)` | `SHA256(botToken)` |
| Поле с подписью | `hash` | `hash` |
| Freshness | 3600 секунд | 86400 секунд |
| Данные пользователя | внутри поля `user` (JSON) | верхний уровень объекта |

### 3.3 Новая функция `validateTelegramWidgetData`

Добавить в файл `lib/telegram/validate.ts` (рядом с существующей `validateTelegramInitData`):

```typescript
export interface TelegramWidgetData {
  id:         number
  first_name: string
  last_name?: string
  username?:  string
  photo_url?: string
  auth_date:  number
  hash:       string
}

/**
 * Validates data from Telegram Login Widget.
 * Algorithm differs from Mini App initData validation:
 *  - Secret key = SHA256(botToken), NOT HMAC("WebAppData", botToken)
 *  - auth_date freshness = 86400s (not 3600s)
 *  - Input is a plain object, not URLSearchParams
 */
export function validateTelegramWidgetData(
  data: Record<string, unknown>,
  botToken: string,
): { valid: boolean; data: TelegramWidgetData | null } {
  try {
    const hash = data.hash as string | undefined
    if (!hash || typeof hash !== 'string') return { valid: false, data: null }

    // Build data-check-string: sort keys alphabetically, exclude hash
    const dataCheckString = Object.keys(data)
      .filter((key) => key !== 'hash')
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n')

    // Secret key = SHA256(botToken) — different from Mini App!
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest()

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    if (computedHash !== hash) return { valid: false, data: null }

    // Check freshness: 86400s = 24 hours
    const authDate = Number(data.auth_date)
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds - authDate > 86400) return { valid: false, data: null }

    const parsed: TelegramWidgetData = {
      id:         Number(data.id),
      first_name: String(data.first_name),
      last_name:  data.last_name ? String(data.last_name) : undefined,
      username:   data.username  ? String(data.username)  : undefined,
      photo_url:  data.photo_url ? String(data.photo_url) : undefined,
      auth_date:  authDate,
      hash,
    }

    return { valid: true, data: parsed }
  } catch {
    return { valid: false, data: null }
  }
}
```

### 3.4 Изменения в `app/api/auth/route.ts`

Добавить import и новую ветку в `POST` handler (после dev-bypass блока, до `rawInitData` блока):

```typescript
// Добавить import вверху файла:
import { validateTelegramWidgetData, type TelegramWidgetData } from '@/lib/telegram/validate'

// Добавить константу:
const DASHBOARD_SESSION_TTL_SEC = 60 * 60 * 24 * 7  // 7 дней для браузерной сессии

// Добавить ветку в POST handler:
// ── Telegram Login Widget (dashboard web) ──────────────────────────────────
if (body.tg_widget) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json(err('CONFIG_ERROR', 'Server misconfigured'), { status: 500 })
  }

  const { valid, data: widgetData } = validateTelegramWidgetData(body.tg_widget, botToken)
  if (!valid || !widgetData) {
    return NextResponse.json(err('INVALID_WIDGET_DATA', 'Telegram Widget authentication failed'), { status: 401 })
  }

  const fullName = [widgetData.first_name, widgetData.last_name].filter(Boolean).join(' ').trim()
  const email    = `t_${widgetData.id}@birliy.app`

  // upsertUserAndRespond — та же функция, что и для Mini App
  // Передаём maxAge для 7-дневной сессии браузера
  return await upsertUserAndRespond(
    { telegramId: widgetData.id, fullName, username: widgetData.username, email },
    { maxAge: DASHBOARD_SESSION_TTL_SEC },
  )
}
```

Функция `upsertUserAndRespond` должна принять второй параметр:

```typescript
// Изменить сигнатуру функции:
async function upsertUserAndRespond(
  opts: { telegramId: number; fullName: string; username?: string; email: string },
  sessionOpts: { maxAge?: number } = {},
)

// Изменить строку установки cookie (найти response.cookies.set):
response.cookies.set(SESSION_COOKIE, sessionToken, getSessionCookieOptions({ maxAge: sessionOpts.maxAge }))
```

### 3.5 Страница `/dashboard/login`

Файл: `app/(dashboard)/login/page.tsx`

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Telegram Widget вызывает эту функцию после авторизации
    ;(window as any).onTelegramAuth = async (user: Record<string, unknown>) => {
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tg_widget: user }),
      }).then((r) => r.json())

      if (res.error) {
        alert(`Ошибка входа: ${res.error.message}`)
        return
      }

      // Редирект по роли
      const role = res.data?.role
      if (role === 'super_admin') router.replace('/dashboard/admin')
      else if (role === 'owner')  router.replace('/dashboard/owner')
      else                        router.replace('/dashboard/not-authorized')
    }

    // Вставить Telegram Widget script
    const script = document.createElement('script')
    script.src        = 'https://telegram.org/js/telegram-widget.js?22'
    script.async      = true
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? '')
    script.setAttribute('data-size',           'large')
    script.setAttribute('data-radius',         '12')
    script.setAttribute('data-onauth',         'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    document.getElementById('tg-widget-container')?.appendChild(script)

    return () => { delete (window as any).onTelegramAuth }
  }, [router])

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
      <div className="bg-surface rounded-3xl shadow-card-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-6">
          {/* Logo SVG — использовать тот же что в Mini App */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink mb-1">BirLiy Kassa</h1>
        <p className="text-sm text-ink-secondary mb-8">Панель управления</p>
        <div id="tg-widget-container" className="flex justify-center" />
        <p className="text-xs text-ink-muted mt-6">
          Доступ только для владельцев и администраторов
        </p>
      </div>
    </div>
  )
}
```

---

## 4. Изменения в `middleware.ts`

Добавить `/dashboard/login` и `/dashboard/not-authorized` в `PUBLIC_PATHS`:

```typescript
const PUBLIC_PATHS = ['/', '/not-connected', '/subscription-blocked', '/dashboard/login', '/dashboard/not-authorized']
```

Добавить следующий блок **после** блока `subscription gate` и **перед** блоком `isProtected` (примерно после строки `return NextResponse.next()`):

```typescript
// ── Dashboard web panel (browser, desktop) ─────────────────────────────────

if (pathname.startsWith('/dashboard')) {
  // Только owner и super_admin имеют доступ
  if (!['owner', 'super_admin'].includes(role)) {
    // waiter/kitchen → в свой Mini App, не на dashboard
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
  }
  // Dashboard не блокируется subscription gate —
  // owner должен видеть панель даже с истёкшей подпиской
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id',         userId)
  requestHeaders.set('x-user-role',        role)
  requestHeaders.set('x-shop-ids',         JSON.stringify(shopIds))
  requestHeaders.set('x-primary-shop-id',  primaryShopId ?? '')
  return NextResponse.next({ request: { headers: requestHeaders } })
}
```

> **Важно:** этот блок должен стоять **до** существующей проверки `const isProtected = PROTECTED_PREFIXES.some(...)`, иначе `/dashboard` не попадёт в него.

---

## 5. Переменные окружения

### Уже существуют (не добавлять):
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`

### Добавить:
```env
# Username бота без @ (нужен для Telegram Login Widget script tag)
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=birliy_kassa_bot
```

---

## 6. Структура файлов (полная)

```
app/(dashboard)/
├── layout.tsx                        ← СОЗДАТЬ: минимальный root layout
├── not-authorized/
│   └── page.tsx                      ← СОЗДАТЬ: "нет доступа"
├── login/
│   └── page.tsx                      ← СОЗДАТЬ: см. раздел 3.5
├── admin/
│   ├── layout.tsx                    ← СОЗДАТЬ: DashboardLayout с admin nav
│   ├── page.tsx                      ← СОЗДАТЬ: Platform Overview
│   ├── restaurants/
│   │   ├── page.tsx                  ← СОЗДАТЬ: список заведений
│   │   └── [id]/
│   │       └── page.tsx              ← СОЗДАТЬ: детали заведения
│   ├── users/
│   │   ├── page.tsx                  ← СОЗДАТЬ: список пользователей
│   │   └── [id]/
│   │       └── page.tsx              ← СОЗДАТЬ: профиль пользователя
│   └── subscriptions/
│       └── page.tsx                  ← СОЗДАТЬ: управление подписками
└── owner/
    ├── layout.tsx                    ← СОЗДАТЬ: DashboardLayout с owner nav
    ├── page.tsx                      ← СОЗДАТЬ: Analytics dashboard
    ├── orders/
    │   ├── page.tsx                  ← СОЗДАТЬ: список заказов
    │   └── [id]/
    │       └── page.tsx              ← СОЗДАТЬ: детали заказа
    ├── menu/
    │   └── page.tsx                  ← СОЗДАТЬ: управление меню
    ├── tables/
    │   └── page.tsx                  ← СОЗДАТЬ: управление столами
    ├── staff/
    │   └── page.tsx                  ← СОЗДАТЬ: персонал
    ├── bookings/
    │   └── page.tsx                  ← СОЗДАТЬ: бронирования
    └── settings/
        └── page.tsx                  ← СОЗДАТЬ: настройки заведения

app/api/
├── analytics/
│   ├── route.ts                      ← существующий, не трогать
│   └── extended/
│       └── route.ts                  ← СОЗДАТЬ: новый эндпоинт
└── admin/stats/
    ├── route.ts                      ← существующий, не трогать
    └── timeline/
        └── route.ts                  ← СОЗДАТЬ: новый эндпоинт

components/dashboard/
├── DashboardLayout.tsx               ← СОЗДАТЬ
├── Sidebar.tsx                       ← СОЗДАТЬ
├── TopBar.tsx                        ← СОЗДАТЬ
├── NavItem.tsx                       ← СОЗДАТЬ
├── UserMenu.tsx                      ← СОЗДАТЬ
├── ShopSwitcher.tsx                  ← СОЗДАТЬ
├── DashboardSessionContext.tsx       ← СОЗДАТЬ
├── DataTable.tsx                     ← СОЗДАТЬ
├── SearchInput.tsx                   ← СОЗДАТЬ
├── FilterChip.tsx                    ← СОЗДАТЬ
├── FilterBar.tsx                     ← СОЗДАТЬ
├── DateRangePicker.tsx               ← СОЗДАТЬ
├── ConfirmDialog.tsx                 ← СОЗДАТЬ (modal, не BottomSheet)
├── RevenueChart.tsx                  ← СОЗДАТЬ (recharts)
└── Skeleton.tsx                      ← СОЗДАТЬ (shimmer loading states)

lib/telegram/validate.ts              ← ИЗМЕНИТЬ: добавить validateTelegramWidgetData
app/api/auth/route.ts                 ← ИЗМЕНИТЬ: добавить tg_widget ветку
middleware.ts                         ← ИЗМЕНИТЬ: добавить dashboard блок
```

---

## 7. Компонентные спецификации

### 7.1 `DashboardLayout`

**Файл:** `components/dashboard/DashboardLayout.tsx`

```typescript
interface DashboardLayoutProps {
  children:   React.ReactNode
  navItems:   NavItemConfig[]    // конфигурация sidebar для роли
  title?:     string             // заголовок для TopBar (breadcrumb)
  shopName?:  string             // отображается в TopBar
}

interface NavItemConfig {
  href:   string
  label:  string
  icon:   React.ReactNode
  exact?: boolean  // точное совпадение пути для active state
}
```

**Layout структура:**

```
┌────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px, fixed, bg=#0f172a) │ MAIN AREA              │
│                                    │                        │
│ [logo + название]                  │ TOPBAR (h-14, bg=white,│
│                                    │  border-b)             │
│ nav items                          │ ─────────────────────  │
│                                    │                        │
│                                    │ CONTENT (p-6)          │
│ ─────────── (bottom)               │                        │
│ [user avatar] [имя]  [logout]      │                        │
└────────────────────────────────────────────────────────────┘

Mobile < 768px: sidebar = скрытый, показывается через hamburger
                (Button в TopBar → overlay drawer с z-50)
```

**Цвета Sidebar:**
- `bg-slate-900` (`#0f172a`)
- Nav link default: `text-slate-400 hover:text-white hover:bg-slate-800`
- Nav link active: `text-white bg-slate-700`
- Logo area: `text-white font-bold`

---

### 7.2 `DashboardSessionContext`

**Файл:** `components/dashboard/DashboardSessionContext.tsx`

Паттерн идентичен `app/owner/_context/OwnerSessionContext.tsx` с одним отличием — при отсутствии `primary_shop_id` НЕ делать `window.location.replace('/')`, а ставить `loading: false` и предоставлять пустые значения (super_admin может не иметь shop_id):

```typescript
interface DashboardSession {
  userId:        string | null
  role:          UserRole | null
  primaryShopId: string | null
  shopIds:       string[]
  loading:       boolean
}
```

`shopIds` нужен для ShopSwitcher у multi-shop owner.

Данные для `shopIds` получить из `GET /api/auth/status` — в текущем `AuthStatusPayload` их нет. Вместо этого использовать JWT: декодировать cookie на клиенте — **нет**. Правильнее: расширить `/api/auth/status` response, добавив `shop_ids: string[]` (прочитать из JWT claims которые уже в headers middleware).

**Изменить `app/api/auth/status/route.ts`** — добавить в ответ:
```typescript
shop_ids: (payload.shop_ids ?? []) as string[],
```

**Расширить `AuthStatusPayload` в `lib/types.ts`:**
```typescript
export interface AuthStatusPayload {
  user_id:         string
  role:            UserRole
  primary_shop_id: string | null
  shop_ids:        string[]       // ДОБАВИТЬ
  shop_name:       string | null
  expires_at:      string | null
  sub_status:      string | null
  needs_refresh:   boolean
}
```

---

### 7.3 `DataTable<T>`

**Файл:** `components/dashboard/DataTable.tsx`

```typescript
interface ColumnDef<T> {
  key:        string
  header:     string
  width?:     string           // CSS width, например '120px' или '20%'
  sortable?:  boolean
  render:     (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns:     ColumnDef<T>[]
  data:        T[]
  keyField:    keyof T          // поле для React key
  loading?:    boolean
  emptyText?:  string
  onRowClick?: (row: T) => void
  pageSize?:   number           // default 25
}
```

**Поведение:**
- Сортировка client-side: клик по заголовку колонки с `sortable: true` → ASC → DESC → сброс
- Пагинация: показывать `pageSize` строк, кнопки «Назад» / «Далее» / номера страниц
- `onRowClick` — при клике на строку если задан (cursor-pointer + hover bg)
- Loading: показывать `<Skeleton />` на 5 строк вместо данных
- Empty: центрированный текст `emptyText ?? 'Нет данных'`

**Стиль:**
- `overflow-hidden rounded-2xl border border-surface-border`
- Заголовок: `bg-surface-muted text-xs font-semibold uppercase tracking-wide text-ink-muted px-4 py-3`
- Строка: `bg-surface border-t border-surface-border px-4 py-3 text-sm text-ink`
- Hover строки: `hover:bg-surface-muted transition-colors`

---

### 7.4 `SearchInput`

```typescript
interface SearchInputProps {
  value:       string
  onChange:    (value: string) => void
  placeholder?: string
  className?:  string
}
```

- Debounce 300ms через `useEffect` + `setTimeout`
- Иконка лупы слева
- Кнопка × для очистки (показывается только когда value непустой)
- `rounded-xl border border-surface-border bg-surface-muted h-10 px-3`

---

### 7.5 `FilterChip`

```typescript
interface FilterChipProps {
  label:    string
  active:   boolean
  onClick:  () => void
  count?:   number   // опциональный бейдж с количеством
}
```

- Inactive: `bg-surface border border-surface-border text-ink-secondary`
- Active: `bg-brand-600 text-white border-brand-600`
- `rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer`

---

### 7.6 `DateRangePicker`

```typescript
interface DateRangePickerProps {
  from:      string   // YYYY-MM-DD
  to:        string   // YYYY-MM-DD
  onChange:  (from: string, to: string) => void
}
```

**Preset кнопки (рендерить как FilterChip):**
- «Сегодня» → today
- «7 дней» → last 7 days (default)
- «30 дней» → last 30 days
- «90 дней» → last 90 days
- «Период» → показывает два `<input type="date">` рядом

Определение активного preset — вычислять из `from`/`to` относительно текущей даты.

---

### 7.7 `ConfirmDialog`

**Файл:** `components/dashboard/ConfirmDialog.tsx`  
Аналог существующего `ConfirmSheet` но в виде modal overlay (не BottomSheet) — для desktop.

```typescript
interface ConfirmDialogProps {
  open:          boolean
  onClose:       () => void
  onConfirm:     () => void
  loading?:      boolean
  title:         string
  description?:  string
  confirmLabel?: string    // default 'Удалить'
  cancelLabel?:  string    // default 'Отмена'
  variant?:      'danger' | 'warning'  // default 'danger'
}
```

- Modal overlay: `fixed inset-0 bg-black/50 z-50 flex items-center justify-center`
- Dialog: `bg-surface rounded-3xl p-6 w-full max-w-sm shadow-card-lg`
- Закрыть по клику на overlay и по Escape

---

### 7.8 `RevenueChart`

**Файл:** `components/dashboard/RevenueChart.tsx`  
**Зависимость:** `recharts` — установить: `npm install recharts`

```typescript
interface RevenueChartProps {
  data:    Array<{ date: string; revenue: number; orders: number }>
  height?: number  // default 300
}
```

- `<ResponsiveContainer width="100%" height={height}>`
- `<LineChart>` с двумя линиями: revenue (brand-600) и orders (info=#2563eb, вторая ось Y)
- Tooltip: форматировать revenue через `formatUZS`, orders — число
- X axis: `formatDate(date)` для меток
- Grid: `strokeDasharray="3 3"` с `stroke="#e4ebe7"` (surface-border)
- Legend внизу

---

### 7.9 `Skeleton`

**Файл:** `components/dashboard/Skeleton.tsx`

```typescript
// Экспортировать несколько вариантов:
export function SkeletonRow()        // высота 48px, полная ширина
export function SkeletonCard()       // высота 120px, rounded-2xl
export function SkeletonText({ w })  // текстовая строка, w = ширина в %
export function SkeletonStat()       // StatCard skeleton
```

Базовый класс: `animate-pulse bg-surface-muted rounded-xl`

---

## 8. API-контракты новых эндпоинтов

### 8.1 `GET /api/analytics/extended`

**Файл:** `app/api/analytics/extended/route.ts`

**Query params:**
| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `shop_id` | string (UUID) | да | ID заведения |
| `from` | string (YYYY-MM-DD) | да | начало периода |
| `to` | string (YYYY-MM-DD) | да | конец периода |

**Auth guard:** `requireShopAccess(shopId)` — как в существующем `/api/analytics`

**Response shape:**

```typescript
interface ExtendedAnalyticsResponse {
  period: {
    revenue:    number  // сумма total_amount всех paid заказов за период
    orders:     number  // количество paid заказов
    avg_order:  number  // revenue / orders, 0 если нет заказов
  }
  by_day: Array<{
    date:    string   // YYYY-MM-DD в часовом поясе Ташкента (UTC+5)
    revenue: number
    orders:  number
  }>
  by_waiter: Array<{
    waiter_id:   string
    waiter_name: string
    orders:      number
    revenue:     number
  }>
  top_items: Array<{
    item_id:  string
    name:     string
    quantity: number   // сумма order_items.quantity за период
    revenue:  number   // сумма quantity * unit_price за период
  }>  // сортировать по revenue DESC, limit 10
}
```

**Логика top_items:**
```sql
SELECT
  oi.menu_item_id AS item_id,
  mi.name,
  SUM(oi.quantity)               AS quantity,
  SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE
  o.shop_id = $shopId
  AND o.status = 'paid'
  AND o.updated_at >= $from (UTC)
  AND o.updated_at <= $to (UTC)
GROUP BY oi.menu_item_id, mi.name
ORDER BY revenue DESC
LIMIT 10
```

**Конвертация дат:** `from` и `to` приходят как YYYY-MM-DD в ташкентском времени. Конвертировать в UTC:
```typescript
const fromUTC = new Date(`${from}T00:00:00+05:00`).toISOString()
const toUTC   = new Date(`${to}T23:59:59+05:00`).toISOString()
```

---

### 8.2 `GET /api/admin/stats/timeline`

**Файл:** `app/api/admin/stats/timeline/route.ts`

**Query params:**
| Параметр | Тип | Обязательный | По умолчанию |
|---|---|---|---|
| `days` | number | нет | 30 |

**Auth guard:** `requireSuperAdmin()`

**Response shape:**

```typescript
interface StatsTimelineResponse {
  // Количество новых подписок по датам с разбивкой по плану
  subscriptions_by_day: Array<{
    date:  string   // YYYY-MM-DD
    plan:  SubPlan  // 'trial' | 'starter' | 'pro'
    count: number
  }>
  // Агрегированные итоги
  totals: {
    active:    number
    trial:     number
    expired:   number
    suspended: number
    total:     number
  }
}
```

**Логика:** выбрать из `subscriptions` записи где `created_at >= NOW() - interval 'N days'`, сгруппировать по дате (UTC+5) и плану.

---

## 9. Layouts для dashboard

### `app/(dashboard)/layout.tsx`

```typescript
// Минимальный root layout — НЕ включает TelegramBootstrap
// Toaster уже есть в app/layout.tsx — не дублировать
export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

### `app/(dashboard)/admin/layout.tsx`

```typescript
'use client'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { DashboardSessionProvider } from '@/components/dashboard/DashboardSessionContext'

const ADMIN_NAV = [
  { href: '/dashboard/admin',               label: 'Обзор',        icon: <OverviewIcon />,      exact: true },
  { href: '/dashboard/admin/restaurants',   label: 'Заведения',    icon: <RestaurantIcon /> },
  { href: '/dashboard/admin/users',         label: 'Пользователи', icon: <UsersIcon /> },
  { href: '/dashboard/admin/subscriptions', label: 'Подписки',     icon: <SubIcon /> },
]

export default function AdminDashboardLayout({ children }) {
  return (
    <DashboardSessionProvider>
      <DashboardLayout navItems={ADMIN_NAV}>{children}</DashboardLayout>
    </DashboardSessionProvider>
  )
}
```

### `app/(dashboard)/owner/layout.tsx`

```typescript
'use client'
const OWNER_NAV = [
  { href: '/dashboard/owner',          label: 'Аналитика',   icon: <ChartIcon />, exact: true },
  { href: '/dashboard/owner/orders',   label: 'Заказы',      icon: <OrderIcon /> },
  { href: '/dashboard/owner/menu',     label: 'Меню',        icon: <MenuIcon /> },
  { href: '/dashboard/owner/tables',   label: 'Столы',       icon: <TableIcon /> },
  { href: '/dashboard/owner/staff',    label: 'Персонал',    icon: <StaffIcon /> },
  { href: '/dashboard/owner/bookings', label: 'Брони',       icon: <BookingIcon /> },
  { href: '/dashboard/owner/settings', label: 'Настройки',   icon: <SettingsIcon /> },
]
```

---

## 10. Спецификации страниц

### 10.1 `/dashboard/owner` — Аналитика

**Данные:** `GET /api/analytics/extended?shop_id={id}&from={from}&to={to}`  
**Состояния:** loading (SkeletonStat × 4 + SkeletonCard), empty (нет заказов за период), error (retry кнопка)

**Блоки страницы сверху вниз:**

**A. Period Selector**
```
[Сегодня] [7 дней★] [30 дней] [90 дней] [Период ▾]
```
По умолчанию: «7 дней». Состояние хранится в `useState`, при смене — перефетч.

**B. KPI Cards (4 штуки в ряд)**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Выручка     │ │  Заказов     │ │  Средний чек │ │  Активных    │
│  1 250 000 с │ │  47          │ │  26 596 с    │ │  3           │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```
Использовать `StatCard` из `components/ui/Card.tsx`.  
«Активных» = `open_orders` (из `/api/analytics`, не из extended, т.к. это real-time).

**C. RevenueChart**
```
Выручка за период — LineChart, height=280
```

**D. Топ блюд (Top 10)**
```
Таблица: ранг | название | порций | выручка
```

**E. По официантам**
```
Таблица: официант | заказов | выручка | средний чек
```

---

### 10.2 `/dashboard/owner/orders` — Заказы

**Данные:** `GET /api/orders?shop_id={id}&status={}&date={}`

**FilterBar:**
- Статус: `Все` / `Активные` (`open,in_kitchen,ready`) / `Оплачено` (`paid`) / `Отменено` (`cancelled`)
- Дата: `DateRangePicker`
- Поиск: `SearchInput` по номеру заказа (последние 6 символов id)

**DataTable колонки:**

| key | header | width | render |
|---|---|---|---|
| `id` | `#` | 80px | последние 6 символов, monospace |
| `table` | `Стол` | 100px | `order.table?.name` |
| `waiter` | `Официант` | 150px | `order.waiter?.name` |
| `total_amount` | `Сумма` | 130px | `formatUZS(row.total_amount)` |
| `status` | `Статус` | 120px | `<OrderStatusBadge status={row.status} />` |
| `items_count` | `Позиций` | 90px | `row.items?.length ?? 0` |
| `created_at` | `Создан` | 130px | `formatDate + formatTime` |

**onRowClick:** `router.push('/dashboard/owner/orders/' + row.id)`

---

### 10.3 `/dashboard/owner/orders/[id]` — Детали заказа

**Данные:** `GET /api/orders/{id}`

**Секции:**
1. **Шапка**: `#XXXXXX` · Badge статуса · время создания · кнопка «Назад»
2. **Метаданные**: Стол, Официант, Способ оплаты (если paid), Заметки
3. **Позиции**: таблица (название, кол-во, цена ед., сумма, статус позиции)
4. **Итого**: сумма жирным

---

### 10.4 `/dashboard/owner/menu` — Меню

**Данные:**
- `GET /api/categories?shop_id={id}`
- `GET /api/menu?shop_id={id}`

**Layout (двухпанельный на desktop, вкладки на mobile):**

```
┌────────────────────┬──────────────────────────────────────┐
│ КАТЕГОРИИ          │ ПОЗИЦИИ                              │
│                    │                                      │
│ Все (28)           │ [SearchInput] [+ Добавить позицию]   │
│ ──────────         │                                      │
│ Закуски (8)    [✎] │ DataTable позиций                    │
│ Горячее (12)   [✎] │                                      │
│ Напитки (5)    [✎] │                                      │
│ [+ Категория]      │                                      │
└────────────────────┴──────────────────────────────────────┘
```

**DataTable позиций колонки:**

| key | header | render |
|---|---|---|
| `name` | `Название` | text |
| `category` | `Категория` | `item.category?.name` |
| `price` | `Цена` | `formatUZS(item.price)` |
| `is_available` | `Доступно` | `<toggle switch>` → `PATCH /api/menu/{id}` с `{ is_available: !current }` |
| `actions` | `` | кнопки Редактировать / Удалить |

**Удалить позицию:** `DELETE /api/menu/{id}` после подтверждения в `ConfirmDialog`  
**Удалить категорию:** `DELETE /api/categories/{id}` — предупредить что позиции останутся без категории  
**Создать/редактировать позицию:** sliding panel (drawer) справа с FormField полями:
- Название (required), Категория (select), Цена (number, required), Доступно (checkbox)

---

### 10.5 `/dashboard/owner/tables` — Столы

**Данные:** `GET /api/tables?shop_id={id}`

**Grid карточек:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Стол 1     │ │   Стол 2     │ │   Стол 3     │
│   Веранда    │ │   Основной   │ │   Бар        │
│   4 места    │ │   6 мест     │ │   2 места    │
│  [свободен]  │ │   [занят]    │ │  [счёт]      │
└──────────────┘ └──────────────┘ └──────────────┘
```

Цвет статуса:
- `free` → зелёный бордер + бейдж
- `occupied` → янтарный
- `reserved` → синий
- `bill_requested` → красный

Действия на карточке: «✎» → редактировать, «🗑» → удалить (только если статус `free`)  
Кнопка «+ Добавить стол» → форма: название, номер, вместимость → `POST /api/tables`

---

### 10.6 `/dashboard/owner/staff` — Персонал

**Данные:** `GET /api/staff?shop_id={id}` → `ShopUser[]`

**Layout:** список с группировкой по ролям (`owner`, `kitchen`, `waiter`)

Для каждого сотрудника:
- Аватар-инициалы (первая буква имени)
- Имя + `@username` если есть
- Role badge
- Кнопка «Удалить» → `DELETE /api/staff?shop_id={id}&user_id={uid}` + `ConfirmDialog`

**Добавить сотрудника:**
1. Input поиска → `GET /api/admin/users?search={q}` (super_admin может видеть всех, owner — нет)
2. Для owner: использовать поле поиска только как UI, добавление — через `POST /api/admin/shops/{id}/members` с `{ user_id, role }`

---

### 10.7 `/dashboard/owner/bookings` — Бронирования

**Данные:** `GET /api/bookings?shop_id={id}`

**FilterBar:** статус + дата

**DataTable колонки:** гость, телефон, стол, дата, время, статус, действия

**Создать:** форма — гость, телефон, стол (select), дата+время, кол-во гостей, заметки → `POST /api/bookings`

**Изменить статус:** `PATCH /api/bookings/{id}` с `{ status: '...' }`

---

### 10.8 `/dashboard/owner/settings` — Настройки заведения

**Данные:** `GET /api/admin/shops/{primaryShopId}`

**Форма (FormField):**
- Название заведения
- Адрес
- Телефон

**Сохранить:** `PATCH /api/admin/shops/{id}` с изменёнными полями

---

### 10.9 `/dashboard/admin` — Обзор платформы

**Данные:**
- `GET /api/admin/stats` — существующий
- `GET /api/admin/stats/timeline?days=30` — новый

**Блоки:**

**A. KPI Cards (6 штук)**
```
Заведений | Активных подписок | Trial | Истёкших | Пользователей | Заказов сегодня
```

**B. Chart: Новые подписки по неделям**
`BarChart` — recharts, данные из `/api/admin/stats/timeline`

**C. Quicklist: Истекающие в ближайшие 7 дней**
Из `/api/admin/stats` — если есть `expiring_soon`, иначе сделать отдельный запрос к `/api/admin/subscriptions` с фильтром.

---

### 10.10 `/dashboard/admin/restaurants` — Заведения

**Данные:** `GET /api/admin/shops`

**DataTable колонки:**

| key | header | sortable |
|---|---|---|
| `name` | Название | да |
| `owner` | Владелец | нет |
| `plan` | Тариф | да |
| `sub_status` | Подписка | да |
| `days_left` | Дней | да |
| `members_count` | Сотрудников | нет |
| `created_at` | Создано | да |
| `actions` | — | нет |

`days_left` вычислять: `Math.max(0, Math.ceil((new Date(expires_at) - Date.now()) / 86400000))`

**FilterChip по статусу:** `trial / active / expired / suspended`

**Создать заведение:** modal с FormField (название, адрес, телефон) → `POST /api/admin/shops`

**onRowClick:** `router.push('/dashboard/admin/restaurants/' + row.id)`

---

### 10.11 `/dashboard/admin/restaurants/[id]` — Детали заведения

**Данные:** `GET /api/admin/shops/{id}`

**Секции:**

**A. Информация** — название, адрес, телефон (inline edit через `PATCH /api/admin/shops/{id}`)

**B. Подписка**
```
Статус: [active Badge]    План: [pro Badge]    Истекает: 2026-12-31
[ +30 дней ] [ +365 дней ]   [ Изменить ]
```
Изменить → форма: статус, план, дата → `PATCH /api/admin/subscriptions/{shopId}`

**C. Персонал**
- Список из `/api/admin/shops/{id}` (возвращает members)
- Добавить: `POST /api/admin/shops/{id}/members` с `{ user_id, role }`
- Удалить: `DELETE /api/admin/shops/{id}/members?user_id={uid}`

---

### 10.12 `/dashboard/admin/users` — Пользователи

**Данные:** `GET /api/admin/users?role={}&search={}`

**SearchInput** с debounce → `?search=...`  
**FilterChip** по ролям: `Все / super_admin / owner / waiter / kitchen`

**DataTable колонки:**

| key | header | render |
|---|---|---|
| `name` | Имя | `name` + серым `@username` |
| `telegram_id` | Telegram ID | monospace `text-xs` |
| `role` | Роль | Badge по роли |
| `shops` | Заведения | имена через запятую |
| `created_at` | Зарегистрирован | `formatDate` |
| `actions` | — | кнопка «Открыть» |

**onRowClick:** `router.push('/dashboard/admin/users/' + row.id)`

---

### 10.13 `/dashboard/admin/users/[id]` — Профиль пользователя

**Данные:** `GET /api/admin/users/{id}`

**Секции:**

**A. Профиль** — имя, username, telegram_id, роль (Badge), дата регистрации

**B. Изменить роль**
```
Платформенная роль: [select: super_admin | owner | waiter | kitchen]
Заведение:          [select из /api/admin/shops]
Роль в заведении:   [select: owner | waiter | kitchen]
[ Сохранить ]
```
→ `PATCH /api/admin/users/{id}` с `{ role, shop_id, shop_role }`

**C. Членство в заведениях**
Список заведений пользователя с ролями.

---

### 10.14 `/dashboard/admin/subscriptions` — Подписки

**Данные:** `GET /api/admin/shops` (содержит subscription в join)

**FilterChip:** `trial / active / expired / suspended`

**DataTable колонки:**

| key | header | render |
|---|---|---|
| `shop_name` | Заведение | text |
| `plan` | Тариф | Badge |
| `status` | Статус | Badge |
| `expires_at` | Истекает | дата + красный если < 7 дней |
| `days_left` | Дней | число |
| `actions` | — | `+30д` / `+365д` / `✎` |

**Inline actions:**
- «+30 дней» → `PATCH /api/admin/subscriptions/{shopId}` с `{ expires_at: addDays(current, 30) }`
- «+365 дней» → то же с 365
- «✎» → форма в modal: статус, план, произвольная дата

---

## 11. Фазы реализации

### Фаза 1 — Фундамент (3-4 дня)

**Задачи:**
1. Установить зависимость: `npm install recharts`
2. Добавить `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` в `.env.local`
3. Добавить `validateTelegramWidgetData` в `lib/telegram/validate.ts`
4. Изменить `app/api/auth/route.ts` — добавить tg_widget ветку + dashboard TTL
5. Изменить `middleware.ts` — добавить dashboard блок
6. Добавить `shop_ids` в `AuthStatusPayload` и `/api/auth/status`
7. Создать `components/dashboard/DashboardSessionContext.tsx`
8. Создать `components/dashboard/NavItem.tsx`
9. Создать `components/dashboard/Sidebar.tsx`
10. Создать `components/dashboard/TopBar.tsx`
11. Создать `components/dashboard/DashboardLayout.tsx`
12. Создать `app/(dashboard)/layout.tsx`
13. Создать `app/(dashboard)/login/page.tsx`
14. Создать `app/(dashboard)/not-authorized/page.tsx`
15. Создать `app/(dashboard)/admin/layout.tsx` с placeholder страницами
16. Создать `app/(dashboard)/owner/layout.tsx` с placeholder страницами

**Критерий завершения:**
- Открыть `https://localhost:3000/dashboard/login` в браузере
- Нажать Telegram Login Widget кнопку
- После входа — redirect на `/dashboard/admin` или `/dashboard/owner` в зависимости от роли
- Sidebar отображается с навигацией, переходы между placeholder страницами работают

---

### Фаза 2 — Owner: Аналитика + Заказы (3-4 дня)

**Задачи:**
1. Создать `app/api/analytics/extended/route.ts`
2. Создать `components/dashboard/DateRangePicker.tsx`
3. Создать `components/dashboard/RevenueChart.tsx`
4. Создать `components/dashboard/Skeleton.tsx`
5. Создать `components/dashboard/DataTable.tsx`
6. Создать `components/dashboard/SearchInput.tsx`
7. Создать `components/dashboard/FilterChip.tsx` + `FilterBar.tsx`
8. Создать `app/(dashboard)/owner/page.tsx` — полная аналитика
9. Создать `app/(dashboard)/owner/orders/page.tsx` — DataTable
10. Создать `app/(dashboard)/owner/orders/[id]/page.tsx` — детали

**Критерий завершения:**
- Owner видит реальную выручку за последние 7 дней
- График отрисовывается
- Список заказов фильтруется по статусу и дате
- Клик на заказ открывает детали

---

### Фаза 3 — Owner: Операции (3-4 дня)

**Задачи:**
1. Создать `components/dashboard/ConfirmDialog.tsx`
2. Создать `app/(dashboard)/owner/menu/page.tsx`
3. Создать `app/(dashboard)/owner/tables/page.tsx`
4. Создать `app/(dashboard)/owner/staff/page.tsx`
5. Создать `app/(dashboard)/owner/bookings/page.tsx`
6. Создать `app/(dashboard)/owner/settings/page.tsx`

**Критерий завершения:**
- Owner может переключить `is_available` у позиции меню — изменение сохраняется
- Owner может добавить стол, стол появляется в списке
- Owner может удалить сотрудника с подтверждением
- Форма настроек сохраняет название заведения

---

### Фаза 4 — Super Admin Dashboard (3-4 дня)

**Задачи:**
1. Создать `app/api/admin/stats/timeline/route.ts`
2. Создать `app/(dashboard)/admin/page.tsx`
3. Создать `app/(dashboard)/admin/restaurants/page.tsx`
4. Создать `app/(dashboard)/admin/restaurants/[id]/page.tsx`
5. Создать `app/(dashboard)/admin/users/page.tsx`
6. Создать `app/(dashboard)/admin/users/[id]/page.tsx`
7. Создать `app/(dashboard)/admin/subscriptions/page.tsx`
8. Создать `components/dashboard/ShopSwitcher.tsx`
9. Создать `components/dashboard/UserMenu.tsx`

**Критерий завершения:**
- super_admin видит KPI платформы
- Список заведений фильтруется по статусу подписки
- Можно создать новое заведение через modal
- Можно продлить подписку (+30 дней) одной кнопкой
- Можно изменить роль пользователя

---

### Фаза 5 — Polish (1-2 дня)

**Задачи:**
1. Responsive: sidebar → hamburger-drawer на `< 768px`
2. Loading skeletons на всех страницах
3. Empty states с иллюстрациями
4. ShopSwitcher для multi-shop owner
5. Keyboard: `Escape` закрывает `ConfirmDialog`
6. `aria-label` для всех иконок-кнопок без текста

**Критерий завершения:**
- На экране 375px sidebar скрыт, есть hamburger кнопка
- При loading-state нет layout shift
- Все модалы закрываются по Escape

---

## 12. QA Чеклист

### Critical path

- [ ] Telegram Login Widget открывается и авторизует пользователя
- [ ] После входа owner → `/dashboard/owner`, super_admin → `/dashboard/admin`
- [ ] waiter/kitchen без доступа → редирект в свой Mini App
- [ ] /dashboard/* недоступен без cookie → редирект на /dashboard/login
- [ ] Analytics показывает реальные данные из БД
- [ ] Toggle is_available на позиции меню работает и сохраняется
- [ ] Создание заведения через super admin работает
- [ ] Продление подписки обновляет дату
- [ ] Удаление сотрудника требует подтверждения и выполняется

### Edge cases

- [ ] Owner с истёкшей подпиской видит dashboard (subscription gate не применяется)
- [ ] super_admin без shop_id в JWT видит admin dashboard (не редиректит на /not-connected)
- [ ] Owner с несколькими заведениями видит ShopSwitcher
- [ ] DataTable с 0 строками показывает Empty state
- [ ] DateRangePicker: from > to — не ломается, корректно обрабатывает
- [ ] При 401 от API → redirect на /dashboard/login

---

## Приложение: иконки для nav

Использовать inline SVG (как в существующих `app/admin/layout.tsx` и `app/owner/layout.tsx`). Все иконки 22×22, `stroke="currentColor" strokeWidth="2"`.

| Раздел | Иконка (Lucide/Heroicons название) |
|---|---|
| Обзор (admin) | LayoutGrid / grid-2x2 |
| Заведения | Home / building-2 |
| Пользователи | Users |
| Подписки | CreditCard |
| Аналитика (owner) | BarChart2 |
| Заказы | ClipboardList |
| Меню | UtensilsCrossed |
| Столы | Table2 |
| Персонал | Users2 |
| Бронирования | CalendarDays |
| Настройки | Settings |
