import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    useUserJoinedCommunities, 
    JoinedCommunityRecord 
} from '../../services/communityService';
import { 
    subscribeToCommunityPosts, 
    filterAndSortCommunityPosts, 
    SAMPLE_COMMUNITY_POSTS, 
    CommunityFeedSortOption 
} from '../../services/communityFeedService';
import type { Post } from '../../types';
import CommunityPostCard from './CommunityPostCard';
import CreateCommunityPostModal from './CreateCommunityPostModal';
import { CommentSection } from '../feed/CommentSection';
import FeedCardSkeleton from '../feed/FeedCardSkeleton';
import { 
    PencilSquareIcon, 
    ArrowLeftIcon, 
    FilterIcon, 
    ChevronDownIcon, 
    UsersIcon, 
    PlusIcon,
    SparklesIcon,
    CloseIcon,
    FireIcon,
    GlobeAltIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface MyCommunitiesFeedProps {
    onExploreAll?: () => void;
    onOpenCommunity?: (communityId: string) => void;
}

export const MyCommunitiesFeed: React.FC<MyCommunitiesFeedProps> = ({
    onExploreAll,
    onOpenCommunity,
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();

    // Authoritative real-time user memberships
    const { joinedCommunities, loading: membershipsLoading, count: joinedCount } = useUserJoinedCommunities(currentUser);

    // Filter and Sort states
    const [selectedCommunityId, setSelectedCommunityId] = useState<string | 'ALL'>('ALL');
    const [sortOption, setSortOption] = useState<CommunityFeedSortOption>('LATEST');
    const [pageCount, setPageCount] = useState<number>(1);
    const PAGE_SIZE = 10;

    // Real-time Firestore posts & local creations
    const [firestorePosts, setFirestorePosts] = useState<Post[]>([]);
    const [feedLoading, setFeedLoading] = useState<boolean>(true);
    const [feedError, setFeedError] = useState<string | null>(null);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);

    // Sync selected community from URL query param if present (?community=xxx)
    useEffect(() => {
        const commParam = searchParams.get('community');
        if (commParam) {
            setSelectedCommunityId(commParam);
        }
    }, [searchParams]);

    // Update URL param when selected community changes
    const handleSelectCommunity = (commId: string | 'ALL') => {
        setSelectedCommunityId(commId);
        setPageCount(1);
        if (commId === 'ALL') {
            searchParams.delete('community');
            setSearchParams(searchParams, { replace: true });
        } else {
            searchParams.set('community', commId);
            setSearchParams(searchParams, { replace: true });
        }
    };

    // Real-time subscription to community posts in Firestore
    useEffect(() => {
        setFeedLoading(true);
        const unsubscribe = subscribeToCommunityPosts(
            (posts) => {
                setFirestorePosts(posts);
                setFeedLoading(false);
            },
            (err) => {
                console.warn('[COMMUNITY_FEED_SUB_ERR]', err);
                setFeedError('Unable to sync live posts from Firestore');
                setFeedLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Set of IDs the user has currently joined (or owned)
    const joinedCommunityIds = useMemo(() => {
        return new Set(joinedCommunities.map(j => j.id));
    }, [joinedCommunities]);

    // Authoritative combined post collection:
    // Merges real Firestore community posts with in-memory sample posts for testing/reviewing
    const allAvailablePosts = useMemo(() => {
        const seenIds = new Set<string>();
        const combined: Post[] = [];

        // 1. Live Firestore posts take top precedence
        for (const p of firestorePosts) {
            if (!p || !p.id || seenIds.has(p.id)) continue;
            seenIds.add(p.id);
            combined.push(p);
        }

        // 2. Sample demonstration posts for joined communities (only if not already created)
        for (const sp of SAMPLE_COMMUNITY_POSTS) {
            if (!sp || !sp.id || seenIds.has(sp.id)) continue;
            seenIds.add(sp.id);
            combined.push(sp);
        }

        return combined;
    }, [firestorePosts]);

    // Computed filtered & sorted feed based on user's actual joined communities
    const filteredFeedPosts = useMemo(() => {
        return filterAndSortCommunityPosts(
            allAvailablePosts,
            joinedCommunityIds,
            selectedCommunityId,
            sortOption,
            currentUser?.uid
        );
    }, [allAvailablePosts, joinedCommunityIds, selectedCommunityId, sortOption, currentUser?.uid]);

    // Paginated posts currently visible
    const visiblePosts = useMemo(() => {
        return filteredFeedPosts.slice(0, pageCount * PAGE_SIZE);
    }, [filteredFeedPosts, pageCount, PAGE_SIZE]);

    const hasMore = visiblePosts.length < filteredFeedPosts.length;

    const handleLoadMore = () => {
        setPageCount(prev => prev + 1);
    };

    // When user creates a new post, prepend it optimistically
    const handlePostCreated = useCallback((newPost: Post) => {
        setFirestorePosts(prev => [newPost, ...prev.filter(p => p.id !== newPost.id)]);
        // If created in a community that isn't selected, switch to ALL or that community so user sees their post immediately
        if (selectedCommunityId !== 'ALL' && newPost.communityId !== selectedCommunityId) {
            setSelectedCommunityId('ALL');
        }
    }, [selectedCommunityId]);

    const activeCommunityRecord = useMemo(() => {
        if (selectedCommunityId === 'ALL') return null;
        return joinedCommunities.find(c => c.id === selectedCommunityId) || null;
    }, [selectedCommunityId, joinedCommunities]);

    const isLoading = membershipsLoading || (feedLoading && allAvailablePosts.length === 0);

    return (
        <div className="space-y-5 font-mono text-xs w-full min-w-0 pb-16">
            {/* 1. PAGE HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {onExploreAll && (
                            <button
                                onClick={onExploreAll}
                                className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors mr-1"
                                title="View All Communities Leaderboard"
                            >
                                <ArrowLeftIcon className="w-4 h-4" />
                            </button>
                        )}
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block">
                            // AGGREGATED_COMMUNITY_FEED
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-white">
                        COMMUNITY FEED
                    </h1>
                    <p className="text-zinc-400 text-xs">
                        Aggregated public broadcasts and signals across all your joined collectives.
                    </p>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="bg-[#0c0c0e] border border-zinc-800 px-3 py-1.5 flex items-center gap-2">
                        <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-400 uppercase text-[11px]">JOINED:</span>
                        <strong className="font-bold text-white">{joinedCount}</strong>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        disabled={joinedCount === 0}
                        className="px-4 py-2 uppercase font-bold text-xs bg-white text-black border border-white hover:bg-zinc-200 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>CREATE POST</span>
                    </button>
                </div>
            </div>

            {/* 2. FEED NAVIGATION & FILTERS BAR */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Primary Filter Tabs: ALL vs Specific Selector */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            onClick={() => handleSelectCommunity('ALL')}
                            className={`px-3 py-1.5 font-bold uppercase transition-colors text-xs border ${
                                selectedCommunityId === 'ALL'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                        >
                            ALL COMMUNITIES ({filteredFeedPosts.length})
                        </button>

                        {/* Joined Communities Dropdown Filter */}
                        {joinedCommunities.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedCommunityId}
                                    onChange={(e) => handleSelectCommunity(e.target.value)}
                                    className={`appearance-none bg-black border px-3 py-1.5 pr-8 font-mono text-xs uppercase font-bold cursor-pointer transition-colors focus:outline-none ${
                                        selectedCommunityId !== 'ALL'
                                            ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                                            : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <option value="ALL">Select Community...</option>
                                    {joinedCommunities.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.community.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    {/* Sorting Controls */}
                    <div className="flex items-center gap-1.5 self-end md:self-center">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">// SORT:</span>
                        {(['LATEST', 'POPULAR'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => {
                                    setSortOption(opt);
                                    setPageCount(1);
                                }}
                                className={`px-2.5 py-1 text-[11px] font-bold uppercase border transition-colors ${
                                    sortOption === opt
                                        ? 'bg-zinc-800 text-white border-zinc-600'
                                        : 'bg-black border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Active Specific Filter Indicator Badge */}
                {activeCommunityRecord && (
                    <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500 uppercase text-[10px]">// ACTIVE_FILTER:</span>
                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-white font-bold uppercase flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                                {activeCommunityRecord.community.name}
                            </span>
                            <span className="text-zinc-500 text-[11px]">
                                ({filteredFeedPosts.length} posts)
                            </span>
                        </div>
                        <button
                            onClick={() => handleSelectCommunity('ALL')}
                            className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] uppercase transition-colors"
                        >
                            <span>Return to All Communities</span>
                            <CloseIcon className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>

            {/* 3. QUICK COMPOSER CARD */}
            {joinedCommunities.length > 0 && (
                <div 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-3.5 flex items-center justify-between gap-3 cursor-pointer group transition-colors"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {currentUser?.photoURL ? (
                            <img
                                src={currentUser.photoURL}
                                alt="You"
                                onError={handleImageError}
                                className="w-8 h-8 rounded-full border border-zinc-700 object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-500 flex-shrink-0">
                                <UsersIcon className="w-4 h-4" />
                            </div>
                        )}
                        <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors truncate">
                            {selectedCommunityId !== 'ALL' && activeCommunityRecord
                                ? `Share a broadcast in ${activeCommunityRecord.community.name}...`
                                : 'Share an update, technical insight, or inquiry with your joined collectives...'}
                        </span>
                    </div>

                    <button
                        type="button"
                        className="px-3 py-1.5 bg-zinc-900 group-hover:bg-zinc-800 border border-zinc-700 text-white uppercase font-bold text-[11px] whitespace-nowrap transition-colors flex items-center gap-1.5"
                    >
                        <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>POST</span>
                    </button>
                </div>
            )}

            {/* 4. FEED LIST */}
            {isLoading ? (
                <div className="space-y-4">
                    <FeedCardSkeleton />
                    <FeedCardSkeleton />
                </div>
            ) : visiblePosts.length > 0 ? (
                <div className="space-y-4">
                    {visiblePosts.map(post => (
                        <CommunityPostCard
                            key={post.id}
                            post={post}
                            onCommentClick={(p) => setActiveCommentPost(p)}
                            onCommunityClick={(commId) => {
                                if (onOpenCommunity) onOpenCommunity(commId);
                                else navigate(`/communities/${commId}`);
                            }}
                        />
                    ))}

                    {/* Pagination / Load More */}
                    {hasMore ? (
                        <div className="pt-4 text-center">
                            <button
                                onClick={handleLoadMore}
                                className="px-6 py-2.5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white uppercase font-bold tracking-wider transition-colors text-xs"
                            >
                                LOAD MORE POSTS ({filteredFeedPosts.length - visiblePosts.length} remaining)
                            </button>
                        </div>
                    ) : filteredFeedPosts.length > 5 && (
                        <div className="py-6 text-center text-zinc-600 text-[11px] border-t border-zinc-900">
                            // ALL_COMMUNITY_BROADCASTS_SYNCHRONIZED
                        </div>
                    )}
                </div>
            ) : (
                /* EMPTY STATES */
                <div className="py-16 px-6 text-center border border-dashed border-zinc-800 bg-[#0c0c0e] space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <UsersIcon className="w-6 h-6" />
                    </div>

                    {joinedCommunities.length === 0 ? (
                        <div className="space-y-2 max-w-md mx-auto">
                            <h3 className="text-sm font-bold uppercase text-white tracking-wide">
                                // NO_COMMUNITY_MEMBERSHIPS_FOUND
                            </h3>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                                You have not joined any community collectives yet. Join ecosystems from the leaderboard to aggregate their broadcasts, discussions, and member signals into this feed.
                            </p>
                            <div className="pt-3">
                                {onExploreAll ? (
                                    <button
                                        onClick={onExploreAll}
                                        className="px-5 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                                    >
                                        EXPLORE COMMUNITIES LEADERBOARD
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate('/communities')}
                                        className="px-5 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                                    >
                                        EXPLORE COMMUNITIES
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : selectedCommunityId !== 'ALL' ? (
                        <div className="space-y-2 max-w-md mx-auto">
                            <h3 className="text-sm font-bold uppercase text-white tracking-wide">
                                // NO_BROADCASTS_IN_COLLECTIVE
                            </h3>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                                No public posts have been published in <strong className="text-white">{activeCommunityRecord?.community.name}</strong> yet. Be the first to share an update!
                            </p>
                            <div className="pt-3 flex items-center justify-center gap-3">
                                <button
                                    onClick={() => handleSelectCommunity('ALL')}
                                    className="px-4 py-2 font-mono text-xs font-bold uppercase bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
                                >
                                    SHOW ALL COMMUNITIES
                                </button>
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="px-4 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                                >
                                    CREATE FIRST POST
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 max-w-md mx-auto">
                            <h3 className="text-sm font-bold uppercase text-white tracking-wide">
                                // NO_COMMUNITY_POSTS_FOUND
                            </h3>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                                None of your joined communities have published public posts yet. Start the conversation by creating a broadcast.
                            </p>
                            <div className="pt-3">
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="px-5 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                                >
                                    CREATE A POST
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CREATE POST MODAL */}
            <CreateCommunityPostModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                joinedCommunities={joinedCommunities}
                preselectedCommunityId={selectedCommunityId !== 'ALL' ? selectedCommunityId : null}
                onPostCreated={handlePostCreated}
            />

            {/* INTERACTIVE COMMENTS DRAWER/MODAL */}
            {activeCommentPost && (
                <CommentSection
                    post={activeCommentPost}
                    isOpen={Boolean(activeCommentPost)}
                    onClose={() => setActiveCommentPost(null)}
                    onCommentAdded={(postId) => {
                        // Increment local comment count optimistically
                        setFirestorePosts(prev => prev.map(p => {
                            if (p.id === postId) {
                                return {
                                    ...p,
                                    stats: { ...p.stats, comments: (p.stats?.comments || 0) + 1 },
                                    commentCount: (p.commentCount || 0) + 1,
                                };
                            }
                            return p;
                        }));
                    }}
                />
            )}
        </div>
    );
};

export default MyCommunitiesFeed;
