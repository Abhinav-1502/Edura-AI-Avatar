import requests
from fastapi import APIRouter, HTTPException
from app.core.config import settings

router = APIRouter()

HEYGEN_API_URL = "https://api.heygen.com"

@router.post("/heygen/token")
async def get_heygen_token():
    if not settings.HEYGEN_API_KEY:
        raise HTTPException(status_code=500, detail="HEYGEN_API_KEY not configured on server.")

    headers = {
        "x-api-key": settings.HEYGEN_API_KEY
    }
    
    try:
        response = requests.post(f"{HEYGEN_API_URL}/v1/streaming.create_token", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get HeyGen token: {str(e)}")

@router.get("/heygen/avatar_list")
async def get_avatar_list():
    try:
        headers = {
            "x-api-key": settings.HEYGEN_API_KEY
        }
        response = requests.get(f"{HEYGEN_API_URL}/v1/streaming/avatar.list", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get HeyGen avatar list: {str(e)}")


@router.get("/heygen/active_sessions")
async def get_active_sessions():
    try:
        headers = {
            "x-api-key": settings.HEYGEN_API_KEY
        }
        response = requests.get(f"{HEYGEN_API_URL}/v1/streaming.list", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get HeyGen active sessions: {str(e)}")


@router.post("/heygen/stop_all_sessions")
async def stop_all_sessions():
    try:
        headers = {
            "x-api-key": settings.HEYGEN_API_KEY
        }
        response = requests.get(f"{HEYGEN_API_URL}/v1/streaming.list", headers=headers)
        response.raise_for_status()
        sessionData = response.json()["data"]["sessions"]

        if not sessionData:
            return {"data": "No active sessions found"}

        stoppedSessions = []

        for session in sessionData:
            session_id = session["session_id"]
            response = requests.post(f"{HEYGEN_API_URL}/v1/streaming.stop", 
                headers=headers, 
                json={"session_id": session_id})
            if response.status_code == 200:
                stoppedSessions.append(session_id)
            else:
                raise HTTPException(status_code=500, detail=f"Failed to stop HeyGen active sessions: {str(response.json())}")
        return {"data": "All sessions stopped successfully", "stoppedSessions": stoppedSessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop HeyGen active sessions: {str(e)}")



@router.get("/heygen/available_credits")
async def get_credits():
    try:
        headers = {
            "x-api-key": settings.HEYGEN_API_KEY
        }
        response = requests.get(f"{HEYGEN_API_URL}/v2/user/remaining_quota", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get HeyGen available credits: {str(e)}")
