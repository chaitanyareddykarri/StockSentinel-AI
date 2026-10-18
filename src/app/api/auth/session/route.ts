import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/userStore';

export async function GET(request: Request) {
  try {
    // Check Authorization header or Cookie
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/stocksentinel_session=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        storeName: user.storeName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
