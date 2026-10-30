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
  Download,
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

  const handleExportCsv = () => {
    if (alerts.length === 0) return;
    const headers = ['ID', 'Store', 'SKU', 'Product', 'Category', 'Risk Score', 'Risk Category', 'Recorded Stock', 'Zero Days', 'Est Lost Rev Daily', 'Status', 'Reason'];
    const rows = filteredAlerts.map((a) => [
      `"${a.id}"`,
      `"${a.store_name.replace(/"/g, '""')}"`,
      `"${a.sku}"`,
      `"${a.product_name.replace(/"/g, '""')}"`,
      `"${a.category}"`,
      a.risk_score,
      a.risk_category,
      a.recorded_stock,
      a.consecutive_zero_days,
      a.est_lost_revenue_daily,
      a.status,
      `"${a.primary_reason.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stocksentinel_alerts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    CRITICAL: 'bg-rose-50 text-rose-800 border-rose-200',
    HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
    MEDIUM: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    LOW: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const statusBadgeClasses = {
    OPEN: 'bg-rose-50 text-rose-800 border-rose-200',
    UNDER_REVIEW: 'bg-amber-50 text-amber-800 border-amber-200',
    VERIFIED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    FALSE_POSITIVE: 'bg-slate-100 text-slate-700 border-slate-200',
    RESOLVED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden border border-emerald-900/10 shadow-xs">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <ClipboardList className="w-5 h-5 text-emerald-700" />
              <span>{title}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Showing {displayList.length} of {filteredAlerts.length} ranked pairs for morning shelf walk
            </p>
          </div>

          {/* Store Filter Selector */}
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer shadow-2xs font-medium"
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
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by SKU, product name, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer shadow-2xs font-medium"
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
              className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer shadow-2xs font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="VERIFIED">Verified</option>
              <option value="FALSE_POSITIVE">False Positive</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            <button
              onClick={handleExportCsv}
              disabled={filteredAlerts.length === 0}
              title="Export visible alerts to CSV file"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-600/40 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
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
          <tbody className="divide-y divide-slate-100">
            {displayList.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No matching phantom stock-out alerts found.</p>
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
                    className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectAlert(alert)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-400 w-5 text-right font-bold">
                          #{rankNum}
                        </span>
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {alert.sku}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors">
                          {alert.product_name}
                        </p>
                        <span className="text-[10px] text-slate-500 font-medium">{alert.category}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                      {alert.store_name}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${riskBadgeClasses[alert.risk_category]}`}
                      >
                        {alert.risk_score} — {alert.risk_category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-slate-800">
                      <span className="inline-flex items-center space-x-1 text-rose-700 font-semibold">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{alert.consecutive_zero_days} days</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium">
                      <span className="inline-block bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200 font-semibold">
                        {alert.recorded_stock} units
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-amber-800">
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
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors shadow-2xs"
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
