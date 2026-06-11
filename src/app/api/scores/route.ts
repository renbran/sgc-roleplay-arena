import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ScoreBody {
  userName: string;
  personaId: string;
  personaName: string;
  difficulty?: string;
  rapport: number;
  discovery: number;
  objectionHandling: number;
  closing: number;
  overall: number;
  grade: string;
  outcome: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  duration?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const timeframe = searchParams.get("timeframe") || "all";
    const personaId = searchParams.get("personaId") || "";

    let dateFilter: Date | undefined;
    const now = new Date();
    if (timeframe === "today") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === "week") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "month") {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const where: Record<string, unknown> = {};
    if (dateFilter) where.createdAt = { gte: dateFilter };
    if (personaId) where.personaId = personaId;

    const scores = await db.score.findMany({
      where,
      orderBy: { overall: "desc" },
      take: limit,
      select: {
        id: true,
        userName: true,
        personaId: true,
        personaName: true,
        overall: true,
        grade: true,
        outcome: true,
        duration: true,
        createdAt: true,
        rapport: true,
        discovery: true,
        objectionHandling: true,
        closing: true,
        difficulty: true,
      },
    });

    // Compute rank: same overall score = same rank
    let rank = 0;
    let prevOverall = -1;
    const ranked = scores.map((s, i) => {
      if (s.overall !== prevOverall) {
        rank = i + 1;
        prevOverall = s.overall;
      }
      return { ...s, rank };
    });

    return NextResponse.json({ success: true, scores: ranked, total: scores.length });
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const required = [
    "userName", "personaId", "personaName",
    "rapport", "discovery", "objectionHandling", "closing",
    "overall", "grade", "outcome", "summary", "strengths", "improvements",
  ];

  for (const field of required) {
    if (b[field] === undefined || b[field] === null) {
      return NextResponse.json(
        { success: false, error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const userName = String(b.userName).trim();
  const personaId = String(b.personaId).trim();
  const personaName = String(b.personaName).trim();
  const difficulty = b.difficulty ? String(b.difficulty) : "medium";
  const rapport = Number(b.rapport);
  const discovery = Number(b.discovery);
  const objectionHandling = Number(b.objectionHandling);
  const closing = Number(b.closing);
  const overall = Number(b.overall);
  const grade = String(b.grade);
  const outcome = String(b.outcome);
  const summary = String(b.summary);
  const duration = b.duration ? Number(b.duration) : 0;

  const strengthsRaw = b.strengths;
  const improvementsRaw = b.improvements;

  if (!userName || !personaId || !personaName) {
    return NextResponse.json(
      { success: false, error: "userName, personaId, and personaName must be non-empty" },
      { status: 400 }
    );
  }

  const strengths = Array.isArray(strengthsRaw)
    ? JSON.stringify(strengthsRaw)
    : String(strengthsRaw);

  const improvements = Array.isArray(improvementsRaw)
    ? JSON.stringify(improvementsRaw)
    : String(improvementsRaw);

  try {
    const score = await db.score.create({
      data: {
        userName,
        personaId,
        personaName,
        difficulty,
        rapport,
        discovery,
        objectionHandling,
        closing,
        overall,
        grade,
        outcome,
        summary,
        strengths,
        improvements,
        duration,
      },
    });

    return NextResponse.json({ success: true, id: score.id });
  } catch (err) {
    console.error("Failed to save score:", err);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}
