import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Global (not per-persona) chat-then-call unlock: one successful chat
// booking with ANY persona unlocks call mode for ALL personas; one
// successful call booking (only reachable after that unlock) is what
// actually triggers account provisioning.
const BOOKED_OUTCOMES = ["won", "booked"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const identity = searchParams.get("identity");
    if (!identity) {
      return NextResponse.json({ error: "identity required" }, { status: 400 });
    }

    const [chatBooking, callBooking] = await Promise.all([
      db.session.findFirst({
        where: {
          mode: "text",
          outcome: { in: BOOKED_OUTCOMES },
          OR: [{ userEmail: identity }, { userName: identity }],
        },
        select: { id: true },
      }),
      db.session.findFirst({
        where: {
          mode: "voice",
          outcome: { in: BOOKED_OUTCOMES },
          OR: [{ userEmail: identity }, { userName: identity }],
        },
        select: { id: true },
      }),
    ]);

    return NextResponse.json({
      hasChatBooking: !!chatBooking,
      hasCallBooking: !!callBooking,
    });
  } catch (error: unknown) {
    console.error("[sessions/progress] Error:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}
