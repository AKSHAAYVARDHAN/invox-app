import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { PlusIcon, SparklesIcon, HeartIcon, TrendingUpIcon, ChatBubbleBottomCenterTextIcon } from '../components/ui/Icons';
import CreateFeedModal from '../components/uploads/CreateFeedModal';
import { handleImageError } from '../components/utils/imageUtils';

interface UserUpload {
    id: string;
    oneLine: string;
    description: string;
    previewUrl: string | null;
    timestamp: Date;
    category: string;
}

const UploadsPage = () => {
    const [activeTab, setActiveTab] = useState<'Explore' | 'Spotlight' | 'Hub'>('Explore');
    const [exploreSubTab, setExploreSubTab] = useState<'Feeds' | 'Discover'>('Feeds');
    const [spotlightSubTab, setSpotlightSubTab] = useState<'Showcase' | 'Collabs'>('Showcase');
    const [hubSubTab, setHubSubTab] = useState<'Stills' | 'Tapes' | 'Knacks'>('Stills');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [publishedItems, setPublishedItems] = useState<UserUpload[]>([]);
    const [overrideContextName, setOverrideContextName] = useState<string | null>(null);
    
    const { setRightSidebarVariant, uploadTriggerTarget, setUploadTriggerTarget } = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        uploadTriggerTarget: string | null;
        setUploadTriggerTarget: (target: string | null) => void;
    }>();

    useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('uploads');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
        };
    }, [setRightSidebarVariant]);

    // Handle quick access triggers from the right sidebar
    useEffect(() => {
        if (uploadTriggerTarget) {
            setOverrideContextName(uploadTriggerTarget);
            setIsModalOpen(true);
            // Clear the trigger after consuming it
            if (setUploadTriggerTarget) {
                setUploadTriggerTarget(null);
            }
        }
    }, [uploadTriggerTarget, setUploadTriggerTarget]);

    const tabs = ['Explore', 'Spotlight', 'Hub'] as const;

    const getTargetInfo = () => {
        let name = '';
        let section = activeTab;
        if (activeTab === 'Explore') name = exploreSubTab === 'Feeds' ? 'Feed' : 'Discover';
        else if (activeTab === 'Spotlight') name = spotlightSubTab === 'Showcase' ? 'Showcase' : 'Collab';
        else if (activeTab === 'Hub') {
            if (hubSubTab === 'Stills') name = 'Still';
            else if (hubSubTab === 'Tapes') name = 'Tape';
            else name = 'Knack';
        }
        return { name, section };
    };

    const { name, section } = getTargetInfo();

    // Use override if set (from quick access), otherwise use tab-based name
    const currentContextName = overrideContextName || name;

    // Filter items to only show those that belong to the currently active sub-section
    const filteredItems = useMemo(() => {
        return publishedItems.filter(item => item.category === name);
    }, [publishedItems, name]);

    const handlePublish = (data: { oneLine: string; description: string; previewUrl: string | null; type: string }) => {
        const newItem: UserUpload = {
            id: `usr-${Date.now()}`,
            ...data,
            timestamp: new Date(),
            category: data.type // This is the 'type' which is currentContextName
        };
        setPublishedItems(prev => [newItem, ...prev]);
        setIsModalOpen(false);
        setOverrideContextName(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setOverrideContextName(null);
    };

    return (
        <div className="animate-fadeInUp flex flex-col">
            {/* Top Navigation Bar - Fixed height items */}
            <div className="flex-shrink-0">
                <div className="flex space-x-2 border border-gray-800 rounded-lg p-1 bg-invox-dark-accent mb-4">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-md transition-all duration-200 ${
                                activeTab === tab ? 'bg-invox-red text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex border-b border-gray-800 mb-8">
                    {activeTab === 'Explore' && (
                        <>
                            <button onClick={() => setExploreSubTab('Feeds')} className={`w-1/2 text-center py-3 font-semibold transition-all ${exploreSubTab === 'Feeds' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Feeds</button>
                            <button onClick={() => setExploreSubTab('Discover')} className={`w-1/2 text-center py-3 font-semibold transition-all ${exploreSubTab === 'Discover' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Discover</button>
                        </>
                    )}
                    {activeTab === 'Spotlight' && (
                        <>
                            <button onClick={() => setSpotlightSubTab('Showcase')} className={`w-1/2 text-center py-3 font-semibold transition-all ${spotlightSubTab === 'Showcase' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Showcase</button>
                            <button onClick={() => setSpotlightSubTab('Collabs')} className={`w-1/2 text-center py-3 font-semibold transition-all ${spotlightSubTab === 'Collabs' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Collabs</button>
                        </>
                    )}
                    {activeTab === 'Hub' && (
                        <>
                            <button onClick={() => setHubSubTab('Stills')} className={`w-1/3 text-center py-3 font-semibold transition-all ${hubSubTab === 'Stills' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Stills</button>
                            <button onClick={() => setHubSubTab('Tapes')} className={`w-1/3 text-center py-3 font-semibold transition-all ${hubSubTab === 'Tapes' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Tapes</button>
                            <button onClick={() => setHubSubTab('Knacks')} className={`w-1/3 text-center py-3 font-semibold transition-all ${hubSubTab === 'Knacks' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400'}`}>Knacks</button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-4">
                        <div className="text-center max-w-sm w-full">
                            <h2 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Create your first {name}</h2>
                            <p className="text-gray-500 text-lg mb-12 leading-relaxed font-medium">Share your ideas with the {section} community.</p>
                            <div className="space-y-4 max-w-xs mx-auto">
                                <button onClick={() => { setOverrideContextName(name); setIsModalOpen(true); }} className="w-full flex items-center justify-center gap-3 bg-invox-dark-accent hover:bg-gray-800 text-white font-black uppercase tracking-widest py-5 rounded-xl border border-gray-800 transition-all shadow-2xl active:scale-95">
                                    <PlusIcon className="w-5 h-5 text-invox-red" />
                                    <span>Create {name}</span>
                                </button>
                                <button className="w-full flex items-center justify-center gap-3 bg-[#111111] hover:bg-[#161616] text-white font-black uppercase tracking-widest py-5 rounded-xl border border-[#1E1E1E] transition-all group">
                                    <SparklesIcon className="w-5 h-5 text-[#3B82F6] group-hover:scale-125 transition-transform" />
                                    <span>Smart Create {name}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 pb-10">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Your {name}s</h3>
                            <button onClick={() => { setOverrideContextName(name); setIsModalOpen(true); }} className="flex items-center gap-2 bg-invox-red px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-invox-red-hover transition-all">
                                <PlusIcon className="w-4 h-4" />
                                <span>New {name}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredItems.map(item => (
                                <div key={item.id} className="bg-invox-dark-accent border border-gray-800 rounded-2xl overflow-hidden flex flex-col group hover:border-gray-600 transition-all">
                                    {item.previewUrl && (
                                        <div className="aspect-video bg-black overflow-hidden">
                                            <img src={item.previewUrl} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" onError={handleImageError} />
                                        </div>
                                    )}
                                    <div className="p-5 flex-grow">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-invox-red uppercase tracking-widest">{item.category}</span>
                                            <span className="text-[10px] font-bold text-gray-500">{item.timestamp.toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="text-lg font-bold text-white mb-2 leading-tight">{item.oneLine}</h4>
                                        <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                                    </div>
                                    <div className="p-4 border-t border-gray-800/50 flex items-center justify-around text-gray-500">
                                        <div className="flex items-center gap-1.5"><HeartIcon className="w-4 h-4" /> <span className="text-xs font-bold">0</span></div>
                                        <div className="flex items-center gap-1.5"><TrendingUpIcon className="w-4 h-4" /> <span className="text-xs font-bold">0</span></div>
                                        <div className="flex items-center gap-1.5"><ChatBubbleBottomCenterTextIcon className="w-4 h-4" /> <span className="text-xs font-bold">0</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <CreateFeedModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onPublish={handlePublish}
                contextName={currentContextName}
            />
        </div>
    );
};

export default UploadsPage;