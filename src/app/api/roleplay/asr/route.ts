import { NextRequest, NextResponse } from "next/server";

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
        console.warn(`[asr] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, err instanceof Error ? err.message : err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function callZaiASR(audioBase64: string): Promise<string> {
  return withRetry(async () => {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.audio.asr.create({
      file_base64: audioBase64,
    });

    return response.text || "";
  }, 2, 1500);
}

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json();

    if (!audio) {
      return NextResponse.json({ error: "Audio data is required" }, { status: 400 });
    }

    // Use z-ai-web-dev-sdk with retry for cold start
    let transcript = "";

    try {
      transcript = await callZaiASR(audio);
    } catch (zaiError) {
      console.error("[asr] ASR failed after retries:", zaiError instanceof Error ? zaiError.message : zaiError);
      throw new Error("Speech recognition failed - service unavailable");
    }

    return NextResponse.json({
      success: true,
      text: transcript,
      provider: "zai",
    });
  } catch (error) {
    console.error("[asr] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech recognition failed" },
      { status: 500 }
    );
  }
}
