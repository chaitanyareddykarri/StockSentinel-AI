'use client';

import React from 'react';
import { AuditLogEntry } from '@/types';
import { UserCheck, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

interface RecentAuditFeedProps {
  auditLogs: AuditLogEntry[];
}

export function RecentAuditFeed({ auditLogs }: RecentAuditFeedProps) {
  const outcomeIcons = {
    PHANTOM_CONFIRMED: { icon: AlertOctagon, color: 'text-rose-700 bg-rose-50 border-rose-200' },
    BACKROOM_DISPLACED: { icon: HelpCircle, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    MISPLACED_SHELF: { icon: HelpCircle, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    THEFT_SHRINKAGE: { icon: AlertOctagon, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    IN_STOCK_FALSE_ALARM: { icon: CheckCircle2, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  };

  return (
    <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-emerald-900/10 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <UserCheck className="w-4 h-4 text-emerald-700" />
          <span>Recent Physical Verifications</span>
        </h3>
        <span className="text-xs text-slate-500 font-medium">{auditLogs.length} Verified Records</span>
      </div>

      <div className="space-y-2.5">
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No physical shelf walks completed yet. Open an alert to record a verification.
          </p>
        ) : (
          auditLogs.slice(0, 4).map((log) => {
            const outcomeKey = log.outcome as keyof typeof outcomeIcons;
            const style = (outcomeKey && outcomeIcons[outcomeKey]) || {
              icon: UserCheck,
              color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
            };
            const Icon = style.icon;

            return (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs flex items-start space-x-3"
              >
                <div className={`p-2 rounded-lg border shrink-0 ${style.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 truncate">{log.changed_by}</p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium mt-0.5">
                    {log.outcome ? log.outcome.replace(/_/g, ' ') : `Status: ${log.new_status}`}
                  </p>
                  {log.notes && (
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 italic">
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
