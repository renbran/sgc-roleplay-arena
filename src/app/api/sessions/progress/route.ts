import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Global (not per-persona) chat-then-call unlock: one successful chat
// booking with ANY persona unlocks call mode for ALL personas; one
// successful call booking (only reachable after that unlock) is what
// actually triggers account provisioning.
const BOOKED_OUTCOMES = ["won", "booked"];

// Sessions are the source of truth, but in earlier builds the chat route
// didn't always persist a Session row when a booking fired (only the
// scoring route did). To avoid leaving users with a chat booking but
// no voice access, fall back to Score rows: if the user has any Score
// row with a booked/won outcome, they count as having passed chat.
async function hasBookingWithFallback(opts: {
  identity: string;
  mode: "text" | "voice";
}): Promise<boolean> {
  const { identity, mode } = opts;

  const sessionHit = await db.session.findFirst({
    where: {
      mode,
      outcome: { in: BOOKED_OUTCOMES },
      OR: [{ userEmail: identity }, { userName: identity }],
    },
    select: { id: true },
  });
  if (sessionHit) return true;

  // Fallback: any completed Score with this name counts toward the gate.
  // This catches anyone whose earlier booking was persisted as a Score
  // only (no matching Session row) — without it they would be stuck
  // locked even though they already passed chat.
  const scoreHit = await db.score.findFirst({
    where: {
      userName: identity,
      outcome: { in: BOOKED_OUTCOMES },
    },
    select: { id: true },
  });
  return !!scoreHit;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const identity = searchParams.get("identity");
    if (!identity) {
      return NextResponse.json({ error: "identity required" }, { status: 400 });
    }

    const [hasChatBooking, hasCallBooking] = await Promise.all([
      hasBookingWithFallback({ identity, mode: "text" }),
      hasBookingWithFallback({ identity, mode: "voice" }),
    ]);

    return NextResponse.json({
      hasChatBooking,
      hasCallBooking,
    });
  } catch (error: unknown) {
    console.error("[sessions/progress] Error:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}