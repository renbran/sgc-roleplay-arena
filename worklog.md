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
