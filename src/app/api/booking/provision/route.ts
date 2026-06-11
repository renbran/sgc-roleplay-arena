import { NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { buildSgcEmail } from "@/lib/booking-utils";

export const dynamic = "force-dynamic";

const ODOO_URL = process.env.ODOO_URL || "";
const ODOO_DB = process.env.ODOO_DB || "";
const ODOO_ADMIN_USER = process.env.ODOO_ADMIN_USER || "admin";
const ODOO_ADMIN_PASSWORD = process.env.ODOO_ADMIN_PASSWORD || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@sgctech.ai";
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

// ─── Credentials email HTML ───────────────────────────────────────────────────

function credentialsEmailHtml(fullName: string, sgcEmail: string, tempPassword: string): string {
  const loginUrl = ODOO_URL || "https://app.sgctech.ai";
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#1e40af;margin-bottom:8px;">Welcome to SGC Tech, ${escapeXml(fullName)}!</h1>
      <p style="color:#374151;">Your account has been successfully created. Here are your login credentials:</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #1e40af;">
        <p style="margin:4px 0;"><strong>Login Email:</strong> ${escapeXml(sgcEmail)}</p>
        <p style="margin:4px 0;"><strong>Temporary Password:</strong>
          <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeXml(tempPassword)}</code>
        </p>
        <p style="margin:4px 0;"><strong>Login URL:</strong>
          <a href="${loginUrl}" style="color:#1e40af;">${loginUrl}</a>
        </p>
      </div>
      <p style="color:#dc2626;font-weight:bold;">&#9888;&#65039; You will be required to change your password on first login.</p>
      <p style="color:#6b7280;font-size:14px;">Questions? Contact us at
        <a href="mailto:info@sgctech.ai">info@sgctech.ai</a>
      </p>
    </div>
  `;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
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
    // Cryptographically random temp password — never a static default
    const tempPassword = randomBytes(16).toString("base64url");

    console.log(`[booking] Provisioning: ${sgcEmail} (persona=${personaId}, session=${sessionId})`);

    // ── Odoo user creation via XML-RPC ────────────────────────────────────────
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

        await xmlRpcCall(`${ODOO_URL}/xmlrpc/2/object`, "execute_kw", [
          ODOO_DB, uid, ODOO_ADMIN_PASSWORD,
          "res.users", "write",
          [[newUserId], { password: tempPassword }],
          {},
        ]);

        console.log(`[booking] Odoo user created: ${sgcEmail} (id=${newUserId})`);
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

    // ── Send credentials email via Resend ─────────────────────────────────────
    if (RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
          from: EMAIL_FROM,
          to: email.trim(),
          subject: "Your SGC Tech Account is Ready",
          html: credentialsEmailHtml(fullName.trim(), sgcEmail, tempPassword),
        });
        console.log(`[booking] Credentials email sent to ${email}`);
      } catch (err) {
        // Non-fatal: Odoo user exists; log for manual follow-up
        console.warn("[booking] Resend email failed:", err);
      }
    } else {
      console.warn("[booking] Email skipped — RESEND_API_KEY not set");
    }

    return NextResponse.json({ success: true, sgcEmail });
  } catch (error: unknown) {
    console.error("[booking] Unexpected error:", error);
    return NextResponse.json({ error: "Provisioning failed. Please contact support." }, { status: 500 });
  }
}
