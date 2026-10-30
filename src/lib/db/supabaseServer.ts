import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project') &&
    (supabaseServiceRoleKey || supabaseAnonKey)
  );
}

export function getSupabaseServerClient(userAccessToken?: string): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) {
    return null;
  }

  const key = supabaseServiceRoleKey || supabaseAnonKey;
  if (!supabaseUrl || !key) {
    return null;
  }

  // If a user access token is provided, invoke on behalf of that authenticated user
  // so PostgreSQL auth.uid() and auth.jwt() are populated for RLS and RPCs
  if (userAccessToken) {
    return createClient(supabaseUrl, supabaseAnonKey || key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      },
    });
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
