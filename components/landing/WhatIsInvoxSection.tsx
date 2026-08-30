import React from 'react';

export const WhatIsInvoxSection: React.FC = () => {
    return (
        <section id="what-is-invox" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// WHAT_IS_INVOX</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                {/* Monumental Typography */}
                <div className="space-y-3 sm:space-y-4 max-w-5xl mb-12 sm:mb-16">
                    <p className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-600 uppercase font-sans">
                        NOT JUST A FEED.
                    </p>
                    <p className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-500 uppercase font-sans">
                        NOT JUST A CHAT.
                    </p>
                    <p className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-400 uppercase font-sans">
                        NOT JUST A COMMUNITY.
                    </p>
                    <div className="pt-4 sm:pt-6">
                        <p className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-white uppercase font-sans border-l-2 border-white pl-4 sm:pl-6">
                            INVOX CONNECTS THEM.
                        </p>
                    </div>
                </div>

                {/* Technical Core Philosophy Manifest */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pt-8 border-t border-zinc-900">
                    <div className="md:col-span-6">
                        <p className="text-lg sm:text-xl text-zinc-300 font-normal leading-relaxed">
                            A place where curiosity becomes conversation,
                            conversation becomes knowledge,
                            and knowledge creates connections.
                        </p>
                    </div>

                    <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                        <div className="p-4 bg-[#080808] border border-[#1a1a1a]">
                            <span className="text-[10px] text-zinc-500 block mb-1">01 // CURIOSITY ENGINE</span>
                            <p className="text-zinc-400 font-sans text-xs">
                                Questions are first-class primitives. Insights outrank algorithmic rage-bait.
                            </p>
                        </div>

                        <div className="p-4 bg-[#080808] border border-[#1a1a1a]">
                            <span className="text-[10px] text-zinc-500 block mb-1">02 // COGNITIVE SYNTHESIS</span>
                            <p className="text-zinc-400 font-sans text-xs">
                                Integrated AI provides instant one-line syntheses and multi-perspective breakdowns.
                            </p>
                        </div>

                        <div className="p-4 bg-[#080808] border border-[#1a1a1a]">
                            <span className="text-[10px] text-zinc-500 block mb-1">03 // DECENTRALIZED DISCOURSE</span>
                            <p className="text-zinc-400 font-sans text-xs">
                                Threads, queries, and deep polls engineered for depth over dopamine.
                            </p>
                        </div>

                        <div className="p-4 bg-[#080808] border border-[#1a1a1a]">
                            <span className="text-[10px] text-zinc-500 block mb-1">04 // GLOBAL TOPOLOGY</span>
                            <p className="text-zinc-400 font-sans text-xs">
                                Connect one-to-one, squad-to-squad, across time zones without friction.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};
