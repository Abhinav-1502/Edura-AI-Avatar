from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/get-system-prompt")
async def get_system_prompt():
    return {"systemPrompt": settings.SYSTEM_PROMPT}
