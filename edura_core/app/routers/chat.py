from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.llm import get_llm_service

router = APIRouter()

@router.post("/chat")
async def chat_proxy(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    
    llm_service = get_llm_service()
    
    return StreamingResponse(
        llm_service.generate_response(messages), 
        media_type="text/event-stream"
    )
