
import React from 'react';

const HomePage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
            <div className="max-w-2xl w-full border border-zinc-800 bg-[#0c0c0e] p-8 text-left relative">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white"></span>
                        <span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">// SYSTEM_INDEX</span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-600 uppercase">STATUS: ACTIVE</span>
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-white mb-2 uppercase">Invox</h1>
                <p className="text-sm font-mono text-zinc-400 mb-6 tracking-wide">// Fuel Curiosity, Expand Consciousness</p>
                
                <div className="border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-3 font-sans text-sm text-zinc-400 leading-relaxed">
                    <p className="text-white font-mono text-xs font-semibold uppercase">// OVERVIEW</p>
                    <p>
                        A decentralized intelligence and discourse platform engineered for builders, thinkers, and explorers. Connect, exchange insights, analyze telemetry, and coordinate across active domains.
                    </p>
                    <p className="font-mono text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
                        Use the sidebar navigation to access real-time feeds, stream signals, and community hubs.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
