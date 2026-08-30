import React, { useState } from 'react';

export const DiscoverSection: React.FC = () => {
    const [selectedPollOption, setSelectedPollOption] = useState<number | null>(null);
    const [pollVotes, setPollVotes] = useState([42, 38, 20]);
    const [hasVoted, setHasVoted] = useState(false);
    const [activeTab, setActiveTab] = useState<'QUERY' | 'THREAD' | 'POLL'>('QUERY');

    const handleVote = (idx: number) => {
        if (hasVoted) return;
        const newVotes = [...pollVotes];
        newVotes[idx] += 1;
        setPollVotes(newVotes);
        setSelectedPollOption(idx);
        setHasVoted(true);
    };

    const totalVotes = pollVotes.reduce((a, b) => a + b, 0);

    return (
        <section id="discover" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// DISCOVER</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                    
                    {/* Left Column: Editorial & Description */}
                    <div className="lg:col-span-5 space-y-6">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-[1.08]">
                            QUESTIONS<br />
                            CREATE<br />
                            <span className="text-zinc-400">CONVERSATIONS.</span>
                        </h2>

                        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                            Discover is a curated arena for global knowledge exchange. Ask challenging questions, 
                            crowdsource multi-disciplinary mental models, and participate in high-signal discussions.
                        </p>

                        <div className="space-y-3 pt-2 font-mono text-xs text-zinc-400">
                            <div className="flex items-center space-x-3 p-2 bg-[#080808] border border-[#1a1a1a]">
                                <span className="w-1.5 h-1.5 bg-white"></span>
                                <span className="font-bold text-zinc-200">QUERIES</span>
                                <span className="text-zinc-500">// Direct questions answered by domain specialists</span>
                            </div>
                            <div className="flex items-center space-x-3 p-2 bg-[#080808] border border-[#1a1a1a]">
                                <span className="w-1.5 h-1.5 bg-white"></span>
                                <span className="font-bold text-zinc-200">THREADS</span>
                                <span className="text-zinc-500">// Structured long-form discourse and thesis arguments</span>
                            </div>
                            <div className="flex items-center space-x-3 p-2 bg-[#080808] border border-[#1a1a1a]">
                                <span className="w-1.5 h-1.5 bg-white"></span>
                                <span className="font-bold text-zinc-200">POLLS</span>
                                <span className="text-zinc-500">// Real-time consensus and opinion distribution metrics</span>
                            </div>
                        </div>

                        {/* Interactive Mode Selector */}
                        <div className="pt-2 flex items-center gap-2 font-mono text-xs">
                            <span className="text-zinc-500 mr-1">VIEW_FRAGMENT:</span>
                            {(['QUERY', 'THREAD', 'POLL'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-3 py-1 border transition-all ${
                                        activeTab === tab 
                                            ? 'bg-white text-black border-white font-bold' 
                                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    [{tab}]
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Floating Technical Interface Fragments */}
                    <div className="lg:col-span-7 space-y-4">
                        
                        {/* Fragment Container */}
                        <div className="bg-[#09090b] border border-[#222222] p-4 sm:p-6 relative">
                            {/* Fragment Status Bar */}
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 font-mono text-[11px] text-zinc-500">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-emerald-400"></span>
                                    <span className="text-zinc-300">DISCOVER_STREAM // {activeTab}</span>
                                </div>
                                <span>SIGNAL: HIGH // VERIFIED</span>
                            </div>

                            {/* Dynamic Fragment Content */}
                            {activeTab === 'QUERY' && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                                        <span>@elena_vasquez // ASTROPHYSICS</span>
                                        <span>14m ago</span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                                        If quantum decoherence is non-instantaneous across spatial boundaries, what are the empirical limits of macroscopic superposition?
                                    </h3>
                                    <div className="p-3 bg-[#0d0d0f] border border-zinc-800 text-xs text-zinc-300 font-mono leading-relaxed">
                                        <span className="text-zinc-500">// TOP_INSIGHT from @marcus_k (Quantum Optics Lab, MIT):</span><br />
                                        &ldquo;Recent optomechanical experiments indicate decoherence timescales scale inversely with environmental scattering cross-sections, bounding superposition at ~10^8 atomic mass units.&rdquo;
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] font-mono text-zinc-400">
                                        <div className="flex gap-4">
                                            <span className="text-emerald-400">▲ 418 Consensus</span>
                                            <span>▼ 12 Disputed</span>
                                        </div>
                                        <span>38 Deep Perspectives</span>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'THREAD' && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                                        <span>@turing_fellow // COMPUTATIONAL_NEUROSCIENCE</span>
                                        <span>1h ago</span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                                        Thesis: Continuous attractor neural networks are a necessary prerequisite for artificial conscious focus.
                                    </h3>
                                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
                                        Transformers excel at static associative retrieval, but persistent state dynamics require recurrent continuous attractors to sustain cognitive salience over non-trivial horizons.
                                    </p>
                                    <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800">#NEURAL_NETWORKS</span>
                                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800">#COGNITION</span>
                                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800">#THEORY</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] font-mono text-zinc-400">
                                        <span>92 Co-authors</span>
                                        <span>READ FULL THESIS →</span>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'POLL' && (
                                <div className="space-y-4 animate-fadeInUp">
                                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                                        <span>@global_pulse // AI_ALIGNMENT</span>
                                        <span>ACTIVE // 2,410 RESPONDENTS</span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                                        Which paradigm holds the highest probability of resolving the symbolic grounding problem?
                                    </h3>
                                    
                                    {/* Poll Options */}
                                    <div className="space-y-2 font-mono text-xs">
                                        {[
                                            'Embodied Sensorimotor Foundation Models',
                                            'Neuro-Symbolic Hybrid Graph Reasoners',
                                            'Pure Scaling of Multimodal Transformers'
                                        ].map((option, idx) => {
                                            const pct = Math.round((pollVotes[idx] / totalVotes) * 100);
                                            const isSelected = selectedPollOption === idx;
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleVote(idx)}
                                                    className={`w-full p-3 text-left border relative overflow-hidden transition-all ${
                                                        isSelected 
                                                            ? 'border-white bg-zinc-900 text-white' 
                                                            : 'border-zinc-800 bg-[#0c0c0e] text-zinc-300 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    {/* Percentage Bar Fill */}
                                                    {hasVoted && (
                                                        <div 
                                                            className="absolute left-0 top-0 bottom-0 bg-zinc-800/60 transition-all duration-500 pointer-events-none"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    )}
                                                    <div className="relative z-10 flex items-center justify-between">
                                                        <span>{option}</span>
                                                        {hasVoted && <span className="font-bold">{pct}%</span>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] font-mono text-zinc-500">
                                        <span>{hasVoted ? '✓ RESPONSE LOGGED IN LEDGER' : 'CLICK AN OPTION TO LOG VOTE'}</span>
                                        <span>TOTAL: {totalVotes}</span>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Telemetry Footer */}
                        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-600 px-1">
                            <span>// PROTOCOL: CROWD_KNOWLEDGE_V1</span>
                            <span>ENCRYPTION: VERIFIED</span>
                        </div>

                    </div>

                </div>

            </div>
        </section>
    );
};
