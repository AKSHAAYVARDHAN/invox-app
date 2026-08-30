import React, { useState } from 'react';

interface LandingFooterProps {
    onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenAuth }) => {
    const [legalModal, setLegalModal] = useState<'TERMS' | 'PRIVACY' | null>(null);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToSection = (id: string) => {
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

    return (
        <footer className="bg-black border-t border-[#222222] py-12 sm:py-16 font-mono text-xs text-zinc-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                
                {/* Top Row: Brand & System Telemetry */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    
                    {/* Brand Column */}
                    <div className="md:col-span-5 space-y-3">
                        <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-zinc-950 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">
                                IX
                            </div>
                            <div>
                                <span className="font-bold text-white text-sm tracking-widest block">INVOX</span>
                                <span className="text-[10px] text-zinc-400 tracking-widest uppercase">FUEL CURIOSITY</span>
                            </div>
                        </div>
                        <p className="text-zinc-400 font-sans text-xs max-w-sm leading-relaxed">
                            A global curiosity, knowledge, and connection platform connecting independent thinkers worldwide.
                        </p>
                        <div className="text-[10px] text-zinc-600">
                            NODE_ID // 33bb76e2-2aaf-4e36-b1f7-f57cda007899
                        </div>
                    </div>

                    {/* Navigation Columns */}
                    <div className="md:col-span-4 grid grid-cols-2 gap-6">
                        <div>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-3">// PLATFORM</span>
                            <ul className="space-y-2 text-zinc-400">
                                <li>
                                    <button onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                                        Explore
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                                        Trendz
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                                        Spotlight
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                                        Communities
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                                        Hub
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => onOpenAuth('login')} className="hover:text-white transition-colors">
                                        My Space
                                    </button>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-3">// ARCHITECTURE</span>
                            <ul className="space-y-2 text-zinc-400">
                                <li>
                                    <button onClick={() => scrollToSection('what-is-invox')} className="hover:text-white transition-colors">
                                        About Invox
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('discover')} className="hover:text-white transition-colors">
                                        Discover Engine
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('ai-creation')} className="hover:text-white transition-colors">
                                        Intelligence Layer
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('global-network')} className="hover:text-white transition-colors">
                                        Global Mesh
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('companion')} className="hover:text-white transition-colors">
                                        AI Companion
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Legal & Status */}
                    <div className="md:col-span-3 space-y-3">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest block mb-3">// COMPLIANCE</span>
                        <div className="space-y-2 text-zinc-400">
                            <div>
                                <button onClick={() => setLegalModal('TERMS')} className="hover:text-white transition-colors">
                                    Terms of Service
                                </button>
                            </div>
                            <div>
                                <button onClick={() => setLegalModal('PRIVACY')} className="hover:text-white transition-colors">
                                    Privacy Policy
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={scrollToTop}
                                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] uppercase tracking-wider transition-all"
                            >
                                ↑ RETURN TO TOP
                            </button>
                        </div>
                    </div>

                </div>

                {/* Bottom Row: Copyright & Diagnostic Status */}
                <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
                    <div className="flex items-center space-x-3 text-zinc-500">
                        <span>© {new Date().getFullYear()} INVOX. ALL RIGHTS RESERVED.</span>
                        <span>//</span>
                        <span className="text-zinc-400">FUEL CURIOSITY</span>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-500">
                        <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                        <span className="text-zinc-400">STATUS: ALL_SYSTEMS_NOMINAL</span>
                    </div>
                </div>

            </div>

            {/* Legal Modal Drawer */}
            {legalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeInUp">
                    <div className="bg-[#09090b] border border-zinc-700 p-6 max-w-lg w-full text-left font-mono space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-xs text-zinc-400">
                            <span>LEGAL_DISCLOSURE // {legalModal}</span>
                            <button 
                                onClick={() => setLegalModal(null)}
                                className="text-zinc-400 hover:text-white"
                            >
                                [ESC // ×]
                            </button>
                        </div>
                        <h4 className="text-sm font-bold text-white uppercase">
                            {legalModal === 'TERMS' ? 'Terms of Service' : 'Privacy Policy'}
                        </h4>
                        <div className="text-xs text-zinc-300 font-sans leading-relaxed space-y-2 max-h-60 overflow-y-auto pr-2">
                            {legalModal === 'TERMS' ? (
                                <>
                                    <p>
                                        Invox is designed as a platform for intellectual exchange, collaborative discovery, and knowledge generation.
                                    </p>
                                    <p>
                                        Users agree to participate constructively, respect intellectual property, and uphold academic/creative integrity across all channels, queries, and hub communications.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        Your privacy and telemetry data are protected. Invox implements end-to-end security architectures for direct comrade conversations and encrypted data storage.
                                    </p>
                                    <p>
                                        We do not sell personal data or monetize private cognitive graphs to third-party ad brokers.
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="pt-2 border-t border-zinc-800 flex justify-end">
                            <button
                                onClick={() => setLegalModal(null)}
                                className="px-4 py-1.5 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200"
                            >
                                [ ACKNOWLEDGE ]
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </footer>
    );
};
