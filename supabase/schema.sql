-- ==============================================================================
-- DIAMOND FINANCE PRODUCTION DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- ==============================================================================

-- 1. Create Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    business_name TEXT DEFAULT 'Diamond Broker',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to create a profile automatically when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', 'Jordan Davis'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on every application data table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Strict Authenticated Access Policies (Unauthenticated access is prevented)

-- Profiles
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow authenticated update profiles" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Dealers
CREATE POLICY "Allow authenticated read dealers" ON public.dealers
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert dealers" ON public.dealers
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update dealers" ON public.dealers
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete dealers" ON public.dealers
    FOR DELETE TO authenticated USING (true);

-- Transactions
CREATE POLICY "Allow authenticated read transactions" ON public.transactions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert transactions" ON public.transactions
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update transactions" ON public.transactions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete transactions" ON public.transactions
    FOR DELETE TO authenticated USING (true);

-- Payments
CREATE POLICY "Allow authenticated read payments" ON public.payments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert payments" ON public.payments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update payments" ON public.payments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete payments" ON public.payments
    FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INDEXES FOR OPTIMAL QUERY & ANALYTICS PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_transactions_dealer ON public.transactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON public.transactions(buyer_id);

-- ==============================================================================
-- OPTIONAL INITIAL SEED DATA
-- ==============================================================================
INSERT INTO public.dealers (id, name, location, type, contact, email, phone, status)
VALUES 
    ('dealer-abc', 'ABC Diamonds', 'Mumbai, India', 'both', 'Alex Brown', 'alex@abcdiamonds.com', '+91 22 5550 0198', 'Active'),
    ('dealer-golden', 'Golden Carats', 'Delhi, India', 'both', 'Maya Shah', 'maya@goldencarats.com', '+91 11 5550 0186', 'Active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transactions (id, name, dealer_id, seller_id, buyer_id, date, diamond_carat, per_carat_rate, total_rate, amount, terms, due_days, sell_type, other_sell_type, brokerage_rate, brokerage_earned, status, payment_method, notes)
VALUES 
    ('TRX-20481', 'Mumbai Lot #102', 'dealer-abc', 'dealer-abc', 'dealer-golden', '2024-09-03', 10, 50000, 500000, 500000, 2, 30, 'Self', '', 5, 25000, 'Completed', 'Bank transfer', 'Round brilliant diamond lot.'),
    ('TRX-20480', 'Delhi Lot #88', 'dealer-golden', 'dealer-golden', 'dealer-abc', '2024-09-02', 12.5, 80000, 1000000, 1000000, 2.5, 45, 'Other', 'Wholesale', 5, 50000, 'Pending', 'Bank transfer', 'Fancy cut diamond parcel.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, transaction_id, dealer_id, date, amount, method, status)
VALUES 
    ('PAY-8300', 'TRX-20481', 'dealer-abc', '2024-09-03', 500000, 'Bank transfer', 'Completed'),
    ('PAY-8301', 'TRX-20480', 'dealer-golden', '2024-09-02', 1000000, 'Bank transfer', 'Pending')
ON CONFLICT (id) DO NOTHING;
