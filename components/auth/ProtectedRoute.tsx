import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProtectedRoute = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-invox-dark">
                <div className="w-16 h-16 border-4 border-invox-red border-dashed rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Require onboarding before accessing the main app
    if (userProfile && !userProfile.onboardingCompleted && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    // If onboarding is completed and user tries to access /onboarding, send them to /explore
    if (userProfile && userProfile.onboardingCompleted && location.pathname === '/onboarding') {
         return <Navigate to="/explore" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
