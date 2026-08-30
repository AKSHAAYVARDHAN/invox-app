import React from 'react';

interface FinalCtaSectionProps {
    onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenAuth }) => {
    return (
        <section className="py-28 sm:py-36 bg-black border-b border-[#222222] relative overflow-hidden text-center">
            {/* Subtle Grid Accent */}
            <div className="absolute inset-0 bg-[radial-gradient(#141414_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-10">
                
                {/* Technical System Label */}
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                    <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse"></span>
                    <span className="tracking-widest">// ACCESS_TERMINAL_OPEN</span>
                </div>

                {/* Monumental Headline */}
                <div className="space-y-3">
                    <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white uppercase font-sans leading-[1.04]">
                        THERE IS<br />
                        ALWAYS MORE<br />
                        <span className="text-zinc-500">TO DISCOVER.</span>
                    </h2>
                    <p className="text-base sm:text-xl font-mono text-zinc-400 uppercase tracking-widest pt-2">
                        ENTER THE NETWORK.
                    </p>
                </div>

                {/* Primary Action Button */}
                <div className="flex flex-col items-center justify-center space-y-4 pt-4 font-mono">
                    <button
                        onClick={() => onOpenAuth('signup')}
                        className="px-8 sm:px-12 py-4 bg-white hover:bg-zinc-200 text-black text-sm sm:text-base font-bold tracking-widest uppercase border border-white hover:border-zinc-300 transition-all flex items-center group shadow-2xl"
                    >
                        <span>[ ENTER INVOX ]</span>
                        <span className="ml-3 group-hover:translate-x-1.5 transition-transform">→</span>
                    </button>

                    <span className="text-xs font-mono text-zinc-600 tracking-widest uppercase">
                        FUEL CURIOSITY.
                    </span>
                </div>

            </div>
        </section>
    );
};
