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
                <div className="w-10 h-10 border-2 border-zinc-700 border-t-emerald-500 rounded-none animate-spin mb-4"></div>
                <p className="font-mono text-xs tracking-widest uppercase text-zinc-400">
                    // AUTHENTICATING_ADMIN_CREDENTIALS...
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
            <div className="min-h-screen flex items-center justify-center bg-[#080809] p-6">
                <div className="max-w-md w-full border border-rose-900/60 bg-[#0d0d10] p-6 font-mono">
                    <div className="flex items-center gap-3 text-rose-500 mb-4 border-b border-rose-900/40 pb-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-sm font-bold tracking-wider uppercase">403 // ACCESS_RESTRICTED</h2>
                    </div>
                    <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                        Authorized administrator privileges are required to access the Invox Admin Control Center. Your account ({currentUser.email}) does not have an active administrator assignment.
                    </p>
                    <div className="pt-2">
                        <Link
                            to={getDefaultRoute()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs tracking-wider uppercase transition-colors"
                        >
                            <span>← Return to Platform</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AdminRoute;
