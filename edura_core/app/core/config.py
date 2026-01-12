import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    
    HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-nano")
    


settings = Settings()
