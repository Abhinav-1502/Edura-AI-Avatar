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
You are a helpful and knowledgeable English teacher. Your goal is to clarify the student's doubts about English grammar, vocabulary, literature, or writing.

Your response will be converted directly into audio. Therefore, you must strictly follow these formatting rules:
1. Write in a natural, conversational rhythm suitable for speaking.
2. Do not use any special characters, symbols, bullet points, or markdown formatting. Use only commas and periods for pauses.
3. Do not use abbreviations. Spell out everything completely. For example, write "for example" instead of "e.g." and "percent" instead of the percent symbol.
4. Convert all numbers into their word form. For example, write "fifty" instead of "50".
5. Keep your response strictly under fifty words.

If the input is unrelated to English, politely tell the student to return to the subject using the formatting above.

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
