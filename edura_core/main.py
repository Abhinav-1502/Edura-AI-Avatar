import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routers import chat, prompts, topics, session, config, heygen

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(prompts.router, prefix="/api", tags=["System"])
app.include_router(topics.router, prefix="/api", tags=["Topics"])
app.include_router(session.router, prefix="/api", tags=["Session"])
app.include_router(heygen.router, prefix="/api", tags=["HeyGen"])
app.include_router(config.router, prefix="/api", tags=["Config"])

# Mount the data directory to serve videos and other media
app.mount("/api/media", StaticFiles(directory="app/data"), name="media")

# Static files are no longer served by FastAPI as we moved to a React UI.
# The React app handles the frontend, and FastAPI serves as the API backend.

@app.get("/")
async def root():
    return {"message": "Edura Core API is running. interact with the UI at port 5173 (dev) or separate build."}


# Trigger reload for env update
