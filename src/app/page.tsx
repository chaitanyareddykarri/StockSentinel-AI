'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldAlert,
  ArrowRight,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Layers,
  LogIn,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

export default function IntroPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg text-white tracking-tight">StockSentinel</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Retail Phantom Stock-Out Detector</p>
              </div>
            </div>

            {/* Quick Links & Auth CTA */}
            <div className="flex items-center space-x-3">
              {user ? (
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </Link>

                  <Link
                    href="/signup"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Frontier Challenge 2026 • Retail Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto">
            Detect Hidden Stock Loss.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              Recover Missed Sales.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            StockSentinel AI helps retailers uncover phantom stock-outs: products that appear in-stock in inventory database records, but are physically missing, misplaced, or depleted on the store shelf.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              href={user ? '/dashboard' : '/signup'}
              className="flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-emerald-400" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Visual Example Section: The Phantom Stockout Discrepancy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Visual Risk Diagnostic Example
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              The Phantom Stock-Out Problem
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              When the POS record says in-stock, automated replenishment stops, leaving empty shelves undetected.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* System Record vs Physical Shelf comparison */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex items-start space-x-4">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-white text-sm">Inventory Management System</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Recorded On-Hand
                    </span>
                  </div>
                  <p className="text-2xl font-black text-emerald-400 mt-1">26 Units In Stock</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automated reorder triggers are suppressed because system stock is positive.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/20 flex items-start space-x-4">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-white text-sm">Physical Store Shelf</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold">
                      Physical Reality
                    </span>
                  </div>
                  <p className="text-2xl font-black text-rose-400 mt-1">0 Units On Facing</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Customers cannot find the item. Sales drop to zero despite steady historical demand.
                  </p>
                </div>
              </div>
            </div>

            {/* Generated Sentinel Risk Card */}
            <div className="bg-slate-950/90 p-6 rounded-2xl border border-rose-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  CRITICAL RISK ALERT (92/100)
                </span>
                <span className="font-mono text-xs text-slate-400">SKU-104 • SEA-101</span>
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Electrolyte Citrus Rush 16oz</h4>
                <p className="text-xs text-slate-400">Beverages Department • Unit Price: $2.99</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 text-[10px]">Zero Sales</span>
                  <p className="font-bold text-rose-400 text-sm mt-0.5">5 Days</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 text-[10px]">Expected Rate</span>
                  <p className="font-bold text-white text-sm mt-0.5">5.5/day</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-400 text-[10px]">Poisson Anomaly</span>
                  <p className="font-bold text-indigo-400 text-sm mt-0.5">&lt;0.01%</p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-white/5 text-xs text-slate-300">
                <p className="text-emerald-400 font-semibold mb-0.5 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Explainable AI Diagnostic:</span>
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  High-velocity item with 26 recorded on-hand units has experienced 5 consecutive days of zero sales. Statistical probability of this zero streak given baseline demand is &lt;0.01%. Recommended action: associate shelf audit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Core Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Built for Real-World Retail Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Engineered to prioritize store associates&apos; daily physical audits without false-alarm fatigue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Demand-Aware Anomaly Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates expected daily velocity taking into account day-of-week patterns, store type, active promotions, and slow-moving product shields.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Top 20 Daily Store Walk List</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Provides store managers each morning with an actionable, ranked list of up to 20 highest-risk SKU-store pairs for quick physical verification.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">In-Store Verification Workflow</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Staff record observed shelf counts, classify root cause outcomes (backroom displaced, cross-shelved, shrinkage), and build an audit trail.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-300">StockSentinel AI</span>
            <span>• AI Frontier Challenge 2026 Submission</span>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-slate-300 transition-colors">
              Get Started
            </Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
