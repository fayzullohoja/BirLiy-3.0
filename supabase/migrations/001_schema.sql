-- ============================================================
-- BirLiy Kassa — Migration 001: Base Schema
-- Run in order: 001 → 002 → 003
-- ============================================================

-- ─── Custom Types ─────────────────────────────────────────────────────────────

CREATE TYPE public.user_role      AS ENUM ('super_admin', 'owner', 'waiter', 'kitchen');
CREATE TYPE public.shop_user_role AS ENUM ('owner', 'waiter', 'kitchen');
CREATE TYPE public.table_status   AS ENUM ('free', 'occupied', 'reserved', 'bill_requested');
CREATE TYPE public.order_status   AS ENUM ('open', 'in_kitchen', 'ready', 'paid', 'cancelled');
CREATE TYPE public.order_item_status AS ENUM ('pending', 'in_kitchen', 'ready');
CREATE TYPE public.payment_type   AS ENUM ('cash', 'card');
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'seated', 'cancelled', 'no_show');
CREATE TYPE public.sub_status     AS ENUM ('trial', 'active', 'expired', 'suspended');
CREATE TYPE public.sub_plan       AS ENUM ('trial', 'starter', 'pro');

-- ─── Users ────────────────────────────────────────────────────────────────────
-- id mirrors auth.users.id so that Supabase JWT claims (auth.uid()) align
-- with our row-level security checks.

CREATE TABLE public.users (
  id            UUID              PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id   BIGINT            NOT NULL UNIQUE,
  name          TEXT              NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  username      TEXT,
  role          public.user_role  NOT NULL DEFAULT 'waiter',
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX users_telegram_id_idx ON public.users (telegram_id);
CREATE INDEX users_role_idx        ON public.users (role);

-- ─── Shops ────────────────────────────────────────────────────────────────────

CREATE TABLE public.shops (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  address     TEXT,
  phone       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Shop ↔ User Membership ───────────────────────────────────────────────────

CREATE TABLE public.shop_users (
  id          UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID                  NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id     UUID                  NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        public.shop_user_role NOT NULL DEFAULT 'waiter',
  created_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, user_id)
);

CREATE INDEX shop_users_user_id_idx ON public.shop_users (user_id);
CREATE INDEX shop_users_shop_id_idx ON public.shop_users (shop_id);

-- ─── Subscriptions ────────────────────────────────────────────────────────────
-- One subscription row per shop (updated in place on renewal).

CREATE TABLE public.subscriptions (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID             NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  status      public.sub_status NOT NULL DEFAULT 'trial',
  plan        public.sub_plan   NOT NULL DEFAULT 'trial',
  expires_at  TIMESTAMPTZ      NOT NULL,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_shop_id_idx  ON public.subscriptions (shop_id);
CREATE INDEX subscriptions_expires_idx  ON public.subscriptions (expires_at);

-- ─── Restaurant Tables ────────────────────────────────────────────────────────

CREATE TABLE public.restaurant_tables (
  id          UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID                 NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  number      INTEGER              NOT NULL CHECK (number > 0),
  name        TEXT                 NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  capacity    INTEGER              NOT NULL DEFAULT 4 CHECK (capacity BETWEEN 1 AND 100),
  status      public.table_status  NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, number)
);

CREATE INDEX restaurant_tables_shop_id_idx ON public.restaurant_tables (shop_id);
CREATE INDEX restaurant_tables_status_idx  ON public.restaurant_tables (shop_id, status);

-- ─── Menu Categories ──────────────────────────────────────────────────────────

CREATE TABLE public.menu_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, name)
);

CREATE INDEX menu_categories_shop_id_idx ON public.menu_categories (shop_id, sort_order);

-- ─── Menu Items ───────────────────────────────────────────────────────────────
-- Price stored in integer UZS (no decimals in Uzbek market).

CREATE TABLE public.menu_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id  UUID        REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  price        INTEGER     NOT NULL CHECK (price >= 0),
  is_available BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX menu_items_shop_id_idx     ON public.menu_items (shop_id, sort_order);
CREATE INDEX menu_items_category_idx    ON public.menu_items (category_id);
CREATE INDEX menu_items_available_idx   ON public.menu_items (shop_id) WHERE is_available = TRUE;

-- ─── Orders ───────────────────────────────────────────────────────────────────
-- Business rule: only one non-terminal order per table at a time.
-- "Terminal" = paid or cancelled.

CREATE TABLE public.orders (
  id            UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID                NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  table_id      UUID                NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  waiter_id     UUID                NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status        public.order_status NOT NULL DEFAULT 'open',
  total_amount  INTEGER             NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_type  public.payment_type,                   -- NULL until payment
  notes         TEXT,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Enforce one active order per table at a time
CREATE UNIQUE INDEX orders_one_active_per_table
  ON public.orders (table_id)
  WHERE status NOT IN ('paid', 'cancelled');

CREATE INDEX orders_shop_id_idx     ON public.orders (shop_id);
CREATE INDEX orders_table_id_idx    ON public.orders (table_id);
CREATE INDEX orders_waiter_id_idx   ON public.orders (waiter_id);
CREATE INDEX orders_status_idx      ON public.orders (shop_id, status);
CREATE INDEX orders_created_at_idx  ON public.orders (shop_id, created_at DESC);

-- ─── Order Items ──────────────────────────────────────────────────────────────
-- unit_price is snapshotted at order time (immutable after creation).

CREATE TABLE public.order_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  UUID        NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  quantity      INTEGER     NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  unit_price    INTEGER     NOT NULL CHECK (unit_price >= 0),
  status        public.order_item_status NOT NULL DEFAULT 'pending',
  notes         TEXT,
  sent_to_kitchen_at TIMESTAMPTZ,
  ready_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX order_items_status_idx ON public.order_items (order_id, status);

-- ─── Table Bookings ───────────────────────────────────────────────────────────

CREATE TABLE public.table_bookings (
  id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID                  NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  table_id         UUID                  NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  booked_by        UUID                  NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  guest_name       TEXT                  NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 120),
  guest_phone      TEXT,
  party_size       INTEGER               NOT NULL CHECK (party_size BETWEEN 1 AND 100),
  booked_at        TIMESTAMPTZ           NOT NULL,
  duration_minutes INTEGER               NOT NULL DEFAULT 120 CHECK (duration_minutes BETWEEN 15 AND 600),
  status           public.booking_status NOT NULL DEFAULT 'confirmed',
  notes            TEXT,
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  -- booking must be in the future when confirmed
  CONSTRAINT booking_future_check CHECK (
    status != 'confirmed' OR booked_at > created_at - INTERVAL '1 minute'
  )
);

CREATE INDEX table_bookings_shop_id_idx    ON public.table_bookings (shop_id);
CREATE INDEX table_bookings_table_id_idx   ON public.table_bookings (table_id);
CREATE INDEX table_bookings_booked_at_idx  ON public.table_bookings (shop_id, booked_at);
CREATE INDEX table_bookings_status_idx     ON public.table_bookings (shop_id, status)
  WHERE status IN ('confirmed', 'seated');

-- ─── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_table_bookings_updated_at
  BEFORE UPDATE ON public.table_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
