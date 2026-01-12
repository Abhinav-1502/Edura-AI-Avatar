import { useState, useCallback } from 'react';
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
                    rate: 1.0,
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

    const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

    const startRecognition = useCallback(async (onRecognized: (text: string, isFinal: boolean) => void) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("SpeechRecognition not supported in this browser.");
            alert("Speech Recognition not supported. Please use Chrome or Safari.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening until stopped
        recognition.interimResults = true; // Enable partial results
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let fullTranscript = '';
            
            for (let i = 0; i < event.results.length; ++i) {
                fullTranscript += event.results[i][0].transcript;
            }

            // Check if errors or finality of last result matters, 
            // but for 'current session text' we just send the whole thing.
            // We pass false for isFinal usually unless strictly last? 
            // Actually isFinal in callback was used to trigger auto-send.
            // Since we are moving to manual, isFinal is less critical for control, 
            // but good for UI knowledge.
            // Let's rely on the last result's isFinal status for the flag.
            const isFinal = event.results[event.results.length - 1]?.isFinal || false;
            
            if (fullTranscript) {
                 onRecognized(fullTranscript, isFinal);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed') {
                 alert("Microphone access denied.");
            }
        };
        
        // Handle unexpected stop (e.g. silence timeout if not continuous, though explicit stop handles main case)
        recognition.onend = () => {
             console.log("Speech recognition ended");
             // If we wanted strictly continuous 'always on', we'd restart here unless manually stopped.
             // But existing logic treats 'stop' as manual or managed by parent.
        };

        recognition.start();
        setRecognitionInstance(recognition);
    }, []);

    const stopRecognition = useCallback(async () => {
        if (recognitionInstance) {
            recognitionInstance.stop();
            setRecognitionInstance(null);
        }
    }, [recognitionInstance]);

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
