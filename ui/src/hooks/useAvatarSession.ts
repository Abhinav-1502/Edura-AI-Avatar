/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from 'react';
import { HeyGenService } from '../services/HeyGenService';
import { ApiClient } from '../services/ApiClient';
import { AvatarQuality, VoiceEmotion } from "@heygen/streaming-avatar";

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
    
    // We might get separate audio/video tracks or a single stream.
    // WebRTC ontrack usually gives a track and a stream.
    
    const startSession = useCallback(async (config: SessionConfig) => {
        try {
            console.log("Starting session with config:", config);
            const token = await ApiClient.getHeyGenToken();

            // Setup callbacks
            avatarService.onStreamReady = (stream) => {
                setRemoteStream(stream);
            };

            // Initialize and start
            await avatarService.initialize(token);
            
            await avatarService.startSession({
                quality: AvatarQuality.Low,
                avatarName: config.avatarCharacter,
                voice: {
                    voiceId: config.ttsVoice,
                    rate: 0.8,
                    emotion: VoiceEmotion.EXCITED,
                },
                language: 'en',
            });

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
        avatarService.close();
    }, [avatarService]);

    const speak = useCallback(async (text: string) => {
        if (!text) return;
        setIsSpeaking(true);
        try {
            // Note: voiceName passed here might be ignored by simple speak, 
            // unless we restart session or HeyGen allows dynamic voice.
            // For now, we just send text.
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

        // Cleanup existing instance if any
        if (recognitionRef.current) {
            isIntentionalStop.current = true;
            recognitionRef.current.stop();
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; 
        // Note: For better accuracy, ensure the lang matches the speaker.

        isIntentionalStop.current = false;

        recognition.onresult = (event: any) => {
            let fullTranscript = '';
            // We can check event.resultIndex, but regenerating the whole string is safer for simple inputs.
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
            // 'no-speech' is common, we ignore it and let onend restart if needed.
            // 'not-allowed' means permission denied.
            if (event.error === 'not-allowed') {
                 isIntentionalStop.current = true; // Stop trying
                 alert("Microphone access denied. Please allow microphone access.");
            }
        };
        
        recognition.onend = () => {
             if (!isIntentionalStop.current) {
                 console.log("Speech recognition ended unexpectedly (silence/network). Restarting...");
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
        avatarService // Expose the service instance
    };
};
