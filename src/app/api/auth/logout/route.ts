import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/userStore';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/stocksentinel_session=([^;]+)/);
    if (match) {
      await destroySession(match[1]);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('stocksentinel_session');
    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('stocksentinel_session');
    return response;
  }
}
