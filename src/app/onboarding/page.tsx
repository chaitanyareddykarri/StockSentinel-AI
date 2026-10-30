'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Building2,
  Store as StoreIcon,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface StoreInput {
  name: string;
  location: string;
  managerName: string;
  managerEmail: string;
}

interface GeneratedInvitation {
  id: string;
  storeId: string;
  storeName: string;
  managerEmail: string;
  role: string;
  rawToken: string;
  inviteUrl: string;
  expiresAt: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Company Profile
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [headquarters, setHeadquarters] = useState('');

  // Step 2: Store Capacity (1-20)
  const [storeCount, setStoreCount] = useState<number>(3);

  // Step 3: Stores Data
  const [stores, setStores] = useState<StoreInput[]>([
    { name: 'Store #101 - Seattle Flagship', location: 'Seattle, WA', managerName: '', managerEmail: '' },
    { name: 'Store #204 - Bellevue Square', location: 'Bellevue, WA', managerName: '', managerEmail: '' },
    { name: 'Store #308 - Tacoma Center', location: 'Tacoma, WA', managerName: '', managerEmail: '' },
  ]);

  // Step 4 Completion
  const [completedCompany, setCompletedCompany] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [invitations, setInvitations] = useState<GeneratedInvitation[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Auto-slugify company name
  const handleNameChange = (val: string) => {
    setCompanyName(val);
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setCompanySlug(slug);
  };

  // Adjust store array when storeCount changes
  const handleStoreCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(20, count));
    setStoreCount(validCount);

    setStores((prev) => {
      const next = [...prev];
      if (validCount > prev.length) {
        for (let i = prev.length; i < validCount; i++) {
          next.push({
            name: `Store #${100 + i + 1}`,
            location: 'Retail Store',
            managerName: '',
            managerEmail: '',
          });
        }
      } else {
        return next.slice(0, validCount);
      }
      return next;
    });
  };

  const updateStore = (index: number, field: keyof StoreInput, value: string) => {
    setStores((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Step validation
  const validateStep1 = () => {
    if (!companyName.trim() || companyName.trim().length < 2) {
      setErrorMessage('Please enter a valid company name (at least 2 characters).');
      return false;
    }
    if (!companySlug.trim() || companySlug.trim().length < 3) {
      setErrorMessage('Company slug must be at least 3 characters.');
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(companySlug.trim())) {
      setErrorMessage('Slug can only contain lowercase letters, numbers, and hyphens.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const validateStep3 = () => {
    for (let i = 0; i < stores.length; i++) {
      const s = stores[i];
      if (!s.name.trim()) {
        setErrorMessage(`Please enter a name for Store #${i + 1}.`);
        return false;
      }
      if (s.managerEmail && s.managerEmail.trim()) {
        const email = s.managerEmail.trim();
        if (!email.includes('@') || email.length < 5) {
          setErrorMessage(`Invalid email address provided for Store #${i + 1} manager.`);
          return false;
        }
      }
    }
    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 3 && !validateStep3()) return;
    setErrorMessage(null);
    setStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleSubmitOnboarding = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/company/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          slug: companySlug.trim(),
          maxStores: storeCount,
          stores: stores.map((s) => ({
            name: s.name.trim(),
            location: s.location.trim() || 'Retail Store',
            managerName: s.managerName.trim(),
            managerEmail: s.managerEmail.trim(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to complete company onboarding.');
        setLoading(false);
        return;
      }

      setCompletedCompany(data.company);
      setInvitations(data.invitations || []);

      // Refresh authentication session to elevate user to COMPANY_MANAGER with active companyId
      await refreshSession();
    } catch {
      setErrorMessage('Network error during onboarding submission. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = (rawToken: string, inviteUrl: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = inviteUrl.startsWith('http')
      ? inviteUrl
      : `${origin}${inviteUrl.startsWith('/') ? '' : '/'}${inviteUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(rawToken);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Render Completion Screen if onboarded
  if (completedCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-2xl w-full bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-10 space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Company Onboarding Completed!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              <span className="font-bold text-slate-800">{completedCompany.name}</span> has been provisioned with {stores.length} store workspaces.
            </p>
          </div>

          {/* Invitation Links Section */}
          {invitations.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Store Manager Invitations</h3>
                  <p className="text-[11px] text-slate-500">
                    Single-use cryptographic invitation tokens generated for each assigned store manager.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {invitations.length} Active Link{invitations.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {invitations.map((inv) => {
                  const isCopied = copiedToken === inv.rawToken;
                  return (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{inv.storeName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({inv.storeId})</span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">
                          Invited: <span className="font-medium">{inv.managerEmail}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => copyInviteLink(inv.rawToken, inv.inviteUrl)}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied!' : 'Copy Invitation Link'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Links expire in 7 days. Store managers will be prompted to sign in with their invited email address.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
              No store managers were specified during onboarding. You can invite store managers anytime from the Store Network dashboard.
            </div>
          )}

          {/* Action button to operational dashboard */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer transition-colors"
          >
            <span>Proceed to Operations Command Center</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Retail Enterprise Onboarding</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Company & Store Network Provisioning
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Configure your company profile, specify retail locations, and provision store manager access.
          </p>
        </div>

        {/* Wizard Progress Bar */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { num: 1, label: 'Company' },
            { num: 2, label: 'Capacity' },
            { num: 3, label: 'Stores' },
            { num: 4, label: 'Confirm' },
          ].map((s) => (
            <div
              key={s.num}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                step === s.num
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-2xs'
                  : step > s.num
                  ? 'bg-white border-emerald-200 text-emerald-700 font-semibold'
                  : 'bg-white/60 border-slate-200 text-slate-400 font-medium'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Step {s.num}</div>
              <div className="text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Wizard Step Panels */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
          {/* STEP 1: Company Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Building2 className="w-5 h-5 text-emerald-700" />
                <h2 className="text-sm font-bold text-slate-900">Step 1: Retail Company Details</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Legal or Operating Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Apex Retail Group"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Identifier Slug *
                  </label>
                  <input
                    type="text"
                    value={companySlug}
                    onChange={(e) => setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="e.g. apex-retail"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Unique workspace key (lowercase letters, numbers, and hyphens).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Headquarters / Region (Optional)
                  </label>
                  <input
                    type="text"
                    value={headquarters}
                    onChange={(e) => setHeadquarters(e.target.value)}
                    placeholder="e.g. Pacific Northwest Division (Seattle, WA)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Store Capacity */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <StoreIcon className="w-5 h-5 text-emerald-700" />
                <h2 className="text-sm font-bold text-slate-900">Step 2: Store Network Scale</h2>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Select the number of physical stores your organization will monitor (1 to 20 locations supported).
                </p>

                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col items-center justify-center space-y-4">
                  <div className="text-4xl font-extrabold text-[#064e3b]">
                    {storeCount}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Configured Store{storeCount === 1 ? '' : 's'}
                  </span>

                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={storeCount}
                    onChange={(e) => handleStoreCountChange(Number(e.target.value))}
                    className="w-full max-w-xs accent-[#064e3b] cursor-pointer"
                  />

                  <div className="flex items-center space-x-2">
                    {[1, 3, 5, 10, 15, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleStoreCountChange(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          storeCount === preset
                            ? 'bg-[#064e3b] text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Store Details & Store Manager Assignment */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-emerald-700" />
                  <h2 className="text-sm font-bold text-slate-900">Step 3: Store Configurations & Managers</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {stores.length} Location{stores.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {stores.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span>Store Location #{idx + 1}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ID: store_{companySlug || 'comp'}_{idx + 1}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Store Name *
                        </label>
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => updateStore(idx, 'name', e.target.value)}
                          placeholder="e.g. Seattle Flagship #101"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Location / City
                        </label>
                        <input
                          type="text"
                          value={s.location}
                          onChange={(e) => updateStore(idx, 'location', e.target.value)}
                          placeholder="e.g. Seattle, WA"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Store Manager Name
                        </label>
                        <input
                          type="text"
                          value={s.managerName}
                          onChange={(e) => updateStore(idx, 'managerName', e.target.value)}
                          placeholder="e.g. Sarah Chen"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Manager Email (Sends Invitation)
                        </label>
                        <input
                          type="email"
                          value={s.managerEmail}
                          onChange={(e) => updateStore(idx, 'managerEmail', e.target.value)}
                          placeholder="e.g. sarah.chen@company.com"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Review & Submit */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <h2 className="text-sm font-bold text-slate-900">Step 4: Review Network Setup</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Company Name:</span>
                    <span className="font-bold text-slate-900">{companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Workspace Slug:</span>
                    <span className="font-mono font-semibold text-slate-800">{companySlug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Store Count:</span>
                    <span className="font-bold text-emerald-800">{stores.length} of 20 maximum</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                  <span className="font-bold text-slate-900 block">Configured Stores:</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {stores.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 text-[11px]">
                        <div>
                          <span className="font-semibold text-slate-800">{s.name}</span>
                          <span className="text-slate-400 ml-1">({s.location})</span>
                        </div>
                        <span className="text-slate-600">
                          {s.managerEmail ? s.managerEmail : <span className="text-slate-400 italic">No manager assigned</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Clicking below will provision your company workspace and issue single-use invitation tokens for all specified store managers.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitOnboarding}
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[#064e3b] text-white hover:bg-[#047857] shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Provisioning Network...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Launch Network</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
