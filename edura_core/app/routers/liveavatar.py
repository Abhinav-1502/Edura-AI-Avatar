import base64
import requests
from fastapi import APIRouter, HTTPException
from app.core.config import settings

router = APIRouter()

LIVEAVATAR_API_URL = "https://api.liveavatar.com"
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"
SANDBOX_AVATAR_ID = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a"  # Wayne (sandbox only)

# In-memory store: session_id -> session_token (used for stop_all_sessions)
_active_sessions: dict = {}


@router.post("/liveavatar/token")
async def get_liveavatar_token():
    if not settings.LIVEAVATAR_API_KEY:
        raise HTTPException(status_code=500, detail="LIVEAVATAR_API_KEY not configured on server.")

    headers = {
        "X-API-KEY": settings.LIVEAVATAR_API_KEY,
        "Content-Type": "application/json"
    }

    avatar_id = SANDBOX_AVATAR_ID if settings.LIVEAVATAR_SANDBOX else settings.LIVEAVATAR_AVATAR_ID
    token_body = {
        "mode": "LITE",
        "avatar_id": avatar_id,
    }
    if settings.LIVEAVATAR_SANDBOX:
        token_body["is_sandbox"] = True

    try:
        token_resp = requests.post(
            f"{LIVEAVATAR_API_URL}/v1/sessions/token",
            headers=headers,
            json=token_body
        )
        token_resp.raise_for_status()
        token_data = token_resp.json().get("data", {})
        session_id = token_data.get("session_id")
        session_token = token_data.get("session_token")

        if not session_token:
            raise HTTPException(status_code=500, detail="No session_token in LiveAvatar response")

        _active_sessions[session_id] = session_token

        # Return the full LiveAvatar response — frontend calls /v1/sessions/start directly
        return token_resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get LiveAvatar session token: {str(e)}")


@router.post("/liveavatar/tts")
async def text_to_speech(body: dict):
    text = body.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if not settings.ELEVENLABS_API_KEY or not settings.ELEVENLABS_VOICE_ID:
        raise HTTPException(status_code=500, detail="ElevenLabs credentials not configured on server.")

    try:
        resp = requests.post(
            f"{ELEVENLABS_TTS_URL}/{settings.ELEVENLABS_VOICE_ID}",
            params={"output_format": "pcm_24000"},
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            },
            json={"text": text, "model_id": "eleven_turbo_v2_5"},
        )
        resp.raise_for_status()
        audio_b64 = base64.b64encode(resp.content).decode("utf-8")
        return {"data": {"audio": audio_b64}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs TTS failed: {str(e)}")


@router.get("/liveavatar/avatar_list")
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


@router.get("/liveavatar/active_sessions")
async def get_active_sessions():
    try:
        headers = {"X-API-KEY": settings.LIVEAVATAR_API_KEY}
        response = requests.get(f"{LIVEAVATAR_API_URL}/v1/sessions?type=active", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get active sessions: {str(e)}")


@router.post("/liveavatar/stop_all_sessions")
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


@router.get("/liveavatar/available_credits")
async def get_credits():
    if settings.LIVEAVATAR_SANDBOX:
        return {"data": {"credits_left": "999.00"}}
    try:
        headers = {"X-API-KEY": settings.LIVEAVATAR_API_KEY}
        response = requests.get(f"{LIVEAVATAR_API_URL}/v1/users/credits", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available credits: {str(e)}")
