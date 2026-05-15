import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";

const conversations = new Map<string, Array<{ role: string; content: string }>>();

export const dynamic = "force-dynamic";

// Conversation stage meta-instructions based on message count
// These reinforce the pain discovery gates at each stage
function getStageInstruction(messageCount: number): string {
  if (messageCount <= 4) {
    // STAGE 1: GUARDED — first 2-3 exchanges
    return `\n\n[STAGE ENFORCEMENT — You are in the GUARDED stage of this conversation. This is exchange ${Math.ceil(messageCount / 2)} of the conversation. Rules: Do NOT reveal any pain points yet. Deflect probing questions. Give short, non-committal answers. Act like a real prospect who doesn't trust this caller yet. If they ask about problems, minimize and redirect. Your tone should be polite but distant.]`;
  } else if (messageCount <= 8) {
    // STAGE 2: WARMING — exchanges 3-5
    return `\n\n[STAGE ENFORCEMENT — You are in the WARMING stage. This is exchange ${Math.ceil(messageCount / 2)}. Rules: You may acknowledge surface-level frustrations if the rep has shown industry understanding, but do NOT name specific problems. Use hedging language: "It's not perfect" / "There's always room for improvement." If the rep is still generic or pushy, stay guarded. Only start warming if they've demonstrated genuine understanding of your world.]`;
  } else if (messageCount <= 14) {
    // STAGE 3: DISCOVERY — exchanges 5-8
    return `\n\n[STAGE ENFORCEMENT — You are in the DISCOVERY stage. This is exchange ${Math.ceil(messageCount / 2)}. Rules: If the rep has asked specific, relevant questions, you may start opening up about real pain — but ONLY the pain points they've specifically probed. Each pain point requires its own question. Don't volunteer unrelated problems. Show the emotional weight when you admit pain. Still maintain your objections — discovering pain doesn't mean you're ready to buy.]`;
  } else {
    // STAGE 4: CONSIDERATION — exchanges 8+
    return `\n\n[STAGE ENFORCEMENT — You are in the CONSIDERATION stage. This is exchange ${Math.ceil(messageCount / 2)}. Rules: If the rep has successfully discovered multiple pain points AND offered relevant insight or credible references, you can be more open to discussing solutions and next steps. But you still have objections. You don't agree to anything on the first call. The best outcome is agreeing to a specific follow-up meeting. Never just say "yes, let's do it" — real prospects don't do that.]`;
  }
}

async function callGroqLLM(history: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: history,
      temperature: 0.75,
      max_tokens: 400,
    }),
  });

  if (!groqResponse.ok) {
    const errorData = await groqResponse.json().catch(() => ({}));
    console.error("[chat] Groq API error:", groqResponse.status, errorData);
    throw new Error(`Groq API error: ${groqResponse.status}`);
  }

  const data = await groqResponse.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callZaiLLM(history: Array<{ role: string; content: string }>): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages: history as Array<{ role: string; content: string }>,
    thinking: { type: "disabled" },
  });

  return completion.choices?.[0]?.message?.content || "";
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
    // This reinforces the conversation flow rules based on how far we are
    const messageCount = history.filter(m => m.role === "user").length;
    const stageInstruction = getStageInstruction(messageCount);

    // Add stage enforcement as a system message before the user message
    // We insert it right before the last user message to influence the response
    const enhancedHistory = [...history];
    // Find the last user message index and insert stage instruction before it
    const lastUserIdx = enhancedHistory.map((m, i) => m.role === "user" ? i : -1).filter(i => i !== -1).pop();
    if (lastUserIdx !== undefined) {
      enhancedHistory.splice(lastUserIdx, 0, {
        role: "system",
        content: stageInstruction,
      });
    }

    // Keep conversation history manageable (system prompt + up to 40 messages)
    if (enhancedHistory.length > 42) {
      // Always keep the first system prompt, then the most recent messages
      const systemPrompt = enhancedHistory[0];
      const recent = enhancedHistory.slice(-41);
      enhancedHistory.length = 0;
      enhancedHistory.push(systemPrompt);
      enhancedHistory.push(...recent);
    }

    // Try Groq first, fall back to z-ai-web-dev-sdk
    let aiResponse = "";
    let provider = "groq";

    try {
      aiResponse = await callGroqLLM(enhancedHistory);
    } catch (groqError) {
      console.warn("[chat] Groq unavailable, falling back to z-ai-web-dev-sdk:", groqError instanceof Error ? groqError.message : groqError);
      provider = "zai";
      try {
        aiResponse = await callZaiLLM(enhancedHistory);
      } catch (zaiError) {
        console.error("[chat] Both LLM providers failed:", zaiError);
        throw new Error("All LLM providers unavailable");
      }
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
      provider,
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
