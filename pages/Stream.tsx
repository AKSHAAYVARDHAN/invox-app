import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, StreamLoop } from '../types';
import MomentCard from '../components/stream/MomentCard';
import LoopCard from '../components/stream/LoopCard';
import MomentCardSkeleton from '../components/stream/MomentCardSkeleton';
import LoopCardSkeleton from '../components/stream/LoopCardSkeleton';
import { ArrowLeftIcon, RadioIcon, PlusIcon } from '../components/ui/Icons';
import { subscribeToMomentsPosts, subscribeToUserSavedPostIds, getUserLikedPostIds } from '../services/postService';
import { isMomentsDemoModeEnabled, toggleMomentsDemoMode } from '../services/momentsDemoData';
import { useAuth } from '../contexts/AuthContext';

const mockLoops: StreamLoop[] = [
    { id: 'l1', author: { name: 'Adams', avatarUrl: 'https://picsum.photos/seed/201/200' }, category: 'Zaps', title: 'Tactical Cyber Setup', content: "Real-time surveillance matrix deployed.", imageUrl: 'https://picsum.photos/seed/zap/400/600' },
    { id: 'l2', author: { name: 'Lisa Jones', avatarUrl: 'https://picsum.photos/seed/202/200' }, category: 'Mood', title: '', content: '', imageUrl: 'https://picsum.photos/seed/mood/400/600' },
    { id: 'l3', author: { name: 'Harvey', avatarUrl: 'https://picsum.photos/seed/203/200' }, category: 'Thought', title: '', content: 'Some eyes touch you more than hands ever could.', imageUrl: 'https://picsum.photos/seed/thought/400/600' },
    { id: 'l4', author: { name: 'Akshaay', avatarUrl: 'https://picsum.photos/seed/204/200' }, category: 'Music', title: 'The Nights', content: '', imageUrl: 'https://picsum.photos/seed/music/400/600' },
];

const mainTabs = ['Moments', 'Loops'];
const subTabs = ['All', 'Stills', 'Tapes', 'Knacks'];

const StreamPage = () => {
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser } = useAuth();
    const [activeMainTab, setActiveMainTab] = useState('Moments');
    const [activeSubTab, setActiveSubTab] = useState('All');
    const [moments, setMoments] = useState<StreamMoment[]>([]);
    const [userLikedIds, setUserLikedIds] = useState<Set<string>>(new Set());
    const [userSavedIds, setUserSavedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [demoMode, setDemoMode] = useState<boolean>(() => isMomentsDemoModeEnabled());

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
        if (activeMainTab !== 'Moments') return;

        setLoading(true);
        const unsubscribeMoments = subscribeToMomentsPosts(
            (liveMoments) => {
                setMoments(liveMoments);
                setLoading(false);
            },
            activeSubTab,
            (err) => {
                console.error('[STREAM_PAGE_FETCH_ERROR]', err);
                setLoading(false);
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
    }, [activeMainTab, activeSubTab, currentUser?.uid]);

    const renderContent = () => {
        if (activeMainTab === 'Moments') {
            if (loading) {
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
                        No {activeSubTab !== 'All' ? activeSubTab : 'Moments'} Broadcasted Yet
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
                        Be the first node to broadcast your moments to the network.
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
        }

        if (activeMainTab === 'Loops') {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mockLoops.map(loop => <LoopCard key={loop.id} loop={loop} />)}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/hub')} 
                        className="p-1.5 bg-[#0c0c0e] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                        title="Back to Hub"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// STREAM_TRANSMISSION</span>
                        <h1 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Live Broadcast Feed</h1>
                    </div>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider transition-colors border border-white"
                    >
                        <PlusIcon className="w-3.5 h-3.5 text-black" />
                        <span>Broadcast Moment</span>
                    </button>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex border-b border-zinc-800">
                {mainTabs.map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveMainTab(tab)}
                        className={`flex-1 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                            activeMainTab === tab 
                                ? 'border-b-2 border-white text-white font-bold bg-zinc-900/20' 
                                : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 bg-white opacity-0 transition-opacity" style={{ opacity: activeMainTab === tab ? 1 : 0 }}></span>
                        <span>// {tab}</span>
                    </button>
                ))}
            </div>

            {/* Sub Tabs */}
            {activeMainTab === 'Moments' && (
                <div className="w-full bg-[#08080a] border border-zinc-800 p-1">
                    <div className="grid grid-cols-4 gap-1">
                        {subTabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveSubTab(tab)}
                                className={`py-2 px-1 text-center font-mono text-[11px] md:text-xs uppercase tracking-wider transition-all duration-150 ${
                                    activeSubTab === tab 
                                        ? 'bg-[#18181d] border border-zinc-700 text-white font-bold shadow-sm' 
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 border border-transparent font-medium'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {renderContent()}
        </div>
    );
};

export default StreamPage;