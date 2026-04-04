"""
ElevenLabs TTS service — drop-in replacement for tts.py (Sarvam AI).

Outputs raw PCM 16-bit 24 kHz (mono) as a base64-encoded string,
exactly matching the format expected by LiveAvatar LITE mode.
"""

import base64
import requests
from app.core.config import settings

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"
MAX_CHARS_PER_REQUEST = 2500  # ElevenLabs practical per-request limit


def synthesize_base64_pcm(text: str) -> str:
    """
    Convert text → ElevenLabs PCM 24 kHz → base64 string.

    Returns a base64-encoded string of raw PCM bytes (16-bit, 24000 Hz, mono).
    Same interface as tts.py:synthesize_base64_pcm so callers can swap providers.
    """
    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    if not settings.ELEVENLABS_VOICE_ID:
        raise RuntimeError("ELEVENLABS_VOICE_ID is not configured")

    print(f"[TTS-EL] Synthesizing {len(text)} chars  voice={settings.ELEVENLABS_VOICE_ID}  model={settings.ELEVENLABS_MODEL}")

    chunks = _split_text(text, MAX_CHARS_PER_REQUEST)
    pcm_parts: list[bytes] = []

    for i, chunk in enumerate(chunks):
        resp = requests.post(
            f"{ELEVENLABS_TTS_URL}/{settings.ELEVENLABS_VOICE_ID}",
            params={"output_format": "pcm_24000"},
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "text": chunk,
                "model_id": settings.ELEVENLABS_MODEL,
            },
            timeout=30,
        )
        if not resp.ok:
            print(f"[TTS-EL] ElevenLabs API error {resp.status_code}: {resp.text}")
            resp.raise_for_status()

        # ElevenLabs returns raw PCM bytes directly (not JSON)
        pcm_parts.append(resp.content)
        if len(chunks) > 1:
            print(f"[TTS-EL] Chunk {i + 1}/{len(chunks)} done ({len(chunk)} chars)")

    pcm_bytes = b"".join(pcm_parts)
    result = base64.b64encode(pcm_bytes).decode("utf-8")
    print(f"[TTS-EL] Done — base64 length: {len(result)}")
    return result


def _split_text(text: str, max_len: int) -> list[str]:
    """Split text on sentence boundaries to stay within per-request char limit."""
    if len(text) <= max_len:
        return [text]

    chunks = []
    remaining = text
    while remaining:
        if len(remaining) <= max_len:
            chunks.append(remaining)
            break
        # Find the last sentence-ending punctuation within the limit
        cut = max_len
        for sep in ['. ', '! ', '? ', ', ']:
            idx = remaining[:max_len].rfind(sep)
            if idx > 0:
                cut = idx + len(sep)
                break
        chunks.append(remaining[:cut])
        remaining = remaining[cut:]
    return chunks
