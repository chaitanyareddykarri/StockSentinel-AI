'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, LogIn } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isLoggingOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionStalled, setSessionStalled] = useState<boolean>(false);

  useEffect(() => {
    if (!loading && !user && !isLoggingOut) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (!loading && user && !isLoggingOut) {
      if (user.accessState === 'PENDING_ASSIGNMENT' || user.accessState === 'SUSPENDED') {
        if (pathname !== '/access-status' && pathname !== '/onboarding' && !pathname.startsWith('/invite')) {
          router.push('/access-status');
        }
      }
    }
  }, [user, loading, isLoggingOut, router, pathname]);

  // Safety timer to prevent infinite spinner on stalled session checks
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setSessionStalled(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/25 to-slate-50 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/20 selection:text-emerald-900">
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
            <p className="text-xs text-slate-500 mt-0.5">Checking retail security session...</p>
          </div>

          {sessionStalled ? (
            <div className="pt-2 space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2 text-left">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Verification is taking longer than usual. Please retry or sign in manually.</span>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => window.location.reload()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white transition-colors cursor-pointer"
                >
                  Retry Check
                </button>
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname)}`}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 pt-2">
              {/* Thin animated emerald progress line */}
              <div
                className="w-full max-w-[280px] h-1.5 rounded-full bg-emerald-100 border border-emerald-200/80 overflow-hidden relative emerald-progress-track"
                role="progressbar"
                aria-label="Preparing workspace"
              >
                <div className="absolute top-0 bottom-0 left-0 w-[30%] h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-[#064e3b] shadow-xs emerald-progress-bar" />
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Preparing workspace...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
