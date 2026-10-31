-- =========================================================================
-- AK ENTERPRISES: ADD ZONAL ADMIN USERNAME FIELD & CONSTRAINTS
-- Safe additive migration for username support across users and vendors
-- =========================================================================

-- 1. Add username column to public.users table if not exists
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Add username column to public.vendors table if not exists
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS username TEXT;

-- 3. Case-insensitive Unique Index for usernames across users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique 
ON public.users (LOWER(username)) 
WHERE username IS NOT NULL;

-- 4. Case-insensitive Index for vendor usernames
CREATE INDEX IF NOT EXISTS idx_vendors_username_lower 
ON public.vendors (LOWER(username)) 
WHERE username IS NOT NULL;

-- 5. Backfill existing vendor usernames from email handle if null
-- e.g. 'abcd123@gmail.com' -> 'abcd123' (safe fallback if no collision)
UPDATE public.users 
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'))
WHERE username IS NULL AND role = 'vendor';

UPDATE public.vendors v
SET username = u.username
FROM public.users u
WHERE v.user_id = u.id AND v.username IS NULL AND u.username IS NOT NULL;
