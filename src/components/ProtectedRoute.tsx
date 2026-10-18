'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 animate-fade-in text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-emerald-500/20 animate-pulse">
            <ShieldAlert className="w-9 h-9 text-white" />
          </div>

          <div>
            <div className="flex items-center justify-center space-x-2">
              <h2 className="text-xl font-bold text-white tracking-tight">StockSentinel</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                AI
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Verifying retail security credentials...</p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-emerald-400 font-medium pt-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Initializing session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
