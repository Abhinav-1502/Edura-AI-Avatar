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
        <nav className="navbar" style={{
            background: 'linear-gradient(135deg, #022b26 0%, #0a4d44 50%, #022b26 100%)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderBottom: '0px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
            transition: 'all 0.3s ease',
            padding: '0rem 2rem',
            paddingTop: '0.3rem',
        }}>
            <style>{`
                .nav-link {
                    color: rgba(255, 255, 255, 0.89) !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease-in-out !important;
                    text-decoration: none !important;
                    display: inline-block !important;
                    cursor: pointer !important;
                    background: transparent !important;
                    borderbottom: 0px;
                }
                .nav-link:hover {
                    background-color: rgba(255, 255, 255, 0.45) !important;
                    color: #ffffff !important;
                    transform: translateY(-1px) !important;
                }
                .nav-link.active {
                    background-color: rgba(255, 255, 255, 1) !important;
                    color: #040404ff !important;
                    font-weight: 700 !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                }
            `}</style>
            <NavLink to="/" className="navbar-brand-logo" style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.2),padding:0px 0px' }}>
                <img src="/logoeng.png" alt="Edura by Engcampus" style={{ height: '60px',width: '100px',background: 'white',padding: '0.35rem 1.4rem'}} />
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
                    style={{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '1rem' }}
                >
                    Logout
                </button>
            </div>
        </nav>
    );
};
