-- Add kitchen role to platform and shop membership enums
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'kitchen';
ALTER TYPE public.shop_user_role ADD VALUE IF NOT EXISTS 'kitchen';
