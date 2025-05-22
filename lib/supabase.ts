import { createClient } from '@supabase/supabase-js'

// During build time, these might be undefined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a client that will be initialized at runtime
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Add a runtime check
if (typeof window === 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing required Supabase environment variables');
  }
}
