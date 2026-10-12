import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';

export const ProtectedRoute = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const { getDefaultRoute } = usePlatformConfig();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-invox-dark">
                <div className="w-16 h-16 border-4 border-invox-red border-dashed rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        // If an invitation token is present in the URL parameters, allow rendering so the recipient
        // can view the invitation details and team preview before being prompted to sign in.
        const hasInviteParam = Boolean(location.search && location.search.includes('invite='));
        if (hasInviteParam) {
            if (typeof window !== 'undefined') {
                const redirectPath = location.pathname + (location.search || '');
                sessionStorage.setItem('invox_redirect', redirectPath);
            }
            return <Outlet />;
        }

        if (typeof window !== 'undefined') {
            const redirectPath = location.pathname + (location.search || '');
            if (redirectPath && redirectPath !== '/' && redirectPath !== '/login' && redirectPath !== '/signup') {
                sessionStorage.setItem('invox_redirect', redirectPath);
            }
        }
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Require onboarding before accessing the main app
    if (userProfile && !userProfile.onboardingCompleted && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    // If onboarding is completed and user tries to access /onboarding, send them to dynamic default route
    if (userProfile && userProfile.onboardingCompleted && location.pathname === '/onboarding') {
         return <Navigate to={getDefaultRoute()} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
