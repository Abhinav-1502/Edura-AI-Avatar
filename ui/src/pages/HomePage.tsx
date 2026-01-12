import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_SESSIONS } from '../data/mockData';
import '../styles/Card.css';
import { ApiClient } from '../services/ApiClient';

export const HomePage: React.FC = () => {

    const [credits, setCredits] = React.useState<number | null>(Number(localStorage.getItem('heygen_credits')));

    useEffect(() => {
        const getCredits = async () => {
            const response = await ApiClient.getHeyGenCredits();
            setCredits(response.data.remaining_quota);
        };
        getCredits();
    }, []);
    
    return (
        <div className="page-container">
            <h1 className="page-title">Available Sessions</h1>
            <p>Remaining Credits: {credits}
                {credits !== null && credits < 1 && <span className="error"> (You have no credits left. Please purchase more credits to continue.)</span>}
            </p>
            <div className="card-grid">
                
               
                {MOCK_SESSIONS.map(session => (
                    <div>
                        <Link to={`/session/${session.id}`} key={session.id} className="card">
                            <h3>{session.title}</h3>
                            <p>Subject: {session.subject}</p>
                            <p>{session.numberOfParts} Parts</p>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};
