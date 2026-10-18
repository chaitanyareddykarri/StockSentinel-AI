import { NextResponse } from 'next/server';
import { createUser, createSession } from '@/lib/auth/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, storeName, role } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const user = await createUser({
      email,
      password,
      name,
      storeName,
      role: role || 'STORE_MANAGER',
      provider: 'email',
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

    // Set HTTP session cookie
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
    const message = err instanceof Error ? err.message : 'Registration failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
