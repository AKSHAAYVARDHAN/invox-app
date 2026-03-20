import React, { useState, useEffect } from 'react';
// FIX: Use namespace import for react-router-dom to resolve missing member errors.
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, StreamLoop } from '../types';
import StreamCard from '../components/stream/StreamCard';
import LoopCard from '../components/stream/LoopCard';
import StreamCardSkeleton from '../components/stream/StreamCardSkeleton';
import LoopCardSkeleton from '../components/stream/LoopCardSkeleton';
import { ArrowLeftIcon } from '../components/ui/Icons';

const mockMoments: StreamMoment[] = [
    // FIX: Replaced 'imageUrl' with 'mediaUrl' to match the StreamMoment type.
    { id: 'm1', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Stills', content: 'A beautiful landscape.', aiSummary: "A beautiful landscape.", mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop', mediaType: 'image', stats: { likes: 87200, views: 42300000, comments: 11200 } },
    // FIX: Replaced 'imageUrl' with 'mediaUrl' to match the StreamMoment type.
    { id: 'm2', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Stills', content: 'Calm lake waters.', aiSummary: "Calm lake waters.", mediaUrl: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?q=80&w=2070&auto=format&fit=crop', mediaType: 'image', stats: { likes: 75000, views: 31000000, comments: 9800 } },
    // FIX: Replaced 'imageUrl' with 'mediaUrl' to match the StreamMoment type.
    { id: 'm3', author: { name: 'Richard', avatarUrl: 'https://picsum.photos/seed/richard/200' }, type: 'Tapes', content: 'A concert crowd.', aiSummary: "A concert crowd.", mediaUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?q=80&w=2070&auto=format&fit=crop', mediaType: 'image', stats: { likes: 120000, views: 65000000, comments: 25000 } },
    // FIX: Replaced 'imageUrl' with 'mediaUrl' to match the StreamMoment type.
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
                <div>
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
            )
        }
        return null;
    };

    return (
        <div className="p-4">
             <button onClick={() => navigate('/hub')} className="flex items-center gap-2 mb-4 text-invox-light-gray hover:text-white transition-transform duration-200 transform hover:scale-105 active:scale-100">
                <ArrowLeftIcon className="w-6 h-6" />
            </button>
             <div className="flex space-x-2 border border-gray-700 rounded-lg p-1 bg-invox-dark-accent mb-4">
                {mainTabs.map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveMainTab(tab)}
                        className={`w-1/2 py-2 rounded-md transition-all duration-200 transform hover:scale-105 active:scale-95 ${activeMainTab === tab ? 'bg-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeMainTab === 'Moments' && (
                <div className="flex space-x-2 border border-gray-700 rounded-lg p-1 bg-invox-dark-accent mb-4">
                    {subTabs.map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveSubTab(tab)}
                            className={`flex-1 py-2 rounded-md transition-all duration-200 transform hover:scale-105 active:scale-95 text-sm ${activeSubTab === tab ? 'bg-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            )}
            
            {renderContent()}
        </div>
    );
};

export default StreamPage;