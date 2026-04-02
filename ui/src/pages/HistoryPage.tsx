import React from 'react';
import '../styles/Card.css';
import { ApiClient, type SessionHistory } from '../services/ApiClient';
import { useEffect, useState} from 'react';


export const HistoryPage: React.FC = () => {
    const [history, setHistory] = useState<SessionHistory[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await ApiClient.getAllSessionHistory();
                setHistory(history);
            } catch (error) {
                console.error('Failed to fetch history:', error);
            }
        };
        fetchHistory();
    }, []);

    return (
        <div className="page-container">
            <h1 className="page-title">Session History</h1>
            <div className="card-grid">
                {history.map(history => (
                    <div key={history.id} className="card" style={{ cursor: 'default', transform: 'none' }}>
                        <h3>{history.sessionId}</h3>
                        <p>Completed Parts: {history.completedParts}</p>
                        <p>Date: {history.createdAt}</p>
                        <p>Status: {history.postedHomework ? "Homework Posted" : "In Progress"}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
