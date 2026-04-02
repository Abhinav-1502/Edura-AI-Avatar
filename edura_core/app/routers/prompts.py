from fastapi import APIRouter
from app.prompt import SYSTEM_PROMPT_TEMPLATE

router = APIRouter()

@router.get("/get-system-prompt")
async def get_system_prompt():
    return {"systemPrompt": SYSTEM_PROMPT_TEMPLATE}
