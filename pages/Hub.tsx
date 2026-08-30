
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, StreamLoop, HubConversation } from '../types';
import MomentCard from '../components/stream/MomentCard';
import MomentCardSkeleton from '../components/stream/MomentCardSkeleton';
import LoopCard from '../components/stream/LoopCard';
import LoopCardSkeleton from '../components/stream/LoopCardSkeleton';
import ChatInterface from '../components/hub/ChatInterface';
import InteractiveGlobe from '../components/hub/InteractiveGlobe';
import { CubeIcon, ChatBubbleBottomCenterTextIcon, SparklesIcon, RadioIcon } from '../components/ui/Icons';

const mockMoments: StreamMoment[] = [
    {
        id: 'moment-1',
        author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200', isVerified: true },
        aiSummary: "A breathtaking shot of a person walking on a suspension bridge through mountains at sunrise.",
        content: "There's nothing quite like the feeling of walking on air, suspended between mountains as the sun paints the sky. This was one of those mornings that stays with you forever, a perfect blend of adventure and serenity. The sheer scale of nature here is humbling, and every step felt like a step into a dream.",
        mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        type: 'Stills',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
    },
    {
        id: 'moment-2',
        author: { name: 'Jane Doe', avatarUrl: 'https://picsum.photos/seed/jane-doe/200' },
        aiSummary: "A serene video of a tranquil lake reflecting a dramatic cloudy sky.",
        content: "Found this hidden gem during a weekend drive. The water was so still it perfectly mirrored the dramatic sky above. It was a powerful reminder to pause and appreciate the quiet moments. The world has so much beauty to offer if we just take a moment to look.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?q=80&w=1280&h=720&auto=format&fit=crop',
        mediaType: 'video',
        type: 'Tapes',
        stats: { likes: 120000, views: 55000000, comments: 18000 },
    },
    {
        id: 'moment-3',
        author: { name: 'Artisan Alex', avatarUrl: 'https://picsum.photos/seed/alex-art/200' },
        aiSummary: "An artist's hands skillfully molding clay on a potter's wheel.",
        content: "There is a meditative quality to working with clay. Every spin of the wheel is a chance to shape something new, to bring an idea to life with your own hands. This latest piece is taking a lot of patience, but I'm loving the process and can't wait to see the final result. #Pottery #Handmade #Artisan",
        mediaUrl: 'https://images.unsplash.com/photo-1547891654-e66ed7110189?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        type: 'Knacks',
        stats: { likes: 45000, views: 12000000, comments: 7500 },
    },
    {
        id: 'moment-4',
        author: { name: 'GamerGirl92', avatarUrl: 'https://picsum.photos/seed/gamer/200', isVerified: true },
        aiSummary: "An animated video showcasing a dramatic scene with large, fantastical creatures.",
        content: "My heart is still racing from this one! Down to the last second, pulled off a 1v3 clutch to secure the win for the team. Moments like these are why I love gaming. The adrenaline rush is just unmatched, and sharing it with the community makes it even better! #Gaming #Clutch #EpicWin",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1280&h=720&auto=format&fit=crop',
        mediaType: 'video',
        type: 'Knacks',
        stats: { likes: 98000, views: 32000000, comments: 14000 },
    }
];

const mockLoops: StreamLoop[] = [
    { id: 'l1', author: { name: 'Adams', avatarUrl: 'https://picsum.photos/seed/201/200' }, category: 'Zaps', title: 'Tactical Cyber Setup', content: "Real-time surveillance matrix deployed.", imageUrl: 'https://picsum.photos/seed/zap/400/600' },
    { id: 'l2', author: { name: 'Lisa Jones', avatarUrl: 'https://picsum.photos/seed/202/200' }, category: 'Mood', title: 'Atmospheric Resonance', content: 'Dark wave synthesizer session recordings.', imageUrl: 'https://picsum.photos/seed/mood/400/600' },
    { id: 'l3', author: { name: 'Harvey', avatarUrl: 'https://picsum.photos/seed/203/200' }, category: 'Thought', title: 'Network Theory', content: 'Decentralized collective node synchronizations.', imageUrl: 'https://picsum.photos/seed/thought/400/600' },
    { id: 'l4', author: { name: 'Akshaay', avatarUrl: 'https://picsum.photos/seed/204/200' }, category: 'Music', title: 'Midnight Protocol', content: 'Low-latency broadcast streams.', imageUrl: 'https://picsum.photos/seed/music/400/600' },
];

const HubPage = () => {
    const { 
        setRightSidebarVariant, 
        hubView,
        selectedHubConversation,
        setSelectedHubConversation,
        updateHubConversation,
    } = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        hubView: string;
        selectedHubConversation: HubConversation | null;
        setSelectedHubConversation: (conversation: HubConversation | null) => void;
        updateHubConversation: (conversation: HubConversation) => void;
    }>();

    const [activeStreamTab, setActiveStreamTab] = useState<'Moments' | 'Loops'>('Moments');
    const [activeMomentsFilter, setActiveMomentsFilter] = useState('All');
    const [streamLoading, setStreamLoading] = useState(true);

    useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('hub');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
        };
    }, [setRightSidebarVariant]);

    useEffect(() => {
        if (hubView === 'stream') {
            setStreamLoading(true);
            const timer = setTimeout(() => setStreamLoading(false), 900);
            return () => clearTimeout(timer);
        }
    }, [hubView, activeStreamTab, activeMomentsFilter]);
    
    if (selectedHubConversation && setSelectedHubConversation) {
        return (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 -mb-4 md:-mb-10 h-[calc(100vh-4rem)] md:h-screen transition-all duration-300 overflow-hidden">
                <ChatInterface 
                    conversation={selectedHubConversation} 
                    onBack={() => setSelectedHubConversation(null)}
                    onConversationUpdate={updateHubConversation}
                />
            </div>
        );
    }

    if (hubView === 'welcome') {
        return (
            <div className="relative overflow-hidden flex flex-col group/hub -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 -mb-4 md:-mb-10 h-[calc(100vh-4rem)] md:h-screen transition-all duration-500 bg-black">
                {/* 3D Interactive Globe */}
                <div className="absolute inset-0 z-0">
                    <InteractiveGlobe />
                </div>

                {/* Overlaid Content */}
                <div className="relative z-10 p-6 md:p-10 pointer-events-none flex flex-col h-full flex-grow justify-between">
                    <div>
                        <div className="inline-block bg-black/80 border border-zinc-800 px-2.5 py-1 mb-3">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">// NODE_DISCOVERY_SYSTEM</span>
                        </div>
                        <h1 className="text-2xl md:text-4xl font-bold font-mono text-white leading-tight uppercase tracking-wider">
                            GLOBAL<br />
                            <span className="text-zinc-400">COLLECTIVE</span>
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 md:gap-10 mb-8">
                        <div className="bg-[#0c0c0e]/90 border border-zinc-800 p-4 min-w-[140px]">
                            <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1">// LIVE_COMRADES</span>
                            <span className="text-2xl font-bold font-mono text-white tabular-nums">42.8K</span>
                        </div>
                        <div className="bg-[#0c0c0e]/90 border border-zinc-800 p-4 min-w-[140px]">
                            <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1">// NETWORK_PINGS</span>
                            <span className="text-2xl font-bold font-mono text-white tabular-nums">1.2M</span>
                        </div>
                        <div className="ml-auto pointer-events-auto">
                            <button className="flex items-center gap-3 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider px-6 py-3.5 border border-white hover:bg-zinc-200 transition-colors shadow-2xl">
                                <SparklesIcon className="w-4 h-4 text-black" />
                                <span>Broadcast Signal</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (hubView === 'conversations') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)] p-6 text-center">
                <div className="bg-[#0c0c0e] border border-zinc-800 p-8 max-w-md w-full">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto mb-4 text-zinc-400">
                        <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">// TRANSMISSION_CHANNELS</span>
                    <h2 className="text-base font-bold font-mono uppercase tracking-wider text-white mb-2">Conversations Terminal</h2>
                    <p className="text-xs font-mono text-zinc-400 leading-relaxed mb-6">
                        Select a communication stream from the right sidebar to initiate real-time dialogue with nodes in your network.
                    </p>
                    <div className="text-[10px] font-mono text-zinc-600 uppercase border-t border-zinc-800/80 pt-4">
                        &gt; WAITING_FOR_OPERATOR_INPUT
                    </div>
                </div>
            </div>
        );
    }
    
    if (hubView === 'stream') {
        const streamSubFilters = ['All', 'Stills', 'Tapes', 'Knacks'];

        const renderMomentsContent = () => {
            const filteredMoments = mockMoments.filter(m => 
                activeMomentsFilter === 'All' || m.type === activeMomentsFilter
            );

            if (streamLoading) {
                return (
                    <div className="space-y-4">
                        <MomentCardSkeleton />
                        <MomentCardSkeleton />
                    </div>
                );
            }

            if (filteredMoments.length > 0) {
                return (
                    <div className="space-y-4">
                        {filteredMoments.map(moment => <MomentCard key={moment.id} moment={moment} />)}
                    </div>
                );
            }

            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-8 text-center font-mono">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">// NULL_RESULT</span>
                    <p className="text-xs text-zinc-400">No transmission moments found matching filter: {activeMomentsFilter}</p>
                </div>
            );
        };

        const renderLoopsContent = () => {
            if (streamLoading) {
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <LoopCardSkeleton />
                        <LoopCardSkeleton />
                        <LoopCardSkeleton />
                        <LoopCardSkeleton />
                    </div>
                );
            }

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mockLoops.map(loop => <LoopCard key={loop.id} loop={loop} />)}
                </div>
            );
        };

        return (
            <div className="space-y-4">
                {/* Header title */}
                <div className="flex items-center justify-between pb-1">
                    <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// STREAM_CHANNELS</span>
                        <h1 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Hub Broadcast Stream</h1>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 bg-[#0c0c0e] border border-zinc-800 px-2.5 py-1">
                        <RadioIcon className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                        <span>LIVE_FEED</span>
                    </div>
                </div>

                {/* Main Tabs: Moments/Loops */}
                <div className="flex border-b border-zinc-800">
                    {(['Moments', 'Loops'] as const).map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveStreamTab(tab)}
                            className={`flex-1 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                                activeStreamTab === tab 
                                    ? 'border-b-2 border-white text-white font-bold bg-zinc-900/20' 
                                    : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 bg-white opacity-0 transition-opacity" style={{ opacity: activeStreamTab === tab ? 1 : 0 }}></span>
                            <span>// {tab}</span>
                        </button>
                    ))}
                </div>

                {/* Sub-filters for Moments (Segmented Slide Bar) */}
                {activeStreamTab === 'Moments' && (
                    <div className="w-full bg-[#08080a] border border-zinc-800 p-1">
                        <div className="grid grid-cols-4 gap-1">
                            {streamSubFilters.map(filter => {
                                const isSelected = activeMomentsFilter === filter;
                                return (
                                    <button 
                                        key={filter}
                                        onClick={() => setActiveMomentsFilter(filter)}
                                        className={`py-2 px-1 text-center font-mono text-[11px] md:text-xs uppercase tracking-wider transition-all duration-150 ${
                                            isSelected 
                                                ? 'bg-[#18181d] border border-zinc-700 text-white font-bold shadow-sm' 
                                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 border border-transparent font-medium'
                                        }`}
                                    >
                                        {filter}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                {activeStreamTab === 'Moments' ? renderMomentsContent() : renderLoopsContent()}
            </div>
        );
    }

    // Fallback in case hubView is something unexpected
    return (
        <div className="flex items-center justify-center h-full p-4 text-center">
            <div className="bg-[#0c0c0e] border border-zinc-800 p-8 max-w-sm">
                <CubeIcon className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">// HUB_MODULE</span>
                <h1 className="text-base font-bold font-mono text-white mb-2 uppercase">Stream</h1>
                <p className="text-xs font-mono text-zinc-400">This transmission module is currently initializing.</p>
            </div>
        </div>
    );
};

export default HubPage;

