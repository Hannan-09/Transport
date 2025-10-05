-- Update all tables to be user-based
-- Each user will have their own parties, transactions, expenses, and monthly closures

-- 1. Update parties table to include user_id
ALTER TABLE parties ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_parties_user_id ON parties(user_id);

-- 2. Update transactions table to include user_id
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- 3. Update expenses table to include user_id
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);

-- 4. Update monthly_closures table to include user_id
ALTER TABLE monthly_closures ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Update unique constraint to be per user
ALTER TABLE monthly_closures DROP CONSTRAINT IF EXISTS monthly_closures_month_key;
ALTER TABLE monthly_closures ADD CONSTRAINT monthly_closures_user_month_key UNIQUE (user_id, month);

-- Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_monthly_closures_user_id ON monthly_closures(user_id);

-- 5. Create RLS policies for user-based access (optional, for security)
-- Enable RLS on all tables
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closures ENABLE ROW LEVEL SECURITY;

-- Create policies to ensure users can only access their own data
-- Parties policies
DROP POLICY IF EXISTS "Users can only access their own parties" ON parties;
CREATE POLICY "Users can only access their own parties" ON parties
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Transactions policies
DROP POLICY IF EXISTS "Users can only access their own transactions" ON transactions;
CREATE POLICY "Users can only access their own transactions" ON transactions
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Expenses policies
DROP POLICY IF EXISTS "Users can only access their own expenses" ON expenses;
CREATE POLICY "Users can only access their own expenses" ON expenses
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Monthly closures policies
DROP POLICY IF EXISTS "Users can only access their own monthly closures" ON monthly_closures;
CREATE POLICY "Users can only access their own monthly closures" ON monthly_closures
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Note: Since we're using simple authentication (not Supabase auth), 
-- we'll handle user filtering in the application code instead of RLS