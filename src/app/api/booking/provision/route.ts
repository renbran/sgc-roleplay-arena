import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { buildSgcEmail } from "@/lib/booking-utils";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ODOO_URL = process.env.ODOO_URL || "";
const ODOO_DB = process.env.ODOO_DB || "";
const ODOO_ADMIN_USER = process.env.ODOO_ADMIN_USER || "admin";
const ODOO_ADMIN_PASSWORD = process.env.ODOO_ADMIN_PASSWORD || "";
const BOOKING_TOKEN_SECRET = process.env.BOOKING_TOKEN_SECRET || "dev-insecure-set-BOOKING_TOKEN_SECRET-in-env";

// ─── Booking token verification ───────────────────────────────────────────────
// Tokens are issued server-side by /api/roleplay/chat only when detectBooking()
// fires. This prevents unauthenticated account creation.

const usedTokens = new Set<string>();

function verifyBookingToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;

  const expectedSig = createHmac("sha256", BOOKING_TOKEN_SECRET).update(encoded).digest("hex");
  // Constant-time comparison to prevent timing attacks
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) return false;
  } catch {
    return false;
  }

  // Check 30-minute TTL
  try {
    const payload = Buffer.from(encoded, "base64url").toString();
    const timestamp = parseInt(payload.split(":").at(-1) ?? "0", 10);
    if (Date.now() - timestamp > 30 * 60 * 1000) return false;
  } catch {
    return false;
  }

  // Single-use: reject replays
  if (usedTokens.has(token)) return false;
  usedTokens.add(token);
  // Prune to avoid unbounded growth (serverless restarts clear this anyway)
  if (usedTokens.size > 500) {
    const iter = usedTokens.values();
    for (let i = 0; i < 100; i++) usedTokens.delete(iter.next().value as string);
  }

  return true;
}

// ─── Minimal XML-RPC over HTTP ────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function serializeValue(val: unknown): string {
  if (val === null || val === false) return "<value><boolean>0</boolean></value>";
  if (val === true) return "<value><boolean>1</boolean></value>";
  if (typeof val === "number" && Number.isInteger(val))
    return `<value><int>${val}</int></value>`;
  if (typeof val === "string")
    return `<value><string>${escapeXml(val)}</string></value>`;
  if (Array.isArray(val)) {
    const items = val.map(serializeValue).join("");
    return `<value><array><data>${items}</data></array></value>`;
  }
  if (typeof val === "object" && val !== null) {
    const members = Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `<member><name>${escapeXml(k)}</name>${serializeValue(v)}</member>`)
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${escapeXml(String(val))}</string></value>`;
}

function buildXmlRpcRequest(method: string, params: unknown[]): string {
  const paramXml = params.map((p) => `<param>${serializeValue(p)}</param>`).join("");
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${paramXml}</params></methodCall>`;
}

function parseXmlRpcResponse(xml: string): unknown {
  if (xml.includes("<fault>")) {
    const match = xml.match(/<name>faultString<\/name>\s*<value><string>([^<]*)<\/string>/);
    throw new Error(match ? match[1] : "Odoo XML-RPC fault");
  }
  const intMatch = xml.match(/<value>\s*<int>(\d+)<\/int>\s*<\/value>/);
  if (intMatch) return parseInt(intMatch[1], 10);
  const boolMatch = xml.match(/<value>\s*<boolean>(\d)<\/boolean>\s*<\/value>/);
  if (boolMatch) return boolMatch[1] === "1";
  const strMatch = xml.match(/<value>\s*<string>([^<]*)<\/string>\s*<\/value>/);
  if (strMatch) return strMatch[1];
  return null;
}

async function xmlRpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const body = buildXmlRpcRequest(method, params);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "User-Agent": "SGC-Roleplay/1.0" },
    body,
  });
  if (!res.ok) throw new Error(`XML-RPC HTTP error: ${res.status}`);
  const text = await res.text();
  return parseXmlRpcResponse(text);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const limited = rateLimit(request, "booking-provision", 5, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { fullName, email, mobile, personaId, sessionId, bookingToken } = body as {
      fullName?: string;
      email?: string;
      mobile?: string;
      personaId?: string;
      sessionId?: string;
      bookingToken?: string;
    };

    // Gate: require a valid server-issued booking token
    if (!verifyBookingToken(bookingToken ?? "")) {
      return NextResponse.json(
        { error: "Invalid or expired booking token. Please complete a roleplay session first." },
        { status: 403 }
      );
    }

    if (!fullName?.trim() || !email?.trim() || !mobile?.trim()) {
      return NextResponse.json(
        { error: "fullName, email, and mobile are required" },
        { status: 400 }
      );
    }

    const sgcEmail = buildSgcEmail(fullName.trim());

    console.log(`[booking] Provisioning: ${sgcEmail} (persona=${personaId}, session=${sessionId})`);

    // ── Odoo user creation via XML-RPC ────────────────────────────────────────
    // Credentials delivery: Odoo's own action_reset_password sends the
    // standard "Set Password" invite email through Odoo's already-configured
    // outgoing mail infrastructure (verified working — mail.sgctech.ai plus
    // several fallback SMTP providers). No separate email provider needed
    // here, and no plaintext temp password to generate or lose track of —
    // Odoo issues its own signup token.
    if (ODOO_URL && ODOO_DB && ODOO_ADMIN_PASSWORD) {
      try {
        const uid = await xmlRpcCall(`${ODOO_URL}/xmlrpc/2/common`, "authenticate", [
          ODOO_DB, ODOO_ADMIN_USER, ODOO_ADMIN_PASSWORD, {},
        ]) as number;

        if (!uid) {
          console.error("[booking] Odoo authentication rejected — check admin credentials");
          return NextResponse.json({ error: "Provisioning failed. Please contact support." }, { status: 500 });
        }

        const newUserId = await xmlRpcCall(`${ODOO_URL}/xmlrpc/2/object`, "execute_kw", [
          ODOO_DB, uid, ODOO_ADMIN_PASSWORD,
          "res.users", "create",
          [{ name: fullName.trim(), login: sgcEmail, email: email.trim(), mobile: mobile.trim() }],
          {},
        ]) as number;

        try {
          await xmlRpcCall(`${ODOO_URL}/xmlrpc/2/object`, "execute_kw", [
            ODOO_DB, uid, ODOO_ADMIN_PASSWORD,
            "res.users", "action_reset_password",
            [[newUserId]],
            {},
          ]);
          console.log(`[booking] Odoo user created + invite sent: ${sgcEmail} (id=${newUserId})`);
        } catch (inviteErr) {
          // Non-fatal: the account exists either way; log for manual follow-up
          // (e.g. an admin can trigger "Reset Password" from the Odoo Users list).
          console.warn(`[booking] Odoo user created but invite email failed for ${sgcEmail}:`, inviteErr);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isDuplicate =
          msg.toLowerCase().includes("unique") ||
          msg.toLowerCase().includes("duplicate") ||
          msg.toLowerCase().includes("already exists");
        if (isDuplicate) {
          return NextResponse.json(
            { error: "A user with this email already exists in the system." },
            { status: 409 }
          );
        }
        // Log detail server-side only — never leak Odoo internals to the client
        console.error("[booking] Odoo error:", msg);
        return NextResponse.json({ error: "Provisioning failed. Please contact support." }, { status: 500 });
      }
    } else {
      console.warn("[booking] Odoo skipped — ODOO_URL, ODOO_DB, or ODOO_ADMIN_PASSWORD not set");
    }

    return NextResponse.json({ success: true, sgcEmail });
  } catch (error: unknown) {
    console.error("[booking] Unexpected error:", error);
    return NextResponse.json({ error: "Provisioning failed. Please contact support." }, { status: 500 });
  }
}
