import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";

// In-memory: lost on serverless cold start. For production: persist to Session.notes in DB.
const conversations = new Map<string, Array<{ role: string; content: string }>>();

export const dynamic = "force-dynamic";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";

// Conversation stage meta-instructions based on message count
function getStageInstruction(messageCount: number): string {
  if (messageCount <= 4) {
    return `\n\n[STAGE ENFORCEMENT — GUARDED stage. Exchange ${Math.ceil(messageCount / 2)}. Do NOT reveal any pain points yet. Deflect probing questions. Short, non-committal answers. Act like a real prospect who doesn't trust this caller yet. Polite but distant.]`;
  } else if (messageCount <= 8) {
    return `\n\n[STAGE ENFORCEMENT — WARMING stage. Exchange ${Math.ceil(messageCount / 2)}. You may acknowledge surface-level frustrations if the rep has shown industry understanding, but do NOT name specific problems. Use hedging language: "It's not perfect" / "There's always room for improvement." If the rep is still generic or pushy, stay guarded.]`;
  } else if (messageCount <= 14) {
    return `\n\n[STAGE ENFORCEMENT — DISCOVERY stage. Exchange ${Math.ceil(messageCount / 2)}. If the rep has asked specific, relevant questions, start opening up about real pain — but ONLY pain points they've specifically probed. Each pain point requires its own question. Don't volunteer unrelated problems. Show emotional weight when you admit pain. Still maintain objections — discovering pain doesn't mean you're ready to buy.]`;
  } else if (messageCount <= 20) {
    return `\n\n[STAGE ENFORCEMENT — CONSIDERATION stage. Exchange ${Math.ceil(messageCount / 2)}. If the rep has discovered multiple pain points AND handled your key objections credibly, you are genuinely evaluating. CRITICAL: If the rep makes a specific, confident ask for a meeting or demo — naming a concrete day, time, or suggesting a clear format — AND they have earned it through this conversation, you SHOULD agree with real commitment: confirm the day, time, next steps. Say something like "Yes, let's do Tuesday at 2pm — have your team send the calendar invite" or "Good, let's set that up for next week, Wednesday morning works." A convinced prospect books the meeting. Do NOT keep deflecting with vague objections if the case has been made. Real closure matters.]`;
  } else {
    return `\n\n[STAGE ENFORCEMENT — CLOSING stage. Exchange ${Math.ceil(messageCount / 2)}. This conversation must conclude in the next 1-2 exchanges. If the rep has earned it — built rapport, discovered pain, handled objections — COMMIT now. Accept the next-step ask with specific details and wrap the call naturally: "Good. Have your team send me the invite and I'll make sure the right people join." If the rep has NOT earned it — still vague, unprepared, or generic — give a polite but final close: you need to review, now isn't the right time, wish them well. Either way: end the conversation here.]`;
  }
}

// Detect when the persona commits to a meeting, demo, or concrete follow-up
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

async function callGroqLLM(history: Array<{ role: string; content: string }>): Promise<string> {
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
      max_tokens: 300,
      temperature: 0.85,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq LLM failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

async function callMistralLLM(history: Array<{ role: string; content: string }>): Promise<string> {
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
      max_tokens: 300,
      temperature: 0.85,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mistral LLM failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

async function callLLM(history: Array<{ role: string; content: string }>): Promise<{ text: string; provider: string }> {
  // Try Groq first (fast, good quality)
  if (GROQ_API_KEY) {
    try {
      const text = await callGroqLLM(history);
      if (text) return { text, provider: "groq" };
    } catch {
      // Groq failed, try Mistral
    }
  }

  // Fallback to Mistral
  if (MISTRAL_API_KEY) {
    try {
      const text = await callMistralLLM(history);
      if (text) return { text, provider: "mistral" };
    } catch {
      // Mistral also failed
    }
  }

  throw new Error("AI response generation failed - all providers unavailable");
}

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
    let history = conversations.get(convKey) || [];

    if (history.length === 0) {
      const nameCtx = userName ? `\n\nThe sales rep you are speaking with today is named ${userName}. Address them by name occasionally to make the conversation feel real.` : "";
      history.push({ role: "system", content: persona.systemPrompt.trim() + nameCtx });
      history.push({ role: "assistant", content: persona.openingLine });
    }

    history.push({ role: "user", content: message });

    const messageCount = history.filter(m => m.role === "user").length;
    const stageInstruction = getStageInstruction(messageCount);

    // Build enhanced history: system message at [0] gets stage appended; no mid-array system messages
    // (Groq/Mistral reject system messages at positions other than 0)
    const enhancedHistory = history.map((m, i) =>
      i === 0 && m.role === "system"
        ? { ...m, content: m.content + stageInstruction }
        : { ...m }
    );

    // Keep conversation history manageable (system prompt + up to 40 messages)
    const callHistory = enhancedHistory.length > 42
      ? [enhancedHistory[0], ...enhancedHistory.slice(-41)]
      : enhancedHistory;

    const { text: aiResponse, provider } = await callLLM(callHistory);

    history.push({ role: "assistant", content: aiResponse });
    conversations.set(convKey, history);

    let stage = "guarded";
    if (messageCount > 20) stage = "closing";
    else if (messageCount > 14) stage = "consideration";
    else if (messageCount > 8) stage = "discovery";
    else if (messageCount > 4) stage = "warming";

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
      provider,
      stage,
      booked: detectBooking(aiResponse),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to generate response", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (sessionId && conversations.has(sessionId)) {
      conversations.delete(sessionId);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
