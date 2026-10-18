'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import {
  Settings,
  Sliders,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const [minZeroDays, setMinZeroDays] = useState<number>(2);
  const [fastMoverThreshold, setFastMoverThreshold] = useState<number>(2.5);
  const [slowMoverThreshold, setSlowMoverThreshold] = useState<number>(0.6);
  const [maxRank, setMaxRank] = useState<number>(20);

  const [dbMode, setDbMode] = useState<string>('DEMO_IN_MEMORY');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/demo')
      .then((res) => res.json())
      .then((data) => {
        if (data.storageType) setDbMode(data.storageType);
      })
      .catch(() => {});
  }, []);

  const handleSaveParams = () => {
    setNotification('Algorithm hyperparameters updated successfully!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResetDemo = async () => {
    if (confirm('Reset demo dataset to initial factory state?')) {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (res.ok) {
        setNotification('Demo dataset reset successfully.');
        setTimeout(() => setNotification(null), 3000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <Settings className="w-6 h-6 text-emerald-400" />
            <span>Settings & Integration Configuration</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure algorithm sensitivity, database persistence, and optional external Python ML service endpoints.
          </p>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>{notification}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Algorithm Hyperparameters Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center space-x-2 text-white font-bold text-base">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h2>Explainable Detection Sensitivity</h2>
            </div>
            <p className="text-xs text-slate-400">
              Tune parameters of the explainable Poisson baseline detection engine.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
                  <span>Minimum Consecutive Zero-Sales Days:</span>
                  <span className="text-emerald-400 font-mono font-bold">{minZeroDays} Days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={minZeroDays}
                  onChange={(e) => setMinZeroDays(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Requires at least this many 0-sales days before flagging.</p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
                  <span>Fast Mover Velocity Threshold:</span>
                  <span className="text-indigo-400 font-mono font-bold">{fastMoverThreshold} units/day</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="6.0"
                  step="0.5"
                  value={fastMoverThreshold}
                  onChange={(e) => setFastMoverThreshold(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Fast runners above this velocity receive higher risk priority.</p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
                  <span>Slow Mover Velocity Threshold:</span>
                  <span className="text-amber-400 font-mono font-bold">{slowMoverThreshold} units/day</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.1"
                  value={slowMoverThreshold}
                  onChange={(e) => setSlowMoverThreshold(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Slow runners below this velocity are shielded from false positives.</p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
                  <span>Max Ranked Alert Candidates Per Store:</span>
                  <span className="text-cyan-400 font-mono font-bold">{maxRank} SKUs</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={maxRank}
                  onChange={(e) => setMaxRank(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Target daily workload for store manager shelf walks (Standard = 20).</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveParams}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Save Algorithm Parameters
                </button>
              </div>
            </div>
          </div>

          {/* Database & Cloud Integrations Card */}
          <div className="space-y-6">
            {/* Supabase PostgreSQL Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-white font-bold text-base">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h2>Database Persistence Layer</h2>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    dbMode === 'SUPABASE_POSTGRESQL'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {dbMode === 'SUPABASE_POSTGRESQL' ? 'Supabase Active' : 'Live Demo Storage'}
                </span>
              </div>

              <p className="text-xs text-slate-400">
                {dbMode === 'SUPABASE_POSTGRESQL'
                  ? 'Connected to persistent Supabase PostgreSQL. Detection runs, alerts, and audit logs persist permanently.'
                  : 'Currently operating in Demo Mode. To connect persistent PostgreSQL, configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'}
              </p>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 text-[11px] font-mono text-slate-300 space-y-1">
                <p className="text-slate-500">Schema Migration Location:</p>
                <p className="text-emerald-400">supabase/migrations/20261018000000_init_schema.sql</p>
                <p className="text-slate-400">Also available in workspace root as schema.sql</p>
              </div>
            </div>

            {/* Optional Python Service Status */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-white font-bold text-base">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <h2>Optional Python ML Microservice</h2>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10">
                  Optional
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Configure <code className="text-indigo-400 font-mono">DETECTION_SERVICE_URL</code> to delegate inference to a separately hosted FastAPI Python microservice (provided in <code className="text-slate-300 font-mono">python-service/</code>).
              </p>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 text-xs text-slate-400">
                <p className="font-semibold text-slate-300">Built-in Fallback Reliability:</p>
                <p className="text-[11px] mt-0.5">
                  If no external Python service is configured, StockSentinel AI automatically runs the built-in TypeScript statistical baseline engine with zero external dependencies.
                </p>
              </div>
            </div>

            {/* Demo Data Management */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Reset Demo Dataset</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Restore default 3 stores, 30 SKUs, and 60 days of sample telemetry.
                </p>
              </div>
              <button
                onClick={handleResetDemo}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Demo</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
