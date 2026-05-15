---
Task ID: 1
Agent: Main Agent
Task: Improve roleplay workflow with human-realistic conversation flow, pain discovery gates, and fix voice recording bug

Work Log:
- Read and analyzed all 13 persona system prompts in /src/lib/personas/index.ts
- Read chat API route at /src/app/api/roleplay/chat/route.ts
- Read ASR route at /src/app/api/roleplay/asr/route.ts
- Read main page.tsx frontend code
- Identified key issues: personas give up pain too easily, no conversation stage tracking, voice recording stops prematurely
- Rewrote ALL 13 persona system prompts with enhanced framework:
  - Added CONVERSATION FLOW framework (4 stages: Guarded → Warming → Discovery → Consideration)
  - Added PAIN POINT DISCOVERY GATES for each persona (each pain requires specific question to unlock)
  - Added DEFLECTION PATTERNS (minimize, redirect, generalize, deflect with question, acknowledge without detail, loyalty shield)
  - Added HUMAN FEEL rules (filler words, emotional reactions, incomplete sentences, gradual warming)
  - Significantly expanded weak personas (p5_imran, p6_vikram, p7_sarah, p8_michael, p9_andrew) with detailed backgrounds
  - Preserved excellent gatekeeper personas (Maricel, Dana, Tariq, Fatima) while adding the framework
- Updated chat API (/api/roleplay/chat/route.ts):
  - Added getStageInstruction() function that injects stage enforcement based on message count
  - Stage instructions reinforce the pain discovery gates at each conversation stage
  - Added conversation stage in API response (stage field)
  - Increased conversation history limit from 30 to 42 messages
  - Adjusted temperature from 0.8 to 0.75 for more consistent persona behavior
  - Added better error handling for LLM fallback
- Fixed voice recording premature stop bug:
  - Increased SILENCE_DURATION from 1800ms to 3500ms (key fix)
  - Lowered SILENCE_THRESHOLD from 8 to 6 for better sensitivity
  - Increased MIN_RECORDING_DURATION from 800ms to 1200ms
  - Increased MAX_RECORDING_DURATION from 90s to 120s
  - Increased SPEECH_DETECTION_INTERVAL from 100ms to 150ms for stability
- Added conversation stage UI to frontend:
  - Added conversationStage state variable
  - Added stage indicator badge in roleplay header (Guarded/Warming/Discovery/Open with tooltips)
  - Added Conversation Flow progress card in sidebar showing all 4 stages
  - Stage updates automatically from chat API response
  - Reset stage to "guarded" on new session start
- Tested chat API: persona correctly responds in guarded manner, progresses through stages
- Lint passes cleanly
- All dev server compilations successful

Stage Summary:
- All 13 personas now have human-realistic conversation flow with pain discovery gates
- Personas don't reveal pain points until the rep asks specific, relevant questions
- Conversation progresses through 4 natural stages (Guarded → Warming → Discovery → Consideration)
- Voice recording no longer stops prematurely (3.5s silence duration instead of 1.8s)
- Frontend shows conversation stage indicators and progress guidance
- Chat API returns stage information and injects stage enforcement
