UPDATE public.users u
SET role = 'unauthorized'
WHERE u.role <> 'super_admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.shop_users su
    WHERE su.user_id = u.id
  );
