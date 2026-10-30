'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import { MetricCard } from '@/components/MetricCard';
import { AlertTable } from '@/components/AlertTable';
import { AlertDetailModal } from '@/components/AlertDetailModal';
import { RiskDistributionChart } from '@/components/RiskDistributionChart';
import { RecentRunsTable } from '@/components/RecentRunsTable';
import { RecentAuditFeed } from '@/components/RecentAuditFeed';
import { SalesInventoryChart } from '@/components/SalesInventoryChart';
import {
  Alert,
  AuditLogEntry,
  DashboardMetrics,
  DetectionRun,
  Store,
} from '@/types';
import { resolveDemoStoreId, isSameOrAliasedStore } from '@/lib/storeResolver';
import {
  Package,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ListFilter,
  Store as StoreIcon,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [runs, setRuns] = useState<DetectionRun[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isRunningDetection, setIsRunningDetection] = useState<boolean>(false);

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

  // Access State Protection: Redirect pending or suspended accounts to /access-status
  useEffect(() => {
    if (authLoading) return;
    if (user?.accessState === 'PENDING_ASSIGNMENT' || user?.accessState === 'SUSPENDED') {
      router.push('/access-status');
    } else if (user?.accessState === 'COMPANY_MANAGER' && user.companyStatus === 'PENDING_ONBOARDING') {
      router.push('/onboarding');
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

  // Load data callback for refreshing
  const fetchData = useCallback(async (storeScope?: string) => {
    try {
      setFetchError(null);
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

      if (!alertsRes.ok || !metricsRes.ok) {
        throw new Error('Unable to retrieve operational telemetry.');
      }

      const alertsData = await alertsRes.json();
      const metricsData = await metricsRes.json();

      if (alertsData.alerts) setAlerts(alertsData.alerts);
      if (metricsData.metrics) setMetrics(metricsData.metrics);

      // Extract unique stores
      if (metricsData.stores && Array.isArray(metricsData.stores) && metricsData.stores.length > 0) {
        setStores((prevStores) => {
          if (storeScope && storeScope !== 'ALL' && prevStores.length > metricsData.stores.length) {
            return prevStores;
          }
          return metricsData.stores;
        });
      } else {
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
        if (storeMap.size > 0) {
          setStores(Array.from(storeMap.values()));
        }
      }

      // Fetch detection runs & audit trail
      const auditRes = await fetch('/api/alerts/audit');
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (auditData.auditLogs) setAuditLogs(auditData.auditLogs);
        if (auditData.runs) setRuns(auditData.runs);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      setFetchError('Failed to load live telemetry. Please check your connection or trigger a new detection run.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedStore, router]);

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
    if (user?.accessState === 'STORE_MANAGER') {
      // Store managers cannot alter store scope
      return;
    }
    setSelectedStore(storeId);
    fetchData(storeId);
  };

  const handleRunDetection = async () => {
    setIsRunningDetection(true);
    setFetchError(null);
    try {
      const targetStore =
        user?.accessState === 'STORE_MANAGER' && user.assignedStoreId
          ? user.assignedStoreId
          : selectedStore;

      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: targetStore }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchData(targetStore);
      } else {
        const errorMsg = data.error || `Detection run failed with status ${res.status}`;
        console.error('Detection run failed:', errorMsg);
        setFetchError(`Detection failed: ${errorMsg}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error during detection run.';
      console.error('Detection run network error:', err);
      setFetchError(`Detection network error: ${errorMsg}`);
    } finally {
      setIsRunningDetection(false);
    }
  };

  const handleAlertUpdated = (updated: Alert) => {
    setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAlert(updated);
    fetchData(); // Refresh metrics dynamically
  };

  const isDemoData =
    stores.some((s) => s.id === 'store-001' || s.id === 'store-002' || s.id === 'store-003' || Boolean(resolveDemoStoreId(s.id))) ||
    alerts.some((a) => a.store_id === 'store-001' || a.store_id === 'store-002' || a.store_id === 'store-003');
  const openAlertsCount = alerts.filter((a) => a.status === 'OPEN' || a.status === 'UNDER_REVIEW').length;

  const visibleStores =
    user?.accessState === 'STORE_MANAGER' && user.assignedStoreId
      ? stores.filter(
          (s) =>
            s.id === user.assignedStoreId ||
            (user.accessibleStoreIds && user.accessibleStoreIds.includes(s.id)) ||
            isSameOrAliasedStore(s.id, user.assignedStoreId)
        )
      : stores;

  return (
    <AppShell
      title="Inventory Operations Command Center"
      subtitle="Real-time phantom stock-out telemetry & morning shelf walk triage"
      stores={visibleStores}
      selectedStore={selectedStore}
      onStoreChange={handleStoreChange}
      isDemoData={isDemoData}
      isRunningDetection={isRunningDetection}
      onRunDetection={handleRunDetection}
      openAlertsCount={openAlertsCount}
    >
      {/* API Error Notification */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => fetchData()}
            className="font-bold underline hover:text-rose-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Overview Introduction & Structured 4-Card KPI Row */}
      <section aria-label="Operational KPI Summary" className="space-y-4">
        {user?.accessState === 'COMPANY_MANAGER' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="p-1.5 rounded-xl bg-emerald-700 text-white shrink-0">
                <StoreIcon className="w-4 h-4" />
              </span>
              <div>
                <span className="font-extrabold text-emerald-950 block">Company Manager Portal Available</span>
                <span className="text-emerald-800">
                  Manage retail stores, invite store managers, and monitor quota allocations for {user.companyName || 'your company'}.
                </span>
              </div>
            </div>
            <Link
              href="/stores"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] shrink-0 transition-colors shadow-2xs"
            >
              <span>Manage Stores & Team</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Operational Store Telemetry
              </h2>
              {user?.assignedStoreName && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                  {user.assignedStoreName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous Poisson scan-velocity evaluation detecting phantom stock-outs: items with positive ERP stock balances experiencing consecutive zero-sales periods.
            </p>
          </div>
        </div>

        {/* Structured 4-Card KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monitored SKU–Store Pairs"
            value={loading ? '...' : metrics.totalMonitoredSkus}
            subtitle="Active store inventory telemetry"
            icon={Package}
            color="indigo"
            tooltip="Total unique SKU and store combinations continuously evaluated by the detection model"
          />

          <MetricCard
            title="Open Suspicious Alerts"
            value={loading ? '...' : metrics.flaggedPhantomStockouts}
            subtitle={`${metrics.criticalAlerts} Critical priority requiring walk`}
            icon={AlertTriangle}
            color="rose"
            badge={metrics.criticalAlerts > 0 ? `${metrics.criticalAlerts} Critical` : undefined}
            trendType="negative"
            tooltip="Items showing positive recorded inventory but zero scans over expected sales windows"
          />

          <MetricCard
            title="Daily Opportunity at Risk"
            value={loading ? '...' : `$${metrics.estRevenueAtRiskDaily.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Potential unrealized demand"
            icon={DollarSign}
            color="amber"
            tooltip="Estimated daily sales opportunity at risk based on historical sales velocity and zero-sales days"
          />

          <MetricCard
            title="Physical Verification Rate"
            value={loading ? '...' : `${metrics.verificationRate}%`}
            subtitle={`${metrics.verifiedCount} associate shelf walks completed`}
            icon={CheckCircle}
            color="emerald"
            trendType="positive"
            tooltip="Percentage of flagged candidates that store associates have physically verified on shelves"
          />
        </div>
      </section>

      {/* Analytics Row: Sales-vs-Stock Chart & Risk Distribution Panel */}
      <section aria-label="Analytics & Risk Distribution" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Substantial Sales-vs-Recorded-Inventory Time-Series Chart */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <SalesInventoryChart timeSeries={metrics.timeSeries} />
        </div>

        {/* Right: Risk Severity Breakdown Panel */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <RiskDistributionChart alerts={alerts} />
        </div>
      </section>

      {/* Priority Verification Queue (Full-Width) */}
      <section aria-label="Priority Verification Queue" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
          <div className="flex items-center space-x-2">
            <ListFilter className="w-4 h-4 text-emerald-700" />
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Priority Verification Queue (Morning Shelf Checks)
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {alerts.length} Ranked
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Link
              href="/alerts"
              className="inline-flex items-center space-x-1 font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
            >
              <span>View Complete Alerts Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Alert Table Component */}
        <AlertTable
          alerts={alerts}
          stores={stores}
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onSelectAlert={(alt) => setSelectedAlert(alt)}
          title="Ranked SKU–Store Discrepancy Candidates"
          maxDisplay={20}
        />
      </section>

      {/* Recent Activity (Balanced Two-Column Row: Runs & Audit Feed) */}
      <section aria-label="Recent Operational Activity" className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            Operational Activity & Governance History
          </h2>
          <p className="text-xs text-slate-500">
            Audit trail of batch detection runs and store associate physical shelf walk confirmations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentRunsTable runs={runs} />
          <RecentAuditFeed auditLogs={auditLogs} />
        </div>
      </section>

      {/* Onboarding Empty Banner when no alerts exist */}
      {!loading && alerts.length === 0 && (
        <section aria-label="Data Onboarding Instructions" className="bg-white/95 p-6 sm:p-8 rounded-3xl border-2 border-dashed border-emerald-300 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              No Phantom Stock-Out Alerts Flagged Yet
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Import your store catalog, daily sales transactions, and on-hand inventory snapshots through the CSV ingestion suite, or click &quot;Run Detection&quot; to execute baseline analysis across active stores.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/import"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs transition-all cursor-pointer"
            >
              <span>Import Inventory CSV</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleRunDetection}
              disabled={isRunningDetection}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Run Baseline Model
            </button>
          </div>
        </section>
      )}

      {/* Modal for Investigation & Shelf Walk */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAlertUpdated={handleAlertUpdated}
        />
      )}
    </AppShell>
  );
}