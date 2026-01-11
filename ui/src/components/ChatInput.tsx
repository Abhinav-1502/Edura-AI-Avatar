import React, { useState } from 'react';

interface Props {
    onSend: (text: string) => void;
    disabled?: boolean;
}

export const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
    const [text, setText] = useState('');

    const handleSend = () => {
        if (!text.trim()) return;
        onSend(text);
        setText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (disabled) return null;

    return (
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <textarea
                className="input-field"
                style={{ flex: 1, height: '60px', resize: 'none' }}
                placeholder="Type your message..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
            />
            <button 
                className="btn-primary" 
                onClick={handleSend}
                disabled={disabled || !text.trim()}
                style={{ height: '60px' }}
            >
                Send
            </button>
        </div>
    );
};
