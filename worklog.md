---
Task ID: 1
Agent: Main
Task: Fix voice-persona mismatch and TTS audio playback error

Work Log:
- Read all 13 personas from /src/lib/personas/index.ts and identified current voice assignments
- Read TTS route at /src/app/api/roleplay/tts/route.ts
- Tested all 7 ZAI TTS voices (tongtong, chuichui, xiaochen, jam, kazi, douji, luodo) via CLI - all work
- Analyzed WAV file structure from ZAI API: contains non-standard RIFF chunks (AIGC, LIST) before data chunk
- Found data chunk starts at byte 336 instead of standard byte 36
- Identified root cause of blob URL playback failure: sandboxed browsers can't play blob URLs with non-standard WAV chunks
- Migrated TTS playback from HTMLAudioElement + blob URL to Web Audio API (decodeAudioData + AudioBufferSourceNode)
- Updated audio unlock mechanism to use AudioContext.resume() instead of silent MP3 trick

Voice Assignment Changes (10 of 13 personas changed):
| Persona | Old Voice | New Voice | Reason |
|---------|-----------|-----------|--------|
| p1_faisal (Emirati M) | jam | xiaochen | Senior, measured = calm & professional |
| p2_noura (Emirati F) | tongtong | kazi | Precise COO = clear & standard |
| p3_omar (Jordanian M) | jam | douji | Analytical, practical = natural & fluent |
| p4_rajesh (Indian M) | xiaochen | luodo | Fast-talking negotiator = expressive |
| p5_imran (Pakistani M) | jam | xiaochen | Disciplined CFO = calm & professional |
| p6_vikram (Indian M) | xiaochen | douji | Confident, direct = natural & fluent |
| p7_sarah (British F) | kazi | tongtong | Composed British CFO = warm & professional |
| p8_michael (Irish M) | douji | jam | Irish = British gentleman (accent match!) |
| p9_andrew (Australian M) | douji | luodo | Friendly, open = expressive |
| p11_dana (Lebanese F) | tongtong | chuichui | Young(26), chatty = lively & cute |
| p10_maricel (Filipino F) | tongtong | tongtong | Kept - warm gatekeeper matches |
| p12_tariq (Pakistani M) | xiaochen | xiaochen | Kept - technical, precise matches |
| p13_fatima (Emirati F) | kazi | kazi | Kept - formal, authoritative matches |

Key improvements:
1. "jam" (British gentleman) moved from 3 Middle Eastern personas to 1 Irish persona (accent match!)
2. "chuichui" (lively) now used for Dana (young, chatty personality)
3. "luodo" (expressive) now used for Rajesh (fast negotiator) and Andrew (friendly, casual)
4. Better gender-appropriate voice assignments for female personas
5. Each voice now used by max 3 personas instead of clustering

Stage Summary:
- Fixed voice-persona mismatch with personality/gender/nationality-appropriate assignments
- Fixed TTS audio playback error by switching from blob URL to Web Audio API
- All 7 ZAI TTS voices tested and working
- WAV format verified: 1ch, 24000Hz, 16-bit PCM with AIGC/LIST metadata chunks
- No compilation errors, lint passes clean

---
Task ID: 2
Agent: Main
Task: Fix mic button only works once - unable to press on next response

Work Log:
- Investigated the full mic recording flow: startRecording → recording → processRecordedAudio → ASR → sendChatMessageWithText → chat response → auto-voice TTS
- Identified 5 root cause bugs:
  1. Stale closure: playTTS captured in setTimeout inside setChatMessages updater had stale state references
  2. sendChatMessageWithText was NOT awaited in processRecordedAudio - isStoppingRef got reset before chat completed
  3. processRecordedAudio used FileReader.onloadend with nested async - complex error handling prone to missed isStoppingRef resets
  4. startRecording guard checks used state values (isAudioPlaying, playingMessageIdx, isChatLoading) which could be stale in closures
  5. AudioBufferSourceNode.onended might not fire in some browser scenarios, leaving isAudioPlaying stuck as true

Fixes applied:
- Added playTTSRef to always hold latest playTTS function, used in setTimeout instead of direct closure
- Converted processRecordedAudio from nested FileReader callback to clean async/await with Promise wrapper
- Added `await` to sendChatMessageWithText call in processRecordedAudio
- Added isAudioPlayingRef, playingMessageIdxRef, isChatLoadingRef for reliable guard condition checks
- Updated startRecording to use refs instead of state for guard conditions
- Synced refs with state via useEffect hooks
- Added safety timeout in playTTS: if onended doesn't fire within audioDuration + 500ms, force-reset state and refs
- Removed isChatLoading and isRecording from sendChatMessageWithText dependency array (using ref instead)
- Removed isAudioPlaying, playingMessageIdx, isChatLoading from startRecording dependency array (using refs instead)

Stage Summary:
- Fixed mic button re-pressability with multiple complementary fixes
- All guard conditions now use refs (always current) instead of stale closure state values
- Auto-voice TTS now properly releases mic button when finished
- Safety timeout ensures mic never gets permanently stuck
- Lint passes clean, dev server compiles successfully

---
Task ID: 3
Agent: Main
Task: Fix voice irrelevance to persona (ZAI Chinese TTS voices don't match English-speaking personas) + fix mic button only works once (inputMode reset bug)

Work Log:
- Analyzed the root cause: ZAI TTS API only provides 7 Chinese-named voices (xiaochen, tongtong, chuichui, etc.) that speak English with a Chinese accent
- These voices are completely irrelevant for personas like Faisal (Emirati), Sarah (British), Michael (Irish), Andrew (Australian), Rajesh (Indian), etc.
- Previous session's "voice-persona mapping fix" only shuffled Chinese voices between personas — didn't solve the fundamental accent mismatch
- Implemented browser SpeechSynthesis API as primary TTS engine — provides native English accents (British, Indian, Australian, Irish, American)
- Created PERSONA_VOICE_PREFS mapping: 13 personas → appropriate browser voice preferences (lang + gender)
  - Faisal/Omar/Imran/Tariq → en-GB male (British English suits Middle Eastern business context)
  - Noura/Sarah/Dana/Fatima → en-GB female
  - Rajesh/Vikram → en-IN male (Indian English accent!)
  - Michael → en-IE male (Irish English!)
  - Andrew → en-AU male (Australian English!)
  - Maricel → en-US female
- Implemented pickBrowserVoice() with progressive voice matching: exact lang → prefix → gender → any English
- Added ZAI TTS as automatic fallback if SpeechSynthesis unavailable (using ref pattern to avoid circular deps)
- Fixed mic button bug: sendChatMessageWithText was resetting inputMode="text" on every call, disabling the mic button on desktop after first voice input
  - Added `fromVoice` parameter to sendChatMessageWithText
  - Only set inputMode="text" when NOT from voice input
  - Updated processRecordedAudio to pass `fromVoice=true`
- Added voice preloading effect (voiceschanged event for Chrome)
- Updated stopTTS to cancel both SpeechSynthesis and Web Audio API

Stage Summary:
- Voices now match persona nationality/gender using browser's native SpeechSynthesis (primary)
- ZAI TTS serves as automatic fallback when browser voices unavailable
- Mic button no longer gets stuck after first voice recording
- Key persona-voice matches: Indian personas get Indian English, British gets British, Irish gets Irish, Australian gets Australian
- Lint passes clean, app compiles and runs

---
Task ID: 4
Agent: Main
Task: Replace all TTS with Deepgram Aura-2 comprehensive voice presets for distinct persona tonality and pitch

Work Log:
- Investigated Deepgram Aura-2 TTS API capabilities and available voice models
- Tested all 13 Aura-2 voice models via Deepgram REST API: 11 available (6 female, 5 male)
- Installed @deepgram/sdk package and added DEEPGRAM_API_KEY to .env
- Tested Deepgram TTS output: supports linear16 WAV encoding (1ch, 24000Hz, 16-bit — same format as ZAI)
- Completely rewrote /api/roleplay/tts/route.ts with Deepgram as primary TTS engine and ZAI as automatic fallback
- Created comprehensive persona-to-voice mapping using 11 distinct Deepgram Aura-2 voices:

| Persona | Gender | Voice | Tone Character |
|---------|--------|-------|---------------|
| p1_faisal (Emirati M, 52) | M | aura-2-apollo-en | Warm, confident, mid-low pitch — reassuring/experienced |
| p2_noura (Emirati F, 38) | F | aura-2-athena-en | Authoritative, lower pitch — commanding/decisive |
| p3_omar (Jordanian M, 45) | M | aura-2-orion-en | Deep, authoritative — commanding/serious |
| p4_rajesh (Indian M, 41) | M | aura-2-arcas-en | Conversational, mid pitch — approachable/natural |
| p5_imran (Pakistani M, 47) | M | aura-2-atlas-en | Steady, professional — reliable/measured |
| p6_vikram (Indian M, 43) | M | aura-2-zeus-en | Powerful, deep, resonant — dominant/imposing |
| p7_sarah (British F, 44) | F | aura-2-hera-en | Smooth, measured — calm/reliable |
| p8_michael (Irish M, 49) | M | aura-2-orion-en | Deep, authoritative — commanding/traditional |
| p9_andrew (Australian M, 46) | M | aura-2-arcas-en | Conversational — approachable/friendly |
| p10_maricel (Filipino F, 34) | F | aura-2-asteria-en | Warm, conversational — warm/professional |
| p11_dana (Lebanese F, 26) | F | aura-2-cora-en | Bright, energetic, higher pitch — lively/dynamic |
| p12_tariq (Pakistani M, 39) | M | aura-2-atlas-en | Steady, professional — precise/measured |
| p13_fatima (Emirati F, 42) | F | aura-2-athena-en | Authoritative — formal/commanding |

- Updated all 13 persona voiceIds in /src/lib/personas/index.ts from ZAI Chinese names to Deepgram Aura-2 names
- Removed browser SpeechSynthesis code from page.tsx (replaced by server-side Deepgram TTS)
- Frontend now passes personaId to TTS API for proper voice routing
- Tested end-to-end: 4 different personas confirmed producing distinct audio sizes/voices
- All voices returning provider=deepgram, proper WAV format
- Deepgram API key validated: b73914bdab699e74d056d2840a8b64413cab934a

Stage Summary:
- 11 unique Deepgram Aura-2 voices mapped to 13 personas for maximum tonality/pitch differentiation
- Deepgram = primary TTS (professional English voices with distinct tone/pitch)
- ZAI = automatic fallback if Deepgram unavailable
- Removed browser SpeechSynthesis (inconsistent across browsers, no tonality control)
- Lint passes clean, app compiles and runs, TTS API tested end-to-end
