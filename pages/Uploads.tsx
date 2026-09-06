import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { PlusIcon, SparklesIcon, HeartIcon, TrendingUpIcon, ChatBubbleBottomCenterTextIcon, TrashIcon } from '../components/ui/Icons';
import CreateFeedModal from '../components/uploads/CreateFeedModal';
import CreateChannelModal from '../components/uploads/CreateChannelModal';
import { handleImageError } from '../components/utils/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import { createPost, deletePost, subscribeToUserPosts } from '../services/postService';
import { subscribeToUserChannels, deleteChannel } from '../services/channelService';
import { Post, Channel } from '../types';

const UploadsPage = () => {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<'Channels' | 'Explore' | 'Spotlight' | 'Hub'>('Channels');
    const [exploreSubTab, setExploreSubTab] = useState<'Feeds' | 'Discover'>('Feeds');
    const [spotlightSubTab, setSpotlightSubTab] = useState<'Showcase' | 'Collabs'>('Showcase');
    const [hubSubTab, setHubSubTab] = useState<'Stills' | 'Tapes' | 'Knacks'>('Stills');
    
    // Feed creation modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedChannelForFeed, setSelectedChannelForFeed] = useState<string | undefined>(undefined);
    
    // Channel management state
    const [userChannels, setUserChannels] = useState<Channel[]>([]);
    const [channelsLoading, setChannelsLoading] = useState(true);
    const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
    const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
    const [channelFeedFilter, setChannelFeedFilter] = useState<string | null>(null);

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

    // Real-time Firestore subscription to user's channels
    useEffect(() => {
        if (!currentUser?.uid) {
            setChannelsLoading(false);
            return;
        }

        setChannelsLoading(true);
        const unsubscribe = subscribeToUserChannels(
            currentUser.uid,
            (channels) => {
                setUserChannels(channels);
                setChannelsLoading(false);
            },
            (err) => {
                console.error('[CHANNELS_FETCH_ERROR]', err);
                setChannelsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

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

    const tabs = ['Channels', 'Explore', 'Spotlight', 'Hub'] as const;

    const getTargetInfo = () => {
        let name = '';
        let section = activeTab;
        if (activeTab === 'Channels') name = 'Channel';
        else if (activeTab === 'Explore') name = exploreSubTab === 'Feeds' ? 'Feed' : 'Discover';
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
    const currentContextName = overrideContextName || (activeTab === 'Channels' ? 'Feed' : name);

    // Filter items to show those that belong to the active category/type
    const filteredItems = useMemo(() => {
        const targetCategory = name.toLowerCase();
        return userPosts.filter(item => {
            const cat = (item.category || '').toLowerCase();
            const postType = (item.type || '').toLowerCase();
            const matchesCategory = cat === targetCategory || postType === targetCategory || (targetCategory === 'feed' && (cat === 'general' || cat === 'feed' || postType === 'feed'));
            if (!matchesCategory) return false;
            
            // If filtering by specific channel in Feeds view
            if (activeTab === 'Explore' && exploreSubTab === 'Feeds' && channelFeedFilter) {
                return item.channelId === channelFeedFilter;
            }
            return true;
        });
    }, [userPosts, name, activeTab, exploreSubTab, channelFeedFilter]);

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
        setSelectedChannelForFeed(undefined);
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

    const handleDeleteChannel = async (channelId: string, channelName: string) => {
        if (!window.confirm(`Are you sure you want to delete channel "${channelName}"?`)) return;
        setDeletingChannelId(channelId);
        try {
            await deleteChannel(channelId);
        } catch (err: any) {
            console.error('Failed to delete channel:', err);
            alert(err?.message || 'Failed to delete channel');
        } finally {
            setDeletingChannelId(null);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setOverrideContextName(null);
        setSelectedChannelForFeed(undefined);
    };

    const handleCreateFeedForChannel = (channelId: string) => {
        setSelectedChannelForFeed(channelId);
        setOverrideContextName('Feed');
        setIsModalOpen(true);
    };

    const handleViewChannelFeeds = (channelId: string) => {
        setChannelFeedFilter(channelId);
        setActiveTab('Explore');
        setExploreSubTab('Feeds');
    };

    return (
        <div className="space-y-4">
            {/* Top Navigation Bar */}
            <div>
                <div className="flex border-b border-zinc-800 mb-3">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                setChannelFeedFilter(null);
                            }}
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
                    {activeTab === 'Channels' && (
                        <div className="w-full flex items-center justify-between py-2 px-1 text-xs font-mono">
                            <span className="text-zinc-500 uppercase tracking-wider">// CHANNEL_CONSOLE</span>
                            <span className="text-zinc-400 text-[11px] uppercase tracking-wider">
                                {userChannels.length} {userChannels.length === 1 ? 'CHANNEL ACTIVE' : 'CHANNELS ACTIVE'}
                            </span>
                        </div>
                    )}
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

            {/* CHANNELS TAB CONTENT */}
            {activeTab === 'Channels' ? (
                <div>
                    {channelsLoading ? (
                        <div className="py-20 flex justify-center items-center">
                            <div className="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
                        </div>
                    ) : userChannels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#0c0c0e] border border-zinc-800 font-mono">
                            <div className="text-center max-w-md w-full">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">// CHANNEL_INITIALIZER</span>
                                <h2 className="text-xl font-bold text-white mb-2 tracking-wider uppercase">Create Your First Channel</h2>
                                <p className="text-zinc-400 text-xs mb-8 leading-relaxed">
                                    A Channel is required before you can publish and broadcast feeds to the Invox network. Channels organize your broadcasts, subscribers, and transmissions.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button 
                                        onClick={() => setIsCreateChannelModalOpen(true)} 
                                        className="flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 text-xs uppercase font-bold tracking-wider py-3 px-6 transition-all"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                        <span>Create Channel</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-10 font-mono">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">// CHANNEL_DIRECTORY</span>
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Channels ({userChannels.length})</h3>
                                </div>
                                <button 
                                    onClick={() => setIsCreateChannelModalOpen(true)} 
                                    className="flex items-center gap-1.5 bg-zinc-900/80 text-white px-3.5 py-1.5 text-xs uppercase font-bold tracking-wider border border-zinc-700/80 hover:bg-zinc-800 hover:border-zinc-500 transition-all"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>New Channel</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {userChannels.map(channel => (
                                    <div 
                                        key={channel.id} 
                                        className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-4 flex flex-col justify-between transition-all group"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <img 
                                                        src={channel.avatarUrl || `https://picsum.photos/seed/${channel.id}/200`} 
                                                        onError={handleImageError}
                                                        alt={channel.name} 
                                                        className="w-12 h-12 object-cover border border-zinc-700 flex-shrink-0"
                                                    />
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider group-hover:text-zinc-200 transition-colors">
                                                            {channel.name}
                                                        </h4>
                                                        <p className="text-xs text-zinc-500">{channel.handle || `@${channel.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest border border-zinc-700 px-2 py-0.5 bg-zinc-900/60">
                                                        {channel.domain || channel.category || 'General'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteChannel(channel.id, channel.name)}
                                                        disabled={deletingChannelId === channel.id}
                                                        className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                                                        title="Delete channel"
                                                    >
                                                        {deletingChannelId === channel.id ? (
                                                            <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                                                {channel.description || 'Channel for transmitting signals, research, and feeds across the Invox network.'}
                                            </p>

                                            <div className="grid grid-cols-3 gap-2 p-2.5 bg-black/60 border border-zinc-800/80 text-[11px] mb-4">
                                                <div>
                                                    <span className="text-zinc-500 block text-[9px] uppercase">Posts</span>
                                                    <span className="text-white font-bold">{channel.postCount || 0}</span>
                                                </div>
                                                <div>
                                                    <span className="text-zinc-500 block text-[9px] uppercase">Subscribers</span>
                                                    <span className="text-white font-bold">{channel.subscriberCount || 0}</span>
                                                </div>
                                                <div>
                                                    <span className="text-zinc-500 block text-[9px] uppercase">Created</span>
                                                    <span className="text-zinc-300">{new Date(channel.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                                            <button 
                                                onClick={() => handleCreateFeedForChannel(channel.id)}
                                                className="flex-1 flex items-center justify-center gap-1.5 bg-white text-black hover:bg-zinc-200 py-2 px-3 text-xs uppercase font-bold tracking-wider transition-all"
                                            >
                                                <PlusIcon className="w-3.5 h-3.5" />
                                                <span>Create Feed</span>
                                            </button>
                                            <button 
                                                onClick={() => handleViewChannelFeeds(channel.id)}
                                                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs uppercase tracking-wider transition-all"
                                                title="View channel feeds"
                                            >
                                                <span>Feeds ({channel.postCount || 0})</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* OTHER TABS: Explore, Spotlight, Hub */
                <div>
                    {/* Channel notice / filter in Explore -> Feeds */}
                    {activeTab === 'Explore' && exploreSubTab === 'Feeds' && (
                        <div className="mb-4">
                            {userChannels.length === 0 ? (
                                <div className="p-3 bg-zinc-900/60 border border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-400 font-bold">// REQUIREMENT:</span>
                                        <span className="text-zinc-300">A Channel is required before publishing Feeds.</span>
                                    </div>
                                    <button
                                        onClick={() => setIsCreateChannelModalOpen(true)}
                                        className="flex items-center gap-1 bg-white text-black hover:bg-zinc-200 px-3 py-1 font-bold text-xs uppercase tracking-wider transition-all"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                        <span>Create Channel First</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 font-mono text-xs no-scrollbar">
                                    <span className="text-zinc-500 uppercase text-[10px] tracking-wider whitespace-nowrap">// CHANNEL_FILTER:</span>
                                    <button
                                        onClick={() => setChannelFeedFilter(null)}
                                        className={`px-2.5 py-1 text-[11px] uppercase tracking-wider whitespace-nowrap border transition-all ${
                                            channelFeedFilter === null
                                                ? 'bg-white text-black border-white font-bold'
                                                : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                        }`}
                                    >
                                        All Feeds
                                    </button>
                                    {userChannels.map(ch => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setChannelFeedFilter(ch.id)}
                                            className={`px-2.5 py-1 text-[11px] uppercase tracking-wider whitespace-nowrap border transition-all ${
                                                channelFeedFilter === ch.id
                                                    ? 'bg-white text-black border-white font-bold'
                                                    : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                            }`}
                                        >
                                            {ch.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 flex justify-center items-center">
                            <div className="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#0c0c0e] border border-zinc-800 font-mono">
                            <div className="text-center max-w-md w-full">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">// BROADCAST_INITIALIZER</span>
                                <h2 className="text-xl font-bold text-white mb-2 tracking-wider uppercase">Create Your First {name}</h2>
                                <p className="text-zinc-400 text-xs mb-8 leading-relaxed">
                                    {name === 'Feed' 
                                        ? 'Publish and stream your broadcasts to your channel and the Invox network.' 
                                        : `Publish and stream your transmissions to the ${section} community.`}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button 
                                        onClick={() => { 
                                            setSelectedChannelForFeed(channelFeedFilter || undefined);
                                            setOverrideContextName(name); 
                                            setIsModalOpen(true); 
                                        }} 
                                        className="flex items-center justify-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 text-white text-xs uppercase font-bold tracking-wider py-3 px-6 border border-zinc-700/80 hover:border-zinc-500 transition-all"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                        <span>Create {name}</span>
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            setSelectedChannelForFeed(channelFeedFilter || undefined);
                                            setOverrideContextName(name); 
                                            setIsModalOpen(true); 
                                        }} 
                                        className="flex items-center justify-center gap-2 bg-[#0c0c0e] hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs uppercase tracking-wider py-3 px-6 border border-zinc-800 hover:border-zinc-600 transition-all"
                                    >
                                        <SparklesIcon className="w-4 h-4 text-zinc-400" />
                                        <span>Smart Create {name}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-10 font-mono">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">// USER_SIGNALS</span>
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                                        Your {name}s ({filteredItems.length})
                                        {channelFeedFilter && userChannels.find(c => c.id === channelFeedFilter) && (
                                            <span className="text-zinc-400 ml-1">
                                                · {userChannels.find(c => c.id === channelFeedFilter)?.name}
                                            </span>
                                        )}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => { 
                                        setSelectedChannelForFeed(channelFeedFilter || undefined);
                                        setOverrideContextName(name); 
                                        setIsModalOpen(true); 
                                    }} 
                                    className="flex items-center gap-1.5 bg-zinc-900/80 text-white px-3.5 py-1.5 text-xs uppercase font-bold tracking-wider border border-zinc-700/80 hover:bg-zinc-800 hover:border-zinc-500 transition-all"
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
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-zinc-700 px-1.5 py-0.5 bg-zinc-900/50">{item.category}</span>
                                                    {item.channelName && (
                                                        <span className="text-[10px] text-zinc-400">· // {item.channelName}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
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
                                            <h4 className="text-sm font-bold text-white mb-2 leading-tight uppercase tracking-wider">{item.aiSummary || item.oneLine}</h4>
                                            <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{item.content}</p>
                                        </div>
                                        <div className="p-3 border-t border-zinc-800/80 flex items-center justify-around text-zinc-400 text-xs">
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
            )}

            {/* Create Channel Modal */}
            <CreateChannelModal
                isOpen={isCreateChannelModalOpen}
                onClose={() => setIsCreateChannelModalOpen(false)}
                onCreated={(channel) => {
                    // Preselect for feed modal if user chooses to create feed immediately
                    setSelectedChannelForFeed(channel.id);
                }}
            />

            {/* Create Feed / Post Modal */}
            <CreateFeedModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onPublish={handlePublish}
                contextName={currentContextName}
                preselectedChannelId={selectedChannelForFeed}
            />
        </div>
    );
};

export default UploadsPage;

