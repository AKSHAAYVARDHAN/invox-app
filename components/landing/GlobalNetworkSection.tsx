import React, { useState } from 'react';
import { LandingHeroGlobe } from './LandingHeroGlobe';

const NETWORK_HUBS = [
    { city: 'Tokyo', region: 'Asia-Pacific', activeComrades: '4,280', latency: '12ms', focus: 'Quantum Computing & Robotics' },
    { city: 'San Francisco', region: 'North America', activeComrades: '6,140', latency: '18ms', focus: 'AI & Cognitive Architectures' },
    { city: 'Zurich', region: 'Europe', activeComrades: '3,190', latency: '24ms', focus: 'Synthetic Biology & Cryptography' },
    { city: 'Bengaluru', region: 'South Asia', activeComrades: '5,820', latency: '15ms', focus: 'Distributed Systems & Space Tech' },
    { city: 'London', region: 'Europe', activeComrades: '4,950', latency: '20ms', focus: 'Philosophy of Mind & Economics' },
    { city: 'São Paulo', region: 'South America', activeComrades: '2,840', latency: '32ms', focus: 'Computational Ecology' },
];

export const GlobalNetworkSection: React.FC = () => {
    const [selectedHub, setSelectedHub] = useState<typeof NETWORK_HUBS[0]>(NETWORK_HUBS[0]);

    return (
        <section id="global-network" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// GLOBAL_NETWORK</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-4">
                    <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white uppercase font-sans leading-[1.05]">
                        YOUR CURIOSITY<br />
                        <span className="text-zinc-400">HAS NO BORDER.</span>
                    </h2>
                    <p className="text-zinc-300 text-base sm:text-lg leading-relaxed font-normal">
                        A borderless cognitive topology connecting researchers, creators, and independent thinkers 
                        across 140+ countries. Every spark travels at the speed of light.
                    </p>
                </div>

                {/* Main Interactive Stage */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    
                    {/* Left: Global Hubs Telemetry Drawer */}
                    <div className="lg:col-span-4 space-y-3 font-mono">
                        <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-800 pb-2 mb-3">
                            <span>ACTIVE_REGIONAL_CLUSTERS</span>
                            <span className="text-emerald-400">ALL_SYNCED</span>
                        </div>

                        {NETWORK_HUBS.map((hub) => {
                            const isSelected = selectedHub.city === hub.city;
                            return (
                                <button
                                    key={hub.city}
                                    onClick={() => setSelectedHub(hub)}
                                    className={`w-full p-3 text-left border transition-all ${
                                        isSelected 
                                            ? 'bg-zinc-950 border-white text-white' 
                                            : 'bg-[#080808] border-[#1a1a1a] text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-bold">{hub.city}</span>
                                        <span className="text-[10px] text-zinc-500">{hub.latency}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                        <span>{hub.focus}</span>
                                        <span className="text-zinc-500">{hub.activeComrades}</span>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Selected Hub Detail Card */}
                        <div className="p-3 bg-zinc-950 border border-zinc-800 mt-4 text-xs space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">// CLUSTER_INSPECTION</span>
                            <div className="text-white font-bold">{selectedHub.city} ({selectedHub.region})</div>
                            <div className="text-zinc-400 text-[11px]">Primary Domain: {selectedHub.focus}</div>
                            <div className="text-emerald-400 text-[11px] pt-1 border-t border-zinc-900 flex justify-between">
                                <span>ONLINE_COMRADES:</span>
                                <span>{selectedHub.activeComrades}</span>
                            </div>
                        </div>
                    </div>

                    {/* Center & Right: Monumental 3D Globe Visualizer */}
                    <div className="lg:col-span-8 relative flex flex-col items-center">
                        <div className="w-full aspect-square max-w-[620px] relative bg-[#050505] border border-zinc-800/80">
                            {/* Visual Reticle Corners */}
                            <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-zinc-600 z-10 pointer-events-none" />
                            <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-zinc-600 z-10 pointer-events-none" />
                            <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-zinc-600 z-10 pointer-events-none" />
                            <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-zinc-600 z-10 pointer-events-none" />

                            <div className="absolute top-4 left-4 z-10 font-mono text-[10px] text-zinc-500">
                                GEODESIC_ROUTING: MESH_ACTIVE<br />
                                NODAL_ENTROPY: 0.014
                            </div>

                            <LandingHeroGlobe />

                            <div className="absolute bottom-4 right-4 z-10 font-mono text-[10px] text-zinc-500 text-right">
                                GLOBAL_LATENCY: &lt; 28ms<br />
                                TOPOLOGY: FULLY_CONNECTED
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};
