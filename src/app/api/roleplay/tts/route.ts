import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// z-ai voice mapping - using available z-ai voices
const ZAI_VOICE_MAP: Record<string, string> = {
  "aura-2-cora-en": "kazi",         // Female - warm, professional
  "aura-2-amalthea-en": "tongtong",  // Female - clear, composed
  "aura-2-orion-en": "jam",          // Male - deep, authoritative
  "aura-2-apollo-en": "jam",         // Male - confident
  "aura-2-arcas-en": "xiaochen",     // Male - measured
  "aura-2-luna-en": "tongtong",      // Female - calm
  "aura-2-helios-en": "douji",       // Male - friendly
  "aura-2-atlas-en": "xiaochen",     // Male - direct
  // Direct z-ai voice names
  "kazi": "kazi",
  "tongtong": "tongtong",
  "jam": "jam",
  "xiaochen": "xiaochen",
  "douji": "douji",
};

// Split text into chunks of max 1000 characters for z-ai TTS
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
        console.warn(`[tts] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, err instanceof Error ? err.message : err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function callZaiTTS(text: string, voice: string): Promise<Buffer> {
  const zaiVoice = ZAI_VOICE_MAP[voice] || "kazi";

  return withRetry(async () => {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

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
  }, 2, 1500);
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "aura-2-cora-en" } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const truncatedText = text.slice(0, 2000);

    // Use z-ai-web-dev-sdk as primary TTS provider (with retry for cold start)
    let audioBuffer: Buffer;

    try {
      audioBuffer = await callZaiTTS(truncatedText, voice);
    } catch (zaiError) {
      console.error("[tts] z-ai TTS failed after retries:", zaiError instanceof Error ? zaiError.message : zaiError);
      throw new Error("TTS generation failed - service unavailable");
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.length.toString(),
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

// Warmup endpoint - GET request to pre-initialize the z-ai SDK
export async function GET() {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    await ZAI.create();
    return NextResponse.json({ warmup: true, provider: "zai" });
  } catch (err) {
    console.error("[tts] Warmup failed:", err);
    return NextResponse.json({ warmup: false, error: err instanceof Error ? err.message : "Unknown" });
  }
}
