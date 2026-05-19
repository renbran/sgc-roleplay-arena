import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";

const conversations = new Map<string, Array<{ role: string; content: string }>>();

export const dynamic = "force-dynamic";

// Retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelay = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[chat] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, err instanceof Error ? err.message : err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Conversation stage meta-instructions based on message count
function getStageInstruction(messageCount: number): string {
  if (messageCount <= 4) {
    return `\n\n[STAGE ENFORCEMENT — You are in the GUARDED stage of this conversation. This is exchange ${Math.ceil(messageCount / 2)} of the conversation. Rules: Do NOT reveal any pain points yet. Deflect probing questions. Give short, non-committal answers. Act like a real prospect who doesn't trust this caller yet. If they ask about problems, minimize and redirect. Your tone should be polite but distant.]`;
  } else if (messageCount <= 8) {
    return `\n\n[STAGE ENFORCEMENT — You are in the WARMING stage. This is exchange ${Math.ceil(messageCount / 2)}. Rules: You may acknowledge surface-level frustrations if the rep has shown industry understanding, but do NOT name specific problems. Use hedging language: "It's not perfect" / "There's always room for improvement." If the rep is still generic or pushy, stay guarded. Only start warming if they've demonstrated genuine understanding of your world.]`;
  } else if (messageCount <= 14) {
    return `\n\n[STAGE ENFORCEMENT — You are in the DISCOVERY stage. This is exchange ${Math.ceil(messageCount / 2)}. Rules: If the rep has asked specific, relevant questions, you may start opening up about real pain — but ONLY the pain points they've specifically probed. Each pain point requires its own question. Don't volunteer unrelated problems. Show the emotional weight when you admit pain. Still maintain your objections — discovering pain doesn't mean you're ready to buy.]`;
  } else {
    return `\n\n[STAGE ENFORCEMENT — You are in the CONSIDERATION stage. This is exchange ${Math.ceil(messageCount / 2)}. Rules: If the rep has successfully discovered multiple pain points AND offered relevant insight or credible references, you can be more open to discussing solutions and next steps. But you still have objections. You don't agree to anything on the first call. The best outcome is agreeing to a specific follow-up meeting. Never just say "yes, let's do it" — real prospects don't do that.]`;
  }
}

async function callZaiLLM(history: Array<{ role: string; content: string }>): Promise<string> {
  return withRetry(async () => {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: history as Array<{ role: string; content: string }>,
      thinking: { type: "disabled" },
    });

    return completion.choices?.[0]?.message?.content || "";
  }, 2, 1500);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, message, personaId } = body;

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
      history.push({ role: "system", content: persona.systemPrompt.trim() });
      history.push({ role: "assistant", content: persona.openingLine });
    }

    history.push({ role: "user", content: message });

    // Inject stage-aware instruction as a system reminder
    const messageCount = history.filter(m => m.role === "user").length;
    const stageInstruction = getStageInstruction(messageCount);

    // Add stage enforcement as a system message before the user message
    const enhancedHistory = [...history];
    const lastUserIdx = enhancedHistory.map((m, i) => m.role === "user" ? i : -1).filter(i => i !== -1).pop();
    if (lastUserIdx !== undefined) {
      enhancedHistory.splice(lastUserIdx, 0, {
        role: "system",
        content: stageInstruction,
      });
    }

    // Keep conversation history manageable (system prompt + up to 40 messages)
    if (enhancedHistory.length > 42) {
      const systemPrompt = enhancedHistory[0];
      const recent = enhancedHistory.slice(-41);
      enhancedHistory.length = 0;
      enhancedHistory.push(systemPrompt);
      enhancedHistory.push(...recent);
    }

    // Use z-ai-web-dev-sdk with retry for cold start
    let aiResponse = "";

    try {
      aiResponse = await callZaiLLM(enhancedHistory);
    } catch (zaiError) {
      console.error("[chat] LLM failed after retries:", zaiError instanceof Error ? zaiError.message : zaiError);
      throw new Error("AI response generation failed - service unavailable");
    }

    history.push({ role: "assistant", content: aiResponse });
    conversations.set(convKey, history);

    // Determine conversation stage for frontend display
    let stage = "guarded";
    if (messageCount > 6) stage = "consideration";
    else if (messageCount > 4) stage = "discovery";
    else if (messageCount > 2) stage = "warming";

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
      provider: "zai",
      stage,
    });
  } catch (error: unknown) {
    console.error("[chat] Error:", error);
    return NextResponse.json({ error: "Failed to generate response", detail: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
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
