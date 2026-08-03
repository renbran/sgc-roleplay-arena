import { NextResponse } from "next/server";

// Lightweight in-memory, per-IP fixed-window limiter. Good enough to blunt
// scripted abuse against LLM-cost and account-creation endpoints on a
// single-instance deployment (self-hosted server, or a Vercel deployment that
// isn't scaled across many concurrent instances). It does NOT provide strict
// guarantees across multiple serverless instances or after a cold start — for
// that you'd need a shared store (Redis/Upstash). Treat this as a basic guard,
// not a hard security boundary.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweepStaleBuckets(maxAgeMs: number): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return; // sweep at most once a minute
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > maxAgeMs) buckets.delete(key);
  }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns a 429 NextResponse if the caller has exceeded `limit` requests to
 * `routeKey` within `windowMs`, otherwise null (caller may proceed).
 */
export function rateLimit(
  request: Request,
  routeKey: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  sweepStaleBuckets(windowMs * 4);

  const key = `${routeKey}:${getClientIp(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return null;
  }

  const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
