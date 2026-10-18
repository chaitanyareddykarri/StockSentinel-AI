'use client';

import React from 'react';
import { Alert } from '@/types';
import { PieChart } from 'lucide-react';

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

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <span>Risk Severity Breakdown</span>
        </h3>
        <span className="text-xs text-slate-400">{alerts.length} Total Flagged</span>
      </div>

      {/* Segmented Progress Bar */}
      <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-900 border border-white/5">
        <div style={{ width: `${critPct}%` }} className="bg-rose-500 h-full" title={`Critical: ${critical}`} />
        <div style={{ width: `${highPct}%` }} className="bg-amber-500 h-full" title={`High: ${high}`} />
        <div style={{ width: `${medPct}%` }} className="bg-yellow-500 h-full" title={`Medium: ${medium}`} />
        <div style={{ width: `${lowPct}%` }} className="bg-blue-500 h-full" title={`Low: ${low}`} />
      </div>

      {/* Breakdown Items */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400">Critical (75-100)</span>
            <span className="text-xs font-bold text-white">{critical}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{critPct}% of flagged items</p>
        </div>

        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">High (55-74)</span>
            <span className="text-xs font-bold text-white">{high}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{highPct}% of flagged items</p>
        </div>

        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-yellow-400">Medium (35-54)</span>
            <span className="text-xs font-bold text-white">{medium}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{medPct}% of flagged items</p>
        </div>

        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">Low (&lt;35)</span>
            <span className="text-xs font-bold text-white">{low}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{lowPct}% of flagged items</p>
        </div>
      </div>
    </div>
  );
}
