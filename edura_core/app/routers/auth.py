from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
from app.core.config import settings

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/auth/login")
async def login(request: LoginRequest):
    # Proxy to HW API
    url = f"{settings.HW_API_URL}/api/login"
    
    try:
        # Include API Key if available, though login is typically public
        headers = {}
        if settings.HW_API_KEY:
            headers["x-api-key"] = settings.HW_API_KEY
            
        payload = {
            "email": request.email,
            "password": request.password
        }
            
        response = requests.post(url, json=payload, headers=headers)
        
        # Forward error
        if response.status_code != 200:
            # Try to return the upstream error details
            try:
                error_detail = response.json()
            except:
                error_detail = response.text
            raise HTTPException(status_code=response.status_code, detail=error_detail)
            
        return response.json()
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to auth provider: {str(e)}")
