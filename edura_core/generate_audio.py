"""
Pre-generate TTS audio for all session scripts.

Reads each script JSON, synthesizes audio for every speech part (content, intro, outro),
saves PCM files to app/data/audio/<session_id>/, and updates the script JSON with audio paths.

Usage:
    cd edura_core
    python generate_audio.py
"""

import json
import os
import base64
import time

# Ensure imports work from edura_core/
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app.services.tts import synthesize_base64_pcm

DATA_DIR = "app/data"
AUDIO_DIR = os.path.join(DATA_DIR, "audio")
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved {path}")


def generate_and_save(text: str, out_path: str) -> str:
    """Synthesize TTS and save the raw PCM bytes to a file. Returns the relative path."""
    if os.path.exists(out_path):
        print(f"  SKIP (exists): {out_path}")
        return out_path

    audio_b64 = synthesize_base64_pcm(text)
    pcm_bytes = base64.b64decode(audio_b64)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(pcm_bytes)

    print(f"  SAVED: {out_path} ({len(pcm_bytes):,} bytes)")
    return out_path


def process_script(session_id: str, script_filename: str):
    script_path = os.path.join(DATA_DIR, script_filename)
    script_data = load_json(script_path)

    if isinstance(script_data, dict) and "script" in script_data:
        nodes = script_data["script"]
    elif isinstance(script_data, list):
        nodes = script_data
    else:
        print(f"  Skipping {script_filename} — unexpected format")
        return

    session_audio_dir = os.path.join(AUDIO_DIR, session_id)
    os.makedirs(session_audio_dir, exist_ok=True)

    total_chars = 0
    generated = 0

    for node in nodes:
        nid = node["id"]

        if node["type"] == "speech" and node.get("content"):
            text = node["content"]
            out_path = os.path.join(session_audio_dir, f"part_{nid}_speech.pcm")
            generate_and_save(text, out_path)
            node["audio"] = out_path
            total_chars += len(text)
            generated += 1

        elif node["type"] == "video":
            if node.get("intro"):
                out_path = os.path.join(session_audio_dir, f"part_{nid}_intro.pcm")
                generate_and_save(node["intro"], out_path)
                node["intro_audio"] = out_path
                total_chars += len(node["intro"])
                generated += 1

            if node.get("outro"):
                out_path = os.path.join(session_audio_dir, f"part_{nid}_outro.pcm")
                generate_and_save(node["outro"], out_path)
                node["outro_audio"] = out_path
                total_chars += len(node["outro"])
                generated += 1

    # Write updated script back
    if isinstance(script_data, dict):
        script_data["script"] = nodes
    else:
        script_data = nodes

    save_json(script_path, script_data)
    print(f"\n  Session '{session_id}': {generated} audio files, {total_chars:,} chars total\n")


def main():
    sessions_data = load_json(SESSIONS_FILE)
    sessions = sessions_data.get("sessions", [])

    print(f"Found {len(sessions)} sessions\n")

    for session in sessions:
        sid = session["id"]
        script_file = session.get("script")
        if not script_file:
            print(f"Skipping {sid} — no script file")
            continue

        print(f"Processing: {sid} ({script_file})")
        print("-" * 50)
        process_script(sid, script_file)

    print("=" * 50)
    print("Done! All script audio pre-generated.")


if __name__ == "__main__":
    main()
