/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from 'react';
import { HeyGenService } from '../services/HeyGenService';
import { ApiClient } from '../services/ApiClient';

export interface SessionConfig {
    ttsVoice: string;
    avatarCharacter: string;
    avatarBackgroundColor?: string;
}

export const useAvatarSession = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [avatarService] = useState(() => new HeyGenService());
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const startSession = useCallback(async (_config: SessionConfig) => {
        try {
            // Avatar and voice are configured server-side in the session token.
            // _config.avatarCharacter and _config.ttsVoice are no longer used here.
            const token = await ApiClient.getHeyGenToken();

            // Setup callbacks before connecting (startSession triggers the LiveKit connection)
            avatarService.onStreamReady = (stream) => {
                setRemoteStream(stream);
            };

            // Step 1: fetch LiveKit credentials
            await avatarService.initialize(token);

            // Step 2: connect to LiveKit room
            await avatarService.startSession();

            setIsSessionActive(true);

        } catch (error) {
            console.error("[USEAVATARSERVICE] Failed to start session:", error);
            setIsSessionActive(false);
            throw error;
        }
    }, [avatarService]);

    const stopSession = useCallback(async () => {
        setIsSessionActive(false);
        setRemoteStream(null);
        await avatarService.stopSpeaking();
        await avatarService.stopListening();
        await avatarService.close();
    }, [avatarService]);

    const speak = useCallback(async (text: string) => {
        if (!text) return;
        setIsSpeaking(true);
        try {
            await avatarService.speak(text);
        } catch (e) {
            console.error("[USEAVATARSERVICE] Speak error:", e);
        } finally {
            setIsSpeaking(false);
        }
    }, [avatarService]);

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
        await avatarService.stopSpeaking();
        setIsSpeaking(false);
    }, [avatarService]);

    return {
        isSessionActive,
        isSpeaking,
        remoteStream,
        startSession,
        stopSession,
        speak,
        startRecognition,
        stopRecognition,
        stopSpeaking,
        avatarService
    };
};
