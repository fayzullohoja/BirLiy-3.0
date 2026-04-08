-- ============================================================
-- BirLiy Kassa — Migration 003: Row Level Security
-- Must run after 001_schema.sql and 002_functions.sql
-- ============================================================
-- Architecture note:
--   All server-to-server API calls use the SERVICE ROLE key which
--   bypasses RLS. These policies are enforced when:
--     (a) Future client-side Supabase access uses user JWT tokens
--     (b) Supabase Studio / direct DB access by developers
--     (c) Any code that explicitly uses the user-scoped client
--
--   Policy naming convention:
--     "{table}_{actor}_{action}"  e.g. "orders_waiter_select"
-- ============================================================

-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_bookings    ENABLE ROW LEVEL SECURITY;

-- ─── users ───────────────────────────────────────────────────────────────────

-- Everyone can read their own row
CREATE POLICY users_read_own ON public.users
  FOR SELECT USING (id = auth.uid());

-- Super-admin can read all users
CREATE POLICY users_super_admin_all ON public.users
  FOR ALL USING (public.is_super_admin());

-- Users can update their own name/username (not role)
CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (role = (SELECT role FROM public.users WHERE id = auth.uid()));

-- ─── shops ───────────────────────────────────────────────────────────────────

-- Members can read their own shops
CREATE POLICY shops_member_read ON public.shops
  FOR SELECT USING (public.i_belong_to_shop(id));

-- Super-admin full access
CREATE POLICY shops_super_admin_all ON public.shops
  FOR ALL USING (public.is_super_admin());

-- Owner can update their own shop details
CREATE POLICY shops_owner_update ON public.shops
  FOR UPDATE USING (public.i_own_shop(id));

-- ─── shop_users ──────────────────────────────────────────────────────────────

-- Members can see who else is in their shops
CREATE POLICY shop_users_member_read ON public.shop_users
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- Owner can manage (add/remove) staff in their shops
CREATE POLICY shop_users_owner_insert ON public.shop_users
  FOR INSERT WITH CHECK (public.i_own_shop(shop_id));

CREATE POLICY shop_users_owner_delete ON public.shop_users
  FOR DELETE USING (
    public.i_own_shop(shop_id)
    -- Owner cannot remove themselves (handled in app layer)
    AND user_id != auth.uid()
  );

-- Super-admin full access
CREATE POLICY shop_users_super_admin_all ON public.shop_users
  FOR ALL USING (public.is_super_admin());

-- ─── subscriptions ───────────────────────────────────────────────────────────

-- Members can read their shop's subscription (to check access)
CREATE POLICY subscriptions_member_read ON public.subscriptions
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- Only super_admin can create or modify subscriptions
CREATE POLICY subscriptions_super_admin_all ON public.subscriptions
  FOR ALL USING (public.is_super_admin());

-- ─── restaurant_tables ───────────────────────────────────────────────────────

-- All shop members can read tables
CREATE POLICY restaurant_tables_member_read ON public.restaurant_tables
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- All shop members can update table status (waiter changes occupied/free etc.)
CREATE POLICY restaurant_tables_member_update ON public.restaurant_tables
  FOR UPDATE USING (public.i_belong_to_shop(shop_id))
  WITH CHECK (public.i_belong_to_shop(shop_id));

-- Only owner can create/delete tables
CREATE POLICY restaurant_tables_owner_insert ON public.restaurant_tables
  FOR INSERT WITH CHECK (public.i_own_shop(shop_id));

CREATE POLICY restaurant_tables_owner_delete ON public.restaurant_tables
  FOR DELETE USING (public.i_own_shop(shop_id));

-- Super-admin full access
CREATE POLICY restaurant_tables_super_admin_all ON public.restaurant_tables
  FOR ALL USING (public.is_super_admin());

-- ─── menu_categories ──────────────────────────────────────────────────────────

-- All shop members can read categories
CREATE POLICY menu_categories_member_read ON public.menu_categories
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- Only owner can manage categories
CREATE POLICY menu_categories_owner_write ON public.menu_categories
  FOR INSERT WITH CHECK (public.i_own_shop(shop_id));

CREATE POLICY menu_categories_owner_update ON public.menu_categories
  FOR UPDATE USING (public.i_own_shop(shop_id));

CREATE POLICY menu_categories_owner_delete ON public.menu_categories
  FOR DELETE USING (public.i_own_shop(shop_id));

CREATE POLICY menu_categories_super_admin_all ON public.menu_categories
  FOR ALL USING (public.is_super_admin());

-- ─── menu_items ───────────────────────────────────────────────────────────────

-- All shop members can read menu items
CREATE POLICY menu_items_member_read ON public.menu_items
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- Only owner can create, update, delete items
CREATE POLICY menu_items_owner_insert ON public.menu_items
  FOR INSERT WITH CHECK (public.i_own_shop(shop_id));

CREATE POLICY menu_items_owner_update ON public.menu_items
  FOR UPDATE USING (public.i_own_shop(shop_id));

CREATE POLICY menu_items_owner_delete ON public.menu_items
  FOR DELETE USING (public.i_own_shop(shop_id));

CREATE POLICY menu_items_super_admin_all ON public.menu_items
  FOR ALL USING (public.is_super_admin());

-- ─── orders ───────────────────────────────────────────────────────────────────

-- All shop members can read orders
CREATE POLICY orders_member_read ON public.orders
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- Waiters can only create orders for their own shop
CREATE POLICY orders_waiter_insert ON public.orders
  FOR INSERT WITH CHECK (
    public.i_belong_to_shop(shop_id)
    AND waiter_id = auth.uid()
  );

-- Waiters can update status of orders they created; owners can update any order
CREATE POLICY orders_waiter_update_own ON public.orders
  FOR UPDATE USING (
    public.i_belong_to_shop(shop_id)
    AND (
      waiter_id = auth.uid()
      OR public.i_own_shop(shop_id)
    )
  );

-- Only owner can delete/cancel orders (soft delete via status is preferred)
CREATE POLICY orders_owner_delete ON public.orders
  FOR DELETE USING (public.i_own_shop(shop_id));

CREATE POLICY orders_super_admin_all ON public.orders
  FOR ALL USING (public.is_super_admin());

-- ─── order_items ──────────────────────────────────────────────────────────────

-- Access order_items through the parent order's shop
CREATE POLICY order_items_member_read ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND public.i_belong_to_shop(o.shop_id)
    )
  );

-- Waiters can insert items to orders they own in their shop
CREATE POLICY order_items_waiter_insert ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND public.i_belong_to_shop(o.shop_id)
        AND o.status NOT IN ('paid', 'cancelled')
        AND (o.waiter_id = auth.uid() OR public.i_own_shop(o.shop_id))
    )
  );

-- Same actors can update/delete items (before order is closed)
CREATE POLICY order_items_actor_update ON public.order_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND public.i_belong_to_shop(o.shop_id)
        AND o.status NOT IN ('paid', 'cancelled')
        AND (o.waiter_id = auth.uid() OR public.i_own_shop(o.shop_id))
    )
  );

CREATE POLICY order_items_actor_delete ON public.order_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND public.i_belong_to_shop(o.shop_id)
        AND o.status NOT IN ('paid', 'cancelled')
        AND (o.waiter_id = auth.uid() OR public.i_own_shop(o.shop_id))
    )
  );

CREATE POLICY order_items_super_admin_all ON public.order_items
  FOR ALL USING (public.is_super_admin());

-- ─── table_bookings ───────────────────────────────────────────────────────────

-- All members can read bookings for their shop
CREATE POLICY table_bookings_member_read ON public.table_bookings
  FOR SELECT USING (public.i_belong_to_shop(shop_id));

-- All members can create bookings
CREATE POLICY table_bookings_member_insert ON public.table_bookings
  FOR INSERT WITH CHECK (
    public.i_belong_to_shop(shop_id)
    AND booked_by = auth.uid()
  );

-- Booking creator or owner can update
CREATE POLICY table_bookings_actor_update ON public.table_bookings
  FOR UPDATE USING (
    public.i_belong_to_shop(shop_id)
    AND (booked_by = auth.uid() OR public.i_own_shop(shop_id))
  );

-- Only owner can delete bookings
CREATE POLICY table_bookings_owner_delete ON public.table_bookings
  FOR DELETE USING (public.i_own_shop(shop_id));

CREATE POLICY table_bookings_super_admin_all ON public.table_bookings
  FOR ALL USING (public.is_super_admin());
