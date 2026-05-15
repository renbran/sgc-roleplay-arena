import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, status, duration, feedback, rating, outcome, notes } = body;

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
