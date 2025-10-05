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
  // Get all parties for a specific user
  getAll: async (userId) => {
    if (!userId) throw new Error("User ID is required");

    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create a new party
  create: async (party, userId) => {
    if (!userId) throw new Error("User ID is required");

    const partyWithUser = { ...party, user_id: userId };
    const { data, error } = await supabase
      .from("parties")
      .insert([partyWithUser])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update a party
  update: async (id, updates, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { data, error } = await supabase
      .from("parties")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete a party
  delete: async (id, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { error } = await supabase
      .from("parties")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  },

  // Search parties by name or phone for a specific user
  search: async (query, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("user_id", userId)
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
  getByParty: async (partyId, userId, month = null) => {
    if (!userId) throw new Error("User ID is required");

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("party_id", partyId)
      .eq("user_id", userId);

    if (month) {
      const startDate = `${month}-01`;
      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get current active month transactions for a party (excludes closed months)
  getCurrentByParty: async (partyId, userId) => {
    if (!userId) throw new Error("User ID is required");

    const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth(userId);
    return await transactionsAPI.getByParty(partyId, userId, activeMonth);
  },

  // Get transactions by month for a specific user
  getByMonth: async (month, userId) => {
    if (!userId) throw new Error("User ID is required");

    // Calculate the first day of next month for proper range
    const startDate = `${month}-01`;
    const nextMonth = new Date(month + "-01");
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = nextMonth.toISOString().slice(0, 10); // YYYY-MM-DD format

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false });

    if (error) throw error;
    return data || [];
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
  create: async (transaction, userId) => {
    if (!userId) throw new Error("User ID is required");

    const transactionWithUser = { ...transaction, user_id: userId };
    const { data, error } = await supabase
      .from("transactions")
      .insert([transactionWithUser])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update a transaction
  update: async (id, updates, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete a transaction
  delete: async (id, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  },
};

// Expenses operations
export const expensesAPI = {
  // Get all expenses for a specific user (optionally filtered by month)
  getAll: async (userId, month = null) => {
    if (!userId) throw new Error("User ID is required");

    let query = supabase.from("expenses").select("*").eq("user_id", userId);

    if (month) {
      const startDate = `${month}-01`;
      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get expenses by category for a specific user (optionally filtered by month)
  getByCategory: async (category, userId, month = null) => {
    if (!userId) throw new Error("User ID is required");

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("category", category)
      .eq("user_id", userId);

    if (month) {
      const startDate = `${month}-01`;
      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lt("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get expenses by month for a specific user
  getByMonth: async (month, userId) => {
    if (!userId) throw new Error("User ID is required");

    // Calculate the first day of next month for proper range
    const startDate = `${month}-01`;
    const nextMonth = new Date(month + "-01");
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = nextMonth.toISOString().slice(0, 10); // YYYY-MM-DD format

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false });

    if (error) throw error;
    return data || [];
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
  getCurrentActive: async (userId) => {
    if (!userId) throw new Error("User ID is required");

    const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth(userId);
    return await expensesAPI.getByMonth(activeMonth, userId);
  },

  // Get current active month expenses by category (excludes closed months)
  getCurrentByCategory: async (category, userId) => {
    if (!userId) throw new Error("User ID is required");

    const activeMonth = await monthlyClosuresAPI.getCurrentActiveMonth(userId);
    return await expensesAPI.getByCategory(category, userId, activeMonth);
  },

  // Create a new expense
  create: async (expense, userId) => {
    if (!userId) throw new Error("User ID is required");

    const expenseWithUser = { ...expense, user_id: userId };
    const { data, error } = await supabase
      .from("expenses")
      .insert([expenseWithUser])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update an expense
  update: async (id, updates, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { data, error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete an expense
  delete: async (id, userId) => {
    if (!userId) throw new Error("User ID is required");

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  },
};

// Monthly Closures operations
export const monthlyClosuresAPI = {
  // Get all monthly closures for a specific user
  getAll: async (userId) => {
    if (!userId) throw new Error("User ID is required");

    try {
      const { data, error } = await supabase
        .from("monthly_closures")
        .select("*")
        .eq("user_id", userId)
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

  // Get current active month for a specific user (latest non-closed month or current month)
  getCurrentActiveMonth: async (userId) => {
    if (!userId) throw new Error("User ID is required");

    // Get current month without timezone issues
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let checkMonth = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}`;

    try {
      // Keep checking months until we find one that's not closed for this user
      for (let i = 0; i < 12; i++) {
        // Prevent infinite loop, max 12 months ahead
        const { data: closure, error } = await supabase
          .from("monthly_closures")
          .select("*")
          .eq("month", checkMonth)
          .eq("user_id", userId)
          .single();

        // If no closure found (error) or closure is null, this month is active for this user
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

// Authentication operations
export const authAPI = {
  // Register new user
  register: async (phoneNumber, pinCode) => {
    try {
      // Check if phone number already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("phone_number", phoneNumber)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Database check error:", checkError);
        throw new Error(
          "Database connection error. Please make sure the users table exists."
        );
      }

      if (existingUser) {
        throw new Error("Phone number already registered");
      }

      // Create new user
      const { data, error } = await supabase
        .from("users")
        .insert([
          {
            phone_number: phoneNumber,
            pin_code: pinCode,
          },
        ])
        .select();

      if (error) {
        console.error("Registration error:", error);
        throw new Error(
          "Registration failed. Please make sure the users table exists."
        );
      }
      return data[0];
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  // Login user
  login: async (phoneNumber, pinCode) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("phone_number", phoneNumber)
        .eq("pin_code", pinCode)
        .single();

      if (error) {
        console.error("Login error:", error);
        if (error.code === "PGRST116") {
          throw new Error("Invalid phone number or PIN");
        } else {
          throw new Error(
            "Database connection error. Please make sure the users table exists."
          );
        }
      }

      if (!data) {
        throw new Error("Invalid phone number or PIN");
      }

      // Update last login
      await supabase
        .from("users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", data.id);

      return data;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  // Check if phone number exists
  checkPhoneExists: async (phoneNumber) => {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("phone_number", phoneNumber)
      .single();

    return !!data;
  },
};

export default supabase;
