from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()

# Path to the session.json file
SESSION_FILE_PATH = os.path.join("app", "data", "session.json")

@router.get("/session")
async def get_session():
    """
    Returns the session.json file.
    """
    if os.path.exists(SESSION_FILE_PATH):
        return FileResponse(SESSION_FILE_PATH, media_type="application/json")
    else:
        return {"error": "Session file not found"}
