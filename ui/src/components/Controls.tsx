import React from 'react';

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
        <div className="glass-panel" style={{ padding: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!sessionActive ? (
                <button className="btn-primary" onClick={onStartSession}>
                    Open Avatar Session
                </button>
            ) : (
                <>
                    <button className="btn-primary" onClick={onMicToggle} style={{ backgroundColor: isListening ? '#ef4444' : undefined }}>
                        {isListening ? 'Stop Microphone' : 'Start Microphone'}
                    </button>
                    <button className="btn-primary" style={{ background: '#f59e0b' }} onClick={onClearChat}>
                        Clear History
                    </button>
                    <button className="btn-primary" style={{ background: '#ef4444' }} onClick={onStopSession}>
                        Close Session
                    </button>
                </>
            )}
        </div>
    );
};
