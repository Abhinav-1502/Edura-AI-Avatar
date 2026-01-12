import React from 'react';
import '../styles/Controls.css';

interface Props {
    sessionActive: boolean;
    isListening: boolean;
    onStartSession: () => void;
    onStopSession: () => void;
    onMicToggle: () => void;
    onClearChat: () => void;
}

export const Controls: React.FC<Props> = ({ 
    sessionActive, 
    isListening, 
    onStartSession, 
    onStopSession, 
    onMicToggle, 
    onClearChat 
}) => {
    return (
        <div className="glass-panel controls-container">
            {!sessionActive ? (
                <button className="btn-primary" onClick={onStartSession}>
                    Open Avatar Session
                </button>
            ) : (
                <>
                    <button 
                        className={`btn-primary ${isListening ? 'btn-mic-active' : ''}`} 
                        onClick={onMicToggle}
                    >
                        {isListening ? 'Stop Microphone' : 'Start Microphone'}
                    </button>
                    <button className="btn-primary btn-clear" onClick={onClearChat}>
                        Clear History
                    </button>
                    <button className="btn-primary btn-close" onClick={onStopSession}>
                        Close Session
                    </button>
                </>
            )}
        </div>
    );
};
