import { useEffect, useRef } from 'react';
import type { LessonAction, LessonStateEnum } from '../hooks/useLessonEngine';
import { ActionType, LessonState } from '../hooks/useLessonEngine';
import { VideoPanel } from './VideoPanel';
import { ChatInput } from './ChatInput';
import { Controls } from './Controls';
import { VideoPlayerOverlay } from './VideoPlayerOverlay';
import type { Message } from '../services/ApiClient';
import type { SessionPart } from '../types/session';

import '../styles/SessionPlayer.css';

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
    backgroundImageUrl?: string;
    inputValue?: string;
    onInputChange?: (text: string) => void;
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
    onVideoEnded,
    backgroundImageUrl,
    inputValue,
    onInputChange
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
        <div className={`session-player-container ${sessionActive ? 'session-active-grid' : 'session-inactive-grid'}`}>
            <div className="player-left-col">
                <div className="video-display-area">
                    
                    {/* AVATAR LAYER */}
                    <div style={{ display: showAvatar ? 'block' : 'none' }} className="avatar-layer">
                         <VideoPanel stream={remoteStream || null} visible={true} backgroundImageUrl={backgroundImageUrl} />
                    </div>

                    {/* VIDEO PLAYER LAYER */}
                    {videoSrc && (
                        <div className="video-layer">
                            <VideoPlayerOverlay 
                                src={videoSrc} 
                                onEnded={onVideoEnded} 
                            />
                        </div>
                    )}
                </div>

                <div className="glass-panel controls-wrapper">
                     <Controls 
                        sessionActive={sessionActive}
                        isListening={isListening}
                        onStartSession={onStartSession}
                        onStopSession={onStopSession}
                        onMicToggle={onMicToggle}
                        onClearChat={onClearChat}
                     />
                     
                     <ChatInput 
                        onSend={onSendMessage} 
                        disabled={isLoading} // Enabled while listening to see text
                        value={inputValue}
                        onChange={onInputChange}
                     />
                     
                     <div className="action-buttons">
                         {lessonState === LessonState.ANSWER_COMPLETE && (
                             <button 
                                className="btn-primary btn-action btn-continue" 
                                onClick={onResume}
                             >
                                Continue Lesson
                             </button>
                         )}
                         <button 
                            className="btn-primary btn-action btn-interrupt" 
                            onClick={onInterrupt}
                         >
                            Interrupt & Ask
                         </button>
                         <button 
                            className="btn-primary btn-action btn-skip" 
                            onClick={onSkip}
                         >
                            Skip
                         </button>
                     </div>
                </div>
            </div>
            
            {/* Session Script Panel */}
             <div className="glass-panel script-panel" ref={scriptContainerRef}>
                <h3 className="session-script-title">Session Script</h3>
                <div className="script-list">
                    {sessionScript?.map((part) => {
                        const isActive = currentAction?.originalPart?.id === part.id;
                        return (
                            <div 
                                key={part.id} 
                                id={`script-part-${part.id}`}
                                className={`script-item ${isActive ? 'script-item-active' : 'script-item-inactive'}`}
                            >
                                <div className="script-item-header">
                                    {part.type.toUpperCase()} #{part.id}
                                </div>
                                <div className={`script-content ${isActive ? 'script-content-active' : ''}`}>
                                    {part.type === 'speech' ? part.content : `[Video: ${part.path?.split('/').pop()}]`}
                                </div>
                                {part.type === 'video' && part.intro && (
                                    <div className="script-intro">
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
