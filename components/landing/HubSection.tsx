import React, { useState } from 'react';

export const HubSection: React.FC = () => {
    const [activeHubMode, setActiveHubMode] = useState<'COMRADES' | 'SQUADS' | 'CONNECT'>('COMRADES');

    const hubModes = {
        COMRADES: {
            title: 'COMRADES',
            subtitle: 'One-to-one deep intellectual conversations',
            description: 'Direct asynchronous and synchronous messaging with thinkers who match your exact curiosity graph and research frequency.',
            telemetry: 'LATENCY: 8ms // E2E ENCRYPTED // 1:1 DIRECT MESH',
            visualNodes: ['@you (Curious Node)', '@marcus (MIT Optics)', 'Direct Stream Active']
        },
        SQUADS: {
            title: 'SQUADS',
            subtitle: 'Collaborative mission and project groups',
            description: 'Focused squads organized around specific hypotheses, open-source architectures, paper co-authoring, and technical builds.',
            telemetry: 'PEERS: 8 ACTIVE // REAL-TIME CODE & WHITEBOARD SYNC',
            visualNodes: ['@you', '@elena (Zurich)', '@chen (Tokyo)', '@maya (London)', 'Multi-Peer Mesh Sync']
        },
        CONNECT: {
            title: 'CONNECT',
            subtitle: 'Low-latency voice, video & real-time collaboration',
            description: 'Instant multi-modal collaborative voice rooms and video huddles with integrated live AI meeting transcription and synthesis.',
            telemetry: 'AUDIO_CODEC: OPUS 48kHz // ZERO_JITTER // AI_TRANSCRIBING',
            visualNodes: ['Voice Grid Active', 'AI Synthesis Co-Pilot', 'Zero-Loss Spatial Audio']
        }
    };

    const currentMode = hubModes[activeHubMode];

    return (
        <section id="hub-section" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// HUB</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    
                    {/* Left Column: Typography & Selector */}
                    <div className="lg:col-span-6 space-y-6">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-[1.08]">
                            FIND YOUR<br />
                            <span className="text-zinc-400">PEOPLE.</span>
                        </h2>

                        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                            Meaningful connection begins with shared curiosity. Hub provides the infrastructure for 
                            direct dialogue, project squads, and real-time collaborative thinking.
                        </p>

                        {/* Mode Selector Buttons */}
                        <div className="space-y-2 pt-2 font-mono text-xs">
                            {(['COMRADES', 'SQUADS', 'CONNECT'] as const).map(mode => {
                                const isSelected = activeHubMode === mode;
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setActiveHubMode(mode)}
                                        className={`w-full p-3.5 text-left border transition-all ${
                                            isSelected
                                                ? 'bg-zinc-950 border-white text-white font-bold'
                                                : 'bg-[#080808] border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm tracking-wider uppercase">{hubModes[mode].title}</span>
                                            <span className="text-[10px] text-zinc-500">// {mode === 'COMRADES' ? '1-TO-1' : mode === 'SQUADS' ? 'GROUPS' : 'VOICE_VIDEO'}</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 font-sans mt-1">
                                            {hubModes[mode].subtitle}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Connection Mesh Topology Visualization */}
                    <div className="lg:col-span-6">
                        <div className="bg-[#09090b] border border-[#222222] p-6 sm:p-8 font-mono space-y-6 relative">
                            
                            {/* Status Header */}
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[11px] text-zinc-500">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-emerald-400 animate-pulse"></span>
                                    <span className="text-zinc-300 uppercase">HUB_TOPOLOGY // {currentMode.title}</span>
                                </div>
                                <span>SIGNAL: OPTIMAL</span>
                            </div>

                            {/* Dynamic Connection Architecture Node Graph */}
                            <div className="p-6 bg-black border border-zinc-800 relative min-h-[220px] flex flex-col justify-center items-center">
                                {/* Geometric grid background */}
                                <div className="absolute inset-0 bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                                {/* Interactive Connected Nodes Display */}
                                <div className="relative z-10 w-full space-y-3">
                                    <div className="text-center">
                                        <span className="px-3 py-1 bg-zinc-900 border border-zinc-700 text-xs font-bold text-white uppercase tracking-widest inline-block">
                                            {currentMode.title} TOPOLOGY
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                        {currentMode.visualNodes.map((nodeLabel, idx) => (
                                            <div 
                                                key={idx}
                                                className="px-3 py-1.5 bg-[#0e0e11] border border-zinc-800 text-xs text-zinc-200 flex items-center gap-2 shadow-sm animate-fadeInUp"
                                            >
                                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-none"></span>
                                                <span>{nodeLabel}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-xs text-zinc-400 font-sans text-center max-w-md mx-auto pt-3 leading-relaxed">
                                        {currentMode.description}
                                    </p>
                                </div>
                            </div>

                            {/* Telemetry Footer */}
                            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
                                <span className="text-zinc-400">{currentMode.telemetry}</span>
                            </div>

                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};
