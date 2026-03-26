# HeyGen → LiveAvatar Migration Guide

> **Why:** The HeyGen Interactive Avatar API was deprecated on March 30, 2025.
> Both projects now use the new **LiveAvatar API** (`https://api.liveavatar.com`) and
> the **`@heygen/liveavatar-web-sdk`** frontend package.

---

## Summary of What Changed

| Area | Old | New |
|---|---|---|
| API base URL | `https://api.heygen.com` | `https://api.liveavatar.com` |
| API key env var | `HEYGEN_API_KEY` | `LIVEAVATAR_API_KEY` |
| Frontend SDK | `@heygen/streaming-avatar` | `@heygen/liveavatar-web-sdk` + `livekit-client` |
| Session protocol | WebRTC via HeyGen SDK | LiveKit room + data channel events |
| Speak/Interrupt | SDK method calls | LiveKit `agent-control` topic events |
| Avatar ID format | String name (`Katya_Black_Suit_public`) | UUID (`26393b8e-e944-4367-98ef-e2bc75c4b792`) |
| Voice ID format | HeyGen voice UUID | LiveAvatar voice UUID |
| Token endpoint | `POST /v1/streaming.create_token` | `POST /v1/sessions/token` |
| Token response | `{ data: { token } }` | `{ code, data: { session_id, session_token }, message }` |
| Session start response | N/A (SDK-handled) | `{ code, data: { livekit_url, livekit_client_token, ... }, message }` |
| Avatar list | `GET /v1/streaming/avatar.list` | `GET /v1/avatars/public` + `GET /v1/avatars` |
| Stop session | `POST /v1/streaming.stop` (API key) | `POST /v1/sessions/stop` (Bearer session_token) |
| Credits endpoint | `GET /v2/user/remaining_quota` | `GET /v1/users/credits` |
| Credits field | `remaining_quota` | `credits_left` (string, parse with `parseFloat`) |

---

## Credentials

| Variable | Value | Where |
|---|---|---|
| `LIVEAVATAR_API_KEY` | `a7cef551-1a52-11f1-a99e-066a7fa2e369` | Backend `.env` |
| `LIVEAVATAR_AVATAR_ID` | `26393b8e-e944-4367-98ef-e2bc75c4b792` | Backend `.env` |
| `LIVEAVATAR_VOICE_ID` | `864a26b8-bfba-4435-9cc5-1dd593de5ca7` | Backend `.env` |

> Avatar: **Katya in Black Suit** — Voice: **Katya - IA**
> Avatar ID and Voice ID are now backend-only config. They are NOT in frontend `.env` files.

---

## Architecture: How Sessions Work Now

```
BEFORE:
  Frontend → GET /api/heygen/token → Backend → POST heygen.com/v1/streaming.create_token
  Frontend → StreamingAvatar SDK({ token }) → SDK handles WebRTC
  Frontend → avatar.speak(text) → SDK REST call to HeyGen

AFTER:
  Frontend → POST /api/heygen/token → Backend → POST liveavatar.com/v1/sessions/token
                                                  (body: mode=FULL, avatar_id, voice_id)
                                   ← { code, data: { session_id, session_token }, message }
  Frontend reads session_token from data.data.session_token
  Frontend → POST liveavatar.com/v1/sessions/start (Bearer session_token)
           ← { code, data: { livekit_url, livekit_client_token }, message }
  Frontend reads livekit_client_token from data.data.livekit_client_token
  Frontend → LiveKit Room.connect(livekit_url, livekit_client_token)
  Frontend → room.publishData({ event_type: "avatar.speak_text", text }) → avatar speaks
```

**Mode used:** `FULL` without `context_id`
- LiveAvatar does NOT manage the LLM (no auto-responses to user voice)
- The existing backend (OpenAI) continues handling all chat logic
- Frontend sends `avatar.speak_text` events to make the avatar speak streamed sentences

---

## Runtime Bugs Found and Fixed

These bugs were discovered during live testing and patched on top of the initial migration.

### Bug 1 — Session start: `authorization: Bearer undefined`

**File:** `Edura-AI-Avatar/ui/src/services/ApiClient.ts`

**Root cause:** The `/api/heygen/token` backend response is wrapped in a `data` envelope:
```json
{ "code": 1000, "data": { "session_id": "...", "session_token": "..." }, "message": "..." }
```
But the frontend was reading from the top level:
```ts
// WRONG — session_token does not exist at the top level
return json.session_token;  // → undefined → "Bearer undefined"

// CORRECT
return json.data.session_token;
```

**Also fixed:** `heygen.py` was calling `data.get("session_id")` / `data.get("session_token")` on the outer envelope instead of `data.get("data", {}).get("session_id")`. This meant `_active_sessions` stored `None` keys, breaking `stop_all_sessions`.

---

### Bug 2 — Session start: `livekit_client_token` not `livekit_token`

**File:** Both `HeyGenService.ts` files

**Root cause:** The `/v1/sessions/start` response wraps everything under `data` AND uses the field name `livekit_client_token`, not `livekit_token`:
```json
{ "code": 1000, "data": { "livekit_url": "wss://...", "livekit_client_token": "eyJ..." }, "message": "..." }
```
Original code destructured wrong names from the wrong level:
```ts
// WRONG
const { livekit_url, livekit_token } = await startResp.json();

// CORRECT
const startJson = await startResp.json();
const { livekit_url, livekit_client_token } = startJson.data;
this.livekitUrl = livekit_url;
this.livekitToken = livekit_client_token;
```

---

### Bug 3 — Credits display: always showed `0` / `NaN`

**Files:** `Edura-AI-Avatar/ui/src/pages/HomePage.tsx`, `SessionPage.tsx`

**Root cause 1 — wrong field name:** `getHeyGenCredits()` returns `{ credits_left: "10.00" }` but the component read `response.remaining_quota` (old HeyGen field name).

**Root cause 2 — string not parsed:** `credits_left` is a string. Comparing it with `< 1` always evaluates as `false` (object/string coercion). Must use `parseFloat`.

```ts
// WRONG (HomePage.tsx)
setCredits(response.remaining_quota);

// CORRECT
setCredits(parseFloat(response.credits_left) || 0);

// WRONG (SessionPage.tsx) — comparing whole object
const credits = await ApiClient.getHeyGenCredits();
if (credits < 1) { ... }

// CORRECT
const creditsData = await ApiClient.getHeyGenCredits();
const credits = parseFloat(creditsData?.credits_left) || 0;
if (credits < 1) { ... }
```

---

## Files Changed

### Project 1 — `Edura-AI-Avatar`

#### `edura_core/app/routers/heygen.py`
Complete rewrite.
- Base URL: `https://api.heygen.com` → `https://api.liveavatar.com`
- Auth header: `x-api-key` → `X-API-KEY`
- `/heygen/token`: POSTs to `/v1/sessions/token` with `{ mode: "FULL", avatar_id, avatar_persona }`. Reads `session_id` and `session_token` from `response.json().get("data", {})` and stores in `_active_sessions` dict for cleanup.
- `/heygen/avatar_list`: Calls both `/v1/avatars/public` and `/v1/avatars` and merges results.
- `/heygen/active_sessions`: Calls `/v1/sessions?type=active`.
- `/heygen/stop_all_sessions`: Uses stored `session_token` values as Bearer auth to stop each session.
- `/heygen/available_credits`: Calls `/v1/users/credits`.

#### `edura_core/app/core/config.py`
- `HEYGEN_API_KEY` → `LIVEAVATAR_API_KEY`
- Added `LIVEAVATAR_AVATAR_ID`, `LIVEAVATAR_VOICE_ID`

#### `edura_core/.env`
- Removed `HEYGEN_API_KEY=sk_V2_hgu_...`
- Added `LIVEAVATAR_API_KEY`, `LIVEAVATAR_AVATAR_ID`, `LIVEAVATAR_VOICE_ID`

#### `edura_core/.env.example`
Updated field names to match new config.

#### `ui/package.json`
- Removed: `@heygen/streaming-avatar`
- Added: `@heygen/liveavatar-web-sdk`, `livekit-client`

#### `ui/src/services/HeyGenService.ts`
Full rewrite. Now wraps `livekit-client` `Room` directly.

**Key method changes:**

| Method | Old behaviour | New behaviour |
|---|---|---|
| `initialize(token)` | Creates `StreamingAvatar({ token })` | Calls `POST /v1/sessions/start` → reads `startJson.data.livekit_url` + `startJson.data.livekit_client_token` |
| `startSession(config)` | `avatar.createStartAvatar(config)` | Creates `Room`, registers events, `room.connect(livekitUrl, livekitToken)` — config param ignored |
| `speak(text)` | `avatar.speak({ text, task_type })` | Publishes `avatar.speak_text` event to `agent-control` topic |
| `stopSpeaking()` | `avatar.interrupt()` | Publishes `avatar.interrupt` to `agent-control` |
| `startListening()` | `avatar.startVoiceChat()` | Publishes `avatar.start_listening` to `agent-control` |
| `stopListening()` | `avatar.closeVoiceChat()` | Publishes `avatar.stop_listening` to `agent-control` |
| `close()` | `avatar.stopAvatar()` | `POST /v1/sessions/stop` (Bearer session_token) + `room.disconnect()` |

**Server event mapping (received on `agent-response` topic):**

| Old SDK event | New `event_type` | Callback |
|---|---|---|
| `avatar_start_talking` | `avatar.speak_started` | `onAvatarStartTalking` |
| `avatar_stop_talking` | `avatar.speak_ended` | `onAvatarStopTalking` |
| `user_start` | `user.speak_started` | `onUserStartTalking` |
| `user_stop` | `user.speak_ended` | `onUserStopTalking` |
| `stream_ready` | `RoomEvent.TrackSubscribed` | `onStreamReady` |
| `stream_disconnected` | `RoomEvent.Disconnected` / `session.stopped` | `onDisconnected` |

#### `ui/src/hooks/useAvatarSession.ts`
- Removed imports of `AvatarQuality`, `VoiceEmotion` from `@heygen/streaming-avatar`
- `startSession()` no longer passes avatar/voice config (now baked into the backend token)
- Added `await` to `avatarService.close()`

#### `ui/src/services/ApiClient.ts`
- `getHeyGenToken()`: `json.session_token` → `json.data.session_token` (response is wrapped under `data`)

#### `ui/src/pages/HomePage.tsx`
- Credits: `response.remaining_quota` → `parseFloat(response.credits_left) || 0`

#### `ui/src/pages/SessionPage.tsx`
- Credits: destructure `creditsData` first, then `parseFloat(creditsData?.credits_left) || 0` before comparing

#### `ui/src/App.tsx`
- Removed `import.meta.env.VITE_HEYGEN_VOICE_ID` and `VITE_HEYGEN_AVATAR_ID` references
- `ttsVoice` and `avatarCharacter` now default to `''`

#### `ui/.env` and `ui/.env.example`
- Removed `VITE_HEYGEN_AVATAR_ID` and `VITE_HEYGEN_VOICE_ID`

---

### Project 2 — `Edura_Homework_Module_Prototype`

> Note: This project was originally `Edura_Homework_Module_Prototype-BETA` (wrong version). The correct version is `Edura_Homework_Module_Prototype`. All changes below apply to the correct version.

#### `Frontend/package.json`
- Removed: `@heygen/streaming-avatar`
- Added: `@heygen/liveavatar-web-sdk`, `livekit-client`

#### `Frontend/services/HeyGenService.ts`
Full rewrite — identical to Project 1's `HeyGenService.ts`. See above.

#### `Frontend/api/HeyGenApi.ts`
- `getHeyGenToken()`: `data.data.token` → `data.data.session_token`

#### `Frontend/pages/student/DoubtClarification.tsx`
- Removed `import { AvatarQuality } from "@heygen/streaming-avatar"`
- `startSession()` call simplified from passing `quality`, `avatarName`, `voice` config to just `await avatarService.current.startSession()`

#### `Frontend/pages/student/Grades.tsx`
- Same changes as `DoubtClarification.tsx`

#### `Frontend/.env`
- Removed `VITE_HEYGEN_AVATAR_ID` and `VITE_HEYGEN_VOICE_ID`

---

## Files NOT Changed

- `Frontend/hooks/useChat.ts` — calls `onSpeak(text)`, interface unchanged
- `Frontend/hooks/useEnglishChat.ts` — same
- All backend files in `Edura_Homework_Module_Prototype/backend/` — HeyGen is not called there
- All UI components that don't directly reference HeyGen SDK types

---

## After Pulling These Changes

### 1. Install new dependencies

```bash
# Project 1 frontend
cd Edura-AI-Avatar/ui
npm install

# Project 2 frontend
cd Edura_Homework_Module_Prototype/Frontend
npm install
```

### 2. Verify backend `.env`

Ensure `Edura-AI-Avatar/edura_core/.env` contains:
```
LIVEAVATAR_API_KEY=a7cef551-1a52-11f1-a99e-066a7fa2e369
LIVEAVATAR_AVATAR_ID=26393b8e-e944-4367-98ef-e2bc75c4b792
LIVEAVATAR_VOICE_ID=864a26b8-bfba-4435-9cc5-1dd593de5ca7
```

Project 2's avatar is served via the same Edura-AI-Avatar backend (`VITE_AVATAR_SERVICE_URL` in `Frontend/.env`), so no separate backend changes are needed for Project 2.

### 3. Sandbox testing (free, no credits)

During development, use the sandbox avatar to avoid consuming credits. Temporarily add `"is_sandbox": true` to the session token request body in `heygen.py` and use the sandbox avatar ID:
```
avatar_id: dd73ea75-1218-4ef3-92ce-606d5f7fbc0a  (Wayne — sandbox only)
```
Sessions are limited to ~1 minute in sandbox mode.

---

## LiveAvatar Dashboard

- Manage API keys, avatars, and voices: `https://app.liveavatar.com`
- API docs: `https://docs.liveavatar.com/reference`
- Full migration guide: `https://docs.liveavatar.com/docs/interactive-avatar-migration-guide`
