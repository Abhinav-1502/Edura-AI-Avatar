import requests
from fastapi import APIRouter, HTTPException
from app.core.config import settings

router = APIRouter()

LIVEAVATAR_API_URL = "https://api.liveavatar.com"

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

    body = {
        "mode": "FULL",
        "avatar_id": settings.LIVEAVATAR_AVATAR_ID,
        "avatar_persona": {
            "voice_id": settings.LIVEAVATAR_VOICE_ID,
            "language": "en"
        }
    }

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


@router.get("/heygen/available_credits")
async def get_credits():
    try:
        headers = {"X-API-KEY": settings.LIVEAVATAR_API_KEY}
        response = requests.get(f"{LIVEAVATAR_API_URL}/v1/users/credits", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available credits: {str(e)}")
