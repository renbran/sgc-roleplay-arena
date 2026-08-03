import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

function safeStringEqual(a: string, b: string): boolean {
  // HMAC both sides to a fixed-length digest so timingSafeEqual never throws on
  // length mismatch, and the comparison cost doesn't reveal valid prefix length.
  const digestA = createHmac("sha256", "auth-compare").update(a).digest();
  const digestB = createHmac("sha256", "auth-compare").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * POST /api/auth/verify
 *
 * Server-side password verification.
 * Checks against the database (AppConfig key="app_password") first,
 * falls back to the NEXT_PUBLIC_APP_PASSWORD env var if no DB record exists.
 *
 * Body: { password: string }
 * Returns: { verified: boolean, reason?: string }
 *
 * Note: No CSRF protection needed here — this endpoint only verifies a password
 * and returns a boolean. It does not modify state, and the password itself is
 * the authentication mechanism. CSRF protection is kept on state-changing
 * endpoints like /api/memory and /api/auth/reset-passkey.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "auth-verify", 5, 60_000);
  if (limited) return limited;

  try {
    const { password } = await req.json() as { password?: string };

  // Validate payload with Zod (high confidence – zod is already a dependency)
  const schema = z.object({ password: z.string().min(1) });
  const parsed = schema.safeParse({ password });
  if (!parsed.success) {
    return NextResponse.json(
      { verified: false, reason: "Invalid payload" },
      { status: 400 }
    );
  }

    if (!password || typeof password !== "string" || !password.trim()) {
      return NextResponse.json(
        { verified: false, reason: "Password is required" },
        { status: 400 }
      );
    }

    // 1. Check DB-stored passkey
    let dbPassword: string | null = null;
    try {
      const config = await db.appConfig.findUnique({ where: { key: "app_password" } });
      dbPassword = config?.value ?? null;
    } catch {
      // DB might not be reachable — fall through to env var
    }

    if (dbPassword) {
      const verified = safeStringEqual(password, dbPassword);
      return NextResponse.json({ verified });
    }

    // 2. Fallback to env var (Next.js bundles NEXT_PUBLIC_ vars — read at runtime on server)
    const envPassword = process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD;
    if (envPassword) {
      const verified = safeStringEqual(password, envPassword);
      return NextResponse.json({ verified });
    }

    // 3. No password configured anywhere
    return NextResponse.json(
      { verified: false, reason: "No password configured" },
      { status: 500 }
    );
  } catch (err) {
    console.error("Auth verify error:", err);
    return NextResponse.json(
      { verified: false, reason: "Internal server error" },
      { status: 500 }
    );
  }
}
