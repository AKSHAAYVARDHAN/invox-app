import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, StreamLoop, HubConversation } from '../types';
import MomentCard from '../components/stream/MomentCard';
import MomentCardSkeleton from '../components/stream/MomentCardSkeleton';
import LoopCard from '../components/stream/LoopCard';
import LoopCardSkeleton from '../components/stream/LoopCardSkeleton';
import ChatInterface from '../components/hub/ChatInterface';
import InteractiveGlobe from '../components/hub/InteractiveGlobe';
import { CubeIcon, ChatBubbleBottomCenterTextIcon, SparklesIcon, RadioIcon, PlusIcon } from '../components/ui/Icons';
import { subscribeToMomentsPosts, subscribeToUserSavedPostIds, getUserLikedPostIds } from '../services/postService';
import { isMomentsDemoModeEnabled, toggleMomentsDemoMode } from '../services/momentsDemoData';
import { useAuth } from '../contexts/AuthContext';

const mockLoops: StreamLoop[] = [
    { id: 'l1', author: { name: 'Adams', avatarUrl: 'https://picsum.photos/seed/201/200' }, category: 'Zaps', title: 'Tactical Cyber Setup', content: "Real-time surveillance matrix deployed.", imageUrl: 'https://picsum.photos/seed/zap/400/600' },
    { id: 'l2', author: { name: 'Lisa Jones', avatarUrl: 'https://picsum.photos/seed/202/200' }, category: 'Mood', title: 'Atmospheric Resonance', content: 'Dark wave synthesizer session recordings.', imageUrl: 'https://picsum.photos/seed/mood/400/600' },
    { id: 'l3', author: { name: 'Harvey', avatarUrl: 'https://picsum.photos/seed/203/200' }, category: 'Thought', title: 'Network Theory', content: 'Decentralized collective node synchronizations.', imageUrl: 'https://picsum.photos/seed/thought/400/600' },
    { id: 'l4', author: { name: 'Akshaay', avatarUrl: 'https://picsum.photos/seed/204/200' }, category: 'Music', title: 'Midnight Protocol', content: 'Low-latency broadcast streams.', imageUrl: 'https://picsum.photos/seed/music/400/600' },
];

const HubPage = () => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();

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

    // Check query params to keep stream view on refresh or direct links
    const queryView = searchParams.get('view') || searchParams.get('tab');
    const effectiveHubView = queryView === 'stream' ? 'stream' : hubView;

    const [activeStreamTab, setActiveStreamTab] = useState<'Moments' | 'Loops'>('Moments');
    const [activeMomentsFilter, setActiveMomentsFilter] = useState('All');
    const [moments, setMoments] = useState<StreamMoment[]>([]);
    const [userLikedIds, setUserLikedIds] = useState<Set<string>>(new Set());
    const [userSavedIds, setUserSavedIds] = useState<Set<string>>(new Set());
    const [streamLoading, setStreamLoading] = useState(true);
    const [demoMode, setDemoMode] = useState<boolean>(() => isMomentsDemoModeEnabled());

    // Listen for global demo mode change events
    useEffect(() => {
        const handleDemoChange = (e: Event) => {
            const custom = e as CustomEvent<{ enabled: boolean }>;
            if (custom.detail && typeof custom.detail.enabled === 'boolean') {
                setDemoMode(custom.detail.enabled);
            } else {
                setDemoMode(isMomentsDemoModeEnabled());
            }
        };
        window.addEventListener('invox_moments_demo_changed', handleDemoChange);
        return () => {
            window.removeEventListener('invox_moments_demo_changed', handleDemoChange);
        };
    }, []);

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

    // Live subscription to real published Moments
    useEffect(() => {
        if (effectiveHubView !== 'stream') return;

        setStreamLoading(true);
        const unsubscribeMoments = subscribeToMomentsPosts(
            (liveMoments) => {
                setMoments(liveMoments);
                setStreamLoading(false);
            },
            activeMomentsFilter,
            (err) => {
                console.error('[HUB_MOMENTS_FETCH_ERROR]', err);
                setStreamLoading(false);
            }
        );

        let unsubscribeSaved = () => {};
        if (currentUser?.uid) {
            getUserLikedPostIds(currentUser.uid)
                .then(setUserLikedIds)
                .catch(console.warn);

            unsubscribeSaved = subscribeToUserSavedPostIds(
                currentUser.uid,
                (savedSet) => {
                    setUserSavedIds(savedSet);
                }
            );
        }

        return () => {
            unsubscribeMoments();
            unsubscribeSaved();
        };
    }, [effectiveHubView, activeMomentsFilter, currentUser?.uid]);
    
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

    if (effectiveHubView === 'welcome') {
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
                        <h1 className="text-3xl md:text-5xl font-extrabold font-mono text-white leading-tight uppercase tracking-tight">
                            GLOBAL<br />
                            <span className="text-zinc-400">COLLECTIVE</span>
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-end gap-8 md:gap-12 mb-8">
                        <div>
                            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">// ACTIVE_COMRADES</span>
                            <span className="text-3xl md:text-4xl font-bold font-mono text-white tabular-nums tracking-tight">42.8K</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">// NETWORK_PINGS</span>
                            <span className="text-3xl md:text-4xl font-bold font-mono text-white tabular-nums tracking-tight">1.2M</span>
                        </div>
                        <div className="ml-auto pointer-events-auto">
                            <button 
                                onClick={() => navigate('/myspace/uploads')}
                                className="flex items-center gap-3 bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider px-6 py-3.5 border border-white transition-colors shadow-2xl active:scale-[0.98]"
                            >
                                <SparklesIcon className="w-4 h-4 text-black" />
                                <span>Broadcast Signal</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (effectiveHubView === 'conversations') {
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
    
    if (effectiveHubView === 'stream') {
        const streamSubFilters = ['All', 'Stills', 'Tapes', 'Knacks'];

        const renderMomentsContent = () => {
            if (streamLoading) {
                return (
                    <div className="space-y-4">
                        <MomentCardSkeleton />
                        <MomentCardSkeleton />
                    </div>
                );
            }

            if (moments.length > 0) {
                return (
                    <div className="space-y-4">
                        {moments.map(moment => (
                            <MomentCard 
                                key={moment.id} 
                                moment={moment} 
                                userLiked={userLikedIds.has(moment.id)}
                                userSaved={userSavedIds.has(moment.id)}
                            />
                        ))}
                    </div>
                );
            }

            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-8 text-center font-mono">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                        <RadioIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">// NO_MOMENTS_RECORDED</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                        No {activeMomentsFilter !== 'All' ? activeMomentsFilter : 'Moments'} Broadcasted Yet
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
                        Be the first node to broadcast your {
                            activeMomentsFilter === 'Stills' ? 'photos and visuals' : 
                            activeMomentsFilter === 'Tapes' ? 'video recordings' : 
                            activeMomentsFilter === 'Knacks' ? 'creative talents and demonstrations' : 
                            'moments'
                        } to the network.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => navigate('/myspace/uploads')}
                            className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider border border-white transition-colors"
                        >
                            <PlusIcon className="w-4 h-4 text-black" />
                            <span>+ Broadcast Moment</span>
                        </button>
                        {!demoMode && (
                            <button
                                onClick={() => toggleMomentsDemoMode()}
                                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-4 py-2 text-xs font-mono uppercase tracking-wider border border-zinc-700 transition-colors"
                            >
                                <span>Preview Demo Feed</span>
                            </button>
                        )}
                    </div>
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
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Demo Mode Toggle Button */}
                        <button
                            type="button"
                            onClick={() => toggleMomentsDemoMode()}
                            title={demoMode ? "Demo Mode is ON: displaying realistic test moments. Click to view real data only." : "Demo Mode is OFF: displaying only real published moments. Click to view demo moments."}
                            className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                                demoMode 
                                    ? 'bg-amber-950/40 text-amber-300 border-amber-800/80 hover:bg-amber-900/60' 
                                    : 'bg-[#0c0c0e] text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${demoMode ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                            <span className="hidden xs:inline">DEMO:</span>
                            <span className="font-bold">{demoMode ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                            onClick={() => navigate('/myspace/uploads')}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider transition-colors border border-white"
                        >
                            <PlusIcon className="w-3.5 h-3.5 text-black" />
                            <span>Broadcast Moment</span>
                        </button>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 bg-[#0c0c0e] border border-zinc-800 px-2.5 py-1">
                            <RadioIcon className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                            <span>LIVE_FEED</span>
                        </div>
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
