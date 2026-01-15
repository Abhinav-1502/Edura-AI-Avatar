import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { ConfigPage } from './pages/ConfigPage';
import { SessionPage } from './pages/SessionPage';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import './styles/index.css';
import './styles/App.css';

interface Config {
    ttsVoice: string;
    avatarCharacter: string;
    oydEnabled: boolean;
    continuousConversation: boolean;
    backgroundImageUrl: string;
}

// Layout component for protected routes
const ProtectedLayout = () => (
   <>
      <Navbar />
      <div className="app-container">
         <Outlet />
      </div>
   </>
);

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
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                
                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<ProtectedLayout />}>
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
                    </Route>
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
