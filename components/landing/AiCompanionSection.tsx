import React, { useState } from 'react';

const THOUGHT_TRACES = [
    {
        prompt: "Synthesizing cross-disciplinary correlations: Thermodynamics x Information Theory",
        response: "Landauer's principle establishes that erasing 1 bit of information dissipates kT ln(2) of heat into the environment. Reversible computation offers a zero-dissipation boundary condition for next-generation quantum computing.",
        latency: "12ms"
    },
    {
        prompt: "Deconstructing epistemological consensus on the Fermi Paradox",
        response: "Filtering 14 potential resolutions: percolation theory in interstellar colonization indicates spatial clustering leaves vast uncontacted voids without requiring universal species extinction.",
        latency: "18ms"
    },
    {
        prompt: "Finding unexplored research vectors in Biomimetic Neural Arrays",
        response: "Identified 3 unmapped intersections: utilizing fungal mycelial conduction matrices as memristive reservoirs for low-power edge classification.",
        latency: "15ms"
    }
];

export const AiCompanionSection: React.FC = () => {
    const [activeTraceIndex, setActiveTraceIndex] = useState(0);
    const trace = THOUGHT_TRACES[activeTraceIndex];

    return (
        <section id="companion" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// COMPANION</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    
                    {/* Left Column: Mysterious Editorial */}
                    <div className="lg:col-span-5 space-y-6">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-[1.08]">
                            DON&apos;T JUST SEARCH.<br />
                            <span className="text-zinc-400">THINK WITH IT.</span>
                        </h2>

                        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                            Not a generic assistant or customer bot. The Invox AI Companion is a personalized cognitive 
                            co-pilot that understands your research context, assists with hypothesis synthesis, 
                            and challenges your assumptions.
                        </p>

                        <div className="space-y-3 pt-2 font-mono text-xs text-zinc-400">
                            <div className="p-3 bg-[#080808] border border-[#1a1a1a] flex items-center justify-between">
                                <span>// DEEP_BRAINSTORMING</span>
                                <span className="text-zinc-500">CROSS_DISCIPLINARY</span>
                            </div>
                            <div className="p-3 bg-[#080808] border border-[#1a1a1a] flex items-center justify-between">
                                <span>// CONTEXT_AWARE_SYNTHESIS</span>
                                <span className="text-zinc-500">AUTO_SUMMARIZE</span>
                            </div>
                            <div className="p-3 bg-[#080808] border border-[#1a1a1a] flex items-center justify-between">
                                <span>// KNOWLEDGE_GRAPH_DISCOVERY</span>
                                <span className="text-zinc-500">SEMANTIC_SEARCH</span>
                            </div>
                        </div>

                        {/* Prompt Selector */}
                        <div className="pt-2 font-mono text-xs space-y-1.5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// INITIATE_COGNITIVE_TRACE:</span>
                            {THOUGHT_TRACES.map((t, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveTraceIndex(idx)}
                                    className={`w-full p-2 text-left border transition-all truncate text-xs ${
                                        activeTraceIndex === idx 
                                            ? 'bg-white text-black border-white font-bold' 
                                            : 'bg-zinc-950 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-white'
                                    }`}
                                >
                                    &gt; {t.prompt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Translucent Holographic AI Visualizer */}
                    <div className="lg:col-span-7">
                        <div className="bg-[#09090b] border border-[#222222] p-6 sm:p-8 font-mono space-y-6 relative overflow-hidden">
                            
                            {/* Visual background atmospheric matrix */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 pointer-events-none" />

                            {/* Companion Status Bar */}
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[11px] text-zinc-500 relative z-10">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-emerald-400 animate-pulse"></span>
                                    <span className="text-zinc-300 font-bold">INVOX_COGNITIVE_CORES // ONLINE</span>
                                </div>
                                <span>INFERENCE: {trace.latency}</span>
                            </div>

                            {/* Translucent Thought Matrix Canvas Frame */}
                            <div className="p-5 bg-black/80 border border-zinc-800 space-y-4 relative z-10">
                                
                                {/* Orbital Thinking Header */}
                                <div className="flex items-center space-x-3 text-xs text-zinc-500">
                                    <div className="w-6 h-6 border border-zinc-700 flex items-center justify-center text-[10px] text-emerald-400 animate-spin">
                                        ◇
                                    </div>
                                    <span className="text-zinc-300 font-bold uppercase tracking-wider">// COGNITIVE_REASONING_STREAM</span>
                                </div>

                                {/* Active Inquiry */}
                                <div className="p-3 bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-mono">
                                    <span className="text-zinc-500 block text-[10px] uppercase mb-0.5">// INQUIRY</span>
                                    &ldquo;{trace.prompt}&rdquo;
                                </div>

                                {/* Companion Synthetic Output */}
                                <div className="p-3.5 bg-[#0e0e11] border border-zinc-700/80 text-xs text-zinc-200 leading-relaxed font-sans animate-fadeInUp">
                                    <span className="text-emerald-400 font-mono text-[10px] block mb-1 uppercase tracking-wider">
                                        // SYNTHESIZED_PERSPECTIVE
                                    </span>
                                    {trace.response}
                                </div>
                            </div>

                            {/* Telemetry Diagnostics */}
                            <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-1 relative z-10">
                                <span>CONTEXT_WINDOW: 2M_TOKENS</span>
                                <span>MODEL: GEMINI_FLASH_REASONER</span>
                            </div>

                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};
