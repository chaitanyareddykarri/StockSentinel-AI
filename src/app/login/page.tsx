'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getRoleDashboardPath } from '@/lib/auth/roleRouting';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail } = useAuth();

  // Default pre-filled account as requested: manager@stocksentinel.ai / demo1234
  const [email, setEmail] = useState('manager@stocksentinel.ai');
  const [password, setPassword] = useState('demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccessTransition, setIsSuccessTransition] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const err = searchParams.get('error') || searchParams.get('error_description');
    if (!err) return null;
    return decodeURIComponent(err.replace(/\+/g, ' '));
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const executeLogin = async (targetEmail: string, targetPassword: string) => {
    if (loading || isSuccessTransition) return;
    setErrorMessage(null);
    setLoading(true);

    const finalEmail = targetEmail.trim() || 'manager@stocksentinel.ai';
    const finalPassword = targetPassword || 'demo1234';

    try {
      const res = await signInWithEmail(finalEmail, finalPassword);
      if (res.error) {
        setErrorMessage(res.error);
        setLoading(false);
      } else {
        setSuccessMessage('Authentication successful. Preparing your workspace...');
        setIsSuccessTransition(true);

        const explicitRedirect = searchParams.get('redirect');
        let destination = explicitRedirect || '/dashboard';
        if (!explicitRedirect) {
          try {
            // Pass token explicitly — cookie may not be flushed to browser yet
            const storedToken = typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null;
            const sessionHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
            if (storedToken) sessionHeaders['Authorization'] = `Bearer ${storedToken}`;
            // Hard 2-second timeout so the splash never hangs
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const sessionRes = await fetch('/api/auth/session', {
              headers: sessionHeaders,
              cache: 'no-store',
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json();
              if (sessionData.user) {
                destination = getRoleDashboardPath(sessionData.user);
              }
            }
          } catch {
            // fallback to /dashboard — timeout or network error
          }
        }

        // Navigate immediately (no extra delay — splash already visible)
        window.location.href = destination;
      }
    } catch {
      setErrorMessage('Unexpected error signing in. Please check your credentials and retry.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password);
  };

  // 1. BRANDED SUCCESS TRANSITION: Visible instant feedback using official logo & animated progress line
  if (isSuccessTransition) {
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
            <p className="text-xs text-emerald-800 font-semibold mt-1">Authentication successful!</p>
          </div>

          <div className="flex flex-col items-center space-y-2 pt-2">
            <div
              className="w-full max-w-[280px] h-1.5 rounded-full bg-emerald-100 border border-emerald-200/80 overflow-hidden relative emerald-progress-track"
              role="progressbar"
              aria-label="Preparing your workspace"
            >
              <div className="absolute top-0 bottom-0 left-0 w-[50%] h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-[#064e3b] shadow-xs emerald-progress-bar" />
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Entering dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. SIGN IN FORM: Pre-filled with manager@stocksentinel.ai / demo1234
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/25 to-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-emerald-500/20 selection:text-emerald-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center space-x-2.5 group">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 p-1.5 flex items-center justify-center shadow-md shadow-emerald-950/20 mx-auto border border-emerald-900/30 group-hover:scale-102 transition-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/stocksentinel-logo.png"
              alt="StockSentinel AI Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Sign In to StockSentinel AI
        </h1>
        <p className="text-xs text-slate-500">
          Enter retail credentials or click below for instant 1-click demo access.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-6 sm:px-10 rounded-3xl border border-emerald-100/80 bg-white/95 shadow-xl space-y-6">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Instant 1-Click Access Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-[#064e3b]">1-Click Demo Login</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                Pre-configured
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('manager@stocksentinel.ai');
                setPassword('demo1234');
                executeLogin('manager@stocksentinel.ai', 'demo1234');
              }}
              disabled={loading || isSuccessTransition}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-emerald-50/80 border border-emerald-200 text-left transition-all group cursor-pointer shadow-xs disabled:opacity-50"
            >
              <div>
                <p className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                  Store Manager
                </p>
                <p className="text-[11px] text-slate-500 font-mono">manager@stocksentinel.ai</p>
              </div>
              <span className="text-[11px] font-semibold text-white bg-[#064e3b] group-hover:bg-[#065f46] px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-xs transition-colors">
                <span>Instant Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          {/* Email / Password Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="manager@stocksentinel.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || isSuccessTransition}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-[#064e3b] hover:text-emerald-700 font-semibold"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || isSuccessTransition}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Platform Admin Quick Switch */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Need admin access?</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@stocksentinel.ai');
                  setPassword('admin1234');
                }}
                disabled={loading || isSuccessTransition}
                className="text-[#064e3b] hover:text-emerald-700 font-semibold cursor-pointer underline underline-offset-2"
              >
                Autofill Admin (admin@stocksentinel.ai)
              </button>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={loading || isSuccessTransition}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-md shadow-emerald-900/15 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-200">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#064e3b] hover:text-emerald-700 font-semibold">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
