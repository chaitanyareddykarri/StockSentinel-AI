'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import {
  Award,
  DollarSign,
  BarChart3,
  Sliders,
  TrendingUp,
  Package,
  ShieldCheck,
  Info,
  Calculator,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Alert, DashboardMetrics, Store } from '@/types';
import {
  calculateRoiSimulation,
  calculateCategoryVulnerability,
  OFFLINE_EVALUATE_BENCHMARK,
  INDUSTRY_REFERENCE_CATEGORIES,
  CurrencyCode,
} from '@/lib/analytics';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>(() =>
    user?.accessState === 'STORE_MANAGER' && user.assignedStoreId ? user.assignedStoreId : 'ALL'
  );
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSupabase, setIsSupabase] = useState<boolean>(false);
  const [showReferenceBaseline, setShowReferenceBaseline] = useState<boolean>(false);

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMonitoredSkus: 0,
    activeStores: 0,
    flaggedPhantomStockouts: 0,
    criticalAlerts: 0,
    estRevenueAtRiskDaily: 0,
    verificationRate: 0,
    verifiedCount: 0,
    precisionAt20: 0,
    timeSeries: [],
  });

  const [dailyWalks, setDailyWalks] = useState<number>(12);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [showCalculationSteps, setShowCalculationSteps] = useState<boolean>(true);

  // Access State Protection: Redirect pending or suspended accounts
  useEffect(() => {
    if (authLoading) return;
    if (user?.accessState === 'PENDING_ASSIGNMENT' || user?.accessState === 'SUSPENDED') {
      router.push('/access-status');
    }
  }, [user, authLoading, router]);

  // Lock selected store scope for Store Managers
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted && user?.accessState === 'STORE_MANAGER' && user.assignedStoreId) {
        setSelectedStore(user.assignedStoreId);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch live operational telemetry
  const fetchData = useCallback(
    async (storeScope?: string) => {
      try {
        setLoading(true);
        const effectiveStore =
          storeScope !== undefined
            ? storeScope
            : user?.accessState === 'STORE_MANAGER' && user.assignedStoreId
            ? user.assignedStoreId
            : selectedStore;

        const queryParam =
          effectiveStore && effectiveStore !== 'ALL'
            ? `?storeId=${encodeURIComponent(effectiveStore)}`
            : '';

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null;
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const [alertsRes, metricsRes] = await Promise.all([
          fetch(`/api/alerts${queryParam}`, { headers }),
          fetch(`/api/metrics${queryParam}`, { headers }),
        ]);

        if (alertsRes.status === 401 || metricsRes.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (alertsRes.status === 403 || metricsRes.status === 403) {
          window.location.href = '/access-status?status=pending';
          return;
        }

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          if (metricsData.metrics) setMetrics(metricsData.metrics);
          if (metricsData.stores) setStores(metricsData.stores);
          if (metricsData.storageType === 'SUPABASE_POSTGRESQL') setIsSupabase(true);
        }

        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          if (alertsData.alerts) setAlerts(alertsData.alerts);
        }
      } catch (err) {
        console.error('Failed to load analytics telemetry:', err);
      } finally {
        setLoading(false);
      }
    },
    [user, selectedStore]
  );

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted) {
        await fetchData();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const handleStoreChange = (storeId: string) => {
    if (user?.accessState === 'STORE_MANAGER') return;
    setSelectedStore(storeId);
    fetchData(storeId);
  };

  // ROI Simulation calculations
  const simulation = useMemo(
    () =>
      calculateRoiSimulation({
        dailyWalks,
        currency,
        avgLostPerPhantom: currency === 'INR' ? 3850 : 48.5,
      }),
    [dailyWalks, currency]
  );

  // Authentic department vulnerability from live operational alerts
  const liveCategories = useMemo(
    () => calculateCategoryVulnerability(alerts),
    [alerts]
  );

  const displayedCategories =
    liveCategories.length > 0
      ? liveCategories
      : showReferenceBaseline
      ? INDUSTRY_REFERENCE_CATEGORIES
      : [];

  return (
    <AppShell
      title="Benchmark Evaluation & Revenue Intelligence"
      subtitle="Standardized model metrics, Precision@20 benchmarks, department vulnerability, and recovery ROI simulation."
      badge={
        loading ? (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded animate-pulse">
            Syncing Telemetry...
          </span>
        ) : undefined
      }
      stores={stores}
      selectedStore={selectedStore}
      onStoreChange={handleStoreChange}
      openAlertsCount={metrics.flaggedPhantomStockouts}
    >
      {/* 1. Live Operational Telemetry (Authenticated Tenant Context) */}
      <section className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Live Operational Telemetry (Authenticated Tenant Data)
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
              Scope:{' '}
              {user?.accessState === 'STORE_MANAGER'
                ? user.assignedStoreName || user.storeName || 'Assigned Store'
                : selectedStore === 'ALL'
                ? `${user?.companyName || 'Company'} (All Stores)`
                : stores.find((s) => s.id === selectedStore)?.name || selectedStore}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                isSupabase
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isSupabase ? 'Supabase PostgreSQL' : 'Persistent Store'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Monitored Catalog
            </p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {metrics.totalMonitoredSkus}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Across {metrics.activeStores} active store{metrics.activeStores === 1 ? '' : 's'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Open Phantom Alerts
            </p>
            <h3 className="text-2xl font-extrabold text-amber-700 mt-1">
              {metrics.flaggedPhantomStockouts}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {metrics.criticalAlerts} critical anomalies
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Live Revenue at Risk
            </p>
            <h3 className="text-2xl font-extrabold text-rose-700 mt-1">
              ${metrics.estRevenueAtRiskDaily.toFixed(2)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Estimated daily loss</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Audited Precision
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-700 mt-1">
              {metrics.verifiedCount > 0 ? `${metrics.precisionAt20}%` : 'N/A'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {metrics.verifiedCount > 0
                ? `${metrics.verifiedCount} audits logged`
                : 'Awaiting shelf audits'}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 italic">
          * Operational metrics reflect real records in PostgreSQL for the authenticated tenant.
          Operational Precision is calculated solely from recorded associate shelf-walk verification outcomes.
        </p>
      </section>

      {/* 2. Benchmark Evaluation Card (Offline Standard: evaluate.py) */}
      <section className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Algorithm Benchmark Evaluation (Offline Standard: evaluate.py)
            </h2>
          </div>
          <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 self-start sm:self-auto">
            Synthetic Benchmark • Protocol: Top-20 Investigation List
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Precision@20
              </p>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded">
                BENCHMARK
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-emerald-700 mt-1">
              {OFFLINE_EVALUATE_BENCHMARK.precisionAt20}%
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Top-20 walk quality</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Recall (Top 20)
              </p>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded">
                BENCHMARK
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-indigo-700 mt-1">
              {OFFLINE_EVALUATE_BENCHMARK.recallTop20}%
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {OFFLINE_EVALUATE_BENCHMARK.detectedTruePhantoms} /{' '}
              {OFFLINE_EVALUATE_BENCHMARK.totalDatasetPhantoms} phantoms caught
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Average Rank
              </p>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded">
                BENCHMARK
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-amber-700 mt-1">
              #{OFFLINE_EVALUATE_BENCHMARK.avgRankOfPhantoms}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Prioritized at top of list</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                F1-Score
              </p>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded">
                BENCHMARK
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-teal-700 mt-1">
              {OFFLINE_EVALUATE_BENCHMARK.f1Score}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Harmonic mean</p>
          </div>
        </div>

        <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-start space-x-2 text-xs text-emerald-900">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p>
            <strong>Standard Evaluation Protocol:</strong> Benchmark evaluated over a standardized
            synthetic test dataset ({OFFLINE_EVALUATE_BENCHMARK.datasetStores} stores,{' '}
            {OFFLINE_EVALUATE_BENCHMARK.datasetSkus} SKUs, {OFFLINE_EVALUATE_BENCHMARK.datasetDays} days,
            seed: 2026) with hidden ground-truth labels by <code className="bg-emerald-100/70 px-1 rounded text-emerald-950 font-mono">evaluate.py</code>.
            Operational production tables in PostgreSQL do not contain synthetic labels; live operational accuracy is validated exclusively via physical associate verification audits.
          </p>
        </div>
      </section>

      {/* 3. Two Column Layout: Revenue ROI Calculator & Category Vulnerability */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Revenue Recovery Simulator */}
        <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                <DollarSign className="w-5 h-5 text-emerald-700" />
                <h2>Recovered Revenue Impact Simulator</h2>
              </div>
              {/* Currency Selector */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCurrency('INR')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    currency === 'INR'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  INR (Problem R1)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Interactive scenario projection estimating potential sales recovered when store associates
              physically restock flagged phantom stock-outs.
            </p>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Daily Shelf Walks Investigated:</span>
              </span>
              <span className="font-bold text-emerald-800 font-mono text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                {dailyWalks} walks/day
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={dailyWalks}
              onChange={(e) => setDailyWalks(parseInt(e.target.value, 10))}
              className="w-full accent-[#064e3b] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>2 walks min</span>
              <span>10 walks standard</span>
              <span>20 walks max</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Est. Monthly Opportunity
              </span>
              <h4 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                {simulation.formattedMonthly}
              </h4>
              <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                {currency === 'INR' ? `Approx $${simulation.monthlyRecovered.toLocaleString()} USD` : 'Direct shelf recovery potential'}
              </p>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                Est. Annual Opportunity
              </span>
              <h4 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                {currency === 'INR' ? simulation.formattedIndianSummary : simulation.formattedAnnual}
              </h4>
              <p className="text-[10px] text-indigo-700 mt-0.5 font-medium">
                {currency === 'INR'
                  ? `INR ${simulation.annualRecoveredRupees.toLocaleString('en-IN')}`
                  : `Approx ${simulation.formattedIndianSummary} INR`}
              </p>
            </div>
          </div>

          {/* Transparent Calculation Breakdown Accordion (Problem R1 Outcome) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <Calculator className="w-4 h-4 text-emerald-700" />
                <span>Transparent Calculation Breakdown (Problem R1 Outcome)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculationSteps((prev) => !prev)}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-0.5 cursor-pointer"
              >
                <span>{showCalculationSteps ? 'Collapse' : 'Expand'}</span>
                {showCalculationSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showCalculationSteps && (
              <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                {simulation.calculationSteps.map((step, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] py-1 border-b border-slate-200/40 last:border-b-0 gap-1">
                    <span className="font-semibold text-slate-700">{step.label}</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-500">{step.expression}</span>
                      <span className="font-mono font-bold text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {step.result}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Department Vulnerability Ranking */}
        <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base mb-1">
                <BarChart3 className="w-5 h-5 text-indigo-700" />
                <h2>Department Vulnerability Index</h2>
              </div>
              <p className="text-xs text-slate-500">
                Categories with high replenishment friction and frequent backroom staging delays.
              </p>
            </div>
            {liveCategories.length > 0 ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Live Incidents ({alerts.length})
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {showReferenceBaseline ? 'Reference Baseline' : 'Empty (No Alerts)'}
              </span>
            )}
          </div>

          {liveCategories.length > 0 ? (
            <div className="space-y-3">
              {displayedCategories.map((cat) => (
                <div
                  key={cat.name}
                  className="space-y-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{cat.name}</span>
                    <span className="text-slate-500">
                      Vulnerability:{' '}
                      <span className="text-emerald-800 font-bold">{cat.riskIndex}/100</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      style={{ width: `${cat.riskIndex}%` }}
                      className={`h-full rounded-full ${cat.barColor}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>
                      Incidents: {cat.incidentCount} ({cat.incidentRate})
                    </span>
                    <span>Avg stockout streak: {cat.avgStockoutDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center space-y-2">
                <Package className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  No Active Phantom Incidents Flagged
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Upload daily sales and inventory records, then run detection to calculate real department vulnerability scores from flagged anomalies.
                </p>
                <button
                  onClick={() => setShowReferenceBaseline((prev) => !prev)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer pt-1 inline-block"
                >
                  {showReferenceBaseline
                    ? 'Hide Reference Baseline'
                    : 'Show Industry Benchmark Reference (evaluate.py Standard)'}
                </button>
              </div>

              {showReferenceBaseline && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400 font-medium italic">
                    Industry reference distribution (offline synthetic baseline):
                  </p>
                  {INDUSTRY_REFERENCE_CATEGORIES.map((cat) => (
                    <div
                      key={cat.name}
                      className="space-y-1 bg-slate-50/50 p-2 rounded-lg border border-slate-200/50"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{cat.name}</span>
                        <span className="text-slate-400 text-[11px]">
                          Vulnerability: <span className="font-bold text-slate-600">{cat.riskIndex}/100</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          style={{ width: `${cat.riskIndex}%` }}
                          className={`h-full rounded-full ${cat.barColor}`}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Share: {cat.incidentRate}</span>
                        <span>Avg delay: {cat.avgStockoutDays} days</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center space-x-1.5 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>High-vulnerability departments should receive priority early morning shelf walks.</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
