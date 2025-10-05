-- RLS Policy for monthly_closures table
-- This will allow inserts and updates with user_id

-- First, check if RLS is enabled on the table
-- If you need to disable RLS entirely, uncomment the next line:
-- ALTER TABLE monthly_closures DISABLE ROW LEVEL SECURITY;

-- Or, create policies to allow operations with user_id:

-- Drop existing policies if they exist (optional)
DROP POLICY IF EXISTS "monthly_closures_insert_policy" ON monthly_closures;
DROP POLICY IF EXISTS "monthly_closures_update_policy" ON monthly_closures;
DROP POLICY IF EXISTS "monthly_closures_select_policy" ON monthly_closures;
DROP POLICY IF EXISTS "monthly_closures_delete_policy" ON monthly_closures;

-- Create INSERT policy - allows inserting records with any user_id
CREATE POLICY "monthly_closures_insert_policy" 
ON monthly_closures 
FOR INSERT 
WITH CHECK (true);

-- Create UPDATE policy - allows updating records with any user_id
CREATE POLICY "monthly_closures_update_policy" 
ON monthly_closures 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- Create SELECT policy - allows reading all records
CREATE POLICY "monthly_closures_select_policy" 
ON monthly_closures 
FOR SELECT 
USING (true);

-- Create DELETE policy - allows deleting records (optional)
CREATE POLICY "monthly_closures_delete_policy" 
ON monthly_closures 
FOR DELETE 
USING (true);

-- Alternative: If you want to restrict access to specific user_ids only
-- Uncomment the following policies and comment out the ones above:

/*
-- INSERT policy - only allow inserts with valid user_id
CREATE POLICY "monthly_closures_insert_policy" 
ON monthly_closures 
FOR INSERT 
WITH CHECK (user_id IS NOT NULL);

-- UPDATE policy - only allow updates with valid user_id
CREATE POLICY "monthly_closures_update_policy" 
ON monthly_closures 
FOR UPDATE 
USING (user_id IS NOT NULL) 
WITH CHECK (user_id IS NOT NULL);

-- SELECT policy - only show records for the authenticated user
CREATE POLICY "monthly_closures_select_policy" 
ON monthly_closures 
FOR SELECT 
USING (user_id = auth.uid() OR user_id IS NULL);
*/

-- Alternative: If you want to completely disable RLS for this table
-- Uncomment the next line:
-- ALTER TABLE monthly_closures DISABLE ROW LEVEL SECURITY;

-- Ensure RLS is enabled (if you're using policies)
ALTER TABLE monthly_closures ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT ALL ON monthly_closures TO authenticated;
GRANT ALL ON monthly_closures TO anon;

-- If you have a service_role, grant permissions to it as well
-- GRANT ALL ON monthly_closures TO service_role;