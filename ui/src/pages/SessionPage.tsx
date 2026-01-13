/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAvatarSession } from '../hooks/useAvatarSession';
import { useChat } from '../hooks/useChat';
import { ApiClient } from '../services/ApiClient';
import { SessionPlayer } from '../components/SessionPlayer';
import type { Session } from '../types/session'; 
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
    const location = useLocation();
    
    // Retrieve state from navigation (set by HomePage)
    const { resumePartId, isTracking: initialIsTracking = false } = location.state || {};

    // 4. Session Data State
    const [sessionData, setSessionData] = useState<Session | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);
    const [inputText, setInputText] = useState('');

    const [isTracking] = useState<boolean>(initialIsTracking);
    const [completedPartId, setCompletedPartId] = useState(resumePartId || 0);

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

    
    // Initialize Lesson Engine with Session Script
    const lessonEngine = useLessonEngine({
        script: sessionData?.script || EMPTY_SCRIPT,
        avatarService: avatarService, 
        onVideoPlay: async () => {
             console.log("SessionPage: Video started. Disconnecting avatar to save costs.");
             await stopSession();
        },

        // ON Successful Lesson Completion POST HOMEWORK
        onScriptComplete: async () => {
             console.log("Lesson Complete");
             
             // Wait briefly for UI to settle
             await new Promise(r => setTimeout(r, 500));

             const title = sessionData?.title || sessionData?.subject || "this session";
             if (window.confirm(`Congratulations, Do you want me to post the homework for ${title}?`)) {
                 try {
                     if (sessionData?.id) {
                         await ApiClient.postHomework(sessionData.id);
                         alert("Homework posted successfully!");
                     }
                 } catch (e) {
                     console.error("Failed to post homework", e);
                     alert("Failed to post homework.");
                 }
             }
             
            navigate('/');
        }
    });

    const [isPlayingResumeIntro, setIsPlayingResumeIntro] = useState(!!resumePartId);
    const hasSpokenResumeIntro = useRef(false);

    // Track completed parts based on lessonEngine actions
    useEffect(() => {
        if (isTracking && lessonEngine.currentPartId) {
             setCompletedPartId(lessonEngine.currentPartId);
        }
    }, [isTracking, lessonEngine.currentPartId]);

    // Perform Resume Intro Speech
    useEffect(() => {
        if (resumePartId && isPlayingResumeIntro && avatarService && remoteStream && !hasSpokenResumeIntro.current) {
            hasSpokenResumeIntro.current = true;
            // Delay slightly to ensure video/audio is ready
            setTimeout(() => {
                avatarService.speak("Welcome back. Let's continue where we left off from the last session.");
            }, 1000);
        }
    }, [resumePartId, isPlayingResumeIntro, avatarService, remoteStream]);

    // Trigger lesson start when sessionData is ready
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (sessionData && lessonEngine && lessonEngine.isReady && lessonEngine.state === LessonState.IDLE && !isPlayingResumeIntro) {
             let startActionIndex = 0;
             if (resumePartId) {
                 const foundIndex = lessonEngine.getStartActionIndexForPartId(resumePartId);
                 if (foundIndex >= 0) startActionIndex = foundIndex;
                 else console.warn("Could not find start index for Part ID:", resumePartId);
             }
             lessonEngine.startLesson(startActionIndex);
        }
    }, [sessionData, lessonEngine, resumePartId, isPlayingResumeIntro]);

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
              if (isPlayingResumeIntro) {
                  console.log("Resume intro finished");
                  setIsPlayingResumeIntro(false);
                  return;
              }

              if (lessonEngine.state === LessonState.RUNNING) {
                  lessonEngine.onAvatarSpeechEnded();
              } else if (lessonEngine.state === LessonState.ANSWERING) {
                  lessonEngine.signalAnswerComplete();
              }
          }
    }, [lessonEngine, isPlayingResumeIntro]);
    
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
            await lessonEngine.interrupt();
            // Wait for avatar to actually stop speaking (buffer)
            await new Promise(resolve => setTimeout(resolve, 1500));

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

    const initializationStarted = useRef(false);

    // Auto-start session for now logic similar to handleStartSession
    useEffect(() => {
        const initSession = async () => {
             if (initializationStarted.current) return;
             initializationStarted.current = true;

             const credits = await ApiClient.getHeyGenCredits();

             if (credits < 1) {
                alert('You have no credits left. Please purchase more credits to continue.');
                navigate('/');
                return;
             }

             try {
                setLoadingSession(true);

                // Clear any history of sessions if the user has left the page
                
                await ApiClient.stopAllActiveSession();
                
                if (!id) throw new Error("No Session ID provided");
                const session = await ApiClient.getSession(id); 
                
                await startSession(config);
                setSessionData(session);
                
                setLoadingSession(false);
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
    }, [id, navigate]); // Run once on mount when ID is present

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

    const handleStopSession = async () => {
        if (isTracking && sessionData) {
            // Save History
            try {
                await ApiClient.saveSessionHistory({
                    id: crypto.randomUUID(),
                    sessionId: sessionData.id || id || 'unknown', // Use ID from session if available
                    completedParts: completedPartId,
                    postedHomework: false,
                    createdAt: new Date().toISOString()
                });
                console.log("Session history saved");
            } catch (e) {
                console.error("Failed to save history", e);
            }
        }

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
                onPause={lessonEngine.pause}
                onResume={lessonEngine.resume}
                onVideoEnded={handleVideoEnded}
                backgroundImageUrl={config.backgroundImageUrl}
                inputValue={inputText}
                onInputChange={setInputText}
            />
        </>
    );
};
