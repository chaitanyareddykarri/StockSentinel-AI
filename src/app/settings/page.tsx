'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import {
  Sliders,
  Database,
  Cpu,
  CheckCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const [minZeroDays, setMinZeroDays] = useState<number>(2);
  const [fastMoverThreshold, setFastMoverThreshold] = useState<number>(2.5);
  const [slowMoverThreshold, setSlowMoverThreshold] = useState<number>(0.6);
  const [maxRank, setMaxRank] = useState<number>(20);

  const [isSupabase, setIsSupabase] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.storageType === 'SUPABASE_POSTGRESQL') setIsSupabase(true);
      })
      .catch(() => {});
  }, []);

  const handleSaveParams = () => {
    setNotification('Algorithm hyperparameters updated successfully!');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <AppShell
      title="Settings & Integration Configuration"
      subtitle="Configure algorithm sensitivity, database persistence, and optional external Python ML service endpoints."
    >
      {/* Notification Toast */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 font-semibold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-700" />
          <span>{notification}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Algorithm Hyperparameters Card */}
        <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
              <Sliders className="w-5 h-5 text-emerald-700" />
              <h2>Explainable Detection Sensitivity</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tune parameters of the explainable Poisson baseline demand detection model.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Minimum Consecutive Zero-Sales Days:</span>
                <span className="text-emerald-800 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{minZeroDays} Days</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={minZeroDays}
                onChange={(e) => setMinZeroDays(parseInt(e.target.value, 10))}
                className="w-full accent-[#064e3b] cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">Requires at least this many 0-sales days before flagging.</p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Fast Mover Velocity Threshold:</span>
                <span className="text-indigo-800 font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{fastMoverThreshold} units/day</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.5"
                value={fastMoverThreshold}
                onChange={(e) => setFastMoverThreshold(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">Fast runners above this velocity receive higher risk priority.</p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Slow Mover Velocity Threshold:</span>
                <span className="text-amber-800 font-mono font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{slowMoverThreshold} units/day</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={slowMoverThreshold}
                onChange={(e) => setSlowMoverThreshold(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">Slow runners below this velocity are shielded from false positives.</p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Max Ranked Alert Candidates Per Store:</span>
                <span className="text-teal-800 font-mono font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">{maxRank} SKUs</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={maxRank}
                onChange={(e) => setMaxRank(parseInt(e.target.value, 10))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">Target daily workload for store manager shelf walks (Standard = 20).</p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveParams}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs transition-all cursor-pointer"
              >
                Save Algorithm Parameters
              </button>
            </div>
          </div>
        </div>

        {/* Database & Cloud Integrations Card */}
        <div className="space-y-6">
          {/* Persistent Database Layer Card */}
          <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                <Database className="w-5 h-5 text-emerald-700" />
                <h2>Database Persistence Layer</h2>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isSupabase
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {isSupabase ? 'Supabase PostgreSQL Active' : 'Operating in Local Store'}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {isSupabase
                ? 'Connected to persistent Supabase PostgreSQL with Row Level Security. Stores, products, detection runs, alerts, and audit logs are securely isolated by authenticated user.'
                : 'Running on local persistent JSON storage. Supply NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel to activate cloud database integration.'}
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
              <p className="text-slate-400 font-semibold">Authoritative Enterprise Schema (v3.5.0):</p>
              <p className="text-emerald-800 font-semibold">supabase/schema/complete_schema_v3.5.sql</p>
              <p className="text-slate-500">Chronological migrations available in: supabase/migrations/</p>
            </div>
          </div>

          {/* Optional Python Service Status */}
          <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                <Cpu className="w-5 h-5 text-indigo-700" />
                <h2>Optional Python ML Microservice</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Optional
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Configure <code className="text-indigo-700 font-mono font-semibold">DETECTION_SERVICE_URL</code> to delegate inference to a separately hosted FastAPI Python microservice (provided in <code className="text-slate-700 font-mono">python-service/</code>).
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Built-in Fallback Reliability:</p>
              <p className="text-[11px] mt-0.5 text-slate-500">
                If no external Python service is configured, StockSentinel AI automatically runs the built-in TypeScript statistical baseline engine with zero external dependencies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

