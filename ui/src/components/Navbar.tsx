import React from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/Navbar.css';

export const Navbar: React.FC = () => {
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
            </div>
        </nav>
    );
};
