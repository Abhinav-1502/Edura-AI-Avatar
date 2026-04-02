import React, { useState } from 'react';

import '../styles/ChatInput.css';

interface Props {
    onSend: (text: string) => void;
    disabled?: boolean;
    value?: string;
    onChange?: (text: string) => void;
}

export const ChatInput: React.FC<Props> = ({ onSend, disabled, value, onChange }) => {
    const [internalText, setInternalText] = useState('');

    const text = value !== undefined ? value : internalText;
    const setText = onChange || setInternalText;

    const handleSend = () => {
        if (!text.trim()) return;
        onSend(text);
        if (value === undefined) {
             setInternalText('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (disabled) return null;

    return (
        <div className="chat-input-container">
            <textarea
                className="input-field chat-input-textarea"
                placeholder="Type your message..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
            />
            <button 
                className="btn-primary chat-input-button" 
                onClick={handleSend}
                disabled={disabled || !text.trim()}
            >
                Send
            </button>
        </div>
    );
};
