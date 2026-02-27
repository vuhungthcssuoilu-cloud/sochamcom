import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise use the provided credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jzycmjynzkhevuxyjngv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6eWNtanluemtoZXZ1eHlqbmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTUzODksImV4cCI6MjA4Nzc3MTM4OX0.k9bRVlYvcCKqhDGZspPajyT128e1CfQCcL2Swr76Ayw';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
