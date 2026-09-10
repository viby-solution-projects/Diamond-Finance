-- ==============================================================================
-- DAILY FINANCE / EXPENSE TRACKER TABLE AND RLS POLICIES
-- ==============================================================================

-- 1. Create daily_expenses table
CREATE TABLE IF NOT EXISTS public.daily_expenses (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create performance indexes for date and category queries
CREATE INDEX IF NOT EXISTS idx_daily_expenses_user_id ON public.daily_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_expenses_date ON public.daily_expenses(date);
CREATE INDEX IF NOT EXISTS idx_daily_expenses_category ON public.daily_expenses(category);

-- 3. Grant schema permissions to authenticated users and service role
GRANT ALL ON TABLE public.daily_expenses TO authenticated, service_role;
REVOKE ALL ON TABLE public.daily_expenses FROM anon;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies for authenticated user isolation
DROP POLICY IF EXISTS "daily_expenses_select_policy" ON public.daily_expenses;
DROP POLICY IF EXISTS "daily_expenses_insert_policy" ON public.daily_expenses;
DROP POLICY IF EXISTS "daily_expenses_update_policy" ON public.daily_expenses;
DROP POLICY IF EXISTS "daily_expenses_delete_policy" ON public.daily_expenses;

CREATE POLICY "daily_expenses_select_policy" ON public.daily_expenses
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "daily_expenses_insert_policy" ON public.daily_expenses
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_expenses_update_policy" ON public.daily_expenses
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_expenses_delete_policy" ON public.daily_expenses
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
