import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  createStandaloneCompany,
  setCompanyMembership,
  addCompanyStore,
  findCompanyBySlug,
  hashInvitationToken,
  createStandaloneInvitation,
} from '@/lib/auth/userStore';
import { getMemoryStore } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { error: 'Authentication required to onboard a company.' },
        { status: 401 }
      );
    }

    if (auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Suspended users cannot onboard or manage companies.' },
        { status: 403 }
      );
    }

    if (auth.user.companyId && auth.user.companyStatus === 'ACTIVE' && auth.user.accessState === 'COMPANY_MANAGER') {
      return NextResponse.json(
        { error: 'You are already registered as the manager of an active company.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, slug, maxStores = 5, stores = [] } = body;

    // Validate company name
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: 'Company name must be between 2 and 100 characters.' },
        { status: 400 }
      );
    }

    // Validate slug
    const trimmedSlug = typeof slug === 'string' ? slug.toLowerCase().trim() : '';
    const slugRegex = /^[a-z0-9-]+$/;
    if (trimmedSlug.length < 3 || trimmedSlug.length > 60 || !slugRegex.test(trimmedSlug)) {
      return NextResponse.json(
        { error: 'Company slug must be 3-60 characters, containing only lowercase letters, numbers, and hyphens.' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = findCompanyBySlug(trimmedSlug);
    if (existing) {
      return NextResponse.json(
        { error: `Company slug "${trimmedSlug}" is already in use. Please select a unique identifier.` },
        { status: 409 }
      );
    }

    // Validate maxStores (1 to 20)
    const storeLimit = Number(maxStores);
    if (isNaN(storeLimit) || storeLimit < 1 || storeLimit > 20) {
      return NextResponse.json(
        { error: 'Number of stores must be between 1 and 20.' },
        { status: 400 }
      );
    }

    // Validate stores array
    if (!Array.isArray(stores) || stores.length < 1 || stores.length > storeLimit) {
      return NextResponse.json(
        { error: `You must specify between 1 and ${storeLimit} store configuration(s).` },
        { status: 400 }
      );
    }

    for (let i = 0; i < stores.length; i++) {
      const s = stores[i];
      if (!s || typeof s.name !== 'string' || s.name.trim().length < 2) {
        return NextResponse.json(
          { error: `Store #${i + 1} must have a valid name of at least 2 characters.` },
          { status: 400 }
        );
      }
      if (s.managerEmail && typeof s.managerEmail === 'string' && s.managerEmail.trim()) {
        const email = s.managerEmail.trim();
        if (!email.includes('@') || email.length < 5) {
          return NextResponse.json(
            { error: `Invalid email address provided for Store #${i + 1} manager.` },
            { status: 400 }
          );
        }
      }
    }

    // 1. Create company record
    const company = createStandaloneCompany({
      name: trimmedName,
      slug: trimmedSlug,
      maxStores: storeLimit,
      createdBy: auth.user.id,
    });

    // 2. Set creator's membership as COMPANY_MANAGER
    setCompanyMembership({
      userId: auth.user.id,
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      role: 'COMPANY_MANAGER',
      status: 'ACTIVE',
      companyStatus: 'ACTIVE',
    });

    // 3. Create stores and generate single-use invitations
    const createdStores: { id: string; name: string; location: string }[] = [];
    const generatedInvitations: {
      id: string;
      storeId: string;
      storeName: string;
      managerEmail: string;
      role: 'STORE_MANAGER';
      rawToken: string;
      inviteUrl: string;
      expiresAt: string;
    }[] = [];

    const memStore = getMemoryStore();

    for (let i = 0; i < stores.length; i++) {
      const s = stores[i];
      const storeId = `store_${company.slug}_${i + 1}`;
      const storeName = s.name.trim();
      const storeLocation = s.location?.trim() || 'Retail Store';

      // Register store in companyStoresCache
      addCompanyStore(company.id, { id: storeId, name: storeName });

      // Register store in in-memory storage for operational queries
      if (!memStore.stores.some((ms) => ms.id === storeId)) {
        memStore.stores.push({
          id: storeId,
          company_id: company.id,
          code: `${trimmedSlug.toUpperCase().substring(0, 4)}-${100 + i}`,
          name: storeName,
          location: storeLocation,
          store_type: 'Supercenter',
          total_skus: 0,
          created_at: new Date().toISOString(),
        });
      }

      createdStores.push({
        id: storeId,
        name: storeName,
        location: storeLocation,
      });

      // If a manager email is specified, create a single-use token invitation
      if (s.managerEmail && typeof s.managerEmail === 'string' && s.managerEmail.trim()) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashInvitationToken(rawToken);

        const invitation = createStandaloneInvitation({
          companyId: company.id,
          companyName: company.name,
          storeId,
          storeName,
          email: s.managerEmail.trim(),
          role: 'STORE_MANAGER',
          tokenHash,
          invitedBy: auth.user.id,
          expiresInDays: 7,
        });

        generatedInvitations.push({
          id: invitation.id,
          storeId,
          storeName,
          managerEmail: invitation.email,
          role: 'STORE_MANAGER',
          rawToken,
          inviteUrl: `/invite/accept?token=${rawToken}`,
          expiresAt: invitation.expiresAt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        maxStores: company.maxStores,
        status: company.status,
        createdAt: company.createdAt,
      },
      stores: createdStores,
      invitations: generatedInvitations,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Company onboarding failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

