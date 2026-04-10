-- ============================================================
-- BirLiy Kassa — Migration 006: Order item kitchen flow
-- Adds per-item kitchen statuses so one active order can be sent
-- to the kitchen in multiple waves without creating new orders.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'order_item_status'
  ) THEN
    CREATE TYPE public.order_item_status AS ENUM ('pending', 'in_kitchen', 'ready');
  END IF;
END
$$;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS status public.order_item_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sent_to_kitchen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

UPDATE public.order_items oi
SET status = (
      CASE o.status
      WHEN 'in_kitchen' THEN 'in_kitchen'
      WHEN 'ready' THEN 'ready'
      WHEN 'paid' THEN 'ready'
      ELSE 'pending'
      END
    )::public.order_item_status,
    sent_to_kitchen_at = CASE
      WHEN o.status IN ('in_kitchen', 'ready', 'paid') THEN COALESCE(oi.sent_to_kitchen_at, o.updated_at, o.created_at)
      ELSE oi.sent_to_kitchen_at
    END,
    ready_at = CASE
      WHEN o.status IN ('ready', 'paid') THEN COALESCE(oi.ready_at, o.updated_at, o.created_at)
      ELSE oi.ready_at
    END
FROM public.orders o
WHERE o.id = oi.order_id;

CREATE INDEX IF NOT EXISTS order_items_status_idx
  ON public.order_items (order_id, status);

DROP TRIGGER IF EXISTS trg_recalc_order_total_insert ON public.order_items;
DROP TRIGGER IF EXISTS trg_recalc_order_total_update ON public.order_items;
DROP TRIGGER IF EXISTS trg_recalc_order_total_delete ON public.order_items;
DROP TRIGGER IF EXISTS trg_recalc_order_snapshot_insert ON public.order_items;
DROP TRIGGER IF EXISTS trg_recalc_order_snapshot_update ON public.order_items;
DROP TRIGGER IF EXISTS trg_recalc_order_snapshot_delete ON public.order_items;

CREATE OR REPLACE FUNCTION public.recalc_order_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id         UUID;
  v_current_status   public.order_status;
  v_has_pending      BOOLEAN;
  v_has_in_kitchen   BOOLEAN;
  v_has_ready        BOOLEAN;
  v_total_amount     INTEGER;
  v_next_status      public.order_status;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT status
  INTO v_current_status
  FROM public.orders
  WHERE id = v_order_id;

  IF v_current_status IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(SUM(quantity * unit_price), 0),
    BOOL_OR(status = 'pending'),
    BOOL_OR(status = 'in_kitchen'),
    BOOL_OR(status = 'ready')
  INTO
    v_total_amount,
    v_has_pending,
    v_has_in_kitchen,
    v_has_ready
  FROM public.order_items
  WHERE order_id = v_order_id;

  IF v_current_status IN ('paid', 'cancelled') THEN
    UPDATE public.orders
    SET total_amount = v_total_amount
    WHERE id = v_order_id;
    RETURN NEW;
  END IF;

  v_next_status := (
    CASE
    WHEN v_has_in_kitchen THEN 'in_kitchen'
    WHEN v_has_pending THEN 'open'
    WHEN v_has_ready THEN 'ready'
    ELSE 'open'
    END
  )::public.order_status;

  UPDATE public.orders
  SET total_amount = v_total_amount,
      status = v_next_status
  WHERE id = v_order_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_order_snapshot_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_snapshot();

CREATE TRIGGER trg_recalc_order_snapshot_update
  AFTER UPDATE OF quantity, unit_price, status ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_snapshot();

CREATE TRIGGER trg_recalc_order_snapshot_delete
  AFTER DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_snapshot();

UPDATE public.orders o
SET total_amount = totals.total_amount,
    status = (
      CASE
      WHEN o.status IN ('paid', 'cancelled') THEN o.status
      WHEN totals.has_in_kitchen THEN 'in_kitchen'
      WHEN totals.has_pending THEN 'open'
      WHEN totals.has_ready THEN 'ready'
      ELSE 'open'
      END
    )::public.order_status
FROM (
  SELECT
    order_id,
    COALESCE(SUM(quantity * unit_price), 0) AS total_amount,
    BOOL_OR(status = 'pending') AS has_pending,
    BOOL_OR(status = 'in_kitchen') AS has_in_kitchen,
    BOOL_OR(status = 'ready') AS has_ready
  FROM public.order_items
  GROUP BY order_id
) AS totals
WHERE totals.order_id = o.id;
