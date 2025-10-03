import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Supabase project URL and anon key
const supabaseUrl = "https://fycnfgwfrdzlcqnsrhwr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5Y25mZ3dmcmR6bGNxbnNyaHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTE3NjksImV4cCI6MjA3NDk2Nzc2OX0.5vAByKVLPXOyIAkY9HKGZDq0s9MyG5Pvlv0PLTkUFQU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
