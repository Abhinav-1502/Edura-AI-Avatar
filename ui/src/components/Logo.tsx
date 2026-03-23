import React from 'react';

export const Logo: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
    return (
        <div style={{
            position: 'absolute',
            top: '24px',
            left: '32px',
            zIndex: 10,
            backgroundColor: 'white',
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '15px',
            boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            ...style
        }}>
            <img
                src="/logoeng.png"
                alt="Edura AI Logo"
                style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    transition: 'transform 0.3s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            />
        </div>
    );
};
