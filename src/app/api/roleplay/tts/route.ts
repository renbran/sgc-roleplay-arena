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

// Map persona Deepgram voice IDs to z-ai-web-dev-sdk voices
// z-ai available voices: tongtong, chuichui, xiaochen, jam, kazi, douji, luodo
const ZAI_VOICE_MAP: Record<string, string> = {
  "aura-2-cora-en": "kazi",         // Female - warm, professional → kazi (清晰标准)
  "aura-2-amalthea-en": "tongtong",  // Female - clear, composed → tongtong (温暖亲切)
  "aura-2-orion-en": "jam",          // Male - deep, authoritative → jam (英音绅士)
  "aura-2-apollo-en": "jam",         // Male - confident → jam
  "aura-2-arcas-en": "xiaochen",     // Male - measured → xiaochen (沉稳专业)
  "aura-2-luna-en": "tongtong",      // Female - calm → tongtong
  "aura-2-helios-en": "douji",       // Male - friendly → douji (自然流畅)
  "aura-2-atlas-en": "xiaochen",     // Male - direct → xiaochen
};

// Split text into chunks of max 1024 characters for z-ai TTS
function splitTextIntoChunks(text: string, maxLength = 1000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

async function callDeepgramTTS(text: string, voice: string): Promise<Buffer> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) throw new Error("DEEPGRAM_API_KEY not set");

  const resolvedVoice = DEEPGRAM_VOICE_MAP[voice] || voice;

  const response = await fetch(
    `https://api.deepgram.com/v1/speak?model=${resolvedVoice}&encoding=mp3`,
    {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("[tts] Deepgram API error:", response.status, errorText);
    throw new Error(`Deepgram TTS failed: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(audioBuffer));
}

async function callZaiTTS(text: string, voice: string): Promise<Buffer> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  // Map Deepgram voice to z-ai voice
  const zaiVoice = ZAI_VOICE_MAP[voice] || "kazi";

  // Split text if it exceeds 1024 characters
  const chunks = splitTextIntoChunks(text, 1000);

  if (chunks.length === 1) {
    const response = await zai.audio.tts.create({
      input: text,
      voice: zaiVoice,
      speed: 1.0,
      response_format: "wav",
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(new Uint8Array(arrayBuffer));
  }

  // For multi-chunk text, generate each chunk and concatenate
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const response = await zai.audio.tts.create({
      input: chunk,
      voice: zaiVoice,
      speed: 1.0,
      response_format: "wav",
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(new Uint8Array(arrayBuffer)));
  }

  return Buffer.concat(buffers);
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "aura-2-cora-en" } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const truncatedText = text.slice(0, 2000);

    // Try Deepgram first, fall back to z-ai-web-dev-sdk
    let audioBuffer: Buffer;
    let provider = "deepgram";

    try {
      audioBuffer = await callDeepgramTTS(truncatedText, voice);
    } catch (deepgramError) {
      console.warn("[tts] Deepgram unavailable, falling back to z-ai-web-dev-sdk:", deepgramError instanceof Error ? deepgramError.message : deepgramError);
      provider = "zai";
      try {
        audioBuffer = await callZaiTTS(truncatedText, voice);
      } catch (zaiError) {
        console.error("[tts] Both TTS providers failed:", zaiError);
        throw new Error("All TTS providers unavailable");
      }
    }

    const contentType = provider === "deepgram" ? "audio/mpeg" : "audio/wav";

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-cache",
        "X-TTS-Provider": provider,
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
