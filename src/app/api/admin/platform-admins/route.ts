import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  getAllPlatformAdminUserIds,
  findUserById,
} from '@/lib/auth/userStore';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'Platform Administrator privileges required.' },
        { status: 403 }
      );
    }

    const adminIds = getAllPlatformAdminUserIds();
    const adminDetails = await Promise.all(
      adminIds.map(async (id) => {
        const u = await findUserById(id);
        return {
          id,
          name: u?.name || 'Platform Administrator',
          email: u?.email || 'admin@stocksentinel.internal',
          verifiedAt: u?.createdAt || new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({
      admins: adminDetails,
      totalCount: adminDetails.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve administrator list.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

