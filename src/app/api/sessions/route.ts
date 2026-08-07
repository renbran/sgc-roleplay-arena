import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// A resumable session must still be "active" (never reached a terminal
// PATCH), have at least one checkpointed message, and not be so old that
// resuming it would be confusing rather than helpful.
const RESUMABLE_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const resumeFor = searchParams.get("resumeFor"); // email or username

    if (resumeFor) {
      const cutoff = new Date(Date.now() - RESUMABLE_MAX_AGE_MS);
      const session = await db.session.findFirst({
        where: {
          status: "active",
          messages: { not: null },
          updatedAt: { gte: cutoff },
          OR: [{ userEmail: resumeFor }, { userName: resumeFor }],
        },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ session });
    }

    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const stats = {
      total: sessions.length,
      active: sessions.filter(s => s.status === "active").length,
      completed: sessions.filter(s => s.status === "completed").length,
      failed: sessions.filter(s => s.status === "failed").length,
    };

    return NextResponse.json({ sessions, stats });
  } catch (error: unknown) {
    console.error("[sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, personaId, roomName, identity, userName, userEmail, mode } = body;

    if (!personaId || !roomName || !identity) {
      return NextResponse.json({ error: "personaId, roomName, and identity are required" }, { status: 400 });
    }

    const session = await db.session.create({
      data: {
        ...(id ? { id } : {}),
        personaId,
        roomName,
        identity,
        userName: userName || null,
        userEmail: userEmail || null,
        mode: mode || null,
        status: "active",
      },
    });

    return NextResponse.json({ id: session.id, session });
  } catch (error: unknown) {
    console.error("[sessions] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, status, duration, feedback, rating, outcome, notes, messages } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (duration !== undefined) updateData.duration = duration;
    if (feedback) updateData.feedback = feedback;
    if (rating !== undefined) updateData.rating = rating;
    if (outcome) updateData.outcome = outcome;
    if (notes) updateData.notes = notes;
    if (Array.isArray(messages)) updateData.messages = JSON.stringify(messages);

    const session = await db.session.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json(session);
  } catch (error: unknown) {
    console.error("[sessions] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
