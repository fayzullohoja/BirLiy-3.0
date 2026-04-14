-- ============================================================
-- BirLiy Kassa — Migration 011: User profile language
-- Adds persisted UI language preference for mini app profile.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'ru';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_preferred_language_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_preferred_language_check
  CHECK (preferred_language IN ('ru', 'uz'));

UPDATE public.users
SET preferred_language = 'ru'
WHERE preferred_language IS NULL
   OR preferred_language NOT IN ('ru', 'uz');
