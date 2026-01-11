import React from 'react';

interface Props {
    text: string;
}

export const ExampleDisplay: React.FC<Props> = ({ text }) => {
    if (!text) return null;

    return (
        <div 
            className="glass-panel"
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                minHeight: '200px',
                height: '100%',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                borderLeft: '4px solid #6366f1'
            }}
        >
            <div style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '2rem',
                fontWeight: 700,
                color: '#f1f5f9',
                textAlign: 'center',
                fontStyle: 'italic',
                position: 'relative',
                lineHeight: 1.4
            }}>
                <span style={{ 
                    position: 'absolute', 
                    top: '-40px', 
                    left: '-20px', 
                    fontSize: '4rem', 
                    color: '#6366f1', 
                    opacity: 0.5 
                }}>
                    "
                </span>
                {text}
                <span style={{ 
                    position: 'absolute', 
                    bottom: '-60px', 
                    right: '-20px', 
                    fontSize: '4rem', 
                    color: '#6366f1', 
                    opacity: 0.5 
                }}>
                    "
                </span>
            </div>
        </div>
    );
};
