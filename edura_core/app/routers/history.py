from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
from datetime import datetime
from typing import List

router = APIRouter()

HISTORY_FILE = os.path.join("app", "data", "history.json")

class SessionHistory(BaseModel):
    id: str
    sessionId: str
    completedParts: int = 0
    postedHomework: bool = False
    createdAt: str # ISO String

    class Config:
        arbitrary_types_allowed = True

@router.post("/history")
async def save_history(history: SessionHistory):
    try:
        # Load existing history
        data = []
        if os.path.exists(HISTORY_FILE):
             try:
                 with open(HISTORY_FILE, "r") as f:
                     content = f.read()
                     if content:
                        data = json.loads(content)
             except json.JSONDecodeError:
                 data = []  # Reset if corrupt
        
        # Append new entry
        data.append(history.dict())
        
        # Save back
        with open(HISTORY_FILE, "w") as f:
            json.dump(data, f, indent=2)
            
        return {"status": "success", "message": "History saved"}
    except Exception as e:
        print(f"Error saving history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_all_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                 return json.load(f)
        except:
             return []
    return []

@router.get("/history/{session_id}")
async def get_session_history(session_id: str):
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                 data = json.load(f)
                 # Filter by sessionId
                 results = [h for h in data if h['sessionId'] == session_id]
                 return results
        except:
             return []
    return []
