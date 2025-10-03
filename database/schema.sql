-- Transport Ledger Database Schema
-- Run these SQL commands in your Supabase SQL Editor

-- Create parties table
CREATE TABLE parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('Jama', 'Udhar')),
  rounds INTEGER NOT NULL DEFAULT 1,
  running_balance DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Vehicle Repair', 'Fuel', 'Other Expenses')),
  type VARCHAR(10) NOT NULL CHECK (type IN ('Jama', 'Udhar')),
  payment_method VARCHAR(20) DEFAULT 'Cash',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_party_id ON transactions(party_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON parties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication needs)
-- For now, allowing all operations for authenticated users

-- Parties policies
CREATE POLICY "Enable all operations for parties" ON parties
    FOR ALL USING (true);

-- Transactions policies
CREATE POLICY "Enable all operations for transactions" ON transactions
    FOR ALL USING (true);

-- Expenses policies
CREATE POLICY "Enable all operations for expenses" ON expenses
    FOR ALL USING (true);

-- Insert some sample data (optional)
INSERT INTO parties (name, phone_number, address) VALUES
('Ahmed Transport Services', '+1234567890', '123 Main St, City'),
('Rana Goods Carrier', '+1234567891', '456 Oak Ave, Town'),
('Khan Logistics Pvt. Ltd.', '+1234567892', '789 Pine Rd, Village');

INSERT INTO expenses (date, amount, category, type, payment_method) VALUES
('2023-10-27', 50.00, 'Fuel', 'Udhar', 'Cash'),
('2023-10-24', 45.00, 'Fuel', 'Udhar', 'Online'),
('2023-10-26', 150.00, 'Vehicle Repair', 'Udhar', 'Online'),
('2023-10-25', 25.00, 'Other Expenses', 'Udhar', 'Cash');