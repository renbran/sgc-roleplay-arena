import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";

const conversations = new Map<string, Array<{ role: string; content: string }>>();

export const dynamic = "force-dynamic";

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
      temperature: 0.8,
      max_tokens: 500,
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

    if (history.length > 30) {
      history = [history[0], ...history.slice(-29)];
    }

    // Try Groq first, fall back to z-ai-web-dev-sdk
    let aiResponse = "";
    let provider = "groq";

    try {
      aiResponse = await callGroqLLM(history);
    } catch (groqError) {
      console.warn("[chat] Groq unavailable, falling back to z-ai-web-dev-sdk:", groqError instanceof Error ? groqError.message : groqError);
      provider = "zai";
      aiResponse = await callZaiLLM(history);
    }

    history.push({ role: "assistant", content: aiResponse });
    conversations.set(convKey, history);

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
      provider,
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
