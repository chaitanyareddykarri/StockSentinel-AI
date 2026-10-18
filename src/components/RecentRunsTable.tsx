'use client';

import React from 'react';
import { DetectionRun } from '@/types';
import { History, Cpu } from 'lucide-react';

interface RecentRunsTableProps {
  runs: DetectionRun[];
}

export function RecentRunsTable({ runs }: RecentRunsTableProps) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <History className="w-4 h-4 text-emerald-400" />
          <span>Detection Run History</span>
        </h3>
        <span className="text-xs text-slate-400">{runs.length} Runs Recorded</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
            <tr>
              <th className="pb-2">Run ID / Date</th>
              <th className="pb-2 text-center">Engine</th>
              <th className="pb-2 text-center">Analyzed</th>
              <th className="pb-2 text-center">Flagged</th>
              <th className="pb-2 text-right">Critical</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  No detection runs on record. Click &quot;Run Detection&quot; to trigger one.
                </td>
              </tr>
            ) : (
              runs.slice(0, 5).map((run) => (
                <tr key={run.id} className="hover:bg-slate-900/30">
                  <td className="py-2.5">
                    <p className="font-semibold text-white font-mono">{run.id}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(run.run_date).toLocaleString()}
                    </p>
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      <Cpu className="w-3 h-3" />
                      <span>{run.engine_type.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-slate-300 font-mono">
                    {run.total_skus_analyzed}
                  </td>
                  <td className="py-2.5 text-center font-bold text-amber-400 font-mono">
                    {run.flagged_count}
                  </td>
                  <td className="py-2.5 text-right font-bold text-rose-400 font-mono">
                    {run.critical_count}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
