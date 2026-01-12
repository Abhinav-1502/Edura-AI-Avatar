import React from 'react';
import { MOCK_HISTORY, MOCK_SESSIONS } from '../data/mockData';
import '../styles/Card.css';

export const HistoryPage: React.FC = () => {
    // Helper to get session title
    const getSessionTitle = (sessionId: string) => {
        const session = MOCK_SESSIONS.find(s => s.id === sessionId);
        return session ? session.title : 'Unknown Session';
    };

    return (
        <div className="page-container">
            <h1 className="page-title">Session History</h1>
            <div className="card-grid">
                {MOCK_HISTORY.map(history => (
                    <div key={history.id} className="card" style={{ cursor: 'default', transform: 'none' }}>
                        <h3>{getSessionTitle(history.sessionId)}</h3>
                        <p>Completed Parts: {history.completedParts}</p>
                        <p>Date: {history.createdAt.toLocaleDateString()}</p>
                        <p>Status: {history.postedHomework ? "Homework Posted" : "In Progress"}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
