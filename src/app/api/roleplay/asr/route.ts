import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const REQUEST_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 800): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `[asr] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
          err instanceof Error ? err.message : err
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function callGroqASR(audioBase64: string, mimeType = "audio/webm"): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  return withRetry(async () => {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob([audioBuffer], { type: mimeType });

    const formData = new FormData();
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");
    formData.append("language", "en");

    const response = await withTimeout(
      fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      }),
      REQUEST_TIMEOUT_MS,
      "Groq ASR request"
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq ASR failed (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    return result.text || "";
  });
}

export async function POST(req: NextRequest) {
  try {
    const { audio, mimeType } = await req.json();

    if (!audio) {
      return NextResponse.json({ error: "Audio data is required" }, { status: 400 });
    }

    let transcript = "";

    try {
      transcript = await callGroqASR(audio, mimeType || "audio/webm");
    } catch (err) {
      console.error("[asr] Groq ASR failed:", err instanceof Error ? err.message : err);
      throw new Error("Speech recognition failed - service unavailable");
    }

    return NextResponse.json({
      success: true,
      text: transcript,
      provider: "groq-whisper",
    });
  } catch (error) {
    console.error("[asr] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech recognition failed" },
      { status: 500 }
    );
  }
}
