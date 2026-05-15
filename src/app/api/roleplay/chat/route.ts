import { NextResponse } from "next/server";
import { getPersona } from "@/lib/personas";

// In-memory conversation store (per server instance)
const conversations = new Map<string, Array<{ role: string; content: string }>>();

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, message, personaId } = body;

    if (!message || !personaId) {
      return NextResponse.json(
        { error: "message and personaId are required" },
        { status: 400 }
      );
    }

    const persona = getPersona(personaId);
    if (!persona) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    // Get or create conversation
    const convKey = sessionId || personaId;
    let history = conversations.get(convKey) || [];

    // If new conversation, add system prompt
    if (history.length === 0) {
      history.push({
        role: "assistant",
        content: persona.systemPrompt.trim(),
      });
      // Add opening line as assistant message
      history.push({
        role: "assistant",
        content: persona.openingLine,
      });
    }

    // Add user message
    history.push({
      role: "user",
      content: message,
    });

    // Trim conversation if too long (keep system prompt + recent messages)
    if (history.length > 30) {
      history = [history[0], ...history.slice(-29)];
    }

    // Use z-ai-web-dev-sdk for LLM
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: history as Array<{ role: string; content: string }>,
      thinking: { type: "disabled" },
    });

    const aiResponse = completion.choices?.[0]?.message?.content || "";

    // Add AI response to history
    history.push({
      role: "assistant",
      content: aiResponse,
    });

    // Save updated history
    conversations.set(convKey, history);

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
    });
  } catch (error: unknown) {
    console.error("[chat] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate response",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
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
