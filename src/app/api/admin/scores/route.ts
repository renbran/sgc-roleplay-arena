import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ScoreRow {
  id: string;
  userName: string;
  personaId: string;
  personaName: string;
  difficulty: string;
  rapport: number;
  discovery: number;
  objectionHandling: number;
  closing: number;
  overall: number;
  grade: string;
  outcome: string;
  summary: string;
  strengths: string;
  improvements: string;
  duration: number;
  createdAt: Date;
}

interface ParsedScore extends Omit<ScoreRow, "strengths" | "improvements" | "createdAt"> {
  strengths: string[];
  improvements: string[];
  createdAt: string;
}

interface CandidateSummary {
  userName: string;
  scores: ParsedScore[];
  avgOverall: number;
  bestGrade: string;
  sessionCount: number;
  lastActive: string;
  personasTried: string[];
}

const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

function parseScore(row: ScoreRow): ParsedScore {
  let strengths: string[] = [];
  let improvements: string[] = [];

  try {
    const parsed = JSON.parse(row.strengths);
    if (Array.isArray(parsed)) strengths = parsed as string[];
    else strengths = [row.strengths];
  } catch {
    strengths = row.strengths ? [row.strengths] : [];
  }

  try {
    const parsed = JSON.parse(row.improvements);
    if (Array.isArray(parsed)) improvements = parsed as string[];
    else improvements = [row.improvements];
  } catch {
    improvements = row.improvements ? [row.improvements] : [];
  }

  return {
    id: row.id,
    userName: row.userName,
    personaId: row.personaId,
    personaName: row.personaName,
    difficulty: row.difficulty,
    rapport: row.rapport,
    discovery: row.discovery,
    objectionHandling: row.objectionHandling,
    closing: row.closing,
    overall: row.overall,
    grade: row.grade,
    outcome: row.outcome,
    summary: row.summary,
    strengths,
    improvements,
    duration: row.duration,
    createdAt: row.createdAt.toISOString(),
  };
}

function getBestGrade(scores: ParsedScore[]): string {
  if (scores.length === 0) return "F";
  return scores.reduce((best, s) => {
    return (GRADE_ORDER[s.grade] ?? 0) > (GRADE_ORDER[best] ?? 0) ? s.grade : best;
  }, "F");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db.score.findMany({
      orderBy: { createdAt: "desc" },
    });

    const parsed = rows.map(parseScore);

    // Group by userName
    const groupMap = new Map<string, ParsedScore[]>();
    for (const score of parsed) {
      const existing = groupMap.get(score.userName);
      if (existing) {
        existing.push(score);
      } else {
        groupMap.set(score.userName, [score]);
      }
    }

    const candidates: CandidateSummary[] = Array.from(groupMap.entries()).map(
      ([userName, scores]) => {
        const avgOverall =
          scores.length > 0
            ? Math.round(scores.reduce((sum, s) => sum + s.overall, 0) / scores.length)
            : 0;
        const bestGrade = getBestGrade(scores);
        const lastActive = scores.length > 0 ? scores[0].createdAt : "";
        const personasTried = Array.from(new Set(scores.map((s) => s.personaName)));

        return {
          userName,
          scores,
          avgOverall,
          bestGrade,
          sessionCount: scores.length,
          lastActive,
          personasTried,
        };
      }
    );

    // Top-level stats
    const totalCandidates = candidates.length;
    const totalSessions = parsed.length;
    const avgOverall =
      parsed.length > 0
        ? Math.round(parsed.reduce((sum, s) => sum + s.overall, 0) / parsed.length)
        : 0;
    const topPerformer =
      candidates.length > 0
        ? candidates.reduce((top, c) => (c.avgOverall > top.avgOverall ? c : top)).userName
        : "";

    return NextResponse.json({
      success: true,
      stats: { totalCandidates, totalSessions, avgOverall, topPerformer },
      candidates,
    });
  } catch (err) {
    console.error("Failed to fetch admin scores:", err);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}
