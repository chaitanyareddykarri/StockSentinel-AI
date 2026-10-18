'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { AlertTable } from '@/components/AlertTable';
import { AlertDetailModal } from '@/components/AlertDetailModal';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Alert, Store } from '@/types';
import { BellRing } from 'lucide-react';
import Link from 'next/link';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
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
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/alerts');
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                <Link href="/dashboard" className="hover:text-emerald-400 transition-colors">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-slate-200">Alerts & Physical Walk</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
                <BellRing className="w-6 h-6 text-emerald-400" />
                <span>Prioritized Alerts & Verification Workflow</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Ranked list of suspicious product-store pairs. Conduct shelf walks and log verification outcomes.
              </p>
            </div>

            {/* Status Quick Counters */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-semibold">
                {openCount} Open
              </span>
              <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                {underReviewCount} Under Review
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                {verifiedCount} Verified
              </span>
              <span className="px-3 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/20 font-semibold">
                {falsePositiveCount} False Positives
              </span>
            </div>
          </div>

          {/* Alerts Table */}
          <AlertTable
            alerts={alerts}
            stores={stores}
            selectedStore={selectedStore}
            onStoreChange={setSelectedStore}
            onSelectAlert={(alt) => setSelectedAlert(alt)}
            title="All Flagged Candidates (Ranked by Anomaly Severity)"
          />
        </main>

        {/* Investigation Modal */}
        {selectedAlert && (
          <AlertDetailModal
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            onAlertUpdated={handleAlertUpdated}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
