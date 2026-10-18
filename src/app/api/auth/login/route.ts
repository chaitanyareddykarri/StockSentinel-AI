import { NextResponse } from 'next/server';
import {
  verifyCredentials,
  findUserByEmail,
  createUser,
  updatePassword,
  createSession,
} from '@/lib/auth/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    let user = await verifyCredentials(email, password);

    // If credentials did not match directly, inspect existing record
    if (!user) {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        if (!existingUser.passwordHash) {
          // Account was previously created via OAuth: attach this password so user can sign in both ways!
          await updatePassword(email, password);
          user = await findUserByEmail(email);
        } else {
          return NextResponse.json(
            { error: 'Incorrect password for this account. Please check your credentials or reset your password.' },
            { status: 401 }
          );
        }
      } else {
        // Automatically create new user account with their personal email
        const displayName = email.split('@')[0].replace(/[._]/g, ' ');
        user = await createUser({
          email,
          password,
          name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          storeName: 'Retail Operations',
          role: 'STORE_MANAGER',
          provider: 'email',
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Failed to authenticate user.' }, { status: 500 });
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
