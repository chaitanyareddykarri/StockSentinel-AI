import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ user: null });
    }

    const response = NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        accessState: auth.user.accessState,
        role: auth.user.role,
        companyId: auth.user.companyId,
        companyName: auth.user.companyName,
        companySlug: auth.user.companySlug,
        companyStatus: auth.user.companyStatus,
        assignedStoreId: auth.user.assignedStoreId,
        assignedStoreName: auth.user.assignedStoreName,
        storeName: auth.user.assignedStoreName || auth.user.storeName,
        accessibleStoreIds: auth.user.accessibleStoreIds,
        avatarUrl: auth.user.avatarUrl,
        authMode: auth.user.authMode,
        isDurable: auth.user.isDurable,
      },
    });

    // If verified via Bearer token, sync into stocksentinel_session cookie for subsequent browser requests
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const bearer = authHeader.substring(7).trim();
      if (bearer) {
        response.cookies.set({
          name: 'stocksentinel_session',
          value: bearer,
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
      }
    }

    return response;
  } catch {
    return NextResponse.json({ user: null });
  }
}
