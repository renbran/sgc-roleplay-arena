import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

// Shared bearer-token gate for internal/ops routes (admin dashboard, memory
// inspection). Fails closed: if ADMIN_PASSWORD isn't configured, every request
// is rejected rather than left open.

function safeEqual(a: string, b: string): boolean {
  // HMAC both sides to a fixed-length digest first so timingSafeEqual never
  // throws on a length mismatch (which would itself leak length information).
  const digestA = createHmac("sha256", "admin-auth-compare").update(a).digest();
  const digestB = createHmac("sha256", "admin-auth-compare").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function requireAdminAuth(request: Request): NextResponse | null {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authHeader = request.headers.get("Authorization") ?? "";
  const expected = adminPassword ? `Bearer ${adminPassword}` : null;

  if (!expected || !safeEqual(authHeader, expected)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
