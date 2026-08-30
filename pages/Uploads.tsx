import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { PlusIcon, SparklesIcon, HeartIcon, TrendingUpIcon, ChatBubbleBottomCenterTextIcon, TrashIcon } from '../components/ui/Icons';
import CreateFeedModal from '../components/uploads/CreateFeedModal';
import { handleImageError } from '../components/utils/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import { createPost, deletePost, subscribeToUserPosts } from '../services/postService';
import { Post } from '../types';

const UploadsPage = () => {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<'Explore' | 'Spotlight' | 'Hub'>('Explore');
    const [exploreSubTab, setExploreSubTab] = useState<'Feeds' | 'Discover'>('Feeds');
    const [spotlightSubTab, setSpotlightSubTab] = useState<'Showcase' | 'Collabs'>('Showcase');
    const [hubSubTab, setHubSubTab] = useState<'Stills' | 'Tapes' | 'Knacks'>('Stills');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [overrideContextName, setOverrideContextName] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    
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

    // Real-time Firestore subscription to user's uploaded content
    useEffect(() => {
        if (!currentUser?.uid) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                setUserPosts(posts);
                setLoading(false);
            },
            (err) => {
                console.error('[UPLOADS_FETCH_ERROR]', err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

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

    // Filter items to show those that belong to the active category/type
    const filteredItems = useMemo(() => {
        const targetCategory = name.toLowerCase();
        return userPosts.filter(item => {
            const cat = (item.category || '').toLowerCase();
            const postType = (item.type || '').toLowerCase();
            return cat === targetCategory || postType === targetCategory || (targetCategory === 'feed' && (cat === 'general' || cat === 'feed' || postType === 'feed'));
        });
    }, [userPosts, name]);

    const handlePublish = async (data: {
        oneLine: string;
        description: string;
        previewUrl: string | null;
        mediaFile?: File | null;
        type: string;
        channelId?: string;
        channelName?: string;
        channelAvatarUrl?: string;
    }) => {
        if (!currentUser) return;

        await createPost({
            channelId: data.channelId,
            channelName: data.channelName,
            channelAvatarUrl: data.channelAvatarUrl,
            oneLine: data.oneLine,
            content: data.description,
            mediaFile: data.mediaFile,
            mediaUrl: data.previewUrl,
            type: data.type,
            category: data.type,
            authorProfile: userProfile ? {
                displayName: userProfile.displayName || currentUser.displayName || undefined,
                username: userProfile.username || undefined,
                photoURL: userProfile.photoURL || currentUser.photoURL || undefined,
                role: userProfile.role,
            } : undefined,
        });

        setIsModalOpen(false);
        setOverrideContextName(null);
    };

    const handleDelete = async (postId: string) => {
        if (!window.confirm('Are you sure you want to delete this broadcast?')) return;
        setDeletingId(postId);
        try {
            await deletePost(postId);
        } catch (err) {
            console.error('Failed to delete post:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setOverrideContextName(null);
    };

    return (
        <div className="space-y-4">
            {/* Top Navigation Bar */}
            <div>
                <div className="flex border-b border-zinc-800 mb-3">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                                activeTab === tab 
                                    ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/40' 
                                    : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 bg-zinc-300 opacity-0 transition-opacity" style={{ opacity: activeTab === tab ? 1 : 0 }}></span>
                            <span>// {tab}</span>
                        </button>
                    ))}
                </div>

                <div className="flex border-b border-zinc-800/80 mb-5">
                    {activeTab === 'Explore' && (
                        <>
                            <button 
                                onClick={() => setExploreSubTab('Feeds')} 
                                className={`w-1/2 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    exploreSubTab === 'Feeds' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Feeds</span>
                            </button>
                            <button 
                                onClick={() => setExploreSubTab('Discover')} 
                                className={`w-1/2 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    exploreSubTab === 'Discover' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Discover</span>
                            </button>
                        </>
                    )}
                    {activeTab === 'Spotlight' && (
                        <>
                            <button 
                                onClick={() => setSpotlightSubTab('Showcase')} 
                                className={`w-1/2 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    spotlightSubTab === 'Showcase' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Showcase</span>
                            </button>
                            <button 
                                onClick={() => setSpotlightSubTab('Collabs')} 
                                className={`w-1/2 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    spotlightSubTab === 'Collabs' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Collabs</span>
                            </button>
                        </>
                    )}
                    {activeTab === 'Hub' && (
                        <>
                            <button 
                                onClick={() => setHubSubTab('Stills')} 
                                className={`w-1/3 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    hubSubTab === 'Stills' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Stills</span>
                            </button>
                            <button 
                                onClick={() => setHubSubTab('Tapes')} 
                                className={`w-1/3 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    hubSubTab === 'Tapes' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Tapes</span>
                            </button>
                            <button 
                                onClick={() => setHubSubTab('Knacks')} 
                                className={`w-1/3 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    hubSubTab === 'Knacks' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Knacks</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div>
                {loading ? (
                    <div className="py-20 flex justify-center items-center">
                        <div className="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#0c0c0e] border border-zinc-800">
                        <div className="text-center max-w-md w-full">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// BROADCAST_INITIALIZER</span>
                            <h2 className="text-xl font-bold font-mono text-white mb-2 tracking-wider uppercase">Create Your First {name}</h2>
                            <p className="text-zinc-400 text-xs font-mono mb-8 leading-relaxed">Publish and stream your transmissions to the {section} community.</p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button 
                                    onClick={() => { setOverrideContextName(name); setIsModalOpen(true); }} 
                                    className="flex items-center justify-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 text-white font-mono text-xs uppercase font-bold tracking-wider py-3 px-6 border border-zinc-700/80 hover:border-zinc-500 transition-all"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>Create {name}</span>
                                </button>
                                <button 
                                    onClick={() => { setOverrideContextName(name); setIsModalOpen(true); }} 
                                    className="flex items-center justify-center gap-2 bg-[#0c0c0e] hover:bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-wider py-3 px-6 border border-zinc-800 hover:border-zinc-600 transition-all"
                                >
                                    <SparklesIcon className="w-4 h-4 text-zinc-400" />
                                    <span>Smart Create {name}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pb-10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">// USER_SIGNALS</span>
                                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Your {name}s ({filteredItems.length})</h3>
                            </div>
                            <button 
                                onClick={() => { setOverrideContextName(name); setIsModalOpen(true); }} 
                                className="flex items-center gap-1.5 bg-zinc-900/80 text-white px-3.5 py-1.5 text-xs font-mono uppercase font-bold tracking-wider border border-zinc-700/80 hover:bg-zinc-800 hover:border-zinc-500 transition-all"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>New {name}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredItems.map(item => (
                                <div key={item.id} className="bg-[#0c0c0e] border border-zinc-800 flex flex-col group hover:border-zinc-700 transition-all relative">
                                    {item.mediaUrl && (
                                        <div className="aspect-video bg-black overflow-hidden relative border-b border-zinc-800">
                                            {item.mediaType === 'video' ? (
                                                <video src={item.mediaUrl} className="w-full h-full object-cover" controls />
                                            ) : (
                                                <img src={item.mediaUrl} className="w-full h-full object-cover" onError={handleImageError} alt="Media" />
                                            )}
                                        </div>
                                    )}
                                    <div className="p-4 flex-grow">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest border border-zinc-700 px-1.5 py-0.5 bg-zinc-900/50">{item.category}</span>
                                                {item.channelName && (
                                                    <span className="text-[10px] font-mono text-zinc-400">· {item.channelName}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={deletingId === item.id}
                                                    className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                                                    title="Delete signal"
                                                >
                                                    {deletingId === item.id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <h4 className="text-sm font-bold font-mono text-white mb-2 leading-tight uppercase tracking-wider">{item.aiSummary || item.oneLine}</h4>
                                        <p className="text-xs text-zinc-400 font-mono line-clamp-3 leading-relaxed">{item.content}</p>
                                    </div>
                                    <div className="p-3 border-t border-zinc-800/80 flex items-center justify-around text-zinc-400 text-xs font-mono">
                                        <div className="flex items-center gap-1.5"><HeartIcon className="w-3.5 h-3.5" /> <span>{item.stats.likes}</span></div>
                                        <div className="flex items-center gap-1.5"><TrendingUpIcon className="w-3.5 h-3.5" /> <span>{item.stats.views}</span></div>
                                        <div className="flex items-center gap-1.5"><ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" /> <span>{item.stats.comments}</span></div>
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
