'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TimeSeriesPoint } from '@/types';
import { TrendingUp, BarChart3, ArrowRight, Info } from 'lucide-react';

interface SalesInventoryChartProps {
  timeSeries?: TimeSeriesPoint[];
}

export function SalesInventoryChart({ timeSeries = [] }: SalesInventoryChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If no time-series data exists, render an intentional empty state
  if (!timeSeries || timeSeries.length === 0) {
    return (
      <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-8 shadow-xs flex flex-col items-center justify-center text-center min-h-[340px] space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            No Daily Sales or Inventory Telemetry Available
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Time-series scan velocity requires daily sales and on-hand inventory snapshots. Ingest your store CSV records or run the baseline detection engine to populate daily telemetry.
          </p>
        </div>
        <Link
          href="/import"
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs transition-colors"
        >
          <span>Ingest Daily Sales CSV</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  // Calculate scales from real data
  const maxUnitsSold = Math.max(...timeSeries.map((d) => d.unitsSold), 1);
  const maxOnHand = Math.max(...timeSeries.map((d) => d.onHandUnits), 1);
  const maxY = Math.max(maxUnitsSold, maxOnHand) * 1.15;

  const chartWidth = 600;
  const chartHeight = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const points = timeSeries.map((pt, idx) => {
    const x = paddingLeft + (idx / Math.max(timeSeries.length - 1, 1)) * plotWidth;
    const ySales = paddingTop + plotHeight - (pt.unitsSold / maxY) * plotHeight;
    const yStock = paddingTop + plotHeight - (pt.onHandUnits / maxY) * plotHeight;
    return { ...pt, x, ySales, yStock };
  });

  // Polyline strings
  const salesPath = points.map((p) => `${p.x},${p.ySales}`).join(' ');
  const stockPath = points.map((p) => `${p.x},${p.yStock}`).join(' ');

  // Filled area under sales curve
  const salesArea = `${paddingLeft},${paddingTop + plotHeight} ` +
    points.map((p) => `${p.x},${p.ySales}`).join(' ') +
    ` ${paddingLeft + plotWidth},${paddingTop + plotHeight}`;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
      {/* Header & Legends */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Sales Velocity vs. Recorded On-Hand Stock
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated POS units sold compared to recorded ERP shelf stock across recent days
          </p>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
            <span>POS Sales Units</span>
          </div>
          <div className="flex items-center space-x-1.5 font-medium text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block"></span>
            <span>Recorded On-Hand</span>
          </div>
        </div>
      </div>

      {/* SVG Responsive Chart */}
      <div className="w-full relative overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Horizontal Gridlines */}
          {[0, 0.33, 0.66, 1].map((pct, idx) => {
            const y = paddingTop + plotHeight * (1 - pct);
            const val = Math.round(maxY * pct);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + plotWidth}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area under sales velocity */}
          <polygon
            points={salesArea}
            className="fill-emerald-500/10"
          />

          {/* Recorded On-Hand Line (Indigo) */}
          <polyline
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeDasharray="6 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={stockPath}
          />

          {/* POS Sales Velocity Line (Emerald) */}
          <polyline
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={salesPath}
          />

          {/* Points & Interactive Nodes */}
          {points.map((pt, idx) => (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {/* Invisible touch target */}
              <rect
                x={pt.x - 12}
                y={paddingTop}
                width={24}
                height={plotHeight}
                fill="transparent"
              />

              {/* Stock Node */}
              <rect
                x={pt.x - 3}
                y={pt.yStock - 3}
                width={6}
                height={6}
                className="fill-indigo-600 transition-all hover:scale-125"
              />

              {/* Sales Node */}
              <circle
                cx={pt.x}
                cy={pt.ySales}
                r={hoveredIdx === idx ? 5 : 3.5}
                className="fill-emerald-600 transition-all hover:scale-125 stroke-white stroke-2"
              />

              {/* Date Labels (show every 2nd or 3rd on tight view) */}
              {(idx % 2 === 0 || idx === points.length - 1) && (
                <text
                  x={pt.x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-500 font-medium"
                >
                  {pt.date.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && (
          <div
            className="absolute top-2 right-4 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md pointer-events-none flex items-center space-x-3 z-10"
          >
            <span className="font-semibold text-slate-300">{activePoint.date}</span>
            <span className="text-emerald-400 font-bold">Sales: {activePoint.unitsSold} units</span>
            <span className="text-indigo-300 font-bold">On-Hand: {activePoint.onHandUnits} units</span>
          </div>
        )}
      </div>

      {/* Divergence Explanatory Footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>
            <strong>Divergence Detection:</strong> Unexpected zero-sales days occurring against positive recorded inventory indicate phantom shelf stock-outs.
          </span>
        </div>
        <span className="text-[11px] font-mono font-medium text-slate-400 hidden sm:inline">
          {timeSeries.length} Days Aggregated
        </span>
      </div>
    </div>
  );
}
