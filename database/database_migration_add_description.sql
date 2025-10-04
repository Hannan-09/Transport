-- Add description column to transactions table
ALTER TABLE transactions 
ADD COLUMN description TEXT DEFAULT '';

-- Update existing transactions to have empty description
UPDATE transactions 
SET description = '' 
WHERE description IS NULL;

-- Add comment to the column
COMMENT ON COLUMN transactions.description IS 'Optional description for the transaction';