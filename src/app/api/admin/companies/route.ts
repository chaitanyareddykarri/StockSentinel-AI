import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  getAllStandaloneCompanies,
  findCompanyStores,
} from '@/lib/auth/userStore';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Security Guarantee: Platform Admin privileges verified exclusively via server-side identity
    if (auth.user.accessState !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'Platform Administrator privileges required.' },
        { status: 403 }
      );
    }

    const companies = getAllStandaloneCompanies();

    const companiesWithMetrics = await Promise.all(
      companies.map(async (c) => {
        const stores = await findCompanyStores(c.id);
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          maxStores: c.maxStores,
          storeCount: stores.length,
          status: c.status,
          isDemo: c.isDemo,
          createdBy: c.createdBy,
          createdAt: c.createdAt,
        };
      })
    );

    return NextResponse.json({
      companies: companiesWithMetrics,
      totalCount: companiesWithMetrics.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve administrative company list.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

