-- ============================================================
-- BirLiy Kassa — Migration 002: Helper Functions for RLS
-- Must run after 001_schema.sql
-- ============================================================

-- ─── Core identity helpers ────────────────────────────────────────────────────
-- These use SECURITY DEFINER so they always have access to the tables they read.
-- They are stable (no side effects) and called frequently from policies.

-- Returns true if the authenticated user is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

-- Returns the set of shop_ids the current user belongs to
CREATE OR REPLACE FUNCTION public.get_my_shop_ids()
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(shop_id), '{}')
  FROM public.shop_users
  WHERE user_id = auth.uid()
$$;

-- Returns true if the current user belongs to the given shop
CREATE OR REPLACE FUNCTION public.i_belong_to_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE user_id = auth.uid() AND shop_id = p_shop_id
  )
$$;

-- Returns the role of the current user within a specific shop ('owner' | 'waiter' | NULL)
CREATE OR REPLACE FUNCTION public.my_shop_role(p_shop_id UUID)
RETURNS public.shop_user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.shop_users
  WHERE user_id = auth.uid() AND shop_id = p_shop_id
  LIMIT 1
$$;

-- Returns true if the current user is owner of the given shop
CREATE OR REPLACE FUNCTION public.i_own_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE user_id = auth.uid() AND shop_id = p_shop_id AND role = 'owner'
  )
$$;

-- ─── Subscription check ───────────────────────────────────────────────────────

-- Returns true if the shop has an active or trial subscription
CREATE OR REPLACE FUNCTION public.shop_subscription_ok(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE shop_id = p_shop_id
      AND status IN ('active', 'trial')
      AND expires_at > NOW()
  )
$$;

-- ─── Order total recalculation ────────────────────────────────────────────────

-- Recalculates total_amount and derives the aggregate order status from
-- the statuses of its order_items. This keeps one active order per table
-- while still allowing multiple "waves" of kitchen sends.
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

  v_next_status := CASE
    WHEN v_has_in_kitchen THEN 'in_kitchen'
    WHEN v_has_pending THEN 'open'
    WHEN v_has_ready THEN 'ready'
    ELSE 'open'
  END;

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

-- ─── Table status sync ────────────────────────────────────────────────────────

-- When an order status changes, auto-update the table status.
CREATE OR REPLACE FUNCTION public.sync_table_status_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active_count   INTEGER;
  v_bill_count     INTEGER;
  v_new_status     public.table_status;
BEGIN
  -- Only act when status actually changes
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Count remaining active orders on this table (excluding current order)
  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('paid', 'cancelled') AND id != NEW.id),
    COUNT(*) FILTER (WHERE status = 'ready'                    AND id != NEW.id)
  INTO v_active_count, v_bill_count
  FROM public.orders
  WHERE table_id = NEW.table_id;

  IF NEW.status IN ('paid', 'cancelled') THEN
    IF v_active_count = 0 THEN
      v_new_status := 'free';
    ELSE
      v_new_status := 'occupied';
    END IF;
  ELSIF NEW.status = 'open' AND OLD.status IN ('paid', 'cancelled', 'free') THEN
    v_new_status := 'occupied';
  ELSE
    -- No table status change needed for in_kitchen / ready transitions
    RETURN NEW;
  END IF;

  UPDATE public.restaurant_tables
  SET status = v_new_status
  WHERE id = NEW.table_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_table_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_table_status_on_order_change();

-- Also set table to occupied when a new order is inserted
CREATE OR REPLACE FUNCTION public.set_table_occupied_on_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.restaurant_tables
  SET status = 'occupied'
  WHERE id = NEW.table_id AND status = 'free';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_table_occupied
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_table_occupied_on_order_insert();

-- ─── Subscription auto-expire ─────────────────────────────────────────────────

-- Mark subscriptions as expired when queried if past expires_at.
-- This is a lazy expiry check; a scheduled job should handle bulk updates.
CREATE OR REPLACE FUNCTION public.expire_subscription_if_due()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.expires_at <= NOW() AND NEW.status IN ('active', 'trial') THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expire_subscription
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.expire_subscription_if_due();
