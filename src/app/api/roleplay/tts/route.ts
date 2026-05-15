import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deepgram voice model mapping - using Aura-2 voices
const DEEPGRAM_VOICE_MAP: Record<string, string> = {
  // Female voices
  "kazi": "aura-2-cora-en",
  "female-warm": "aura-2-cora-en",
  "female-precise": "aura-2-amalthea-en",
  "female-calm": "aura-2-luna-en",
  // Male voices
  "jam": "aura-2-orion-en",
  "male-deep": "aura-2-apollo-en",
  "male-authoritative": "aura-2-arcas-en",
  "male-friendly": "aura-2-helios-en",
  "male-direct": "aura-2-atlas-en",
};

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "aura-2-cora-en" } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const truncatedText = text.slice(0, 2000);

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 });
    }

    // Resolve voice name - if it's a short name, map it; otherwise use as-is
    const resolvedVoice = DEEPGRAM_VOICE_MAP[voice] || voice;

    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${resolvedVoice}&encoding=mp3`,
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${deepgramApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: truncatedText }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[tts] Deepgram API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Deepgram TTS failed: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(audioBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[tts] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TTS generation failed" },
      { status: 500 }
    );
  }
}
