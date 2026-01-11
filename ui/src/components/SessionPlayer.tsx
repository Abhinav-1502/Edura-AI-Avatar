import { useEffect, useRef } from 'react';
import type { LessonAction, LessonStateEnum } from '../hooks/useLessonEngine';
import { ActionType, LessonState } from '../hooks/useLessonEngine';
import { VideoPanel } from './VideoPanel';
import { ChatInput } from './ChatInput';
import { Controls } from './Controls';
import { VideoPlayerOverlay } from './VideoPlayerOverlay';
import type { Message, ScriptNode } from '../services/ApiClient';
import type { SessionPart } from '../types/session';

interface SessionPlayerProps {
    sessionActive: boolean;
    lessonState: LessonStateEnum;
    currentAction: LessonAction | undefined;
    remoteStream: MediaStream | undefined;
    messages: Message[];
    isListening: boolean;
    isLoading: boolean;
    sessionScript: SessionPart[] | undefined;
    onStartSession: () => void;
    onStopSession: () => void;
    onMicToggle: () => void;
    onClearChat: () => void;
    onSendMessage: (text: string) => void;
    onInterrupt: () => void;
    onResume: () => void;
    onSkip: () => void;
    onVideoEnded: () => void;
}

export const SessionPlayer = ({
    sessionActive,
    lessonState,
    currentAction,
    remoteStream,
    isListening,
    isLoading,
    sessionScript,
    onStartSession,
    onStopSession,
    onMicToggle,
    onClearChat,
    onSendMessage,
    onInterrupt,
    onResume,
    onSkip,
    onVideoEnded
}: SessionPlayerProps) => {
    
    const scriptContainerRef = useRef<HTMLDivElement>(null);

    let videoSrc: string | null = null;
    if (currentAction?.type === ActionType.VIDEO) {
        let path = currentAction.payload;
        if (path.startsWith('edura_core/app/data/')) {
            path = path.replace('edura_core/app/data/', '');
        }
        videoSrc = `/api/media/${path}`;
    }

    // Auto-scroll to current script item
    useEffect(() => {
        if (currentAction?.originalPart?.id && scriptContainerRef.current) {
            const el = document.getElementById(`script-part-${currentAction.originalPart.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentAction]);

    const showAvatar = sessionActive && (!currentAction || currentAction.type !== ActionType.VIDEO);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: sessionActive ? '2fr 1fr' : '1fr', gap: '20px', alignItems: 'start', height: 'calc(100vh - 100px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                <div style={{ position: 'relative', flex: 1, backgroundColor: '#000', borderRadius: '16px', overflow: 'hidden', minHeight: '400px' }}>
                    
                    {/* AVATAR LAYER */}
                    <div style={{ display: showAvatar ? 'block' : 'none', height: '100%' }}>
                         <VideoPanel stream={remoteStream} visible={true} />
                    </div>

                    {/* VIDEO PLAYER LAYER */}
                    {videoSrc && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
                            <VideoPlayerOverlay 
                                src={videoSrc} 
                                onEnded={onVideoEnded} 
                            />
                        </div>
                    )}
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                     <Controls 
                        sessionActive={sessionActive}
                        isListening={isListening}
                        onStartSession={onStartSession}
                        onStopSession={onStopSession}
                        onMicToggle={onMicToggle}
                        onClearChat={onClearChat}
                     />
                     
                     <ChatInput onSend={onSendMessage} disabled={isLoading || isListening} />
                     
                     <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                         {lessonState === LessonState.ANSWER_COMPLETE && (
                             <button 
                                className="btn-primary" 
                                style={{ background: '#10b981', fontSize: '0.9rem', padding: '8px 16px' }}
                                onClick={onResume}
                             >
                                Continue Lesson
                             </button>
                         )}
                         <button 
                            className="btn-primary" 
                            style={{ background: '#64748b', fontSize: '0.9rem', padding: '8px 16px' }}
                            onClick={onInterrupt}
                         >
                            Interrupt & Ask
                         </button>
                         <button 
                            className="btn-primary" 
                            style={{ background: '#3b82f6', fontSize: '0.9rem', padding: '8px 16px' }}
                            onClick={onSkip}
                         >
                            Skip
                         </button>
                     </div>
                </div>
            </div>
            
            {/* Session Script Panel */}
             <div className="glass-panel" style={{ padding: '20px', height: '100%', overflowY: 'auto' }} ref={scriptContainerRef}>
                <h3 style={{ marginBottom: '15px' }}>Session Script</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sessionScript?.map((part) => {
                        const isActive = currentAction?.originalPart?.id === part.id;
                        return (
                            <div 
                                key={part.id} 
                                id={`script-part-${part.id}`}
                                style={{ 
                                    padding: '10px', 
                                    borderRadius: '8px', 
                                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa', marginBottom: '4px' }}>
                                    {part.type.toUpperCase()} #{part.id}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: isActive ? '#fff' : '#ccc' }}>
                                    {part.type === 'speech' ? part.content : `[Video: ${part.path?.split('/').pop()}]`}
                                </div>
                                {part.type === 'video' && part.intro && (
                                    <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px', fontStyle: 'italic' }}>
                                        Intro: {part.intro.substring(0, 50)}...
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
