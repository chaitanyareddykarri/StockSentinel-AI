'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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
  LogOut,
  User as UserIcon,
} from 'lucide-react';

interface NavbarProps {
  onRunDetection?: () => void;
  isRunningDetection?: boolean;
}

export function Navbar({ onRunDetection, isRunningDetection }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSupabase, setIsSupabase] = useState(false);

  useEffect(() => {
    fetch('/api/metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.storageType === 'SUPABASE_POSTGRESQL') {
          setIsSupabase(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
            <Link href={user ? '/dashboard' : '/'} className="flex items-center space-x-2 group">
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
                isSupabase
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              }`}
              title={
                isSupabase
                  ? 'Connected to persistent Supabase PostgreSQL'
                  : 'Production Database Connected'
              }
            >
              <Database className="w-3.5 h-3.5" />
              <span className="font-medium">
                {isSupabase ? 'Supabase DB' : 'Database Active'}
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

            {/* User Profile / Auth State */}
            {user ? (
              <div className="flex items-center space-x-2.5 pl-2.5 border-l border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[110px]">
                      {user.name || user.email.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {user.storeName || user.role || 'Associate'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  title="Sign out of StockSentinel AI"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pl-2 border-l border-white/10">
                <Link
                  href="/login"
                  className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-emerald-600/30"
                >
                  Sign Up
                </Link>
              </div>
            )}
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

          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Database: {isSupabase ? 'Supabase PostgreSQL' : 'Active'}</span>
              {user && (
                <span className="text-emerald-400 font-medium">
                  {user.name || user.email}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {onRunDetection && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onRunDetection();
                  }}
                  disabled={isRunningDetection}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white"
                >
                  {isRunningDetection ? 'Analyzing...' : 'Run Detection'}
                </button>
              )}

              {user ? (
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await handleSignOut();
                  }}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-rose-400 hover:bg-slate-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2 w-full">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
