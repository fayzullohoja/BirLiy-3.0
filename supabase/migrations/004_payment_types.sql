-- Phase 3: Add PayMe and Click payment types
-- PostgreSQL requires each ADD VALUE to be in a separate transaction

ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'payme';
ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'click';
