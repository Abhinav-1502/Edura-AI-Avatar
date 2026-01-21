/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClient } from '../services/ApiClient';
import '../styles/App.css'; 

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await ApiClient.login(email, password);
            console.log("Login successful:", response);
            
            localStorage.setItem('auth_token', response.access_token);
            localStorage.setItem('user_info', JSON.stringify(response.user));
            
            navigate('/');
        } catch (err: any) {
            console.error("Login failed:", err);
            setError(err.message || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{ 
                fontSize: '3.5rem', 
                fontWeight: '700', 
                background: 'linear-gradient(to right, #fff, #999)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent',
                marginBottom: '40px',
                textAlign: 'center',
                letterSpacing: '-0.02em'
            }}>
                Eng Campus Avatar Class
            </h1>
            <div className="config-box" style={{ width: '100%', margin: 0 }}>
                <h2 className="app-header" style={{ marginBottom: '32px', fontSize: '1.25rem', opacity: 0.8 }}>Teacher Login</h2>
                
                {error && (
                    <div style={{ 
                        backgroundColor: 'rgba(220, 38, 38, 0.1)', 
                        color: '#f87171', 
                        padding: '12px', 
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '24px',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(220, 38, 38, 0.2)'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label className="label-text">Email</label>
                        <input
                            type="email"
                            className="input-field"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="name@school.com"
                        />
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label className="label-text">Password</label>
                        <input
                            type="password"
                            className="input-field"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary"
                        style={{ width: '100%' }}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};
