from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/config")
async def get_config():
    return {
        "openai_model": settings.OPENAI_MODEL,
    }
