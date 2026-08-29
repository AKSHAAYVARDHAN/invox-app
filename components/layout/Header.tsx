import React from 'react';
import { MenuIcon, ProfileIcon, BellIcon } from '../ui/Icons';
// FIX: Use namespace import for react-router-dom to avoid "no exported member" issues.
import * as ReactRouterDOM from 'react-router-dom';

interface HeaderProps {
    toggleSidebar: () => void;
    pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar, pageTitle }) => {
    return (
        <>
            {/* Mobile + tablet header (hidden only on lg+ where the sidebar is always visible) */}
            <header className="bg-[#080808]/95 backdrop-blur-md sticky top-0 z-30 px-4 py-3 flex items-center justify-between lg:hidden border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={toggleSidebar} 
                        className="text-zinc-300 hover:text-white p-1.5 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 transition-colors" 
                        aria-label="Toggle menu"
                    >
                        <MenuIcon className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-white"></span>
                        <h1 className="text-sm font-mono font-bold tracking-wider text-white uppercase">{pageTitle}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="text-zinc-300 hover:text-white p-1.5 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 relative transition-colors" aria-label="Notifications">
                        <BellIcon className="w-4 h-4" />
                        <span className="absolute top-1 right-1 block h-1.5 w-1.5 bg-rose-500" aria-hidden="true"></span>
                    </button>
                    <ReactRouterDOM.Link 
                        to="/profile" 
                        className="p-1 border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 inline-block transition-colors" 
                        aria-label="View profile"
                    >
                        <ProfileIcon className="w-5 h-5 text-zinc-300" />
                    </ReactRouterDOM.Link>
                </div>
            </header>
        </>
    );
};