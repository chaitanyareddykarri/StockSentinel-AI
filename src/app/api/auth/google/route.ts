import { NextResponse } from 'next/server';
import { createOrUpdateGoogleUser, createSession } from '@/lib/auth/userStore';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credential, email: directEmail, name: directName, picture: directPicture } = body;

    let email = directEmail;
    let name = directName;
    let avatarUrl = directPicture;
    let sub: string | undefined;

    if (credential) {
      const payload = decodeJwtPayload(credential);
      if (!payload || !payload.email) {
        return NextResponse.json({ error: 'Invalid Google credential token.' }, { status: 400 });
      }
      email = payload.email as string;
      name = (payload.name as string) || (payload.email as string).split('@')[0];
      avatarUrl = payload.picture as string | undefined;
      sub = payload.sub as string | undefined;
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid Google account email not found.' }, { status: 400 });
    }

    const user = await createOrUpdateGoogleUser({
      email,
      name: name || email.split('@')[0],
      avatarUrl,
      sub,
    });

    const token = await createSession(user);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      storeName: user.storeName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      token,
    });

    response.cookies.set({
      name: 'stocksentinel_session',
      value: token,
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google authentication failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
