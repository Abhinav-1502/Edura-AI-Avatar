import React, { useEffect, useRef } from 'react';
import type { Message } from '../services/ApiClient';

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
            className="glass-panel"
            ref={scrollRef}
            style={{ 
                position: 'absolute', 
                top: '20px', 
                left: '20px', 
                width: '300px', 
                height: '400px', 
                overflowY: 'auto',
                padding: '15px',
                zIndex: 10,
                fontSize: '0.9rem',
                backgroundColor: 'rgba(0, 0, 0, 0.4)'
            }}
        >
            {messages.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: '10px' }}>
                    <strong style={{ color: msg.role === 'user' ? '#50E6FF' : '#FFD700' }}>
                        {msg.role === 'user' ? 'User' : 'Assistant'}:
                    </strong>
                    <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
            ))}
        </div>
    );
};
