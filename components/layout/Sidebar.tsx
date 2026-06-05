
import React from 'react';
// FIX: Use namespace import for react-router-dom to avoid "no exported member" issues.
import * as ReactRouterDOM from 'react-router-dom';
import { HomeIcon, ExploreIcon, SpotlightIcon, CommunityIcon, HubIcon, LogoutIcon, TrendingUpIcon, MicrophoneIcon, CubeIcon, CometIcon } from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/authService';

const navItems = [
    { name: 'Explore', path: '/explore', icon: ExploreIcon },
    { name: 'Trendz', path: '/trendz', icon: TrendingUpIcon },
    { name: 'Spotlight', path: '/spotlight', icon: SpotlightIcon },
    { name: 'Communities', path: '/communities', icon: CommunityIcon },
    { name: 'Hub', path: '/hub', icon: HubIcon },
    { name: 'My Space', path: '/myspace', icon: CubeIcon },
    { name: 'Duppor', path: '/duppor', icon: CometIcon },
];

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
    resetHub?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, resetHub }) => {
    const navLinkClasses = "flex items-center space-x-4 px-4 py-3 rounded-md text-invox-light-gray hover:bg-invox-dark-accent hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-100";
    const activeLinkClasses = "bg-invox-dark-accent text-white";
    const { currentUser } = useAuth();
    const location = ReactRouterDOM.useLocation();

    const handleLogout = async () => {
        try {
            await logout();
            // The AuthProvider will handle navigation via ProtectedRoute
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    return (
        <>
            {/* Overlay for mobile + tablet (hidden on lg+ where sidebar is always visible) */}
            <button
                className={`fixed inset-0 bg-black bg-opacity-60 z-30 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={toggleSidebar}
                aria-label="Close sidebar"
                tabIndex={isOpen ? 0 : -1}
            ></button>

            {/* Sidebar — drawer on mobile/tablet, fixed visible on lg+ */}
            <aside className={`fixed top-0 left-0 h-full bg-invox-dark w-64 p-4 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-gray-800 flex flex-col`}>
                <div>
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-invox-red">Invox</h1>
                            <p className="text-sm text-gray-400">Fuel Curiosity</p>
                        </div>
                        {/* Close button — only visible on mobile/tablet where sidebar is a drawer */}
                        <button
                            onClick={toggleSidebar}
                            className="lg:hidden text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
                            aria-label="Close sidebar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <nav>
                        <ul>
                            {navItems.map(item => (
                                <li key={item.name}>
                                    {/* FIX: Use namespace import for react-router-dom to avoid "no exported member" issues. */}
                                    <ReactRouterDOM.NavLink
                                        to={item.path}
                                        className={({ isActive }) => `${navLinkClasses} ${isActive ? activeLinkClasses : ''}`}
                                        onClick={() => {
                                            // If clicking the link for the page we're already on, scroll to top
                                            if (location.pathname === item.path) {
                                                // Reset Hub view if we are on the Hub path
                                                if (item.path === '/hub') {
                                                    resetHub?.();
                                                }
                                                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                            // Close drawer on mobile/tablet after any nav click
                                            if (isOpen) {
                                                toggleSidebar();
                                            }
                                        }}
                                    >
                                        <item.icon className="w-6 h-6" />
                                        <span className="font-semibold">{item.name}</span>
                                    </ReactRouterDOM.NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
                <div className="mt-auto">
                    {currentUser && (
                         <div className="px-4 py-3 my-2 border-t border-b border-gray-800">
                             <p className="text-white font-semibold truncate" title={currentUser.email || ''}>{currentUser.displayName || 'User'}</p>
                            <p className="text-sm text-gray-400 truncate" title={currentUser.email || ''}>{currentUser.email}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={`${navLinkClasses} w-full`}
                    >
                        <LogoutIcon className="w-6 h-6" />
                        <span className="font-semibold">Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};
