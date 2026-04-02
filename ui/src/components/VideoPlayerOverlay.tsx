import React, { useEffect, useRef, useState } from 'react';
import '../styles/VideoPlayerOverlay.css';

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
        <div className="video-overlay-container">
            {!error ? (
                <video 
                    ref={videoRef}
                    src={src} 
                    className="overlay-video"
                    onEnded={onEnded}
                    controls
                />
            ) : (
                <div className="error-container">
                    <h2>Video Simulation</h2>
                    <p>Playing: {src}</p>
                    <p>(File not found, simulating 5s playback...)</p>
                    <div className="loading-bar-container">
                        <div className="loading-bar"></div>
                    </div>
                </div>
            )}
            <button 
                onClick={onEnded}
                className="btn-primary skip-btn"
            >
                Skip Video
            </button>
        </div>
    );
};
