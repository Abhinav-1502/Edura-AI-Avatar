/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAvatarSession } from '../hooks/useAvatarSession';
import { useChat } from '../hooks/useChat';
import { ApiClient } from '../services/ApiClient';
import { SessionPlayer } from '../components/SessionPlayer';
import type { Session } from '../types/session'; // Note: Using existing type or need to unify with models/session
import { LessonState, useLessonEngine } from '../hooks/useLessonEngine';
import '../styles/App.css';

// Using `any` for config temporarily as it's passed from App
interface SessionPageProps {
    config: any; 
}

const EMPTY_SCRIPT: any[] = [];

// Filler phrases for voice interaction
const FILLER_PHRASES = [
    "That is a great question! Give me a moment to think to provide a good answer.",
    "Hmm, let me think about that for a second and give me a moment to think.",
    "Good point! Here is what I think. Give me a moment to think.",
    "Let's see... Give me a moment to think.",
    "Interesting question. Give me a moment to think.",
    "I'm glad you asked that. Give me a moment to think.",
    "Okay, let me explain. Give me a moment to think."
];

export const SessionPage: React.FC<SessionPageProps> = ({ config }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // 4. Session Data State
    const [sessionData, setSessionData] = useState<Session | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);
    const [inputText, setInputText] = useState('');

    const { 
        remoteStream, 
        startSession, 
        stopSession, 
        speak,
        startRecognition,
        stopRecognition,
        avatarService 
    } = useAvatarSession();

    // 2. Initialize Chat (handling User <-> LLM)
    const { 
        messages, 
        sendMessage, 
        clearMessages, 
        isLoading
    } = useChat({
        onSpeak: (text) => speak(text), 
        oydEnabled: config.oydEnabled
    });

    const credits: number = Number(localStorage.getItem('heygen_credits'));
    // Initialize Lesson Engine with Session Script
    const lessonEngine = useLessonEngine({
        script: sessionData?.script || EMPTY_SCRIPT,
        avatarService: avatarService, 
        voiceName: config.ttsVoice,
        onVideoPlay: async () => {
             console.log("SessionPage: Video started. Disconnecting avatar to save costs.");
             await stopSession();
        },
        onScriptComplete: () => {
             console.log("Lesson Complete");
             // Optional: Navigate to history or show summary
        }
    });

    // Handle Interruption
    useEffect(() => {
        if (isLoading && lessonEngine.state === LessonState.RUNNING) {
            lessonEngine.interrupt();
        }
    }, [isLoading, lessonEngine.state, lessonEngine]);

    // Handle Avatar Events
    const handleAvatarEvent = useCallback((e: any) => {
         let eventType = e?.Type || e?.eventName || e?.type;

         if (e && e.description) {
             if (typeof e.description === 'string') {
                 try {
                     const parsed = JSON.parse(e.description);
                     eventType = parsed.Type || parsed.eventName || eventType;
                 } catch {
                     if (e.description === "SwitchToIdle") eventType = "SwitchToIdle";
                     if (e.description === "TalkingStopped") eventType = "TalkingStopped";
                 }
             }
         }
         
         if (e?.Type === 'WebRTCEvent') {
             if (e.event?.eventType === 'EVENT_TYPE_TURN_END') {
                 eventType = 'TalkingStopped';
             }
         }

         if (eventType === 'TalkingStopped' || eventType === 'SwitchToIdle' || eventType === 'avatar_stop_talking') {
              if (lessonEngine.state === LessonState.RUNNING) {
                  lessonEngine.onAvatarSpeechEnded();
              } else if (lessonEngine.state === LessonState.ANSWERING) {
                  lessonEngine.signalAnswerComplete();
              }
          }
    }, [lessonEngine]);
    
    useEffect(() => {
        if (avatarService) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            avatarService.onAvatarEvent = handleAvatarEvent;
        }
    }, [avatarService, handleAvatarEvent]); 

    const handleMicToggle = async () => {
        console.log("handleMicToggle");
        if (isListening) {
            await stopRecognition();
            setIsListening(false);
            
            // Manual send on stop
            if (inputText.trim()) {
                handleSendMessage(inputText);
            }
        } else {
            // Interrupt immediately on start
            lessonEngine.interrupt();
            setInputText(''); // Clear previous text when starting new recording
            setIsListening(true);
            await startRecognition((text) => {
                // Update input field with real-time text
                // We rely on manual stop to send, so we just update UI here.
                setInputText(text); 
            });
        }
    };

    const handleSendMessage = async (text: string) => {
        setInputText(''); // Clear input
        // Transition to ANSWERING state to expect TTS
        lessonEngine.startAnswering();

        // 1. Speak filler phrase immediately
        if (avatarService) {
            const randomPhrase = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
            speak(randomPhrase);
        }

        // Inject Context
        const contextSlice = lessonEngine.getContextSlice();
        const messageWithContext = `[SYSTEM CONTEXT: ${JSON.stringify(contextSlice)}]\n\nUser Question: ${text}`;
        sendMessage(messageWithContext);
    };

    const handleVideoEnded = async () => {
        console.log("App: Video ended. Reconnecting avatar...");
        try {
            await startSession(config);
            console.log("App: Avatar reconnected. Resuming lesson.");
            lessonEngine.onVideoEnded();
        } catch (e) {
            console.error("Failed to restart avatar after video:", e);
        }
    };

    const initializationStarted = React.useRef(false);

    // Auto-start session for now logic similar to handleStartSession
    useEffect(() => {
        const initSession = async () => {
             if (initializationStarted.current) return;
             initializationStarted.current = true;

             if (credits < 1) {
                alert('You have no credits left. Please purchase more credits to continue.');
                navigate('/');
                return;
             }

             try {
                setLoadingSession(true);

                // Clear any history of sessions if the user has left the page
                
                await ApiClient.stopAllActiveSession();
                
                const session = await ApiClient.getSession(); 
                
                await startSession(config);
                setSessionData(session);
                
                setLoadingSession(false);
                // We don't verify strict equality with lessonEngine.startLesson() here 
                // because lessonEngine depends on sessionData which is state.
             } catch (e) {
                 console.error("Failed to init session", e);
                 alert("[SESSION PAGE] Failed to start session");
                 initializationStarted.current = false; // Reset on failure to allow retry if needed
                 setLoadingSession(false);
                 navigate("/");
             }
        };

        if (id) {
            initSession();
        }
        
        return () => {
            stopSession();
        };  
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, navigate, credits]); // Run once on mount when ID is present

    // Trigger lesson start when sessionData is ready
    useEffect(() => {
        if (sessionData && lessonEngine && lessonEngine.state === LessonState.IDLE) {
             lessonEngine.startLesson();
        }
    }, [sessionData, lessonEngine]);

    // Warn before closing tab/refreshing
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (remoteStream) {
                e.preventDefault(); 
                e.returnValue = ''; // Required for Chrome
                return ''; // Required for Legacy Browsers
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [remoteStream]);

    const handleStopSession = () => {
        stopSession();
        setIsListening(false);
        navigate("/");
    };

    return (
        <>
            {loadingSession && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    color: 'white',
                    flexDirection: 'column'
                }}>
                   <h2>Please wait for session to load...</h2>
                </div>
            )}
            <SessionPlayer 
                sessionActive={true}
                lessonState={lessonEngine.state}
                currentAction={lessonEngine.currentAction}
                remoteStream={remoteStream || undefined}
                messages={messages}
                isListening={isListening}
                isLoading={isLoading}
                sessionScript={sessionData?.script}
                onStartSession={() => {}} // Already started
                onStopSession={handleStopSession}
                onMicToggle={handleMicToggle}
                onClearChat={clearMessages}
                onSendMessage={handleSendMessage}
                onInterrupt={lessonEngine.interrupt}
                onSkip={lessonEngine.skip}
                onResume={lessonEngine.resume}
                onVideoEnded={handleVideoEnded}
                backgroundImageUrl={config.backgroundImageUrl}
                inputValue={inputText}
                onInputChange={setInputText}
            />
        </>
    );
};
