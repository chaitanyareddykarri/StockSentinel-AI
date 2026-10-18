'use client';

import React, { useState } from 'react';
import { Alert, Store } from '@/types';
import {
  Search,
  AlertTriangle,
  ClipboardList,
  ChevronRight,
  TrendingDown,
  Building2,
} from 'lucide-react';

interface AlertTableProps {
  alerts: Alert[];
  stores: Store[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  onSelectAlert: (alert: Alert) => void;
  title?: string;
  maxDisplay?: number;
}

export function AlertTable({
  alerts,
  stores,
  selectedStore,
  onStoreChange,
  onSelectAlert,
  title = 'High-Risk Phantom Stock-Out Candidates (Top 20)',
  maxDisplay,
}: AlertTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const filteredAlerts = alerts.filter((a) => {
    if (selectedStore !== 'ALL' && a.store_id !== selectedStore) return false;
    if (selectedRisk !== 'ALL' && a.risk_category !== selectedRisk) return false;
    if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.product_name.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const displayList = maxDisplay ? filteredAlerts.slice(0, maxDisplay) : filteredAlerts;

  const riskBadgeClasses = {
    CRITICAL: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    HIGH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  const statusBadgeClasses = {
    OPEN: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    UNDER_REVIEW: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    VERIFIED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    FALSE_POSITIVE: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    RESOLVED: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-xl">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-900/50 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
              <span>{title}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Showing {displayList.length} of {filteredAlerts.length} ranked pairs for morning shelf walk
            </p>
          </div>

          {/* Store Filter Selector */}
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="bg-slate-950 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search & Risk / Status Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by SKU, product name, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/70 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-slate-950 border border-white/10 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-white/10 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="VERIFIED">Verified</option>
              <option value="FALSE_POSITIVE">False Positive</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5 text-[11px]">
            <tr>
              <th className="py-3 px-4">Rank / SKU</th>
              <th className="py-3 px-4">Product & Category</th>
              <th className="py-3 px-4">Store</th>
              <th className="py-3 px-4 text-center">Risk Score</th>
              <th className="py-3 px-4 text-center">Consecutive 0s</th>
              <th className="py-3 px-4 text-center">On-Hand Stock</th>
              <th className="py-3 px-4 text-right">Est. Daily Loss</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayList.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">No matching phantom stock-out alerts found.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Try adjusting your filters or click &quot;Run Detection&quot; to generate fresh analysis.
                  </p>
                </td>
              </tr>
            ) : (
              displayList.map((alert, index) => {
                const rankNum = index + 1;
                return (
                  <tr
                    key={alert.id}
                    className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectAlert(alert)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-500 w-5 text-right font-bold">
                          #{rankNum}
                        </span>
                        <span className="font-mono font-semibold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                          {alert.sku}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                          {alert.product_name}
                        </p>
                        <span className="text-[10px] text-slate-400">{alert.category}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                      {alert.store_name}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${riskBadgeClasses[alert.risk_category]}`}
                      >
                        {alert.risk_score} — {alert.risk_category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-slate-200">
                      <span className="inline-flex items-center space-x-1 text-rose-400">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{alert.consecutive_zero_days} days</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-slate-200">
                      <span className="inline-block bg-slate-800/80 px-2 py-0.5 rounded text-emerald-400 border border-white/5">
                        {alert.recorded_stock} units
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-amber-400">
                      ${alert.est_lost_revenue_daily.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClasses[alert.status]}`}
                      >
                        {alert.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAlert(alert);
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors"
                      >
                        <span>Verify Shelf</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
