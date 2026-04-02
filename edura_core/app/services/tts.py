"""
Sarvam AI TTS service for LiveAvatar LITE mode.

Outputs raw PCM 16-bit 24 kHz (mono) as a base64-encoded string.
LiveAvatar LITE mode requires exactly this format for agent.speak commands.
"""

import requests
from app.core.config import settings

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
MAX_CHARS_PER_REQUEST = 2500  # Sarvam v3 limit


def synthesize_base64_pcm(text: str) -> str:
    """
    Convert text → Sarvam AI PCM 24 kHz → base64 string.

    Returns a base64-encoded string of raw PCM bytes (16-bit, 24000 Hz, mono).
    """
    if not settings.SARVAM_API_KEY:
        raise RuntimeError("SARVAMAI_API_KEY is not configured")

    print(f"[TTS] Synthesizing {len(text)} chars  speaker={settings.SARVAM_SPEAKER}  model={settings.SARVAM_MODEL}")

    # Split text into chunks if it exceeds the per-request limit
    chunks = _split_text(text, MAX_CHARS_PER_REQUEST)
    all_audio_b64_parts = []

    for i, chunk in enumerate(chunks):
        resp = requests.post(
            SARVAM_TTS_URL,
            headers={
                "api-subscription-key": settings.SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "inputs": [chunk],
                "target_language_code": "en-IN",
                "speaker": settings.SARVAM_SPEAKER,
                "model": settings.SARVAM_MODEL,
                "output_audio_codec": "linear16",
                "speech_sample_rate": 24000,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        audio_b64 = data["audios"][0]
        all_audio_b64_parts.append(audio_b64)
        if len(chunks) > 1:
            print(f"[TTS] Chunk {i + 1}/{len(chunks)} done ({len(chunk)} chars)")

    # If single chunk, return directly; otherwise decode, concat, re-encode
    if len(all_audio_b64_parts) == 1:
        result = all_audio_b64_parts[0]
    else:
        import base64
        pcm_bytes = b"".join(base64.b64decode(part) for part in all_audio_b64_parts)
        result = base64.b64encode(pcm_bytes).decode("utf-8")

    print(f"[TTS] Done — base64 length: {len(result)}")
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
