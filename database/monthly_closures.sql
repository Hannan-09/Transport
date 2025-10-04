-- Create monthly_closures table
CREATE TABLE IF NOT EXISTS monthly_closures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month VARCHAR(7) NOT NULL UNIQUE, -- Format: YYYY-MM
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_jama DECIMAL(10,2) DEFAULT 0,
    total_udhar DECIMAL(10,2) DEFAULT 0,
    total_expenses DECIMAL(10,2) DEFAULT 0,
    net_balance DECIMAL(10,2) DEFAULT 0,
    transactions_count INTEGER DEFAULT 0,
    expenses_count INTEGER DEFAULT 0,
    parties_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on month for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_closures_month ON monthly_closures(month);

-- Create RLS policies
ALTER TABLE monthly_closures ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all operations for authenticated users" ON monthly_closures
    FOR ALL USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monthly_closures_updated_at 
    BEFORE UPDATE ON monthly_closures 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();