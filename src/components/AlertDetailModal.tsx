'use client';

import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertStatus,
  AuditLogEntry,
  VerificationOutcome,
} from '@/types';
import {
  X,
  CheckCircle2,
  DollarSign,
  PackageCheck,
  TrendingDown,
  History,
  Tag,
  Building2,
  Sparkles,
  Percent,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AlertDetailModalProps {
  alert: Alert | null;
  onClose: () => void;
  onAlertUpdated: (updated: Alert) => void;
}

export function AlertDetailModal({ alert, onClose, onAlertUpdated }: AlertDetailModalProps) {
  if (!alert) return null;

  return (
    <AlertDetailModalInner
      key={alert.id}
      alert={alert}
      onClose={onClose}
      onAlertUpdated={onAlertUpdated}
    />
  );
}

function AlertDetailModalInner({
  alert,
  onClose,
  onAlertUpdated,
}: {
  alert: Alert;
  onClose: () => void;
  onAlertUpdated: (updated: Alert) => void;
}) {
  const [activeTab, setActiveTab] = useState<'verify' | 'audit'>('verify');
  const [shelfCount, setShelfCount] = useState<number>(alert.shelf_count ?? 0);
  const [selectedOutcome, setSelectedOutcome] = useState<VerificationOutcome>(
    alert.verification_outcome ?? 'PHANTOM_CONFIRMED'
  );
  const [notes, setNotes] = useState<string>(alert.investigation_notes ?? '');
  const [auditorName, setAuditorName] = useState<string>(alert.verified_by ?? 'Store Staff (Walk)');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/alerts/${alert.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.auditLogs) {
            setAuditLogs(data.auditLogs);
          }
          setLoadingAudit(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingAudit(false);
      });

    return () => {
      isMounted = false;
    };
  }, [alert.id]);

  const handleVerifySubmit = async (newStatus: AlertStatus) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          status: newStatus,
          outcome: selectedOutcome,
          notes,
          shelfCount,
          auditor: auditorName,
        }),
      });

      const data = await res.json();
      if (data.success && data.alert) {
        if (newStatus === 'VERIFIED') {
          try {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.7 },
            });
          } catch {}
        }
        onAlertUpdated(data.alert);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const riskBadgeColors = {
    CRITICAL: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    HIGH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  const statusBadgeColors = {
    OPEN: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    UNDER_REVIEW: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    VERIFIED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    FALSE_POSITIVE: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    RESOLVED: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-modal w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/15">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between bg-slate-900/60">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${riskBadgeColors[alert.risk_category]}`}>
                {alert.risk_category} RISK ({alert.risk_score}/100)
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusBadgeColors[alert.status]}`}>
                Status: {alert.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-white/5">
                {alert.sku}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{alert.product_name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{alert.store_name}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>{alert.category}</span>
              </span>
              <span>Price: ${alert.unit_price.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Signal Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Consecutive 0s</span>
              </div>
              <p className="text-lg font-bold text-white">{alert.consecutive_zero_days} Days</p>
              <p className="text-[10px] text-slate-500">Zero sold recently</p>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recorded Stock</span>
              </div>
              <p className="text-lg font-bold text-white">{alert.recorded_stock} Units</p>
              <p className="text-[10px] text-slate-500">System on-hand</p>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                <Percent className="w-3.5 h-3.5 text-indigo-400" />
                <span>Anomaly Chance</span>
              </div>
              <p className="text-lg font-bold text-white">
                {alert.poisson_anomaly_p < 0.0001 ? '<0.01%' : `${(alert.poisson_anomaly_p * 100).toFixed(1)}%`}
              </p>
              <p className="text-[10px] text-slate-500">Poisson P(X=0)</p>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs mb-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Daily Lost Rev</span>
              </div>
              <p className="text-lg font-bold text-amber-400">${alert.est_lost_revenue_daily.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">Rate: {alert.expected_daily_sales}/day</p>
            </div>
          </div>

          {/* Explainable Detection Narrative */}
          <div className="bg-slate-900/70 p-4 rounded-xl border border-emerald-500/20 relative">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Explainable AI Detection Narrative</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{alert.primary_reason}</p>
            {alert.is_on_promotion && (
              <div className="mt-2 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 inline-block font-medium">
                ★ Active promotion in effect during this zero-sales window. Expected demand is elevated.
              </div>
            )}
          </div>

          {/* Tabs: Physical Verification vs. Audit Trail */}
          <div>
            <div className="flex items-center space-x-4 border-b border-white/10 mb-4">
              <button
                onClick={() => setActiveTab('verify')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'verify'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Physical Shelf Walk & Verification
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'audit'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Trail ({auditLogs.length})</span>
              </button>
            </div>

            {activeTab === 'verify' ? (
              <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                {/* Physical Count */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Observed Shelf Count (Physical Count on Facing)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={shelfCount}
                      onChange={(e) => setShelfCount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Auditor / Store Staff Name
                    </label>
                    <input
                      type="text"
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Marcus Chen (Store Lead)"
                    />
                  </div>
                </div>

                {/* Verification Outcome Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Physical Investigation Outcome
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      {
                        key: 'PHANTOM_CONFIRMED',
                        label: 'Confirmed Phantom Stock-Out',
                        desc: 'Shelf completely empty, tag present. Lost sales confirmed.',
                        border: 'border-rose-500/40 text-rose-300',
                      },
                      {
                        key: 'BACKROOM_DISPLACED',
                        label: 'Backroom Displaced Stock',
                        desc: 'Stock found sitting on pallet in backroom, not replenished.',
                        border: 'border-amber-500/40 text-amber-300',
                      },
                      {
                        key: 'MISPLACED_SHELF',
                        label: 'Misplaced / Cross-Shelved',
                        desc: 'Product misplaced in another aisle or wrong shelf tag.',
                        border: 'border-yellow-500/40 text-yellow-300',
                      },
                      {
                        key: 'THEFT_SHRINKAGE',
                        label: 'Theft / Shrinkage Adjustment',
                        desc: 'Product stolen or damaged; adjust inventory count to 0.',
                        border: 'border-purple-500/40 text-purple-300',
                      },
                      {
                        key: 'IN_STOCK_FALSE_ALARM',
                        label: 'In-Stock (False Positive)',
                        desc: 'Product was actually on shelf; demand was naturally low.',
                        border: 'border-blue-500/40 text-blue-300',
                      },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setSelectedOutcome(opt.key as VerificationOutcome)}
                        className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                          selectedOutcome === opt.key
                            ? `bg-slate-800 ${opt.border} ring-1 ring-emerald-500`
                            : 'bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/15'
                        }`}
                      >
                        <p className="font-semibold text-white">{opt.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Investigation Notes & Findings
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter observations from shelf walk, backroom check, or corrective action..."
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerifySubmit('UNDER_REVIEW')}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Mark Under Review
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVerifySubmit('FALSE_POSITIVE')}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Mark False Positive
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVerifySubmit('VERIFIED')}
                    disabled={isSubmitting}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Physical Verification</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Audit Trail List */
              <div className="space-y-3">
                {loadingAudit ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Loading audit history...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No audit trail records yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-slate-200">
                          {log.changed_by} changed status: {log.previous_status} →{' '}
                          <span className="text-emerald-400 font-bold">{log.new_status}</span>
                        </span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.outcome && (
                        <p className="text-slate-300">
                          <span className="text-slate-500">Outcome:</span> {log.outcome.replace('_', ' ')}
                        </p>
                      )}
                      {log.notes && <p className="text-slate-400 italic">&quot;{log.notes}&quot;</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <span>Alert ID: {alert.id}</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
