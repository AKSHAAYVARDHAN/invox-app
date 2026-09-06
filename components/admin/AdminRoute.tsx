import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, isAdmin, loading: authLoading } = useAuth();
    const { getDefaultRoute, loading: configLoading } = usePlatformConfig();
    const location = useLocation();

    if (authLoading || configLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-zinc-400">
                <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-200 rounded-full animate-spin mb-3"></div>
                <p className="text-xs text-zinc-500 font-medium">
                    Loading admin dashboard...
                </p>
            </div>
        );
    }

    // If not authenticated, redirect to public landing page
    if (!currentUser) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // If authenticated but lacks admin privileges
    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#080808] p-6">
                <div className="max-w-md w-full border border-zinc-800 bg-[#0c0c0e] rounded-none p-8">
                    <div className="w-10 h-10 rounded-none bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2 tracking-tight">Access restricted</h2>
                    <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                        Administrator privileges are required to access this dashboard. The account <span className="text-zinc-200 font-medium">{currentUser.email}</span> does not have administrative access.
                    </p>
                    <div>
                        <Link
                            to={getDefaultRoute()}
                            className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-sm rounded-none transition-colors"
                        >
                            Return to platform
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AdminRoute;
