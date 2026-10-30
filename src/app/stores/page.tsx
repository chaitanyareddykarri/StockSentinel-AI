'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import {
  Building2,
  Store as StoreIcon,
  Plus,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  Mail,
  Send,
  Trash2,
  Users,
  AlertTriangle,
  Edit2,
} from 'lucide-react';

interface EnrichedStore {
  id: string;
  name: string;
  location?: string;
  manager: { userId: string; name: string; email: string } | null;
  pendingInvitation: { id: string; email: string; expiresAt: string } | null;
}

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  maxStores: number;
  status: string;
}

interface InvitationRecord {
  id: string;
  storeId?: string;
  storeName?: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function StoresManagementPage() {
  const { user } = useAuth();

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [stores, setStores] = useState<EnrichedStore[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Store modal state
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreLocation, setNewStoreLocation] = useState('');
  const [newStoreManagerEmail, setNewStoreManagerEmail] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Invite Manager to existing store modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteStoreTarget, setInviteStoreTarget] = useState<{ id: string; name: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteModalLoading, setInviteModalLoading] = useState(false);
  const [inviteModalError, setInviteModalError] = useState<string | null>(null);

  // Action status (resend/revoke)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Result display for generated invite links
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<{ delivered: boolean; warning?: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Edit Company Name modal state
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyLoading, setEditCompanyLoading] = useState(false);
  const [editCompanyError, setEditCompanyError] = useState<string | null>(null);

  const fetchStoresData = useCallback(async () => {
    try {
      setError(null);
      const [storesRes, invRes] = await Promise.all([
        fetch('/api/company/stores'),
        fetch('/api/company/invitations'),
      ]);

      if (!storesRes.ok) {
        throw new Error('Failed to retrieve company store telemetry.');
      }

      const storesData = await storesRes.json();
      setCompany(storesData.company);
      setStores(storesData.stores || []);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.invitations || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load store data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted) {
        await fetchStoresData();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [fetchStoresData]);

  const handleAddStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      setModalError('Store name is required.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const res = await fetch('/api/company/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStoreName.trim(),
          location: newStoreLocation.trim() || 'Retail Store',
          managerEmail: newStoreManagerEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to add store.');
      }

      if (data.invitation?.inviteUrl) {
        setCreatedInviteUrl(data.invitation.inviteUrl);
        setEmailDeliveryNotice({
          delivered: Boolean(data.invitation.emailDelivered),
          warning: data.invitation.emailWarning,
        });
      } else {
        setIsAddStoreOpen(false);
        setNewStoreName('');
        setNewStoreLocation('');
        setNewStoreManagerEmail('');
      }

      await fetchStoresData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleInviteManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteStoreTarget) return;
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteModalError('Valid store manager email address is required.');
      return;
    }

    setInviteModalLoading(true);
    setInviteModalError(null);

    try {
      const res = await fetch('/api/company/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: inviteStoreTarget.id,
          email: inviteEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to issue invitation.');
      }

      if (data.invitation?.inviteUrl) {
        setCreatedInviteUrl(data.invitation.inviteUrl);
        setEmailDeliveryNotice({
          delivered: Boolean(data.invitation.emailDelivered),
          warning: data.invitation.emailWarning,
        });
      }

      setIsInviteModalOpen(false);
      setInviteEmail('');
      await fetchStoresData();
    } catch (err: unknown) {
      setInviteModalError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setInviteModalLoading(false);
    }
  };

  const handleEditCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editCompanyName.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      setEditCompanyError('Company name must be between 2 and 100 characters.');
      return;
    }

    setEditCompanyLoading(true);
    setEditCompanyError(null);

    try {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update company name.');
      }

      setCompany((prev) => (prev ? { ...prev, name: cleanName } : null));
      setIsEditCompanyOpen(false);
      setActionFeedback({
        type: 'success',
        message: 'Company profile updated successfully.',
      });
      setTimeout(() => setActionFeedback(null), 4000);
      await fetchStoresData();
    } catch (err: unknown) {
      setEditCompanyError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setEditCompanyLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this pending invitation? The recipient will no longer be able to onboard with this link.')) {
      return;
    }

    setActionLoadingId(invitationId);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/company/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action: 'revoke' }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to revoke invitation.');
      }

      setActionFeedback({ type: 'success', message: 'Invitation revoked successfully.' });
      await fetchStoresData();
    } catch (err: unknown) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to revoke invitation.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/company/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action: 'resend' }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to resend invitation.');
      }

      if (data.invitation?.inviteUrl) {
        setCreatedInviteUrl(data.invitation.inviteUrl);
        setEmailDeliveryNotice({
          delivered: Boolean(data.invitation.emailDelivered),
          warning: data.invitation.emailWarning,
        });
      }

      setActionFeedback({
        type: 'success',
        message: data.invitation?.emailDelivered
          ? 'Invitation email resent successfully.'
          : 'New single-use invitation link generated. Copy the link below to share with the manager.',
      });
      await fetchStoresData();
    } catch (err: unknown) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to resend invitation.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyCreatedLink = (url: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = url.startsWith('http') ? url : `${origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const maxStoresAllowed = company?.maxStores || 20;
  const currentStoresCount = stores.length;
  const remainingQuota = Math.max(0, maxStoresAllowed - currentStoresCount);
  const activeManagersCount = stores.filter((s) => s.manager !== null).length;
  const pendingInvitationsCount = invitations.filter((i) => i.status === 'PENDING').length;
  const quotaPercent = Math.min(100, Math.round((currentStoresCount / maxStoresAllowed) * 100));

  return (
    <AppShell
      title="Store Network Management"
      subtitle="Monitor retail locations, quota allocations, and store manager assignments"
    >
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                {company?.name || user?.companyName || 'Retail Operations'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {company?.slug || user?.companySlug || 'active'}
              </span>
              {(user?.accessState === 'COMPANY_MANAGER' || user?.accessState === 'PLATFORM_ADMIN') && (
                <button
                  type="button"
                  onClick={() => {
                    setEditCompanyName(company?.name || user?.companyName || '');
                    setEditCompanyError(null);
                    setIsEditCompanyOpen(true);
                  }}
                  title="Edit Company Name"
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Allocated Quota: <span className="font-bold text-slate-800">{currentStoresCount}</span> of{' '}
              <span className="font-bold text-slate-800">{maxStoresAllowed}</span> maximum stores configured.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setModalError(null);
                setCreatedInviteUrl(null);
                setEmailDeliveryNotice(null);
                setIsAddStoreOpen(true);
              }}
              disabled={currentStoresCount >= maxStoresAllowed}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Store</span>
            </button>
          </div>
        </div>

        {/* Company Overview KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Stores</span>
              <StoreIcon className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-slate-900">{currentStoresCount}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {maxStoresAllowed}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Managers</span>
              <Users className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl font-black text-slate-900">{activeManagersCount}</div>
            <p className="text-[11px] text-slate-500 font-medium">Assigned store leaders</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pending Invites</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-700">{pendingInvitationsCount}</div>
            <p className="text-[11px] text-slate-500 font-medium">Awaiting onboarding</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Available Quota</span>
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-xl font-black text-slate-900">{remainingQuota}</div>
            <p className="text-[11px] text-slate-500 font-medium">Store slots remaining</p>
          </div>
        </div>

        {/* Global Action Feedback Notification */}
        {actionFeedback && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-2xs ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Link / Delivery Notification Banner */}
        {createdInviteUrl && (
          <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Single-Use Store Manager Invitation Active
                </h4>
              </div>
              <button
                onClick={() => {
                  setCreatedInviteUrl(null);
                  setEmailDeliveryNotice(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailDeliveryNotice && !emailDeliveryNotice.delivered && (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-600/40 text-amber-200 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {emailDeliveryNotice.warning ||
                    'Email service unconfigured (RESEND_API_KEY not set). Share the link below directly with the invited store manager.'}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={
                  typeof window !== 'undefined' && !createdInviteUrl.startsWith('http')
                    ? `${window.location.origin}${createdInviteUrl}`
                    : createdInviteUrl
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-300 select-all focus:outline-none"
              />
              <button
                onClick={() => copyCreatedLink(createdInviteUrl)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 cursor-pointer transition-colors"
              >
                {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedInvite ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => fetchStoresData()} className="font-bold underline cursor-pointer">Retry</button>
          </div>
        )}

        {/* Stores Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Configured Retail Stores ({stores.length})
            </h3>
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{s.name}</h4>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">{s.id}</p>
                    </div>
                    <span className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-emerald-700">
                      <StoreIcon className="w-4 h-4" />
                    </span>
                  </div>

                  {s.location && (
                    <p className="text-xs text-slate-500">{s.location}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-400">Store Manager:</span>
                    {s.manager ? (
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{s.manager.name}</span>
                      </span>
                    ) : s.pendingInvitation ? (
                      <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Invitation Pending</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setInviteStoreTarget({ id: s.id, name: s.name });
                          setInviteModalError(null);
                          setInviteEmail('');
                          setIsInviteModalOpen(true);
                        }}
                        className="flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Invite Manager</span>
                      </button>
                    )}
                  </div>

                  {s.manager && (
                    <p className="text-[11px] text-slate-500 truncate">
                      {s.manager.email}
                    </p>
                  )}

                  {s.pendingInvitation && (
                    <p className="text-[11px] text-amber-700 truncate">
                      Invited: {s.pendingInvitation.email}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invitations Audit & Management Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Store Manager Invitations</h3>
              <p className="text-xs text-slate-500">
                Cryptographic single-use tokens issued for store manager onboarding.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {invitations.length} Total
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No store manager invitations have been issued yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-4">Target Store</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{inv.email}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.storeName || inv.storeId || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : inv.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : inv.status === 'REVOKED'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.status === 'PENDING' ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleResendInvitation(inv.id)}
                              disabled={actionLoadingId === inv.id}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                              title="Generate a new active invitation link"
                            >
                              <Send className="w-3 h-3" />
                              <span>Resend</span>
                            </button>
                            <button
                              onClick={() => handleRevokeInvitation(inv.id)}
                              disabled={actionLoadingId === inv.id}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                              title="Revoke this pending invitation"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Store Modal */}
      {isAddStoreOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Provision New Retail Store</h3>
              <button
                onClick={() => setIsAddStoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStoreSubmit} className="space-y-3.5 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="e.g. Redmond Center #402"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Location</label>
                <input
                  type="text"
                  value={newStoreLocation}
                  onChange={(e) => setNewStoreLocation(e.target.value)}
                  placeholder="e.g. Redmond, WA"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Store Manager Email (Optional Invitation)
                </label>
                <input
                  type="email"
                  value={newStoreManagerEmail}
                  onChange={(e) => setNewStoreManagerEmail(e.target.value)}
                  placeholder="e.g. manager@retailco.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  If provided, a single-use token link will be created automatically.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStoreOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {modalLoading ? 'Adding Store...' : 'Add Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Store Manager to Existing Store Modal */}
      {isInviteModalOpen && inviteStoreTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Invite Store Manager</h3>
                <p className="text-[11px] text-slate-500">
                  Target Store: <span className="font-semibold text-slate-800">{inviteStoreTarget.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteManagerSubmit} className="space-y-3.5 text-xs">
              {inviteModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {inviteModalError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Manager Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. store.manager@retailco.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  A cryptographic single-use invitation token expiring in 7 days will be generated.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteModalLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {inviteModalLoading ? 'Generating Link...' : 'Issue Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Company Name Modal */}
      {isEditCompanyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200/80 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <h3 className="font-extrabold text-sm text-slate-900">Edit Company Name</h3>
              </div>
              <button
                onClick={() => setIsEditCompanyOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCompanySubmit} className="space-y-3.5 text-xs">
              {editCompanyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {editCompanyError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Company Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  placeholder="e.g. Pacific Retail Enterprises"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Updates your enterprise identity across reports, store assignments, and manager invitations.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditCompanyOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editCompanyLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {editCompanyLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
