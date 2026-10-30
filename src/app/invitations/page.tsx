'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getClientAuthHeaders } from '@/context/AuthContext';
import { extractInvitationToken } from '@/lib/auth/invitationTokens';
import {
  Mail,
  Building2,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  KeyRound,
  Clock,
  Sparkles,
} from 'lucide-react';

interface InvitationItem {
  id: string;
  companyId: string;
  companyName: string;
  storeId?: string;
  storeName?: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function InvitationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshSession } = useAuth();

  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getClientAuthHeaders();
      const res = await fetch('/api/invitations', { headers });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted && user) {
        await fetchInvitations();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user, fetchInvitations]);

  const handleAccept = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setFeedback(null);
    try {
      const headers = await getClientAuthHeaders();
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to accept invitation.');
      }

      setFeedback({
        type: 'success',
        message: 'Invitation accepted! Your store workspace is ready. Redirecting to dashboard...',
      });

      await refreshSession();

      setTimeout(() => {
        router.push('/dashboard');
      }, 900);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to accept invitation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    setActionLoadingId(invitationId);
    setFeedback(null);
    try {
      const headers = await getClientAuthHeaders();
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'decline', invitationId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to decline invitation.');
      }

      setFeedback({ type: 'success', message: 'Invitation declined.' });
      await fetchInvitations();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to decline invitation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClaimToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) return;

    setTokenLoading(true);
    setFeedback(null);
    try {
      const effectiveToken = extractInvitationToken(cleanToken);
      const headers = await getClientAuthHeaders();

      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: effectiveToken }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Invalid or expired invitation token.');
      }

      setFeedback({
        type: 'success',
        message: 'Invitation claimed! Your store workspace is ready. Redirecting...',
      });

      await refreshSession();

      setTimeout(() => {
        router.push('/dashboard');
      }, 900);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid or expired invitation token.',
      });
    } finally {
      setTokenLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xl max-w-sm w-full text-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-700 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
          <Mail className="w-10 h-10 text-emerald-700 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Sign In to View Invitations</h2>
          <p className="text-xs text-slate-500">
            You must be signed in to review and accept invitations addressed to your email.
          </p>
          <Link
            href="/login?redirect=/invitations"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Breadcrumb & Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-emerald-700" />
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Store Manager Invitations
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Invitations issued by retail companies to <span className="font-semibold text-slate-700">{user.email}</span>.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchInvitations()}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href={user.accessState === 'COMPANY_MANAGER' ? '/stores' : user.accessState === 'STORE_MANAGER' ? '/dashboard' : '/access-status'}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-2xs"
            >
              <span>Back to Workspace</span>
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-center space-x-2 border shadow-xs ${feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        )}

        {/* Pending Invitations List */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Pending Action</span>
            </h2>
            <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {invitations.length} Available
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600" />
              <p>Checking for pending invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-8 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Mail className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No Pending Invitations</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                No store manager invitations are currently pending for <span className="font-semibold text-slate-700">{user.email}</span>.
                Ask your company administrator to invite you to their store location.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => {
                const isActing = actionLoadingId === inv.id;
                const expiresFormatted = new Date(inv.expiresAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={inv.id}
                    className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-900 text-sm">
                          <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>{inv.companyName}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-xs text-emerald-900 font-semibold">
                          <StoreIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{inv.storeName || 'Assigned Retail Store'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({inv.role})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Expires {expiresFormatted}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => handleDecline(inv.id)}
                        disabled={isActing}
                        className="py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Decline
                      </button>

                      <button
                        onClick={() => handleAccept(inv.id)}
                        disabled={isActing}
                        className="flex items-center space-x-1.5 py-2 px-4 rounded-lg text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {isActing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Accept &amp; Enter Workspace</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Claim Token Manually */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-900">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <h2>Claim Single-Use Invitation Token</h2>
          </div>
          <p className="text-xs text-slate-500">
            If a company manager shared a direct invitation link or token code with you outside the platform, paste it here to activate your workspace.
          </p>
          <form onSubmit={handleClaimToken} className="flex gap-2 pt-1">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste invite link or token string (e.g. 4a2b...)"
              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={tokenLoading || !tokenInput.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] disabled:opacity-50 cursor-pointer shrink-0 transition-colors"
            >
              {tokenLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Claim Workspace'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
