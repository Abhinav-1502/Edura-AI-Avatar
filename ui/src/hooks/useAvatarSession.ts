/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import { HeyGenService } from '../services/HeyGenService';
import { ApiClient } from '../services/ApiClient';

export interface SessionConfig {
    ttsVoice: string;
    avatarCharacter: string;
    avatarBackgroundColor?: string;
}

interface QueueItem {
    text: string;
    abort: AbortController;
}

interface PrefetchItem {
    text: string;
    promise: Promise<string>;
    abort: AbortController;
}

export const useAvatarSession = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [avatarService] = useState(() => new HeyGenService());
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // ── Serial speak queue (Phase 1) + prefetch-1 (Phase 2) ───────────────────
    const speakQueueRef = useRef<QueueItem[]>([]);
    const isQueueDrainingRef = useRef(false);
    const prefetchRef = useRef<PrefetchItem | null>(null);
    // Stable ref so the onAvatarStopTalking closure always calls the latest drainQueue
    const drainQueueRef = useRef<() => void>(() => {});

    const drainQueue = useCallback(async () => {
        if (isQueueDrainingRef.current) return;
        if (speakQueueRef.current.length === 0) return;

        isQueueDrainingRef.current = true;
        const item = speakQueueRef.current[0]; // peek — don't pop until TTS succeeds

        try {
            let audio: string;

            // Phase 2: try prefetch hit first
            if (prefetchRef.current?.text === item.text) {
                const pf = prefetchRef.current;
                prefetchRef.current = null;
                try {
                    audio = await pf.promise;
                    console.log('[useAvatarSession] Prefetch HIT for sentence');
                } catch {
                    // Prefetch was aborted or failed — fall back to fresh fetch
                    if (item.abort.signal.aborted) {
                        speakQueueRef.current.shift();
                        isQueueDrainingRef.current = false;
                        drainQueueRef.current();
                        return;
                    }
                    audio = await ApiClient.getTtsAudio(item.text, item.abort.signal);
                }
            } else {
                // No prefetch for this item — cancel any stale prefetch
                if (prefetchRef.current) {
                    prefetchRef.current.abort.abort();
                    prefetchRef.current = null;
                }
                if (item.abort.signal.aborted) {
                    speakQueueRef.current.shift();
                    isQueueDrainingRef.current = false;
                    drainQueueRef.current();
                    return;
                }
                audio = await ApiClient.getTtsAudio(item.text, item.abort.signal);
            }

            // Re-check abort after the async TTS fetch completes
            if (item.abort.signal.aborted) {
                speakQueueRef.current.shift();
                isQueueDrainingRef.current = false;
                drainQueueRef.current();
                return;
            }

            speakQueueRef.current.shift(); // Commit: remove now that we have audio
            await avatarService.speak(audio); // Fast — just sends WS message, returns immediately
            setIsSpeaking(true);

            // Phase 2: while avatar renders item N, start fetching item N+1 in background
            if (speakQueueRef.current.length > 0) {
                const next = speakQueueRef.current[0];
                const ac = new AbortController();
                prefetchRef.current = {
                    text: next.text,
                    promise: ApiClient.getTtsAudio(next.text, ac.signal),
                    abort: ac,
                };
                console.log('[useAvatarSession] Prefetch STARTED for next sentence');
            }

            // Lock stays true — waiting for agent.speak_ended → onAvatarStopTalking → release

        } catch (e) {
            if (!item.abort.signal.aborted) {
                console.error('[useAvatarSession] Speak queue error:', e);
            }
            speakQueueRef.current.shift();
            isQueueDrainingRef.current = false;
            setIsSpeaking(false);
            drainQueueRef.current(); // Attempt next item
        }
    }, [avatarService]);

    // Keep ref in sync so the event callback always calls the latest closure
    drainQueueRef.current = drainQueue;

    // Wire onAvatarStopTalking once; uses ref so it always reaches the latest drainQueue
    useEffect(() => {
        avatarService.onAvatarStopTalking = () => {
            setIsSpeaking(false);
            isQueueDrainingRef.current = false;
            drainQueueRef.current();
        };
    }, [avatarService]);

    // Public speak: synchronous enqueue — returns immediately
    const speak = useCallback((text: string) => {
        if (!text.trim()) return;
        speakQueueRef.current.push({ text, abort: new AbortController() });
        drainQueueRef.current();
    }, []);

    // Clear queue on interrupt / skip / stop — aborts all in-flight TTS fetches
    const clearSpeakQueue = useCallback(() => {
        speakQueueRef.current.forEach(item => item.abort.abort());
        speakQueueRef.current = [];
        prefetchRef.current?.abort.abort();
        prefetchRef.current = null;
        isQueueDrainingRef.current = false;
        setIsSpeaking(false);
    }, []);

    const startSession = useCallback(async (_config: SessionConfig) => {
        try {
            // Avatar and voice are configured server-side in the session token.
            const token = await ApiClient.getHeyGenToken();

            avatarService.onStreamReady = (stream) => {
                setRemoteStream(stream);
            };

            await avatarService.initialize(token);
            await avatarService.startSession();
            setIsSessionActive(true);

        } catch (error) {
            console.error("[USEAVATARSERVICE] Failed to start session:", error);
            setIsSessionActive(false);
            throw error;
        }
    }, [avatarService]);

    const stopSession = useCallback(async () => {
        clearSpeakQueue();
        setIsSessionActive(false);
        setRemoteStream(null);
        await avatarService.stopSpeaking();
        await avatarService.stopListening();
        await avatarService.close();
    }, [avatarService, clearSpeakQueue]);

    const recognitionRef = useRef<any>(null);
    const isIntentionalStop = useRef(false);

    const startRecognition = useCallback(async (onRecognized: (text: string, isFinal: boolean) => void) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("SpeechRecognition not supported in this browser.");
            alert("Speech Recognition not supported. Please use Chrome or Safari.");
            return;
        }

        if (recognitionRef.current) {
            isIntentionalStop.current = true;
            recognitionRef.current.stop();
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        isIntentionalStop.current = false;

        recognition.onresult = (event: any) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                fullTranscript += event.results[i][0].transcript;
            }
            const isFinal = event.results[event.results.length - 1]?.isFinal || false;
            if (fullTranscript) {
                console.log("[STT] Recognized:", fullTranscript);
                onRecognized(fullTranscript, isFinal);
            }
        };

        recognition.onerror = (event: any) => {
            console.warn("Speech recognition error:", event.error);
            if (event.error === 'not-allowed') {
                isIntentionalStop.current = true;
                alert("Microphone access denied. Please allow microphone access.");
            }
        };

        recognition.onend = () => {
            if (!isIntentionalStop.current) {
                console.log("Speech recognition ended unexpectedly. Restarting...");
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Failed to restart recognition:", e);
                }
            } else {
                console.log("Speech recognition stopped intentionally.");
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error("Failed to start recognition:", e);
        }
    }, []);

    const stopRecognition = useCallback(async () => {
        isIntentionalStop.current = true;
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    }, []);

    const stopSpeaking = useCallback(async () => {
        clearSpeakQueue();
        await avatarService.stopSpeaking();
    }, [avatarService, clearSpeakQueue]);

    return {
        isSessionActive,
        isSpeaking,
        remoteStream,
        startSession,
        stopSession,
        speak,
        clearSpeakQueue,
        startRecognition,
        stopRecognition,
        stopSpeaking,
        avatarService
    };
};
