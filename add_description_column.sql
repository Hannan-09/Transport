-- Run this SQL in your Supabase SQL Editor to add description column

-- Add description column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Update existing transactions to have empty description  
UPDATE transactions 
SET description = '' 
WHERE description IS NULL;