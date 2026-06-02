import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";

export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";

const REQUEST_TIMEOUT_MS = 20_000;
const MSG_CHAR_LIMIT = 800;
const MAX_EXCHANGES = 40;

interface ScoreBreakdown {
  rapport: number;
  discovery: number;
  objectionHandling: number;
  closing: number;
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  strengths: string[];
  improvements: string[];
  outcome: "booked" | "partial" | "lost";
}

interface ScoreProviderResult {
  text: string;
  provider: "anthropic" | "groq" | "mistral";
}

function clampScore(val: unknown): number {
  if (typeof val !== "number" || Number.isNaN(val)) return 0;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function gradeFromOverall(overall: number): ScoreBreakdown["grade"] {
  if (overall >= 90) return "A";
  if (overall >= 75) return "B";
  if (overall >= 60) return "C";
  if (overall >= 45) return "D";
  return "F";
}

function normalizeOutcome(outcome: unknown): ScoreBreakdown["outcome"] {
  if (outcome === "booked" || outcome === "lost") return outcome;
  return "partial";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function callAnthropic(system: string, user: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const res = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 700,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    }),
    REQUEST_TIMEOUT_MS,
    "Anthropic score request"
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data.content?.[0]?.text ?? null;
}

async function callGroq(combined: string): Promise<string | null> {
  if (!GROQ_API_KEY) return null;

  const res = await withTimeout(
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: combined }],
        max_tokens: 700,
        temperature: 0,
      }),
    }),
    REQUEST_TIMEOUT_MS,
    "Groq score request"
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callMistral(combined: string): Promise<string | null> {
  if (!MISTRAL_API_KEY) return null;

  const res = await withTimeout(
    fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: combined }],
        max_tokens: 700,
        temperature: 0,
      }),
    }),
    REQUEST_TIMEOUT_MS,
    "Mistral score request"
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callLLMForScore(system: string, user: string): Promise<ScoreProviderResult> {
  try {
    const anthropic = await callAnthropic(system, user);
    if (anthropic) return { text: anthropic, provider: "anthropic" };
  } catch (err) {
    console.warn("[score] Anthropic error:", err instanceof Error ? err.message : err);
  }

  const combined = `${system}\n\n${user}`;

  try {
    const groq = await callGroq(combined);
    if (groq) return { text: groq, provider: "groq" };
  } catch (err) {
    console.warn("[score] Groq error:", err instanceof Error ? err.message : err);
  }

  try {
    const mistral = await callMistral(combined);
    if (mistral) return { text: mistral, provider: "mistral" };
  } catch (err) {
    console.warn("[score] Mistral error:", err instanceof Error ? err.message : err);
  }

  throw new Error("No LLM provider available for scoring");
}

function parseScore(raw: string): ScoreBreakdown {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const rapport = clampScore(parsed.rapport);
      const discovery = clampScore(parsed.discovery);
      const objectionHandling = clampScore(parsed.objectionHandling);
      const closing = clampScore(parsed.closing);
      const overall = Math.round((rapport + discovery + objectionHandling + closing) / 4);

      return {
        rapport,
        discovery,
        objectionHandling,
        closing,
        overall,
        grade: gradeFromOverall(overall),
        summary: typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "Conversation evaluated.",
        strengths: Array.isArray(parsed.strengths)
          ? parsed.strengths.filter((s: unknown) => typeof s === "string").slice(0, 3)
          : [],
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements.filter((s: unknown) => typeof s === "string").slice(0, 3)
          : [],
        outcome: normalizeOutcome(parsed.outcome),
      };
    }
  } catch {
    // Fall through to defaults when provider output is malformed.
  }

  return {
    rapport: 50,
    discovery: 50,
    objectionHandling: 50,
    closing: 50,
    overall: 50,
    grade: "C",
    summary: "Score could not be fully parsed.",
    strengths: [],
    improvements: [],
    outcome: "partial",
  };
}

function stageGuidance(repTurns: number): string {
  if (repTurns <= 2) {
    return "Very short call: reward concise wins, but penalize missing discovery evidence and weak close evidence.";
  }
  if (repTurns <= 6) {
    return "Early call: score strictly on observed evidence, avoid generous assumptions for objection handling and closing.";
  }
  if (repTurns <= 12) {
    return "Mid call: expect clear discovery progression and at least one concrete advancement attempt.";
  }
  return "Full call: evaluate all dimensions fully with strict evidence-based scoring.";
}

export async function POST(request: Request) {
  try {
    const { messages, personaId, userName } = await request.json();

    if (!messages || !personaId) {
      return NextResponse.json({ error: "messages and personaId required" }, { status: 400 });
    }

    const persona = getPersona(personaId);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    type Msg = { role: string; content: string };
    const nonSystem: Msg[] = messages.filter((m: Msg) => m.role !== "system");
    const repTurns = nonSystem.filter((m: Msg) => m.role === "user").length;

    const trimmed = nonSystem.slice(-MAX_EXCHANGES * 2);
    const transcript = trimmed
      .map((m: Msg) => {
        const label = m.role === "user" ? "REP" : "PROSPECT";
        const text = m.content.length > MSG_CHAR_LIMIT
          ? `${m.content.slice(0, MSG_CHAR_LIMIT)}...`
          : m.content;
        return `${label}: ${text}`;
      })
      .join("\n");

    const wins = persona.winConditions.join(" | ");
    const loses = persona.loseConditions.join(" | ");
    const repLabel = userName || "the rep";

    const system = `You are a strict sales coach scoring a roleplay call. Score only what is directly observed in transcript evidence and never infer hidden intent. Output valid JSON only.

Scoring rules:
- 70+ requires explicit strong evidence in that dimension.
- 50 is average or generic execution.
- <30 means the dimension was not reached or was handled poorly.
- ${stageGuidance(repTurns)}

Dimensions:
- rapport: trust building, personalization, tone quality.
- discovery: specific probing, pain discovery, follow-up quality.
- objectionHandling: concrete rebuttals with value evidence.
- closing: clear next-step ask and commitment progress.

Outcome:
- booked: prospect explicitly commits.
- partial: progress but no explicit commitment.
- lost: decline, hard rejection, or clear lose condition.

Win conditions: ${wins}
Lose conditions: ${loses}
Prospect: ${persona.name}, ${persona.title}, ${persona.company} (${persona.difficulty} difficulty)`;

    const user = `Rep: ${repLabel}
Rep turns: ${repTurns}
Transcript:
${transcript}

Return only this JSON shape:
{"rapport":0-100,"discovery":0-100,"objectionHandling":0-100,"closing":0-100,"outcome":"booked|partial|lost","summary":"2 concise sentences","strengths":["item 1","item 2"],"improvements":["item 1","item 2","item 3"]}`;

    const result = await callLLMForScore(system, user);
    const score = parseScore(result.text);

    return NextResponse.json({
      success: true,
      score,
      scoreMeta: {
        provider: result.provider,
        repTurns,
        transcriptExchanges: Math.floor(trimmed.length / 2),
        messageCharLimit: MSG_CHAR_LIMIT,
      },
    });
  } catch (error) {
    console.error("[score] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scoring failed" },
      { status: 500 }
    );
  }
}
