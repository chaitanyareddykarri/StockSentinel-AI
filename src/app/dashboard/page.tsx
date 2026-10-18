'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MetricCard } from '@/components/MetricCard';
import { AlertTable } from '@/components/AlertTable';
import { AlertDetailModal } from '@/components/AlertDetailModal';
import { RiskDistributionChart } from '@/components/RiskDistributionChart';
import { RecentRunsTable } from '@/components/RecentRunsTable';
import { RecentAuditFeed } from '@/components/RecentAuditFeed';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  Alert,
  AuditLogEntry,
  DashboardMetrics,
  DetectionRun,
  Store,
} from '@/types';
import {
  Package,
  Store as StoreIcon,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  Award,
  Sparkles,
  Info,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const [stores, setStores] = useState<Store[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [runs, setRuns] = useState<DetectionRun[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMonitoredSkus: 0,
    activeStores: 0,
    flaggedPhantomStockouts: 0,
    criticalAlerts: 0,
    estRevenueAtRiskDaily: 0,
    verificationRate: 0,
    verifiedCount: 0,
    precisionAt20: 0,
  });

  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isRunningDetection, setIsRunningDetection] = useState<boolean>(false);

  // Load data callback for refreshing
  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, metricsRes] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/metrics'),
      ]);

      const alertsData = await alertsRes.json();
      const metricsData = await metricsRes.json();

      if (alertsData.alerts) setAlerts(alertsData.alerts);
      if (metricsData.metrics) setMetrics(metricsData.metrics);

      // Pre-extract unique stores from alerts
      const storeMap = new Map<string, Store>();
      alertsData.alerts?.forEach((a: Alert) => {
        if (!storeMap.has(a.store_id)) {
          storeMap.set(a.store_id, {
            id: a.store_id,
            code: a.store_id.toUpperCase(),
            name: a.store_name,
            location: 'Retail Store',
            store_type: 'Supercenter',
            created_at: new Date().toISOString(),
          });
        }
      });
      setStores(Array.from(storeMap.values()));

      // Fetch runs and audit logs
      const auditRes = await fetch('/api/alerts/audit');
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (auditData.auditLogs) setAuditLogs(auditData.auditLogs);
        if (auditData.runs) setRuns(auditData.runs);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleRunDetection = async () => {
    setIsRunningDetection(true);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: selectedStore }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      }
    } finally {
      setIsRunningDetection(false);
    }
  };

  const handleAlertUpdated = (updated: Alert) => {
    setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAlert(updated);
    fetchData(); // Refresh metrics
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
      <Navbar onRunDetection={handleRunDetection} isRunningDetection={isRunningDetection} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner: Transparent Mode Notice */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-indigo-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-white">
                  StockSentinel AI — Retail Inventory Intelligence Platform
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Baseline Analysis Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Detects phantom stock-outs: items showing positive on-hand inventory but experiencing unexpected consecutive zero-sales days.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 whitespace-nowrap self-end sm:self-center">
            <Info className="w-4 h-4 text-slate-500" />
            <span>Top 20 candidates prioritized per store</span>
          </div>
        </div>

        {/* Top KPI Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <MetricCard
            title="Monitored SKUs"
            value={metrics.totalMonitoredSkus}
            subtitle="Across active stores"
            icon={Package}
            color="indigo"
          />

          <MetricCard
            title="Active Stores"
            value={metrics.activeStores}
            subtitle="Real-time telemetry"
            icon={StoreIcon}
            color="cyan"
          />

          <MetricCard
            title="Flagged Phantoms"
            value={metrics.flaggedPhantomStockouts}
            subtitle={`${metrics.criticalAlerts} Critical urgency`}
            icon={AlertTriangle}
            color="rose"
            badge="Urgent"
            trendType="negative"
          />

          <MetricCard
            title="Est. Loss / Day"
            value={`$${metrics.estRevenueAtRiskDaily}`}
            subtitle="From unworked shelves"
            icon={DollarSign}
            color="amber"
          />

          <MetricCard
            title="Verified Rate"
            value={`${metrics.verificationRate}%`}
            subtitle={`${metrics.verifiedCount} walks completed`}
            icon={CheckCircle}
            color="emerald"
            trendType="positive"
          />

          <MetricCard
            title="Precision@20"
            value={`${metrics.precisionAt20}%`}
            subtitle="Benchmark standard"
            icon={Award}
            color="emerald"
            badge="Ranked"
          />
        </div>

        {/* Onboarding Empty Banner when no alerts */}
        {!loading && alerts.length === 0 && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-dashed border-emerald-500/30 text-center space-y-4 bg-slate-900/40 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="max-w-lg mx-auto space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-white">
                No Phantom Stock-Out Alerts Flagged Yet
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Import your store catalog, sales history, and on-hand inventory snapshots through the CSV ingestion suite, or click &quot;Run Detection&quot; to execute the statistical baseline analysis across active stores.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/import"
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Import Inventory CSV</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Main Alert Table */}
        <AlertTable
          alerts={alerts}
          stores={stores}
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onSelectAlert={(alt) => setSelectedAlert(alt)}
          title="Top 20 Suspicious SKU-Store Combinations (Daily Walk List)"
        />

        {/* Supporting Visualizers & Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RiskDistributionChart alerts={alerts} />
          <RecentRunsTable runs={runs} />
          <RecentAuditFeed auditLogs={auditLogs} />
        </div>
      </main>

      {/* Modal for Investigation & Shelf Walk */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAlertUpdated={handleAlertUpdated}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500">
        <p>StockSentinel AI — AI Frontier Challenge 2026 Round 1 Submission • Vercel-Ready Architecture</p>
      </footer>
    </div>
  );
}
