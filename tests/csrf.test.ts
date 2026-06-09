import { csrfProtect } from '@/middleware/csrf';

test('csrfProtect returns null when secret not set', () => {
  const req = new Request('http://localhost/api', { method: 'POST' });
  // No CSRF_SECRET env var
  const original = process.env.CSRF_SECRET;
  delete process.env.CSRF_SECRET;
  const res = csrfProtect(req as any);
  expect(res).toBeNull();
  if (original) process.env.CSRF_SECRET = original;
});

test('csrfProtect returns 403 when token missing', () => {
  process.env.CSRF_SECRET = 'mysecret';
  const req = new Request('http://localhost/api', { method: 'POST' });
  const res = csrfProtect(req as any) as any;
  expect(res.status).toBe(403);
  expect(res.body).toBeDefined();
});

test('csrfProtect passes with correct token', () => {
  process.env.CSRF_SECRET = 'mysecret';
  const headers = new Headers({ 'x-csrf-token': 'mysecret' });
  const req = new Request('http://localhost/api', { method: 'POST', headers });
  const res = csrfProtect(req as any);
  expect(res).toBeNull();
});
