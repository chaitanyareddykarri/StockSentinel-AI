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
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      badgeBg: 'bg-emerald-100/80',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      badgeBg: 'bg-amber-100/80',
    },
    rose: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      badgeBg: 'bg-rose-100/80',
    },
    indigo: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      text: 'text-indigo-800',
      badgeBg: 'bg-indigo-100/80',
    },
    cyan: {
      bg: 'bg-teal-50',
      border: 'border-teal-200',
      text: 'text-teal-800',
      badgeBg: 'bg-teal-100/80',
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      className="bg-white/90 backdrop-blur-md p-5 rounded-2xl relative overflow-hidden border border-emerald-900/10 shadow-xs hover:border-emerald-600/30 hover:shadow-sm transition-all"
      title={tooltip}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          <div className="mt-2 flex items-baseline space-x-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</h3>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${scheme.badgeBg} ${scheme.text} ${scheme.border}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-500 font-medium">{subtitle}</p>}
        </div>

        <div className={`p-2.5 rounded-xl border shrink-0 ${scheme.bg} ${scheme.border} ${scheme.text}`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span
            className={`font-semibold ${trendType === 'positive'
                ? 'text-emerald-700'
                : trendType === 'negative'
                  ? 'text-rose-700'
                  : 'text-slate-600'
              }`}
          >
            {trend}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">Live Telemetry</span>
        </div>
      )}
    </div>
  );
}
