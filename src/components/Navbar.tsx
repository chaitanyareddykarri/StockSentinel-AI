'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
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
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/alerts', label: 'Alerts & Verifications', icon: BellRing },
    { href: '/import', label: 'CSV Ingestion', icon: FileSpreadsheet },
    { href: '/analytics', label: 'Benchmark & Eval', icon: LineChart },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-emerald-900/10 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <Link href={user ? '/dashboard' : '/'} className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#064e3b] p-0.5 flex items-center justify-center shadow-xs border border-emerald-700/30 group-hover:scale-105 transition-transform">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/stocksentinel-logo.png"
                  alt="StockSentinel AI Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-lg text-slate-900 tracking-tight">StockSentinel</span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-600/25">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Phantom Stock-Out Intelligence</p>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-600/25 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-700" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status & Actions */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* DB Status Badge */}
            <div
              className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border bg-emerald-50/80 text-emerald-900 border-emerald-200/90 shadow-2xs"
              title={
                isSupabase
                  ? 'Connected to persistent Supabase PostgreSQL database'
                  : 'Operating in persistent local storage mode'
              }
            >
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span className="font-medium text-[11px]">
                {isSupabase ? 'Supabase PostgreSQL' : 'Data Store Active'}
              </span>
            </div>

            {/* Run Detection Button */}
            {onRunDetection && (
              <button
                onClick={onRunDetection}
                disabled={isRunningDetection}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                title="Execute statistical demand anomaly detection across active stores"
              >
                {isRunningDetection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing POS...</span>
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
              <div className="flex items-center space-x-2.5 pl-2.5 border-l border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                      {user.name || user.email.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {user.storeName || user.role || 'Associate'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  title="Sign out of StockSentinel AI"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white px-3 py-1.5 rounded-lg transition-colors shadow-xs"
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
              aria-label="Toggle navigation menu"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-2 pb-4 space-y-2 shadow-lg">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-semibold ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-600/30'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5 text-emerald-700" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Database: {isSupabase ? 'Supabase PostgreSQL' : 'Local Store Active'}</span>
              {user && (
                <span className="text-emerald-800 font-semibold">
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
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
                >
                  {isRunningDetection ? 'Analyzing POS...' : 'Run Detection'}
                </button>
              )}

              {user ? (
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await handleSignOut();
                  }}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2 w-full">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-semibold bg-[#064e3b] text-white"
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
