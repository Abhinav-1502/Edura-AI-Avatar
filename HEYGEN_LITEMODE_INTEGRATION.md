# HeyGen LiveAvatar — LITE Mode Integration

## Table of Contents
1. [What Changed: FULL → LITE](#what-changed)
2. [Architecture Overview](#architecture)
3. [Project 1: Edura-AI-Avatar](#project-1)
4. [Project 2: Edura_Homework_Module_Prototype](#project-2)
5. [All New & Modified Endpoints](#endpoints)
6. [Fixes Applied](#fixes)
7. [Edge Cases & Race Conditions Tackled](#edge-cases)
8. [Current Phase of TTS Pipeline](#current-phase)
9. [How to Reduce Latency Further](#latency)
10. [How to Verify LITE Mode Is Active](#verify)

---

## 1. What Changed: FULL → LITE {#what-changed}

### FULL Mode (old)
- Token request included `avatar_persona.voice_id`
- Frontend sent **text** via LiveKit data channel: `avatar.speak_text`
- LiveAvatar internally called its own TTS engine and lip-synced
- Developer had no control over voice quality or TTS latency

### LITE Mode (current)
- Token request sends `mode: "LITE"` with no voice config
- Frontend sends **base64 raw PCM audio** via a separate WebSocket: `agent.speak`
- LiveAvatar only renders video (lip-sync + animation from the audio we provide)
- Developer fully controls TTS: voice, model, format, latency

### Key Architectural Difference

```
FULL mode:
  Frontend → LiveKit data channel → { type: "avatar.speak_text", text: "..." }
                                     └── LiveAvatar handles TTS internally

LITE mode:
  Frontend → POST /api/heygen/tts → ElevenLabs → PCM audio (base64)
  Frontend → WebSocket (ws_url)   → { type: "agent.speak", audio: "<base64_pcm>" }
                                     └── LiveAvatar renders video only
```

---

## 2. Architecture Overview {#architecture}

### LITE Mode Full Session Flow

```
Step 1: Token
  Frontend → POST /api/heygen/token
  Backend  → POST https://api.liveavatar.com/v1/sessions/token
             body: { mode: "LITE", avatar_id: "..." }
  Returns  → session_token (JWT)

Step 2: Session Start
  Frontend → POST https://api.liveavatar.com/v1/sessions/start
             Authorization: Bearer <session_token>
  Returns  → {
               livekit_url,          ← for receiving avatar video stream
               livekit_client_token, ← auth for LiveKit room
               ws_url                ← wss://webrtc-signaling.heygen.io/v2-alpha/...
             }

Step 3: Connect
  Frontend opens LiveKit Room  (receives avatar video/audio stream)
  Frontend opens WebSocket to ws_url (sends audio commands)

Step 4: Per sentence spoken
  a. LLM stream produces a sentence
  b. POST /api/heygen/tts  { text: "sentence" }
     → ElevenLabs API → raw PCM 16-bit 24kHz mono → base64
  c. WebSocket send: { type: "agent.speak", audio: "<base64_pcm>" }
  d. WebSocket send: { type: "agent.speak_end", event_id: "<uuid>" }
  e. LiveAvatar renders avatar video lip-synced to the PCM audio
  f. Frontend receives { type: "agent.speak_ended" } via WebSocket
  g. Queue advances to next sentence

Step 5: Interrupt
  WebSocket send: { type: "agent.interrupt" }
  Pending TTS fetches aborted via AbortController
  Speak queue cleared

Step 6: Stop Session
  Frontend → POST https://api.liveavatar.com/v1/sessions/stop
  WebSocket closed
  LiveKit room disconnected
```

### Dual Connection Diagram

```
Browser
├── LiveKit Room ──────────────────────► LiveAvatar Server
│   (receives video/audio stream)        (renders avatar)
│
└── WebSocket (ws_url) ────────────────► LiveAvatar Signaling
    (sends audio commands)               (agent.speak, agent.interrupt)
```

### TTS + Avatar Loop (per sentence)

```
LLM stream token → sentence boundary detected
        ↓
Speak queue: enqueue(text)
        ↓
drainQueue() — if not already draining
        ↓
[Phase 2] Check prefetch cache for this text
        ↓ miss          ↓ hit
POST /api/heygen/tts   use cached audio
ElevenLabs (~800ms)    (~0ms)
        ↓
WebSocket: agent.speak + agent.speak_end
        ↓
LiveAvatar renders video (lip-sync)
        ↓
[Phase 2] Prefetch TTS for next queued sentence (background)
        ↓
agent.speak_ended fires
        ↓
drainQueue() — processes next item (prefetch likely already ready)
```

---

## 3. Project 1: Edura-AI-Avatar {#project-1}

### Backend (`edura_core/`)

| File | Change |
|------|--------|
| `app/routers/heygen.py` | Token uses `mode: "LITE"`, no `avatar_persona`; new `POST /heygen/tts`; new `GET /heygen/mode` diagnostic; ElevenLabs credits in `/heygen/available_credits` |
| `app/services/tts.py` | **NEW** — ElevenLabs TTS service, outputs raw PCM 24kHz base64 |
| `app/core/config.py` | Added `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` |
| `edura_core/.env` | Added ElevenLabs credentials, updated `LIVEAVATAR_API_KEY` |
| `requirements.txt` | Added `elevenlabs` package |

### Frontend (`ui/src/`)

| File | Change |
|------|--------|
| `services/HeyGenService.ts` | **Rewritten** for LITE mode: WebSocket audio commands, LiveKit video stream, LITE/FULL mode indicator |
| `services/ApiClient.ts` | Added `getTtsAudio(text, signal?)` — POST, supports AbortSignal |
| `hooks/useAvatarSession.ts` | **Rewritten** — serial speak queue + prefetch-1, `clearSpeakQueue()`, `onAvatarStopTalking` wired |
| `hooks/useLessonEngine.ts` | Added `ApiClient.getTtsAudio()` call before `avatarService.speak()` in lesson script execution |
| `pages/SessionPage.tsx` | Fixed raw text speak at line 118 → uses `speak()`; added `clearSpeakQueue()` call on mic interrupt |

### Key Files — What Each Does

**`tts.py`** — Called by the `/heygen/tts` endpoint:
```python
def synthesize_base64_pcm(text: str) -> str:
    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    audio_iter = client.text_to_speech.convert(
        text=text,
        voice_id=settings.ELEVENLABS_VOICE_ID,
        model_id=settings.ELEVENLABS_MODEL_ID,
        output_format="pcm_24000",   # 24kHz 16-bit mono — required by LiveAvatar LITE
    )
    pcm = b"".join(chunk for chunk in audio_iter if isinstance(chunk, bytes))
    return base64.b64encode(pcm).decode("utf-8")
```

**`HeyGenService.ts`** — LITE mode speak method:
```typescript
async speak(base64Audio: string): Promise<void> {
    // Guards: ws exists, wsReady flag, WebSocket.readyState === OPEN
    this.ws.send(JSON.stringify({ type: 'agent.speak', audio: base64Audio }));
    this.ws.send(JSON.stringify({ type: 'agent.speak_end', event_id: crypto.randomUUID() }));
}
```

**`useAvatarSession.ts`** — Serial queue with prefetch:
```
speak(text)          → enqueues, triggers drainQueue
drainQueue()         → fetches TTS (or uses prefetch), sends to avatar, starts next prefetch
onAvatarStopTalking  → releases lock, drains next item
clearSpeakQueue()    → aborts all in-flight fetches, flushes queue
```

---

## 4. Project 2: Edura_Homework_Module_Prototype {#project-2}

Uses Project 1's backend via `VITE_AVATAR_SERVICE_URL`. No separate backend changes needed.

### Frontend (`Frontend/`)

| File | Change |
|------|--------|
| `services/HeyGenService.ts` | **Rewritten** — same LITE mode implementation as Project 1 |
| `api/HeyGenApi.ts` | Added `getTtsAudio(text, signal?)` — POST, supports AbortSignal |
| `hooks/useSpeakQueue.ts` | **NEW** — reusable serial queue + prefetch-1 hook for components with raw `HeyGenService` refs |
| `pages/student/DoubtClarification.tsx` | Wired `useSpeakQueue`: `enqueue` as `onSpeak`, `handleSpeechEnded` on service, `clearQueue` on stop/disconnect |
| `pages/student/Grades.tsx` | Same as DoubtClarification |

### `useSpeakQueue` Hook

Because Project 2 components manage `HeyGenService` directly (as a `useRef`) rather than through `useAvatarSession`, a standalone hook was created:

```typescript
const { enqueue, clearQueue, handleSpeechEnded } = useSpeakQueue(avatarService);

// After creating new HeyGenService instance:
avatarService.current.onAvatarStopTalking = handleSpeechEnded;

// As the chat onSpeak callback:
onSpeak: (text) => enqueue(text)

// On stop / disconnect / interrupt:
clearQueue();
```

---

## 5. All New & Modified Endpoints {#endpoints}

### Backend (`edura_core`)

#### `POST /api/heygen/token`
**Changed** — now requests LITE mode from LiveAvatar.

Request to LiveAvatar (internal):
```json
{ "mode": "LITE", "avatar_id": "<avatar_id>" }
```
Previously included `avatar_persona.voice_id`. Removed in LITE mode.

Response to frontend (unchanged shape):
```json
{ "data": { "session_token": "...", "session_id": "..." } }
```

---

#### `POST /api/heygen/tts` *(NEW)*
Converts text to base64-encoded raw PCM audio via ElevenLabs. Used by the frontend before every `agent.speak` WebSocket command.

Request:
```json
{ "text": "Hello, how can I help you today?" }
```

Response:
```json
{ "audio_base64": "<base64_encoded_raw_pcm_24khz_16bit_mono>" }
```

Errors:
- `400` — empty text
- `500` — ElevenLabs API failure or credentials not configured

> **Format detail:** `pcm_24000` = raw PCM, 16-bit little-endian, 24kHz, mono. No WAV header. LiveAvatar LITE mode requires this exact format.

---

#### `GET /api/heygen/mode` *(NEW)*
Diagnostic endpoint. Confirms the system is running LITE mode.

Response:
```json
{
  "mode": "LITE",
  "avatar_id": "26393b8e-e944-4367-98ef-e2bc75c4b792",
  "tts_provider": "ElevenLabs",
  "tts_model": "eleven_flash_v2_5",
  "elevenlabs_configured": true,
  "avatar_persona_voice": null
}
```

---

#### `GET /api/heygen/available_credits`
**Modified** — now also returns ElevenLabs character usage (developer visibility, not shown in frontend UI).

Response:
```json
{
  "data": {
    "credits_left": "...",
    "elevenlabs": {
      "character_count": 12400,
      "character_limit": 100000,
      "characters_remaining": 87600,
      "tier": "starter"
    }
  }
}
```

---

#### Other endpoints (unchanged)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/heygen/active_sessions` | GET | List active LiveAvatar sessions |
| `/api/heygen/stop_all_sessions` | POST | Stop all tracked sessions (cleanup) |
| `/api/heygen/avatar_list` | GET | List available public + private avatars |

---

## 6. Fixes Applied {#fixes}

### Fix 1 — `Bearer undefined` on session start
**Cause:** `ApiClient.ts` read `json.session_token` but the response wraps it as `json.data.session_token`.
**Fix:** Changed to `json.data.session_token`.

### Fix 2 — Wrong LiveKit token field name
**Cause:** Session start response returns `livekit_client_token` but code looked for `livekit_token`.
**Fix:** `HeyGenService.ts` now reads `d.livekit_client_token ?? d.livekit_token` (fallback for both).

### Fix 3 — Credits showing 0
**Cause:** Old field `remaining_quota` was replaced with `credits_left` (a string) in the LiveAvatar API.
**Fix:** `parseFloat(response.credits_left) || 0`.

### Fix 4 — WebSocket connection timeout (10 seconds)
**Cause:** Code waited for a `session.state_updated` WebSocket message that LiveAvatar LITE never sends. It resolves immediately on connection open.
**Fix:** `_connectWebSocket()` resolves in `ws.onopen`, not on message receipt.

### Fix 5 — "error decoding base64 audio data" from LiveAvatar
**Cause:** `useLessonEngine.ts` called `avatarService.speak(text)` directly with raw text string (not base64 PCM audio). The lesson engine had its own speak path that bypassed the TTS fetch entirely.
**Fix:** Added `ApiClient.getTtsAudio()` call inside `useLessonEngine.executeCurrentAction()` before `avatarService.speak()`.

### Fix 6 — Avatar stops speaking after 3-4 sentences ("silent after a few responses")
**Cause:** `useChat.ts` and `useEnglishChat.ts` call `onSpeak()` fire-and-forget inside the LLM stream loop. Multiple TTS fetches ran in parallel. Multiple `agent.speak` WebSocket messages landed on LiveAvatar simultaneously before the previous speech finished. LiveAvatar's internal state got confused and stopped rendering.
**Fix:** Replaced fire-and-forget `onSpeak` calls with a serial speak queue. One item is fetched and spoken at a time. The next item only starts after `agent.speak_ended` fires.

### Fix 7 — Raw text speak in SessionPage.tsx
**Cause:** `SessionPage.tsx` line 118 called `avatarService.speak("Welcome back...")` directly — the raw `HeyGenService.speak()` method which expects base64 PCM, not text.
**Fix:** Changed to `speak("Welcome back...")` which routes through `useAvatarSession.speak()` → TTS fetch → `avatarService.speak(audio)`.

### Fix 8 — WebSocket send on closed socket
**Cause:** `HeyGenService.speak()` checked `wsReady` flag but not `WebSocket.readyState`. The flag could be `true` while the socket had already closed (network drop, server-side close).
**Fix:** Added explicit `this.ws.readyState !== WebSocket.OPEN` guard before sending. Sets `wsReady = false` if socket is not open.

### Fix 9 — TTS endpoint changed from GET to POST
**Cause:** Sending text as a URL query param (`?text=...`) is unprofessional and has length limits for long sentences.
**Fix:** Changed to `POST /api/heygen/tts` with JSON body `{ "text": "..." }`. Updated `ApiClient.ts` and `HeyGenApi.ts` accordingly.

---

## 7. Edge Cases & Race Conditions Tackled {#edge-cases}

### Race Condition: Parallel TTS fires
**Scenario:** LLM produces sentences S1, S2, S3 in quick succession. Three TTS fetches fire in parallel. All three `agent.speak` messages arrive at LiveAvatar before S1 finishes rendering.
**Solution:** Serial speak queue with `isQueueDrainingRef` lock. Only one item is fetched and sent at a time. The lock releases only on `agent.speak_ended`.

### Race Condition: Prefetch for stale item
**Scenario:** S2 is being prefetched. User interrupts. Queue is cleared. S3 is enqueued. drainQueue runs — prefetchRef still has S2's promise.
**Solution:** `clearSpeakQueue()` / `clearQueue()` calls `prefetchRef.current.abort.abort()` and sets `prefetchRef.current = null`. In `drainQueue`, if `prefetchRef.current?.text !== item.text`, the stale prefetch is aborted and discarded.

### Edge Case: Interrupt mid-TTS fetch
**Scenario:** User presses mic while ElevenLabs is fetching audio for the current sentence.
**Solution:** Every queue item has an `AbortController`. `clearSpeakQueue()` calls `item.abort.abort()` for all items. The `fetch()` in `ApiClient.getTtsAudio(text, signal)` is cancelled immediately. `drainQueue` catches the abort and skips to the next item (which is also aborted and skipped).

### Edge Case: Avatar disconnect during speech
**Scenario:** WebSocket closes mid-sentence (network issue, server restart, session timeout).
**Solution:** `HeyGenService.ws.onclose` fires → sets `wsReady = false`. In `DoubtClarification` and `Grades`, `onDisconnected` calls `clearQueue()`. In `useAvatarSession`, `stopSession()` also calls `clearSpeakQueue()`.

### Edge Case: Skip in lesson engine
**Scenario:** Teacher skips current script action. `avatarService.stopSpeaking()` sends `agent.interrupt`. This triggers `agent.speak_ended`. `handleAvatarEvent` checks `lessonEngine.state === RUNNING` → calls `onAvatarSpeechEnded()` → lesson advances.
**Why it works:** The lesson engine (SPEAK actions) does NOT use the speak queue. It has its own strictly sequential flow: `await getTtsAudio()` → `await avatarService.speak()` → wait for `agent.speak_ended` event. The speak queue is only for chat responses.

### Edge Case: Q&A interrupt during lesson
**Scenario:** User presses mic during lesson. `lessonEngine.interrupt()` sets state to `WAITING_FOR_INPUT` and sends `agent.interrupt`. The `agent.speak_ended` that fires is ignored by `handleAvatarEvent` because `state !== RUNNING`. User asks question. Chat hook fires `onSpeak` sentences into the speak queue. After answer, lesson resumes.
**Why it works:** `clearSpeakQueue()` is called before `lessonEngine.interrupt()` (wired in `handleMicToggle`). Any chat speech from the Q&A that was still in the queue is flushed. Lesson engine state machine controls whether `agent.speak_ended` advances the lesson or is ignored.

### Edge Case: Prefetch promise resolution ordering
**Scenario:** Prefetch for S2 is started. S1 finishes. `drainQueue` runs before prefetch resolves (slow ElevenLabs response). Item S2 is still at the head of the queue.
**Solution:** `drainQueue` awaits the prefetch promise — it will wait for it to resolve. If prefetch was fast, result is already in `.audio`. If slow, it waits. If aborted, falls back to a fresh fetch. No ordering issue.

### Edge Case: Multiple rapid user messages (chat)
**Scenario:** User sends 3 messages before the avatar finishes speaking responses.
**Solution:** All `onSpeak` sentences from all 3 LLM responses enqueue correctly. They are spoken in FIFO order. The queue correctly serializes across multiple LLM stream completions.

---

## 8. Current Phase of TTS Pipeline {#current-phase}

### Phase 1 — Serial Queue ✅ IMPLEMENTED
One sentence is fetched from ElevenLabs and spoken at a time. The next sentence waits for `agent.speak_ended` before starting. Eliminates the parallel-fire race condition entirely.

**Gap between sentences:** Still ~800–1500ms (ElevenLabs fetch time) unless prefetch covers it.

### Phase 2 — Prefetch-1 ✅ IMPLEMENTED
While the avatar is rendering sentence N, the backend TTS call for sentence N+1 is started in the background. When N finishes and the queue drains, the audio for N+1 is likely already ready.

**Gap between sentences (when prefetch hits):** Near zero — audio is pre-loaded.
**Gap when prefetch misses (first sentence, or after interrupt):** Still ~800–1500ms.

### Phase 3 — Streaming TTS ❌ NOT YET IMPLEMENTED
ElevenLabs supports streaming PCM output. Instead of waiting for the full audio before sending, the backend would stream chunks as they arrive and the frontend would send multiple `agent.speak` messages before `agent.speak_end`. This reduces cold-start latency by ~400–600ms per sentence.

**Current pipeline for first sentence:**
```
Sentence ready → POST /api/heygen/tts → wait for full PCM → agent.speak
                 └── ~800–1500ms ──────────────────────────┘
```

**With streaming TTS:**
```
Sentence ready → POST /api/heygen/tts (streaming)
                 → first chunk arrives ~200ms
                 → agent.speak (chunk 1)
                 → agent.speak (chunk 2) [while still receiving]
                 → agent.speak_end [when stream complete]
```

---

## 9. How to Reduce Latency Further {#latency}

### Current latency breakdown (per sentence)

| Stage | Typical time | Notes |
|-------|-------------|-------|
| LLM → first sentence boundary | 500–1500ms | Depends on OpenAI load and sentence length |
| `POST /api/heygen/tts` (ElevenLabs) | **800–1500ms** | Dominant bottleneck. Network + `eleven_flash_v2_5` inference |
| WebSocket send | ~5ms | Negligible |
| LiveAvatar decode + video render start | ~100–200ms | WebRTC pipeline |
| LiveKit → browser | ~100ms | WebRTC jitter buffer |
| **Total (cold sentence)** | **~1500–3200ms** | First sentence after user speaks |
| **Total (prefetch hit)** | **~600–1200ms** | Subsequent sentences with Phase 2 active |

### Option 1: Streaming TTS — Highest impact, medium effort

ElevenLabs returns chunks as they are synthesized. Send each chunk as a separate `agent.speak` message. LiveAvatar starts rendering immediately on the first chunk.

**Estimated gain: ~400–600ms off cold-start latency per sentence.**

Backend change:
```python
# StreamingResponse from FastAPI
async def text_to_speech_stream(body: TtsRequest):
    async def generate():
        audio_iter = client.text_to_speech.convert(
            text=body.text, output_format="pcm_24000", ...
        )
        for chunk in audio_iter:
            if isinstance(chunk, bytes):
                yield base64.b64encode(chunk).decode() + "\n"
    return StreamingResponse(generate(), media_type="text/plain")
```

Frontend change: read stream chunks, send each as `agent.speak`, send `agent.speak_end` when stream ends.

**Caution:** Streaming + prefetch combined adds significant complexity. Implement streaming first, verify interrupt/skip still work, then consider combining with prefetch.

### Option 2: Cache common phrases — Zero backend cost

Pre-generate and cache TTS audio for fixed phrases:
- Filler phrases: `"That is a great question!"`, `"Let me think about that..."`, etc.
- Welcome/resume message: `"Welcome back. Let's continue where we left off."`
- Lesson intros/outros that repeat across sessions

These are fetched from a static map instead of calling ElevenLabs. **Eliminates latency entirely for cached phrases.**

### Option 3: Reduce sentence accumulation threshold

`useChat.ts` and `useEnglishChat.ts` trigger `onSpeak` at sentence-ending punctuation. If the LLM produces long sentences (50+ chars before a `.`), the avatar waits longer before starting. Lowering the threshold (e.g. speak at commas for sentences > 40 chars) gives the avatar earlier audio with slightly more natural pauses.

**Estimated gain: 100–300ms off perceived response start.**

### Option 4: Backend keep-alive / connection pooling

The ElevenLabs HTTP connection is established fresh on each request. Using an HTTP connection pool (already handled by the `elevenlabs` Python SDK internally) and keeping the backend warm avoids cold-start TCP overhead.

### Option 5: Co-locate backend with ElevenLabs

If backend is deployed in a region far from ElevenLabs servers, network RTT adds to every TTS call. Deploy in `us-east-1` or `eu-west-1` to minimize RTT to ElevenLabs.

### Recommended implementation order

```
Today:      Phase 1 (serial queue) ✅ + Phase 2 (prefetch-1) ✅
Next:       Option 2 (cache filler phrases) — 1 hour of work, immediate gain
After that: Option 3 (sentence threshold tuning) — 30 minutes, quick test
Future:     Option 1 (streaming TTS) — 1–2 days, significant architectural change
```

---

## 10. How to Verify LITE Mode Is Active {#verify}

### Method 1: Diagnostic endpoint
```
GET /api/heygen/mode
```
Expected response:
```json
{
  "mode": "LITE",
  "tts_provider": "ElevenLabs",
  "elevenlabs_configured": true,
  "avatar_persona_voice": null
}
```

### Method 2: Browser console
On session start, look for:
```
[HeyGenService] MODE: LITE ✅ — ElevenLabs TTS + LiveAvatar video rendering
```
If you see `MODE: FULL (fallback)`, the session start response did not return a `ws_url` field — something is wrong with the token or LiveAvatar is not honoring the `mode: "LITE"` request.

### Method 3: Network tab (DevTools)
| Request | Present in LITE | Absent in LITE |
|---------|----------------|----------------|
| `POST /api/heygen/tts` | ✅ fires per sentence | — |
| WebSocket to `webrtc-signaling.heygen.io` | ✅ present | — |
| `avatar.speak_text` in LiveKit data channel | — | Was present in FULL |

### Method 4: Console logs per sentence
```
[useLessonEngine] Fetching TTS for: "Hello, welcome to today's lesson..."
[useAvatarSession] Prefetch STARTED for next sentence
[HeyGenService] Sent agent.speak + agent.speak_end  event_id=<uuid>
[HeyGenService][LITE] WebSocket event received: { type: "agent.speak_started" }
[HeyGenService][LITE] WebSocket event received: { type: "agent.speak_ended" }
[useAvatarSession] Prefetch HIT for sentence
```

---

## Environment Variables Reference

```env
# LiveAvatar
LIVEAVATAR_API_KEY=<your_key>
LIVEAVATAR_AVATAR_ID=<avatar_uuid>
LIVEAVATAR_VOICE_ID=<not_used_in_LITE_mode>

# ElevenLabs (TTS provider for LITE mode)
ELEVENLABS_API_KEY=<your_key>
ELEVENLABS_VOICE_ID=<voice_uuid>
ELEVENLABS_MODEL_ID=eleven_flash_v2_5   # fastest model

# Backend URL (Project 2 frontend)
VITE_AVATAR_SERVICE_URL=http://localhost:8000
```

---

*Last updated: 2026-04-02*
*Both projects: Edura-AI-Avatar, Edura_Homework_Module_Prototype*
