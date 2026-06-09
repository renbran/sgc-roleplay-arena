import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Simple CSRF protection for API routes.
 * Expects a header `x-csrf-token` that matches the secret stored in `process.env.CSRF_SECRET`.
 * In production, generate a random secret and expose it to the client via a cookie or meta tag.
 */
export function csrfProtect(request: Request): NextResponse | null {
  const secret = process.env.CSRF_SECRET;
  if (!secret) return null; // No protection if secret not set (development fallback)

  const token = request.headers.get('x-csrf-token');
  if (!token) {
    return NextResponse.json({ error: 'Missing CSRF token' }, { status: 403 });
  }
  // Timing‑safe compare
  const secretBuf = Buffer.from(secret);
  const tokenBuf = Buffer.from(token);
  const isEqual = crypto.timingSafeEqual(
    Buffer.concat([secretBuf, Buffer.alloc(Math.max(0, tokenBuf.length - secretBuf.length))]),
    Buffer.concat([tokenBuf, Buffer.alloc(Math.max(0, secretBuf.length - tokenBuf.length))])
  );
  return isEqual ? null : NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
}
