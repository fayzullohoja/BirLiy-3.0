-- ============================================================
-- BirLiy Kassa — Development Seed Data
-- WARNING: Do NOT run in production.
-- Run AFTER all migrations (001 → 002 → 003 → 004).
--
-- This seed creates a realistic demo environment:
--   - 2 active shops + 1 expired shop
--   - One super_admin, two owners, four waiters
--   - Full menu (15+ items, 4 categories) for primary shop
--   - Sample tables with statuses
--
-- HOW TO RUN:
--   Option A — Supabase SQL Editor: paste and execute.
--   Option B — Supabase CLI:
--     supabase db reset --db-url <your-db-url>
--     (this runs migrations then seed automatically)
--
-- IMPORTANT: auth.users rows must be created via Supabase API
-- before inserting into public.users. See notes below.
-- ============================================================

-- ─── Shops ────────────────────────────────────────────────────────────────────

INSERT INTO public.shops (id, name, address, phone, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Osh Markazi',    'ул. Амира Темура 12, Ташкент',     '+998 71 123 45 67', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'Bahor Cafe',     'пр. Узбекистан 5, Ташкент',        '+998 71 234 56 78', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'Samarqand Uyi',  'ул. Шота Руставели 8, Самарканд',  '+998 66 345 67 89', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── Subscriptions ────────────────────────────────────────────────────────────

INSERT INTO public.subscriptions (shop_id, status, plan, expires_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'active',  'pro',     NOW() + INTERVAL '60 days'),
  ('00000000-0000-0000-0000-000000000002', 'trial',   'trial',   NOW() + INTERVAL '21 days'),
  ('00000000-0000-0000-0000-000000000003', 'expired', 'starter', NOW() - INTERVAL '3 days')
ON CONFLICT (shop_id) DO NOTHING;

-- ─── Tables — Osh Markazi (8 tables) ─────────────────────────────────────────

INSERT INTO public.restaurant_tables (shop_id, number, name, capacity, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 1,  'Стол 1',    4,  'occupied'),
  ('00000000-0000-0000-0000-000000000001', 2,  'Стол 2',    4,  'free'),
  ('00000000-0000-0000-0000-000000000001', 3,  'Стол 3',    6,  'free'),
  ('00000000-0000-0000-0000-000000000001', 4,  'Стол 4',    6,  'bill_requested'),
  ('00000000-0000-0000-0000-000000000001', 5,  'VIP-зал',   8,  'reserved'),
  ('00000000-0000-0000-0000-000000000001', 6,  'Терраса',   4,  'free'),
  ('00000000-0000-0000-0000-000000000001', 7,  'Бар',       6,  'occupied'),
  ('00000000-0000-0000-0000-000000000001', 8,  'Банкетный', 20, 'free')
ON CONFLICT (shop_id, number) DO NOTHING;

-- ─── Tables — Bahor Cafe (4 tables) ──────────────────────────────────────────

INSERT INTO public.restaurant_tables (shop_id, number, name, capacity, status) VALUES
  ('00000000-0000-0000-0000-000000000002', 1,  'Стол 1',  4, 'free'),
  ('00000000-0000-0000-0000-000000000002', 2,  'Стол 2',  4, 'occupied'),
  ('00000000-0000-0000-0000-000000000002', 3,  'Зал А',   8, 'free'),
  ('00000000-0000-0000-0000-000000000002', 4,  'Зал Б',   8, 'free')
ON CONFLICT (shop_id, number) DO NOTHING;

-- ─── Menu categories — Osh Markazi ───────────────────────────────────────────

INSERT INTO public.menu_categories (id, shop_id, name, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Супы',         1),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Основные',     2),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Напитки',      3),
  ('c1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Десерты',      4)
ON CONFLICT (shop_id, name) DO NOTHING;

-- ─── Menu items — Osh Markazi ─────────────────────────────────────────────────

INSERT INTO public.menu_items (shop_id, category_id, name, price, is_available, sort_order) VALUES
  -- Супы
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Лагман',            28000, TRUE,  1),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Шурпа',             32000, TRUE,  2),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Мастава',           26000, FALSE, 3),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Нарын',             35000, TRUE,  4),
  -- Основные
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Плов',              45000, TRUE,  1),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Шашлык (порция)',   62000, TRUE,  2),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Куртоба',           38000, TRUE,  3),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Самса (2 шт)',      18000, TRUE,  4),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Димлама',           55000, TRUE,  5),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Манты (6 шт)',      42000, TRUE,  6),
  -- Напитки
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Зелёный чай',       12000, TRUE,  1),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Чёрный чай',        12000, TRUE,  2),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Компот',             8000, TRUE,  3),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Вода (0.5л)',        5000, TRUE,  4),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Сок (апельсин)',    14000, TRUE,  5),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Айрон',             10000, TRUE,  6),
  -- Десерты
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Халва',             15000, TRUE,  1),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Нишалда',           12000, TRUE,  2),
  ('00000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Пахлава (4 шт)',    20000, TRUE,  3)
ON CONFLICT DO NOTHING;

-- ─── Menu categories + items — Bahor Cafe ────────────────────────────────────

INSERT INTO public.menu_categories (id, shop_id, name, sort_order) VALUES
  ('c2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Завтраки',     1),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Блюда',        2),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Напитки',      3)
ON CONFLICT (shop_id, name) DO NOTHING;

INSERT INTO public.menu_items (shop_id, category_id, name, price, is_available, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Яичница (2 яйца)', 18000, TRUE, 1),
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Омлет с сыром',    22000, TRUE, 2),
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Каша овсяная',     16000, TRUE, 3),
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'Плов',             40000, TRUE, 1),
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'Лагман',           26000, TRUE, 2),
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000003', 'Кофе',             18000, TRUE, 1),
  ('00000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000003', 'Чай',              10000, TRUE, 2)
ON CONFLICT DO NOTHING;

-- ─── Users ────────────────────────────────────────────────────────────────────
-- NOTE: In Supabase, auth.users must be created via Admin API (supabase.auth.admin.createUser)
-- before inserting into public.users. These INSERTs assume auth.users rows already exist
-- with matching UUIDs. In a real setup, the /api/auth endpoint creates them on first login.
--
-- For dev bypass mode (?role=owner etc.) the app creates auth + public.users automatically
-- via the dev auth path in /api/auth/route.ts.
--
-- Placeholder UUIDs (match what dev auth creates when using fixed telegram_id):
--   Super Admin:  telegram_id=99900001  → role=super_admin
--   Owner 1:      telegram_id=99900002  → role=owner      → shop: Osh Markazi
--   Owner 2:      telegram_id=99900003  → role=owner      → shop: Bahor Cafe
--   Waiter 1:     telegram_id=99900011  → role=waiter     → shop: Osh Markazi
--   Waiter 2:     telegram_id=99900012  → role=waiter     → shop: Osh Markazi
--
-- These are created automatically when you open the app with ?role=owner, ?role=waiter etc.
-- No manual SQL for users is required in the standard dev flow.

-- ─── DEV TIPS ─────────────────────────────────────────────────────────────────
--
-- 1. Open http://localhost:3000?role=super_admin  → auto-creates super_admin user
-- 2. Open http://localhost:3000?role=owner        → auto-creates owner user
--    Then in admin panel: assign owner to shop '00000000-0000-0000-0000-000000000001'
-- 3. Open http://localhost:3000?role=waiter       → auto-creates waiter user
--    Then in owner panel: they appear in staff list
--
-- The dev auth endpoint uses a seeded telegram_id based on the role,
-- so the same UUID is reused on repeated logins.
