import { useEffect, useState, useCallback } from 'react';
import { useAvatarSession } from './hooks/useAvatarSession';
import { useChat } from './hooks/useChat';
import { ApiClient } from './services/ApiClient';
import { SessionPlayer } from './components/SessionPlayer';
import type { Session } from './types/session';
import { LessonState, useLessonEngine } from './hooks/useLessonEngine';
import './styles/index.css';

interface Config {

    ttsVoice: string;
    avatarCharacter: string;
    avatarStyle: string;
    oydEnabled: boolean;
    continuousConversation: boolean;
}

const EMPTY_SCRIPT: any[] = [];

function App() {
    const [config] = useState<Config>({
        ttsVoice: import.meta.env.VITE_HEYGEN_VOICE_ID,
        avatarCharacter: import.meta.env.VITE_HEYGEN_AVATAR_ID,
        avatarStyle: import.meta.env.VITE_HEYGEN_AVATAR_STYLE,
        oydEnabled: false,
        continuousConversation: false
    } as unknown as Config);

    useEffect(() => {
        console.log("Config loaded:", config);
    }, []);

    const { 
        isSessionActive, 
        remoteStream, 
        startSession, 
        stopSession, 
        speak,
        startRecognition,
        stopRecognition,
        stopSpeaking,
        avatarService 
    } = useAvatarSession();

    const [isListening, setIsListening] = useState(false);

    // 2. Initialize Chat (handling User <-> LLM)
    const { 
        messages, 
        sendMessage, 
        clearMessages, 
        isLoading
    } = useChat({
        onSpeak: (text) => speak(text, config.ttsVoice), 
        oydEnabled: config.oydEnabled
    });

    const [isGuidedSessionActive, setIsGuidedSessionActive] = useState(false);

    // 4. Session Data State
    const [sessionData, setSessionData] = useState<Session | null>(null);

    // Initialize Lesson Engine with Session Script
    // Initialize Lesson Engine with Session Script
    const lessonEngine = useLessonEngine({
        script: sessionData?.script || EMPTY_SCRIPT,
        avatarService: avatarService, 
        voiceName: config.ttsVoice,
        onVideoPlay: async () => {
             console.log("App: Video started. Disconnecting avatar to save costs.");
             await stopSession();
        },
        onScriptComplete: () => {
             console.log("Lesson Complete");
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
         let eventData = e;

         // Check if 'description' needs parsing or is a simple string
         if (e && e.description) {
             if (typeof e.description === 'string') {
                 try {
                     // Try parsing as JSON first
                     const parsed = JSON.parse(e.description);
                     eventData = parsed;
                     eventType = parsed.Type || parsed.eventName || eventType;
                 } catch {
                     // If not JSON, treat description as the event type/name itself if meaningful
                     // Mapping simple strings to event types if known
                     if (e.description === "SwitchToIdle") eventType = "SwitchToIdle";
                     if (e.description === "TalkingStopped") eventType = "TalkingStopped";
                 }
             }
         }
         
         // Handle WebRTC events forwarded from AvatarService
         if (e?.Type === 'WebRTCEvent') {
             if (e.event?.eventType === 'EVENT_TYPE_TURN_END') {
                 eventType = 'TalkingStopped'; // Treat TurnEnd as TalkingStopped
             }
         }

         if (eventType === 'TalkingStopped' || eventType === 'SwitchToIdle' || eventType === 'avatar_stop_talking') {
              
              if (lessonEngine.state === LessonState.RUNNING) {
                  lessonEngine.onAvatarSpeechEnded();
              } else if (lessonEngine.state === LessonState.ANSWERING) {
                  lessonEngine.signalAnswerComplete();
              } else if (lessonEngine.state === LessonState.WAITING_FOR_INPUT) {
                  // waiting
              }
          }
    }, [lessonEngine, isLoading]);
    
    useEffect(() => {
        if (avatarService) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            avatarService.onAvatarEvent = handleAvatarEvent;
        }
    }, [avatarService, handleAvatarEvent]); 

    const handleMicToggle = async () => {
        if (isListening) {
            await stopRecognition();
            setIsListening(false);
        } else {
            setIsListening(true);
            await startRecognition((text) => {
                console.log("Recognized:", text);
                if (!config.continuousConversation) {
                     stopRecognition();
                     setIsListening(false);
                }
                handleSendMessage(text);
            });
        }
    };

    const handleStartSession = async () => {
         // Fetch the Guided Session
         try {
             setIsGuidedSessionActive(true);
             
             const session = await ApiClient.getSession();
             setSessionData(session);

             // Use loaded config
             await startSession(config);

             // Start the lesson engine
             lessonEngine.startLesson();

         } catch (e) {
             console.error("Failed to start session", e);
             alert("Failed to load session data");
             setIsGuidedSessionActive(false);
         }
    };

    const handleStopSession = () => {
        stopSession();
        setIsListening(false);
        setSessionData(null);
        setIsGuidedSessionActive(false);
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

const FILLER_PHRASES = [
    "That is a great question! Give me a moment to think to provide a good answer.",
    "Hmm, let me think about that for a second and give me a moment to think.",
    "Good point! Here is what I think. Give me a moment to think.",
    "Let's see... Give me a moment to think.",
    "Interesting question. Give me a moment to think.",
    "I'm glad you asked that. Give me a moment to think.",
    "Okay, let me explain. Give me a moment to think."
];

    const handleSendMessage = async (text: string) => {
        // Transition to ANSWERING state to expect TTS
        lessonEngine.startAnswering();

        // 1. Speak filler phrase immediately to reduce perceived latency
        if (avatarService) {
            const randomPhrase = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
            console.log("App: Speaking filler phrase:", randomPhrase);
            // We use 'speak' which sends text to Azure TTS. 
            // Note: If the LLM response comes back extremely fast, it might overlap or queue. 
            // Azure Avatar usually queues speech.
            speak(randomPhrase, config.ttsVoice);
        }

        // Inject Context
        const contextSlice = lessonEngine.getContextSlice();
        
        // We inject context into the user message for this turn
        const messageWithContext = `[SYSTEM CONTEXT: ${JSON.stringify(contextSlice)}]\n\nUser Question: ${text}`;
        sendMessage(messageWithContext);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1800px', margin: '0 auto' }}>
             <h1 style={{ textAlign: 'center', marginBottom: '30px', fontWeight: 300, fontSize: '2.5rem' }}>
                Eng Campus Avatar
             </h1>
             
             {!isGuidedSessionActive ? (
                 <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                     <div className="glass-panel" style={{ padding: '40px' }}>
                        <h2>Session on prepositions</h2>
                        <p>Experience an interactive lesson with video and speech.</p>
                        
                        <div style={{ 
                            margin: '30px auto', 
                            padding: '20px', 
                            background: 'rgba(255,255,255,0.05)', 
                            borderRadius: '12px',
                            textAlign: 'left',
                            maxWidth: '400px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <h3 style={{ marginTop: 0, fontSize: '1.2rem', color: '#ccc', marginBottom: '15px' }}>Current Configuration</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', fontSize: '1rem', color: '#fff' }}>
                                <span style={{ color: '#aaa' }}>Character:</span>
                                <strong>{config.avatarCharacter}</strong>
                                
                                <span style={{ color: '#aaa' }}>Style:</span>
                                <strong>{config.avatarStyle}</strong>
                                
                                <span style={{ color: '#aaa' }}>Voice:</span>
                                <strong>{config.ttsVoice}</strong>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '15px' }}>
                                Configured via <code>.env</code>
                            </p>
                        </div>

                        <button 
                            className="btn-primary" 
                            style={{ marginTop: '20px', fontSize: '1.2rem', padding: '15px 40px' }}
                            onClick={handleStartSession}
                        >
                            Start Guided Session
                        </button>
                     </div>
                 </div>
             ) : (
                 <SessionPlayer 
                    sessionActive={isGuidedSessionActive}
                    lessonState={lessonEngine.state}
                    currentAction={lessonEngine.currentAction}
                    remoteStream={remoteStream || undefined}
                    messages={messages}
                    isListening={isListening}
                    isLoading={isLoading}
                    sessionScript={sessionData?.script}
                    onStartSession={handleStartSession}
                    onStopSession={handleStopSession}
                    onMicToggle={handleMicToggle}
                    onClearChat={clearMessages}
                    onSendMessage={handleSendMessage}
                    onInterrupt={lessonEngine.interrupt}
                    onSkip={lessonEngine.skip}
                    onResume={lessonEngine.resume}
                    onVideoEnded={handleVideoEnded}
                 />
             )}
        </div>
    );
}

export default App;
