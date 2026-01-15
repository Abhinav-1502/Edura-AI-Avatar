import { useEffect, useRef, useState } from 'react';
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
    onPause: () => void;
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
    onPause,
    onResume,
    onSkip,
    onVideoEnded,
    backgroundImageUrl,
    inputValue,
    onInputChange
}: SessionPlayerProps) => {
    
    const [isScriptVisible, setIsScriptVisible] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const scriptContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
        if (currentAction?.originalPart?.id && scriptContainerRef.current && isScriptVisible) {
            const el = document.getElementById(`script-part-${currentAction.originalPart.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentAction, isScriptVisible]);

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const showAvatar = sessionActive && (!currentAction || currentAction.type !== ActionType.VIDEO);

    const toggleScript = () => setIsScriptVisible(!isScriptVisible);
    
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`session-player-container ${sessionActive ? (isScriptVisible ? 'session-active-grid' : 'session-full-grid') : 'session-inactive-grid'} ${isFullscreen ? 'is-fullscreen' : ''}`}
        >
            
            {/* Toggle Button */}
            <div className="top-left-controls">
                <button 
                    className="btn-circle-control" 
                    onClick={toggleScript}
                    title={isScriptVisible ? "Hide Script" : "Show Script"}
                >
                    {isScriptVisible ? '✕' : '☰'}
                </button>

                <button 
                    className="btn-circle-control" 
                    onClick={toggleFullscreen}
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    {isFullscreen ? '⤦' : '⤢'}
                </button>
            </div>

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

                    {/* THINKING OVERLAY */}
                    {isLoading && (
                        <div className="thinking-overlay">
                            <div className="thinking-content">
                                <div className="thinking-spinner"></div>
                                <div className="thinking-text">Hold on! I am thinking about your question...</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="glass-panel controls-wrapper">
                     <Controls 
                        sessionActive={sessionActive}
                        isListening={isListening}
                        disabled={isLoading}
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
                                disabled={isLoading || isListening}
                             >
                                Continue Lesson
                             </button>
                         )}
                         <button 
                            className="btn-primary btn-action btn-interrupt" 
                            onClick={onInterrupt}
                            disabled={isLoading || isListening}
                         >
                            Interrupt & Ask
                         </button>
                         
                        {(lessonState === LessonState.PAUSED || lessonState === LessonState.WAITING_FOR_INPUT) ? (
                             <button 
                                className="btn-primary btn-action btn-resume" 
                                onClick={onResume}
                                disabled={isLoading || isListening}
                             >
                                Play
                             </button>
                         ) : (
                             <button 
                                className="btn-primary btn-action btn-pause" 
                                onClick={onPause}
                                disabled={isLoading || isListening}
                             >
                                Pause
                             </button>
                         )}

                         <button 
                            className="btn-primary btn-action btn-skip" 
                            onClick={onSkip}
                            disabled={isLoading || isListening}
                         >
                            Skip
                         </button>
                     </div>
                </div>
            </div>
            
            {/* Session Script Panel */}
            {isScriptVisible && (
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
            )}
        </div>
    );
};
