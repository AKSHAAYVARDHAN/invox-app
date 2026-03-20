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
            <header className="bg-invox-dark-accent sticky top-0 z-30 p-4 flex items-center justify-between lg:hidden border-b border-gray-800">
                <button onClick={toggleSidebar} className="text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="Toggle menu">
                    <MenuIcon />
                </button>
                <h1 className="text-xl font-bold text-white">{pageTitle}</h1>
                <div className="flex items-center gap-4">
                    <button className="text-white relative transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="Notifications, 1 unread">
                        <BellIcon />
                        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-invox-red ring-2 ring-invox-dark-accent" aria-hidden="true"></span>
                    </button>
                    <ReactRouterDOM.Link to="/profile" className="transition-transform duration-200 transform hover:scale-110 active:scale-100 inline-block" aria-label="View profile">
                        <ProfileIcon className="w-8 h-8 text-white bg-gray-700 rounded-full p-1" />
                    </ReactRouterDOM.Link>
                </div>
            </header>
        </>
    );
};