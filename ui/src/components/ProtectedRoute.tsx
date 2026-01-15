import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export const ProtectedRoute: React.FC = () => {
    // Check for auth token in localStorage
    const authToken = localStorage.getItem('auth_token');

    // If no token, redirect to login
    if (!authToken) {
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render child routes
    return <Outlet />;
};
