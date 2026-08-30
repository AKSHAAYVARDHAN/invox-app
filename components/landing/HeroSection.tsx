import React, { useState } from 'react';
import { LandingHeroGlobe } from './LandingHeroGlobe';

interface HeroSectionProps {
    onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenAuth }) => {
    const [inspectedNode, setInspectedNode] = useState<{ label: string; metric: string; details: string } | null>(null);

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
        <section className="relative min-h-[92vh] flex flex-col justify-center bg-black border-b border-[#222222] pt-20 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
            {/* Minimal Grid Coordinates Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                    
                    {/* Left Column: Technical Typography & Primary Action */}
                    <div className="lg:col-span-6 flex flex-col justify-center space-y-6 sm:space-y-8">
                        {/* Technical Category Pill */}
                        <div className="flex items-center space-x-3">
                            <div className="inline-flex items-center space-x-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                                <span className="w-1.5 h-1.5 bg-white animate-ping"></span>
                                <span className="text-zinc-300">// GLOBAL_CURIOSITY_NETWORK</span>
                            </div>
                            <span className="font-mono text-[11px] text-zinc-600 tracking-wider hidden sm:inline">LOC // 0.0.0.0</span>
                        </div>

                        {/* Main Headline */}
                        <div className="space-y-2">
                            <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-bold tracking-tight text-white uppercase leading-[1.02]">
                                <span className="block text-zinc-400">FUEL</span>
                                <span className="block text-white tracking-tighter">CURIOSITY.</span>
                            </h1>
                            <div className="flex items-center space-x-3 pt-1">
                                <span className="font-mono text-xs sm:text-sm text-zinc-500 uppercase tracking-widest">
                                    THINK. QUESTION. CONNECT.
                                </span>
                            </div>
                        </div>

                        {/* Subtitle Statement */}
                        <p className="text-base sm:text-lg text-zinc-300 max-w-xl font-normal leading-relaxed">
                            A global space for curious minds to discover ideas,
                            share perspectives, and connect with people who
                            think differently.
                        </p>

                        {/* Primary & Secondary Call to Actions */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 font-mono">
                            <button
                                onClick={() => onOpenAuth('signup')}
                                className="px-6 sm:px-8 py-3 bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold tracking-widest uppercase border border-white hover:border-zinc-300 transition-all flex items-center group"
                            >
                                <span>[ ENTER INVOX ]</span>
                                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                            </button>

                            <button
                                onClick={() => scrollToSection('what-is-invox')}
                                className="px-5 sm:px-6 py-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs sm:text-sm font-medium tracking-wider uppercase border border-zinc-800 hover:border-zinc-700 transition-all"
                            >
                                [ DISCOVER INVOX ]
                            </button>
                        </div>

                        {/* Diagnostic Indicators */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-zinc-900 font-mono">
                            <div className="p-2.5 bg-[#080808] border border-[#1a1a1a]">
                                <span className="text-[10px] text-zinc-500 block uppercase">// NETWORK_STATUS</span>
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1 h-1 bg-emerald-400"></span>
                                    ONLINE
                                </span>
                            </div>
                            <div className="p-2.5 bg-[#080808] border border-[#1a1a1a]">
                                <span className="text-[10px] text-zinc-500 block uppercase">// ACTIVE_NODES</span>
                                <span className="text-xs font-bold text-white mt-0.5 block">42.8K</span>
                            </div>
                            <div className="p-2.5 bg-[#080808] border border-[#1a1a1a]">
                                <span className="text-[10px] text-zinc-500 block uppercase">// CONNECTIONS</span>
                                <span className="text-xs font-bold text-zinc-300 mt-0.5 block">1.2M+</span>
                            </div>
                            <div className="p-2.5 bg-[#080808] border border-[#1a1a1a]">
                                <span className="text-[10px] text-zinc-500 block uppercase">// CURIOSITY_INDEX</span>
                                <span className="text-xs font-bold text-white mt-0.5 block">ACTIVE</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: 3D Interactive Network Globe */}
                    <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
                        <div className="w-full aspect-square max-w-[540px] relative">
                            {/* Visual Corner Framing Accents */}
                            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-zinc-700 z-10 pointer-events-none" />
                            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-zinc-700 z-10 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-zinc-700 z-10 pointer-events-none" />
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-zinc-700 z-10 pointer-events-none" />

                            <LandingHeroGlobe onNodeSelect={(node) => setInspectedNode(node)} />

                            {/* Node Telemetry Box if inspected */}
                            {inspectedNode && (
                                <div className="absolute bottom-3 left-3 z-30 bg-black/95 border border-zinc-700 p-3 max-w-[260px] font-mono text-left shadow-2xl animate-fadeInUp">
                                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pb-1 border-b border-zinc-800">
                                        <span>CLUSTER_TELEMETRY</span>
                                        <button 
                                            onClick={() => setInspectedNode(null)}
                                            className="text-zinc-500 hover:text-white ml-2 px-1"
                                        >
                                            [×]
                                        </button>
                                    </div>
                                    <p className="text-xs font-bold text-white mt-1.5 truncate">{inspectedNode.label}</p>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">{inspectedNode.details}</p>
                                    <div className="mt-2 pt-1 border-t border-zinc-800 text-[10px] text-emerald-400 flex items-center justify-between">
                                        <span>METRIC:</span>
                                        <span>{inspectedNode.metric}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};
