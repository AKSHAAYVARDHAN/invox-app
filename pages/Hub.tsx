
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { StreamMoment, HubConversation } from '../types';
import MomentCard from '../components/stream/MomentCard';
import MomentCardSkeleton from '../components/stream/MomentCardSkeleton';
import ChatInterface from '../components/hub/ChatInterface';
import InteractiveGlobe from '../components/hub/InteractiveGlobe';
import { CubeIcon, HubIcon, ChatBubbleBottomCenterTextIcon, SparklesIcon } from '../components/ui/Icons';

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

    // New state for the stream view
    const [activeStreamTab, setActiveStreamTab] = useState('Moments');
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
            const timer = setTimeout(() => setStreamLoading(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [hubView, activeStreamTab, activeMomentsFilter]);
    
    if (selectedHubConversation && setSelectedHubConversation) {
        return (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 -mb-4 md:-mb-10 h-[calc(100vh-4rem)] md:h-screen transition-all duration-500 overflow-hidden">
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
            <div className="relative overflow-hidden flex flex-col group/hub -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 -mb-4 md:-mb-10 h-[calc(100vh-4rem)] md:h-screen transition-all duration-500">
                {/* 3D Interactive Globe */}
                <div className="absolute inset-0 z-0">
                    <InteractiveGlobe />
                </div>

                {/* Overlaid Content */}
                <div className="relative z-10 p-6 md:p-10 pointer-events-none flex flex-col h-full flex-grow justify-between">
                    <div>
                        {/* Heading reduced in size and placed top-left */}
                        <h1 className="text-2xl md:text-4xl font-black text-white leading-tight animate-fadeInUp tracking-tighter">
                            GLOBAL<br />
                            <span className="text-invox-red">COLLECTIVE</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-12 animate-fadeInUp mb-12" style={{ animationDelay: '200ms' }}>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Live Comrades</span>
                            <span className="text-3xl font-bold text-white tabular-nums">42.8K</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Network Pings</span>
                            <span className="text-3xl font-bold text-white tabular-nums">1.2M</span>
                        </div>
                        <div className="ml-auto pointer-events-auto">
                            <button className="flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 group shadow-2xl">
                                <SparklesIcon className="w-5 h-5 text-invox-red group-hover:scale-125 transition-transform" />
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
            <div className="flex items-center justify-center h-full p-4 text-center">
                <div>
                    <ChatBubbleBottomCenterTextIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h1 className="text-4xl font-bold text-white mb-2">Conversations</h1>
                    <p className="text-xl text-invox-light-gray max-w-lg mx-auto">
                        Choose a conversation from the sidebar to start engaging with your network.
                    </p>
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
                return <>
                    <MomentCardSkeleton />
                    <MomentCardSkeleton />
                </>;
            }

            if (filteredMoments.length > 0) {
                return filteredMoments.map(moment => <MomentCard key={moment.id} moment={moment} />);
            }

            return (
                <div className="text-center py-16 text-gray-400">
                    <p>No moments found for this filter.</p>
                </div>
            );
        };

        return (
            <div>
                {/* Main Tabs: Moments/Loops */}
                <div className="flex border-b border-gray-800 mb-4">
                    <button 
                        onClick={() => setActiveStreamTab('Moments')} 
                        className={`w-1/2 text-center py-3 font-semibold transition-all duration-200 transform hover:-translate-y-px ${activeStreamTab === 'Moments' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Moments
                    </button>
                    <button 
                        onClick={() => setActiveStreamTab('Loops')}
                        className={`w-1/2 text-center py-3 font-semibold transition-all duration-200 transform hover:-translate-y-px ${activeStreamTab === 'Loops' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Loops
                    </button>
                </div>

                {/* Sub-filters for Moments */}
                {activeStreamTab === 'Moments' && (
                    <div className="flex space-x-2 border border-gray-800 rounded-lg p-1 bg-invox-dark-accent mb-4">
                        {streamSubFilters.map(filter => (
                            <button 
                                key={filter}
                                onClick={() => setActiveMomentsFilter(filter)}
                                className={`flex-1 py-2 rounded-md transition-all duration-200 ${activeMomentsFilter === filter ? 'bg-invox-red text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                )}
                
                {activeStreamTab === 'Moments' ? (
                    renderMomentsContent()
                ) : (
                     <div className="flex items-center justify-center h-full p-4 text-center mt-16">
                        <div>
                            <CubeIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h1 className="text-4xl font-bold text-white mb-2 capitalize">{activeStreamTab}</h1>
                            <p className="text-xl text-invox-light-gray">This section is under development.</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Fallback in case hubView is something unexpected
    return (
        <div className="flex items-center justify-center h-full p-4 text-center">
            <div>
                <CubeIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-white mb-2">Stream</h1>
                <p className="text-xl text-invox-light-gray">This section is under development.</p>
            </div>
        </div>
    );
};

export default HubPage;
