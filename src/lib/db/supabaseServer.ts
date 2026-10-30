import { createClient, SupabaseClient } from '@supabase/supabase-js';

function isValidKey(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (
    trimmed.startsWith('[') ||
    trimmed.startsWith('<') ||
    trimmed.includes('your-') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('Needs service_role')
  ) {
    return false;
  }
  return trimmed.length > 20;
}

export function isSupabaseServerConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return Boolean(
    url &&
    url.startsWith('https://') &&
    !url.includes('your-project') &&
    (isValidKey(serviceKey) || isValidKey(anonKey))
  );
}

export function getSupabaseServerClient(userAccessToken?: string): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const validServiceKey = isValidKey(serviceKey) ? serviceKey!.trim() : undefined;
  const validAnonKey = isValidKey(anonKey) ? anonKey!.trim() : undefined;
  const key = validServiceKey || validAnonKey;

  if (!url || !key) {
    return null;
  }

  // If a user access token is provided, invoke on behalf of that authenticated user
  // so PostgreSQL auth.uid() and auth.jwt() are populated for RLS and RPCs
  if (userAccessToken) {
    return createClient(url, validAnonKey || key, {
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

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
