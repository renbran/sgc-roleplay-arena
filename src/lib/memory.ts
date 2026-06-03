import { MemoryClient } from "mem0ai";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoryContext {
  userId: string;
  personaId: string;
  sessionId: string;
}

export interface MemoryEntry {
  memory: string;
  /** Category for filtering — e.g. 'rep_skill', 'preference', 'persona_memory', 'session_fact' */
  category?: string;
}

// ── Client singleton ─────────────────────────────────────────────────────────

let _client: MemoryClient | null = null;

function getClient(): MemoryClient | null {
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) return null;
  if (!_client) {
    _client = new MemoryClient({ apiKey });
  }
  return _client;
}

function isEnabled(): boolean {
  return !!process.env.MEM0_API_KEY;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * User-facing label for a persona — used in memory text for readability.
 */
function personaLabel(personaId: string): string {
  const names: Record<string, string> = {
    p1_faisal: "Faisal (Al Marri Properties)",
    p2_noura: "Noura (SkyPark PM)",
    p3_omar: "Omar (Al Rashidi Developments)",
    p4_rajesh: "Rajesh (Crystal Residences)",
    p5_imran: "Imran (Gulf Brokers Realty)",
  };
  return names[personaId] ?? personaId;
}

// ── Core operations ──────────────────────────────────────────────────────────

/**
 * Store one or more memory entries extracted from a conversation.
 *
 * Each entry is stored as a structured memory associated with the rep (user_id)
 * and optionally scoped to a persona (agent_id).
 */
export async function storeMemories(
  entries: MemoryEntry[],
  context: MemoryContext,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const baseConfig = {
    userId: context.userId,
    agentId: context.personaId,
    runId: context.sessionId,
  };

  for (const entry of entries) {
    try {
      await client.add(
        [{ role: "user", content: entry.memory }],
        {
          ...baseConfig,
          metadata: {
            category: entry.category ?? "session_fact",
            timestamp: new Date().toISOString(),
          },
        },
      );
    } catch (err) {
      console.warn("[mem0] Failed to store memory:", err);
    }
  }
}

/**
 * Search for relevant memories given a natural-language query.
 * Returns an array of memory result objects with `.memory` text.
 */
export async function searchMemories(
  query: string,
  userId: string,
  personaId?: string,
): Promise<{ memory: string; category?: string }[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const filters: Record<string, unknown> = { user_id: userId };
    if (personaId) filters.agent_id = personaId;

    const response = await client.search(query, { filters });
    const results = response?.results ?? [];
    return results.map((r) => ({
      memory: r.memory ?? "",
      category: r.metadata?.category,
    }));
  } catch (err) {
    console.warn("[mem0] searchMemories failed:", err);
    return [];
  }
}

/**
 * Get all stored memories for a user, optionally filtered by persona.
 *
 * Uses client.search() under the hood because client.getAll() does not
 * correctly apply entity-id filters in the current mem0 API version.
 */
export async function getAllMemories(
  userId: string,
  personaId?: string,
): Promise<{ memory: string; category?: string; createdAt?: string }[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const filters: Record<string, unknown> = { user_id: userId };
    if (personaId) filters.agent_id = personaId;

    const response = await client.search(userId, {
      filters,
      topK: 100,
    });
    const results = response?.results ?? [];
    return results.map((r) => ({
      memory: r.memory ?? "",
      category: r.metadata?.category,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt?.toISOString?.() ?? undefined,
    }));
  } catch (err) {
    console.warn("[mem0] getAllMemories failed:", err);
    return [];
  }
}

/**
 * Delete all memories for a user (e.g. when resetting).
 */
export async function deleteUserMemories(userId: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.deleteAll({ userId });
  } catch (err) {
    console.warn("[mem0] deleteUserMemories failed:", err);
  }
}

// ── Memory extraction from conversations ─────────────────────────────────────

/**
 * Extract notable memories from a conversation exchange.
 * Called after each assistant response.
 */
export function extractMemories(
  userMessage: string,
  aiResponse: string,
  personaId: string,
  _personaName: string,
): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  const label = personaLabel(personaId);

  // ---- Rep skill detection ----

  // Good discovery question
  if (
    /\?/.test(userMessage) &&
    /(how|what|when|tell me|describe|walk me|explain|why)/i.test(userMessage)
  ) {
    entries.push({
      memory: `The rep asked a substantive discovery question in the conversation with ${label}.`,
      category: "rep_skill",
    });
  }

  // Industry-specific knowledge
  if (
    /(RERA|Ejari|FTA|VAT|DLD|BOQ|subcontractor|RevPAR|ERP|corporate tax|EBITDA|procurement)/i.test(
      userMessage,
    )
  ) {
    entries.push({
      memory: `The rep demonstrated domain-specific industry knowledge in the conversation with ${label}.`,
      category: "rep_skill",
    });
  }

  // Empathy / active listening
  if (
    /(I understand|that makes sense|that'?s (?:a real|challenging)|sounds like|that must)/i.test(
      userMessage,
    )
  ) {
    entries.push({
      memory: `The rep showed empathy and active listening skills during the conversation with ${label}.`,
      category: "rep_skill",
    });
  }

  // ---- Booking / commitment achieved ----
  if (
    /(?:works for me|sounds good).{0,50}(?:meet|meeting|demo|call)/i.test(aiResponse) ||
    /let'?s (?:schedule|book|set up|confirm)/i.test(aiResponse)
  ) {
    entries.push({
      memory: `The rep successfully secured a commitment (meeting/demo booking) from ${label}.`,
      category: "session_fact",
    });
  }

  // ---- Pain admission detected (persona opened up) ----
  const admissionPatterns = [
    /honestly[,\s]/i,
    /if i'?m being honest/i,
    /between (?:you and me|us)[,\s]/i,
    /it does (?:take|cost|happen)/i,
    /we do (?:have|struggle|miss|lose|face)/i,
    /(?:it'?s|it is) (?:been )?(?:a problem|an issue|challenging)/i,
  ];
  if (admissionPatterns.some((p) => p.test(aiResponse))) {
    entries.push({
      memory: `The rep earned enough trust for ${label} to admit a pain point or concern.`,
      category: "rep_skill",
    });
  }

  return entries;
}

/**
 * Build a natural-language memory context string for injection into
 * the persona's system prompt. Returns empty string if no memories exist
 * or if mem0 is not configured.
 */
export async function buildMemoryContext(
  userId: string,
  personaId: string,
  personaName: string,
): Promise<string> {
  if (!isEnabled()) return "";

  try {
    // Get persona-specific memories (things this persona "remembers" about the rep)
    const personaMemories = await searchMemories(
      `What have I learned about this sales rep from our conversations?`,
      userId,
      personaId,
    );

    // Also get general rep skill memories
    const skillMemories = await searchMemories(
      `What sales skills does this rep have?`,
      userId,
    );

    const allMemories = [
      ...personaMemories.map((m) => m.memory),
      ...skillMemories.map((m) => m.memory),
    ];

    // Deduplicate
    const unique = [...new Set(allMemories)];
    if (unique.length === 0) return "";

    const memoryLines = unique.map((m) => `  • ${m}`).join("\n");

    return `\n\n[CROSS-SESSION MEMORY — What ${personaName} knows about this rep from past conversations]\n${memoryLines}\n\nGuidelines:\n- Use these memories naturally if they become relevant during the conversation.\n- If a memory mentions a previous interaction, you MAY reference it: "Last time we spoke, you mentioned..." or "You've been thinking about this for a while now."\n- Do NOT fabricate memories — only reference what is listed above.\n- If no memories are listed above, treat this as a first conversation.\n[END MEMORY]`;
  } catch (err) {
    console.warn("[mem0] buildMemoryContext failed:", err);
    return "";
  }
}

/**
 * Store a summary / outcome of a completed session for long-term learning.
 */
export async function storeSessionOutcome(
  context: MemoryContext,
  outcome: {
    stage: string;
    booked: boolean;
    messageCount: number;
    provider: string;
  },
): Promise<void> {
  const label = personaLabel(context.personaId);

  const entries: MemoryEntry[] = [
    {
      memory: `The rep completed a session with ${label} reaching stage "${outcome.stage}" after ${outcome.messageCount} messages. Outcome: ${outcome.booked ? "Booked meeting" : "Did not book"}.`,
      category: "session_fact",
    },
  ];

  if (outcome.booked) {
    entries.push({
      memory: `The rep successfully booked a meeting with ${label} — strong closing skills demonstrated.`,
      category: "rep_skill",
    });
  }

  await storeMemories(entries, context);
}
