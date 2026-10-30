'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getClientAuthHeaders } from '@/context/AuthContext';
import { extractInvitationToken } from '@/lib/auth/invitationTokens';
import {
  ShieldAlert,
  Clock,
  Building2,
  Mail,
  LogOut,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Store as StoreIcon,
  RefreshCw,
  AlertCircle,
  X,
  KeyRound,
} from 'lucide-react';

interface PendingInvite {
  id: string;
  companyId: string;
  companyName: string;
  storeId?: string;
  storeName?: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function AccessStatusPage() {
  const { user, loading, signOut, refreshSession } = useAuth();
  const router = useRouter();

  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [manualToken, setManualToken] = useState<string>('');
  const [manualTokenLoading, setManualTokenLoading] = useState<boolean>(false);

  // Fetch pending invitations for this user's verified email
  const fetchInvitations = useCallback(async () => {
    if (!user?.email) return;
    try {
      setInvitesLoading(true);
      const headers = await getClientAuthHeaders();
      const res = await fetch('/api/invitations', { headers });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch {
      // Gracefully handle network issues
    } finally {
      setInvitesLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted && user?.email) {
        await fetchInvitations();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user?.email, fetchInvitations]);

  const handleAcceptInvitation = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setActionFeedback(null);
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

      setActionFeedback({
        type: 'success',
        message: 'Invitation accepted! Your store workspace is ready. Redirecting...',
      });

      await refreshSession();

      setTimeout(() => {
        router.push('/dashboard');
      }, 900);
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to accept invitation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to decline this store manager invitation?')) return;
    setActionLoadingId(invitationId);
    setActionFeedback(null);
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
      setActionFeedback({ type: 'success', message: 'Invitation declined.' });
      await fetchInvitations();
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to decline invitation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = manualToken.trim();
    if (!cleanToken) return;

    setManualTokenLoading(true);
    setActionFeedback(null);
    try {
      // Robust token extraction: supports raw token, full URL, or malformed concatenated URL
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

      setActionFeedback({
        type: 'success',
        message: 'Invitation accepted! Your store workspace is ready. Redirecting...',
      });

      await refreshSession();

      setTimeout(() => {
        router.push('/dashboard');
      }, 900);
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid or expired invitation token.',
      });
    } finally {
      setManualTokenLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-3xl border border-emerald-100 bg-white/95 shadow-xl max-w-sm w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto animate-pulse">
            <Clock className="w-6 h-6 text-emerald-700" />
          </div>
          <p className="text-xs font-semibold text-slate-700">Checking organization authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
          <h2 className="text-base font-bold text-slate-900">Session Required</h2>
          <p className="text-xs text-slate-500">Please sign in to verify your organization access status.</p>
          <Link
            href="/login"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const isSuspended = user.accessState === 'SUSPENDED' || user.companyStatus === 'SUSPENDED';
  const isAuthorized =
    user.accessState === 'PLATFORM_ADMIN' ||
    user.accessState === 'COMPANY_MANAGER' ||
    user.accessState === 'STORE_MANAGER';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-2xs text-[11px] font-semibold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>StockSentinel AI Identity & Access Control</span>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center space-x-2 border shadow-xs ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
        )}

        {/* Main Status Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 space-y-6">
          {isSuspended ? (
            /* SUSPENDED STATE */
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-2xs">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-lg font-extrabold text-slate-900">
                  Account or Organization Suspended
                </h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Access to operational telemetry, inventory records, and AI assistance for this account has been revoked by platform administration.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-left space-y-1.5 text-xs text-rose-900">
                <div className="font-bold flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Administrative Policy Enforcement</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  Account: <span className="font-mono font-semibold">{user.email}</span>
                </p>
                <p className="text-[11px] text-rose-700">
                  Status: <span className="font-bold uppercase">{user.companyStatus || 'SUSPENDED'}</span>
                </p>
                <p className="text-[11px] text-rose-700 pt-1">
                  If you believe this suspension is in error, please reach out to your platform administrator or contact <span className="underline font-semibold">compliance@stocksentinel.ai</span>.
                </p>
              </div>
            </div>
          ) : isAuthorized ? (
            /* ACTIVE / AUTHORIZED USER */
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-2xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-lg font-extrabold text-slate-900">
                  Access Authorized
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Your account has active operational credentials as <span className="font-bold text-slate-700">{user.role || user.accessState}</span>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1 text-xs text-slate-700">
                <p><span className="font-medium text-slate-400">Account:</span> {user.email}</p>
                {user.companyName && <p><span className="font-medium text-slate-400">Company:</span> {user.companyName}</p>}
                {user.assignedStoreName && <p><span className="font-medium text-slate-400">Assigned Store:</span> {user.assignedStoreName}</p>}
              </div>

              <button
                onClick={() => router.push(user.accessState === 'COMPANY_MANAGER' ? '/stores' : '/dashboard')}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer"
              >
                <span>Enter Operations Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* PENDING ASSIGNMENT STATE */
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
                  <Clock className="w-7 h-7" />
                </div>
                <h1 className="text-lg font-extrabold text-slate-900">
                  Account Pending Organization Assignment
                </h1>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You are authenticated as <span className="font-semibold text-slate-800">{user.email}</span>, but your profile has not been assigned to a retail company or store.
                </p>
              </div>

              {/* 1. Pending Invitations Section (If Available) */}
              {invitations.length > 0 && (
                <div className="space-y-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                    <div className="flex items-center space-x-2">
                      <StoreIcon className="w-4 h-4 text-emerald-800" />
                      <h2 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                        Pending Store Manager Invitations ({invitations.length})
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Action Required
                    </span>
                  </div>

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
                          className="p-3.5 bg-white rounded-xl border border-emerald-200/70 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1.5 font-bold text-slate-900 text-xs">
                                <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>{inv.companyName}</span>
                              </div>
                              <p className="text-xs font-semibold text-emerald-800 flex items-center space-x-1">
                                <StoreIcon className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{inv.storeName || 'Assigned Store'}</span>
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Expires: {expiresFormatted}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 pt-1 border-t border-slate-100">
                            <button
                              onClick={() => handleAcceptInvitation(inv.id)}
                              disabled={isActing}
                              className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                            >
                              {isActing ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Accept &amp; Enter Workspace</span>
                            </button>

                            <button
                              onClick={() => handleDeclineInvitation(inv.id)}
                              disabled={isActing}
                              className="py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 cursor-pointer disabled:opacity-50 transition-colors"
                              title="Decline this invitation"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Manual Invitation Code / Link Input */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  <span>Have a Single-Use Invite Token?</span>
                </div>
                <form onSubmit={handleAcceptManualToken} className="flex gap-2">
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste invite link or token here..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={manualTokenLoading || !manualToken.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {manualTokenLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Claim'}
                  </button>
                </form>
              </div>

              {/* 3. Onboarding Options */}
              <div className="space-y-3">
                {/* Option 1: Onboard a New Company */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200 hover:border-emerald-300 transition-all space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-[#064e3b] text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Retail Company Executive</h3>
                      <p className="text-[10px] text-slate-500">Register your retail organization and configure stores</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    If you manage store operations for your company, complete our 4-step onboarding wizard to register your company and invite store managers.
                  </p>
                  <Link
                    href="/onboarding"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer"
                  >
                    <span>Launch Company Onboarding</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Option 2: Store Manager / Waiting on Invitation */}
                {invitations.length === 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800">Awaiting Store Invitation</h3>
                        <p className="text-[10px] text-slate-500">No active invitations found for {user.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">
                      Store managers do not self-register stores. Ask your company manager to issue you a single-use invitation sent to <span className="font-semibold text-slate-800">{user.email}</span>. Once issued, your invitation will automatically appear here.
                    </p>
                    <button
                      onClick={() => fetchInvitations()}
                      disabled={invitesLoading}
                      className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold hover:text-emerald-800 pt-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${invitesLoading ? 'animate-spin' : ''}`} />
                      <span>Check for New Invitations</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card Footer: Sign Out & Support */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Verified Session</span>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-1 text-slate-600 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
