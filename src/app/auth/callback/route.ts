import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db/supabaseClient';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';
  const errorDesc = searchParams.get('error_description');

  if (errorDesc) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDesc)}`);
  }

  if (code) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If code was exchanged or fallback
  return NextResponse.redirect(`${origin}${next}`);
}
