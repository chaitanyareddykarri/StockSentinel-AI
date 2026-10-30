'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, getClientAuthHeaders } from '@/context/AuthContext';
import { extractInvitationToken } from '@/lib/auth/invitationTokens';
import {
  Building2,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  LogIn,
  LogOut,
} from 'lucide-react';

interface InvitationDetails {
  id: string;
  email: string;
  companyId: string;
  companyName: string;
  storeId?: string;
  storeName?: string;
  role: string;
  expiresAt: string;
}

function InvitationAcceptanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawParamToken = searchParams.get('token');
  const token = rawParamToken ? extractInvitationToken(rawParamToken) : null;
  const { user, loading: authLoading, refreshSession, signOut } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const fetchInvitation = useCallback(async () => {
    if (!token) {
      setError('No invitation token found in this link. Please check your invitation URL.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(data.error || 'This invitation link is invalid or has expired.');
      } else {
        setInvitation(data.invitation);
      }
    } catch {
      setError('Network error while validating invitation link.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (isMounted) {
        await fetchInvitation();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [fetchInvitation]);

  const handleAccept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    setError(null);

    try {
      const headers = await getClientAuthHeaders();
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to accept invitation.');
        setAccepting(false);
        return;
      }

      setSuccess(true);
      await refreshSession();
    } catch {
      setError('Network error during invitation acceptance. Please retry.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-3xl border border-slate-200 bg-white/95 shadow-xl max-w-sm w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto animate-pulse">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-700">Validating single-use invitation...</p>
        </div>
      </div>
    );
  }

  // Error State: Invalid / Expired / Revoked
  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-rose-50/20 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">Invitation Expired or Invalid</h1>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857]"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  if (success && invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-emerald-200 shadow-2xl p-8 text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900">Welcome to StockSentinel AI!</h1>
            <p className="text-xs text-slate-500">
              You are now assigned as Store Manager for{' '}
              <span className="font-bold text-slate-800">{invitation.storeName}</span> ({invitation.companyName}).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-left text-xs space-y-1.5 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Retail Organization:</span>
              <span className="font-bold text-slate-900">{invitation.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned Store:</span>
              <span className="font-bold text-emerald-900">{invitation.storeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role:</span>
              <span className="font-semibold text-slate-800">{invitation.role}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer"
          >
            <span>Enter Store Operations Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const isEmailMatching = user && invitation && user.email.toLowerCase().trim() === invitation.email.toLowerCase().trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <Building2 className="w-3.5 h-3.5" />
            <span>Store Manager Invitation</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Join {invitation?.companyName}
          </h1>
          <p className="text-xs text-slate-500">
            You have been invited to manage inventory operations for a retail location.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invitation Summary Card */}
        {invitation && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shrink-0">
                <StoreIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{invitation.storeName}</h3>
                <p className="text-[11px] text-slate-500">{invitation.companyName}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-slate-700 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Invited Email:</span>
                <span className="font-bold text-slate-800">{invitation.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {invitation.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expiration:</span>
                <span>{new Date(invitation.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* State 1: User Not Logged In */}
        {!user && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-600 text-center">
              Please sign in or register an account with <span className="font-bold text-slate-800">{invitation?.email}</span> to accept this invitation.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
                className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Accept</span>
              </Link>
              <Link
                href={`/signup?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
                className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <span>Create New Account</span>
              </Link>
            </div>
          </div>
        )}

        {/* State 2: User Logged In, but Email Mismatch */}
        {user && !isEmailMatching && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-xs text-amber-900">
            <div className="flex items-center space-x-2 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Email Mismatch</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              You are currently signed in as <span className="font-semibold">{user.email}</span>, but this invitation was issued exclusively to <span className="font-semibold">{invitation?.email}</span>.
            </p>
            <button
              onClick={() => signOut()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out to Switch Accounts</span>
            </button>
          </div>
        )}

        {/* State 3: User Logged In and Email Matches -> Ready to Accept */}
        {user && isEmailMatching && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Authenticated as <span className="font-bold text-slate-800">{user.email}</span>
              </span>
            </div>

            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
            >
              {accepting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Provisioning Store Assignment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accept Invitation & Activate Store</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitationAcceptancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="glass-panel p-8 rounded-3xl border border-slate-200 bg-white/95 shadow-xl max-w-sm w-full text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold text-slate-700">Loading invitation...</p>
          </div>
        </div>
      }
    >
      <InvitationAcceptanceContent />
    </Suspense>
  );
}
