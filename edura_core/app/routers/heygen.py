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
        "X-Api-Key": settings.HEYGEN_API_KEY
    }
    
    try:
        response = requests.post(f"{HEYGEN_API_URL}/v1/streaming.create_token", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get HeyGen token: {str(e)}")
