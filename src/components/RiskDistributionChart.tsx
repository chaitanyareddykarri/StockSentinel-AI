'use client';

import React from 'react';
import { Alert } from '@/types';
import { ShieldAlert, Info } from 'lucide-react';

interface RiskDistributionChartProps {
  alerts: Alert[];
}

export function RiskDistributionChart({ alerts }: RiskDistributionChartProps) {
  const critical = alerts.filter((a) => a.risk_category === 'CRITICAL').length;
  const high = alerts.filter((a) => a.risk_category === 'HIGH').length;
  const medium = alerts.filter((a) => a.risk_category === 'MEDIUM').length;
  const low = alerts.filter((a) => a.risk_category === 'LOW').length;

  const total = alerts.length || 1;
  const critPct = Math.round((critical / total) * 100);
  const highPct = Math.round((high / total) * 100);
  const medPct = Math.round((medium / total) * 100);
  const lowPct = Math.round((low / total) * 100);

  const tiers = [
    {
      category: 'Critical',
      range: '75–100 Anomaly Score',
      count: critical,
      pct: critPct,
      barColor: 'bg-rose-500',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
      trackBg: 'bg-rose-100/60',
      urgency: 'Immediate physical shelf walk required',
    },
    {
      category: 'High',
      range: '55–74 Anomaly Score',
      count: high,
      pct: highPct,
      barColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      trackBg: 'bg-amber-100/60',
      urgency: 'Prioritize during morning replenishment',
    },
    {
      category: 'Medium',
      range: '35–54 Anomaly Score',
      count: medium,
      pct: medPct,
      barColor: 'bg-yellow-400',
      badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      trackBg: 'bg-yellow-100/60',
      urgency: 'Investigate if streak reaches 3 days',
    },
    {
      category: 'Low',
      range: '< 35 Anomaly Score',
      count: low,
      pct: lowPct,
      barColor: 'bg-sky-400',
      badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
      trackBg: 'bg-sky-100/60',
      urgency: 'Shielded slow-mover baseline check',
    },
  ];

  return (
    <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Risk Severity Distribution
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Anomalies segmented by Poisson zero-probability threshold
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {alerts.length} Flagged
        </span>
      </div>

      {/* Segmented Cumulative Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 border border-slate-200/60">
          <div style={{ width: `${critPct}%` }} className="bg-rose-500 h-full transition-all" title={`Critical: ${critical}`} />
          <div style={{ width: `${highPct}%` }} className="bg-amber-500 h-full transition-all" title={`High: ${high}`} />
          <div style={{ width: `${medPct}%` }} className="bg-yellow-400 h-full transition-all" title={`Medium: ${medium}`} />
          <div style={{ width: `${lowPct}%` }} className="bg-sky-400 h-full transition-all" title={`Low: ${low}`} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>Highest Urgency</span>
          <span>Baseline Shield</span>
        </div>
      </div>

      {/* Structured Tier Rows with Individual Progress Bars */}
      <div className="space-y-2.5 pt-1">
        {tiers.map((t) => (
          <div
            key={t.category}
            className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${t.badgeBg}`}>
                  {t.category}
                </span>
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  {t.range}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-xs">{t.count} items</span>
                <span className="text-[11px] text-slate-400 font-medium w-8 text-right">
                  {t.pct}%
                </span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${t.trackBg}`}>
              <div
                style={{ width: `${t.pct}%` }}
                className={`h-full rounded-full transition-all duration-300 ${t.barColor}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Operational Protocol Note */}
      <div className="pt-2 border-t border-slate-100 flex items-center space-x-1.5 text-xs text-slate-500">
        <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
        <span>Prioritize walking Critical & High tiers during morning shelf routines.</span>
      </div>
    </div>
  );
}