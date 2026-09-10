-- ==============================================================================
-- SAFE, IDEMPOTENT PRODUCTION MIGRATION PATCH
-- Migration File: supabase/migrations/20260910_safe_production_patch.sql
-- Target: Existing Production Supabase Database
--
-- GUARANTEES:
-- 1. NO DROP TABLE statements.
-- 2. NO DROP COLUMN statements.
-- 3. NO DELETE / TRUNCATE statements.
-- 4. NO existing data is overwritten or deleted.
-- 5. Existing RLS policies on dealers/transactions/payments are NOT dropped or weakened.
-- 6. All schema changes use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- 7. Bookkeeping is strictly user-isolated with auth.uid() = user_id.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TRANSACTIONS: Add missing calculated columns required by the application
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS terms_amount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_after_terms NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cvd NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS final_net NUMERIC(14, 2) DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 2. PAYMENTS: Add notes column required by the application
-- ------------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- ------------------------------------------------------------------------------
-- 3. BOOKKEEPING_ENTRIES: Create table if not present, and ensure required columns
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookkeeping_entries (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dealer_id TEXT REFERENCES public.dealers(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES public.transactions(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('Income', 'Expense')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was created in an earlier partial migration
ALTER TABLE public.bookkeeping_entries ADD COLUMN IF NOT EXISTS dealer_id TEXT REFERENCES public.dealers(id) ON DELETE SET NULL;
ALTER TABLE public.bookkeeping_entries ADD COLUMN IF NOT EXISTS transaction_id TEXT REFERENCES public.transactions(id) ON DELETE SET NULL;
ALTER TABLE public.bookkeeping_entries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bookkeeping_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES (Created IF NOT EXISTS)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_dealer ON public.transactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_dealer_id ON public.payments(dealer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);

CREATE INDEX IF NOT EXISTS idx_bookkeeping_user_id ON public.bookkeeping_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_bookkeeping_date ON public.bookkeeping_entries(date);
CREATE INDEX IF NOT EXISTS idx_bookkeeping_dealer_id ON public.bookkeeping_entries(dealer_id);
CREATE INDEX IF NOT EXISTS idx_bookkeeping_transaction_id ON public.bookkeeping_entries(transaction_id);

-- ------------------------------------------------------------------------------
-- 5. TABLE PERMISSIONS
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.bookkeeping_entries TO authenticated, service_role;
REVOKE ALL ON TABLE public.bookkeeping_entries FROM anon;

-- ------------------------------------------------------------------------------
-- 6. STRICT USER-ISOLATED RLS FOR BOOKKEEPING
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookkeeping_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookkeeping_select_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_insert_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_update_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_delete_policy" ON public.bookkeeping_entries;

CREATE POLICY "bookkeeping_select_policy" ON public.bookkeeping_entries 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "bookkeeping_insert_policy" ON public.bookkeeping_entries 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookkeeping_update_policy" ON public.bookkeeping_entries 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookkeeping_delete_policy" ON public.bookkeeping_entries 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
