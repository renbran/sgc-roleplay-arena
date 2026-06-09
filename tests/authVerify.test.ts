// Set env before importing to ensure runtime reads it
process.env.NEXT_PUBLIC_APP_PASSWORD = 'secret123';
process.env.APP_PASSWORD = 'secret123';

import { POST } from '@/app/api/auth/verify/route';
import { NextResponse } from 'next/server';

// Mock NextRequest
function mockRequest(body: any): any {
  return {
    json: async () => body,
    headers: new Headers(),
  } as any;
}

test('rejects empty password', async () => {
  const res = await POST(mockRequest({ password: '' }) as any) as any;
  const json = await res.json();
  expect(res.status).toBe(400);
  expect(json.verified).toBe(false);
});

test('rejects invalid payload structure', async () => {
  const res = await POST(mockRequest({}) as any) as any;
  const json = await res.json();
  expect(res.status).toBe(400);
  expect(json.reason).toBe('Invalid payload');
});

test('passes when password matches env secret', async () => {
  const res = await POST(mockRequest({ password: 'secret123' }) as any) as any;
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.verified).toBe(true);
});
