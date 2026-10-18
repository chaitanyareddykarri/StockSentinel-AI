import { NextResponse } from 'next/server';
import { findUserByEmail, updatePassword } from '@/lib/auth/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      // Truthful message or friendly confirmation without leaking enumeration
      return NextResponse.json({
        success: true,
        message: 'If this email is registered, password instructions have been processed.',
      });
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
      }
      await updatePassword(email, newPassword);
      return NextResponse.json({ success: true, message: 'Password has been updated successfully.' });
    }

    return NextResponse.json({
      success: true,
      message: 'If this email is registered, password instructions have been processed.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Password reset failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
