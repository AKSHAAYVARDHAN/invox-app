import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, StreamLoop, HubConversation } from '../types';
import MomentCard from '../components/stream/MomentCard';
import MomentCardSkeleton from '../components/stream/MomentCardSkeleton';
import LoopCard from '../components/stream/LoopCard';
import LoopCardSkeleton from '../components/stream/LoopCardSkeleton';
import CreateLoopModal from '../components/loops/CreateLoopModal';
import ChatInterface from '../components/hub/ChatInterface';
import HubConversationsView from '../components/hub/HubConversationsView';
import InteractiveGlobe from '../components/hub/InteractiveGlobe';
import { CubeIcon, ChatBubbleBottomCenterTextIcon, SparklesIcon, RadioIcon, PlusIcon, ShieldCheckIcon } from '../components/ui/Icons';
import { 
    subscribeToMomentsPosts, 
    subscribeToLoopsPosts,
    subscribeToUserSavedPostIds, 
    getUserLikedPostIds,
    getUserStruckLoopIds,
    deleteLoopPost,
    getHubPostById
} from '../services/postService';
import { isMomentsDemoModeEnabled, toggleMomentsDemoMode } from '../services/momentsDemoData';
import { useAuth } from '../contexts/AuthContext';

const HubPage = () => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();

    const { 
        setRightSidebarVariant, 
        hubView,
        setHubView,
        hubRightSidebarView,
        setHubRightSidebarView,
        selectedHubConversation,
        setSelectedHubConversation,
        updateHubConversation,
    } = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        hubView: string;
        setHubView?: (view: string) => void;
        hubRightSidebarView?: string;
        setHubRightSidebarView?: (view: string) => void;
        selectedHubConversation: HubConversation | null;
        setSelectedHubConversation: (conversation: HubConversation | null) => void;
        updateHubConversation: (conversation: HubConversation) => void;
    }>();

    // Check query params to keep stream or conversations view on refresh or direct links
    const queryView = searchParams.get('view') || searchParams.get('tab');
    const hasInviteParam = Boolean(searchParams.get('invite') || searchParams.get('crewId'));
    const effectiveHubView = queryView === 'stream' 
        ? 'stream' 
        : (queryView === 'conversations' || queryView === 'comrades' || queryView === 'crew' || hasInviteParam || hubRightSidebarView === 'comrades' || hubRightSidebarView === 'crew') 
            ? 'conversations' 
            : hubView;

    const [activeStreamTab, setActiveStreamTab] = useState<'Moments' | 'Loops'>('Moments');
    const [activeMomentsFilter, setActiveMomentsFilter] = useState('All');
    const [moments, setMoments] = useState<StreamMoment[]>([]);
    
    // Loops state
    const [activeLoopsFilter, setActiveLoopsFilter] = useState('All');
    const [loops, setLoops] = useState<StreamLoop[]>([]);
    const [loopsLoading, setLoopsLoading] = useState(true);
    const [userStruckLoopIds, setUserStruckLoopIds] = useState<Set<string>>(new Set());
    const [isCreateLoopModalOpen, setIsCreateLoopModalOpen] = useState(false);
    const [editingLoop, setEditingLoop] = useState<StreamLoop | null>(null);
    const [loopToDelete, setLoopToDelete] = useState<StreamLoop | null>(null);
    const [isDeletingLoop, setIsDeletingLoop] = useState(false);

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

    // Direct link authorization validation for ?momentId= or ?loopId=
    const directMomentId = searchParams.get('momentId');
    const directLoopId = searchParams.get('loopId');
    const [directItemRestricted, setDirectItemRestricted] = useState<{ isRestricted: boolean; reason?: string } | null>(null);

    useEffect(() => {
        const targetId = directMomentId || directLoopId;
        if (!targetId) {
            setDirectItemRestricted(null);
            return;
        }

        let isCancelled = false;
        getHubPostById(targetId, currentUser?.uid).then(result => {
            if (isCancelled) return;
            if (result.isRestricted) {
                setDirectItemRestricted({
                    isRestricted: true,
                    reason: result.restrictionReason || 'This Hub content is private to accepted connections of the creator.',
                });
            } else if (result.post) {
                setDirectItemRestricted(null);
                if (directLoopId) {
                    setActiveStreamTab('Loops');
                } else if (directMomentId) {
                    setActiveStreamTab('Moments');
                }
            }
        }).catch(err => {
            if (!isCancelled) {
                console.warn('[DIRECT_HUB_ITEM_ACCESS_ERROR]', err);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [directMomentId, directLoopId, currentUser?.uid]);

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
        if (effectiveHubView !== 'stream' || activeStreamTab !== 'Moments') return;

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
    }, [effectiveHubView, activeStreamTab, activeMomentsFilter, currentUser?.uid]);

    // Live subscription to real published Loops
    useEffect(() => {
        if (effectiveHubView !== 'stream' || activeStreamTab !== 'Loops') return;

        setLoopsLoading(true);
        const unsubscribeLoops = subscribeToLoopsPosts(
            (liveLoops) => {
                setLoops(liveLoops);
                setLoopsLoading(false);
            },
            activeLoopsFilter,
            (err) => {
                console.error('[HUB_LOOPS_FETCH_ERROR]', err);
                setLoopsLoading(false);
            }
        );

        let unsubscribeSaved = () => {};
        if (currentUser?.uid) {
            getUserLikedPostIds(currentUser.uid)
                .then(setUserLikedIds)
                .catch(console.warn);

            getUserStruckLoopIds(currentUser.uid)
                .then(setUserStruckLoopIds)
                .catch(console.warn);

            unsubscribeSaved = subscribeToUserSavedPostIds(
                currentUser.uid,
                (savedSet) => {
                    setUserSavedIds(savedSet);
                }
            );
        }

        return () => {
            unsubscribeLoops();
            unsubscribeSaved();
        };
    }, [effectiveHubView, activeStreamTab, activeLoopsFilter, currentUser?.uid]);

    const handleConfirmDeleteLoop = async () => {
        if (!loopToDelete || !currentUser?.uid) return;
        setIsDeletingLoop(true);
        try {
            await deleteLoopPost(loopToDelete.id, currentUser.uid);
            setLoops(prev => prev.filter(l => l.id !== loopToDelete.id));
            setLoopToDelete(null);
        } catch (err: any) {
            console.error('[DELETE_LOOP_ERROR]', err);
            alert(err?.message || 'Failed to delete loop');
        } finally {
            setIsDeletingLoop(false);
        }
    };
    
    const renderRestrictedModal = () => {
        if (!directItemRestricted?.isRestricted) return null;
        return (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-[#0c0c0e] border border-red-500/50 p-6 max-w-md w-full shadow-2xl font-mono text-center">
                    <div className="w-12 h-12 bg-red-950/40 border border-red-500/50 flex items-center justify-center mx-auto mb-4 text-red-400">
                        <ShieldCheckIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold block mb-1">
                        // ACCESS_RESTRICTED // PRIVATE_NODE
                    </span>
                    <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2">
                        Connections-Only Transmission
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                        {directItemRestricted.reason || 'This Hub content is private to accepted connections of the creator. An accepted mutual connection is required to decrypt this transmission.'}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => {
                                setDirectItemRestricted(null);
                                const newParams = new URLSearchParams(searchParams);
                                newParams.delete('momentId');
                                newParams.delete('loopId');
                                setSearchParams(newParams);
                            }}
                            className="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                        >
                            Return to Hub
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (directItemRestricted?.isRestricted) {
        return renderRestrictedModal();
    }

    if (effectiveHubView === 'conversations') {
        const activeSection = (hubRightSidebarView === 'crew' || queryView === 'crew' || hasInviteParam) ? 'crew' : 'comrades';
        return (
            <HubConversationsView 
                initialSection={activeSection}
                activeSection={activeSection}
                onSectionChange={(section) => {
                    if (setHubRightSidebarView) {
                        setHubRightSidebarView(section);
                    }
                }}
                onBack={() => {
                    if (setHubView) setHubView('welcome');
                    if (setHubRightSidebarView) setHubRightSidebarView('main');
                }}
            />
        );
    }

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

        const loopSubFilters = ['All', 'Zaps', 'Thoughts', 'Music', 'Mood'];

        const renderLoopsContent = () => {
            if (loopsLoading) {
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <LoopCardSkeleton />
                        <LoopCardSkeleton />
                        <LoopCardSkeleton />
                        <LoopCardSkeleton />
                    </div>
                );
            }

            if (loops.length > 0) {
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {loops.map(loop => (
                            <LoopCard 
                                key={loop.id} 
                                loop={loop} 
                                userLiked={userLikedIds.has(loop.id)}
                                userSaved={userSavedIds.has(loop.id)}
                                userStruck={userStruckLoopIds.has(loop.id)}
                                onEdit={(targetLoop) => {
                                    setEditingLoop(targetLoop);
                                    setIsCreateLoopModalOpen(true);
                                }}
                                onDelete={(targetLoop) => {
                                    setLoopToDelete(targetLoop);
                                }}
                            />
                        ))}
                    </div>
                );
            }

            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-8 text-center font-mono">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">// NO_LOOPS_RECORDED</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                        No {activeLoopsFilter !== 'All' ? activeLoopsFilter : 'Loops'} Broadcasted Yet
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
                        Be the first node to broadcast your {
                            activeLoopsFilter === 'Zaps' ? 'quick discoveries, tools, and links' :
                            activeLoopsFilter === 'Thoughts' ? 'opinions, questions, and reflections' :
                            activeLoopsFilter === 'Music' ? 'track discoveries and listening stream' :
                            activeLoopsFilter === 'Mood' ? 'creative mood, aesthetic, and vibe' :
                            'loops'
                        } to the network.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => {
                                setEditingLoop(null);
                                setIsCreateLoopModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider border border-white transition-colors"
                        >
                            <PlusIcon className="w-4 h-4 text-black" />
                            <span>+ Broadcast First Loop</span>
                        </button>
                    </div>
                </div>
            );
        };

        return (
            <div className="space-y-4">
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

                {/* Sub-filters for Loops (Segmented Slide Bar) */}
                {activeStreamTab === 'Loops' && (
                    <div className="w-full bg-[#08080a] border border-zinc-800 p-1">
                        <div className="grid grid-cols-5 gap-1">
                            {loopSubFilters.map(filter => {
                                const isSelected = activeLoopsFilter === filter;
                                return (
                                    <button 
                                        key={filter}
                                        onClick={() => setActiveLoopsFilter(filter)}
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

                {/* Create / Edit Loop Modal */}
                <CreateLoopModal 
                    isOpen={isCreateLoopModalOpen}
                    onClose={() => {
                        setIsCreateLoopModalOpen(false);
                        setEditingLoop(null);
                    }}
                    onLoopCreated={() => {
                        // Subscribed listener automatically refreshes
                    }}
                    initialLoop={editingLoop}
                />

                {/* Loop Delete Confirmation Modal */}
                {loopToDelete && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-[#0c0c0e] border border-red-900/60 p-6 max-w-md w-full shadow-2xl font-mono">
                            <span className="text-[10px] uppercase tracking-widest text-red-400 block mb-1">// CONFIRM_DELETION</span>
                            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2">Delete Loop Record?</h3>
                            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                                Are you sure you want to delete <span className="text-white font-semibold">"{loopToDelete.title || loopToDelete.headline || 'Untitled Loop'}"</span>? This transmission will be permanently erased from the network.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    disabled={isDeletingLoop}
                                    onClick={() => setLoopToDelete(null)}
                                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs uppercase tracking-wider border border-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isDeletingLoop}
                                    onClick={handleConfirmDeleteLoop}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isDeletingLoop ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <span>Delete Permanently</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
