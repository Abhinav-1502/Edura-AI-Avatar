from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict
from app.services.llm import get_llm_service

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = [] # Optional client-provided history

@router.post("/chat")
async def english_chat(request: ChatRequest):
    llm_service = get_llm_service()
    
    # 1. Specialized System Prompt
    system_prompt = """
You are a helpful and knowledgeable English teacher. 
Your goal is to clarify the student's doubts about English grammar, vocabulary, literature, or writing.
Keep your answers concise (strictly under 50 words) and easy to understand.
If the question is unrelated to English, politely steer the student back to the subject.
"""
    
    # 2. Combine client history with current message
    client_messages = [m for m in request.history if m.get('role') != 'system']
    messages = client_messages + [{"role": "user", "content": request.message}]
    
    # 3. Generate Response
    return StreamingResponse(
        llm_service.generate_conversational_response(
            system_prompt=system_prompt.strip(),
            messages=messages
        ),
        media_type="text/event-stream"
    )
