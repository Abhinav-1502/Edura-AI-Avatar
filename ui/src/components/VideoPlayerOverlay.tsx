import React, { useEffect, useRef, useState } from 'react';

interface Props {
    src: string;
    onEnded: () => void;
}

export const VideoPlayerOverlay: React.FC<Props> = ({ src, onEnded }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(e => {
                console.error("Video play failed", e);
                setError(true);
            });
        }
    }, [src]);

    // Fallback timer if video fails or is missing (simulating playback)
    useEffect(() => {
        if (error) {
            const timer = setTimeout(onEnded, 5000); // 5 sec dummy playback
            return () => clearTimeout(timer);
        }
    }, [error, onEnded]);

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            {!error ? (
                <video 
                    ref={videoRef}
                    src={src} 
                    style={{ maxHeight: '80%', maxWidth: '90%', borderRadius: '10px' }}
                    onEnded={onEnded}
                    controls
                />
            ) : (
                <div style={{ color: 'white', textAlign: 'center' }}>
                    <h2>Video Simulation</h2>
                    <p>Playing: {src}</p>
                    <p>(File not found, simulating 5s playback...)</p>
                    <div className="loading-bar-container" style={{ width: '200px', height: '4px', background: '#333', marginTop: '10px' }}>
                        <div className="loading-bar" style={{ width: '100%', height: '100%', background: '#0078d4', transition: 'width 5s linear' }}></div>
                    </div>
                </div>
            )}
            <button 
                onClick={onEnded}
                className="btn-primary"
                style={{ marginTop: '20px', padding: '10px 20px' }}
            >
                Skip Video
            </button>
        </div>
    );
};
