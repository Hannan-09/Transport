import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = "https://fycnfgwfrdzlcqnsrhwr.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5Y25mZ3dmcmR6bGNxbnNyaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTE3NjksImV4cCI6MjA3NDk2Nzc2OX0.5vAByKVLPXOyIAkY9HKGZDq0s9MyG5Pvlv0PLTkUFQU";

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper functions for common operations

// Parties operations
export const partiesAPI = {
  // Get all parties
  getAll: async () => {
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Create a new party
  create: async (party) => {
    const { data, error } = await supabase
      .from("parties")
      .insert([party])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update a party
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from("parties")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete a party
  delete: async (id) => {
    const { error } = await supabase.from("parties").delete().eq("id", id);

    if (error) throw error;
  },

  // Search parties by name or phone
  search: async (query) => {
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%`)
      .order("name");

    if (error) {
      console.error("Search error:", error);
      return [];
    }
    return data || [];
  },
};

// Transactions operations
export const transactionsAPI = {
  // Get all transactions for a party (optionally filtered by month)
  getByParty: async (partyId, month = null) => {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("party_id", partyId);

    if (month) {
      const startDate = `${month}-01`;
      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get current active month transactions for a party (excludes closed months)
  getCurrentByParty: async (partyId) => {
    const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth();
    return await transactionsAPI.getByParty(partyId, activeMonth);
  },

  // Get transactions by month
  getByMonth: async (month) => {
    // Calculate the first day of next month for proper range
    const startDate = `${month}-01`;
    const nextMonth = new Date(month + "-01");
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = nextMonth.toISOString().slice(0, 10); // YYYY-MM-DD format

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get all transactions for current active month
  getCurrentMonth: async () => {
    // Get current month without timezone issues
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let activeMonth = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}`;

    // Check if current month is closed
    try {
      const { data: currentClosure } = await supabase
        .from("monthly_closures")
        .select("*")
        .eq("month", activeMonth)
        .single();

      if (currentClosure) {
        // Current month is closed, return next month
        let nextYear = currentYear;
        let nextMonth = currentMonth + 1;

        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }

        activeMonth = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
      }
    } catch (error) {
      // Table doesn't exist, use current month
      console.log("Monthly closures table not found, using current month");
    }

    return await transactionsAPI.getByMonth(activeMonth);
  },

  // Create a new transaction
  create: async (transaction) => {
    const { data, error } = await supabase
      .from("transactions")
      .insert([transaction])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update a transaction
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete a transaction
  delete: async (id) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) throw error;
  },
};

// Expenses operations
export const expensesAPI = {
  // Get all expenses (optionally filtered by month)
  getAll: async (month = null) => {
    let query = supabase.from("expenses").select("*");

    if (month) {
      const startDate = `${month}-01`;
      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get expenses by category (optionally filtered by month)
  getByCategory: async (category, month = null) => {
    let query = supabase.from("expenses").select("*").eq("category", category);

    if (month) {
      const startDate = `${month}-01`;
      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get expenses by month
  getByMonth: async (month) => {
    // Calculate the first day of next month for proper range
    const startDate = `${month}-01`;
    const nextMonth = new Date(month + "-01");
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = nextMonth.toISOString().slice(0, 10); // YYYY-MM-DD format

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get expenses for current active month
  getCurrentMonth: async () => {
    // Get current month without timezone issues
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let activeMonth = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}`;

    // Check if current month is closed
    try {
      const { data: currentClosure } = await supabase
        .from("monthly_closures")
        .select("*")
        .eq("month", activeMonth)
        .single();

      if (currentClosure) {
        // Current month is closed, return next month
        let nextYear = currentYear;
        let nextMonth = currentMonth + 1;

        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }

        activeMonth = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
      }
    } catch (error) {
      // Table doesn't exist, use current month
      console.log("Monthly closures table not found, using current month");
    }

    return await expensesAPI.getByMonth(activeMonth);
  },

  // Get current active month expenses (excludes closed months)
  getCurrentActive: async () => {
    const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth();
    return await expensesAPI.getByMonth(activeMonth);
  },

  // Get current active month expenses by category (excludes closed months)
  getCurrentByCategory: async (category) => {
    const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth();
    return await expensesAPI.getByCategory(category, activeMonth);
  },

  // Create a new expense
  create: async (expense) => {
    const { data, error } = await supabase
      .from("expenses")
      .insert([expense])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update an expense
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete an expense
  delete: async (id) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) throw error;
  },
};

// Monthly Closures operations
export const monthlyClosuresAPI = {
  // Get all monthly closures
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from("monthly_closures")
        .select("*")
        .order("month", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.log("Monthly closures table not found:", error.message);
      return [];
    }
  },

  // Get specific month closure
  getByMonth: async (month) => {
    try {
      const { data, error } = await supabase
        .from("monthly_closures")
        .select("*")
        .eq("month", month)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows returned
      return data;
    } catch (error) {
      console.log("Monthly closures table not found:", error.message);
      return null;
    }
  },

  // Create monthly closure
  create: async (closureData) => {
    const { data, error } = await supabase
      .from("monthly_closures")
      .insert([closureData])
      .select();

    if (error) {
      console.error("Error creating monthly closure:", error);
      throw error; // Throw the actual error instead of a generic one
    }
    return data[0];
  },

  // Get current active month (latest non-closed month or current month)
  getCurrentActiveMonth: async () => {
    // Get current month without timezone issues
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let checkMonth = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}`;

    try {
      // Keep checking months until we find one that's not closed
      for (let i = 0; i < 12; i++) {
        // Prevent infinite loop, max 12 months ahead
        const { data: closure, error } = await supabase
          .from("monthly_closures")
          .select("*")
          .eq("month", checkMonth)
          .single();

        // If no closure found (error) or closure is null, this month is active
        if (error || !closure) {
          return checkMonth;
        }

        // This month is closed, check next month
        // Parse current month and advance properly
        const [year, month] = checkMonth.split("-").map(Number);
        let nextYear = year;
        let nextMonth = month;

        nextMonth += 1;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear += 1;
        }

        checkMonth = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
      }
    } catch (error) {
      // If table doesn't exist or other error, just return current month
      console.log("Monthly closures table not found, using current month");
    }

    return checkMonth; // Return the last checked month if all are closed
  },
};

// Dashboard/Summary operations
export const dashboardAPI = {
  // Get dashboard summary data for specific month or current active month
  getSummary: async (month = null) => {
    try {
      let targetMonth = month;

      if (!targetMonth) {
        // Get current month without timezone issues
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        targetMonth = `${currentYear}-${String(currentMonth + 1).padStart(
          2,
          "0"
        )}`;

        try {
          // Check if current month is closed
          const { data: currentClosure } = await supabase
            .from("monthly_closures")
            .select("*")
            .eq("month", targetMonth)
            .single();

          if (currentClosure) {
            // Current month is closed, use next month
            let nextYear = currentYear;
            let nextMonth = currentMonth + 1;

            if (nextMonth > 11) {
              nextMonth = 0;
              nextYear += 1;
            }

            targetMonth = `${nextYear}-${String(nextMonth + 1).padStart(
              2,
              "0"
            )}`;
          }
        } catch (error) {
          // Table doesn't exist, use current month
          console.log("Monthly closures table not found, using current month");
        }
      }

      // Get total earned (sum of all positive transactions) for the month
      const startDate = `${targetMonth}-01`;
      const nextMonth = new Date(targetMonth + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);

      const { data: earnedData, error: earnedError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "Jama")
        .gte("date", startDate)
        .lt("date", endDate);

      if (earnedError) throw earnedError;

      // Get total expenses for the month
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .select("amount")
        .gte("date", startDate)
        .lt("date", endDate);

      if (expenseError) throw expenseError;

      // Calculate totals
      const totalEarned = earnedData.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );
      const totalExpenses = expenseData.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );
      const remainingBalance = totalEarned - totalExpenses;

      return {
        totalEarned,
        totalExpenses,
        remainingBalance,
        month: targetMonth,
      };
    } catch (error) {
      throw error;
    }
  },

  // Get all-time summary (for historical view)
  getAllTimeSummary: async () => {
    try {
      // Get total earned (sum of all positive transactions)
      const { data: earnedData, error: earnedError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "Jama");

      if (earnedError) throw earnedError;

      // Get total expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .select("amount");

      if (expenseError) throw expenseError;

      // Calculate totals
      const totalEarned = earnedData.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );
      const totalExpenses = expenseData.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0
      );
      const remainingBalance = totalEarned - totalExpenses;

      return {
        totalEarned,
        totalExpenses,
        remainingBalance,
      };
    } catch (error) {
      throw error;
    }
  },
};

export default supabase;
