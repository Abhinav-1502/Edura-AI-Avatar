from fastapi import APIRouter, HTTPException
import requests
import json
from app.core.config import settings
import os

router = APIRouter()
DATA_DIR = "app/data"
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")
SESSION_CHAPTER_MAP = {
    "prepositions_1001": 1,
    "nouns_1001": 2,
}

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r") as f:
        return json.load(f)

@router.get("/sessions")
async def get_sessions():
    data = load_json(SESSIONS_FILE)
    if not data:
        return {"sessions": []}
    return data["sessions"]

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    data = load_json(SESSIONS_FILE)
    if not data:
         raise HTTPException(status_code=404, detail="Sessions data not found")
    
    session = next((s for s in data["sessions"] if s["id"] == session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    script_filename = session.get("script")
    if not script_filename:
        # If no script file is linked, return just session metadata (or empty script)
        session["script"] = []
        return session

    script_path = os.path.join(DATA_DIR, script_filename)
    script_data = load_json(script_path)
    
    if not script_data:
        # Script file missing or empty
        session["script"] = []
    else:
        # If script file contains { "script": [...] } structure, extract it.
        # Based on user request, "script attribute... will have name of json file".
        # Assume the file content is the script array or an object containing "script".
        # Let's inspect `script_data`. If it has "script" key, use it. Else use the data itself if list.
         if isinstance(script_data, dict) and "script" in script_data:
             session["script"] = script_data["script"]
         elif isinstance(script_data, list):
             session["script"] = script_data
         else:
             # Fallback
             session["script"] = []
             
    return session

@router.post("/sessions/post_homework/{session_id}")
async def post_homework(session_id: str):
    
    ## We are going to write the logic to post homework here
    chapter_id = SESSION_CHAPTER_MAP.get(session_id)

    if not chapter_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    ##/api/post_by_chapter/{chapter_id}

    response = requests.put(f"{settings.HW_API_URL}/api/post_by_chapter/{chapter_id}", headers={"x-api-key": settings.HW_API_KEY})

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    
    return {"message": "Homework posted successfully"}


@router.get("/check_hw")
async def check_hw_api():
    response = requests.get(f"{settings.HW_API_URL}/api/check_api", headers={"x-api-key": settings.HW_API_KEY})
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    
    return response.json()

    