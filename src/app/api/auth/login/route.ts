import { NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password. Please verify your credentials or register a new account.' },
        { status: 401 }
      );
    }

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
    const message = err instanceof Error ? err.message : 'Sign in failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
