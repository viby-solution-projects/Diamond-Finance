-- ==============================================================================
-- SAFE PRODUCTION RESET SCRIPT: DELETE DEMO DATA IN DEPENDENCY ORDER
-- Migration File: supabase/migrations/20260910_reset_demo_data.sql
-- ==============================================================================
-- Deletes only the confirmed legacy demo records from Supabase.
-- Safe dependency order: 1. payments -> 2. transactions -> 3. dealers
--
-- PRESERVED TABLES & SECURITY:
-- - auth.users (NOT touched)
-- - public.profiles (NOT touched)
-- - public.bookkeeping_entries (NOT touched)
-- - public.daily_expenses (NOT touched)
-- - RLS policies & permissions (NOT touched)
-- ==============================================================================

-- 1. Delete Payments (Child of Transactions & Dealers)
DELETE FROM public.payments
WHERE id IN ('PAY-8300', 'PAY-8301')
   OR transaction_id IN ('TRX-20481', 'TRX-20480')
   OR dealer_id IN ('dealer-abc', 'dealer-golden');

-- 2. Delete Transactions (Child of Dealers)
DELETE FROM public.transactions
WHERE id IN ('TRX-20481', 'TRX-20480')
   OR dealer_id IN ('dealer-abc', 'dealer-golden')
   OR seller_id IN ('dealer-abc', 'dealer-golden')
   OR buyer_id IN ('dealer-abc', 'dealer-golden');

-- 3. Delete Dealers (Parent table)
DELETE FROM public.dealers
WHERE id IN ('dealer-abc', 'dealer-golden');

-- ==============================================================================
-- VERIFICATION QUERIES (Confirm the known demo records are gone)
-- ==============================================================================
SELECT 'payments' AS table_name, COUNT(*) AS remaining_rows FROM public.payments
UNION ALL
SELECT 'transactions' AS table_name, COUNT(*) AS remaining_rows FROM public.transactions
UNION ALL
SELECT 'dealers' AS table_name, COUNT(*) AS remaining_rows FROM public.dealers;
