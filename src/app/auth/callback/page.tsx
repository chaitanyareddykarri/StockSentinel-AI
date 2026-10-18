'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/db/supabaseClient';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processAuth() {
      // 1. Check for error in query params
      const errorDesc = searchParams.get('error_description') || searchParams.get('error');
      if (errorDesc) {
        setError(errorDesc);
        return;
      }

      // 2. Supabase Auth code exchange
      const code = searchParams.get('code');
      const supabase = getSupabaseClient();
      if (code && supabase) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }
          router.push('/dashboard');
          return;
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Supabase OAuth session exchange failed.');
          return;
        }
      }

      // 2. Check hash fragments for Google OAuth tokens (response_type=token id_token)
      let idToken: string | null = null;
      let accessToken: string | null = null;

      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        idToken = hashParams.get('id_token');
        accessToken = hashParams.get('access_token');
      }

      // Check query params as well
      if (!idToken) {
        idToken = searchParams.get('id_token') || searchParams.get('credential');
      }

      if (idToken) {
        try {
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: idToken }),
          });

          const data = await res.json();
          if (!res.ok || data.error) {
            setError(data.error || 'Failed to authenticate with Google.');
            return;
          }

          if (typeof window !== 'undefined') {
            localStorage.setItem('stocksentinel_user_profile', JSON.stringify(data.user));
          }

          router.push('/dashboard');
          return;
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Google authentication processing failed.');
          return;
        }
      }

      // If an access token was returned without id_token, query Google userinfo
      if (accessToken) {
        try {
          const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const profile = await gRes.json();
          if (profile.email) {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: profile.email,
                name: profile.name,
                picture: profile.picture,
              }),
            });
            const data = await res.json();
            if (data.user) {
              if (typeof window !== 'undefined') {
                localStorage.setItem('stocksentinel_user_profile', JSON.stringify(data.user));
              }
              router.push('/dashboard');
              return;
            }
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve Google profile.');
          return;
        }
      }

      // Default redirect
      router.push('/dashboard');
    }

    processAuth();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-md w-full rounded-2xl border border-white/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Authentication Failed</h2>
          <p className="text-xs text-rose-300">{error}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-4 animate-fade-in text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-emerald-500/20 animate-pulse">
          <ShieldAlert className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Verifying Identity</h2>
          <p className="text-xs text-slate-400 mt-1">Completing secure OAuth handshake...</p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-emerald-400 font-medium pt-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Finalizing session...</span>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
