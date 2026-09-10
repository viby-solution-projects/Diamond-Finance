-- ==============================================================================
-- ONE-TIME DESTRUCTIVE PRODUCTION RESET
-- ===============================================================================
-- PURPOSE:
--   Empty all current business data so production starts clean for real clients.
--
-- IMPORTANT:
--   Execute this file manually in the Supabase SQL Editor only after reviewing it.
--   This script is intentionally destructive and must not be called by the app.
--
-- PRESERVED:
--   - auth.users
--   - public.profiles
--   - all tables, columns, indexes, and RLS policies
--
-- FK order confirmed from the schema:
--   daily_expenses -> auth.users only
--   bookkeeping_entries -> dealers/transactions with ON DELETE SET NULL
--   payments -> transactions/dealers
--   transactions -> dealers
-- ===============================================================================

BEGIN;

-- Independent user-owned business records.
DELETE FROM public.daily_expenses;

-- Delete linked bookkeeping records before their referenced business records.
DELETE FROM public.bookkeeping_entries;

-- Delete children before transactions and dealers.
DELETE FROM public.payments;
DELETE FROM public.transactions;
DELETE FROM public.dealers;

COMMIT;

-- Verification: every business table must return zero rows.
SELECT 'dealers' AS table_name, COUNT(*) AS remaining_rows FROM public.dealers
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'bookkeeping_entries', COUNT(*) FROM public.bookkeeping_entries
UNION ALL
SELECT 'daily_expenses', COUNT(*) FROM public.daily_expenses;
