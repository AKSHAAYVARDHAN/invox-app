
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
    const navLinkClasses = "flex items-center space-x-3.5 px-3.5 py-2.5 rounded-none text-zinc-400 hover:bg-zinc-900/80 hover:text-white border border-transparent hover:border-zinc-800/80 transition-all duration-150 text-sm font-medium tracking-wide";
    const activeLinkClasses = "bg-zinc-900 text-white border-zinc-700/90 shadow-none font-semibold";
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
                className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={toggleSidebar}
                aria-label="Close sidebar"
                tabIndex={isOpen ? 0 : -1}
            ></button>

            {/* Sidebar — drawer on mobile/tablet, fixed visible on lg+ */}
            <aside className={`fixed top-0 left-0 h-full bg-[#080808] w-64 p-4 z-40 transform transition-transform duration-200 ease-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-zinc-800/80 flex flex-col`}>
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Brand header */}
                    <div className="mb-6 pt-1 pb-4 border-b border-zinc-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-white text-black font-mono font-bold text-xs flex items-center justify-center border border-zinc-400">
                                IX
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <h1 className="text-lg font-bold tracking-tight text-white font-mono uppercase">Invox</h1>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-400">v2.0</span>
                                </div>
                                <p className="text-[11px] font-mono text-zinc-500 tracking-wider">SYSTEM.FEED</p>
                            </div>
                        </div>
                        {/* Close button — only visible on mobile/tablet where sidebar is a drawer */}
                        <button
                            onClick={toggleSidebar}
                            className="lg:hidden text-zinc-400 hover:text-white transition-colors p-1.5 border border-zinc-800 hover:bg-zinc-900"
                            aria-label="Close sidebar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Navigation section */}
                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-3 mb-2">
                        // Modules
                    </div>
                    <nav className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                        <ul>
                            {navItems.map(item => (
                                <li key={item.name} className="mb-1">
                                    <ReactRouterDOM.NavLink
                                        to={item.path}
                                        className={({ isActive }) => `${navLinkClasses} ${isActive ? activeLinkClasses : ''}`}
                                        onClick={() => {
                                            if (location.pathname === item.path) {
                                                if (item.path === '/hub') {
                                                    resetHub?.();
                                                }
                                                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                            if (isOpen) {
                                                toggleSidebar();
                                            }
                                        }}
                                    >
                                        <item.icon className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-white" />
                                        <span className="truncate">{item.name}</span>
                                    </ReactRouterDOM.NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                {/* Profile Footer */}
                <div className="pt-3 border-t border-zinc-800/80 mt-auto">
                    {currentUser && (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full flex items-center gap-2.5 p-2 bg-zinc-900/40 hover:bg-zinc-900 transition-colors border border-zinc-800/80 text-left focus:outline-none focus:border-zinc-600"
                                aria-expanded={isDropdownOpen}
                                aria-haspopup="true"
                            >
                                {userProfile?.photoURL || currentUser.photoURL ? (
                                    <img 
                                        src={userProfile?.photoURL || currentUser.photoURL || ''} 
                                        alt="Profile" 
                                        className="w-8 h-8 rounded-none object-cover border border-zinc-700"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-none bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-400 shrink-0">
                                        <ProfileIcon className="w-4 h-4" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-zinc-200 text-xs font-semibold truncate font-mono" title={userProfile?.displayName || currentUser.displayName || ''}>
                                        {userProfile?.displayName || currentUser.displayName || 'User'}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 truncate font-mono" title={userProfile?.username ? `@${userProfile.username}` : currentUser.email || ''}>
                                        {userProfile?.username ? `@${userProfile.username}` : currentUser.email}
                                    </p>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online"></div>
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute bottom-full left-0 w-full mb-2 bg-[#0d0d0f] border border-zinc-700/80 shadow-2xl overflow-hidden z-50 animate-fadeInUp">
                                    <div className="px-3 py-1.5 text-[10px] font-mono text-zinc-500 border-b border-zinc-800 uppercase tracking-widest">
                                        Account
                                    </div>
                                    <ul className="py-1" role="menu">
                                        <li>
                                            <button
                                                onClick={() => handleMenuNavigation('/profile')}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-mono text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors"
                                                role="menuitem"
                                            >
                                                <ProfileIcon className="w-4 h-4 text-zinc-400" />
                                                <span>Profile</span>
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => handleMenuNavigation('/settings')}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-mono text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors"
                                                role="menuitem"
                                            >
                                                <CogIcon className="w-4 h-4 text-zinc-400" />
                                                <span>Settings</span>
                                            </button>
                                        </li>
                                        <li className="border-t border-zinc-800 mt-1 pt-1">
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-mono text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors"
                                                role="menuitem"
                                            >
                                                <LogoutIcon className="w-4 h-4" />
                                                <span>Logout</span>
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
