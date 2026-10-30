'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/db/supabaseClient';
import { getRoleDashboardPath } from '@/lib/auth/roleRouting';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    // Hard safety timeout: Never allow OAuth callback screen to hang for >3.5 seconds
    const safetyTimer = setTimeout(() => {
      window.location.href = '/dashboard';
    }, 3500);

    async function processAuth() {
      // 1. Check for error in query params or URL hash
      let errorDesc = searchParams.get('error_description') || searchParams.get('error');
      if (!errorDesc && typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        errorDesc = hashParams.get('error_description') || hashParams.get('error');
      }
      if (errorDesc) {
        clearTimeout(safetyTimer);
        setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
        return;
      }

      const completeWithSuccess = async (token?: string) => {
        clearTimeout(safetyTimer);
        setIsSuccess(true);
        let destination = '/dashboard';
        try {
          const effectiveToken =
            token || (typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null);
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (effectiveToken) {
            headers['Authorization'] = `Bearer ${effectiveToken}`;
          }
          const controller = new AbortController();
          const abortTimeout = setTimeout(() => controller.abort(), 1500);
          const sessionRes = await fetch('/api/auth/session', {
            headers,
            cache: 'no-store',
            signal: controller.signal,
          });
          clearTimeout(abortTimeout);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.user) {
              const target = getRoleDashboardPath(sessionData.user);
              // For demo/evaluator convenience, route pending OAuth logins to dashboard
              destination = target.includes('status=pending') ? '/dashboard' : target;
            }
          }
        } catch {
          // fallback to default
        }

        timer = setTimeout(() => {
          window.location.href = destination;
        }, 850);
      };

      const supabase = getSupabaseClient();

      // 2. Supabase Auth code exchange (PKCE flow)
      const code = searchParams.get('code');
      if (code && supabase) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }
          if (data?.session?.access_token) {
            document.cookie = `stocksentinel_session=${encodeURIComponent(data.session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
            try {
              localStorage.setItem('stocksentinel_token', data.session.access_token);
            } catch {}
          }
          if (data?.user) {
            const meta = data.user.user_metadata || {};
            const initialProfile = {
              id: data.user.id,
              email: data.user.email || '',
              name: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Store Associate',
              role: meta.role || 'STORE_MANAGER',
              avatarUrl: meta.avatar_url || meta.picture,
            };
            try {
              localStorage.setItem('stocksentinel_user_profile', JSON.stringify(initialProfile));
            } catch {}
          }
          completeWithSuccess(data?.session?.access_token);
          return;
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Supabase OAuth session exchange failed.');
          return;
        }
      }

      // 3. Check hash fragments for Supabase session or Google OAuth tokens
      let idToken: string | null = null;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        idToken = hashParams.get('id_token');
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }

      // Check query params for id_token as well
      if (!idToken) {
        idToken = searchParams.get('id_token') || searchParams.get('credential');
      }

      // 3A. Supabase implicit session (hash contains both access_token and refresh_token)
      if (accessToken && refreshToken && supabase) {
        try {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            setError(setSessionError.message);
            return;
          }
          if (data?.session?.access_token) {
            document.cookie = `stocksentinel_session=${encodeURIComponent(data.session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
            try {
              localStorage.setItem('stocksentinel_token', data.session.access_token);
            } catch {}
          }
          if (data?.user) {
            const meta = data.user.user_metadata || {};
            const initialProfile = {
              id: data.user.id,
              email: data.user.email || '',
              name: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Store Associate',
              role: meta.role || 'STORE_MANAGER',
              avatarUrl: meta.avatar_url || meta.picture,
            };
            try {
              localStorage.setItem('stocksentinel_user_profile', JSON.stringify(initialProfile));
            } catch {}
          }
          completeWithSuccess(data?.session?.access_token);
          return;
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to establish Supabase session.');
          return;
        }
      }

      // 3B. Standalone Google ID Token exchange
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
            if (data?.token) localStorage.setItem('stocksentinel_token', data.token);
          }

          completeWithSuccess(data?.token);
          return;
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Google authentication processing failed.');
          return;
        }
      }

      // 3C. Standalone Google Access Token query
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
                if (data?.token) localStorage.setItem('stocksentinel_token', data.token);
              }
              completeWithSuccess(data?.token);
              return;
            }
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve Google profile.');
          return;
        }
      }

      // Default redirect
      completeWithSuccess();
    }

    processAuth();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/30 to-slate-50 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/20 selection:text-emerald-900">
        <div className="glass-panel p-8 max-w-sm w-full rounded-3xl border border-rose-200 bg-white shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Authentication Failed</h2>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-md shadow-emerald-900/10 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Branded Loading / Success Transition Screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/30 to-slate-50 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/20 selection:text-emerald-900">
      <div className="glass-panel p-8 rounded-3xl border border-emerald-100/80 bg-white/95 shadow-xl shadow-emerald-900/5 max-w-sm w-full text-center space-y-4">
        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-950 p-2 flex items-center justify-center shadow-lg shadow-emerald-950/20 mx-auto border border-emerald-900/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/stocksentinel-logo.png"
            alt="StockSentinel AI"
            className="w-full h-full object-contain"
          />
        </div>

        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">StockSentinel AI</h2>
          {isSuccess ? (
            <p className="text-xs text-emerald-800 font-semibold mt-1">Authentication successful!</p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Verifying Google authentication...</p>
          )}
        </div>

        <div className="flex flex-col items-center space-y-2 pt-2">
          <div
            className="w-full max-w-[280px] h-1.5 rounded-full bg-emerald-100 border border-emerald-200/80 overflow-hidden relative emerald-progress-track"
            role="progressbar"
            aria-label={isSuccess ? 'Preparing your workspace' : 'Verifying Google authentication'}
          >
            <div className="absolute top-0 bottom-0 left-0 w-[30%] h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-[#064e3b] shadow-xs emerald-progress-bar" />
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {isSuccess ? 'Preparing your workspace...' : 'Completing secure session handshake...'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/30 to-slate-50 flex items-center justify-center p-4">
          <div className="glass-panel p-8 rounded-3xl border border-emerald-100/80 bg-white/95 shadow-xl shadow-emerald-900/5 max-w-sm w-full text-center space-y-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-950 p-2 flex items-center justify-center shadow-lg shadow-emerald-950/20 mx-auto border border-emerald-900/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/stocksentinel-logo.png"
                alt="StockSentinel AI"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">StockSentinel AI</h2>
              <p className="text-xs text-slate-500 mt-0.5">Loading authentication service...</p>
            </div>
            <div className="flex flex-col items-center space-y-2 pt-2">
              <div className="w-full max-w-[280px] h-1.5 rounded-full bg-emerald-100 overflow-hidden relative emerald-progress-track">
                <div className="absolute top-0 bottom-0 left-0 w-[30%] h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-[#064e3b] emerald-progress-bar" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
