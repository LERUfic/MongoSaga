import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((request: NextRequest & { auth?: any }) => {
  const authMode = process.env.AUTH_MODE || 'NONE';

  // If auth is completely disabled, let everything pass
  if (authMode === 'NONE') {
    return NextResponse.next();
  }

  const session = request.auth;

  // If the user isn't authenticated and they aren't already on the login page or an auth API route
  if (!session && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If the user IS authenticated but tries to visit the login page, redirect them to the dashboard
  if (session && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
});

export const config = {
  // Apply middleware to everything EXCEPT static files, Next internals, and the favicon
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
