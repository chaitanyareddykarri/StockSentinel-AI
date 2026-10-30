'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { AlertTable } from '@/components/AlertTable';
import { AlertDetailModal } from '@/components/AlertDetailModal';
import { Alert, Store } from '@/types';
import {
  BellRing,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  ArrowRight,
} from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setFetchError(null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null;
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch('/api/alerts', { headers });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/access-status?status=pending';
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch alerts.');
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
        const storeMap = new Map<string, Store>();
        data.alerts.forEach((a: Alert) => {
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
      }
    } catch (e) {
      console.error('Failed to load alerts:', e);
      setFetchError('Failed to retrieve current alerts queue. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/alerts');
        if (!res.ok) throw new Error('Failed to fetch alerts.');
        const data = await res.json();
        if (active && data.alerts) {
          setAlerts(data.alerts);
          const storeMap = new Map<string, Store>();
          data.alerts.forEach((a: Alert) => {
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
        }
      } catch (e) {
        console.error('Failed to load alerts:', e);
        if (active) setFetchError('Failed to load alerts.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleAlertUpdated = (updated: Alert) => {
    setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAlert(updated);
    fetchAlerts();
  };

  const openCount = alerts.filter((a) => a.status === 'OPEN').length;
  const underReviewCount = alerts.filter((a) => a.status === 'UNDER_REVIEW').length;
  const verifiedCount = alerts.filter((a) => a.status === 'VERIFIED').length;
  const falsePositiveCount = alerts.filter((a) => a.status === 'FALSE_POSITIVE').length;

  const isDemoData = stores.some((s) => s.id === 'store-001' || s.id === 'store-002' || s.id === 'store-003');

  return (
    <AppShell
      title="Alerts & Physical Walk Triage"
      subtitle="Ranked list of suspicious product-store pairs. Conduct shelf walks and log verification outcomes."
      stores={stores}
      selectedStore={selectedStore}
      onStoreChange={setSelectedStore}
      isDemoData={isDemoData}
      openAlertsCount={openCount + underReviewCount}
    >
      {/* Error Banner */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => fetchAlerts()}
            className="font-bold underline hover:text-rose-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header Introduction */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <BellRing className="w-5 h-5 text-emerald-700" />
            <span>Operational Discrepancy Queue</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical demand anomalies ranked by Poisson zero-probability. Store associates use this list during morning pre-opening shelf walks to verify physical facings.
          </p>
        </div>

        {/* 4-Card Status Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/95 rounded-2xl border border-rose-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Open Action Required</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{loading ? '...' : openCount}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Unworked shelf anomalies</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl border border-amber-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Under Review</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{loading ? '...' : underReviewCount}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Walk in progress or scheduled</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl border border-emerald-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Confirmed Phantoms</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{loading ? '...' : verifiedCount}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Verified missing / displaced</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">False Positives</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{loading ? '...' : falsePositiveCount}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Physically in-stock confirmed</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Alert Table */}
      <section aria-label="Alerts Table">
        <AlertTable
          alerts={alerts}
          stores={stores}
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onSelectAlert={(alt) => setSelectedAlert(alt)}
          title="All Flagged Candidates (Ranked by Anomaly Severity)"
        />
      </section>

      {/* Empty State Banner if 0 alerts */}
      {!loading && alerts.length === 0 && (
        <section className="bg-white/95 p-8 rounded-3xl border-2 border-dashed border-emerald-300 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              No Alerts Currently Active
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              All store inventory is currently aligned with scan velocity, or no transaction logs have been ingested yet.
            </p>
          </div>
          <Link
            href="/import"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
          >
            <span>Import Store Data</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      )}

      {/* Shelf Walk Verification Modal */}
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