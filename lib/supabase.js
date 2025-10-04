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
  // Get all transactions for a party
  getByParty: async (partyId) => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("party_id", partyId)
      .order("date", { ascending: false });

    if (error) throw error;
    return data;
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
  // Get all expenses
  getAll: async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get expenses by category
  getByCategory: async (category) => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("category", category)
      .order("date", { ascending: false });

    if (error) throw error;
    return data;
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

// Dashboard/Summary operations
export const dashboardAPI = {
  // Get dashboard summary data
  getSummary: async () => {
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
