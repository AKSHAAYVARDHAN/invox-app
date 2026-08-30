import React, { useState } from 'react';

export const EcosystemSection: React.FC = () => {
    const [activePathway, setActivePathway] = useState<'COMMUNITIES' | 'SPOTLIGHT'>('COMMUNITIES');

    return (
        <section className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// ECOSYSTEM</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                {/* Section Header */}
                <div className="max-w-3xl mb-12 sm:mb-16 space-y-4">
                    <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white uppercase font-sans leading-[1.05]">
                        IDEAS NEED<br />
                        <span className="text-zinc-400">PEOPLE.</span>
                    </h2>
                    <p className="text-zinc-300 text-base sm:text-lg leading-relaxed font-normal">
                        Curiosity is not solitary. Invox bridges collective intelligence through specialized 
                        domain communities and a global spotlight for projects, skills, and breakthrough opportunities.
                    </p>
                </div>

                {/* Two Distinct Pathways */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 font-mono">
                    
                    {/* Pathway 1: COMMUNITIES */}
                    <div 
                        onMouseEnter={() => setActivePathway('COMMUNITIES')}
                        className={`p-6 sm:p-8 bg-[#09090b] border transition-all ${
                            activePathway === 'COMMUNITIES' ? 'border-zinc-500 bg-[#0d0d10]' : 'border-zinc-800'
                        }`}
                    >
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-800 pb-3 mb-5">
                            <span>01 // GUILDS & DOMAINS</span>
                            <span className="text-white font-bold">[ COMMUNITIES ]</span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-bold text-white uppercase font-sans tracking-tight mb-3">
                            Find people around shared interests.
                        </h3>

                        <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed mb-6">
                            Join specialized, high-reputation knowledge domains. Participate in moderated discussions, 
                            access shared literature repositories, and co-curate community knowledge graphs.
                        </p>

                        <div className="space-y-2 text-xs">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">// ACTIVE_COMMUNITIES</span>
                            {[
                                { name: 'Quantum Optics & Decoherence', members: '1.8k Comrades', spark: '99% Signal' },
                                { name: 'Synthetic Genomics Lab', members: '2.4k Comrades', spark: '98% Signal' },
                                { name: 'Epistemology & Rationality', members: '3.1k Comrades', spark: '97% Signal' },
                            ].map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 bg-black border border-zinc-800/80 text-zinc-300">
                                    <span className="truncate">{c.name}</span>
                                    <span className="text-[10px] text-zinc-500 ml-2 shrink-0">{c.members}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pathway 2: SPOTLIGHT */}
                    <div 
                        onMouseEnter={() => setActivePathway('SPOTLIGHT')}
                        className={`p-6 sm:p-8 bg-[#09090b] border transition-all ${
                            activePathway === 'SPOTLIGHT' ? 'border-zinc-500 bg-[#0d0d10]' : 'border-zinc-800'
                        }`}
                    >
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-800 pb-3 mb-5">
                            <span>02 // PORTFOLIO & OPPORTUNITIES</span>
                            <span className="text-white font-bold">[ SPOTLIGHT ]</span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-bold text-white uppercase font-sans tracking-tight mb-3">
                            Showcase your work, skills, and projects.
                        </h3>

                        <p className="text-zinc-400 text-xs sm:text-sm font-sans leading-relaxed mb-6">
                            Publish your breakthrough builds, research papers, and technical blueprints. 
                            Discover cross-border research grants, squad co-founder opportunities, and global fellowships.
                        </p>

                        <div className="space-y-2 text-xs">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">// FEATURED_OPPORTUNITIES</span>
                            {[
                                { title: 'Decentralized Zero-Knowledge Compute Mesh', type: 'CO-FOUNDER // GRANT', host: '@helios_lab' },
                                { title: 'Spiking Neural Network Silicon Lead', type: 'CORE SQUAD', host: '@axon_neural' },
                                { title: 'Philosophy of AGI Alignment Fellowship', type: 'RESEARCH GRANT', host: '@curiosity_fund' },
                            ].map((opp, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 bg-black border border-zinc-800/80 text-zinc-300">
                                    <div className="truncate">
                                        <div className="font-bold text-white truncate">{opp.title}</div>
                                        <div className="text-[10px] text-zinc-500">{opp.host}</div>
                                    </div>
                                    <span className="text-[9px] px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-300 ml-2 shrink-0">
                                        {opp.type}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};
