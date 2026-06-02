import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════════
// DEEPGRAM AURA-2 VOICE PRESETS — 11 unique English voices with distinct tone/pitch
// ═══════════════════════════════════════════════════════════════════════════════
//
// Female voices (6):
//   asteria-en    — Warm, conversational, mid-pitch      (warm/confident)
//   luna-en       — Clear, professional, mid-high pitch   (professional/polished)
//   athena-en     — Authoritative, lower pitch, commanding (executive/decisive)
//   hera-en       — Smooth, measured, mid pitch            (calm/reliable)
//   cora-en       — Bright, energetic, higher pitch        (friendly/dynamic)
//   amalthea-en   — Gentle, warm, softer pitch             (empathetic/kind)
//
// Male voices (5):
//   orion-en      — Deep, authoritative, low pitch         (commanding/serious)
//   apollo-en     — Warm, confident, mid-low pitch         (reassuring/experienced)
//   arcas-en      — Conversational, mid pitch              (approachable/natural)
//   zeus-en       — Powerful, deep, resonant               (dominant/imposing)
//   atlas-en      — Steady, professional, mid pitch        (reliable/measured)

// ─── Persona → Deepgram Voice Mapping ─────────────────────────────────────────
// Each persona gets a UNIQUE voice that matches their personality, gender,
// nationality, and role. Tone and pitch differentiation is critical —
// every sales call should feel distinctly different.

const DEEPGRAM_VOICE_MAP: Record<string, string> = {
  // Male personas
  p1_faisal:   "aura-2-apollo-en",   // Emirati MD, 52 — warm, experienced, relationship-first → Apollo (warm/reassuring)
  p3_omar:     "aura-2-orion-en",    // Jordanian FD, 45 — analytical, direct, ROI-driven → Orion (deep/authoritative)
  p4_rajesh:   "aura-2-arcas-en",    // Indian GM, 41 — fast-talking, aggressive negotiator → Arcas (conversational/approachable)
  p5_imran:    "aura-2-atlas-en",    // Pakistani CFO, 47 — measured, financially disciplined → Atlas (steady/professional)
  p6_vikram:   "aura-2-zeus-en",     // Indian GM, 43 — confident, direct, pragmatic → Zeus (powerful/imposing)
  p8_michael:  "aura-2-orion-en",    // Irish, 49 — traditional, relationship-oriented → Orion (deep/authoritative)
  p9_andrew:   "aura-2-arcas-en",    // Australian, 46 — friendly, open, direct → Arcas (approachable/natural)
  p12_tariq:   "aura-2-atlas-en",    // Pakistani, 39 — technical, precise, reserved → Atlas (steady/measured)

  // Female personas
  p2_noura:    "aura-2-athena-en",   // Emirati COO, 38 — calm, precise, strategic → Athena (authoritative/commanding)
  p7_sarah:    "aura-2-hera-en",     // British CFO, 44 — composed, exacting, dry wit → Hera (smooth/measured)
  p10_maricel: "aura-2-asteria-en",  // Filipino, 34 — warm, helpful, professional → Asteria (warm/conversational)
  p11_dana:    "aura-2-cora-en",     // Lebanese, 26 — lively, chatty, curious → Cora (bright/energetic)
  p13_fatima:  "aura-2-athena-en",   // Emirati, 42 — formal, authoritative, direct → Athena (authoritative/commanding)
};

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";

// ─── ZAI TTS (Fallback) ──────────────────────────────────────────────────────

const VALID_ZAI_VOICES = new Set([
  "tongtong", "chuichui", "xiaochen", "jam", "kazi", "douji", "luodo",
]);

function mapZaiVoice(voice: string): string {
  if (VALID_ZAI_VOICES.has(voice)) return voice;
  const legacyMap: Record<string, string> = {
    "aura-2-cora-en": "kazi",
    "aura-2-amalthea-en": "tongtong",
    "aura-2-orion-en": "jam",
    "aura-2-apollo-en": "jam",
    "aura-2-arcas-en": "xiaochen",
    "aura-2-luna-en": "tongtong",
    "aura-2-helios-en": "douji",
    "aura-2-atlas-en": "xiaochen",
  };
  return legacyMap[voice] || "kazi";
}

let zaiInstance: any = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Helper: Split text into chunks ──────────────────────────────────────────

function splitTextIntoChunks(text: string, maxLength = 1900): string[] {
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

// ─── Helper: Retry with exponential backoff ──────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// DEEPGRAM TTS — Primary engine with 11 distinct voice presets
// ═══════════════════════════════════════════════════════════════════════════════

async function callDeepgramTTS(text: string, personaId: string): Promise<Buffer> {
  const model = DEEPGRAM_VOICE_MAP[personaId] || "aura-2-asteria-en";

  return withRetry(async () => {
    const chunks = splitTextIntoChunks(text, 1900);

    if (chunks.length === 1) {
      return await generateDeepgramChunk(text, model);
    }

    // Multi-chunk: concatenate WAV PCM data
    const pcmBuffers: Buffer[] = [];
    let totalDataLength = 0;
    let sampleRate = 24000;
    let numChannels = 1;
    let bitsPerSample = 16;

    for (const chunk of chunks) {
      const wavBuf = await generateDeepgramChunk(chunk, model);
      const { pcm, sampleRate: sr, numChannels: nc, bitsPerSample: bps } = extractPCMFromWAV(wavBuf);
      pcmBuffers.push(pcm);
      totalDataLength += pcm.length;
      if (pcmBuffers.length === 1) {
        sampleRate = sr;
        numChannels = nc;
        bitsPerSample = bps;
      }
    }

    const allPCM = Buffer.concat(pcmBuffers, totalDataLength);
    return buildWAV(allPCM, sampleRate, numChannels, bitsPerSample);
  }, 2, 1500);
}

async function generateDeepgramChunk(text: string, model: string): Promise<Buffer> {
  const url = `https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&container=wav`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Token ${DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Deepgram TTS failed (${response.status}): ${errorBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZAI TTS — Fallback engine
// ═══════════════════════════════════════════════════════════════════════════════

async function callZaiTTS(text: string, voice: string): Promise<Buffer> {
  const zaiVoice = mapZaiVoice(voice);
  const chunks = splitTextIntoChunks(text, 900);

  return withRetry(async () => {
    if (chunks.length === 1) {
      return await generateZaiChunk(text, zaiVoice);
    }

    const pcmBuffers: Buffer[] = [];
    let totalDataLength = 0;
    let sampleRate = 24000;
    let numChannels = 1;
    let bitsPerSample = 16;

    for (const chunk of chunks) {
      const wavBuf = await generateZaiChunk(chunk, zaiVoice);
      const { pcm, sampleRate: sr, numChannels: nc, bitsPerSample: bps } = extractPCMFromWAV(wavBuf);
      pcmBuffers.push(pcm);
      totalDataLength += pcm.length;
      if (pcmBuffers.length === 1) {
        sampleRate = sr;
        numChannels = nc;
        bitsPerSample = bps;
      }
    }

    const allPCM = Buffer.concat(pcmBuffers, totalDataLength);
    return buildWAV(allPCM, sampleRate, numChannels, bitsPerSample);
  }, 2, 1500);
}

async function generateZaiChunk(text: string, voice: string): Promise<Buffer> {
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

// ═══════════════════════════════════════════════════════════════════════════════
// WAV Utilities — Extract PCM / Build WAV headers
// ═══════════════════════════════════════════════════════════════════════════════

function extractPCMFromWAV(wavBuf: Buffer): { pcm: Buffer; sampleRate: number; numChannels: number; bitsPerSample: number } {
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;

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

function buildWAV(pcmData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const headerSize = 44;
  const dataLength = pcmData.length;
  const wavBuffer = Buffer.alloc(headerSize + dataLength);

  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataLength, 4);
  wavBuffer.write('WAVE', 8);

  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  wavBuffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataLength, 40);

  pcmData.copy(wavBuffer, headerSize);

  return wavBuffer;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Route Handler — Deepgram primary, ZAI fallback
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "aura-2-asteria-en", personaId = "" } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const truncatedText = text.slice(0, 2000);
    let audioBuffer: Buffer;
    let usedProvider = "deepgram";

    // ── Try Deepgram TTS first (11 distinct persona voices) ──
    if (DEEPGRAM_API_KEY) {
      try {
        const effectivePersonaId = personaId || resolvePersonaIdFromVoice(voice);
        audioBuffer = await callDeepgramTTS(truncatedText, effectivePersonaId);
      } catch (dgError) {
        console.warn("[tts] Deepgram TTS failed, falling back to ZAI:", dgError instanceof Error ? dgError.message : dgError);
        usedProvider = "zai";
        audioBuffer = await callZaiTTS(truncatedText, voice);
      }
    } else {
      // No Deepgram API key — use ZAI directly
      usedProvider = "zai";
      audioBuffer = await callZaiTTS(truncatedText, voice);
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-cache",
        "X-TTS-Provider": usedProvider,
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

// Resolve personaId from legacy voice name (backward compatibility)
function resolvePersonaIdFromVoice(voice: string): string {
  // If the voice is already an aura-2 model, try to find a matching persona
  // Otherwise return empty string (will use default voice)
  const voiceToPersona: Record<string, string> = {
    "aura-2-apollo-en": "p1_faisal",
    "aura-2-orion-en": "p3_omar",
    "aura-2-arcas-en": "p4_rajesh",
    "aura-2-atlas-en": "p5_imran",
    "aura-2-zeus-en": "p6_vikram",
    "aura-2-athena-en": "p2_noura",
    "aura-2-hera-en": "p7_sarah",
    "aura-2-asteria-en": "p10_maricel",
    "aura-2-cora-en": "p11_dana",
  };
  return voiceToPersona[voice] || "";
}

// Warmup endpoint
export async function GET() {
  const results: { deepgram: boolean; zai: boolean } = { deepgram: false, zai: false };

  // Test Deepgram connectivity
  if (DEEPGRAM_API_KEY) {
    try {
      const url = `https://api.deepgram.com/v1/speak?model=aura-2-asteria-en&encoding=linear16&container=wav`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "warmup" }),
      });
      results.deepgram = response.ok;
    } catch {
      results.deepgram = false;
    }
  }

  // Test ZAI connectivity
  try {
    await getZAI();
    results.zai = true;
  } catch {
    results.zai = false;
  }

  return NextResponse.json({
    warmup: results.deepgram || results.zai,
    providers: results,
  });
}
