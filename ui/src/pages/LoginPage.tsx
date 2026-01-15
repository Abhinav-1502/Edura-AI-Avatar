import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClient } from '../services/ApiClient';
import '../styles/App.css'; // Reuse existing styles

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
            
            // Save token and user info
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
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh', 
            backgroundColor: '#0f172a',
            color: 'white'
        }}>
            <div style={{
                background: '#1e293b',
                padding: '2rem',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Teacher Login</h2>
                
                {error && (
                    <div style={{ 
                        backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                        color: '#fca5a5', 
                        padding: '0.75rem', 
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        fontSize: '0.875rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                border: '1px solid #334155',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                outline: 'none'
                            }}
                            placeholder="Enter your email"
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                border: '1px solid #334155',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                outline: 'none'
                            }}
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        {isLoading ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};
