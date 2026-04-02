/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClient } from '../services/ApiClient';
import { Logo } from '../components/Logo';
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

            sessionStorage.setItem('auth_token', response.access_token);
            sessionStorage.setItem('user_info', JSON.stringify(response.user));

            navigate('/');
        } catch (err: any) {
            console.error("Login failed:", err);
            setError(err.message || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100vw',
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundImage: 'url(/tbg.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
        }}>
            <Logo />

            <div className="config-box" style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                borderRadius: '20px',
                padding: '40px',
                boxSizing: 'border-box'
            }}>
                <h2 className="app-header" style={{ marginBottom: '32px', fontSize: '1.25rem', opacity: 0.9, color: '#1a1a1a', fontWeight: '700' }}>Teacher Login</h2>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#b91c1c',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '24px',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        fontWeight: '500'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label className="label-text" style={{ color: '#374151', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Email</label>
                        <input
                            type="email"
                            className="input-field"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                color: '#111827',
                                border: '1px solid rgba(0, 0, 0, 0.1)'
                            }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="name@school.com"
                        />
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label className="label-text" style={{ color: '#374151', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Password</label>
                        <input
                            type="password"
                            className="input-field"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                color: '#111827',
                                border: '1px solid rgba(0, 0, 0, 0.1)'
                            }}
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
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #46f184, #33b663)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(51, 182, 99, 0.3)',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(51, 182, 99, 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(51, 182, 99, 0.3)';
                        }}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};
