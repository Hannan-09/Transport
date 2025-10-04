# Setup Monthly Closures Feature

## Database Setup Required

To enable the "Close Month" functionality, you need to create the `monthly_closures` table in your Supabase database.

### Steps:

1. **Open Supabase Dashboard**

   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Run the SQL Script**

   - Copy the contents of `database/monthly_closures.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

3. **Verify Table Creation**
   - Go to Table Editor
   - Confirm `monthly_closures` table exists
   - Check that RLS policies are enabled

### What the Table Does:

- **Stores monthly closure records** when you close a month
- **Tracks totals** for Jama, Udhar, Expenses per month
- **Enables month-wise filtering** in reports and ledgers
- **Preserves historical data** while starting fresh each month

### Features Available After Setup:

✅ **Close Month Button** - Lock current month's data
✅ **Month Selector** - Choose specific months for reports  
✅ **Historical Reports** - View any past month's data
✅ **Month-wise PDFs** - Export reports for specific months
✅ **Fresh Start** - New transactions count from next month

### Current Status:

- ❌ Table not created yet (app works but Close Month disabled)
- ✅ All APIs ready and handle missing table gracefully
- ✅ UI components implemented and functional

### After Table Creation:

The app will automatically detect the table and enable full month-wise functionality!
