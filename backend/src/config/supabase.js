import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase Config Warning]: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment variables. Database operations will fail until these are configured.'
  );
}

// Keep credentials strictly server-side
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error(
      'Supabase client is not initialized. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment.'
    );
  }
  return supabase;
};
