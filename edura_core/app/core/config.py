import os
from dotenv import load_dotenv

load_dotenv()

class Settings:

    LIVEAVATAR_API_KEY = os.getenv("LIVEAVATAR_API_KEY")
    LIVEAVATAR_AVATAR_ID = os.getenv("LIVEAVATAR_AVATAR_ID")
    LIVEAVATAR_VOICE_ID = os.getenv("LIVEAVATAR_VOICE_ID")
    LIVEAVATAR_SANDBOX = os.getenv("LIVEAVATAR_SANDBOX", "false").lower() in ("true", "1", "yes")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    SARVAM_API_KEY = os.getenv("SARVAMAI_API_KEY")
    SARVAM_SPEAKER = os.getenv("SARVAM_SPEAKER", "simran").lower()
    SARVAM_MODEL = os.getenv("SARVAM_MODEL", "bulbul:v3")

    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
    ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5")

    HW_API_KEY = os.getenv("HW_SERVER_API_KEY")
    HW_API_URL = os.getenv("HW_API_URL", "").replace("localhost", "host.docker.internal")


settings = Settings()
