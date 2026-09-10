-- ==============================================================================
-- DIAMOND FINANCE PRODUCTION DATABASE SCHEMA & MIGRATION (SUPABASE POSTGRESQL)
-- ==============================================================================

-- 1. Create Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    business_name TEXT DEFAULT 'Diamond Broker',
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'super_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Helper function to check if the current authenticated user is active Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create a profile automatically when a user signs up/is created via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Staff Member'),
    'staff',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Create Dealers Table
CREATE TABLE IF NOT EXISTS public.dealers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'both' CHECK (type IN ('buyer', 'seller', 'both')),
    contact TEXT,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dealer_id TEXT REFERENCES public.dealers(id) ON DELETE RESTRICT,
    seller_id TEXT REFERENCES public.dealers(id) ON DELETE RESTRICT,
    buyer_id TEXT REFERENCES public.dealers(id) ON DELETE RESTRICT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    diamond_carat NUMERIC(10, 2) NOT NULL DEFAULT 0,
    per_carat_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    terms NUMERIC(6, 2) DEFAULT 0,
    terms_amount NUMERIC(14, 2) DEFAULT 0,
    amount_after_terms NUMERIC(14, 2) DEFAULT 0,
    cvd NUMERIC(14, 2) DEFAULT 0,
    final_net NUMERIC(14, 2) DEFAULT 0,
    due_days INTEGER DEFAULT 0,
    sell_type TEXT DEFAULT 'Self',
    other_sell_type TEXT,
    brokerage_rate NUMERIC(6, 2) DEFAULT 5,
    brokerage_earned NUMERIC(14, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Completed')),
    payment_method TEXT DEFAULT 'Bank transfer',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add new calculation columns if table was created in an earlier migration
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS terms_amount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_after_terms NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cvd NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS final_net NUMERIC(14, 2) DEFAULT 0;

-- 4. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT REFERENCES public.transactions(id) ON DELETE CASCADE,
    dealer_id TEXT REFERENCES public.dealers(id) ON DELETE RESTRICT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'Bank transfer',
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create user-owned bookkeeping entries
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

ALTER TABLE public.bookkeeping_entries
    ADD COLUMN IF NOT EXISTS dealer_id TEXT REFERENCES public.dealers(id) ON DELETE SET NULL;
ALTER TABLE public.bookkeeping_entries
    ADD COLUMN IF NOT EXISTS transaction_id TEXT REFERENCES public.transactions(id) ON DELETE SET NULL;

-- ==============================================================================
-- INDEXES FOR OPTIMAL QUERY & ANALYTICS PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_transactions_dealer ON public.transactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- ==============================================================================
-- TABLE PRIVILEGES & SECURITY GRANTS
-- ==============================================================================
-- Grant schema usage to authenticated and service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Ensure table privileges exist for authenticated role
GRANT ALL ON TABLE public.profiles TO authenticated, service_role;
GRANT ALL ON TABLE public.dealers TO authenticated, service_role;
GRANT ALL ON TABLE public.transactions TO authenticated, service_role;
GRANT ALL ON TABLE public.payments TO authenticated, service_role;
GRANT ALL ON TABLE public.bookkeeping_entries TO authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- Future tables default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;

-- Explicitly revoke sensitive finance table direct access from unauthenticated anon role
REVOKE ALL ON TABLE public.dealers FROM anon;
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.bookkeeping_entries FROM anon;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookkeeping_entries ENABLE ROW LEVEL SECURITY;

-- Drop prior policies to avoid conflicts upon re-execution
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated update profiles" ON public.profiles;

DROP POLICY IF EXISTS "dealers_select_policy" ON public.dealers;
DROP POLICY IF EXISTS "dealers_insert_policy" ON public.dealers;
DROP POLICY IF EXISTS "dealers_update_policy" ON public.dealers;
DROP POLICY IF EXISTS "dealers_delete_policy" ON public.dealers;
DROP POLICY IF EXISTS "Allow authenticated read dealers" ON public.dealers;
DROP POLICY IF EXISTS "Allow authenticated insert dealers" ON public.dealers;
DROP POLICY IF EXISTS "Allow authenticated update dealers" ON public.dealers;
DROP POLICY IF EXISTS "Allow authenticated delete dealers" ON public.dealers;

DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated delete transactions" ON public.transactions;

DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_policy" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated read payments" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated insert payments" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated update payments" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated delete payments" ON public.payments;
DROP POLICY IF EXISTS "bookkeeping_select_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_insert_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_update_policy" ON public.bookkeeping_entries;
DROP POLICY IF EXISTS "bookkeeping_delete_policy" ON public.bookkeeping_entries;

-- PROFILES Policies
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_super_admin());

CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id OR public.is_super_admin());

CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.is_super_admin())
    WITH CHECK (auth.uid() = id OR public.is_super_admin());

CREATE POLICY "profiles_delete_policy" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_super_admin());

-- DEALERS Policies (SELECT, INSERT, UPDATE, DELETE for authenticated users)
CREATE POLICY "dealers_select_policy" ON public.dealers
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "dealers_insert_policy" ON public.dealers
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "dealers_update_policy" ON public.dealers
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "dealers_delete_policy" ON public.dealers
    FOR DELETE TO authenticated
    USING (true);

-- TRANSACTIONS Policies (SELECT, INSERT, UPDATE, DELETE for authenticated users)
CREATE POLICY "transactions_select_policy" ON public.transactions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "transactions_insert_policy" ON public.transactions
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "transactions_update_policy" ON public.transactions
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "transactions_delete_policy" ON public.transactions
    FOR DELETE TO authenticated
    USING (true);

-- PAYMENTS Policies (SELECT, INSERT, UPDATE, DELETE for authenticated users)
CREATE POLICY "payments_select_policy" ON public.payments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "payments_insert_policy" ON public.payments
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "payments_update_policy" ON public.payments
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "payments_delete_policy" ON public.payments
    FOR DELETE TO authenticated
    USING (true);

-- BOOKKEEPING Policies: each authenticated user can access only their own entries
CREATE POLICY "bookkeeping_select_policy" ON public.bookkeeping_entries
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "bookkeeping_insert_policy" ON public.bookkeeping_entries
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookkeeping_update_policy" ON public.bookkeeping_entries
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookkeeping_delete_policy" ON public.bookkeeping_entries
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ==============================================================================
-- DESIGNATE EXISTING AUTH USERS AS ACTIVE SUPER ADMIN IN PROFILES
-- ==============================================================================
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'Super Admin'), 
  'super_admin', 
  'active'
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin', status = 'active';

-- ==============================================================================
-- INITIAL SEED DATA (Only ABC Diamonds & Golden Carats)
-- ==============================================================================
INSERT INTO public.dealers (id, name, location, type, contact, email, phone, status)
VALUES
  ('dealer-abc', 'ABC Diamonds', 'Mumbai, India', 'both', 'Alex Brown', 'alex@abcdiamonds.com', '+91 22 5550 0198', 'Active'),
  ('dealer-golden', 'Golden Carats', 'Delhi, India', 'both', 'Maya Shah', 'maya@goldencarats.com', '+91 11 5550 0186', 'Active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transactions (id, name, dealer_id, seller_id, buyer_id, date, diamond_carat, per_carat_rate, total_rate, amount, terms, due_days, sell_type, other_sell_type, brokerage_rate, brokerage_earned, status, payment_method, notes)
VALUES
  ('TRX-20481', 'Mumbai Lot #102', 'dealer-abc', 'dealer-abc', 'dealer-golden', '2024-09-03', 10.00, 50000.00, 500000.00, 500000.00, 2.00, 30, 'Self', '', 5.00, 25000.00, 'Completed', 'Bank transfer', 'Round brilliant diamond lot.'),
  ('TRX-20480', 'Delhi Lot #88', 'dealer-golden', 'dealer-golden', 'dealer-abc', '2024-09-02', 12.50, 80000.00, 1000000.00, 1000000.00, 2.50, 45, 'Other', 'Wholesale', 5.00, 50000.00, 'Pending', 'Bank transfer', 'Fancy cut diamond parcel.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, transaction_id, dealer_id, date, amount, method, status)
VALUES
  ('PAY-8300', 'TRX-20481', 'dealer-abc', '2024-09-03', 500000.00, 'Bank transfer', 'Completed'),
  ('PAY-8301', 'TRX-20480', 'dealer-golden', '2024-09-02', 1000000.00, 'Bank transfer', 'Pending')
ON CONFLICT (id) DO NOTHING;

