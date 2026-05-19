import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// z-ai voice mapping
const ZAI_VOICE_MAP: Record<string, string> = {
  "aura-2-cora-en": "kazi",
  "aura-2-amalthea-en": "tongtong",
  "aura-2-orion-en": "jam",
  "aura-2-apollo-en": "jam",
  "aura-2-arcas-en": "xiaochen",
  "aura-2-luna-en": "tongtong",
  "aura-2-helios-en": "douji",
  "aura-2-atlas-en": "xiaochen",
  "kazi": "kazi",
  "tongtong": "tongtong",
  "jam": "jam",
  "xiaochen": "xiaochen",
  "douji": "douji",
};

// Singleton ZAI instance for performance
let zaiInstance: any = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Split text into chunks of max 900 chars (safe margin under 1024 API limit)
function splitTextIntoChunks(text: string, maxLength = 900): string[] {
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

// Generate TTS audio as WAV for a single chunk
async function generateChunk(text: string, voice: string): Promise<Buffer> {
  const zai = await getZAI();
  const response = await zai.audio.tts.create({
    input: text,
    voice: voice,
    speed: 1.0,
    response_format: "wav",
    stream: false,
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Extract raw PCM data from a WAV buffer and return it with audio format info
function extractPCMFromWAV(wavBuf: Buffer): { pcm: Buffer; sampleRate: number; numChannels: number; bitsPerSample: number } {
  // Parse WAV header to find the 'data' chunk
  // Default values
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;

  // Read format from WAV header
  if (wavBuf.length > 44) {
    numChannels = wavBuf.readUInt16LE(22);
    sampleRate = wavBuf.readUInt32LE(24);
    bitsPerSample = wavBuf.readUInt16LE(34);
  }

  // Find the 'data' chunk (search for 'data' marker)
  for (let i = 12; i < Math.min(wavBuf.length, 200); i++) {
    if (wavBuf[i] === 0x64 && wavBuf[i + 1] === 0x61 && wavBuf[i + 2] === 0x74 && wavBuf[i + 3] === 0x61) {
      const chunkSize = wavBuf.readUInt32LE(i + 4);
      const dataStart = i + 8;
      return {
        pcm: wavBuf.subarray(dataStart, dataStart + chunkSize),
        sampleRate,
        numChannels,
        bitsPerSample,
      };
    }
  }

  // Fallback: assume standard 44-byte header
  return {
    pcm: wavBuf.subarray(44),
    sampleRate,
    numChannels,
    bitsPerSample,
  };
}

// Build a WAV buffer from raw PCM data
function buildWAV(pcmData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const headerSize = 44;
  const dataLength = pcmData.length;
  const wavBuffer = Buffer.alloc(headerSize + dataLength);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataLength, 4);
  wavBuffer.write('WAVE', 8);

  // fmt chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);        // chunk size
  wavBuffer.writeUInt16LE(1, 20);         // PCM format
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // byte rate
  wavBuffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);              // block align
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataLength, 40);

  // Copy PCM data
  pcmData.copy(wavBuffer, headerSize);

  return wavBuffer;
}

async function callZaiTTS(text: string, voice: string): Promise<Buffer> {
  const zaiVoice = ZAI_VOICE_MAP[voice] || "kazi";
  const chunks = splitTextIntoChunks(text, 900);

  return withRetry(async () => {
    if (chunks.length === 1) {
      return await generateChunk(text, zaiVoice);
    }

    // For multi-chunk: generate each as WAV, extract PCM, concatenate, rebuild WAV
    const pcmBuffers: Buffer[] = [];
    let totalDataLength = 0;
    let sampleRate = 24000;
    let numChannels = 1;
    let bitsPerSample = 16;

    for (const chunk of chunks) {
      const wavBuf = await generateChunk(chunk, zaiVoice);
      const { pcm, sampleRate: sr, numChannels: nc, bitsPerSample: bps } = extractPCMFromWAV(wavBuf);
      pcmBuffers.push(pcm);
      totalDataLength += pcm.length;
      if (pcmBuffers.length === 1) {
        sampleRate = sr;
        numChannels = nc;
        bitsPerSample = bps;
      }
    }

    // Concatenate all PCM data
    const allPCM = Buffer.concat(pcmBuffers, totalDataLength);

    // Build a single WAV with the concatenated PCM
    return buildWAV(allPCM, sampleRate, numChannels, bitsPerSample);
  }, 2, 1500);
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "kazi" } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Limit to 1024 chars (z-ai API limit)
    const truncatedText = text.slice(0, 1024);

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

// Warmup endpoint - pre-initialize the z-ai SDK singleton
export async function GET() {
  try {
    await getZAI();
    return NextResponse.json({ warmup: true, provider: "zai" });
  } catch (err) {
    console.error("[tts] Warmup failed:", err);
    return NextResponse.json({ warmup: false, error: err instanceof Error ? err.message : "Unknown" });
  }
}
