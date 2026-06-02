# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**SGC TECH Roleplay Arena** — an AI-powered sales training web app built on Next.js 16 with App Router. Sales reps practice cold-calling against 13 realistic AI buyer personas in either text chat or voice mode. Deployed on Vercel (production: `roleplay-arena-psi.vercel.app`) and also on a self-hosted Linux server behind Caddy on port 81.

The git root is `D:\01_WORK_PROJECTS` (the parent directory). The Next.js app lives at `D:\01_WORK_PROJECTS\Roleplay\`.

## Commands

```bash
# Development
bun run dev          # starts on :3000
bun run build        # standalone Next.js build
bun run start        # start production build
bun run lint         # eslint

# Database (PostgreSQL via Prisma)
bun run db:push      # push schema changes
bun run db:generate  # regenerate Prisma client
bun run db:migrate   # run migrations (dev)
bun run db:reset     # reset database

# E2E tests (Playwright — targets production URL by default)
npx playwright test
npx playwright test e2e/auth-and-name.spec.ts    # single spec (uses localhost:3000)
npx playwright test e2e/production-smoke.spec.ts  # production smoke (uses Vercel URL)
```

Dev server is reverse-proxied through Caddy on port 81. Turbopack is enabled in dev via `next.config.ts`.

## Architecture

### Frontend (`src/app/page.tsx`)

All UI is in a **single page component** managing 4 views via local state: `dashboard`, `select`, `roleplay`, `history`.

Key behaviors:
- **Auth gate**: two-step flow — password then name. Stored in localStorage under keys `sgc-roleplay-auth-v2` and `sgc-roleplay-username-v2`. Old v1 keys are ignored.
- **Voice pipeline**: Mic → WebM audio → base64 → `POST /api/roleplay/asr` → text → chat. TTS via `POST /api/roleplay/tts` using Deepgram Aura-2 voices, played through Web Audio API (`decodeAudioData` + `AudioBufferSourceNode`). VAD uses `AnalyserNode` with 3.5s silence threshold.
- **Scores**: persisted to DB via `POST /api/scores` at session end; leaderboard fetched via `GET /api/scores`.
- **Conversation history**: in-memory server-side `Map<sessionId, message[]>` — not persisted across server restarts, cleared by `DELETE /api/roleplay/chat?sessionId=`.

### API Routes (`src/app/api/`)

| Route | Purpose | LLM/Provider |
|-------|---------|--------------|
| `POST /api/roleplay/chat` | AI persona chat | Groq (llama-3.3-70b) → Mistral fallback |
| `POST /api/roleplay/asr` | Speech-to-text | Deepgram nova-2 → Groq Whisper fallback |
| `GET/POST /api/roleplay/tts` | Text-to-speech | Deepgram Aura-2 |
| `POST /api/roleplay/score` | Score a conversation | Anthropic (claude-opus-4-7) → Groq → Mistral |
| `GET /api/roleplay/token` | LiveKit room token | — |
| `GET/PATCH /api/sessions` | Session CRUD | — |
| `POST /api/sessions/feedback` | Session feedback | — |
| `GET/POST /api/scores` | Leaderboard scores (persisted) | — |
| `GET /api/personas` | Persona list | — |

All routes use `export const dynamic = "force-dynamic"`. Vercel function timeouts are configured in `vercel.json`.

### Conversation Stage System

The chat route injects stage instructions based on user message count. There are **5 stages**:

| Stage | Messages | Behavior |
|-------|----------|----------|
| Guarded | 1–4 | Deflects, no pain revealed |
| Warming | 5–8 | Acknowledges surface frustrations |
| Discovery | 9–14 | Opens up to specifically probed pain points |
| Consideration | 15–20 | Evaluates, still has objections |
| Closing | 21+ | Commits or rejects, conversation ends |

`detectBooking()` in `chat/route.ts` pattern-matches the AI response to flag when a meeting is booked.

### Personas (`src/lib/personas/index.ts`)

13 buyer personas (`p1`–`p13`), each with `systemPrompt`, `voiceId` (Deepgram Aura-2), `difficulty`, `openingLine`, `objections`, `winConditions`, `loseConditions`. The `CONVERSATION_FLOW_FRAMEWORK` constant is prepended to every persona's system prompt at runtime. Avatar PNGs live in `public/avatars/`.

To add a persona: add to `PERSONAS` array, add avatar PNG, add entry to `PERSONA_TYPES` map in `src/app/page.tsx`.

### Database (`prisma/schema.prisma`)

**PostgreSQL**. Three models:
- `Session` — roleplay session records (personaId, status, duration, outcome, rating)
- `Score` — persisted scoring results (userName, personaId, rapport/discovery/objectionHandling/closing scores, grade, outcome; `strengths` and `improvements` stored as JSON strings)
- `AgentStatus` — LiveKit agent worker heartbeats

### Admin (`src/app/admin/`)

Admin page accessible at `/admin`.

### Mini-Services (`mini-services/livekit-agent/`)

Python LiveKit agent for real-time voice calls (Deepgram STT, Groq/Mistral LLM, Silero VAD). Started separately — not part of the Next.js build.

## Environment Variables

```
# Required for core features
DATABASE_URL=postgresql://...
DEEPGRAM_API_KEY=...
GROQ_API_KEY=...

# Optional / fallback providers
MISTRAL_API_KEY=...
ANTHROPIC_API_KEY=...     # used by /api/roleplay/score as primary scorer

# LiveKit (for mini-services/livekit-agent only)
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

## Key Conventions

- **Package manager**: Bun. Always use `bun install`, `bun run`.
- **TypeScript**: `ignoreBuildErrors: true` — TS errors won't block builds.
- **UI**: shadcn/ui (`src/components/ui/`), Radix primitives, Tailwind v4.
- **LLM provider pattern**: all AI routes try providers in priority order with silent fallthrough — never assume one provider is always available.
- **Scoring fields**: `strengths` and `improvements` are stored as JSON strings in the `Score` table; `JSON.parse` when reading.
- **E2E tests**: `playwright.config.ts` defaults `baseURL` to the production Vercel URL. Local specs override with `http://localhost:3000` inline.
