/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Card.css';
import { ApiClient } from '../services/ApiClient';

export const HomePage: React.FC = () => {

    const [credits, setCredits] = React.useState<number>(0);

    const [sessions, setSessions] = React.useState<any[]>([]);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const sessionList = await ApiClient.getSessions();
                setSessions(sessionList);
            } catch (e) {
                console.error("Failed to fetch sessions", e);
            }
        };
        fetchSessions();
     
        const getCredits = async () => {
            try {
                const response = await ApiClient.getHeyGenCredits();
                console.log("Response: ", response);
                setCredits(response.remaining_quota);
            } catch (e) {
                console.error("Failed to fetch credits", e);
            }
        };
        
        getCredits();
    }, []);

    const navigate = useNavigate();

    const handleSessionClick = async (sessionId: string) => {
        let resumePartId: number | null = null;
        let isTracking = false;

        // 1. Check History
        try {
            const history = await ApiClient.getSessionHistory(sessionId);
            console.log(history);
            if (history && history.length > 0) {
                const lastCompleted = history[history.length - 1].completedParts;
                if (lastCompleted > 0) {
                    if (window.confirm("Found previous progress. Do you want to continue where you left off?")) {
                        resumePartId = lastCompleted;
                    }
                }
            }
        } catch (e) {
            console.error("Failed to check history", e);
        }

        // 2. Ask Tracking
        if (window.confirm("Do you want to keep track of this session?")) {
            isTracking = true;
        }

        // 3. Navigate
        navigate(`/session/${sessionId}`, { state: { resumePartId, isTracking } });
    };

    
    return (
        <div className="page-container">
            <h1 className="page-title">Available Sessions</h1>
            <p>Remaining Credits: {credits}
                {credits < 1 && <span className="error"> (You have no credits left. Please purchase more credits to continue.)</span>}
            </p>
            <div className="card-grid">
                
               
                {sessions.map(session => (
                    <div 
                        key={session.id} 
                        className="card" 
                        onClick={() => handleSessionClick(session.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        <h3>{session.title}</h3>
                        <p>Subject: {session.subject}</p>
                        <p>{session.numberOfParts} Parts</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
