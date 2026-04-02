"""
ElevenLabs TTS service for LiveAvatar LITE mode.

Outputs raw PCM 16-bit 24 kHz (mono) as a base64-encoded string.
LiveAvatar LITE mode requires exactly this format for agent.speak commands.
"""

import base64
import os

from app.core.config import settings


def synthesize_base64_pcm(text: str) -> str:
    """
    Convert text → ElevenLabs PCM 24 kHz → base64 string.

    Returns a base64-encoded string of raw PCM bytes (16-bit, 24000 Hz, mono).
    Each ~1-second chunk is ~48 000 bytes raw / ~64 000 chars base64.
    """
    from elevenlabs import ElevenLabs

    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    if not settings.ELEVENLABS_VOICE_ID:
        raise RuntimeError("ELEVENLABS_VOICE_ID is not configured")

    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    print(f"[TTS] Synthesizing {len(text)} chars  voice={settings.ELEVENLABS_VOICE_ID}  model={settings.ELEVENLABS_MODEL_ID}")

    audio_iter = client.text_to_speech.convert(
        text=text,
        voice_id=settings.ELEVENLABS_VOICE_ID,
        model_id=settings.ELEVENLABS_MODEL_ID,
        output_format="pcm_24000",   # 24 kHz 16-bit mono — required by LiveAvatar LITE
    )

    pcm_bytes = b"".join(chunk for chunk in audio_iter if isinstance(chunk, bytes))
    print(f"[TTS] PCM bytes={len(pcm_bytes)}  base64_chars={len(base64.b64encode(pcm_bytes))}")

    return base64.b64encode(pcm_bytes).decode("utf-8")
