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
  Bot,
  RefreshCw,
  Lightbulb,
  ListChecks,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AlertDetailModalProps {
  alert: Alert | null;
  onClose: () => void;
  onAlertUpdated: (updated: Alert) => void;
}

interface AIDiagnosticData {
  hypothesis: string;
  actionSteps: string[];
  revenueImpact: string;
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
  const [activeTab, setActiveTab] = useState<'verify' | 'ai' | 'audit'>('verify');
  const [shelfCount, setShelfCount] = useState<number>(alert.shelf_count ?? 0);
  const [selectedOutcome, setSelectedOutcome] = useState<VerificationOutcome>(
    alert.verification_outcome ?? 'PHANTOM_CONFIRMED'
  );
  const [notes, setNotes] = useState<string>(alert.investigation_notes ?? '');
  const [auditorName, setAuditorName] = useState<string>(alert.verified_by ?? 'Store Staff (Walk)');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(true);

  // AI Diagnostic State
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiData, setAiData] = useState<AIDiagnosticData | null>(null);
  const [aiProvider, setAiProvider] = useState<string>('NONE');
  const [aiMessage, setAiMessage] = useState<string | null>(null);

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

  const handleRunAiDiagnostic = async () => {
    setAiLoading(true);
    setAiMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null;
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sku: alert.sku,
          productName: alert.product_name,
          category: alert.category,
          unitPrice: alert.unit_price,
          storeName: alert.store_name,
          recordedStock: alert.recorded_stock,
          consecutiveZeroDays: alert.consecutive_zero_days,
          expectedDailySales: alert.expected_daily_sales,
          poissonAnomalyP: alert.poisson_anomaly_p,
          isOnPromotion: alert.is_on_promotion,
          primaryReason: alert.primary_reason,
        }),
      });

      const data = await res.json();
      if (data.diagnostic) {
        setAiData(data.diagnostic);
        setAiProvider(data.provider || 'AI');
      } else {
        setAiMessage(data.message || 'AI diagnostic is unavailable.');
        setAiProvider(data.provider || 'NONE');
      }
    } catch {
      setAiMessage('Failed to connect to AI reasoning endpoint.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleVerifySubmit = async (newStatus: AlertStatus) => {
    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null;
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers,
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
    CRITICAL: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
    HIGH: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
    MEDIUM: 'bg-yellow-50 text-yellow-800 border-yellow-200 font-semibold',
    LOW: 'bg-blue-50 text-blue-800 border-blue-200 font-semibold',
  };

  const statusBadgeColors = {
    OPEN: 'bg-rose-50 text-rose-800 border-rose-200',
    UNDER_REVIEW: 'bg-amber-50 text-amber-800 border-amber-200',
    VERIFIED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    FALSE_POSITIVE: 'bg-slate-100 text-slate-700 border-slate-200',
    RESOLVED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-xl overflow-hidden flex flex-col border border-emerald-900/15">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/80">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${riskBadgeColors[alert.risk_category]}`}>
                {alert.risk_category} RISK ({alert.risk_score}/100)
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusBadgeColors[alert.status]}`}>
                Status: {alert.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                {alert.sku}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{alert.product_name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600 font-medium">
              <span className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{alert.store_name}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>{alert.category}</span>
              </span>
              <span>Unit Price: ${alert.unit_price.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Signal Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-1.5 text-slate-500 text-xs mb-1 font-medium">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Consecutive 0s</span>
              </div>
              <p className="text-lg font-bold text-rose-700">{alert.consecutive_zero_days} Days</p>
              <p className="text-[10px] text-slate-500">Zero sold recently</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-1.5 text-slate-500 text-xs mb-1 font-medium">
                <PackageCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Recorded Stock</span>
              </div>
              <p className="text-lg font-bold text-emerald-800">{alert.recorded_stock} Units</p>
              <p className="text-[10px] text-slate-500">System on-hand</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-1.5 text-slate-500 text-xs mb-1 font-medium">
                <Percent className="w-3.5 h-3.5 text-indigo-600" />
                <span>Anomaly Chance</span>
              </div>
              <p className="text-lg font-bold text-slate-900">
                {alert.poisson_anomaly_p < 0.0001 ? '<0.01%' : `${(alert.poisson_anomaly_p * 100).toFixed(1)}%`}
              </p>
              <p className="text-[10px] text-slate-500">Poisson P(X=0)</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-1.5 text-slate-500 text-xs mb-1 font-medium">
                <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                <span>Daily Lost Rev</span>
              </div>
              <p className="text-lg font-bold text-amber-800">${alert.est_lost_revenue_daily.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500">Rate: {alert.expected_daily_sales}/day</p>
            </div>
          </div>

          {/* Explainable Detection Narrative */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 relative">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1.5">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Explainable Baseline Detection Signal</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">{alert.primary_reason}</p>
            {alert.is_on_promotion && (
              <div className="mt-2 text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 inline-block font-semibold">
                ★ Active promotion in effect during this zero-sales window. Expected demand is elevated.
              </div>
            )}
          </div>

          {/* Tabs: Physical Verification vs. AI Copilot vs. Audit Trail */}
          <div>
            <div className="flex items-center space-x-4 border-b border-slate-200 mb-4">
              <button
                onClick={() => setActiveTab('verify')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'verify'
                    ? 'border-emerald-600 text-emerald-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Physical Shelf Walk
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'ai'
                    ? 'border-emerald-600 text-emerald-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>AI Root-Cause Copilot</span>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'audit'
                    ? 'border-emerald-600 text-emerald-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Trail ({auditLogs.length})</span>
              </button>
            </div>

            {activeTab === 'verify' ? (
              <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observed Shelf Count (Physical Count on Facing)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={shelfCount}
                      onChange={(e) => setShelfCount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Auditor / Store Staff Name
                    </label>
                    <input
                      type="text"
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                      placeholder="e.g. Marcus Chen (Store Lead)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Physical Investigation Outcome
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      {
                        key: 'PHANTOM_CONFIRMED',
                        label: 'Confirmed Phantom Stock-Out',
                        desc: 'Shelf completely empty, tag present. Lost sales confirmed.',
                        border: 'border-rose-400 text-rose-800 bg-rose-50/50',
                      },
                      {
                        key: 'BACKROOM_DISPLACED',
                        label: 'Backroom Displaced Stock',
                        desc: 'Stock found sitting on pallet in backroom, not replenished.',
                        border: 'border-amber-400 text-amber-800 bg-amber-50/50',
                      },
                      {
                        key: 'MISPLACED_SHELF',
                        label: 'Misplaced / Cross-Shelved',
                        desc: 'Product misplaced in another aisle or wrong shelf tag.',
                        border: 'border-yellow-400 text-yellow-800 bg-yellow-50/50',
                      },
                      {
                        key: 'THEFT_SHRINKAGE',
                        label: 'Theft / Shrinkage Adjustment',
                        desc: 'Product stolen or damaged; adjust inventory count to 0.',
                        border: 'border-purple-400 text-purple-800 bg-purple-50/50',
                      },
                      {
                        key: 'IN_STOCK_FALSE_ALARM',
                        label: 'In-Stock (False Positive)',
                        desc: 'Product was actually on shelf; demand was naturally low.',
                        border: 'border-blue-400 text-blue-800 bg-blue-50/50',
                      },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setSelectedOutcome(opt.key as VerificationOutcome)}
                        className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                          selectedOutcome === opt.key
                            ? `bg-white ${opt.border} ring-2 ring-emerald-600 shadow-xs`
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{opt.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Investigation Notes & Findings
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter observations from shelf walk, backroom check, or corrective action..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                  />
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerifySubmit('UNDER_REVIEW')}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    Mark Under Review
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVerifySubmit('FALSE_POSITIVE')}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    Mark False Positive
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVerifySubmit('VERIFIED')}
                    disabled={isSubmitting}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Physical Verification</span>
                  </button>
                </div>
              </div>
            ) : activeTab === 'ai' ? (
              /* AI Copilot Tab */
              <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">AI Root-Cause Diagnostic Copilot</h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunAiDiagnostic}
                    disabled={aiLoading}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Run AI Root-Cause Diagnostic</span>
                      </>
                    )}
                  </button>
                </div>

                {aiData ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono">Provider: {aiProvider}</span>
                      <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        AI Reasoning Complete
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-indigo-200 space-y-1 shadow-2xs">
                      <p className="text-xs font-semibold text-indigo-800 flex items-center space-x-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Root-Cause Operational Hypothesis:</span>
                      </p>
                      <p className="text-xs text-slate-800 leading-relaxed">{aiData.hypothesis}</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                      <p className="text-xs font-semibold text-emerald-800 flex items-center space-x-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Recommended Shelf Inspection Steps:</span>
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                        {aiData.actionSteps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-2xs">
                      <span className="text-slate-500 font-semibold">Revenue & Customer Impact:</span>{' '}
                      {aiData.revenueImpact}
                    </div>
                  </div>
                ) : aiMessage ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <p className="font-semibold">{aiMessage}</p>
                    <p className="text-[11px] text-slate-600">
                      Configure <code className="text-indigo-700 font-mono">GEMINI_API_KEY</code> or{' '}
                      <code className="text-indigo-700 font-mono">OPENAI_API_KEY</code> in your environment variables to enable generative AI root-cause diagnostics.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2 text-xs text-slate-500">
                    <p>Click &quot;Run AI Root-Cause Diagnostic&quot; to synthesize sales velocity and stock anomalies into operational remediation hypotheses.</p>
                    <p className="text-[11px] text-slate-400">Supports Google Gemini or OpenAI server-side keys.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Audit Trail List */
              <div className="space-y-2.5">
                {loadingAudit ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Loading audit history...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No audit trail records yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {log.changed_by} changed status: {log.previous_status} →{' '}
                          <span className="text-emerald-800 font-bold">{log.new_status}</span>
                        </span>
                        <span className="text-[10px]">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.outcome && (
                        <p className="text-slate-700">
                          <span className="text-slate-500 font-medium">Outcome:</span> {log.outcome.replace(/_/g, ' ')}
                        </p>
                      )}
                      {log.notes && <p className="text-slate-600 italic">&quot;{log.notes}&quot;</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">Alert ID: {alert.id}</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
