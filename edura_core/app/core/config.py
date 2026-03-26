import os
from dotenv import load_dotenv

load_dotenv()

class Settings:

    LIVEAVATAR_API_KEY = os.getenv("LIVEAVATAR_API_KEY")
    LIVEAVATAR_AVATAR_ID = os.getenv("LIVEAVATAR_AVATAR_ID")
    LIVEAVATAR_VOICE_ID = os.getenv("LIVEAVATAR_VOICE_ID")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    HW_API_KEY = os.getenv("HW_SERVER_API_KEY")
    HW_API_URL = os.getenv("HW_API_URL", "").replace("localhost", "host.docker.internal")


settings = Settings()
