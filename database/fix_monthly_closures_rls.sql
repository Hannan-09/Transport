-- Fix RLS policies for monthly_closures table

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON monthly_closures;

-- Disable RLS temporarily to test
ALTER TABLE monthly_closures DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, create a permissive policy
-- ALTER TABLE monthly_closures ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON monthly_closures FOR ALL USING (true) WITH CHECK (true);

-- Check if the table structure is correct
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'monthly_closures' 
ORDER BY ordinal_position;