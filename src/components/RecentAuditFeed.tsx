'use client';

import React from 'react';
import { AuditLogEntry } from '@/types';
import { UserCheck, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

interface RecentAuditFeedProps {
  auditLogs: AuditLogEntry[];
}

export function RecentAuditFeed({ auditLogs }: RecentAuditFeedProps) {
  const outcomeIcons = {
    PHANTOM_CONFIRMED: { icon: AlertOctagon, color: 'text-rose-400 bg-rose-500/10' },
    BACKROOM_DISPLACED: { icon: HelpCircle, color: 'text-amber-400 bg-amber-500/10' },
    MISPLACED_SHELF: { icon: HelpCircle, color: 'text-yellow-400 bg-yellow-500/10' },
    THEFT_SHRINKAGE: { icon: AlertOctagon, color: 'text-purple-400 bg-purple-500/10' },
    IN_STOCK_FALSE_ALARM: { icon: CheckCircle2, color: 'text-blue-400 bg-blue-500/10' },
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>Recent Physical Verifications</span>
        </h3>
        <span className="text-xs text-slate-400">{auditLogs.length} Verified Records</span>
      </div>

      <div className="space-y-3">
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No physical shelf walks completed yet. Open an alert to record a verification.
          </p>
        ) : (
          auditLogs.slice(0, 4).map((log) => {
            const outcomeKey = log.outcome as keyof typeof outcomeIcons;
            const style = (outcomeKey && outcomeIcons[outcomeKey]) || {
              icon: UserCheck,
              color: 'text-emerald-400 bg-emerald-500/10',
            };
            const Icon = style.icon;

            return (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs flex items-start space-x-3"
              >
                <div className={`p-2 rounded-lg border border-white/5 ${style.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white truncate">{log.changed_by}</p>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-0.5">
                    {log.outcome ? log.outcome.replace('_', ' ') : `Status: ${log.new_status}`}
                  </p>
                  {log.notes && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic">
                      &quot;{log.notes}&quot;
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
