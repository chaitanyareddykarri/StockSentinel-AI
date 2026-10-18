'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldAlert,
  LayoutDashboard,
  BellRing,
  FileSpreadsheet,
  LineChart,
  Settings,
  RefreshCw,
  Database,
  Menu,
  X,
  Play,
  CheckCircle,
} from 'lucide-react';

interface NavbarProps {
  onRunDetection?: () => void;
  isRunningDetection?: boolean;
}

export function Navbar({ onRunDetection, isRunningDetection }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbMode, setDbMode] = useState<'SUPABASE_POSTGRESQL' | 'DEMO_IN_MEMORY'>('DEMO_IN_MEMORY');
  const [resetting, setResetting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/demo')
      .then((res) => res.json())
      .then((data) => {
        if (data.storageType) {
          setDbMode(data.storageType);
        }
      })
      .catch(() => {});
  }, []);

  const handleResetDemo = async () => {
    if (confirm('Reset demo dataset to initial state?')) {
      setResetting(true);
      try {
        const res = await fetch('/api/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' }),
        });
        if (res.ok) {
          setNotification('Demo data reset successfully!');
          setTimeout(() => {
            setNotification(null);
            window.location.reload();
          }, 1000);
        }
      } finally {
        setResetting(false);
      }
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/alerts', label: 'Alerts & Verifications', icon: BellRing },
    { href: '/import', label: 'CSV Ingestion', icon: FileSpreadsheet },
    { href: '/analytics', label: 'Benchmark & Eval', icon: LineChart },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg text-white tracking-tight">StockSentinel</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Phantom Stock-Out Intelligence</p>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status & Actions */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* DB Status Badge */}
            <div
              className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border ${
                dbMode === 'SUPABASE_POSTGRESQL'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
              title={
                dbMode === 'SUPABASE_POSTGRESQL'
                  ? 'Connected to persistent Supabase PostgreSQL'
                  : 'Live Demo Storage. Add Supabase env variables to persist to PostgreSQL.'
              }
            >
              <Database className="w-3.5 h-3.5" />
              <span className="font-medium">
                {dbMode === 'SUPABASE_POSTGRESQL' ? 'Supabase DB' : 'Demo Mode'}
              </span>
            </div>

            {/* Run Detection Button */}
            {onRunDetection && (
              <button
                onClick={onRunDetection}
                disabled={isRunningDetection}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isRunningDetection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Detection</span>
                  </>
                )}
              </button>
            )}

            {/* Reset Demo Button */}
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              title="Reset synthetic demo data"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-950/95 px-4 pt-2 pb-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-base font-medium ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Storage: {dbMode === 'SUPABASE_POSTGRESQL' ? 'Supabase' : 'Demo State'}
            </span>
            {onRunDetection && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onRunDetection();
                }}
                disabled={isRunningDetection}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white"
              >
                {isRunningDetection ? 'Analyzing...' : 'Run Detection'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center space-x-2 text-sm font-medium animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}
    </header>
  );
}
