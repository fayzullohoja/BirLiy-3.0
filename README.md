# BirLiy Kassa

> Система управления заказами для кафе и ресторанов Узбекистана.
> Работает как **Telegram Mini App** — никакой отдельной установки для сотрудников.

---

## Стек

| Слой         | Технология                            |
|--------------|---------------------------------------|
| Фреймворк    | Next.js 15 (App Router)               |
| Язык         | TypeScript 5                          |
| Стили        | Tailwind CSS v3                       |
| База данных  | Supabase (PostgreSQL + RLS)           |
| Аутентификация | Telegram WebApp SDK + HS256 JWT     |
| Деплой       | Vercel                                |

---

## Роли и доступ

| Роль          | Маршрут   | Возможности                                                |
|---------------|-----------|------------------------------------------------------------|
| `waiter`      | `/waiter` | Столы, создание и управление заказами, просмотр меню       |
| `owner`       | `/owner`  | Аналитика, все заказы, персонал, меню, бронирования        |
| `super_admin` | `/admin`  | Все заведения, пользователи, подписки, платформа           |

---

## Быстрый старт (локальная разработка)

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.local.example .env.local
```

Заполните `.env.local` — все переменные обязательны (см. таблицу ниже).

### 3. Настроить Supabase

#### Создать проект

1. Зайдите на [supabase.com](https://supabase.com) и создайте новый проект
2. Запомните: **Project URL**, **anon key**, **service_role key**, **JWT secret**

#### Применить миграции

Откройте **SQL Editor** в Supabase Dashboard и выполните файлы строго по порядку:

```
supabase/migrations/001_schema.sql           ← таблицы, типы, индексы
supabase/migrations/002_functions.sql        ← PL/pgSQL триггеры и функции
supabase/migrations/003_rls.sql              ← Row Level Security политики
supabase/migrations/004_payment_types.sql    ← PayMe и Click способы оплаты
supabase/migrations/005_kitchen_roles.sql    ← роль kitchen в enum
supabase/migrations/006_order_item_kitchen_flow.sql  ← кухонный флоу + исправление триггера
supabase/seed.sql                            ← демо-данные (только для разработки!)
```

> ⚠️ **Важно:** миграции 005 и 006 обязательны. Без 006 кнопка «На кухню» будет возвращать ошибку 500 из-за неявного каста типов в триггере `recalc_order_snapshot`.

> **Альтернатива через CLI:**
> ```bash
> npx supabase db push --db-url "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
> ```

### 4. Запустить dev-сервер

```bash
npm run dev
```

Приложение доступно на [http://localhost:3000](http://localhost:3000).

---

## Работа без Telegram (dev bypass)

Добавьте параметр `?role=...` к URL для обхода Telegram auth:

| URL                                    | Роль           |
|----------------------------------------|----------------|
| `http://localhost:3000?role=waiter`    | Официант       |
| `http://localhost:3000?role=owner`     | Владелец       |
| `http://localhost:3000?role=admin`     | Супер-Админ    |

Dev-аутентификация создаёт реальную сессию в БД. Повторный вход с тем же `role` использует тот же аккаунт.

**Порядок для полного демо:**
1. Войдите как `?role=admin` → в разделе «Заведения» убедитесь, что данные из seed загружены
2. Войдите как `?role=owner` → скопируйте UUID пользователя из `/api/auth/status`
3. Через `/admin/restaurants/00000000-0000-0000-0000-000000000001` → назначьте owner
4. Войдите как `?role=waiter` → аналогично назначьте через owner-панель

---

## Переменные окружения

| Переменная                      | Обязательна | Где взять                                                         |
|---------------------------------|-------------|-------------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅           | Supabase → Settings → API → Project URL                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅           | Supabase → Settings → API → `anon` / `public` key                |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅           | Supabase → Settings → API → `service_role` key                   |
| `SUPABASE_JWT_SECRET`           | ✅           | Supabase → Settings → API → JWT Settings → JWT Secret             |
| `TELEGRAM_BOT_TOKEN`            | ✅ prod      | @BotFather → `/newbot` → скопировать токен                       |
| `NEXT_PUBLIC_APP_URL`           | ✅ prod      | URL вашего Vercel деплоя (например `https://kassa.example.com`)  |

> **Безопасность:** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` и `TELEGRAM_BOT_TOKEN`
> — строго серверные. Никогда не добавляйте `NEXT_PUBLIC_` к этим значениям.

---

## Деплой на Vercel

### 1. Подключить репозиторий

```bash
# Через Vercel CLI:
npx vercel --prod

# Или через vercel.com → Import Project → выбрать репозиторий
```

### 2. Добавить переменные окружения

В Vercel Dashboard → Settings → Environment Variables добавьте все 6 переменных из `.env.local.example`.

### 3. Настроить Supabase для production

1. Применить все миграции к production-проекту Supabase (SQL Editor или CLI)
2. Убедиться, что RLS включён на всех таблицах
3. **Не** применять `seed.sql` в production

### 4. Настроить Telegram бота

```
/setmenubutton → выбрать бота → вставить URL Vercel → "Открыть приложение"
```

### 5. Проверка деплоя

- `https://your-app.vercel.app/api/auth/status` должен вернуть `{ data: null, error: ... }` (нет сессии — ок)
- Открыть Mini App через Telegram → авторизация должна проходить

---

## Архитектура

### Auth flow

```
Telegram Mini App
       │
       │  initData (подписано ботом HMAC-SHA256)
       ▼
POST /api/auth
  1. validateTelegramInitData()  ← проверка подписи
  2. supabase.auth.admin.createUser()  ← upsert auth.users
  3. upsert public.users с ролью
  4. fetch shop_users + subscriptions
  5. signSession()  ← HS256 JWT с app_role, shop_ids, subscription_ok
  6. Set-Cookie: birliy-session (httpOnly, secure, sameSite=none)
  7. Return { role, has_shop_access, subscription_ok }
       │
       ▼
middleware.ts (каждый запрос к защищённым маршрутам)
  1. verifySession(cookie)  ← проверка подписи + expiry без обращения к БД
  2. Routing: проверка роли, shop_ids, subscription_ok
  3. Set headers: x-user-id, x-user-role  → доступны в API handlers
       │
       ▼
API Route Handlers
  requireAuth() / requireShopAccess() / requireOwnerAccess() / requireSuperAdmin()
```

### Структура проекта

```
app/
├── (gateway)/
│   ├── layout.tsx                     # Центрированный layout без навигации
│   ├── not-connected/page.tsx         # Пользователь не привязан к заведению
│   └── subscription-blocked/page.tsx  # Подписка истекла
├── admin/                             # Панель супер-администратора
│   ├── layout.tsx                     # 4-tab nav (Обзор, Заведения, Польз., Подписки)
│   ├── page.tsx                       # Обзор платформы — статистика
│   ├── restaurants/page.tsx           # Список заведений + создание
│   ├── restaurants/[id]/page.tsx      # Детали: подписка, персонал, редактирование
│   ├── users/page.tsx                 # Пользователи с фильтром по роли
│   └── subscriptions/page.tsx        # Все подписки + управление
├── owner/                             # Панель владельца
│   ├── layout.tsx                     # 4-tab nav (Итоги, Заказы, Столы, Меню)
│   ├── page.tsx                       # Дашборд: выручка, график, официанты
│   ├── orders/page.tsx                # Все заказы с фильтрами
│   ├── orders/[id]/page.tsx           # Детали заказа (read-only)
│   ├── tables/page.tsx                # CRUD столов
│   ├── menu/page.tsx                  # CRUD меню и категорий
│   ├── bookings/page.tsx              # Бронирования
│   └── staff/page.tsx                 # Персонал
├── waiter/                            # Панель официанта
│   ├── layout.tsx                     # 3-tab nav (Столы, Заказы, Меню)
│   ├── page.tsx                       # Сетка столов с цветовыми статусами
│   ├── orders/page.tsx                # Активные заказы
│   ├── menu/page.tsx                  # Просмотр меню
│   └── table/[tableId]/
│       ├── page.tsx                   # Управление заказом на столе
│       └── menu/page.tsx             # Добавление позиций в заказ
├── api/
│   ├── auth/                          # POST login, GET status, POST logout
│   ├── admin/                         # Все /api/admin/* (super_admin only)
│   │   ├── stats/                     # Платформенная статистика
│   │   ├── shops/                     # CRUD заведений + trial подписка
│   │   ├── shops/[id]/members/        # Назначение/удаление персонала
│   │   ├── users/                     # Список + изменение ролей
│   │   └── subscriptions/[shopId]/    # Управление подпиской
│   ├── analytics/                     # Выручка за сегодня и 7 дней
│   ├── bookings/                      # CRUD бронирований
│   ├── categories/                    # CRUD категорий меню
│   ├── menu/                          # CRUD позиций меню
│   ├── order-items/[id]/              # Изменение количества / удаление позиции
│   ├── orders/                        # Создание, список, переход статуса
│   ├── staff/                         # Список и управление персоналом
│   └── tables/                        # CRUD столов
├── layout.tsx                         # Root layout: Telegram SDK + Toaster
├── page.tsx                           # Entry point: Telegram auth → redirect
└── globals.css                        # Дизайн-токены, базовые стили

components/
├── layout/
│   ├── AppHeader.tsx                  # Фиксированный заголовок (h=56px)
│   └── BottomNav.tsx                  # Нижняя навигация (h=64px)
├── shared/
│   ├── LoadingScreen.tsx              # Полноэкранный спиннер + Skeleton
│   └── TelegramBootstrap.tsx          # ready() + expand() при монтировании
└── ui/
    ├── Badge.tsx                      # + TableStatusBadge, OrderStatusBadge
    ├── BottomSheet.tsx                # Slide-up модальное окно
    ├── Button.tsx                     # 5 вариантов, 3 размера, loading
    ├── Card.tsx                       # + StatCard, ListItem, CardSection
    ├── ConfirmSheet.tsx               # Переиспользуемое подтверждение действий
    ├── FormField.tsx                  # Label + input/select/textarea
    ├── PageContainer.tsx              # + Section, EmptyState
    └── Toast.tsx                      # Module-level уведомления + <Toaster />

lib/
├── auth/
│   ├── apiGuard.ts                    # requireAuth/ShopAccess/OwnerAccess/SuperAdmin
│   ├── getUser.ts                     # getUserContext, verifyShopAccess
│   └── session.ts                     # signSession, verifySession (HS256 JWT)
├── supabase/
│   ├── client.ts                      # Браузерный клиент (для Client Components)
│   └── server.ts                      # createClient, createServiceClient
├── telegram/
│   ├── validate.ts                    # HMAC-SHA256 валидация initData
│   └── webapp.ts                      # SDK утилиты: bootstrapTelegramApp, getUser
├── types.ts                           # Все домейные TypeScript типы
└── utils.ts                           # cn, formatUZS, formatTime, ok, err, ...

middleware.ts                           # JWT проверка + маршрутная защита
supabase/
├── migrations/
│   ├── 001_schema.sql                 # Таблицы, типы, индексы, триггеры
│   ├── 002_functions.sql              # PL/pgSQL бизнес-логика
│   ├── 003_rls.sql                    # Row Level Security
│   └── 004_payment_types.sql         # PayMe, Click способы оплаты
└── seed.sql                           # Демо-данные (только dev)
```

---

## Ключевые правила базы данных

| Правило                          | Реализация                                                                    |
|----------------------------------|-------------------------------------------------------------------------------|
| Один активный заказ на стол      | `UNIQUE INDEX` на `(table_id) WHERE status NOT IN ('paid','cancelled')`      |
| Автопересчёт суммы заказа        | Триггер `recalc_order_total` при INSERT/UPDATE/DELETE в `order_items`         |
| Синхронизация статуса стола      | Триггер `sync_table_status_on_order_change` при изменении `orders.status`    |
| Изоляция по заведению            | `shop_id` в каждой таблице + RLS + `requireShopAccess()` в API               |
| Подписка влияет на доступ        | `subscription_ok` в JWT → middleware → редирект на `/subscription-blocked`   |

---

## Безопасность

- **RLS** включён на всех таблицах. Политики используют `auth.uid()` и функции `is_super_admin()`, `i_belong_to_shop()`, `i_own_shop()`
- **Service role** (bypass RLS) используется только в API route handlers, никогда в браузере
- **JWT** сессия истекает через 7 дней, хранится в `httpOnly; Secure; SameSite=None` cookie
- **super_admin** обходит все subscription и shop проверки в middleware и API
- **Telegram initData** проверяется HMAC-SHA256 с `TELEGRAM_BOT_TOKEN` на каждом входе

---

## История фаз

| Фаза | Что реализовано                                                              |
|------|------------------------------------------------------------------------------|
| 1    | Структура проекта, дизайн-система, Telegram bootstrap, placeholder страницы  |
| 2    | Схема БД, RLS, Telegram auth, middleware, gateway экраны                    |
| 3    | Waiter MVP: столы, заказы, меню, расчёт, payment types                      |
| 4    | Owner panel: аналитика, заказы, столы, меню, бронирования, персонал         |
| 5    | Super admin: платформа, заведения, пользователи, подписки                   |
| 6    | Полировка: Toast, FormField, ConfirmSheet, deployment config, документация  |
| 7    | Kitchen role: очередь кухни, роль kitchen в admin UI, миграции БД           |
