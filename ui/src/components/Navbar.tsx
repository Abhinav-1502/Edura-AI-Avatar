import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/Navbar.css';

export const Navbar: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_info');
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <NavLink to="/" className="navbar-brand">
                Edura Avatar
            </NavLink>
            <div className="navbar-links">
                <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                    Home
                </NavLink>
                <NavLink to="/history" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                    History
                </NavLink>
                <NavLink to="/config" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                    Configuration
                </NavLink>
                <button 
                    onClick={handleLogout} 
                    className="nav-link" 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    Logout
                </button>
            </div>
        </nav>
    );
};
