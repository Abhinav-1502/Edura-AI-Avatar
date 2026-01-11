import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    
    HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_ENDPOINT = os.getenv("OPENAI_ENDPOINT")
    OPENAI_DEPLOYMENT = os.getenv("OPENAI_DEPLOYMENT")
    
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "azure")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-nano")
    
    SEARCH_ENDPOINT = os.getenv("SEARCH_ENDPOINT")
    SEARCH_KEY = os.getenv("SEARCH_KEY")
    
    SEARCH_INDEX = os.getenv("SEARCH_INDEX")
    
    SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are an AI assistant that helps people find information.")

settings = Settings()
