import requests
import json
import os

url = "http://localhost:8000/api/chat"
messages = [{"role": "user", "content": "Hello"}]
payload = {
    "messages": messages,
    "useSearch": False,
    "dataSources": []
}

print(f"Connecting to {url}...")
try:
    with requests.post(url, json=payload, stream=True) as r:
        print(f"Status: {r.status_code}")
        if r.status_code != 200:
            print(f"Error: {r.text}")
        else:
            print("--- Stream Start ---")
            for chunk in r.iter_content(chunk_size=None):
                if chunk:
                    # Print raw chunk with explicit newlines shown
                    print(f"CHUNK: {repr(chunk)}")
            print("--- Stream End ---")
except Exception as e:
    print(f"Connection failed: {e}")
