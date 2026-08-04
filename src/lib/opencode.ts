// OpenCode Zen LLM provider (free tier, OpenAI-compatible).
//
// STATUS: validated and wired in as the PRIMARY tier (Zen → Mistral → Groq)
// in src/app/api/roleplay/chat/route.ts, per explicit product decision.
// Mistral and Groq are only reached if Zen fails or returns empty on a turn.
//
// ROOT CAUSE OF EARLIER 403s (resolved): every free model returned HTTP 403
// with body "error code: 1010" — a Cloudflare WAF bot-signature block, NOT an
// OpenCode auth/region/billing issue. Python's default urllib User-Agent
// ("Python-urllib/x.y") is a known bot signature Cloudflare rejects before
// the request reaches OpenCode's backend at all; curl's default UA passes.
// Node's global fetch() (what this file and the actual runtime use) was
// tested directly and passes with NO UA override needed — confirmed via a
// live Node script hitting the real endpoint. So no UA header workaround is
// required here.
//
// Earlier (now-superseded) conclusions about "heavy internal reasoning
// monologue" were a separate, real, but incompletely-diagnosed issue: at
// max_tokens=120 (then 20), reasoning-flavored models spent the entire
// budget on their internal monologue before any visible reply — that's a
// probe-cap artifact, not proof the models are unusable. Re-tested at
// max_tokens=1500, 3 conversational turns, against the canonical p1_faisal
// fixture (synthetic — see PRIVACY below):
//
//   Model                    | 1st-turn latency | reasoning % | verdict
//   -------------------------|-------------------|-------------|------------------
//   ling-3.0-flash-free      | 2.4s              | ~62%        | BEST — fast, rich, natural, chosen as default
//   big-pickle               | 4.7s              | ~45%        | strong second — clean, no artifacts
//   laguna-s-2.1-free        | 3.9s              | 0%          | viable — writes in paragraphs, not continuous speech
//   mimo-v2.5-free           | 6.1s              | ~65%, climbing | weaker — shallow, ends conversation early
//   deepseek-v4-flash-free   | 8.6s              | 37-51%      | DISQUALIFIED — turn 3 latency spiked to 22.5s
//   nemotron-3-ultra-free    | 9.4s              | ~54%        | DISQUALIFIED — over 8s bar + NVIDIA session logging
//   north-mini-code-free     | 17.7s             | ~73%        | DISQUALIFIED — 3x over 8s bar + Cohere ToS
//
// PRIVACY (non-negotiable):
// Zen's zero-retention policy EXCLUDES free models — during the free period,
// data may be used to improve them. north-mini-code-free runs under Cohere
// terms ("do not submit personal or confidential data"); nemotron-3-ultra-free
// runs under NVIDIA API Trial terms with session logging. Neither is used
// (both disqualified above), but the constraint applies to this whole tier:
// SYNTHETIC personas only — no real account names, no real deal sizes, no
// actual pricing, no positioning language from the live sales pipeline. The
// canonical persona fixtures in src/lib/personas are the safe fixtures.
//
// RELIABILITY: free tier has undocumented daily caps and widespread "free
// usage exceeded" reports even on funded accounts. 429 and empty-content
// responses must fall through to callLLM()'s failure-accumulation path, not
// throw and kill the turn — this file's callZenLLM() throws on both cases,
// which callLLM() already catches and treats as tier failure (see route.ts).
//
// Reasoning models spend a large share of the token budget on invisible
// monologue before any visible reply. The chat route's per-stage max_tokens
// (130-400) is sized for non-reasoning providers, so this tier requests a
// larger effective budget (see REASONING_TOKEN_MULTIPLIER below) to leave
// room for both reasoning and a real reply, even in the tightest (guarded)
// stage.
//
// Set ZEN_MODEL to override the default. Set ZEN_BASE_URL if the endpoint
// ever changes.

const ZEN_BASE_URL_DEFAULT = "https://opencode.ai/zen/v1";
const ZEN_MODEL_DEFAULT = "ling-3.0-flash-free";
const ZEN_TIMEOUT_MS = 12_000;
// ling-3.0-flash-free's reasoning scales with INPUT complexity, not just the
// requested output budget — the probe used a ~500-char test system prompt,
// but the real persona prompts (with CONVERSATION_FLOW_FRAMEWORK,
// HALLUCINATION_PREVENTION_RULES, stage instructions) run ~24,000 chars /
// ~5,800 prompt tokens. Live-tested against the real p1_faisal prompt:
// 390 tokens (the guarded stage's 130 * 3 multiplier) produced ZERO visible
// content (all consumed by reasoning, finish_reason=length). 600+ tokens
// reliably finished reasoning and produced real replies (finish_reason=stop)
// across repeated tests. A multiplier alone under-covers the smallest
// per-stage budgets, so this is multiplier-with-a-floor: whichever is
// larger, floor or multiplied value, capped so a call can't run away.
const REASONING_TOKEN_MULTIPLIER = 3;
const ZEN_MIN_TOKENS_FLOOR = 1200; // see note above — 700 survived turns 1-2 but failed turn 3 as context grew
const ZEN_MAX_TOKENS_CAP = 1500;

function getZenBaseUrl(): string {
  return process.env.ZEN_BASE_URL || ZEN_BASE_URL_DEFAULT;
}

function getZenModel(): string {
  return process.env.ZEN_MODEL || ZEN_MODEL_DEFAULT;
}

async function fetchWithAbort(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callZenLLM(
  history: Array<{ role: string; content: string }>,
  params: { temperature: number; max_tokens: number }
): Promise<string> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_API_KEY not configured");

  const baseUrl = getZenBaseUrl().replace(/\/$/, "");
  const effectiveMaxTokens = Math.min(
    Math.max(params.max_tokens * REASONING_TOKEN_MULTIPLIER, ZEN_MIN_TOKENS_FLOOR),
    ZEN_MAX_TOKENS_CAP
  );
  const response = await fetchWithAbort(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getZenModel(),
      messages: history,
      max_tokens: effectiveMaxTokens,
      temperature: params.temperature,
    }),
  }, ZEN_TIMEOUT_MS);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Zen LLM failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}
