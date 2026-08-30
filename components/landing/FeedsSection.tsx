import React, { useState } from 'react';

interface FeedItem {
    id: string;
    channel: string;
    channelTag: string;
    type: 'ARTICLE' | 'POST' | 'VIDEO' | 'DISCUSSION';
    title: string;
    aiSummary: string;
    excerpt: string;
    timestamp: string;
    stats: { reads: string; sparks: number };
}

const FEED_ITEMS: FeedItem[] = [
    {
        id: 'f1',
        channel: 'Astrobiology & Extrasolar Physics',
        channelTag: '// CH_ASTRO_9',
        type: 'ARTICLE',
        title: 'Atmospheric Methane Disequilibrium in Habitable Zone Super-Earths',
        aiSummary: 'Spectroscopic analysis reveals non-equilibrium trace gases suggesting potential biological methanogenesis beyond our solar system.',
        excerpt: 'Using transmission spectroscopy from the next-generation space arrays, we isolated isotopic carbon anomalies in Kepler-452b analogues...',
        timestamp: '18m ago',
        stats: { reads: '3.4k', sparks: 284 }
    },
    {
        id: 'f2',
        channel: 'Cybernetics & Neural Synthesis',
        channelTag: '// CH_NEURO_4',
        type: 'VIDEO',
        title: 'Real-time EEG Phase-Locking in Brain-Computer Co-Adaptive Arrays',
        aiSummary: 'Demonstrates sub-10ms latency closed-loop neural decoding using sparse spiking networks.',
        excerpt: 'Direct demonstration of bidirectional cortical stimulation with adaptive impedance calibration...',
        timestamp: '42m ago',
        stats: { reads: '6.1k', sparks: 512 }
    },
    {
        id: 'f3',
        channel: 'Philosophy of Computational Mind',
        channelTag: '// CH_PHIL_2',
        type: 'DISCUSSION',
        title: 'The Hard Problem of Content: When Does Computation Become Representation?',
        aiSummary: 'A rigorous critique of functionalism arguing syntax cannot generate intrinsic semantics without embodied causal loops.',
        excerpt: 'If representation is purely computational, we must account for teleological reference without presupposing intentionality...',
        timestamp: '2h ago',
        stats: { reads: '2.8k', sparks: 195 }
    }
];

export const FeedsSection: React.FC = () => {
    const [selectedFeedIndex, setSelectedFeedIndex] = useState(0);
    const activeFeed = FEED_ITEMS[selectedFeedIndex];

    return (
        <section id="feeds" className="py-24 sm:py-32 bg-black border-b border-[#222222] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header Tag */}
                <div className="flex items-center space-x-3 mb-10">
                    <span className="font-mono text-xs text-zinc-500 tracking-widest uppercase">// FEEDS</span>
                    <span className="h-px bg-zinc-800 flex-1 max-w-xs"></span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                    
                    {/* Left Column: Editorial & Philosophy */}
                    <div className="lg:col-span-5 space-y-6">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white uppercase font-sans leading-[1.08]">
                            IDEAS<br />
                            WORTH<br />
                            <span className="text-zinc-400">FOLLOWING.</span>
                        </h2>

                        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                            Explore videos, articles, research posts, and discussions from leading thinkers and specialized channels. 
                            Zero algorithmic noise, pure high-density curiosity.
                        </p>

                        {/* AI Summary Highlight Feature */}
                        <div className="p-4 bg-[#09090b] border border-zinc-800 space-y-2 font-mono text-xs">
                            <div className="flex items-center space-x-2 text-zinc-400">
                                <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                                <span className="font-bold text-white uppercase">// AI-GENERATED SYNTHESIS</span>
                            </div>
                            <p className="text-zinc-400 font-sans text-xs">
                                Every feed item features an instant, high-precision AI summary generated before you read, 
                                respecting your cognitive bandwidth.
                            </p>
                        </div>

                        {/* Channel selector buttons */}
                        <div className="space-y-2 pt-2 font-mono text-xs">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">// SELECT_CHANNEL_STREAM</span>
                            {FEED_ITEMS.map((item, idx) => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedFeedIndex(idx)}
                                    className={`w-full p-2.5 text-left border flex items-center justify-between transition-all ${
                                        selectedFeedIndex === idx
                                            ? 'bg-zinc-900 border-white text-white font-bold'
                                            : 'bg-[#080808] border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                                    }`}
                                >
                                    <div className="truncate">
                                        <span className="text-zinc-500 text-[10px] mr-2">{item.channelTag}</span>
                                        <span>{item.channel}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 ml-2 shrink-0">[{item.type}]</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Feed Reader Fragment Preview */}
                    <div className="lg:col-span-7">
                        <div className="bg-[#09090b] border border-[#222222] p-5 sm:p-7 relative font-mono">
                            {/* Top Metadata Bar */}
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 text-[11px] text-zinc-500">
                                <div className="flex items-center space-x-2">
                                    <span className="w-1.5 h-1.5 bg-white"></span>
                                    <span className="text-zinc-300 font-bold">{activeFeed.channel}</span>
                                </div>
                                <span>{activeFeed.timestamp}</span>
                            </div>

                            {/* Prominent AI Summary Banner */}
                            <div className="p-3.5 bg-zinc-950 border border-zinc-800 mb-5 relative">
                                <div className="flex items-center space-x-2 text-[10px] text-emerald-400 mb-1 font-bold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse"></span>
                                    <span>AI_ONE_LINE_SYNTHESIS</span>
                                </div>
                                <p className="text-xs text-zinc-200 font-sans italic leading-relaxed">
                                    &ldquo;{activeFeed.aiSummary}&rdquo;
                                </p>
                            </div>

                            {/* Main Title & Excerpt */}
                            <div className="space-y-3 mb-6">
                                <span className="inline-block px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-widest">
                                    // {activeFeed.type}
                                </span>
                                <h3 className="text-lg sm:text-xl font-bold text-white font-sans tracking-tight">
                                    {activeFeed.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
                                    {activeFeed.excerpt}
                                </p>
                            </div>

                            {/* Feed Footer Telemetry */}
                            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                                <div className="flex items-center space-x-4">
                                    <span className="text-zinc-300">★ {activeFeed.stats.sparks} Sparks</span>
                                    <span>{activeFeed.stats.reads} Insights Logged</span>
                                </div>
                                <span className="text-zinc-400 hover:text-white cursor-pointer uppercase tracking-wider">
                                    [ FOLLOW_CHANNEL ]
                                </span>
                            </div>
                        </div>

                        {/* Subtle Diagnostic Caption */}
                        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-zinc-600 px-1">
                            <span>FEED_DISTRIBUTION: REALTIME_P2P</span>
                            <span>CURATION: KNOWLEDGE_GRAPH_WEIGHTED</span>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};
