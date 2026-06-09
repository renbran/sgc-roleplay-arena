import { NextResponse } from "next/server";
import { csrfProtect } from "@/middleware/csrf";
import {
  getAllMemories,
  deleteUserMemories,
  storeMemories,
} from "@/lib/memory";

export const dynamic = "force-dynamic";

// ── GET ──────────────────────────────────────────────────────────────────────

/**
 * Retrieve stored memories for a user, optionally filtered by persona.
 *
 * Query params:
 *   userId    (required) – the rep identifier
 *   personaId (optional) – filter to a specific persona
 *
 * Example:
 *   GET /api/memory?userId=john&personaId=p1_faisal
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const personaId = searchParams.get("personaId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 },
      );
    }

    // Pagination parameters (high confidence – simple numeric parsing)
  const page = parseInt(searchParams.get('page') || '1', 10);
  const size = parseInt(searchParams.get('size') || '20', 10);
  const offset = (page - 1) * size;
  const allMemories = await getAllMemories(userId, personaId ?? undefined);
  const memories = allMemories.slice(offset, offset + size);


    return NextResponse.json({
      success: true,
      userId,
      personaId: personaId ?? null,
      page,
      size,
      totalCount: allMemories.length,
      count: memories.length,
      memories,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to retrieve memories",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

/**
 * Store a custom memory entry.
 *
 * Body (JSON):
 *   userId    (required)
 *   personaId (optional) – scope to a persona
 *   sessionId (optional)
 *   memory    (required) – the memory text
 *   category  (optional) – e.g. "rep_skill", "preference", "session_fact"
 */
export async function POST(request: Request) {
  const csrfResponse = csrfProtect(request);
  if (csrfResponse) return csrfResponse;
  try {
    const body = await request.json();
    const { userId, personaId, sessionId, memory, category } = body;

    if (!userId || !memory) {
      return NextResponse.json(
        { error: "userId and memory are required" },
        { status: 400 },
      );
    }

    await storeMemories(
      [{ memory, category: category ?? "session_fact" }],
      {
        userId,
        personaId: personaId ?? "general",
        sessionId: sessionId ?? "manual",
      },
    );

    return NextResponse.json({
      success: true,
      stored: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to store memory",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

/**
 * Delete all memories for a user.
 *
 * Query params:
 *   userId (required) – the rep identifier
 */
export async function DELETE(request: Request) {
  const csrfResponse = csrfProtect(request);
  if (csrfResponse) return csrfResponse;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 },
      );
    }

    await deleteUserMemories(userId);

    return NextResponse.json({
      success: true,
      deleted: true,
      userId,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to delete memories",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
