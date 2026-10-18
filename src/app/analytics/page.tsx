'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  LineChart,
  Award,
  DollarSign,
  BarChart3,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [dailyWalks, setDailyWalks] = useState<number>(12);

  // Simulation calculations
  const avgLostPerPhantom = 48.5; // Average $ loss per day per phantom SKU
  const detectionAccuracy = 0.85; // Verification confirmation rate
  const monthlyRecovered = Math.round(dailyWalks * avgLostPerPhantom * detectionAccuracy * 30);
  const annualRecovered = Math.round(monthlyRecovered * 12);

  const categoryStats = [
    { name: 'Beverages', riskIndex: 88, incidentRate: '34%', avgStockoutDays: 4.2, color: 'bg-emerald-500' },
    { name: 'Dairy & Refrigerated', riskIndex: 82, incidentRate: '28%', avgStockoutDays: 3.8, color: 'bg-indigo-500' },
    { name: 'Fresh Bakery', riskIndex: 76, incidentRate: '18%', avgStockoutDays: 3.5, color: 'bg-amber-500' },
    { name: 'Snacks & Pantry', riskIndex: 64, incidentRate: '12%', avgStockoutDays: 2.9, color: 'bg-cyan-500' },
    { name: 'Household Essentials', riskIndex: 58, incidentRate: '8%', avgStockoutDays: 3.1, color: 'bg-purple-500' },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
        <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <LineChart className="w-6 h-6 text-emerald-400" />
            <span>Benchmark Evaluation & Revenue Intelligence</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Performance metrics, Precision@20 standard, department vulnerability rankings, and retail ROI simulation.
          </p>
        </div>

        {/* Benchmark Evaluation Cards */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Detection Engine Benchmark (evaluate.py Standard)</h2>
            </div>
            <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              Protocol: Top-20 Investigation List
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 font-medium">Precision@20</p>
              <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">40.3%</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Top-20 list quality</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 font-medium">Recall (Top 20)</p>
              <h3 className="text-2xl font-extrabold text-indigo-400 mt-1">96.7%</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">29 / 30 phantoms caught</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 font-medium">Average Rank</p>
              <h3 className="text-2xl font-extrabold text-amber-400 mt-1">#5.45</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Prioritized at top of list</p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 font-medium">F1-Score</p>
              <h3 className="text-2xl font-extrabold text-cyan-400 mt-1">56.9</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Harmonic mean</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 italic">
            * Benchmark evaluated over 5 stores, 100 SKUs, and 60 days of retail transactions using strict label isolation. Ground-truth evaluation labels are excluded from inference features.
          </p>
        </div>

        {/* Two Column Layout: Revenue ROI Calculator & Category Vulnerability */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Recovery Simulator */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-white font-bold text-base mb-1">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h2>Recovered Revenue Impact Simulator</h2>
              </div>
              <p className="text-xs text-slate-400">
                Estimate missed sales recovered when store associates physically restock flagged phantom stock-outs.
              </p>
            </div>

            <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Daily Shelf Walks Investigated:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{dailyWalks} SKU walks/day</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={dailyWalks}
                onChange={(e) => setDailyWalks(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>2 minimum</span>
                <span>10 standard</span>
                <span>20 maximum</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                <span className="text-xs font-semibold text-emerald-400">Est. Monthly Recovered</span>
                <h4 className="text-2xl font-extrabold text-white mt-1 font-mono">
                  ${monthlyRecovered.toLocaleString()}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Direct retail shelf capture</p>
              </div>

              <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
                <span className="text-xs font-semibold text-indigo-400">Est. Annual Recovered</span>
                <h4 className="text-2xl font-extrabold text-white mt-1 font-mono">
                  ${annualRecovered.toLocaleString()}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Across store network</p>
              </div>
            </div>
          </div>

          {/* Department Vulnerability Ranking */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
            <div>
              <div className="flex items-center space-x-2 text-white font-bold text-base mb-1">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h2>Department Vulnerability Index</h2>
              </div>
              <p className="text-xs text-slate-400">
                Categories with high replenishment friction and frequent backroom staging delays.
              </p>
            </div>

            <div className="space-y-3">
              {categoryStats.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{cat.name}</span>
                    <span className="text-slate-400">
                      Vulnerability: <span className="text-emerald-400 font-bold">{cat.riskIndex}/100</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                    <div
                      style={{ width: `${cat.riskIndex}%` }}
                      className={`h-full rounded-full ${cat.color}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Share of total incidents: {cat.incidentRate}</span>
                    <span>Avg delay: {cat.avgStockoutDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  </ProtectedRoute>
  );
}
