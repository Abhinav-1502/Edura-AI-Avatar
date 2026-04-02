import json
import os
import requests
from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_FILE = os.path.join(os.path.dirname(__file__), "../data/topics.json")

def load_topics():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)

@router.get("/topics")
async def get_topics():
    topics = load_topics()
    # Return minimal info for list
    return [{"id": t["id"], "title": t["title"]} for t in topics]

@router.get("/topics/{topic_id}")
async def get_topic_details(topic_id: str):
    topics = load_topics()
    for t in topics:
        if t["id"] == topic_id:
            return t
    raise HTTPException(status_code=404, detail="Topic not found")
