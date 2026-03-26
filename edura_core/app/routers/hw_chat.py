from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
from app.services.llm import get_llm_service, LLMService

router = APIRouter()

# In-memory session store (Not scalable, POC only)
# Structure: { session_id: { student_data: {}, context_prompt: "" } }
hw_sessions: Dict[str, Any] = {}

class StartSessionRequest(BaseModel):
    student_data: Dict[str, Any]
    grade_report: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = [] # Optional client-provided history

@router.post("/session/start")
async def start_hw_session(request: StartSessionRequest):
    session_id = str(uuid.uuid4())
    
    # Construct initial context from student data
    student_name = request.student_data.get("name", "Student")
    grade_report = request.grade_report or "No grade report available."
    
    # Create a system prompt specialized for this student
    system_prompt = f"""
You are a helpful and encouraging tutor for {student_name}.
You have access to their grade report: {grade_report}.
Use this context to help answer their questions about their grades, performance, and homework.
Be concise, friendly, and motivational.
make sure the answer is not too lon, keep it under 50 words and is easy to understand.
"""
    
    hw_sessions[session_id] = {
        "student_data": request.student_data,
        "grade_report": grade_report,
        "system_prompt": system_prompt.strip()
    }
    
    return {"session_id": session_id, "message": "Session started successfully"}

@router.post("/chat/{session_id}")
async def hw_chat(session_id: str, request: ChatRequest):
    session_data = hw_sessions.get(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    llm_service = get_llm_service()
    
    # Combine client history with current message
    # Filter out system messages from client if any (we provide the canonical system prompt)
    client_messages = [m for m in request.history if m.get('role') != 'system']
    
    # Add current user message
    # Note: If the client already adds the user message to history, checking duplication might be needed.
    # We'll assume 'history' is PAST messages, and 'message' is the NEW one.
    
    messages = client_messages + [{"role": "user", "content": request.message}]
    
    return StreamingResponse(
        llm_service.generate_conversational_response(
            system_prompt=session_data["system_prompt"],
            messages=messages
        ),
        media_type="text/event-stream"
    )

@router.delete("/session/{session_id}")
async def end_hw_session(session_id: str):
    if session_id in hw_sessions:
        del hw_sessions[session_id]
        return {"message": "Session ended and context cleared"}
    raise HTTPException(status_code=404, detail="Session not found")
