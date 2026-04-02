import React from 'react';
import '../styles/Controls.css';

interface Props {
    sessionActive: boolean;
    isListening: boolean;
    disabled?: boolean;
    onStartSession: () => void;
    onStopSession: () => void;
    onMicToggle: () => void;
    onClearChat: () => void;
}

export const Controls: React.FC<Props> = ({ 
    sessionActive, 
    isListening, 
    disabled,
    onStartSession, 
    onStopSession, 
    onMicToggle, 
    onClearChat 
}) => {
    return (
        <div className="glass-panel controls-container">
            {!sessionActive ? (
                <button className="btn-primary" onClick={onStartSession} disabled={disabled}>
                    Open Avatar Session
                </button>
            ) : (
                <>
                    <button 
                        className={`btn-primary ${isListening ? 'btn-mic-active' : ''}`} 
                        onClick={onMicToggle}
                        disabled={disabled}
                    >
                        {isListening ? 'Stop Microphone' : 'Start Microphone'}
                    </button>
                    <button className="btn-primary btn-clear" onClick={onClearChat} disabled={disabled}>
                        Clear History
                    </button>
                    <button className="btn-primary btn-close" onClick={onStopSession} disabled={disabled}>
                        Close Session
                    </button>
                </>
            )}
        </div>
    );
};
