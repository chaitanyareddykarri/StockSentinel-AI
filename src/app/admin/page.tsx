'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldAlert,
  Building2,
  Store as StoreIcon,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  PauseCircle,
  PlayCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CompanyAdminRecord {
  id: string;
  name: string;
  slug: string;
  maxStores: number;
  storeCount: number;
  status: 'ACTIVE' | 'SUSPENDED';
  isDemo: boolean;
  createdBy: string;
  createdAt: string;
}

interface PlatformAdminRecord {
  id: string;
  name: string;
  email: string;
  verifiedAt: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  const [companies, setCompanies] = useState<CompanyAdminRecord[]>([]);
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    try {
      setError(null);
      const [compRes, adminRes] = await Promise.all([
        fetch('/api/admin/companies'),
        fetch('/api/admin/platform-admins'),
      ]);

      if (!compRes.ok || !adminRes.ok) {
        if (compRes.status === 403 || adminRes.status === 403) {
          throw new Error('Forbidden: Platform Administrator privileges required.');
        }
        throw new Error('Unable to retrieve platform administrative data.');
      }

      const compData = await compRes.json();
      const adminData = await adminRes.json();

      setCompanies(compData.companies || []);
      setAdmins(adminData.admins || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Administrative query failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted) {
        if (!authLoading && user?.accessState === 'PLATFORM_ADMIN') {
          await fetchAdminData();
        } else if (!authLoading) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [authLoading, user, fetchAdminData]);

  const handleToggleStatus = async (companyId: string, currentStatus: 'ACTIVE' | 'SUSPENDED') => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setActionInProgress(companyId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update company status.');
      }

      // Update state locally
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, status: nextStatus } : c))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-3xl border border-slate-200 bg-white/95 shadow-xl max-w-sm w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto animate-pulse">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-slate-700">Verifying platform administrator credentials...</p>
        </div>
      </div>
    );
  }

  // Security Check: Non-platform admins cannot access
  if (user?.accessState !== 'PLATFORM_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">403 — Unauthorized Administrative Access</h1>
          <p className="text-xs text-slate-500">
            Platform Administration is restricted to verified system operators. Accounts cannot gain platform admin rights through signup, self-selection, or profile edits.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            <span>Return to Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const totalStores = companies.reduce((acc, c) => acc + c.storeCount, 0);
  const activeCompanies = companies.filter((c) => c.status === 'ACTIVE').length;
  const suspendedCompanies = companies.filter((c) => c.status === 'SUSPENDED').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/10 to-slate-50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Administrative Bar */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-900 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Platform Administration
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              PLATFORM_ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Protected control plane for enterprise retail onboarding, store quotas, and tenant status enforcement.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchAdminData()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Telemetry</span>
          </button>
          <Link
            href="/dashboard"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-2xs"
          >
            <span>Operations Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="font-bold underline text-xs">Dismiss</button>
          </div>
        )}

        {/* 4-Card Administrative Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Companies</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{companies.length}</div>
            <p className="text-[11px] text-slate-500">Registered retail organizations</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Tenants</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">{activeCompanies}</div>
            <p className="text-[11px] text-slate-500">Operating without restrictions</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Suspended Accounts</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-700">{suspendedCompanies}</div>
            <p className="text-[11px] text-slate-500">Access revoked platform-wide</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Monitored Stores</span>
              <StoreIcon className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{totalStores}</div>
            <p className="text-[11px] text-slate-500">Physical retail workspaces</p>
          </div>
        </div>

        {/* Companies Management Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tenant Companies</h2>
              <p className="text-xs text-slate-500">
                Manage organization status, monitor store quotas, and enforce suspension policies.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {companies.length} Organization{companies.length === 1 ? '' : 's'}
            </span>
          </div>

          {companies.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No retail companies registered on this platform yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Identifier Slug</th>
                    <th className="py-3 px-4">Stores (Active / Quota)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Registered</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((c) => {
                    const isPendingAction = actionInProgress === c.id;
                    const isSuspended = c.status === 'SUSPENDED';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.id}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{c.slug}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800">{c.storeCount}</span>
                          <span className="text-slate-400"> / {c.maxStores}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isSuspended
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {c.isDemo ? (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Demo Seed
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              Live Enterprise
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleToggleStatus(c.id, c.status)}
                            disabled={isPendingAction}
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                              isSuspended
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            }`}
                          >
                            {isPendingAction ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : isSuspended ? (
                              <PlayCircle className="w-3.5 h-3.5" />
                            ) : (
                              <PauseCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{isSuspended ? 'Activate Tenant' : 'Suspend Tenant'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Platform Administrators Table & Security Callout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-indigo-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Verified Platform Administrators</h3>
                <p className="text-xs text-slate-500">Accounts verified to execute cross-tenant management</p>
              </div>
            </div>

            <div className="space-y-2">
              {admins.length === 0 ? (
                <div className="text-xs text-slate-500 py-3">No other administrators provisioned.</div>
              ) : (
                admins.map((adm) => (
                  <div
                    key={adm.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{adm.name}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{adm.email}</div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      Active Administrator
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Security Callout */}
          <div className="p-6 rounded-3xl bg-indigo-950 text-white shadow-xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-indigo-800/60 text-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                <span>Security Assurance</span>
              </div>
              <h4 className="text-sm font-bold tracking-tight">Zero-Trust Role Anchoring</h4>
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                Platform Admin permissions originate exclusively from database migration records and trusted server authentication. Client-side role selection, query parameters, or profile tampering are rejected platform-wide.
              </p>
            </div>

            <div className="pt-4 border-t border-indigo-800/60 text-[11px] text-indigo-300">
              Audit logging active across all administrative route handlers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
