
import React, { useState, useRef, useEffect } from 'react';
// FIX: Use namespace import for react-router-dom to avoid "no exported member" issues.
import * as ReactRouterDOM from 'react-router-dom';
import { HomeIcon, ExploreIcon, SpotlightIcon, CommunityIcon, HubIcon, LogoutIcon, TrendingUpIcon, MicrophoneIcon, CubeIcon, CometIcon, ProfileIcon, CogIcon } from '../ui/Icons';
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
    const { currentUser, userProfile } = useAuth();
    const location = ReactRouterDOM.useLocation();
    const navigate = ReactRouterDOM.useNavigate();
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isDropdownOpen]);

    const handleLogout = async () => {
        try {
            await logout();
            setIsDropdownOpen(false);
            // The AuthProvider will handle navigation via ProtectedRoute
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const handleMenuNavigation = (path: string) => {
        navigate(path);
        setIsDropdownOpen(false);
        if (isOpen) toggleSidebar();
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
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors border-t border-b border-gray-800 text-left focus:outline-none focus:ring-2 focus:ring-invox-red focus:bg-gray-800"
                                aria-expanded={isDropdownOpen}
                                aria-haspopup="true"
                            >
                                {userProfile?.photoURL || currentUser.photoURL ? (
                                    <img 
                                        src={userProfile?.photoURL || currentUser.photoURL || ''} 
                                        alt="Profile" 
                                        className="w-10 h-10 rounded-full object-cover border border-gray-600"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600 text-gray-400 shrink-0">
                                        <ProfileIcon className="w-6 h-6" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold truncate" title={userProfile?.displayName || currentUser.displayName || ''}>
                                        {userProfile?.displayName || currentUser.displayName || 'User'}
                                    </p>
                                    <p className="text-sm text-gray-400 truncate" title={userProfile?.username ? `@${userProfile.username}` : currentUser.email || ''}>
                                        {userProfile?.username ? `@${userProfile.username}` : currentUser.email}
                                    </p>
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute bottom-full left-0 w-full mb-2 bg-invox-dark-accent border border-gray-700 rounded-md shadow-lg overflow-hidden z-50">
                                    <ul className="py-1" role="menu">
                                        <li>
                                            <button
                                                onClick={() => handleMenuNavigation('/profile')}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:bg-gray-700"
                                                role="menuitem"
                                            >
                                                <ProfileIcon className="w-5 h-5" />
                                                <span className="font-medium">My Profile</span>
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => handleMenuNavigation('/settings')}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:bg-gray-700"
                                                role="menuitem"
                                            >
                                                <CogIcon className="w-5 h-5" />
                                                <span className="font-medium">Settings</span>
                                            </button>
                                        </li>
                                        <li className="border-t border-gray-700 mt-1 pt-1">
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-invox-red hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-700"
                                                role="menuitem"
                                            >
                                                <LogoutIcon className="w-5 h-5" />
                                                <span className="font-medium">Logout</span>
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};
