import base64
import os
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings
from app.services.tts import synthesize_base64_pcm

router = APIRouter()

LIVEAVATAR_API_URL = "https://api.liveavatar.com"
SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a"  # Wayne (sandbox only)

# In-memory store: session_id -> session_token (used for stop_all_sessions)
_active_sessions: dict = {}


@router.post("/heygen/token")
async def get_heygen_token():
    if not settings.LIVEAVATAR_API_KEY:
        raise HTTPException(status_code=500, detail="LIVEAVATAR_API_KEY not configured on server.")

    headers = {
        "X-API-KEY": settings.LIVEAVATAR_API_KEY,
        "Content-Type": "application/json"
    }

    # LITE mode: we supply our own TTS audio (ElevenLabs).
    # No avatar_persona / voice_id needed — LiveAvatar only renders video.
    avatar_id = SANDBOX_AVATAR_ID if settings.LIVEAVATAR_SANDBOX else settings.LIVEAVATAR_AVATAR_ID
    body = {
        "mode": "LITE",
        "avatar_id": avatar_id,
    }
    if settings.LIVEAVATAR_SANDBOX:
        body["is_sandbox"] = True

    try:
        response = requests.post(
            f"{LIVEAVATAR_API_URL}/v1/sessions/token",
            headers=headers,
            json=body
        )
        response.raise_for_status()
        data = response.json()
        # Store session token for later cleanup via stop_all_sessions
        inner = data.get("data", {})
        session_id = inner.get("session_id")
        session_token = inner.get("session_token")
        if session_id and session_token:
            _active_sessions[session_id] = session_token
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get LiveAvatar session token: {str(e)}")


class TtsRequest(BaseModel):
    text: str


@router.post("/heygen/tts")
async def text_to_speech(body: TtsRequest):
    """
    Sarvam AI TTS endpoint for LiveAvatar LITE mode.
    Returns base64-encoded raw PCM 16-bit 24kHz mono audio.
    Frontend sends this audio to LiveAvatar via agent.speak WebSocket command.
    """
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")
    try:
        audio_base64 = synthesize_base64_pcm(body.text.strip())
        return {"audio_base64": audio_base64}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


class CachedAudioRequest(BaseModel):
    path: str


@router.post("/heygen/cached_audio")
async def get_cached_audio(body: CachedAudioRequest):
    """
    Serve pre-generated PCM audio as base64.
    The path comes from the script JSON's audio/intro_audio/outro_audio fields.
    """
    if not body.path:
        raise HTTPException(status_code=400, detail="path is required")

    if not os.path.isfile(body.path):
        raise HTTPException(status_code=404, detail=f"Audio file not found: {body.path}")

    with open(body.path, "rb") as f:
        pcm_bytes = f.read()

    return {"audio_base64": base64.b64encode(pcm_bytes).decode("utf-8")}


@router.get("/heygen/avatar_list")
async def get_avatar_list():
    try:
        headers = {"X-API-KEY": settings.LIVEAVATAR_API_KEY}
        public_resp = requests.get(f"{LIVEAVATAR_API_URL}/v1/avatars/public", headers=headers)
        public_resp.raise_for_status()
        user_resp = requests.get(f"{LIVEAVATAR_API_URL}/v1/avatars", headers=headers)
        user_resp.raise_for_status()
        public_avatars = public_resp.json().get("data", [])
        user_avatars = user_resp.json().get("data", [])
        return {"data": public_avatars + user_avatars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get avatar list: {str(e)}")


@router.get("/heygen/active_sessions")
async def get_active_sessions():
    try:
        headers = {"X-API-KEY": settings.LIVEAVATAR_API_KEY}
        response = requests.get(f"{LIVEAVATAR_API_URL}/v1/sessions?type=active", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get active sessions: {str(e)}")


@router.post("/heygen/stop_all_sessions")
async def stop_all_sessions():
    if not _active_sessions:
        return {"data": "No tracked sessions to stop"}

    stopped = []
    failed = []

    for session_id, session_token in list(_active_sessions.items()):
        try:
            resp = requests.post(
                f"{LIVEAVATAR_API_URL}/v1/sessions/stop",
                headers={"Authorization": f"Bearer {session_token}"}
            )
            if resp.status_code == 200:
                stopped.append(session_id)
                del _active_sessions[session_id]
            else:
                failed.append(session_id)
        except Exception:
            failed.append(session_id)

    return {"data": "Sessions stop attempted", "stopped": stopped, "failed": failed}


@router.get("/heygen/mode")
async def get_mode():
    """
    Diagnostic endpoint — confirms which LiveAvatar mode is configured.
    LITE mode: this backend provides TTS audio (Sarvam AI), LiveAvatar renders video only.
    """
    sarvam_configured = bool(settings.SARVAM_API_KEY)
    avatar_id = SANDBOX_AVATAR_ID if settings.LIVEAVATAR_SANDBOX else settings.LIVEAVATAR_AVATAR_ID
    return {
        "mode": "LITE",
        "sandbox": settings.LIVEAVATAR_SANDBOX,
        "avatar_id": avatar_id,
        "tts_provider": "Sarvam AI" if sarvam_configured else "NOT CONFIGURED",
        "tts_speaker": settings.SARVAM_SPEAKER,
        "tts_model": settings.SARVAM_MODEL,
    }


@router.get("/heygen/available_credits")
async def get_credits():
    if settings.LIVEAVATAR_SANDBOX:
        return {"data": {"credits_left": "999.00"}}
    try:
        # LiveAvatar credits
        la_headers = {"X-API-KEY": settings.LIVEAVATAR_API_KEY}
        la_resp = requests.get(f"{LIVEAVATAR_API_URL}/v1/users/credits", headers=la_headers)
        la_resp.raise_for_status()
        result = la_resp.json()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available credits: {str(e)}")
