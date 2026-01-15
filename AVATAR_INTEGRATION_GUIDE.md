# Avatar Integration Guide

This guide describes how to integrate the **HeyGen Interactive Avatar** into a React-based frontend dashboard. 
The integration consists of three main parts: 
1. **Avatar Service** (Video/Audio streaming)
2. **Backend API** (Token generation and LLM Chat)
3. **Chat Logic** (Orchestrating the conversation)

## 1. Architecture Overview

```mermaid
graph TD
    User[User Dashboard] -->|1. Request Token| API[Backend API]
    API -->|2. Get Access Token| HeyGen[HeyGen API]
    User -->|3. Initialize w/ Token| AvatarSDK[HeyGen Streaming SDK]
    AvatarSDK -->|4. WebRTC Stream| User
    
    User -->|5. Send Message| API
    API -->|6. Chat w/ Context| LLM[OpenAI / LLM]
    LLM -->|7. Stream Response| User
    
    User -->|8. Speak(Text)| AvatarSDK
```

## 2. Dependencies

You will need the official HeyGen Streaming Avatar SDK:

```bash
npm install @heygen/streaming-avatar
```

## 3. Core Components

### A. HeyGen Service Wrapper
Create a service class to handle the low-level SDK interactions. This keeps your React components clean.

**File:** `services/HeyGenService.ts`
*Reference implementation provided in current codebase.*

**Key Methods:**
- `initialize(token)`: Creates the SDK instance.
- `startSession(config)`: Starts the video stream with a specific avatar/voice.
- `speak(text)`: Makes the avatar say something.
- `stopSpeaking()`: Interrupts the avatar.
- `close()`: Cleans up the session.

### B. Backend API Client
You need an API Client to fetch the **Access Token** and communciate with your **LLM**.

**File:** `services/ApiClient.ts`

1.  **Get Token**: `POST /api/heygen/token` -> Return `{ data: { token: "..." } }`
    *   *Security Note:* Never store HeyGen API keys on the frontend. Always fetch a temporary access token from your backend.
2.  **Send Chat**: `POST /api/chat` -> Returns a **Streaming Response** (Server-Sent Events).

### C. Chat Hook (The "Brain")
Use a custom hook to manage the conversation state and streaming text.

**File:** `hooks/useChat.ts`

**Logic Flow:**
1.  **`sendMessage(text)`**: Appends user message to state and calls `ApiClient.sendChatRequest`.
2.  **Stream Handling**: Reads the stream from `response.body.getReader()`.
3.  **Sentence Detection**: As text arrives, accumulate it. When a full sentence is detected (e.g., ending in `.`, `?`, `!`), trigger the avatar to speak (`avatarService.speak(sentence)`).
    *   *Why?* Streaming sentences feels much faster than waiting for the whole paragraph to generate.

## 4. Integration Steps

### Step 1: Initialize the Session
In your main component (e.g., `DashboardAvatar.tsx`):

```typescript
useEffect(() => {
    async function init() {
        // 1. Get Token
        const token = await ApiClient.getHeyGenToken();
        
        // 2. Initialize Service
        const avatar = new HeyGenService();
        await avatar.initialize(token);

        // 3. Listen for Stream
        avatar.onStreamReady = (stream) => {
            // Attach to a <video> element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        };

        // 4. Start Session
        await avatar.startSession({
            quality: 'low', // 'high' or 'medium'
            avatarName: 'Avatar_ID', // e.g., 'Angela-inT-20220820'
            voice: { voiceId: 'Voice_ID' }
        });
    }
    init();
}, []);
```

### Step 2: Handle User Input (Microphone)
To support voice chat, use the browser's native capabilities for reliability and speed (no extra cost).

```typescript
// Simple Speech Recognition Wrapper
const startListening = () => {
    const Recognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        handleUserMessage(text);
    };
    
    recognition.start();
};
```

### Step 3: Connect Chat to Avatar
Wire the chat response to the avatar's mouth.

```typescript
// Inside your component
const { sendMessage } = useChat({
    onSpeak: (text) => avatarService.speak(text) // <--- Critical Link
});

const handleUserMessage = (text) => {
    // 1. Send to LLM
    sendMessage(text); 
};
```

## 5. Performance Tips
1.  **Latency**: Use `gpt-4o-mini` on the backend for sub-second response times.
2.  **Streaming TTS**: Do not wait for the full LLM response. Speak sentence-by-sentence.
3.  **Pre-connection**: If possible, initialize the session (`startSession`) in the background before the user opens the specific dashboard tab to minimize initial loading time (which can take 2-3 seconds).

