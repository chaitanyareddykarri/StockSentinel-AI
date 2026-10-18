'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  badge?: string;
  color?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan';
  tooltip?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendType = 'neutral',
  icon: Icon,
  badge,
  color = 'emerald',
  tooltip,
}: MetricCardProps) {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/10',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/10',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      text: 'text-rose-400',
      glow: 'shadow-rose-500/10',
    },
    indigo: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      text: 'text-indigo-400',
      glow: 'shadow-indigo-500/10',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/10',
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      className={`glass-panel p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all shadow-lg ${scheme.glow}`}
      title={tooltip}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <div className="mt-2 flex items-baseline space-x-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{value}</h3>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${scheme.bg} ${scheme.text} ${scheme.border}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>

        <div className={`p-3 rounded-xl border ${scheme.bg} ${scheme.border} ${scheme.text}`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
          <span
            className={`font-semibold ${
              trendType === 'positive'
                ? 'text-emerald-400'
                : trendType === 'negative'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {trend}
          </span>
          <span className="text-[11px] text-slate-500">Live Metric</span>
        </div>
      )}
    </div>
  );
}
