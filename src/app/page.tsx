'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Layers,
  LogIn,
  Sliders,
  AlertTriangle,
  Package,
  DollarSign,
  Check,
  TrendingDown,
  Activity,
  ShieldCheck,
  ClipboardCheck,
  Store,
  FileSpreadsheet,
} from 'lucide-react';

// Lightweight, reversible scroll-reveal component respecting prefers-reduced-motion
function ScrollReveal({
  children,
  className = '',
  animation = 'fade-up',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale-in';
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Reversible animation: settles when entering, separates when scrolling away
        setSettled(entry.isIntersecting);
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animationClass =
    animation === 'fade-left'
      ? 'scroll-fade-left'
      : animation === 'fade-right'
      ? 'scroll-fade-right'
      : animation === 'scale-in'
      ? 'scroll-scale-in'
      : 'scroll-fade-up';

  return (
    <div
      ref={ref}
      style={{ transitionDelay: delay > 0 ? `${delay}ms` : undefined }}
      className={`${animationClass} ${settled ? 'settled' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export default function IntroPage() {
  const { user } = useAuth();

  // Instant render - no artificial delay or blocking splash
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/25 to-slate-50 text-slate-900 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-md border-b border-emerald-100/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo with Official Brand Asset */}
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-950 p-1 flex items-center justify-center shadow-md shadow-emerald-900/10 group-hover:scale-102 transition-transform border border-emerald-900/40 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/stocksentinel-logo.png"
                  alt="StockSentinel AI Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg text-slate-900 tracking-tight">StockSentinel</span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-[#064e3b] border border-emerald-200">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Retail Phantom Stock-Out Detector</p>
              </div>
            </Link>

            {/* In-page Anchor Links */}
            <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
              <a href="#discrepancy" className="hover:text-[#064e3b] transition-colors">
                The Discrepancy
              </a>
              <a href="#engine" className="hover:text-[#064e3b] transition-colors">
                Poisson Engine
              </a>
              <a href="#capabilities" className="hover:text-[#064e3b] transition-colors">
                Capabilities
              </a>
              <a href="#workflow" className="hover:text-[#064e3b] transition-colors">
                Workflow
              </a>
            </nav>

            {/* Quick Links & Auth CTA */}
            <div className="flex items-center space-x-3">
              {user ? (
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-emerald-50/80 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Sign In</span>
                  </Link>

                  <Link
                    href="/signup"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
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

      {/* 1. HERO SECTION: Split-Screen Layout with Floating Dashboard Preview */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24">
        {/* Soft background ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-200/30 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Column: Value Proposition & Action CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Challenge Badge */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-[#064e3b] text-xs font-semibold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>AI Frontier Challenge 2026 • Retail Inventory Intelligence</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.08]">
                Detect Hidden Stock Loss.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#064e3b] via-emerald-600 to-teal-600">
                  Recover Missed Sales.
                </span>
              </h1>

              {/* Clear Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Uncover retail <strong className="text-slate-800 font-semibold">phantom stock-outs</strong>: high-demand products recorded as available in ERP inventory systems, but physically missing, misplaced, or depleted from the sales floor.
              </p>

              {/* Key Assurance Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-slate-700">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[#064e3b] shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Explainable Poisson Anomaly Engine</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[#064e3b] shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Top 20 Daily Morning Shelf Walks</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[#064e3b] shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Zero-Config Demo Dataset Included</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[#064e3b] shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Associate Audit & Root Cause Trail</span>
                </div>
              </div>

              {/* Call-to-Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Link
                  href={user ? '/dashboard' : '/signup'}
                  className="flex items-center space-x-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-lg shadow-emerald-900/15 hover:shadow-xl hover:shadow-emerald-900/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>{user ? 'Go to Dashboard' : 'Start Associate Walk'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href={user ? '/alerts' : '/login'}
                  className="flex items-center space-x-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-200 shadow-xs transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-emerald-700" />
                  <span>{user ? 'View Alert Queue' : 'Sign In'}</span>
                </Link>
              </div>

              {/* Demo Account Quick Note */}
              <p className="text-xs text-slate-500 pt-1">
                Evaluation demo pre-loaded with 3 supercenters, 30 active SKUs, and 60 days of retail telemetry.
              </p>
            </div>

            {/* Right Column: Polished Illustrative Dashboard Preview Card with Subtle Float */}
            <div className="lg:col-span-5">
              <div className="relative animate-subtle-float">
                {/* Floating pill: Illustrative badge */}
                <div className="absolute -top-3 right-4 z-20">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#064e3b] text-emerald-100 border border-emerald-700 shadow-md">
                    Illustrative Simulation
                  </span>
                </div>

                {/* Dashboard Card Shell */}
                <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-emerald-200/80 bg-white/95 shadow-xl shadow-emerald-900/5 space-y-4">
                  {/* Top Header of Preview */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-gentle-pulse" />
                      <span className="text-xs font-bold text-slate-800">Downtown Supercenter #101</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">Morning Walk List</span>
                  </div>

                  {/* Illustrative Summary Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 text-left">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center space-x-1 text-slate-500 text-[10px]">
                        <Package className="w-3 h-3 text-emerald-700" />
                        <span>Monitored</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 mt-0.5">90 SKUs</p>
                    </div>

                    <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-100">
                      <div className="flex items-center space-x-1 text-rose-700 text-[10px]">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Flagged</span>
                      </div>
                      <p className="text-sm font-black text-rose-700 mt-0.5">14 Alerts</p>
                    </div>

                    <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100">
                      <div className="flex items-center space-x-1 text-amber-700 text-[10px]">
                        <DollarSign className="w-3 h-3 text-amber-600" />
                        <span>Est. Loss</span>
                      </div>
                      <p className="text-sm font-black text-amber-800 mt-0.5">$486 / day</p>
                    </div>
                  </div>

                  {/* Illustrative Priority Candidate Alert */}
                  <div className="p-4 rounded-2xl bg-white border border-rose-200/90 shadow-xs space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>CRITICAL RISK (92/100)</span>
                      </span>
                      <span className="text-[10px] font-mono font-medium text-slate-500">Rank #1 • SKU-104</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Electrolyte Citrus Rush 16oz</h4>
                      <p className="text-[11px] text-slate-500">Beverages Aisle 4 • Unit Price: $2.99</p>
                    </div>

                    {/* Discrepancy comparison: System vs Reality */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-medium">System Records</span>
                        <p className="font-extrabold text-[#064e3b] text-sm mt-0.5">26 Units</p>
                      </div>
                      <div className="bg-rose-50 p-2 rounded-lg border border-rose-100">
                        <span className="text-[10px] text-rose-700 font-medium">Physical Shelf</span>
                        <p className="font-extrabold text-rose-700 text-sm mt-0.5">0 Units (Empty)</p>
                      </div>
                    </div>

                    {/* Key statistical anomaly markers */}
                    <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 text-[11px] text-slate-700 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Consecutive Zero Sales:</span>
                        <span className="font-bold text-rose-700">5 Days (Active Promo)</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Expected Daily Demand:</span>
                        <span className="font-bold text-slate-800">5.5 units/day</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Poisson Zero Probability:</span>
                        <span className="font-bold text-[#064e3b]">&lt; 0.01% anomaly</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Link */}
                  <div className="pt-1">
                    <Link
                      href={user ? '/dashboard' : '/login'}
                      className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] border border-emerald-200 transition-colors"
                    >
                      <span>Explore Live Investigation Queue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE RETAIL STOCK-MISMATCH PROBLEM: Reversible Scroll-Animated Discrepancy Story */}
      <section id="discrepancy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full scroll-mt-20">
        <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-emerald-100 bg-white shadow-lg space-y-10">
          {/* Section Header */}
          <ScrollReveal animation="fade-up" className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#064e3b] bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
              The Discrepancy Story
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Recorded Stock Positive, Physical Shelf Empty
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              When enterprise inventory records show healthy positive inventory, automated replenishment halts. But on the sales floor, the shelf is completely vacant.
            </p>
          </ScrollReveal>

          {/* Reversible Side-by-Side Story Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Left Card: Digital ERP Record */}
            <ScrollReveal animation="fade-left" delay={50} className="h-full">
              <div className="p-6 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 flex flex-col justify-between space-y-4 h-full shadow-xs">
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-200 text-[#064e3b] shrink-0">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-900 text-sm">Enterprise ERP Inventory</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-[#064e3b] font-bold">
                        Digital Record
                      </span>
                    </div>
                    <p className="text-3xl font-black text-[#064e3b] mt-1.5">+26 Units Recorded</p>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Central supply chain algorithms view inventory as healthy. Automated purchase orders and distribution center transfers are completely suppressed.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-100 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>Supply Chain Action:</span>
                  <strong className="text-[#064e3b] font-semibold">Replenishment Blocked</strong>
                </div>
              </div>
            </ScrollReveal>

            {/* Right Card: Physical Store Shelf Reality */}
            <ScrollReveal animation="fade-right" delay={50} className="h-full">
              <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col justify-between space-y-4 h-full shadow-xs">
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 shrink-0">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-900 text-sm">Physical Sales Floor Shelf</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                        Physical Reality
                      </span>
                    </div>
                    <p className="text-3xl font-black text-rose-700 mt-1.5">0 Units On-Shelf (Empty)</p>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Merchandise was misplaced into adjacent aisles, trapped on unworked backroom pallets, or lost to shrink. Daily sales plummet to zero for 5 straight days.
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-rose-200 text-[11px] text-rose-700 flex items-center justify-between">
                  <span>Customer Impact:</span>
                  <strong className="text-rose-800 font-semibold">Walked Away Without Buying</strong>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Center Connection Bridge: The Suspicious Stock Alert */}
          <ScrollReveal animation="scale-in" delay={150}>
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#064e3b] to-slate-900 text-white shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/60 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      StockSentinel AI Bridge
                    </span>
                    <h4 className="text-sm font-bold text-white">Phantom Stock-Out Alert #104</h4>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 border border-rose-400/30 text-rose-300">
                    Confidence: 92 / 100
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                    Rank #1 Daily Walk
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-[11px]">Expected 5-Day Velocity:</span>
                  <p className="font-bold text-emerald-300 text-sm mt-0.5">27.5 Units</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-[11px]">Actual Observed POS Sales:</span>
                  <p className="font-bold text-rose-300 text-sm mt-0.5">0 Units Sold</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-[11px]">Poisson Anomaly Probability:</span>
                  <p className="font-bold text-amber-300 text-sm mt-0.5">P(X = 0) &lt; 0.0001%</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed pt-1">
                Because this fast-moving product normally sells 5.5 units/day during active feature promotions, 5 consecutive days of zero sales while 26 units exist in ERP inventory represents a statistically impossible natural event. An associate is dispatched directly to Aisle 4 for immediate physical resolution.
              </p>
            </div>
          </ScrollReveal>

          {/* 4 In-Store Root Cause Outcomes Tracked by the Engine */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
              The 4 Operational Root Causes Classified by In-Store Audits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left">
              <ScrollReveal animation="fade-up" delay={50} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#064e3b] flex items-center justify-center font-bold text-xs mb-2">
                  1
                </div>
                <h4 className="text-xs font-bold text-slate-900">Displaced in Backroom</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Carton received at receiving dock but left unworked on high backroom pallet racking.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delay={100} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#064e3b] flex items-center justify-center font-bold text-xs mb-2">
                  2
                </div>
                <h4 className="text-xs font-bold text-slate-900">Cross-Shelved / Wrong Peg</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Item shoved behind adjacent slow-moving merchandise or merchandised on the wrong shelf peg.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delay={150} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#064e3b] flex items-center justify-center font-bold text-xs mb-2">
                  3
                </div>
                <h4 className="text-xs font-bold text-slate-900">Unrecorded Shrinkage</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Lost to store theft or damaged inventory discarded without POS barcode scanner write-off.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delay={200} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#064e3b] flex items-center justify-center font-bold text-xs mb-2">
                  4
                </div>
                <h4 className="text-xs font-bold text-slate-900">Cashier Scanning Error</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Checkout associate scanned an adjacent variant multiple times, leaving this barcode unrecorded.
                </p>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW THE EXISTING DETECTION ALGORITHM WORKS: Explainable Poisson Engine */}
      <section id="engine" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full scroll-mt-20 space-y-10">
        <ScrollReveal animation="fade-up" className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#064e3b] bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            Explainable Algorithm Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            How StockSentinel AI Detects Phantom Stock
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Every alert is governed by empirical store telemetry and explainable Poisson distribution calculations—no opaque black boxes or mysterious guesswork.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ScrollReveal animation="fade-up" delay={50} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#064e3b] tracking-wider uppercase">Step 1 • Telemetry</span>
            <h3 className="text-base font-bold text-slate-900">Positive Stock Filter</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ingests 14-day daily sales history and filters exclusively for items with positive on-hand inventory (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">stock &gt; 0</code>) and a minimum consecutive streak of zero-sales days.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={100} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#064e3b] tracking-wider uppercase">Step 2 • Dynamics</span>
            <h3 className="text-base font-bold text-slate-900">Traffic & Promo Multipliers</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scales baseline product velocity by day-of-week retail foot-traffic multipliers (Sunday 1.35x, Friday 1.30x, Saturday 1.45x) and active promotional campaigns (1.6x lift).
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={150} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#064e3b] tracking-wider uppercase">Step 3 • Probability</span>
            <h3 className="text-base font-bold text-slate-900">Poisson Zero Probability</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Computes cumulative expected demand <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">&lambda;</code> and evaluates <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">P(X = 0) = exp(-&lambda;)</code>. When p-value falls below 0.01, it confirms a genuine shelf anomaly.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={200} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#064e3b] tracking-wider uppercase">Step 4 • Protection</span>
            <h3 className="text-base font-bold text-slate-900">Slow-Mover Shield</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Guards low-velocity items (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">&lt; 0.6 units/day</code>) from false alarms. Combines Poisson p-value, zero-day factor, and stock buffer into a normalized 0–100 confidence score.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* 4. THREE CORE CAPABILITIES: For Store Operations Teams */}
      <section id="capabilities" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full scroll-mt-20 space-y-10">
        <ScrollReveal animation="fade-up" className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#064e3b] bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            Core Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Built for Store Operations Teams
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Three purpose-built capabilities engineered to empower store associates without alert fatigue.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScrollReveal animation="fade-up" delay={50} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Demand-Aware Anomaly Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Calculates expected daily velocity taking into account day-of-week traffic cycles, active promotions, positive inventory thresholds, and slow-moving product shields.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={100} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Top 20 Daily Store Walk List</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Provides store associates each morning with an achievable, ranked queue of up to 20 highest-risk SKU-store pairs sorted by urgency and estimated revenue loss.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={150} className="glass-panel p-6 rounded-2xl border border-emerald-100 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#064e3b]">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Shelf Walk Verification Workflow</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Associates record observed physical shelf counts, classify root causes (backroom displaced, cross-shelved, shrink), and build a perpetual audit trail that unblocks supply replenishment.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* 5. SIMPLE THREE-STEP WORKFLOW */}
      <section id="workflow" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full scroll-mt-20 space-y-10">
        <ScrollReveal animation="fade-up" className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#064e3b] bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            Operational Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            From Store Telemetry to Shelf Recovery
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            A practical, three-step closed loop designed to integrate into everyday retail store routines.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <ScrollReveal animation="fade-up" delay={50} className="p-6 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-[#064e3b] text-white flex items-center justify-center font-bold text-xs">
                1
              </span>
              <Store className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Ingest Store Telemetry</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload daily POS sales transactions and inventory balances via CSV or API feed. Zero-config evaluation dataset ready out of the box.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={100} className="p-6 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-[#064e3b] text-white flex items-center justify-center font-bold text-xs">
                2
              </span>
              <Activity className="w-5 h-5 text-emerald-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Automated Risk Ranking</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Poisson anomaly model computes expected sales versus zero-day streaks, applying slow-mover shields and prioritizing Top 20 morning walk lists.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={150} className="p-6 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-[#064e3b] text-white flex items-center justify-center font-bold text-xs">
                3
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Shelf Walk & Recovery</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Store associates conduct physical audits, record observed counts, classify root causes, and trigger immediate inventory reconciliation.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* 6. CLOSING CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <ScrollReveal animation="scale-in">
          <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-emerald-200 bg-gradient-to-b from-white via-emerald-50/30 to-white shadow-xl text-center space-y-6 max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-[#064e3b] text-xs font-semibold border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ready for Immediate Evaluation</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Eliminate Retail Ghost Inventory Today
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Explore how StockSentinel AI identifies hidden stock discrepancies, prioritizes associate morning walks, and recovers lost store sales.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={user ? '/dashboard' : '/signup'}
                className="flex items-center space-x-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-[#064e3b] hover:bg-[#065f46] text-white shadow-lg shadow-emerald-900/15 transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>{user ? 'Open Retail Dashboard' : 'Get Started Free'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href={user ? '/alerts' : '/login'}
                className="flex items-center space-x-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-200 shadow-xs transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-emerald-700" />
                <span>{user ? 'View Alert Queue' : 'Sign In to Workspace'}</span>
              </Link>
            </div>

            <p className="text-[11px] text-slate-500 pt-2">
              Includes pre-loaded evaluation demo data • 3 stores • 30 SKUs • 60-day retail telemetry
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* 7. PROFESSIONAL SAAS FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: Brand & Logo */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-950 p-1 flex items-center justify-center border border-emerald-900/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/stocksentinel-logo.png"
                    alt="StockSentinel AI Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-slate-900 tracking-tight">StockSentinel</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-[#064e3b] border border-emerald-200">
                    AI
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Retail phantom stock-out detection platform. Continuously analyzes POS sales patterns and on-hand inventory balances to detect hidden zero-sales stock anomalies.
              </p>
              <div className="text-[11px] text-slate-400">
                AI Frontier Challenge 2026 Submission
              </div>
            </div>

            {/* Col 2: Platform Links */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Platform</h4>
              <ul className="space-y-1.5 text-slate-600">
                <li>
                  <Link href="/dashboard" className="hover:text-[#064e3b] transition-colors">
                    Retail Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/alerts" className="hover:text-[#064e3b] transition-colors">
                    Morning Walk Queue
                  </Link>
                </li>
                <li>
                  <Link href="/alerts" className="hover:text-[#064e3b] transition-colors">
                    Shelf Verification
                  </Link>
                </li>
                <li>
                  <Link href="/analytics" className="hover:text-[#064e3b] transition-colors">
                    Store Analytics
                  </Link>
                </li>
                <li>
                  <Link href="/import" className="hover:text-[#064e3b] transition-colors">
                    CSV Telemetry Import
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Architecture & Security */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Architecture</h4>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Poisson Anomaly Engine</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Slow-Mover Shield</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Top 20 Walk Optimizer</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Audit Trail Logging</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© 2026 StockSentinel AI. Built for the AI Frontier Challenge 2026.</p>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="hover:text-slate-900 transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="hover:text-slate-900 transition-colors">
                Get Started
              </Link>
              <span className="text-slate-400">•</span>
              <span className="text-[11px] text-slate-400">All illustrative simulation data labeled for evaluation</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
