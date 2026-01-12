from fastapi import APIRouter, File, UploadFile, HTTPException
from app.core.config import settings
import shutil
import os
import uuid

router = APIRouter()

@router.get("/config")
async def get_config():
    return {
        "openai_model": settings.OPENAI_MODEL,
    }

@router.get("/config/background")
async def get_background():
    upload_dir = "app/data/backgrounds"
    if not os.path.exists(upload_dir):
        return {"url": None}
    
    files = os.listdir(upload_dir)
    # Filter for image files if needed, or just take the first one
    images = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))]
    
    if not images:
        return {"url": None}
        
    # Return the first found image
    return {"url": f"/api/media/backgrounds/{images[0]}"}

@router.post("/config/upload_background")
async def upload_background(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create directory if not exists
    upload_dir = "app/data/backgrounds"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Clean existing files
    for filename in os.listdir(upload_dir):
        file_path = os.path.join(upload_dir, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
        except Exception as e:
            print(f"Failed to delete {file_path}. Reason: {e}")

    # Generate unique filename to avoid caching issues with same name
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
    # Return URL path served by StaticFiles (mounted at /api/media)
    return {"url": f"/api/media/backgrounds/{filename}"}
