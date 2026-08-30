import React, { useState } from 'react';

interface TransformationSample {
    idea: string;
    title: string;
    summary: string;
    content: string;
    tags: string[];
}

const SAMPLES: TransformationSample[] = [
    {
        idea: "Why does spacetime curve near relativistic mass?",
        title: "Geodesic Trajectories in Non-Euclidean Metrics: Visualizing Gravitational Curvature",
        summary: "Mass-energy density dictates the Christoffel symbols of Riemannian manifolds, transforming straight lines into geodesic curves.",
        content: "Rather than an invisible Newtonian pull, gravitation represents inertia traversing curved spacetime manifolds. When an object free-falls toward a celestial body, it follows an unaccelerated path in curved 4-dimensional geometry...",
        tags: ["#RELATIVITY", "#DIFFERENTIAL_GEOMETRY", "#COSMOLOGY"]
    },
    {
        idea: "The evolutionary advantage of dreaming in mammalian brains",
        title: "Synaptic Downscaling and Generative Replay: The Neuro-computational Basis of Sleep",
        summary: "Dream states act as generative adversarial simulations that prevent overfitting to daily empirical inputs while consolidating long-term semantic graphs.",
        content: "During REM sleep, synchronized hippocampal theta waves replay compressed episodic sequences to the neocortex. This off-line reorganization selectively prunes redundant synaptic weights...",
        tags: ["#NEUROSCIENCE", "#SYNAPTIC_PLASTICITY", "#EVOLUTION"]
    },
    {
        idea: "Decentralized autonomous consensus without proof-of-work waste",
        title: "Asynchronous Byzantine Agreement via Verifiable Random Functions and Directed Acyclic Graphs",
        summary: "Replacing energy-intensive cryptographic hashing with algebraic zero-knowledge proofs and partial-order consensus topologies.",
        content: "By decoupling transaction ingestion from block finality, DAG-based consensus mechanisms achieve sub-second deterministic finality while consuming negligible electrical wattage...",
        tags: ["#DISTRIBUTED_SYSTEMS", "#CRYPTOGRAPHY", "#CONSENSUS"]
    }
];

export const AiCreationSection: React.FC = () => {
    const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simStep, setSimStep] = useState(5); // 5 = fully synthesized

    const currentSample = SAMPLES[selectedSampleIndex];

    const runSimulation = (idx: number) => {
        setSelectedSampleIndex(idx);
        setIsSimulating(true);
        setSimStep(1);

        const timers = [
            setTimeout(() => setSimStep(2), 250),
            setTimeout(() => setSimStep(3), 500),
            setTimeout(() => setSimStep(4), 750),
            setTimeout(() => {
                setSimStep(5);
                setIsSimulating(false);
            }, 1000)
        ];

        return () => timers.forEach(t => clearTimeout(t));
    };

    return (
        <section id="ai-creation" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// INTELLIGENCE_LAYER</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                    
                    {/* Left Column: Editorial & Sequence Pipeline */}
                    <div className="lg:col-span-5 space-y-6">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-[1.08]">
                            AN IDEA<br />
                            IS ENOUGH.
                        </h2>

                        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                            Give Invox a raw thought, question, or research note. The integrated AI intelligence layer 
                            structures it into a publication-ready feed, complete with title synthesis, 
                            concise summary, and verified domain taxonomies.
                        </p>

                        {/* Pipeline Sequence Visualizer */}
                        <div className="pt-2 font-mono text-xs space-y-1.5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">// CREATION_PIPELINE</span>
                            {[
                                { step: '01', label: 'RAW_IDEA', desc: 'Single prompt or hypothesis' },
                                { step: '02', label: 'INTELLIGENCE_ENGINE', desc: 'Multi-step reasoning & decomposition' },
                                { step: '03', label: 'TITLE_SYNTHESIS', desc: 'High-signal academic naming' },
                                { step: '04', label: 'CONTENT_STRUCTURE', desc: 'Detailed arguments & citations' },
                                { step: '05', label: 'VISUAL_ENHANCEMENT', desc: 'Contextual framing & schema' },
                                { step: '06', label: 'ONE_TAP_PUBLISH', desc: 'Direct broadcast to global network' },
                            ].map((item, idx) => (
                                <div 
                                    key={item.step}
                                    className={`flex items-center space-x-3 p-2 border transition-all ${
                                        simStep >= idx + 1 
                                            ? 'bg-zinc-950 border-zinc-800 text-zinc-200' 
                                            : 'bg-black border-zinc-900 text-zinc-600'
                                    }`}
                                >
                                    <span className="text-[10px] text-zinc-500 font-bold">{item.step}</span>
                                    <span className="text-white font-bold">{item.label}</span>
                                    <span className="text-zinc-500 text-[11px] hidden sm:inline">→ {item.desc}</span>
                                </div>
                            ))}
                        </div>

                        {/* Seed Trigger Buttons */}
                        <div className="pt-3 font-mono text-xs space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// TEST_SEED_IDEAS:</span>
                            <div className="flex flex-col gap-1.5">
                                {SAMPLES.map((sample, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => runSimulation(idx)}
                                        className={`p-2 text-left border transition-all truncate text-xs ${
                                            selectedSampleIndex === idx
                                                ? 'bg-white text-black border-white font-bold'
                                                : 'bg-[#09090b] text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                                        }`}
                                    >
                                        &ldquo;{sample.idea}&rdquo;
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Interactive Synthesis Output Preview */}
                    <div className="lg:col-span-7">
                        <div className="bg-[#09090b] border border-[#222222] p-5 sm:p-7 relative font-mono space-y-5">
                            
                            {/* Pipeline Status Header */}
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[11px] text-zinc-500">
                                <div className="flex items-center space-x-2">
                                    <span className={`w-2 h-2 ${isSimulating ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
                                    <span className="text-zinc-300">
                                        {isSimulating ? `SYNTHESIZING_LAYER_0${simStep}...` : 'SYNTHESIS_COMPLETE // READY_TO_PUBLISH'}
                                    </span>
                                </div>
                                <span>LATENCY: 48ms</span>
                            </div>

                            {/* Raw Input Idea Box */}
                            <div className="p-3 bg-black border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 block mb-1 uppercase">// INPUT_SEED</span>
                                <p className="text-xs text-zinc-200 font-mono">
                                    &ldquo;{currentSample.idea}&rdquo;
                                </p>
                            </div>

                            {/* Downward Transition Indicator */}
                            <div className="flex justify-center -my-2 text-zinc-600 text-xs">
                                ↓ [AI_DECOMPOSITION_LAYER]
                            </div>

                            {/* Synthesized Output Card */}
                            <div className="p-4 bg-zinc-950 border border-zinc-700/80 space-y-3">
                                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                    <span className="text-emerald-400 uppercase font-bold">// GENERATED_FEED_SPEC</span>
                                    <span>AUTH_READY</span>
                                </div>

                                <h3 className="text-sm sm:text-base font-bold text-white font-sans tracking-tight">
                                    {currentSample.title}
                                </h3>

                                <div className="p-2.5 bg-[#09090b] border border-zinc-800 text-[11px] text-zinc-300 font-sans italic">
                                    <span className="text-zinc-500 font-mono not-italic text-[10px] block mb-0.5">// AI_SUMMARY</span>
                                    {currentSample.summary}
                                </div>

                                <p className="text-xs text-zinc-400 font-sans leading-relaxed line-clamp-3">
                                    {currentSample.content}
                                </p>

                                <div className="flex flex-wrap gap-1.5 pt-2">
                                    {currentSample.tags.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Action Bar */}
                            <div className="pt-2 flex items-center justify-between border-t border-zinc-800 text-xs">
                                <span className="text-zinc-500 text-[11px]">TEXT_TO_FEED_ENGINE_v4</span>
                                <div className="px-4 py-1.5 bg-white text-black font-bold uppercase tracking-wider text-[11px]">
                                    [ ONE-TAP PUBLISH ]
                                </div>
                            </div>

                        </div>

                        {/* Diagnostics */}
                        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-zinc-600 px-1">
                            <span>MODEL: GEMINI_3_FLASH // ZERO_LATENCY</span>
                            <span>PRECISION: DETERMINISTIC_STRUCTURED</span>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};
