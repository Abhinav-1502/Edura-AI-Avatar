import React, { useRef, useEffect } from 'react';

interface Props {
    stream: MediaStream | null;
    visible: boolean;
}

export const VideoPanel: React.FC<Props> = ({ stream, visible }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();

    const backgroundImage = import.meta.env.VITE_BACKGROUND_IMAGE_URL || '';

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && stream) {
            video.srcObject = stream;
            video.play().catch(e => console.error("Video play failed", e));
        }
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        }

        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const renderFrame = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // Determine layout
                const videoAspect = video.videoWidth / video.videoHeight;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const l = frame.data.length / 4;

                for (let i = 0; i < l; i++) {
                    const r = frame.data[i * 4 + 0];
                    const g = frame.data[i * 4 + 1];
                    const b = frame.data[i * 4 + 2];
                    
                    // Simple Green Screen Logic
                    // Condition: G > 100 AND G > R * 1.5 AND G > B * 1.5
                    if (g > 90 && g > r * 1.5 && g > b * 1.5) {
                        frame.data[i * 4 + 3] = 0;
                    }
                }
                ctx.putImageData(frame, 0, 0);
            }
            requestRef.current = requestAnimationFrame(renderFrame);
        };

        renderFrame();

        return () => {
             if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [stream]);

    if (!visible) return null;

    return (
        <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%',
            backgroundColor: 'black',
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
        }}>
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ display: 'none' }}
             />
             <canvas 
                ref={canvasRef}
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain' 
                }}
             />
             <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
             <div style={{
                 position: 'absolute',
                 bottom: '10px',
                 left: '0',
                 right: '0',
                 textAlign: 'center',
                 color: 'rgba(255,255,255,0.5)',
                 pointerEvents: 'none'
             }}>
                {/* Overlay area for subtitles or status if needed */}
             </div>
        </div>
    );
};
