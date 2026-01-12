import React, { useEffect, useRef } from 'react';
import type { Message } from '../services/ApiClient';
import '../styles/ChatOverlay.css';

interface Props {
    messages: Message[];
    hidden?: boolean;
}

export const ChatOverlay: React.FC<Props> = ({ messages, hidden }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (hidden) return null;

    return (
        <div 
            className="glass-panel chat-overlay-container"
            ref={scrollRef}
        >
            {messages.map((msg, idx) => (
                <div key={idx} className="chat-message">
                    <strong className={`chat-role ${msg.role === 'user' ? 'chat-role-user' : 'chat-role-assistant'}`}>
                        {msg.role === 'user' ? 'User' : 'Assistant'}:
                    </strong>
                    <div className="chat-content">{msg.content}</div>
                </div>
            ))}
        </div>
    );
};
