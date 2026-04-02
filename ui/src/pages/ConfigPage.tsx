/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { ApiClient } from '../services/ApiClient';
import '../styles/App.css'; // Reusing config styles from App.css refactor

interface ConfigProps {
    config: any;
    setConfig: (config: any) => void;
}

export const ConfigPage: React.FC<ConfigProps> = ({ config, setConfig }) => {
    const [avatarList, setAvatarList] = useState<string[]>(JSON.parse(localStorage.getItem('avatarList') || '[]'));

    useEffect(() => {
        // Fetch persisted background
        ApiClient.getBackgroundUrl().then(url => {
            if (url) {
                setConfig((prev: any) => ({ ...prev, backgroundImageUrl: url }));
            }
        });

        if (avatarList.length > 0) return;
        ApiClient.getHeyGenAvatarList().then((list) => {
            if (Array.isArray(list)) {
                 const avatarIds = list.map((avatar: any) => avatar.avatar_id || avatar);
                 setAvatarList(avatarIds);
                 localStorage.setItem('avatarList', JSON.stringify(avatarIds));
            }
        }).catch(err => console.error("Failed to fetch avatars", err));
    }, [avatarList, setConfig]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const url = await ApiClient.uploadBackgroundImage(file);
                setConfig({ ...config, backgroundImageUrl: url });
            } catch (err) {
                console.error("Upload failed", err);
                alert("Failed to upload image");
            }
        }
    };

    return (
        <div className="page-container">
            <h1 className="page-title">Configuration</h1>
            
            <div className="landing-container">
                <div className="glass-panel landing-glass-panel">
                    <div className="config-box" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <h3 className="config-title">Avatar Settings</h3>
                        <div className="config-grid">
                            <span className="config-label">Character:</span>
                            {avatarList.length === 0 ? (
                                <p>Loading avatars...</p>
                            ) : (
                            <select 
                                value={config.avatarCharacter} 
                                onChange={(e) => setConfig({ ...config, avatarCharacter: e.target.value })}
                                className="config-select"
                            >
                                {avatarList.map((name: string) => (
                                    <option key={name} value={name} className="config-option">{name}</option>
                                ))}
                            </select>
                            )}
                            
                            <span className="config-label">Voice ID:</span>
                            <input 
                                type="text" 
                                value={config.ttsVoice}
                                onChange={(e) => setConfig({ ...config, ttsVoice: e.target.value })}
                                className="config-select"
                                style={{ width: '100%' }}
                            />

                            <span className="config-label">Background Image URL:</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                    type="text" 
                                    value={config.backgroundImageUrl || ''}
                                    onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                                    className="config-select"
                                    style={{ flex: 1 }}
                                    placeholder="https://example.com/background.jpg"
                                />
                                <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                                    <button className="btn-primary" style={{ height: '100%', padding: '0 15px' }}>
                                        Upload
                                    </button>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        style={{ 
                                            position: 'absolute', 
                                            left: 0, 
                                            top: 0, 
                                            opacity: 0, 
                                            width: '100%', 
                                            height: '100%', 
                                            cursor: 'pointer' 
                                        }}
                                        onChange={handleImageUpload}
                                    />
                                </div>
                            </div>

                             <span className="config-label">On Your Data (OYD):</span>
                             <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input 
                                    type="checkbox"
                                    checked={config.oydEnabled}
                                    onChange={(e) => setConfig({ ...config, oydEnabled: e.target.checked })}
                                    style={{ transform: 'scale(1.5)', marginRight: '10px' }}
                                />
                                <span>{config.oydEnabled ? 'Enabled' : 'Disabled'}</span>
                             </div>
                        </div>
                        <p className="config-note">
                            Changes are applied immediately to new sessions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
