import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function callDeepgramASR(audioBuffer: Buffer): Promise<string> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) throw new Error("DEEPGRAM_API_KEY not set");

  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en",
    {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramApiKey}`,
        "Content-Type": "audio/webm",
      },
      body: audioBuffer,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("[asr] Deepgram API error:", response.status, errorText);
    throw new Error(`Deepgram STT failed: ${response.status}`);
  }

  const data = await response.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function callZaiASR(audioBase64: string): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const response = await zai.audio.asr.create({
    file_base64: audioBase64,
  });

  return response.text || "";
}

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json();

    if (!audio) {
      return NextResponse.json({ error: "Audio data is required" }, { status: 400 });
    }

    // Decode base64 audio for Deepgram
    const audioBuffer = Buffer.from(audio, "base64");

    // Try Deepgram first, fall back to z-ai-web-dev-sdk
    let transcript = "";
    let provider = "deepgram";

    try {
      transcript = await callDeepgramASR(audioBuffer);
    } catch (deepgramError) {
      console.warn("[asr] Deepgram unavailable, falling back to z-ai-web-dev-sdk:", deepgramError instanceof Error ? deepgramError.message : deepgramError);
      provider = "zai";
      try {
        transcript = await callZaiASR(audio);
      } catch (zaiError) {
        console.error("[asr] Both ASR providers failed:", zaiError);
        throw new Error("All ASR providers unavailable");
      }
    }

    return NextResponse.json({
      success: true,
      text: transcript,
      provider,
    });
  } catch (error) {
    console.error("[asr] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech recognition failed" },
      { status: 500 }
    );
  }
}
