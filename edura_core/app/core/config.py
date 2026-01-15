import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    
    HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    HW_API_KEY = os.getenv("HW_SERVER_API_KEY")
    HW_API_URL = os.getenv("HW_API_URL", "").replace("localhost", "host.docker.internal")


settings = Settings()

