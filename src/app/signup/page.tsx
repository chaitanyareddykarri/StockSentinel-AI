'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getRoleDashboardPath } from '@/lib/auth/roleRouting';
import {
  Mail,
  Lock,
  User,
  Building,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSuccessTransition, setIsSuccessTransition] = useState(false);
  const [showOAuthGuide, setShowOAuthGuide] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error') || params.get('error_description');
      if (err) {
        if (err.includes('origin_mismatch')) {
          return 'Google OAuth Error (origin_mismatch): Register your current domain/port under "Authorized JavaScript origins" in Google Cloud Console Credentials.';
        }
        if (err.includes('redirect_uri_mismatch')) {
          return 'Google OAuth Error (redirect_uri_mismatch): Add the Supabase callback URL to "Authorized redirect URIs" in Google Cloud Console Credentials. Click the guide below to copy.';
        }
        return decodeURIComponent(err.replace(/\+/g, ' '));
      }
    }
    return null;
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSuccessTransition) return;

    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUpWithEmail(email, password, name, storeName);
      if (res.error) {
        setErrorMessage(res.error);
        setLoading(false);
      } else if (res.needsEmailConfirmation) {
        setSuccessMessage(`Account created! A confirmation email has been sent to ${email}. Please check your inbox and verify your email before logging in.`);
        setLoading(false);
      } else {
        setSuccessMessage('Account created successfully! Preparing your workspace...');
        setIsSuccessTransition(true);

        // Check if there is an explicit redirect param (e.g. from an invite link)
        let destination = '/access-status?status=pending';
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const explicitRedirect = params.get('redirect');
          if (explicitRedirect) {
            destination = explicitRedirect;
          } else {
            try {
              const sessionRes = await fetch('/api/auth/session');
              if (sessionRes.ok) {
                const sessionData = await sessionRes.json();
                if (sessionData.user) {
                  destination = getRoleDashboardPath(sessionData.user);
                }
              }
            } catch {}
          }
        }

        setTimeout(() => {
          router.push(destination);
        }, 850);
      }
    } catch {
      setErrorMessage('Unexpected registration error. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading || isSuccessTransition) return;
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setErrorMessage(res.error);
        setGoogleLoading(false);
      } else if (res.cancelled) {
        setGoogleLoading(false);
      } else if (res.redirected) {
        // Full-page OAuth redirect in progress; keep loading active
      } else {
        // Authenticated successfully via Google Identity Services: display consistent branded transition
        setSuccessMessage('Account authenticated! Preparing your workspace...');
        setIsSuccessTransition(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 850);
      }
    } catch {
      setErrorMessage('Unexpected error during Google sign in.');
      setGoogleLoading(false);
    }
  };

  // 1. BRANDED SUCCESS TRANSITION: Visible loading feedback using official logo & animated progress line
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
            <p className="text-xs text-emerald-800 font-semibold mt-1">Account created successfully!</p>
          </div>

          <div className="flex flex-col items-center space-y-2 pt-2">
            <div
              className="w-full max-w-[280px] h-1.5 rounded-full bg-emerald-100 border border-emerald-200/80 overflow-hidden relative emerald-progress-track"
              role="progressbar"
              aria-label="Preparing your workspace"
            >
              <div className="absolute top-0 bottom-0 left-0 w-[30%] h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-[#064e3b] shadow-xs emerald-progress-bar" />
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Preparing your workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. SIGN UP FORM
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
          Create StockSentinel Account
        </h1>
        <p className="text-xs text-slate-500">
          Register your retail store to begin detecting and verifying phantom stock-outs.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-6 sm:px-10 rounded-3xl border border-emerald-100/80 bg-white/95 shadow-xl space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading || isSuccessTransition}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Location / Chain Name
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Store Location / Organization (Optional)"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={loading || isSuccessTransition}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || isSuccessTransition}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
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

            <button
              type="submit"
              disabled={loading || isSuccessTransition}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-md shadow-emerald-900/15 disabled:opacity-50 transition-all cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-slate-400 uppercase tracking-wider">
              Or register with
            </span>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading || isSuccessTransition}
            className="w-full flex items-center justify-center space-x-2.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.25C.45 8.22 0 10.06 0 12s.45 3.78 1.25 5.39l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.61l4.02 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            <span>{googleLoading ? 'Connecting Google...' : 'Sign up with Google'}</span>
          </button>

          {/* Quick OAuth Setup Helper for Developers */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowOAuthGuide(!showOAuthGuide)}
              className="text-[11px] text-slate-500 hover:text-slate-700 inline-flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
              <span>Fix &quot;redirect_uri_mismatch&quot; in Google Console</span>
            </button>
          </div>

          {showOAuthGuide && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">OAuth Setup Checklist</span>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#064e3b] hover:underline inline-flex items-center space-x-1"
                >
                  <span>Google Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500">
                To fix &quot;redirect_uri_mismatch&quot;, register these URLs in Google Cloud Console under your OAuth 2.0 Client ID:
              </p>

              {process.env.NEXT_PUBLIC_SUPABASE_URL && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-emerald-800">1. Google Authorized redirect URI (Supabase):</span>
                    <span className="text-[10px] text-emerald-600 font-medium">Critical</span>
                  </div>
                  <div className="flex items-center justify-between bg-emerald-50/50 px-2.5 py-1.5 rounded border border-emerald-200 font-mono text-[11px]">
                    <span className="truncate">{`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/callback`}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const uri = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')}/auth/v1/callback`;
                        navigator.clipboard.writeText(uri);
                        setCopiedField('sb_uri');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className="text-emerald-700 hover:text-emerald-900 shrink-0 ml-2 cursor-pointer"
                    >
                      {copiedField === 'sb_uri' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500">2. Google Authorized redirect URI (App Fallback):</span>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200 font-mono text-[11px]">
                  <span className="truncate">{typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:3000/auth/callback'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const uri = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:3000/auth/callback';
                      navigator.clipboard.writeText(uri);
                      setCopiedField('uri');
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="text-slate-400 hover:text-slate-700 shrink-0 ml-2 cursor-pointer"
                  >
                    {copiedField === 'uri' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500">3. Google Authorized JavaScript origins:</span>
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200 font-mono text-[11px]">
                  <span className="truncate">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                      navigator.clipboard.writeText(origin);
                      setCopiedField('origin');
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="text-slate-400 hover:text-slate-700 shrink-0 ml-2 cursor-pointer"
                  >
                    {copiedField === 'origin' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200">
                In <strong className="text-slate-700">Supabase Dashboard &gt; Auth &gt; URL Configuration</strong>, ensure <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700">{typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:3000/auth/callback'}</code> is listed under <strong>Redirect URLs</strong>.
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-200">
            Already have an account?{' '}
            <Link href="/login" className="text-[#064e3b] hover:text-emerald-700 font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
