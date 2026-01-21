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
/* eslint-disable @typescript-eslint/no-explicit-any */
import StreamingAvatar, { 
    AvatarQuality, 
    TaskType, 
    type StartAvatarRequest,
} from "@heygen/streaming-avatar";


export interface HeyGenConfig {
    quality?: AvatarQuality;
    knowledgeId?: string;
    disableIdleTimeout?: boolean;
}

export class HeyGenService {
    private avatar: StreamingAvatar | null = null;
    
    // private sessionData: any = null;
    
    // Callbacks
    public onAvatarStartTalking?: (headId: number) => void;
    public onAvatarStopTalking?: (headId: number) => void;
    public onUserStartTalking?: (text: string) => void;
    public onUserStopTalking?: (text: string) => void;
    public onStreamReady?: (stream: MediaStream) => void;
    public onDisconnected?: () => void;
    public onAvatarEvent?: (event: any) => void;

    private eventHandler = (event: any) => {
        // Notify generic handler
        if (this.onAvatarEvent) {
             this.onAvatarEvent(event);
        }

        switch (event.type) {
            case "avatar_start_talking":
                 if (this.onAvatarStartTalking) this.onAvatarStartTalking(event.detail?.id);
                 break;
            case "avatar_stop_talking":
                 if (this.onAvatarStopTalking) this.onAvatarStopTalking(event.detail?.id);
                 break;
            case "user_start":
                 if (this.onUserStartTalking) this.onUserStartTalking(event.detail?.text);
                 break;
            case "user_stop":
                 if (this.onUserStopTalking) this.onUserStopTalking(event.detail?.text);
                 break;
            case "stream_ready":
                 if (this.onStreamReady) this.onStreamReady(event.detail);
                 break;
            case "stream_disconnected":
                 if (this.onDisconnected) this.onDisconnected();
                 break;
        }
    }

    async initialize(token: string): Promise<void> {
        this.avatar = new StreamingAvatar({
            token: token
        });
        
        // Register events
        this.avatar.on("avatar_start_talking", (e) => this.eventHandler({type: "avatar_start_talking", detail: e}));
        this.avatar.on("avatar_stop_talking", (e) => this.eventHandler({type: "avatar_stop_talking", detail: e}));
        this.avatar.on("user_start", (e) => this.eventHandler({type: "user_start", detail: e}));
        this.avatar.on("user_stop", (e) => this.eventHandler({type: "user_stop", detail: e}));
        this.avatar.on("stream_ready", (e) => this.eventHandler({type: "stream_ready", detail: e.detail}));
        this.avatar.on("stream_disconnected", (e) => this.eventHandler({type: "stream_disconnected", detail: e.detail}));
    }

    async startSession(config: StartAvatarRequest): Promise<void> {
        if (!this.avatar) throw new Error("HeyGenService not initialized");
        try {
            await this.avatar.createStartAvatar(config);
        } catch (e) {
            console.error("Failed to start avatar:", e);
            throw e;
        }
    }

    async speak(text: string, taskType: TaskType = TaskType.REPEAT): Promise<void> {
        if (!this.avatar) throw new Error("HeyGenService not initialized");
        await this.avatar.speak({ text, task_type: taskType });
    }

    async stopSpeaking(): Promise<void> {
         if (!this.avatar) {
             console.warn("[HeyGenService] stopSpeaking called but service not initialized");
             return;
         }
         await this.avatar.interrupt();
    }

    async startListening(): Promise<void> {
        if (!this.avatar) throw new Error("[HeyGenService] onStartListening: HeyGenService not initialized");
        await this.avatar.startVoiceChat();
    }

    async stopListening(): Promise<void> {
        if (!this.avatar) throw new Error("[HeyGenService] onStopListening: HeyGenService not initialized");
        await this.avatar.closeVoiceChat();
    }

    async close(): Promise<void> {
        if (this.avatar) {
            await this.avatar.stopAvatar();
            this.avatar = null;
        }
    }


}




**Key Methods:**
- `initialize(token)`: Creates the SDK instance.
- `startSession(config)`: Starts the video stream with a specific avatar/voice.
- `speak(text)`: Makes the avatar say something.
- `stopSpeaking()`: Interrupts the avatar.
- `close()`: Cleans up the session.

### B. Backend API Client
You need an API Client to fetch the **Access Token** and communciate with your **LLM**.




1.  **Get Token**: `POST /api/heygen/token` -> Return `{ data: { token: "..." } }`
    *   *Security Note:* Never store HeyGen API keys on the frontend. Always fetch a temporary access token from your backend.
2.  **Send Chat**: `POST /api/chat` -> Returns a **Streaming Response** (Server-Sent Events).

### C. Chat Hook (The "Brain")
Use a custom hook to manage the conversation state and streaming text.

**File:** `hooks/useChat.ts`
import { useState, useCallback } from 'react';
import { ApiClient } from '../services/ApiClient';
import type { Message } from '../services/ApiClient';

const sentenceLevelPunctuations = ['.', '?', '!', ':', ';', '。', '？', '！', '：', '；'];
const byodDocRegex = new RegExp(/\[doc(\d+)\]/g);

interface UseChatProps {
    onSpeak: (text: string) => void;
    oydEnabled: boolean;
}

export const useChat = ({ onSpeak, oydEnabled }: UseChatProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [exampleText, setExampleText] = useState<string>('');
    
    // We need refs to access latest state in async callbacks if we were using closures, 
    // but here we just update state or triggers.

    const clearMessages = useCallback(async () => {
        const prompt = await ApiClient.getSystemPrompt();
        setMessages([{ role: 'system', content: prompt }]);
        setExampleText('');
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        // Add user message immediately
        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setExampleText('');
        
        setIsLoading(true);

        // const currentMessages = [...messages, userMsg]; // We separate presentation from logic sometimes
        // Actually 'messages' state might be stale here if we don't use functional update or ref.
        // But cleaner is to use the functional update pattern or just pass the array if we have it.
        // Wait, 'messages' from state is a dependency.
        
        // Prepare data sources
        const dataSources = oydEnabled ? [{}] : []; // Dummy if enabled, as per original code

        let assistantReply = '';
        let toolContent = '';
        let spokenSentence = '';

        try {
            // We need to fetch sys prompt if empty? Assume initialized.
            // Re-construct full conversation for API:
            // The API expects the full history including system prompt.
            // However, `messages` state might not be updated yet in this closure if we didn't add it to dependency.
            // Best to use a ref for messages or trust the 'messages' dependency is updated (creates new function).
            
            // Actually, we can just append the new message to the list we *know* we have.
            const payloadMessages = [...messages, userMsg];

            const response = await ApiClient.sendChatRequest(payloadMessages, dataSources, oydEnabled);
            
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            const processLine = (line: string) => {
                 if (!line.startsWith('data:')) return;
                 // Handle [DONE]
                 if (line.includes('[DONE]')) return;

                 try {
                     const jsonStr = line.substring(5).trim();
                     if (!jsonStr) return;
                     
                     const json = JSON.parse(jsonStr);
                     if (json.error) {
                         console.error("Backend LLM Stream Error:", json.error);
                         return;
                     }
                     const choice = json.choices?.[0];
                     
                     let token = '';
                     // OYD Check
                     if (choice?.messages?.[0]?.delta) {
                         const msg = choice.messages[0].delta;
                         if (msg.role === 'tool') {
                            toolContent = msg.content;
                         } else {
                             token = msg.content || '';
                             if (token && byodDocRegex.test(token)) token = token.replace(byodDocRegex, '').trim();
                         }
                     } else if (choice?.delta?.content) {
                         token = choice.delta.content;
                     }

                         if (token) {
                             assistantReply += token;

                             // Check for Example tag
                             const exampleMatch = assistantReply.match(/<<<EXAMPLE:([\s\S]*?)>>>/);
                             if (exampleMatch) {
                                  setExampleText(exampleMatch[1].trim());
                             } else {
                                 // Handle incomplete tag or start
                                 const startTag = "<<<EXAMPLE:";
                                 const startIndex = assistantReply.lastIndexOf(startTag);
                                 if (startIndex !== -1 && !assistantReply.includes(">>>", startIndex)) {
                                     // We are potentially inside an example tag, streaming it.
                                     // We can show partial content if we want, or wait.
                                     // Let's show partial for effect?
                                     // The regex above catches closed tags.
                                     // For streaming effect:
                                     const partialContent = assistantReply.substring(startIndex + startTag.length);
                                     setExampleText(partialContent);
                                 }
                             }
                             
                             // Update UI with partial message?
                         // Ideally we stream this to UI. 
                         // For simplicity, we can update state periodically or wait.
                         // But for "Chat" we want to see it typing.
                         // We'll update state at the end or use a separate "streamingMessage" state.
                         // Updating 'messages' constantly causes re-renders. 
                         // We can use a ref for the current assistant message and force update?
                         setMessages(prev => {
                             const last = prev[prev.length - 1];
                             if (last.role === 'assistant') {
                                 return [...prev.slice(0, -1), { ...last, content: assistantReply }];
                             } else {
                                 return [...prev, { role: 'assistant', content: assistantReply }];
                             }
                         });

                         // TTS Logic
                         if (['\n', '\n\n'].includes(token)) {
                             spokenSentence += token;
                             // Don't speak on newlines alone unless it forms a sentence
                             if (spokenSentence.trim().length > 0 && /[.?!;:]/.test(spokenSentence)) {
                                 onSpeak(spokenSentence);
                                 spokenSentence = '';
                             }
                         } else {
                             spokenSentence += token;
                             // Check for sentence delimiters more aggressively
                             if (/[.?!;:]/.test(token) || (spokenSentence.length > 50 && /[,—]/.test(token))) {
                                 const lastChar = spokenSentence.trim().slice(-1);
                                 // Basic heuristic: if it looks like the end of a sentence
                                 if (sentenceLevelPunctuations.includes(lastChar)) {
                                      if (spokenSentence.trim()) {
                                         onSpeak(spokenSentence);
                                         spokenSentence = '';
                                      }
                                 }
                             }
                         }
                     }
                 } catch (e) {
                     console.error("Parse error", e);
                 }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim()) {
                        // Residual
                         const parts = buffer.split('\n');
                         parts.forEach(part => processLine(part.trim()));
                    }
                    break;
                }
                
                const text = decoder.decode(value, { stream: true });
                buffer += text;
                const parts = buffer.split('\n');
                buffer = parts.pop() || '';
                parts.forEach(part => processLine(part.trim()));
            }

            if (spokenSentence.trim()) {
                onSpeak(spokenSentence);
            }
            
            // Final consistency update
            setMessages(prev => {
                const msgs = [...prev];
                // Should basically match assistantReply.
                // If toolContent exists, add it.
                if (toolContent) msgs.push({ role: 'tool', content: toolContent });
                return msgs;
            });

        } catch (e) {
            console.error("Chat error:", e);
            alert("Chat error: " + (e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [messages, oydEnabled, onSpeak]);

    return {
        messages,
        sendMessage,
        clearMessages,
        isLoading,
        exampleText,
        setMessages // Expose this to manually set context
    };
};


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

