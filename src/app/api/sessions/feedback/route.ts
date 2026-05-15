import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, rating, feedback, outcome } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await db.session.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        rating: rating || null,
        feedback: feedback || null,
        outcome: outcome || null,
      },
    });

    return NextResponse.json(session);
  } catch (error: unknown) {
    console.error("[feedback] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
