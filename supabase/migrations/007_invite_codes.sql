-- ============================================================
-- BirLiy Kassa — Migration 007: Shop Invite Codes
-- Adds a short unique invite code to each shop so staff can
-- self-join by entering the code in the app.
-- ============================================================

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- Unique constraint (partial — only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS shops_invite_code_uidx
  ON public.shops (invite_code)
  WHERE invite_code IS NOT NULL;

-- Fast lookup index for join-by-code flow
CREATE INDEX IF NOT EXISTS shops_invite_code_idx
  ON public.shops (invite_code)
  WHERE invite_code IS NOT NULL;
