import { useState, useCallback } from 'react';
import { HeyGenService } from '../services/HeyGenService';
import { ApiClient } from '../services/ApiClient';
import { AvatarQuality, VoiceEmotion } from "@heygen/streaming-avatar";

export interface SessionConfig {

    ttsVoice: string;
    avatarCharacter: string;
    avatarStyle: string;
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
            console.error("Failed to start session:", error);
            alert("Failed to start session: " + (error as Error).message);
            setIsSessionActive(false);
        }
    }, [avatarService]);

    const stopSession = useCallback(async () => {
        setIsSessionActive(false);
        setRemoteStream(null);
        await avatarService.stopSpeaking();
        await avatarService.stopListening();
        avatarService.close();
    }, [avatarService]);

    const speak = useCallback(async (text: string, _voiceName: string) => {
        if (!text) return;
        setIsSpeaking(true);
        try {
            // Note: voiceName passed here might be ignored by simple speak, 
            // unless we restart session or HeyGen allows dynamic voice.
            // For now, we just send text.
            await avatarService.speak(text);
        } catch (e) {
            console.error("Speak error:", e);
        } finally {
            setIsSpeaking(false);
        }
    }, [avatarService]);

    const startRecognition = useCallback(async (onRecognized: (text: string) => void) => {
        // HeyGen handling of STT via voice chat.
        // We might need to handle 'user_stop' event in service to trigger onRecognized.
        // But here we just start listening.
        await avatarService.startListening();
        // Hook up user_stop or user_start event to onRecognized? 
        // HeyGen 'user_stop' usually contains the transcribed text.
        
        avatarService.onUserStopTalking = (text) => {
             console.log("User stopped talking:", text);
             if (text) onRecognized(text); 
        };
    }, [avatarService]);

    const stopRecognition = useCallback(async () => {
        await avatarService.stopListening();
    }, [avatarService]);

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
