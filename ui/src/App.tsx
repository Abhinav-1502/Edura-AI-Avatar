import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { ConfigPage } from './pages/ConfigPage';
import { SessionPage } from './pages/SessionPage';
import './styles/index.css';
import './styles/App.css';

interface Config {
    ttsVoice: string;
    avatarCharacter: string;
    oydEnabled: boolean;
    continuousConversation: boolean;
    backgroundImageUrl: string;
}

function App() {
    // Lifted Config State
    const [config, setConfig] = useState<Config>({
        ttsVoice: import.meta.env.VITE_HEYGEN_VOICE_ID,
        avatarCharacter: import.meta.env.VITE_HEYGEN_AVATAR_ID,
        oydEnabled: false,
        continuousConversation: false,
        backgroundImageUrl: import.meta.env.VITE_BACKGROUND_IMAGE_URL || '',
    } as unknown as Config);

    console.log(config);
    return (
        <Router>
            <Navbar />
            <div className="app-container">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route 
                        path="/session/:id" 
                        element={<SessionPage config={config} />} 
                    />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route 
                        path="/config" 
                        element={<ConfigPage config={config} setConfig={setConfig} />} 
                    />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
