'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  BellRing,
  LineChart,
  FileSpreadsheet,
  Settings,
  Database,
  LogOut,
  User as UserIcon,
  X,
  Sparkles,
  ShieldCheck,
  Building2,
  Mail,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  openAlertsCount?: number;
  isSupabase?: boolean;
}

export function Sidebar({
  mobileOpen = false,
  onCloseMobile,
  openAlertsCount = 0,
  isSupabase = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    if (onCloseMobile) onCloseMobile();
    await signOut();
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(user?.accessState === 'PLATFORM_ADMIN'
      ? [{ href: '/admin', label: 'Platform Admin', icon: ShieldCheck }]
      : []),
    ...(user?.accessState === 'COMPANY_MANAGER' || user?.accessState === 'PLATFORM_ADMIN'
      ? [{ href: '/stores', label: 'Store Network', icon: Building2 }]
      : []),
    ...(user?.accessState === 'STORE_MANAGER'
      ? [{ href: '/invitations', label: 'Invitations', icon: Mail }]
      : []),
    { href: '/alerts', label: 'Alerts Queue', icon: BellRing, badge: openAlertsCount > 0 ? openAlertsCount : undefined },
    { href: '/analytics', label: 'Analytics & ROI', icon: LineChart },
    { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
    { href: '/import', label: 'CSV Ingestion', icon: FileSpreadsheet },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90 text-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <Link
          href={user ? '/dashboard' : '/'}
          onClick={onCloseMobile}
          className="flex items-center space-x-2.5 group"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#064e3b] p-1 flex items-center justify-center shadow-xs border border-emerald-700/30 group-hover:scale-105 transition-transform shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/stocksentinel-logo.png"
              alt="StockSentinel AI"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base text-slate-900 tracking-tight">StockSentinel</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-600/25">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Retail Operations</p>
          </div>
        </Link>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav aria-label="Sidebar Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Workflows
        </div>
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className="truncate">{link.label}</span>
              </div>
              {link.badge !== undefined && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-emerald-200/70 text-emerald-900'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section: Storage & User Profile */}
      <div className="p-3 border-t border-slate-100 space-y-3 bg-slate-50/50">
        {/* Persistence Status */}
        <div
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 text-[11px] text-slate-600 shadow-2xs"
          title={isSupabase ? 'Connected to persistent Supabase PostgreSQL database' : 'Connected to local persistent JSON store'}
        >
          <Database className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="truncate font-medium">
            {isSupabase ? 'Supabase PostgreSQL' : 'Local Data Store'}
          </span>
        </div>

        {/* User Card */}
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 border border-emerald-200 text-xs">
                {user.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user.name || user.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 truncate font-medium">
                  {user.accessState === 'PLATFORM_ADMIN'
                    ? 'Platform Admin'
                    : user.accessState === 'COMPANY_MANAGER'
                    ? (user.companyName ? `${user.companyName}` : 'Company Manager')
                    : user.accessState === 'STORE_MANAGER'
                    ? (user.assignedStoreName || user.storeName || 'Store Manager')
                    : user.accessState === 'PENDING_ASSIGNMENT'
                    ? 'Pending Assignment'
                    : (user.storeName || user.role || 'Associate')}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign out of StockSentinel AI"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Link
              href="/login"
              className="flex-1 text-center py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex-1 text-center py-2 rounded-lg text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (w-64 = 256px) */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-full z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Slide-over */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
