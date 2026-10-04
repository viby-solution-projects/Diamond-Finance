-- ==============================================================================
-- DIAMOND FINANCE — OPEN WORKSPACE ANONYMOUS ACCESS MIGRATION
-- Migration File: supabase/migrations/20261004_anonymous_open_access.sql
-- Target: Existing Production Supabase Database
--
-- CONTEXT:
-- Diamond Finance no longer uses authentication. The application opens
-- directly to the Dashboard for every visitor (no login, no signup,
-- no session). All business tables therefore accept anonymous (anon)
-- access through the public Supabase anon key.
--
-- SAFETY GUARANTEES:
-- 1. Row Level Security REMAINS ENABLED on every table (never disabled).
-- 2. NO DROP TABLE / DROP COLUMN / DELETE / TRUNCATE statements.
-- 3. NO existing data is modified, overwritten, or deleted.
-- 4. NO existing authenticated-role policies are dropped or weakened.
-- 5. The public.profiles table is intentionally NOT exposed to anon:
--    account profiles stay authenticated-only.
-- 6. bookkeeping_entries.user_id and daily_expenses.user_id become
--    NULLABLE so anonymous rows can be stored without an auth.users id.
--    Existing per-user rows keep their user_id values untouched, and the
--    foreign keys to auth.users are preserved (NULL satisfies FK checks).
-- 7. All statements are idempotent and safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLS STAYS ON (explicit, idempotent)
-- ------------------------------------------------------------------------------
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookkeeping_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. SHARED BUSINESS TABLES: dealers, transactions, payments
--    These tables never had per-user isolation (policies already USING(true)
--    for authenticated). Mirror the same open policy for anon.
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO anon;

DROP POLICY IF EXISTS "dealers_anon_select_policy" ON public.dealers;
DROP POLICY IF EXISTS "dealers_anon_insert_policy" ON public.dealers;
DROP POLICY IF EXISTS "dealers_anon_update_policy" ON public.dealers;
DROP POLICY IF EXISTS "dealers_anon_delete_policy" ON public.dealers;

CREATE POLICY "dealers_anon_select_policy" ON public.dealers
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "dealers_anon_insert_policy" ON public.dealers
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "dealers_anon_update_policy" ON public.dealers
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "dealers_anon_delete_policy" ON public.dealers
    FOR DELETE TO anon
    USING (true);

DROP POLICY IF EXISTS "transactions_anon_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_anon_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_anon_update_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_anon_delete_policy" ON public.transactions;

CREATE POLICY "transactions_anon_select_policy" ON public.transactions
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "transactions_anon_insert_policy" ON public.transactions
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "transactions_anon_update_policy" ON public.transactions
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "transactions_anon_delete_policy" ON public.transactions
    FOR DELETE TO anon
    USING (true);

DROP POLICY IF EXISTS "payments_anon_select_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_anon_insert_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_anon_update_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_anon_delete_policy" ON public.payments;

CREATE POLICY "payments_anon_select_policy" ON public.payments
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "payments_anon_insert_policy" ON public.payments
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "payments_anon_update_policy" ON public.payments
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "payments_anon_delete_policy" ON public.payments
    FOR DELETE TO anon
    USING (true);

-- ------------------------------------------------------------------------------
-- 3. USER-OWNED TABLES: bookkeeping_entries, daily_expenses
--    Without authentication there is no per-user boundary; the workspace is a
--    single shared pool, consistent with dealers/transactions/payments.
--    user_id becomes nullable so anonymous rows store NULL while legacy rows
--    keep their auth.users references (FK preserved, data untouched).
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookkeeping_entries ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.daily_expenses ALTER COLUMN user_id DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookkeeping_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_expenses TO anon;

DROP POLICY IF EXISTS "bookkeeping_anon_select_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_anon_insert_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_anon_update_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_anon_delete_policy" ON public.bookkeeping_entries;

CREATE POLICY "bookkeeping_anon_select_policy" ON public.bookkeeping_entries
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "bookkeeping_anon_insert_policy" ON public.bookkeeping_entries
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "bookkeeping_anon_update_policy" ON public.bookkeeping_entries
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "bookkeeping_anon_delete_policy" ON public.bookkeeping_entries
    FOR DELETE TO anon
    USING (true);

DROP POLICY IF EXISTS "daily_expenses_anon_select_policy" ON public.daily_expenses;
DROP POLICY IF EXISTS "daily_expenses_anon_insert_policy" ON public.daily_expenses;
DROP POLICY IF EXISTS "daily_expenses_anon_update_policy" ON public.daily_expenses;
DROP POLICY IF EXISTS "daily_expenses_anon_delete_policy" ON public.daily_expenses;

CREATE POLICY "daily_expenses_anon_select_policy" ON public.daily_expenses
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "daily_expenses_anon_insert_policy" ON public.daily_expenses
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "daily_expenses_anon_update_policy" ON public.daily_expenses
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "daily_expenses_anon_delete_policy" ON public.daily_expenses
    FOR DELETE TO anon
    USING (true);

-- ------------------------------------------------------------------------------
-- 4. EXPLICITLY NOT TOUCHED (documented for review):
--    - public.profiles: RLS enabled, authenticated-only policies unchanged,
--      REVOKE ALL FROM anon still in force. The application no longer
--      reads or writes profiles.
--    - public.is_super_admin(), public.handle_new_user() trigger:
--      inert without auth usage; preserved for the existing auth users.
--    - auth.users records: not deleted, not modified.
-- ------------------------------------------------------------------------------
