# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login to your account
3. Click "New Project"
4. Fill in your project details:
   - Name: Transport Ledger
   - Database Password: (choose a strong password)
   - Region: (select closest to your location)
5. Click "Create new project"

## 2. Get Your Project Credentials

After your project is created:

1. Go to **Settings** → **API**
2. Copy your **Project URL** and **anon public** key
3. Update the credentials in `lib/supabaseClient.js`:

```javascript
const supabaseUrl = "https://your-project-id.supabase.co";
const supabaseAnonKey = "your-anon-key-here";
```

## 3. Set Up Database Tables

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `database/schema.sql`
3. Click "Run" to create all tables and relationships

## 4. Configure Row Level Security (Optional)

The schema includes basic RLS policies. You can modify them based on your authentication needs:

- **Public Access**: Current setup allows all operations
- **Authenticated Only**: Modify policies to require authentication
- **User-specific**: Add user-based filtering if needed

## 5. Test Your Connection

You can test your Supabase connection by:

1. Import the client in any component:

```javascript
import { supabase } from "../lib/supabase";
```

2. Test a simple query:

```javascript
const testConnection = async () => {
  const { data, error } = await supabase.from("parties").select("*");
  console.log("Parties:", data);
};
```

## 6. Database Structure

### Tables Created:

- **parties**: Store transport party information

  - id, name, phone_number, address, created_at, updated_at

- **transactions**: Store ledger transactions

  - id, party_id, date, amount, type, rounds, running_balance, created_at, updated_at

- **expenses**: Store expense records
  - id, date, amount, category, type, payment_method, description, created_at, updated_at

## 7. API Helper Functions

The `lib/supabase.js` file includes pre-built helper functions:

- `partiesAPI`: CRUD operations for parties
- `transactionsAPI`: CRUD operations for transactions
- `expensesAPI`: CRUD operations for expenses
- `dashboardAPI`: Summary and dashboard data

## 8. Usage Examples

### Add a new party:

```javascript
import { partiesAPI } from "../lib/supabase";

const addParty = async () => {
  try {
    const newParty = await partiesAPI.create({
      name: "New Transport Co.",
      phone_number: "+1234567890",
      address: "123 Street, City",
    });
    console.log("Party added:", newParty);
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### Get expenses by category:

```javascript
import { expensesAPI } from "../lib/supabase";

const getFuelExpenses = async () => {
  try {
    const expenses = await expensesAPI.getByCategory("Fuel");
    console.log("Fuel expenses:", expenses);
  } catch (error) {
    console.error("Error:", error);
  }
};
```

## 9. Environment Variables (Recommended)

For production, store your credentials in environment variables:

1. Create `.env.local` file:

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. Update `lib/supabaseClient.js`:

```javascript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
```

## 10. Next Steps

1. Replace placeholder credentials with your actual Supabase project details
2. Run the SQL schema in your Supabase dashboard
3. Test the connection
4. Start integrating the API calls into your React Native components
5. Replace static data with dynamic Supabase queries

Your Supabase backend is now ready for your Transport Ledger app!
