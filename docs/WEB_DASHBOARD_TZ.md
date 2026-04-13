> ⚠️ Этот черновик заменён финальным ТЗ: [WEB_DASHBOARD_SPEC.md](./WEB_DASHBOARD_SPEC.md)

# BirLiy Kassa — Web Dashboard
## Техническое задание (черновик)

**Версия:** 1.0  
**Дата:** 2026-04-13  
**Статус:** Утверждено к реализации

---

## 1. Цель и контекст

### 1.1 Проблема

Текущие интерфейсы `owner` и `admin` — это **Telegram Mini App** страницы, оптимизированные под мобильный экран 390px. Для полноценного управления рестораном (аналитика за периоды, работа с меню, управление персоналом, управление подписками) нужен **полноценный web-интерфейс**, доступный с десктопа через браузер.

### 1.2 Что строим

Отдельная route-group `(dashboard)` внутри **существующего** Next.js 15 проекта. Использует все существующие API-роуты без изменений. Добавляет несколько новых API-эндпоинтов для аналитики и периодических данных.

### 1.3 Что НЕ входит в scope

- Telegram Mini App страницы (`/waiter`, `/kitchen`, `/owner`, `/admin`) — не трогаем
- Публичное меню для гостей — отдельный продукт
- Мобильное приложение (PWA wrapper возможен позже)
- Realtime WebSocket — используем polling как и везде в проекте

---

## 2. Архитектурные решения

### 2.1 Расположение в проекте

```
app/
├── (gateway)/              ← Telegram Mini App: entry/auth/blocked screens
├── waiter/                 ← Mini App: официант (мобайл)
├── kitchen/                ← Mini App: кухня (мобайл)
├── owner/                  ← Mini App: владелец (мобайл)  
├── admin/                  ← Mini App: суперадмин (мобайл)
└── (dashboard)/            ← ← ← WEB PANEL (новое)
    ├── layout.tsx           ← root layout: нет TelegramBootstrap, своя auth
    ├── login/               ← страница входа через Telegram Widget
    ├── admin/               ← суперадмин (только role=super_admin)
    └── owner/               ← владелец (role=owner + super_admin)
```

**Обоснование:** единый деплой, общие типы, все 12 admin API-роутов и все owner API-роуты переиспользуются без единого изменения. Нет дублирования бизнес-логики.

### 2.2 Аутентификация для веба

**Метод: Telegram Login Widget**

Тот же Telegram-аккаунт, что и в Mini App. Минимальная дельта к существующему `/api/auth`:

```
Текущий /api/auth:
  body: { initData: string }  ← Telegram Mini App WebApp.initData (HMAC-подписанное)

Новый /api/auth (дополнение):
  body: { tg_widget: TelegramAuthData }  ← данные из Telegram Login Widget (другой формат, та же проверка HMAC)
```

Telegram Login Widget возвращает: `{ id, first_name, last_name?, username?, auth_date, hash }`. Проверка hash — тот же алгоритм HMAC-SHA256 с `TELEGRAM_BOT_TOKEN`. Логика upsert пользователя — идентична.

**Session cookie:** тот же `birliy-session` JWT. Middleware различает запросы к `/dashboard/*` от запросов к Mini App только по пути, не по отдельному cookie.

**Обоснование отказа от email/password:** все пользователи системы уже идентифицированы через Telegram. Добавление второй auth-системы создаёт риск рассинхронизации аккаунтов и дополнительную поверхность для атак.

### 2.3 Middleware: расширение

```typescript
// middleware.ts — добавить к существующим правилам:

const PUBLIC_PATHS = ['/', '/not-connected', '/subscription-blocked', '/dashboard/login']

// Dashboard routes требуют auth, но не subscription gate
// (super_admin всегда проходит, owner проверяется по JWT)
if (pathname.startsWith('/dashboard')) {
  if (!payload) return redirect('/dashboard/login')
  if (!['owner', 'super_admin'].includes(role)) {
    return redirect(ROLE_HOME[role])  // waiter/kitchen → в свой Mini App
  }
  // subscription gate для dashboard НЕ применяем
  // owner видит дашборд даже с истёкшей подпиской (чтобы продлить)
}
```

### 2.4 Layout модель

Desktop-first, sidebar + main content:

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────────────────────┐│
│ │          │ │  TOP BAR                                         ││
│ │ SIDEBAR  │ │  [breadcrumb]              [shop switcher] [user] ││
│ │ 240px    │ ├──────────────────────────────────────────────────┤│
│ │ fixed    │ │                                                  ││
│ │          │ │  MAIN CONTENT                                    ││
│ │ logo     │ │  (таблицы, формы, графики, карточки)             ││
│ │ nav      │ │                                                  ││
│ │ ──────── │ │                                                  ││
│ │ user     │ │                                                  ││
│ └──────────┘ └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘

Mobile (< 768px): sidebar → hamburger-drawer поверх контента
Tablet (768-1024px): sidebar collapsible (иконки без подписей)
Desktop (> 1024px): sidebar всегда раскрыт
```

---

## 3. Структура страниц

### 3.1 Super Admin (`/dashboard/admin`)

| Маршрут | Название | Основной контент |
|---|---|---|
| `/dashboard/admin` | Обзор платформы | KPI карточки, графики новых магазинов, статус подписок |
| `/dashboard/admin/restaurants` | Заведения | DataTable: название, план, статус, дней до окончания, действия |
| `/dashboard/admin/restaurants/[id]` | Заведение | Детали + управление подпиской + персонал + опасная зона |
| `/dashboard/admin/users` | Пользователи | DataTable: имя, роль, заведения, дата регистрации; поиск |
| `/dashboard/admin/users/[id]` | Пользователь | Профиль + история заведений + смена роли |
| `/dashboard/admin/subscriptions` | Подписки | DataTable всех подписок с фильтром по статусу/плану; bulk actions |

### 3.2 Owner (`/dashboard/owner`)

| Маршрут | Название | Основной контент |
|---|---|---|
| `/dashboard/owner` | Аналитика | Выручка/заказы за период, графики, топ блюд, статистика по официантам |
| `/dashboard/owner/orders` | Заказы | DataTable: активные + история; фильтры по дате, статусу, официанту |
| `/dashboard/owner/orders/[id]` | Заказ | Детали позиций, статусы, оплата, временные метки |
| `/dashboard/owner/menu` | Меню | Двухпанельный редактор: категории слева + позиции справа |
| `/dashboard/owner/tables` | Столы | Grid/список столов + статусы + создание/редактирование |
| `/dashboard/owner/staff` | Персонал | Список сотрудников с ролями + invite/remove |
| `/dashboard/owner/bookings` | Бронирования | Calendar view + DataTable; создание / изменение статуса |
| `/dashboard/owner/settings` | Настройки | Название, адрес, телефон заведения |

### 3.3 Общие страницы

| Маршрут | Назначение |
|---|---|
| `/dashboard/login` | Вход через Telegram Widget |
| `/dashboard/not-authorized` | Роль не имеет доступа к dashboard |

---

## 4. Компоненты

### 4.1 Layout-компоненты (новые)

```
components/dashboard/
├── DashboardLayout.tsx     ← обёртка: sidebar + topbar + main content slot
├── Sidebar.tsx             ← навигация, logo, user footer; коллапс на mobile
├── TopBar.tsx              ← breadcrumb, ShopSwitcher, UserMenu
├── ShopSwitcher.tsx        ← dropdown для multi-shop owner
├── UserMenu.tsx            ← аватар + выход
└── NavItem.tsx             ← одна nav-ссылка с иконкой, badge, active state
```

### 4.2 Data-компоненты (новые)

```
components/dashboard/
├── DataTable.tsx           ← универсальная таблица: сортировка, фильтры, пагинация
├── TableToolbar.tsx        ← поиск + фильтры + bulk actions над таблицей
├── DateRangePicker.tsx     ← выбор диапазона: сегодня / 7д / 30д / произвольный
├── Pagination.tsx          ← постраничная навигация
├── SortableHeader.tsx      ← заголовок колонки с иконкой сортировки
└── EmptyTableState.tsx     ← пустое состояние таблицы с иллюстрацией
```

### 4.3 Chart-компоненты (новые, через Recharts)

```
components/dashboard/
├── RevenueChart.tsx        ← LineChart: выручка по дням за период
├── OrdersBarChart.tsx      ← BarChart: количество заказов по дням
└── WaitersTable.tsx        ← таблица статистики по официантам (не chart)
```

**Библиотека:** `recharts` — React-native, Tailwind-совместима, нет peer dependencies с конфликтами.

### 4.4 Form-компоненты (новые)

```
components/dashboard/
├── InlineEditor.tsx        ← click-to-edit поле (для быстрого редактирования в таблице)
├── SearchInput.tsx         ← input с debounce 300ms и иконкой очистки
├── FilterChip.tsx          ← clickable chip для фильтров (статус, роль и т.п.)
├── FilterBar.tsx           ← горизонтальная панель с FilterChip-ами
└── ConfirmDialog.tsx       ← modal диалог подтверждения (не BottomSheet, modal для desktop)
```

### 4.5 Переиспользуемые из существующих

Следующие компоненты используются **без изменений**:

| Компонент | Файл | Использование в dashboard |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | Везде |
| `FormField` | `components/ui/FormField.tsx` | Все формы создания/редактирования |
| `Badge` | `components/ui/Badge.tsx` | Статусы подписок, заказов, ролей |
| `Toast` / `Toaster` | `components/ui/Toast.tsx` | Уведомления о действиях |
| `ConfirmSheet` | `components/ui/ConfirmSheet.tsx` | На mobile-breakpoint вместо ConfirmDialog |

---

## 5. API: расширения

Большинство эндпоинтов уже существуют. Нужно добавить 4 новых:

### 5.1 `GET /api/analytics/extended`

```typescript
// Запрос
?shop_id=xxx&from=2026-01-01&to=2026-04-13

// Ответ — расширяет существующий /api/analytics
{
  period: {
    revenue:    number
    orders:     number
    avg_order:  number
    paid_count: number
  }
  by_day: Array<{ date: string; revenue: number; orders: number }>
  by_waiter: Array<{ waiter_id: string; waiter_name: string; orders: number; revenue: number }>
  top_items: Array<{ item_id: string; name: string; quantity: number; revenue: number }>
}
```

**Охрана:** `requireOwnerAccess(shopId)` — как и все owner-эндпоинты.

### 5.2 `GET /api/admin/stats/timeline`

```typescript
// Запрос
?days=30

// Ответ
{
  new_shops:  Array<{ date: string; count: number }>
  new_subs:   Array<{ date: string; plan: string; count: number }>
  revenue_est: number  // суммарная выручка платформы (если нужно)
}
```

**Охрана:** `requireSuperAdmin()`.

### 5.3 `PATCH /api/menu/[id]/availability`

```typescript
// Тело
{ is_available: boolean }

// Ответ — обновлённый MenuItem
```

Нужен для быстрого toggle доступности прямо из таблицы меню без открытия формы.  
**Охрана:** `requireOwnerAccess(shopId)` — shop_id берётся из самого menu_item.

### 5.4 `GET /api/staff`

```typescript
// Запрос
?shop_id=xxx

// Ответ (если ещё не реализован)
Array<{
  id: string; user_id: string; role: ShopUserRole;
  user: { id: string; name: string; username: string | null; telegram_id: number }
}>
```

Проверить — возможно уже есть. **Охрана:** `requireOwnerAccess(shopId)`.

---

## 6. Изменения в существующем коде

### 6.1 `middleware.ts` — добавить dashboard routing

```typescript
// Добавить /dashboard/login в PUBLIC_PATHS
const PUBLIC_PATHS = ['/', '/not-connected', '/subscription-blocked', '/dashboard/login']

// Добавить dashboard-блок ПЕРЕД role-based route protection:
if (pathname.startsWith('/dashboard')) {
  if (!payload) {
    return NextResponse.redirect(new URL('/dashboard/login', req.url))
  }
  // Только owner и super_admin имеют доступ к dashboard
  if (!['owner', 'super_admin'].includes(role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
  }
  // Dashboard не блокируется subscription gate — owner должен видеть
  // панель даже с истёкшей подпиской, чтобы контактировать с поддержкой
  return NextResponse.next({ request: { headers: requestHeaders } })
}
```

### 6.2 `app/api/auth/route.ts` — добавить Telegram Widget flow

```typescript
// Новая ветка в POST handler:
if (body.tg_widget) {
  const { valid, data } = validateTelegramWidgetData(body.tg_widget, botToken)
  if (!valid) return error 401
  return upsertUserAndRespond({ telegramId: data.id, ... })
  // upsertUserAndRespond — та же функция, без изменений
}
```

`validateTelegramWidgetData` — новая функция в `lib/telegram/validate.ts`. Алгоритм отличается от Mini App только форматом строки данных для HMAC-проверки.

### 6.3 `app/(dashboard)/layout.tsx` — новый root layout

```typescript
// НЕ импортирует TelegramBootstrap
// НЕ рендерит Toaster (он уже в app/layout.tsx)
// Содержит только DashboardLayout

export default function DashboardRootLayout({ children }) {
  return children  // DashboardLayout внутри каждой page
}
```

---

## 7. Дизайн-система для дашборда

### 7.1 Цветовая палитра

Переиспользуем существующие CSS-переменные из `globals.css`:

```
--surface, --surface-muted, --surface-border  ← фоны и границы
--ink, --ink-secondary, --ink-muted           ← тексты
--brand-600                                   ← primary actions
```

Дополнительно для dashboard:

```css
/* Sidebar specifics */
--sidebar-bg:    #0f172a   /* slate-900 */
--sidebar-text:  #94a3b8   /* slate-400 */
--sidebar-active:#f1f5f9   /* slate-100 */
--sidebar-hover: #1e293b   /* slate-800 */
```

### 7.2 Typography

| Элемент | Класс |
|---|---|
| Page title | `text-2xl font-bold text-ink` |
| Section title | `text-base font-semibold text-ink` |
| Table header | `text-xs font-semibold uppercase tracking-wide text-ink-muted` |
| Table cell | `text-sm text-ink` |
| Stat value | `text-3xl font-bold text-ink` |
| Stat label | `text-sm text-ink-secondary` |

### 7.3 Spacing и grid

```
Sidebar width:        240px (desktop) / 0 (collapsed) / drawer 280px (mobile)
Content padding:      px-6 py-6 (desktop) / px-4 py-4 (mobile)
Content max-width:    1280px (centered)
Card gap:             gap-4 (mobile) / gap-6 (desktop)
DataTable row height: h-12 (48px)
```

---

## 8. Детальный план по страницам

### 8.1 `/dashboard/owner` — Аналитика

**Блок 1: Period Selector**
- Кнопки: Сегодня / 7 дней / 30 дней / Произвольный (DateRangePicker)
- При смене периода — все блоки перефетчиваются через `GET /api/analytics/extended`

**Блок 2: KPI Cards (4 штуки)**
- Выручка за период, Количество заказов, Средний чек, Активных сейчас
- Каждая карточка показывает значение + % изменение к предыдущему периоду

**Блок 3: Revenue Chart**
- LineChart: ось X — дни, ось Y — выручка в UZS
- Tooltip с форматированием `formatUZS`
- Responsive через `ResponsiveContainer`

**Блок 4: Waiter Performance Table**
- Колонки: Официант, Заказов, Выручка, Средний чек
- Сортировка по выручке по умолчанию

**Блок 5: Top Menu Items**
- Top-10 позиций по выручке за период
- Простой список с rank, названием, кол-вом порций и выручкой

---

### 8.2 `/dashboard/owner/orders` — Заказы

**FilterBar:**
- Статус: Все / Активные (open+in_kitchen+ready) / Оплаченные / Отменённые
- Дата: DateRangePicker
- Официант: Select из списка персонала

**DataTable колонки:**
- # (последние 6 символов id)
- Стол
- Официант
- Позиций (count из items)
- Сумма (formatUZS)
- Статус (Badge)
- Время создания
- Действия: кнопка «Открыть»

**Пагинация:** 25 заказов на страницу, client-side или server-side.

**Detail page `/dashboard/owner/orders/[id]`:**
- Полная информация: стол, официант, статус, способ оплаты
- Список позиций с ценами и статусами
- Timeline: создан → на кухне → готов → оплачен (визуальный)

---

### 8.3 `/dashboard/owner/menu` — Меню

**Двухпанельный layout:**

```
┌─────────────────────────────────────────────────────┐
│ ┌──────────────────┐ ┌──────────────────────────────┐│
│ │ КАТЕГОРИИ        │ │ ПОЗИЦИИ                      ││
│ │                  │ │                              ││
│ │ + Добавить       │ │ [поиск] [+ Добавить]         ││
│ │ ─────────────    │ │                              ││
│ │ Закуски      (8) │ │ DataTable позиций            ││
│ │ Горячее     (12) │ │ колонки: название, цена,     ││
│ │ Напитки      (5) │ │ доступность (toggle),        ││
│ │ Десерты      (3) │ │ категория, действия          ││
│ └──────────────────┘ └──────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Функциональность:**
- Клик по категории — фильтрует позиции в правой панели
- Toggle `is_available` — inline switch через `PATCH /api/menu/[id]/availability`
- Добавить/редактировать позицию — выдвигающаяся панель справа (drawer) или modal
- Удалить — `ConfirmDialog`
- Inline редактирование цены (click-to-edit)

---

### 8.4 `/dashboard/owner/tables` — Столы

**Grid view:**

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Стол 1  │ │  Стол 2  │ │  Стол 3  │
│  свободен│ │ занят    │ │ счёт     │
│  4 места │ │ 4 места  │ │ 6 мест   │
└──────────┘ └──────────┘ └──────────┘
```

- Статус-цвет: free=зелёный, occupied=янтарный, reserved=синий, bill_requested=красный
- Клик → открывает сайдпанель с активным заказом (если есть)
- Кнопка «Добавить стол» → inline форма
- Редактировать/удалить стол через меню в карточке

---

### 8.5 `/dashboard/owner/staff` — Персонал

**Список с группировкой по ролям:**

```
ВЛАДЕЛЬЦЫ (1)
───────────────────────────────
[avatar] Иван Иванов  @ivan   [owner badge]  [...]

ОФИЦИАНТЫ (3)
───────────────────────────────
[avatar] Мария        @masha  [waiter badge] [...]
...

КУХНЯ (2)
───────────────────────────────
...
```

**Действия:**
- «Добавить сотрудника» → поиск по имени/username через `/api/admin/users?search=`
- Изменить роль → select прямо в строке
- Удалить → `ConfirmDialog`

---

### 8.6 `/dashboard/admin` — Обзор платформы

**KPI Cards:**
- Заведений всего
- Активных подписок
- Trial подписок
- Истёкших подписок
- Пользователей на платформе
- Заказов сегодня

**Charts:**
- Bar chart: новые подписки по месяцам (30/60/90 дней)
- Pie chart или legend: распределение планов (trial/starter/pro)

**Quick Actions:**
- Последние 5 созданных заведений
- Подписки, истекающие в ближайшие 7 дней

---

### 8.7 `/dashboard/admin/restaurants` — Заведения

**DataTable:**

| Колонка | Тип | Сортируемая |
|---|---|---|
| Название | text | да |
| Адрес | text | нет |
| Владелец | text | нет |
| Тариф | Badge (trial/starter/pro) | да |
| Статус подписки | Badge | да |
| Осталось дней | number + прогресс-бар | да |
| Сотрудников | number | да |
| Создано | date | да |
| Действия | кнопки | нет |

**Фильтры:** По статусу подписки (trial / active / expired / suspended)  
**Действие:** «Создать заведение» → modal с FormField-ами

---

### 8.8 `/dashboard/admin/users` — Пользователи

**DataTable:**

| Колонка | Тип |
|---|---|
| Имя / username | text + @username |
| Telegram ID | monospace |
| Роль | Badge (color by role) |
| Заведение(я) | chips |
| Зарегистрирован | date |
| Действия | кнопки |

**Поиск:** по имени / username — debounce 300ms  
**Фильтр:** по роли  
**Действие:** клик на строку → `/dashboard/admin/users/[id]`

---

### 8.9 `/dashboard/admin/subscriptions` — Подписки

**DataTable:**

| Колонка | Тип |
|---|---|
| Заведение | text |
| План | Badge |
| Статус | Badge |
| Истекает | date (красный если < 7 дней) |
| Дней осталось | number |
| Действия | Edit |

**Фильтры:** статус (trial / active / expired / suspended)  
**Inline editing:** статус, план, дата истечения — прямо в таблице  
**Quick actions:** «+30 дней», «+365 дней» — одна кнопка

---

## 9. Фазы реализации

### Фаза 1 — Фундамент
**Срок:** 3-4 дня  
**Deliverable:** можно войти через Telegram Widget, видеть sidebar, переходить по навигации

#### Задачи:

**1.1 Telegram Login Widget page**
- `app/(dashboard)/login/page.tsx` — страница входа
- HTML Telegram Widget (script tag) → отправляет данные в `POST /api/auth`
- После успешного входа → редирект по роли (`/dashboard/admin` или `/dashboard/owner`)

**1.2 Расширить `/api/auth`**
- Добавить ветку `if (body.tg_widget)` в `app/api/auth/route.ts`
- Добавить `validateTelegramWidgetData` в `lib/telegram/validate.ts`

**1.3 Расширить `middleware.ts`**
- Добавить `/dashboard/login` в PUBLIC_PATHS
- Добавить dashboard routing-блок (см. п. 6.1)

**1.4 Новые layout-компоненты**
- `components/dashboard/Sidebar.tsx`
- `components/dashboard/TopBar.tsx`
- `components/dashboard/DashboardLayout.tsx`
- `components/dashboard/NavItem.tsx`
- `components/dashboard/UserMenu.tsx`

**1.5 Root layouts**
- `app/(dashboard)/layout.tsx` — минимальный, без TelegramBootstrap
- `app/(dashboard)/admin/layout.tsx` — с `DashboardLayout` и admin nav
- `app/(dashboard)/owner/layout.tsx` — с `DashboardLayout` и owner nav

**1.6 Placeholder страницы**
- Все страницы из п. 3.1 и 3.2 с заголовком и "Coming soon"
- Навигация уже работает

**1.7 Установить зависимость**
```bash
npm install recharts
npm install @types/recharts  # если нужно
```

**Критерий завершения:** Telegram Widget авторизует пользователя, sidebar отображает правильную навигацию по роли, переходы между страницами работают.

---

### Фаза 2 — Owner: Аналитика + Заказы
**Срок:** 3-4 дня  
**Deliverable:** owner видит реальные данные по выручке и заказам

#### Задачи:

**2.1 API: `/api/analytics/extended`**
- Поддержка `from` / `to` query params
- top_items через `JOIN order_items → menu_items`
- Ответ совместим с существующим `AnalyticsResponse`

**2.2 Chart-компоненты**
- `components/dashboard/RevenueChart.tsx` — LineChart через recharts
- `components/dashboard/DateRangePicker.tsx` — preset кнопки + custom range

**2.3 `/dashboard/owner` — Аналитика**
- KPI Cards (4 штуки)
- RevenueChart
- WaiterStats таблица
- Top Items список
- Period selector с состоянием

**2.4 DataTable базовый**
- `components/dashboard/DataTable.tsx` — generics, сортировка client-side, пагинация
- `components/dashboard/SearchInput.tsx`
- `components/dashboard/FilterBar.tsx`
- `components/dashboard/Pagination.tsx`

**2.5 `/dashboard/owner/orders`**
- DataTable с FilterBar (статус + дата + официант)
- Клик → `/dashboard/owner/orders/[id]`

**2.6 `/dashboard/owner/orders/[id]`**
- Детали заказа: позиции, статусы, оплата
- Back к списку

**Критерий завершения:** owner открывает дашборд, видит реальную выручку за выбранный период и может просматривать историю заказов.

---

### Фаза 3 — Owner: Меню + Столы + Персонал
**Срок:** 3-4 дня  
**Deliverable:** owner управляет операционными данными

#### Задачи:

**3.1 API: `PATCH /api/menu/[id]/availability`**
- Быстрый toggle is_available

**3.2 `/dashboard/owner/menu`**
- Двухпанельный layout (категории + позиции)
- DataTable позиций с inline availability toggle
- Модальная форма создания/редактирования позиции
- CRUD категорий

**3.3 `/dashboard/owner/tables`**
- Grid карточки столов по статусам
- Форма создания/редактирования стола

**3.4 `/dashboard/owner/staff`**
- Список персонала с группировкой по ролям
- Поиск и добавление пользователя
- Смена роли / удаление

**3.5 `/dashboard/owner/bookings`**
- DataTable бронирований с фильтром по дате и статусу
- Форма создания бронирования
- Смена статуса

**3.6 `/dashboard/owner/settings`**
- Форма редактирования данных заведения (название, адрес, телефон)
- `PATCH /api/admin/shops/[id]` (уже существует)

**Критерий завершения:** owner может полностью управлять меню, столами и персоналом через веб.

---

### Фаза 4 — Super Admin Dashboard
**Срок:** 3-4 дня  
**Deliverable:** super_admin видит платформу и управляет ею

#### Задачи:

**4.1 API: `/api/admin/stats/timeline`**
- Динамика новых подписок за N дней

**4.2 `/dashboard/admin` — Обзор**
- KPI Cards (заведения, подписки, пользователи)
- Chart: новые подписки по неделям
- Quick list: истекающие подписки

**4.3 `/dashboard/admin/restaurants`**
- DataTable с фильтром по статусу подписки
- Кнопка «Создать заведение» → modal
- Клик на строку → `/dashboard/admin/restaurants/[id]`

**4.4 `/dashboard/admin/restaurants/[id]`**
- Данные заведения + inline edit
- Управление подпиской (статус / план / дата истечения + quick-extend)
- Список персонала с возможностью добавления/удаления

**4.5 `/dashboard/admin/users`**
- DataTable с поиском и фильтром по роли
- Клик → `/dashboard/admin/users/[id]`

**4.6 `/dashboard/admin/users/[id]`**
- Профиль + список заведений
- Смена платформенной роли + назначение в заведение

**4.7 `/dashboard/admin/subscriptions`**
- DataTable всех подписок
- Inline editing статуса / плана / даты
- Quick-extend кнопки

**Критерий завершения:** super_admin полностью управляет платформой через веб без необходимости открывать Telegram.

---

### Фаза 5 — Полировка и деплой
**Срок:** 1-2 дня

#### Задачи:

**5.1 Responsive**
- Sidebar → hamburger на < 768px
- DataTable → горизонтальный скролл на mobile
- Charts → ResponsiveContainer уже обеспечивает

**5.2 Loading states**
- Skeleton-экраны для DataTable (shimmer rows)
- Skeleton для KPI Cards
- Skeleton для Charts

**5.3 Error states**
- Empty state с иллюстрацией если нет данных
- Error boundary с retry для каждой секции

**5.4 ShopSwitcher**
- Для owner с несколькими заведениями — dropdown в TopBar
- При переключении — обновляет `primaryShopId` в контексте сессии

**5.5 Keyboard & accessibility**
- `Tab` навигация по таблицам и формам
- `Escape` закрывает modals
- `aria-label` для иконок-кнопок

**Критерий завершения:** дашборд готов к production. Все страницы работают на десктопе и планшете, базово — на мобайле.

---

## 10. Структура файлов (итоговая)

```
app/
└── (dashboard)/
    ├── layout.tsx
    ├── login/
    │   └── page.tsx
    ├── admin/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── restaurants/
    │   │   ├── page.tsx
    │   │   └── [id]/
    │   │       └── page.tsx
    │   ├── users/
    │   │   ├── page.tsx
    │   │   └── [id]/
    │   │       └── page.tsx
    │   └── subscriptions/
    │       └── page.tsx
    └── owner/
        ├── layout.tsx
        ├── page.tsx
        ├── orders/
        │   ├── page.tsx
        │   └── [id]/
        │       └── page.tsx
        ├── menu/
        │   └── page.tsx
        ├── tables/
        │   └── page.tsx
        ├── staff/
        │   └── page.tsx
        ├── bookings/
        │   └── page.tsx
        └── settings/
            └── page.tsx

app/api/
├── analytics/
│   ├── route.ts            ← существующий
│   └── extended/
│       └── route.ts        ← НОВЫЙ
└── admin/
    └── stats/
        ├── route.ts        ← существующий
        └── timeline/
            └── route.ts    ← НОВЫЙ

components/
└── dashboard/
    ├── DashboardLayout.tsx
    ├── Sidebar.tsx
    ├── TopBar.tsx
    ├── NavItem.tsx
    ├── UserMenu.tsx
    ├── ShopSwitcher.tsx
    ├── DataTable.tsx
    ├── TableToolbar.tsx
    ├── SearchInput.tsx
    ├── FilterBar.tsx
    ├── FilterChip.tsx
    ├── Pagination.tsx
    ├── DateRangePicker.tsx
    ├── InlineEditor.tsx
    ├── ConfirmDialog.tsx
    ├── RevenueChart.tsx
    ├── OrdersBarChart.tsx
    └── SortableHeader.tsx

lib/
├── telegram/
│   └── validate.ts         ← добавить validateTelegramWidgetData
└── dashboard/
    └── formatters.ts       ← утилиты форматирования для дашборда

docs/
└── WEB_DASHBOARD_TZ.md    ← этот документ
```

---

## 11. Технические ограничения и решения

| Ограничение | Решение |
|---|---|
| `sameSite: 'none'` cookie в Mini App (Telegram iframe) | Dashboard работает в обычном браузере → `sameSite: 'lax'` — уже обрабатывается в `getSessionCookieOptions()` через `isDev` check. В production нужно добавить проверку на `/dashboard/*` пути. |
| `NEXT_PUBLIC_SUPABASE_URL` уже задан | Используем для клиентских preview (если понадобится direct Supabase). |
| recharts не установлен | `npm install recharts` — добавить в package.json как dependency. |
| Telegram Widget требует `https://` | В prod работает. В dev — использовать ngrok или `NEXT_PUBLIC_TELEGRAM_WIDGET_BYPASS=true` флаг (dev-only mock). |
| session cookie TTL = 24h | Dashboard-пользователи работают дольше. Рассмотреть `SESSION_TTL_SEC = 7 * 24 * 3600` или добавить автоматический silent refresh при загрузке любой dashboard-страницы. |

---

## 12. Порядок запуска Codex

Передавать Codex в следующем порядке, **один этап за раз**:

1. `[Phase 1.1-1.3]` — Login page + /api/auth widget branch + middleware update
2. `[Phase 1.4-1.7]` — Sidebar, TopBar, DashboardLayout, placeholder pages
3. `[Phase 2.1]` — /api/analytics/extended
4. `[Phase 2.2-2.6]` — Analytics page + Orders DataTable
5. `[Phase 3.1-3.3]` — Menu + Tables pages
6. `[Phase 3.4-3.6]` — Staff + Bookings + Settings pages
7. `[Phase 4.1-4.3]` — Admin overview + Restaurants DataTable
8. `[Phase 4.4-4.7]` — Admin detail pages + Users + Subscriptions
9. `[Phase 5.1-5.5]` — Polish: responsive, loading states, accessibility

Каждый prompt для Codex должен включать:
- ссылку на этот документ
- конкретные файлы из п. 10 которые нужно создать
- список существующих компонентов и API, которые переиспользуются
```
