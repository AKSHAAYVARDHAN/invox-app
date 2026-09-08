import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { PlusIcon, SparklesIcon, HeartIcon, TrendingUpIcon, ChatBubbleBottomCenterTextIcon, TrashIcon, CloseIcon } from '../components/ui/Icons';
import CreateFeedModal from '../components/uploads/CreateFeedModal';
import CreateChannelModal from '../components/uploads/CreateChannelModal';
import { CreatePollModal } from '../components/uploads/CreatePollModal';
import { PollCard } from '../components/feed/PollCard';
import { handleImageError } from '../components/utils/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import { createPost, deletePost, subscribeToUserPosts } from '../services/postService';
import { subscribeToUserChannels, deleteChannel } from '../services/channelService';
import { subscribeToUserPolls, deletePoll } from '../services/pollService';
import { Post, Channel, Poll, PostType } from '../types';

const mainTabs = ['Explore', 'Spotlight', 'Hub'] as const;
type MainTab = typeof mainTabs[number];

const UploadsPage = () => {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<MainTab>('Explore');
    const [exploreSubTab, setExploreSubTab] = useState<'Channels' | 'Feeds' | 'Discover'>('Channels');
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

    // Discover management state (My Space -> Explore -> Discover)
    const [mySpaceDiscoverFilter, setMySpaceDiscoverFilter] = useState<'All' | 'Threads' | 'Queries' | 'Polls'>('All');
    const [userPolls, setUserPolls] = useState<Poll[]>([]);
    const [pollsLoading, setPollsLoading] = useState(true);
    const [isCreatePollModalOpen, setIsCreatePollModalOpen] = useState(false);
    const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [overrideContextName, setOverrideContextName] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);
    const [channelToDelete, setChannelToDelete] = useState<{ id: string; name: string } | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    
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

    // Real-time Firestore subscription to user's polls
    useEffect(() => {
        if (!currentUser?.uid) {
            setPollsLoading(false);
            return;
        }

        setPollsLoading(true);
        const unsubscribe = subscribeToUserPolls(
            currentUser.uid,
            (polls) => {
                setUserPolls(polls);
                setPollsLoading(false);
            },
            (err) => {
                console.error('[USER_POLLS_FETCH_ERROR]', err);
                setPollsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Handle quick access triggers from the right sidebar
    useEffect(() => {
        if (uploadTriggerTarget) {
            if (uploadTriggerTarget === 'Channel') {
                setActiveTab('Explore');
                setExploreSubTab('Channels');
                setIsCreateChannelModalOpen(true);
            } else {
                if (uploadTriggerTarget === 'Feed') {
                    setActiveTab('Explore');
                    setExploreSubTab('Feeds');
                } else if (uploadTriggerTarget === 'Discover') {
                    setActiveTab('Explore');
                    setExploreSubTab('Discover');
                } else if (uploadTriggerTarget === 'Showcase' || uploadTriggerTarget === 'Collab') {
                    setActiveTab('Spotlight');
                    setSpotlightSubTab(uploadTriggerTarget === 'Showcase' ? 'Showcase' : 'Collabs');
                } else if (['Still', 'Tape', 'Knack'].includes(uploadTriggerTarget)) {
                    setActiveTab('Hub');
                    setHubSubTab(uploadTriggerTarget === 'Still' ? 'Stills' : uploadTriggerTarget === 'Tape' ? 'Tapes' : 'Knacks');
                }
                setOverrideContextName(uploadTriggerTarget);
                setIsModalOpen(true);
            }
            // Clear the trigger after consuming it
            if (setUploadTriggerTarget) {
                setUploadTriggerTarget(null);
            }
        }
    }, [uploadTriggerTarget, setUploadTriggerTarget]);

    const getTargetInfo = () => {
        let name = '';
        let section: string = activeTab;
        if (activeTab === 'Explore') {
            if (exploreSubTab === 'Channels') name = 'Channel';
            else if (exploreSubTab === 'Feeds') name = 'Feed';
            else name = 'Discover';
        } else if (activeTab === 'Spotlight') {
            name = spotlightSubTab === 'Showcase' ? 'Showcase' : 'Collab';
        } else if (activeTab === 'Hub') {
            if (hubSubTab === 'Stills') name = 'Still';
            else if (hubSubTab === 'Tapes') name = 'Tape';
            else name = 'Knack';
        }
        return { name, section };
    };

    const { name, section } = getTargetInfo();

    // Use override if set (from quick access), otherwise use tab-based name
    const currentContextName = overrideContextName || (activeTab === 'Explore' && exploreSubTab === 'Channels' ? 'Feed' : name);

    // Filter items to show those that belong to the active category/type
    const filteredItems = useMemo(() => {
        if (activeTab === 'Explore' && exploreSubTab === 'Channels') {
            return [];
        }
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

    // Discover management items (Threads, Queries, Polls)
    const userThreads = useMemo(() => {
        return userPosts.filter(p => (p.type || '').toLowerCase() === 'thread' || (p.category || '').toLowerCase() === 'thread');
    }, [userPosts]);

    const userQueries = useMemo(() => {
        return userPosts.filter(p => (p.type || '').toLowerCase() === 'query' || (p.category || '').toLowerCase() === 'query');
    }, [userPosts]);

    const filteredDiscoverItems = useMemo(() => {
        switch (mySpaceDiscoverFilter) {
            case 'All': {
                const combined: (Post | Poll)[] = [...userThreads, ...userQueries, ...userPolls];
                return combined.sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
                    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
                    return dateB - dateA;
                });
            }
            case 'Threads':
                return userThreads;
            case 'Queries':
                return userQueries;
            case 'Polls':
                return userPolls;
            default:
                return [];
        }
    }, [mySpaceDiscoverFilter, userThreads, userQueries, userPolls]);

    const handlePublish = async (data: {
        oneLine: string;
        description: string;
        previewUrl: string | null;
        mediaFile?: File | null;
        type: string;
        channelId?: string;
        channelName?: string;
        channelAvatarUrl?: string;
        category?: string;
        domain?: string;
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
            category: data.domain || data.category || data.type,
            domain: data.domain || data.category || 'Technology',
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

    const handleDelete = (postId: string) => {
        const item = userPosts.find(p => p.id === postId);
        setActionError(null);
        setPostToDelete({
            id: postId,
            title: item?.aiSummary || item?.oneLine || 'Feed Broadcast'
        });
    };

    const confirmDeletePost = async () => {
        if (!postToDelete) return;
        if (!currentUser) {
            setActionError('Authentication required: You must be logged in to delete a broadcast.');
            return;
        }

        const targetId = postToDelete.id;
        setDeletingId(targetId);
        setActionError(null);

        try {
            console.log(`[UPLOADS_DELETION] Initiating deletion for post: ${targetId}`);
            await deletePost(targetId);

            // Step 9: ONLY remove the Feed from the UI after Firestore deletion succeeds
            setUserPosts(prev => prev.filter(p => p.id !== targetId));
            setPostToDelete(null);
            setActionSuccess('Feed broadcast deleted successfully.');
            setTimeout(() => setActionSuccess(null), 4000);
        } catch (err: any) {
            console.error('[UPLOADS_DELETION_ERROR] Deletion failed:', err);
            setActionError(err?.message || 'Failed to delete feed broadcast');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteChannel = (channelId: string, channelName: string) => {
        setActionError(null);
        setChannelToDelete({
            id: channelId,
            name: channelName
        });
    };

    const confirmDeleteChannel = async () => {
        if (!channelToDelete) return;
        if (!currentUser) {
            setActionError('Authentication required: You must be logged in to delete a channel.');
            return;
        }

        const targetId = channelToDelete.id;
        setDeletingChannelId(targetId);
        setActionError(null);

        try {
            console.log(`[UPLOADS_CHANNEL_DELETION] Initiating deletion for channel: ${targetId}`);
            await deleteChannel(targetId);
            setUserChannels(prev => prev.filter(c => c.id !== targetId));
            setChannelToDelete(null);
            setActionSuccess('Channel deleted successfully.');
            setTimeout(() => setActionSuccess(null), 4000);
        } catch (err: any) {
            console.error('[UPLOADS_CHANNEL_DELETION_ERROR] Channel deletion failed:', err);
            setActionError(err?.message || 'Failed to delete channel');
        } finally {
            setDeletingChannelId(null);
        }
    };

    const handleDeletePoll = (poll: Poll) => {
        setActionError(null);
        setPollToDelete(poll);
    };

    const confirmDeletePoll = async () => {
        if (!pollToDelete) return;
        if (!currentUser) {
            setActionError('Authentication required: You must be logged in to delete a poll.');
            return;
        }

        const targetId = pollToDelete.id;
        setDeletingId(targetId);
        setActionError(null);

        try {
            console.log(`[UPLOADS_POLL_DELETION] Initiating deletion for poll: ${targetId}`);
            await deletePoll(targetId);
            setUserPolls(prev => prev.filter(p => p.id !== targetId));
            setPollToDelete(null);
            setActionSuccess('Poll transmission deleted successfully.');
            setTimeout(() => setActionSuccess(null), 4000);
        } catch (err: any) {
            console.error('[UPLOADS_POLL_DELETION_ERROR] Poll deletion failed:', err);
            setActionError(err?.message || 'Failed to delete poll');
        } finally {
            setDeletingId(null);
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

    const isChannelsView = activeTab === 'Explore' && exploreSubTab === 'Channels';
    const isDiscoverView = activeTab === 'Explore' && exploreSubTab === 'Discover';

    return (
        <div className="space-y-4">
            {/* Top Slide Bar Navigation */}
            <div>
                <div className="flex space-x-1 border border-zinc-800 bg-[#0c0c0e] p-1 mb-4">
                    {mainTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                                setChannelFeedFilter(null);
                            }}
                            className={`flex-1 py-1.5 sm:py-2 rounded-none font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                                activeTab === tab 
                                    ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Sub-Tabs Navigation */}
                <div className="flex border-b border-zinc-800/80 mb-5">
                    {activeTab === 'Explore' && (
                        <>
                            <button 
                                onClick={() => {
                                    setExploreSubTab('Channels');
                                    setChannelFeedFilter(null);
                                }} 
                                className={`w-1/3 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    exploreSubTab === 'Channels' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Channels</span>
                                <span className={`text-[10px] px-1.5 py-0.2 border transition-colors ${
                                    exploreSubTab === 'Channels'
                                        ? 'bg-zinc-800 text-zinc-200 border-zinc-600'
                                        : 'bg-zinc-900/60 text-zinc-500 border-zinc-800'
                                }`}>
                                    {userChannels.length}
                                </span>
                            </button>
                            <button 
                                onClick={() => setExploreSubTab('Feeds')} 
                                className={`w-1/3 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                    exploreSubTab === 'Feeds' 
                                        ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/30' 
                                        : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                                }`}
                            >
                                <span>// Feeds</span>
                            </button>
                            <button 
                                onClick={() => {
                                    setExploreSubTab('Discover');
                                    setChannelFeedFilter(null);
                                }} 
                                className={`w-1/3 text-center py-2 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
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

            {/* CHANNELS SECTION (UNDER EXPLORE) */}
            {isChannelsView ? (
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
            ) : isDiscoverView ? (
                /* DISCOVER MANAGEMENT VIEW (MY SPACE -> EXPLORE -> DISCOVER) */
                <div className="space-y-4 font-mono">
                    {/* Header: Overview of Your Discover transmissions & Creation Actions */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0c0c0e] border border-zinc-800 p-3.5">
                        <div>
                            <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">// YOUR DISCOVER</span>
                            <div className="text-white font-bold tracking-wider mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                                <span>THREADS <span className="text-zinc-400 font-normal">{userThreads.length}</span></span>
                                <span className="text-zinc-700">|</span>
                                <span>QUERIES <span className="text-zinc-400 font-normal">{userQueries.length}</span></span>
                                <span className="text-zinc-700">|</span>
                                <span>POLLS <span className="text-zinc-400 font-normal">{userPolls.length}</span></span>
                            </div>
                        </div>

                        {/* Creation actions: + NEW THREAD, + NEW QUERY, + NEW POLL */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => {
                                    setOverrideContextName('Thread');
                                    setIsModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider border border-zinc-700 hover:border-zinc-500 transition-all"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>NEW THREAD</span>
                            </button>
                            <button
                                onClick={() => {
                                    setOverrideContextName('Query');
                                    setIsModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider border border-zinc-700 hover:border-zinc-500 transition-all"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>NEW QUERY</span>
                            </button>
                            <button
                                onClick={() => setIsCreatePollModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider border border-zinc-700 hover:border-zinc-500 transition-all"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>NEW POLL</span>
                            </button>
                        </div>
                    </div>

                    {/* Subnavigation: ALL, THREADS, QUERIES, POLLS */}
                    <div className="flex space-x-1 border border-zinc-800 bg-[#0c0c0e] p-1">
                        {(['All', 'Threads', 'Queries', 'Polls'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setMySpaceDiscoverFilter(filter)}
                                className={`flex-1 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                                    mySpaceDiscoverFilter === filter
                                        ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Content Section */}
                    {loading || pollsLoading ? (
                        <div className="py-20 flex justify-center items-center">
                            <div className="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
                        </div>
                    ) : filteredDiscoverItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#0c0c0e] border border-zinc-800 font-mono">
                            <div className="text-center max-w-md w-full">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">// DISCOVER_MANAGER</span>
                                <h2 className="text-base font-bold text-white mb-2 tracking-wider uppercase">
                                    No {mySpaceDiscoverFilter === 'All' ? 'Discover' : mySpaceDiscoverFilter} Transmissions Found
                                </h2>
                                <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                                    {mySpaceDiscoverFilter === 'Polls'
                                        ? 'Transmit your predictive questionnaires and opinions to gather network consensus.'
                                        : mySpaceDiscoverFilter === 'Threads'
                                        ? 'Publish long-form discussions and research threads to the network.'
                                        : mySpaceDiscoverFilter === 'Queries'
                                        ? 'Pose deep technical queries to source collective insights.'
                                        : 'Publish research threads, inquiry queries, or community polls.'}
                                </p>
                                <div className="flex items-center justify-center gap-2">
                                    {mySpaceDiscoverFilter === 'Polls' ? (
                                        <button
                                            onClick={() => setIsCreatePollModalOpen(true)}
                                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs uppercase font-bold tracking-wider py-2.5 px-5 border border-zinc-700 hover:border-zinc-500 transition-all font-mono"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            <span>Create First Poll</span>
                                        </button>
                                    ) : mySpaceDiscoverFilter === 'Threads' ? (
                                        <button
                                            onClick={() => {
                                                setOverrideContextName('Thread');
                                                setIsModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs uppercase font-bold tracking-wider py-2.5 px-5 border border-zinc-700 hover:border-zinc-500 transition-all font-mono"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            <span>Create First Thread</span>
                                        </button>
                                    ) : mySpaceDiscoverFilter === 'Queries' ? (
                                        <button
                                            onClick={() => {
                                                setOverrideContextName('Query');
                                                setIsModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs uppercase font-bold tracking-wider py-2.5 px-5 border border-zinc-700 hover:border-zinc-500 transition-all font-mono"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            <span>Create First Query</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setOverrideContextName('Thread');
                                                    setIsModalOpen(true);
                                                }}
                                                className="px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs uppercase hover:bg-zinc-800 transition-all font-mono font-bold tracking-wider"
                                            >
                                                + THREAD
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setOverrideContextName('Query');
                                                    setIsModalOpen(true);
                                                }}
                                                className="px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs uppercase hover:bg-zinc-800 transition-all font-mono font-bold tracking-wider"
                                            >
                                                + QUERY
                                            </button>
                                            <button
                                                onClick={() => setIsCreatePollModalOpen(true)}
                                                className="px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs uppercase hover:bg-zinc-800 transition-all font-mono font-bold tracking-wider"
                                            >
                                                + POLL
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredDiscoverItems.map(item => {
                                const isPoll = (item as any).type === PostType.Poll || ('options' in item && 'question' in item);

                                if (isPoll) {
                                    const poll = item as Poll;
                                    return (
                                        <div key={poll.id} className="relative group">
                                            <PollCard 
                                                poll={poll} 
                                                onDelete={() => handleDeletePoll(poll)}
                                                onVoteChange={(pollId, optionId, updatedOptions, updatedTotalVotes) => {
                                                    setUserPolls(prev => prev.map(p => p.id === pollId ? { ...p, options: updatedOptions, totalVotes: updatedTotalVotes, userVotedOptionId: optionId } : p));
                                                }}
                                            />
                                            <div className="mt-1 flex items-center justify-between px-3 py-1.5 bg-[#09090b] border border-zinc-800 text-[10px] text-zinc-500 font-mono">
                                                <span>// MY_SPACE_MANAGED · POLL_ID: {poll.id.slice(0, 8)}...</span>
                                                <ReactRouterDOM.Link 
                                                    to="/explore?tab=Discover&filter=Polls" 
                                                    className="text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
                                                >
                                                    View in Explore Discover →
                                                </ReactRouterDOM.Link>
                                            </div>
                                        </div>
                                    );
                                }

                                const post = item as Post;
                                const postTypeBadge = post.type || post.category || 'Discover';
                                return (
                                    <div key={post.id} className="bg-[#0c0c0e] border border-zinc-800 p-4 transition-all hover:border-zinc-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-zinc-700 px-1.5 py-0.5 bg-zinc-900/50">
                                                    {postTypeBadge}
                                                </span>
                                                {post.domain && (
                                                    <span className="text-[10px] text-zinc-500 uppercase">
                                                        · // {post.domain}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500">
                                                    {new Date(post.createdAt).toLocaleDateString()}
                                                </span>
                                                <button
                                                    onClick={() => handleDelete(post.id)}
                                                    disabled={deletingId === post.id}
                                                    className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                                                    title="Delete signal"
                                                >
                                                    {deletingId === post.id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">
                                            {post.oneLine || post.title || 'Untitled Transmission'}
                                        </h4>

                                        {post.content && (
                                            <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-3">
                                                {post.content}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1">
                                                    <TrendingUpIcon className="w-3.5 h-3.5 text-zinc-500" />
                                                    <span>{post.stats?.views || post.views || 0}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <HeartIcon className="w-3.5 h-3.5 text-zinc-500" />
                                                    <span>{post.stats?.likes || post.likes || 0}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-zinc-500" />
                                                    <span>{post.stats?.comments || post.comments || 0}</span>
                                                </span>
                                            </div>

                                            <ReactRouterDOM.Link 
                                                to={`/explore?tab=Discover&filter=${postTypeBadge === 'Query' ? 'Queries' : 'Threads'}`}
                                                className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
                                            >
                                                View in Discover →
                                            </ReactRouterDOM.Link>
                                        </div>
                                    </div>
                                );
                            })}
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
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setExploreSubTab('Channels')}
                                            className="px-3 py-1 font-mono text-xs uppercase text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-all"
                                        >
                                            Go to Channels
                                        </button>
                                        <button
                                            onClick={() => setIsCreateChannelModalOpen(true)}
                                            className="flex items-center gap-1 bg-white text-black hover:bg-zinc-200 px-3 py-1 font-bold text-xs uppercase tracking-wider transition-all"
                                        >
                                            <PlusIcon className="w-3.5 h-3.5" />
                                            <span>Create Channel First</span>
                                        </button>
                                    </div>
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

            {/* Feed Broadcast Deletion Confirmation Modal */}
            {postToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 shadow-2xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
                            <span className="font-mono text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                // CONFIRM_BROADCAST_PURGE
                            </span>
                            <button
                                onClick={() => {
                                    if (!deletingId) {
                                        setPostToDelete(null);
                                        setActionError(null);
                                    }
                                }}
                                disabled={!!deletingId}
                                className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                            Are you sure you want to permanently delete this broadcast?
                        </p>

                        <div className="p-3 bg-black/60 border border-zinc-800 mb-4">
                            <p className="text-xs font-mono font-bold text-white line-clamp-2 uppercase tracking-wide">
                                {postToDelete.title}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-500 mt-1">
                                TARGET: posts/{postToDelete.id}
                            </p>
                        </div>

                        {actionError && (
                            <div className="p-3 mb-4 bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono leading-relaxed">
                                <span className="font-bold text-red-400 block mb-1">// DELETION_ERROR</span>
                                {actionError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setPostToDelete(null);
                                    setActionError(null);
                                }}
                                disabled={!!deletingId}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeletePost}
                                disabled={!!deletingId}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono uppercase tracking-wider font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {deletingId === postToDelete.id ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <span>Delete Broadcast</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Channel Deletion Confirmation Modal */}
            {channelToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 shadow-2xl p-6 text-white">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
                            <span className="font-mono text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                // CONFIRM_CHANNEL_PURGE
                            </span>
                            <button
                                onClick={() => {
                                    if (!deletingChannelId) {
                                        setChannelToDelete(null);
                                        setActionError(null);
                                    }
                                }}
                                disabled={!!deletingChannelId}
                                className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                            Are you sure you want to permanently delete this channel?
                        </p>

                        <div className="p-3 bg-black/60 border border-zinc-800 mb-4">
                            <p className="text-xs font-mono font-bold text-white uppercase tracking-wide">
                                {channelToDelete.name}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-500 mt-1">
                                TARGET: channels/{channelToDelete.id}
                            </p>
                        </div>

                        {actionError && (
                            <div className="p-3 mb-4 bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono leading-relaxed">
                                <span className="font-bold text-red-400 block mb-1">// DELETION_ERROR</span>
                                {actionError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setChannelToDelete(null);
                                    setActionError(null);
                                }}
                                disabled={!!deletingChannelId}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteChannel}
                                disabled={!!deletingChannelId}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono uppercase tracking-wider font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {deletingChannelId === channelToDelete.id ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <span>Delete Channel</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Poll Deletion Confirmation Modal */}
            {pollToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 shadow-2xl p-6 text-white font-mono">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
                            <span className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                // CONFIRM_POLL_PURGE
                            </span>
                            <button
                                onClick={() => {
                                    if (!deletingId) {
                                        setPollToDelete(null);
                                        setActionError(null);
                                    }
                                }}
                                disabled={!!deletingId}
                                className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                            Are you sure you want to permanently delete this poll transmission? All recorded network votes will be purged.
                        </p>

                        <div className="p-3 bg-black/60 border border-zinc-800 mb-4">
                            <p className="text-xs font-mono font-bold text-white line-clamp-2 uppercase tracking-wide">
                                {pollToDelete.question}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-500 mt-1">
                                TARGET: polls/{pollToDelete.id}
                            </p>
                        </div>

                        {actionError && (
                            <div className="p-3 mb-4 bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono leading-relaxed">
                                <span className="font-bold text-red-400 block mb-1">// DELETION_ERROR</span>
                                {actionError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setPollToDelete(null);
                                    setActionError(null);
                                }}
                                disabled={!!deletingId}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeletePoll}
                                disabled={!!deletingId}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono uppercase tracking-wider font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {deletingId === pollToDelete.id ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <span>Delete Poll</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Poll Modal */}
            <CreatePollModal
                isOpen={isCreatePollModalOpen}
                onClose={() => setIsCreatePollModalOpen(false)}
                onCreated={(newPoll) => {
                    setUserPolls(prev => [newPoll, ...prev]);
                    setMySpaceDiscoverFilter('Polls');
                }}
            />

            {/* Non-intrusive Success Banner */}
            {actionSuccess && (
                <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500/60 text-emerald-300 text-xs font-mono px-4 py-3 shadow-2xl flex items-center gap-2.5 animate-fadeIn">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>{actionSuccess}</span>
                </div>
            )}
        </div>
    );
};

export default UploadsPage;

