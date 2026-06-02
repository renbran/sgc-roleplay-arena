import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
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

async function callDeepgramASR(audioBase64: string, mimeType = "audio/webm"): Promise<string> {
  if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY not configured");

  return withRetry(async () => {
    const audioBuffer = Buffer.from(audioBase64, "base64");

    const response = await withTimeout(
      fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en", {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": mimeType,
        },
        body: audioBuffer,
      }),
      REQUEST_TIMEOUT_MS,
      "Deepgram ASR request"
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Deepgram ASR failed (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error("Deepgram returned empty transcript");
    }
    
    return transcript;
  });
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
    let provider = "";

    // Try Deepgram first (primary provider)
    if (DEEPGRAM_API_KEY) {
      try {
        transcript = await callDeepgramASR(audio, mimeType || "audio/webm");
        provider = "deepgram-nova-2";
        console.log("[asr] Deepgram success:", transcript.substring(0, 50));
      } catch (err) {
        console.error("[asr] Deepgram failed:", err instanceof Error ? err.message : err);
        // Fall through to Groq
      }
    }

    // Fallback to Groq if Deepgram failed or not configured
    if (!transcript && GROQ_API_KEY) {
      try {
        transcript = await callGroqASR(audio, mimeType || "audio/webm");
        provider = "groq-whisper";
        console.log("[asr] Groq fallback success:", transcript.substring(0, 50));
      } catch (err) {
        console.error("[asr] Groq fallback failed:", err instanceof Error ? err.message : err);
        throw new Error("Speech recognition failed - both services unavailable");
      }
    }

    if (!transcript) {
      throw new Error("No ASR provider configured or all providers failed");
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
