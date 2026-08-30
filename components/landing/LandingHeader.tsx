import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';

interface LandingHeaderProps {
    onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onOpenAuth }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        setMobileMenuOpen(false);
        const element = document.getElementById(id);
        if (element) {
            const offset = 80;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const navLinks = [
        { label: 'WHAT IS INVOX', id: 'what-is-invox' },
        { label: 'DISCOVER', id: 'discover' },
        { label: 'FEEDS', id: 'feeds' },
        { label: 'AI CREATION', id: 'ai-creation' },
        { label: 'NETWORK', id: 'global-network' },
        { label: 'HUB', id: 'hub-section' },
        { label: 'COMPANION', id: 'companion' },
    ];

    return (
        <header 
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-200 border-b ${
                scrolled 
                    ? 'bg-black/90 backdrop-blur-md border-[#222222] py-3' 
                    : 'bg-black/40 backdrop-blur-xs border-transparent py-4 sm:py-5'
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                {/* Brand Logo & System Status */}
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="flex items-center space-x-3 text-left group focus:outline-none"
                    >
                        <div className="w-8 h-8 bg-zinc-950 border border-zinc-700 flex items-center justify-center font-mono font-bold text-white text-xs group-hover:border-zinc-500 transition-colors">
                            IX
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-sm tracking-widest text-white">INVOX</span>
                                <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">// v2.4</span>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-400 block tracking-widest uppercase -mt-0.5">
                                FUEL CURIOSITY
                            </span>
                        </div>
                    </button>

                    <div className="hidden xl:flex items-center space-x-2 pl-4 border-l border-zinc-800 text-[10px] font-mono text-zinc-500">
                        <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse"></span>
                        <span className="text-zinc-400 tracking-wider">NETWORK // ONLINE</span>
                    </div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center space-x-1 font-mono text-[11px] tracking-wider text-zinc-400">
                    {navLinks.map((link, idx) => (
                        <button
                            key={link.id}
                            onClick={() => scrollToSection(link.id)}
                            className="px-2.5 py-1 hover:text-white hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800 transition-all"
                        >
                            <span className="text-zinc-600 mr-1">0{idx + 1}</span>
                            {link.label}
                        </button>
                    ))}
                </nav>

                {/* Actions */}
                <div className="flex items-center space-x-3 font-mono">
                    <button
                        onClick={() => onOpenAuth('login')}
                        className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all uppercase tracking-wider"
                    >
                        SIGN IN
                    </button>
                    <button
                        onClick={() => onOpenAuth('signup')}
                        className="inline-flex items-center px-3.5 sm:px-4 py-1.5 text-xs font-bold text-black bg-white hover:bg-zinc-200 border border-white hover:border-zinc-300 transition-all uppercase tracking-widest group"
                    >
                        <span>ENTER INVOX</span>
                        <span className="ml-1.5 text-black group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>

                    {/* Mobile menu trigger */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                        aria-label="Toggle Navigation Menu"
                    >
                        <div className="w-4 h-3.5 flex flex-col justify-between">
                            <span className={`h-0.5 w-full bg-current transform transition duration-150 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                            <span className={`h-0.5 w-full bg-current transition duration-150 ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
                            <span className={`h-0.5 w-full bg-current transform transition duration-150 ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Mobile Drawer Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-black/95 border-b border-zinc-800 px-4 py-4 font-mono text-xs animate-fadeInUp">
                    <div className="flex flex-col space-y-2 mb-4">
                        {navLinks.map((link, idx) => (
                            <button
                                key={link.id}
                                onClick={() => scrollToSection(link.id)}
                                className="flex items-center justify-between p-2 text-left text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800"
                            >
                                <span>{link.label}</span>
                                <span className="text-zinc-600 text-[10px]">0{idx + 1}</span>
                            </button>
                        ))}
                    </div>
                    <div className="pt-3 border-t border-zinc-800 flex gap-2">
                        <button
                            onClick={() => { setMobileMenuOpen(false); onOpenAuth('login'); }}
                            className="flex-1 py-2 text-center text-zinc-300 bg-zinc-900 border border-zinc-800 hover:text-white uppercase tracking-wider"
                        >
                            SIGN IN
                        </button>
                        <button
                            onClick={() => { setMobileMenuOpen(false); onOpenAuth('signup'); }}
                            className="flex-1 py-2 text-center text-black bg-white font-bold hover:bg-zinc-200 uppercase tracking-wider"
                        >
                            JOIN INVOX
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
};
