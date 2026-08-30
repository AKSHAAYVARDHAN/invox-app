import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, StreamLoop } from '../types';
import StreamCard from '../components/stream/StreamCard';
import LoopCard from '../components/stream/LoopCard';
import StreamCardSkeleton from '../components/stream/StreamCardSkeleton';
import LoopCardSkeleton from '../components/stream/LoopCardSkeleton';
import { ArrowLeftIcon } from '../components/ui/Icons';

const mockMoments: StreamMoment[] = [
    { id: 'm1', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Stills', content: 'A beautiful landscape.', aiSummary: "A beautiful landscape.", mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop', mediaType: 'image', stats: { likes: 87200, views: 42300000, comments: 11200 } },
    { id: 'm2', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Stills', content: 'Calm lake waters.', aiSummary: "Calm lake waters.", mediaUrl: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?q=80&w=2070&auto=format&fit=crop', mediaType: 'image', stats: { likes: 75000, views: 31000000, comments: 9800 } },
    { id: 'm3', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Tapes', content: 'A concert crowd.', aiSummary: "A concert crowd.", mediaUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?q=80&w=2070&auto=format&fit=crop', mediaType: 'image', stats: { likes: 120000, views: 65000000, comments: 25000 } },
    { id: 'm4', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Knacks', content: 'Vintage photo style.', aiSummary: "Vintage photo style.", mediaUrl: 'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?q=80&w=1972&auto=format&fit=crop', mediaType: 'image', stats: { likes: 95000, views: 48000000, comments: 18000 } },
];

const mockLoops: StreamLoop[] = [
    { id: 'l1', author: { name: 'Adams', avatarUrl: 'https://picsum.photos/seed/201/200' }, category: 'Zaps', title: 'Just a Chill Guy', content: "Some sticker that represents that I'm funny.", imageUrl: 'https://picsum.photos/seed/zap/400/600' },
    { id: 'l2', author: { name: 'Lisa Jones', avatarUrl: 'https://picsum.photos/seed/202/200' }, category: 'Mood', title: '', content: '', imageUrl: 'https://picsum.photos/seed/mood/400/600' },
    { id: 'l3', author: { name: 'Harvey', avatarUrl: 'https://picsum.photos/seed/203/200' }, category: 'Thought', title: '', content: 'Some eyes touch you more than hands ever could.', imageUrl: 'https://picsum.photos/seed/thought/400/600' },
    { id: 'l4', author: { name: 'Akshaay', avatarUrl: 'https://picsum.photos/seed/204/200' }, category: 'Music', title: 'The Nights', content: '', imageUrl: 'https://picsum.photos/seed/music/400/600' },
];

const mainTabs = ['Moments', 'Loops'];
const subTabs = ['All', 'Stills', 'Tapes', 'Knacks'];

const StreamPage = () => {
    const { contactId } = ReactRouterDOM.useParams();
    const navigate = ReactRouterDOM.useNavigate();
    const [activeMainTab, setActiveMainTab] = useState('Moments');
    const [activeSubTab, setActiveSubTab] = useState('All');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, [activeMainTab, activeSubTab]);

    const renderContent = () => {
        if (activeMainTab === 'Moments') {
            const filteredMoments = mockMoments.filter(m => activeSubTab === 'All' || m.type === activeSubTab);
            return (
                <div className="space-y-4">
                    {loading ? (
                        <>
                           <StreamCardSkeleton />
                           <StreamCardSkeleton />
                        </>
                    ) : filteredMoments.map(moment => <StreamCard key={moment.id} moment={moment} />)}
                </div>
            );
        }
        if (activeMainTab === 'Loops') {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {loading ? (
                        <>
                            <LoopCardSkeleton />
                            <LoopCardSkeleton />
                            <LoopCardSkeleton />
                            <LoopCardSkeleton />
                        </>
                    ) : mockLoops.map(loop => <LoopCard key={loop.id} loop={loop} />)}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
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

            {/* Sub-tabs for Moments (Segmented Slide Bar) */}
            {activeMainTab === 'Moments' && (
                <div className="w-full bg-[#08080a] border border-zinc-800 p-1">
                    <div className="grid grid-cols-4 gap-1">
                        {subTabs.map(tab => {
                            const isSelected = activeSubTab === tab;
                            return (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveSubTab(tab)}
                                    className={`py-2 px-1 text-center font-mono text-[11px] md:text-xs uppercase tracking-wider transition-all duration-150 ${
                                        isSelected 
                                            ? 'bg-[#18181d] border border-zinc-700 text-white font-bold shadow-sm' 
                                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 border border-transparent font-medium'
                                    }`}
                                >
                                    {tab}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {renderContent()}
        </div>
    );
};

export default StreamPage;