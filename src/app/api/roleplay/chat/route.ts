import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";
import type { Persona } from "@/lib/personas";
import {
  buildMemoryContext,
  extractMemories,
  storeMemories,
} from "@/lib/memory";

// In-memory: lost on serverless cold start. For production: persist to Session.notes in DB.
const conversations = new Map<string, Array<{ role: string; content: string }>>();

// Parallel session state: tracks what has been admitted and earned within this session
interface SessionState {
  unlockedPains: string[];
  personaMood: "guarded" | "warming" | "open" | "engaged";
  qualityTurns: number;
  stageFloor: number; // minimum stage earned by rep quality (overrides count-only floor)
}

const sessionStates = new Map<string, SessionState>();

export const dynamic = "force-dynamic";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";

// ─── Stage parameters: vary temp and token budget by stage ───────────────────

function getStageParams(stage: string): { temperature: number; max_tokens: number } {
  switch (stage) {
    case "guarded":       return { temperature: 0.80, max_tokens: 130 };
    case "warming":       return { temperature: 0.85, max_tokens: 200 };
    case "discovery":     return { temperature: 0.88, max_tokens: 290 };
    case "consideration": return { temperature: 0.82, max_tokens: 340 };
    case "closing":       return { temperature: 0.72, max_tokens: 400 };
    default:              return { temperature: 0.85, max_tokens: 300 };
  }
}

function resolveStage(messageCount: number, stageFloor: number): string {
  let countStage = 1;
  if (messageCount > 20) countStage = 5;
  else if (messageCount > 14) countStage = 4;
  else if (messageCount > 8) countStage = 3;
  else if (messageCount > 4) countStage = 2;

  const effective = Math.max(countStage, stageFloor);
  const names = ["", "guarded", "warming", "discovery", "consideration", "closing"];
  return names[effective] || "guarded";
}

// ─── Stage instruction injected into system message each turn ─────────────────

function getStageInstruction(stage: string, exchange: number): string {
  switch (stage) {
    case "guarded":
      return `\n\n[STAGE ENFORCEMENT — GUARDED (exchange ${exchange}). Short, non-committal answers. Deflect pain probing. No warmth yet. Polite but distant. Max 2 sentences.]`;
    case "warming":
      return `\n\n[STAGE ENFORCEMENT — WARMING (exchange ${exchange}). You may acknowledge surface-level frustrations if the rep has shown genuine industry understanding. Hedging language only: "It's not perfect." Never name specific problems yet. If rep is still generic or pushy, stay guarded.]`;
    case "discovery":
      return `\n\n[STAGE ENFORCEMENT — DISCOVERY (exchange ${exchange}). Open up about real pain — ONLY pain the rep has specifically probed. Each pain requires its own question. Show emotional weight when admitting: "If I'm being honest..." / "Look, between us..." Still maintain objections — pain discovery does not mean readiness to buy.]`;
    case "consideration":
      return `\n\n[STAGE ENFORCEMENT — CONSIDERATION (exchange ${exchange}). Rep has discovered pain and handled objections. You are genuinely evaluating. CRITICAL: If rep makes a specific, confident ask for a meeting — naming a day, time, or concrete format — AND has earned it, COMMIT with real detail: "Yes, Tuesday at 2pm works — have your team send the calendar invite." A convinced prospect books. Do not keep deflecting if the case has genuinely been made.]`;
    case "closing":
      return `\n\n[STAGE ENFORCEMENT — CLOSING (exchange ${exchange}). Conclude in the next 1-2 exchanges. If rep earned it: commit with specific details and close naturally. If not: polite final close, end the call. Either way, this conversation ends here.]`;
    default:
      return "";
  }
}

// ─── Session state context: prevents pain re-locking mid-conversation ─────────

function buildStateContext(state: SessionState): string {
  const moodInstr: Record<SessionState["personaMood"], string> = {
    guarded:  "GUARDED — 1-2 sentence answers, active deflection, no warmth.",
    warming:  "WARMING — Cautiously opening. Slightly longer answers OK. Surface frustrations only.",
    open:     "OPEN — Genuine conversation. Longer answers. Admit specific pain when probed. Show real frustration.",
    engaged:  "ENGAGED — Rep has earned trust. Speak freely. Reference earlier parts of the call. Show genuine investment in solving this.",
  };

  let ctx = "\n\n[ACTIVE SESSION STATE — overrides static instructions where they conflict]\n";

  if (state.unlockedPains.length > 0) {
    ctx += "ALREADY ADMITTED this call (NEVER re-lock, deny, or contradict — these are established facts):\n";
    ctx += state.unlockedPains.map(p => `  • ${p}`).join("\n") + "\n";
  }

  ctx += `MOOD: ${moodInstr[state.personaMood]}\n`;
  ctx += "[END SESSION STATE]";
  return ctx;
}

// ─── Pain admission detection ─────────────────────────────────────────────────

const ADMISSION_PATTERNS = [
  /honestly[,\s]/i,
  /if i'?m being (?:honest|straight|frank)/i,
  /between (?:you and me|us)[,\s]/i,
  /look,?\s+(?:honestly|i'?ll|to be)/i,
  /it does (?:take|cost|happen|get|cause)/i,
  /we do (?:have|struggle|miss|lose|face)/i,
  /that has been (?:a|an|the)/i,
  /(?:it'?s|it is) (?:been )?(?:a problem|an issue|challenging|frustrating|difficult)/i,
  /(?:takes|costing|losing|missing|delayed|behind|wrong|broken|crashed|overdue)/i,
  /i (?:won'?t|will not) (?:lie|pretend)/i,
  /off the record/i,
  /my (?:team|boss|md|owner|accountant).{0,40}(?:asking|said|told|wants|pressure)/i,
];

function detectPainAdmission(response: string): string | null {
  const hasSignal = ADMISSION_PATTERNS.some(p => p.test(response));
  if (!hasSignal || response.length < 80) return null;

  const sentences = response.split(/(?<=[.!?])\s+/);
  const hit = sentences.find(s => ADMISSION_PATTERNS.some(p => p.test(s)));
  const candidate = hit || sentences[0];
  if (!candidate || candidate.length < 20) return null;

  return candidate.length > 120 ? candidate.slice(0, 117) + "..." : candidate.trim();
}

// ─── Rep quality assessment ───────────────────────────────────────────────────

function assessRepQuality(
  message: string,
  history: Array<{ role: string; content: string }>,
  _persona: Persona
): number {
  let score = 0;

  // Discovery question with substance
  if (/\?/.test(message) && /(how|what|when|who|tell me|describe|walk me|explain|why)/i.test(message)) {
    score += 2;
  }

  // Quantified reference
  if (/(\d+\s*(days?|weeks?|months?|hours?|years?)|AED|million|thousand|%)/i.test(message)) {
    score += 1;
  }

  // Active listening: rep reflects back words the persona used
  const lastAssistant = [...history].reverse().find(m => m.role === "assistant");
  if (lastAssistant) {
    const keyWords = lastAssistant.content
      .split(/\s+/)
      .filter(w => w.length > 6 && !/^(the|and|that|this|with|have|from|they|your|their|been|will|would|could|should)$/i.test(w));
    const reflected = keyWords.filter(w =>
      message.toLowerCase().includes(w.toLowerCase().replace(/[^a-z]/g, ""))
    ).length;
    if (reflected >= 2) score += 2;
  }

  // Industry/domain specificity
  if (/(RERA|Ejari|FTA|VAT|DLD|BOQ|variation order|subcontractor|progress billing|PMS|RevPAR|WPS|QuickBooks|Tally|Procore|ERP|corporate tax|EBITDA|food cost|property management|escrow|owner statement|RERA|inventory|stockout|procurement)/i.test(message)) {
    score += 1;
  }

  // Empathy or genuine acknowledgment
  if (/(I understand|that makes sense|that'?s (?:a real|challenging|significant|frustrating)|I can see why|sounds like|that must|I appreciate)/i.test(message)) {
    score += 1;
  }

  return score;
}

// ─── Mood progression from AI response ───────────────────────────────────────

function inferMoodProgression(
  response: string,
  current: SessionState["personaMood"],
  qualityTurns: number
): SessionState["personaMood"] {
  const len = response.length;
  const hasAdmission = ADMISSION_PATTERNS.some(p => p.test(response));
  const hasEngagement = /actually,|you know,|that'?s (?:a good|an interesting|fair|valid)|hmm,? (?:actually|you|that'?s)/i.test(response);
  const hasPersonaQuestion = response.split("?").length > 2;

  switch (current) {
    case "guarded":
      if ((hasAdmission || (len > 200 && hasEngagement)) && qualityTurns >= 2) return "warming";
      return "guarded";
    case "warming":
      if (hasAdmission && len > 160 && qualityTurns >= 3) return "open";
      if (hasPersonaQuestion && hasEngagement && qualityTurns >= 4) return "open";
      return "warming";
    case "open":
      if (hasAdmission && hasEngagement && len > 220 && qualityTurns >= 5) return "engaged";
      return "open";
    case "engaged":
      return "engaged";
  }
}

// ─── Booking detection ────────────────────────────────────────────────────────

function detectBooking(response: string): boolean {
  const patterns = [
    /let'?s (?:schedule|book|set up|pencil in|confirm|arrange)/i,
    /(?:monday|tuesday|wednesday|thursday|friday).{0,50}(?:morning|afternoon|at \d|works|good for me)/i,
    /(?:works for me|that works|sounds good).{0,50}(?:meet|meeting|demo|call|visit)/i,
    /calendar (?:invite|invitation)/i,
    /send (?:me |us )?(?:the |a )?(?:invite|invitation|calendar|details)/i,
    /looking forward to (?:meeting|our|the|seeing)/i,
    /(?:book|schedule|confirm|set up).{0,30}(?:meeting|demo|session|call|site visit|workshop)/i,
    /we(?:'re| are) on for/i,
    /see you (?:then|on|at|next)/i,
    /have your (?:team|assistant|pa|ea|people).{0,30}(?:send|schedule|arrange|reach out|contact)/i,
    /(?:yes|great|perfect|agreed|done|alright|okay).{0,60}(?:let'?s|meet|meeting|tuesday|wednesday|thursday|monday|friday|next week)/i,
    /(?:tuesday|wednesday|thursday|monday|friday|next week).{0,30}(?:at|2pm|3pm|10am|11am|9am|1pm|afternoon|morning)/i,
    /put (?:it|that|this).{0,20}(?:in (?:the|my)|diary|calendar)/i,
    /make a note/i,
  ];
  return patterns.some(p => p.test(response));
}

// ─── LLM providers ────────────────────────────────────────────────────────────

async function callGroqLLM(
  history: Array<{ role: string; content: string }>,
  params: { temperature: number; max_tokens: number }
): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: history,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq LLM failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

async function callMistralLLM(
  history: Array<{ role: string; content: string }>,
  params: { temperature: number; max_tokens: number }
): Promise<string> {
  if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY not configured");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages: history,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mistral LLM failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

async function callLLM(
  history: Array<{ role: string; content: string }>,
  params: { temperature: number; max_tokens: number }
): Promise<{ text: string; provider: string }> {
  if (GROQ_API_KEY) {
    try {
      const text = await callGroqLLM(history, params);
      if (text) return { text, provider: "groq" };
    } catch {
      // fall through to Mistral
    }
  }

  if (MISTRAL_API_KEY) {
    try {
      const text = await callMistralLLM(history, params);
      if (text) return { text, provider: "mistral" };
    } catch {
      // both failed
    }
  }

  throw new Error("AI response generation failed — all providers unavailable");
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, message, personaId, userName } = body;

    if (!message || !personaId) {
      return NextResponse.json({ error: "message and personaId are required" }, { status: 400 });
    }

    const persona = getPersona(personaId);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    const convKey = sessionId || personaId;

    // ── Conversation history ──────────────────────────────────────────────────
    let history = conversations.get(convKey) || [];
    if (history.length === 0) {
      const nameCtx = userName
        ? `\n\nThe sales rep you are speaking with today is named ${userName}. Use their name occasionally — it makes the conversation feel real.`
        : "";
      history.push({ role: "system", content: persona.systemPrompt.trim() + nameCtx });
      history.push({ role: "assistant", content: persona.openingLine });
    }

    // ── Session state ─────────────────────────────────────────────────────────
    let state: SessionState = sessionStates.get(convKey) ?? {
      unlockedPains: [],
      personaMood: "guarded",
      qualityTurns: 0,
      stageFloor: 1,
    };

    // ── Assess rep quality before appending their message ─────────────────────
    const repQuality = assessRepQuality(message, history, persona);
    if (repQuality >= 3) {
      const newQualityTurns = state.qualityTurns + 1;
      const newFloor = state.qualityTurns >= 2
        ? Math.min(5, state.stageFloor + 1)
        : state.stageFloor;
      state = { ...state, qualityTurns: newQualityTurns, stageFloor: newFloor };
    }

    history.push({ role: "user", content: message });

    // ── Resolve stage ─────────────────────────────────────────────────────────
    const messageCount = history.filter(m => m.role === "user").length;
    const stage = resolveStage(messageCount, state.stageFloor);
    const exchange = Math.ceil(messageCount / 2);
    const params = getStageParams(stage);

    // ── Build enhanced system message ─────────────────────────────────────────
    const stateContext = buildStateContext(state);
    const stageInstruction = getStageInstruction(stage, exchange);

    const enhancedHistory = history.map((m, i) =>
      i === 0 && m.role === "system"
        ? { ...m, content: m.content + stateContext + stageInstruction }
        : { ...m }
    );

    // ── Cross-session memory injection (mem0) ─────────────────────────────────
    if (userName) {
      try {
        const memoryCtx = await buildMemoryContext(userName, personaId, persona.name);
        if (memoryCtx) {
          enhancedHistory[0] = {
            ...enhancedHistory[0],
            content: enhancedHistory[0].content + memoryCtx,
          };
        }
      } catch (err) {
        console.warn("[mem0] Failed to inject memory context:", err);
      }
    }

    // Keep context window manageable: system message + last 41 messages
    const callHistory = enhancedHistory.length > 42
      ? [enhancedHistory[0], ...enhancedHistory.slice(-41)]
      : enhancedHistory;

    // ── LLM call ──────────────────────────────────────────────────────────────
    const { text: aiResponse, provider } = await callLLM(callHistory, params);

    history.push({ role: "assistant", content: aiResponse });
    conversations.set(convKey, history);

    // ── Update session state from AI response ─────────────────────────────────
    const admission = detectPainAdmission(aiResponse);
    const newUnlockedPains =
      admission && !state.unlockedPains.some(p => p.slice(0, 40) === admission.slice(0, 40))
        ? [...state.unlockedPains, admission]
        : state.unlockedPains;

    const newMood = inferMoodProgression(aiResponse, state.personaMood, state.qualityTurns);

    sessionStates.set(convKey, {
      ...state,
      unlockedPains: newUnlockedPains,
      personaMood: newMood,
    });

    // ── Store extracted memories (mem0) — fire-and-forget ─────────────────────
    if (userName) {
      const memoryEntries = extractMemories(message, aiResponse, personaId, persona.name);
      if (memoryEntries.length > 0) {
        storeMemories(memoryEntries, {
          userId: userName,
          personaId,
          sessionId: sessionId || personaId,
        }).catch((err) => console.warn("[mem0] async store failed:", err));
      }
    }

    // Count extracted memories for observability
    const storedMemoryCount = userName
      ? extractMemories(message, aiResponse, personaId, persona.name).length
      : 0;

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
      provider,
      stage,
      booked: detectBooking(aiResponse),
      memory: storedMemoryCount > 0 ? { stored: storedMemoryCount } : undefined,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to generate response",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ─── DELETE handler ───────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      conversations.delete(sessionId);
      sessionStates.delete(sessionId);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
