-- ============================================================
-- BirLiy Kassa — Migration 008: manager role and onboarding
-- Adds:
--   - manager shop role
--   - role-based invite codes
--   - owner application queue
-- ============================================================

ALTER TYPE public.shop_user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'manager';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'owner_application_status'
  ) THEN
    CREATE TYPE public.owner_application_status AS ENUM ('pending', 'contacted', 'approved', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.shop_invite_codes (
  id          UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID                  NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  role        public.shop_user_role NOT NULL,
  code        TEXT                  NOT NULL,
  is_active   BOOLEAN               NOT NULL DEFAULT TRUE,
  created_by  UUID                  REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by  UUID                  REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  CONSTRAINT shop_invite_codes_code_format CHECK (code ~ '^[0-9]{8}$'),
  CONSTRAINT shop_invite_codes_role_scope CHECK (role::text IN ('manager', 'waiter', 'kitchen'))
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_invite_codes_code_uidx
  ON public.shop_invite_codes (code);

CREATE UNIQUE INDEX IF NOT EXISTS shop_invite_codes_active_role_uidx
  ON public.shop_invite_codes (shop_id, role)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS shop_invite_codes_shop_idx
  ON public.shop_invite_codes (shop_id, role, created_at DESC);

DROP TRIGGER IF EXISTS trg_shop_invite_codes_updated_at ON public.shop_invite_codes;
CREATE TRIGGER trg_shop_invite_codes_updated_at
  BEFORE UPDATE ON public.shop_invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.shop_invite_codes (shop_id, role, code, is_active)
SELECT s.id, 'waiter'::public.shop_user_role, s.invite_code, TRUE
FROM public.shops s
WHERE s.invite_code IS NOT NULL
  AND s.invite_code ~ '^[0-9]{8}$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.shop_invite_codes sic
    WHERE sic.shop_id = s.id
      AND sic.role = 'waiter'
      AND sic.is_active = TRUE
  )
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.owner_applications (
  id               UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id UUID                            REFERENCES public.users(id) ON DELETE SET NULL,
  telegram_id      BIGINT                          NOT NULL,
  applicant_name   TEXT                            NOT NULL CHECK (char_length(applicant_name) BETWEEN 1 AND 120),
  restaurant_name  TEXT                            NOT NULL CHECK (char_length(restaurant_name) BETWEEN 1 AND 160),
  phone            TEXT                            NOT NULL CHECK (char_length(phone) BETWEEN 3 AND 40),
  status           public.owner_application_status NOT NULL DEFAULT 'pending',
  note             TEXT,
  reviewed_by      UUID                            REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ                     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS owner_applications_status_idx
  ON public.owner_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS owner_applications_created_at_idx
  ON public.owner_applications (created_at DESC);

DROP TRIGGER IF EXISTS trg_owner_applications_updated_at ON public.owner_applications;
CREATE TRIGGER trg_owner_applications_updated_at
  BEFORE UPDATE ON public.owner_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shop_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_invite_codes_read_manageable ON public.shop_invite_codes;
CREATE POLICY shop_invite_codes_read_manageable ON public.shop_invite_codes
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.shop_users su
      WHERE su.user_id = auth.uid()
        AND su.shop_id = shop_id
        AND su.role::text IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS shop_invite_codes_insert_manageable ON public.shop_invite_codes;
CREATE POLICY shop_invite_codes_insert_manageable ON public.shop_invite_codes
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.shop_users su
      WHERE su.user_id = auth.uid()
        AND su.shop_id = shop_id
        AND (
          (su.role::text = 'owner' AND role::text IN ('manager', 'waiter', 'kitchen'))
          OR (su.role::text = 'manager' AND role::text IN ('waiter', 'kitchen'))
        )
    )
  );

DROP POLICY IF EXISTS shop_invite_codes_update_manageable ON public.shop_invite_codes;
CREATE POLICY shop_invite_codes_update_manageable ON public.shop_invite_codes
  FOR UPDATE USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.shop_users su
      WHERE su.user_id = auth.uid()
        AND su.shop_id = shop_id
        AND (
          (su.role::text = 'owner' AND role::text IN ('manager', 'waiter', 'kitchen'))
          OR (su.role::text = 'manager' AND role::text IN ('waiter', 'kitchen'))
        )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.shop_users su
      WHERE su.user_id = auth.uid()
        AND su.shop_id = shop_id
        AND (
          (su.role::text = 'owner' AND role::text IN ('manager', 'waiter', 'kitchen'))
          OR (su.role::text = 'manager' AND role::text IN ('waiter', 'kitchen'))
        )
    )
  );

DROP POLICY IF EXISTS shop_invite_codes_delete_manageable ON public.shop_invite_codes;
CREATE POLICY shop_invite_codes_delete_manageable ON public.shop_invite_codes
  FOR DELETE USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.shop_users su
      WHERE su.user_id = auth.uid()
        AND su.shop_id = shop_id
        AND (
          (su.role::text = 'owner' AND role::text IN ('manager', 'waiter', 'kitchen'))
          OR (su.role::text = 'manager' AND role::text IN ('waiter', 'kitchen'))
        )
    )
  );

DROP POLICY IF EXISTS owner_applications_insert_self ON public.owner_applications;
CREATE POLICY owner_applications_insert_self ON public.owner_applications
  FOR INSERT WITH CHECK (telegram_user_id = auth.uid());

DROP POLICY IF EXISTS owner_applications_read_self_or_admin ON public.owner_applications;
CREATE POLICY owner_applications_read_self_or_admin ON public.owner_applications
  FOR SELECT USING (
    telegram_user_id = auth.uid() OR public.is_super_admin()
  );

DROP POLICY IF EXISTS owner_applications_update_admin ON public.owner_applications;
CREATE POLICY owner_applications_update_admin ON public.owner_applications
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
