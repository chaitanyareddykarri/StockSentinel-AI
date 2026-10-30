'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { Store } from '@/types';
import {
  Menu,
  Building2,
  RefreshCw,
  Play,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  stores?: Store[];
  selectedStore?: string;
  onStoreChange?: (storeId: string) => void;
  isDemoData?: boolean;
  isRunningDetection?: boolean;
  onRunDetection?: () => void;
  openAlertsCount?: number;
}

export function AppShell({
  children,
  title,
  subtitle,
  badge,
  actions,
  stores,
  selectedStore,
  onStoreChange,
  isDemoData,
  isRunningDetection,
  onRunDetection,
  openAlertsCount: propAlertsCount,
}: AppShellProps) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [internalAlertsCount, setInternalAlertsCount] = useState(0);
  const [isSupabase, setIsSupabase] = useState(false);

  useEffect(() => {
    fetch('/api/metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.metrics?.flaggedPhantomStockouts !== undefined) {
          setInternalAlertsCount(data.metrics.flaggedPhantomStockouts);
        }
        if (data.storageType === 'SUPABASE_POSTGRESQL') {
          setIsSupabase(true);
        }
      })
      .catch(() => {});
  }, []);

  const openAlertsCount = propAlertsCount !== undefined ? propAlertsCount : internalAlertsCount;

  return (
    <ProtectedRoute>
      <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] text-slate-900">
        {/* Desktop Fixed Persistent Sidebar (w-64 = 256px) */}
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          openAlertsCount={openAlertsCount}
          isSupabase={isSupabase}
        />

        {/* Right-Hand Content Area with Independent Scrolling */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden min-w-0">
          {/* Mobile Top App Bar */}
          <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs shrink-0">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-1.5 font-bold text-slate-900 text-sm">
                <span>StockSentinel</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded border border-emerald-600/25">
                  AI
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onRunDetection && (
                <button
                  onClick={onRunDetection}
                  disabled={isRunningDetection}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
                >
                  {isRunningDetection ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-300" />
                  )}
                  <span>Detect</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop & Tablet Top Header Bar */}
          <header className="hidden md:flex sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-8 py-4 items-center justify-between gap-4 shadow-2xs shrink-0">
            <div className="min-w-0">
              <div className="flex items-center space-x-2.5">
                <h1 className="text-lg lg:text-xl font-extrabold text-slate-900 tracking-tight truncate">
                  {title || 'Inventory Operations Command Center'}
                </h1>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Header Right Actions & Controls */}
            <div className="flex items-center space-x-3 shrink-0">
              {/* Optional Store Filter */}
              {user?.accessState === 'STORE_MANAGER' ? (
                <div
                  className="flex items-center space-x-1.5 text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 shadow-2xs text-emerald-900 font-semibold"
                  title="Store-scoped workspace: Access restricted to your assigned location"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate max-w-[160px]">
                    {user.assignedStoreName || user.storeName || 'Assigned Store'}
                  </span>
                </div>
              ) : (
                stores && stores.length > 0 && onStoreChange && selectedStore && (
                  <div className="flex items-center space-x-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={selectedStore}
                      onChange={(e) => onStoreChange(e.target.value)}
                      aria-label="Scope by store"
                      className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Active Stores ({stores.length})</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {/* Data Source Badge if specified */}
              {isDemoData !== undefined && (
                isDemoData ? (
                  <div
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                    title="Displaying pre-packaged baseline retail data (Stores SEA-101, BEL-204, TAC-308). Ingest custom CSV files to analyze live store inventory."
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Seeded Retail Demo Telemetry</span>
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                    title="Operating with custom imported store telemetry"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Live Production Telemetry</span>
                  </div>
                )
              )}

              {/* Run Detection Button if provided */}
              {onRunDetection && (
                <button
                  onClick={onRunDetection}
                  disabled={isRunningDetection}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                  title="Execute statistical demand anomaly detection across active stores"
                >
                  {isRunningDetection ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                      <span>Analyzing POS Velocity...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-emerald-300" />
                      <span>Run Detection</span>
                    </>
                  )}
                </button>
              )}

              {/* Custom Page Actions */}
              {actions}
            </div>
          </header>

          {/* Main Page Scrollable Content */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto space-y-6">
            {children}
          </main>

          {/* Persistent Standard Footer */}
          <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 mt-auto bg-white/60 shrink-0">
            <p>StockSentinel AI — Retail Inventory Operations Platform • Enterprise Edition 2026</p>
          </footer>
        </div>
      </div>
    </ProtectedRoute>
  );
}
