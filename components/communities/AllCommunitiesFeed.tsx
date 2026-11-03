import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    useCommunityMemberships, 
    subscribeAllCommunities, 
    mergeCommunitiesWithMocks 
} from '../../services/communityService';
import { subscribeToFeed } from '../../services/postService';
import { MOCK_COMMUNITY_PUBLIC_POSTS, MOCK_COMMUNITIES } from '../../services/communitiesDemoData';
import { mockCommunities } from '../../pages/Communities';
import type { Post, Community } from '../../types';
import { 
    ArrowLeftIcon, 
    PlusIcon, 
    SparklesIcon, 
    FireIcon, 
    CodeBracketIcon, 
    PencilSquareIcon, 
    BriefcaseIcon, 
    ChatIcon, 
    GlobeAltIcon,
    MagnifyingGlassIcon,
    CloseIcon,
    FilterIcon,
    CheckIcon,
    UsersIcon,
    AcademicCapIcon
} from '../ui/Icons';
import DomainFilter from '../ui/DomainFilter';
import { CommunityFeedCard } from './CommunityFeedCard';
import FeedCardSkeleton from '../feed/FeedCardSkeleton';

const DOMAIN_ICONS: Record<string, React.FC<{ className?: string }>> = {
    'Startup': FireIcon,
    'Startups & Entrepreneurship': FireIcon,
    'Coding': CodeBracketIcon,
    'Software Development': CodeBracketIcon,
    'Design': PencilSquareIcon,
    'Business': BriefcaseIcon,
    'Artificial Intelligence': SparklesIcon,
    'Idea Exchange': ChatIcon,
    'Science & Research': AcademicCapIcon,
};

interface AllCommunitiesFeedProps {
    onExploreAll?: () => void;
    onOpenCommunity?: (communityId: string) => void;
    initialSearchTerm?: string;
}

export const AllCommunitiesFeed: React.FC<AllCommunitiesFeedProps> = ({
    onExploreAll,
    onOpenCommunity,
    initialSearchTerm = '',
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();

    // Membership management
    const { isMember, toggleMembership, actionLoadingId } = useCommunityMemberships(currentUser);

    // Communities state to check privacy & metadata
    const [firestoreCommunities, setFirestoreCommunities] = useState<Community[]>([]);

    // Realtime feed posts
    const [rawFirestorePosts, setRawFirestorePosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [feedError, setFeedError] = useState<string | null>(null);

    // Filtering, search, and sorting
    const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
    const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');

    // Sync search term if provided from parent/URL
    useEffect(() => {
        if (initialSearchTerm && initialSearchTerm !== searchTerm) {
            setSearchTerm(initialSearchTerm);
        }
    }, [initialSearchTerm]);

    // Real-time synchronization of all communities for privacy and domain mapping
    useEffect(() => {
        const unsubscribe = subscribeAllCommunities(
            (list) => {
                setFirestoreCommunities(list);
            },
            (err) => {
                console.warn('[ALL_COMMUNITIES_FEED_COMMUNITIES_ERR]', err);
            }
        );
        return () => unsubscribe();
    }, []);

    // Merge communities with mock fallback
    const allCommunities = useMemo(() => {
        const combinedMocks = [...mockCommunities, ...MOCK_COMMUNITIES];
        return mergeCommunitiesWithMocks(
            firestoreCommunities,
            combinedMocks,
            currentUser?.uid,
            isMember
        );
    }, [firestoreCommunities, currentUser?.uid, isMember]);

    // Build community lookup map for rapid visibility & category resolution
    const communityMap = useMemo(() => {
        const map = new Map<string, Community>();
        for (const c of allCommunities) {
            if (c.id) map.set(c.id.toLowerCase(), c);
            if (c.handle) map.set(c.handle.toLowerCase().replace(/^@/, ''), c);
            if (c.name) map.set(c.name.toLowerCase().trim(), c);
        }
        return map;
    }, [allCommunities]);

    // Real-time subscription to public Firestore posts
    const fetchFeed = useCallback(() => {
        setLoadingPosts(true);
        setFeedError(null);
        return subscribeToFeed(
            { pageSize: 100 },
            (posts) => {
                setRawFirestorePosts(posts);
                setLoadingPosts(false);
            },
            (err) => {
                console.warn('[ALL_COMMUNITIES_FEED_SUBSCRIBE_ERR]', err);
                setFeedError('Failed to load global community feed.');
                setLoadingPosts(false);
            }
        );
    }, []);

    useEffect(() => {
        const unsubscribe = fetchFeed();
        return () => unsubscribe();
    }, [fetchFeed]);

    // Merge and filter posts across every community
    const allCommunityPosts = useMemo(() => {
        // 1. Filter real Firestore posts belonging to any community
        const realPosts = rawFirestorePosts.filter((post) => {
            // Must belong to a community
            if (!post.communityId && !post.communityName) {
                return false;
            }

            // Exclude drafts or unpublished content
            if (post.status === 'draft' || post.isPublished === false) {
                return false;
            }

            // Community visibility resolution
            const commId = (post.communityId || '').toLowerCase();
            const comm = commId ? communityMap.get(commId) : null;

            // If community exists and is private: only members or creator/owner may view
            if (comm && comm.visibility === 'private') {
                const isMemberOfCommunity = post.communityId ? isMember(post.communityId) : false;
                const isOwner = currentUser?.uid && (comm.ownerId === currentUser.uid || comm.creatorId === currentUser.uid);
                if (!isMemberOfCommunity && !isOwner) {
                    return false;
                }
            }

            // If the post itself is private: respect visibility
            if (post.visibility === 'private') {
                const isMemberOfCommunity = post.communityId ? isMember(post.communityId) : false;
                const isAuthor = currentUser?.uid && (post.authorId === currentUser.uid || post.author?.id === currentUser.uid);
                if (!isMemberOfCommunity && !isAuthor) {
                    return false;
                }
            }

            return true;
        });

        // 2. Fallback mock public posts for unjoined demo communities
        const mockPosts = MOCK_COMMUNITY_PUBLIC_POSTS.filter((post) => {
            if (post.status === 'draft' || post.isPublished === false) return false;
            return true;
        });

        // 3. Deduplicate by post ID (real Firestore posts take precedence)
        const seenIds = new Set<string>();
        const combined: Post[] = [];

        for (const p of realPosts) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                combined.push(p);
            }
        }

        for (const p of mockPosts) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                combined.push(p);
            }
        }

        return combined;
    }, [rawFirestorePosts, communityMap, isMember, currentUser?.uid]);

    // Extract dynamic domain list from all available communities and posts
    const dynamicDomains = useMemo(() => {
        const domainSet = new Set<string>();
        // Standard core categories
        const coreDefaults = ['Startup', 'Coding', 'Design', 'Business', 'Artificial Intelligence', 'Idea Exchange'];
        coreDefaults.forEach((d) => domainSet.add(d));

        // Gather from all registered communities
        allCommunities.forEach((c) => {
            if (c.category?.trim()) domainSet.add(c.category.trim());
        });

        // Gather from existing posts
        allCommunityPosts.forEach((p) => {
            if (p.domain?.trim()) domainSet.add(p.domain.trim());
            else if (p.category?.trim()) domainSet.add(p.category.trim());
        });

        return Array.from(domainSet).sort((a, b) => a.localeCompare(b));
    }, [allCommunities, allCommunityPosts]);

    const dynamicDomainFilterOptions = useMemo(() => {
        return dynamicDomains.map((name) => ({
            name,
            icon: DOMAIN_ICONS[name] || GlobeAltIcon,
        }));
    }, [dynamicDomains]);

    const handleDomainChange = (newSelectedDomains: string[]) => {
        const chosen = newSelectedDomains.length > 0 ? newSelectedDomains[0] : 'ALL';
        setSelectedDomain(chosen);
    };

    // Filter by Domain and Search Query, then apply Sorting
    const filteredAndSortedPosts = useMemo(() => {
        let list = allCommunityPosts;

        // 1. Domain Filter
        if (selectedDomain !== 'ALL') {
            const targetLower = selectedDomain.toLowerCase().trim();
            list = list.filter((p) => {
                const postDomain = (p.domain || '').toLowerCase().trim();
                const postCategory = (p.category || '').toLowerCase().trim();

                // Direct match on post domain or category
                if (postDomain === targetLower || postCategory === targetLower) return true;

                // Match with originating community category or domain
                const commId = (p.communityId || p.channelId || '').toLowerCase().trim();
                const commName = (p.communityName || '').toLowerCase().trim();
                const comm = (commId ? communityMap.get(commId) : null)
                    || (commName ? communityMap.get(commName) : null);

                if (comm) {
                    const commCategory = (comm.category || '').toLowerCase().trim();
                    const commDomain = (comm.domain || '').toLowerCase().trim();
                    if (commCategory === targetLower || commDomain === targetLower) {
                        return true;
                    }

                    // Flexible match between synonymous domains
                    if ((targetLower.includes('startup') || targetLower.includes('entrepreneur')) &&
                        (commCategory.includes('startup') || commDomain.includes('startup'))) {
                        return true;
                    }
                    if ((targetLower.includes('coding') || targetLower.includes('software')) &&
                        (commCategory.includes('coding') || commCategory.includes('software') || commDomain.includes('coding') || commDomain.includes('software'))) {
                        return true;
                    }
                    if ((targetLower.includes('artificial') || targetLower === 'ai') &&
                        (commCategory.includes('artificial') || commCategory === 'ai' || commDomain.includes('artificial') || commDomain === 'ai')) {
                        return true;
                    }
                    if (targetLower.includes('science') && (commCategory.includes('science') || commDomain.includes('science'))) {
                        return true;
                    }
                }

                // Flexible match on post fields
                if ((targetLower.includes('startup') || targetLower.includes('entrepreneur')) &&
                    (postDomain.includes('startup') || postCategory.includes('startup'))) {
                    return true;
                }
                if ((targetLower.includes('coding') || targetLower.includes('software')) &&
                    (postDomain.includes('coding') || postDomain.includes('software') || postCategory.includes('coding') || postCategory.includes('software'))) {
                    return true;
                }
                if ((targetLower.includes('artificial') || targetLower === 'ai') &&
                    (postDomain.includes('artificial') || postDomain === 'ai' || postCategory.includes('artificial') || postCategory === 'ai')) {
                    return true;
                }
                if (targetLower.includes('science') && (postDomain.includes('science') || postCategory.includes('science'))) {
                    return true;
                }

                // Match in tags
                if (Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().trim() === targetLower)) {
                    return true;
                }

                return false;
            });
        }

        // 2. Search Query Filter
        const query = searchTerm.trim().toLowerCase();
        if (query) {
            const cleanQuery = query.startsWith('@') ? query.slice(1).trim() : query;
            const tokens = cleanQuery.split(/\s+/).filter(Boolean);

            list = list.filter((p) => {
                const title = (p.title || p.oneLine || '').toLowerCase();
                const content = (p.content || '').toLowerCase();
                const commName = (p.communityName || '').toLowerCase();
                const authorName = (p.author?.name || '').toLowerCase();
                const tags = Array.isArray(p.tags) ? p.tags.map((t) => t.toLowerCase()) : [];

                if (title.includes(cleanQuery) || content.includes(cleanQuery) || commName.includes(cleanQuery) || authorName.includes(cleanQuery)) {
                    return true;
                }

                if (tags.some((t) => t.includes(cleanQuery))) {
                    return true;
                }

                if (tokens.length > 1) {
                    return tokens.every((token) => 
                        title.includes(token) || 
                        content.includes(token) || 
                        commName.includes(token) || 
                        authorName.includes(token) ||
                        tags.some((t) => t.includes(token))
                    );
                }

                return false;
            });
        }

        // 3. Sorting
        return [...list].sort((a, b) => {
            if (sortMode === 'popular') {
                const likesA = Number(a.stats?.likes ?? a.likeCount ?? 0);
                const commentsA = Number(a.stats?.comments ?? a.commentCount ?? 0);
                const viewsA = Number(a.stats?.views ?? a.viewCount ?? 0);
                const scoreA = likesA * 2 + commentsA * 3 + viewsA * 0.05;

                const likesB = Number(b.stats?.likes ?? b.likeCount ?? 0);
                const commentsB = Number(b.stats?.comments ?? b.commentCount ?? 0);
                const viewsB = Number(b.stats?.views ?? b.viewCount ?? 0);
                const scoreB = likesB * 2 + commentsB * 3 + viewsB * 0.05;

                return scoreB - scoreA;
            }

            // Latest: by date descending
            const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
        });
    }, [allCommunityPosts, selectedDomain, searchTerm, sortMode, communityMap]);

    // Handle Join / Leave community action
    const handleToggleMembership = useCallback(
        async (communityData: { id: string; name: string; category?: string; avatarUrl?: string }) => {
            if (!currentUser) {
                navigate('/login');
                return;
            }
            await toggleMembership({
                id: communityData.id,
                name: communityData.name,
                category: communityData.category || 'General',
                avatarUrl: communityData.avatarUrl,
            });
        },
        [currentUser, navigate, toggleMembership]
    );

    // Navigate to unified detailed publisher under My Space -> Uploads -> Communities
    const handleOpenCreatePost = () => {
        navigate('/myspace/uploads?tab=Communities&create=true&from=all-communities', {
            state: {
                from: 'all-communities',
                returnUrl: '/communities?view=all',
            },
        });
    };

    const hasActiveFilters = selectedDomain !== 'ALL' || searchTerm.trim() !== '';

    const handleClearFilters = () => {
        setSelectedDomain('ALL');
        setSearchTerm('');
    };

    return (
        <div className="space-y-4">
            {/* Header Section */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest block">
                            // GLOBAL_COLLECTIVE_FEED
                        </span>
                        <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse"></span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold font-mono uppercase text-white tracking-wide flex items-center gap-2.5">
                        <GlobeAltIcon className="w-5 h-5 text-emerald-400" />
                        <span>GLOBAL COLLECTIVE</span>
                    </h1>
                    <p className="text-xs font-mono text-zinc-400 leading-relaxed max-w-2xl">
                        Discover public conversations, ideas and broadcasts from across every collective on INVOX.
                    </p>
                </div>
            </div>

            {/* Separate Domain Filter Bar */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-4 relative z-20">
                <DomainFilter
                    domains={dynamicDomainFilterOptions}
                    selectedDomains={selectedDomain === 'ALL' ? [] : [selectedDomain]}
                    onSelectionChange={handleDomainChange}
                    onChange={handleDomainChange}
                    singleSelect={true}
                    closeOnSelect={true}
                    className="mb-0"
                />
            </div>

            {/* Feed Controls: Search + Sort + Stats Bar */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search in feed */}
                <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="search"
                        placeholder="SEARCH_PUBLIC_FEED..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black border border-zinc-800 p-2 pl-9 pr-8 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Sort Mode & Stats */}
                <div className="flex items-center gap-3 justify-between md:justify-end flex-wrap">
                    <div className="flex items-center gap-1 font-mono text-xs">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-wider mr-1 hidden sm:inline">SORT:</span>
                        <button
                            type="button"
                            onClick={() => setSortMode('latest')}
                            className={`px-3 py-1.5 border uppercase tracking-wider transition-colors cursor-pointer ${
                                sortMode === 'latest'
                                    ? 'bg-zinc-900 border-emerald-500/50 text-white font-bold'
                                    : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                        >
                            LATEST
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortMode('popular')}
                            className={`px-3 py-1.5 border uppercase tracking-wider transition-colors cursor-pointer ${
                                sortMode === 'popular'
                                    ? 'bg-zinc-900 border-emerald-500/50 text-white font-bold'
                                    : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                        >
                            POPULAR
                        </button>
                    </div>

                    <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest hidden lg:block">
                        // {filteredAndSortedPosts.length} BROADCASTS
                    </div>
                </div>
            </div>

            {/* Error Banner with Retry */}
            {feedError && (
                <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-400 font-mono text-xs flex items-center justify-between gap-3">
                    <p>{feedError}</p>
                    <button
                        type="button"
                        onClick={fetchFeed}
                        className="px-3 py-1 bg-rose-900/40 border border-rose-700 hover:bg-rose-900/60 text-white uppercase text-[10px] font-bold"
                    >
                        RETRY
                    </button>
                </div>
            )}

            {/* Feed Stream */}
            {loadingPosts && allCommunityPosts.length === 0 ? (
                <div className="space-y-4">
                    <FeedCardSkeleton />
                    <FeedCardSkeleton />
                    <FeedCardSkeleton />
                </div>
            ) : filteredAndSortedPosts.length > 0 ? (
                <div className="space-y-4">
                    {filteredAndSortedPosts.map((post) => {
                        const postCommunityId = post.communityId || '';
                        const joined = postCommunityId ? isMember(postCommunityId) : false;
                        const isActionLoading = actionLoadingId === postCommunityId;

                        return (
                            <CommunityFeedCard
                                key={post.id}
                                post={post}
                                isMember={joined}
                                onToggleMembership={handleToggleMembership}
                                isMembershipLoading={isActionLoading}
                                showMembershipAction={Boolean(postCommunityId)}
                                onOpenCommunity={onOpenCommunity}
                            />
                        );
                    })}
                </div>
            ) : hasActiveFilters ? (
                /* Filtered Empty State */
                <div className="bg-[#0c0c0e] border border-zinc-800 p-8 sm:p-12 text-center space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600">
                        <FilterIcon className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold font-mono uppercase text-white tracking-wider">
                            NO POSTS MATCHING FILTER
                        </h3>
                        <p className="text-xs font-mono text-zinc-500 max-w-md mx-auto leading-relaxed">
                            {selectedDomain !== 'ALL' && searchTerm
                                ? `No broadcasts found in "${selectedDomain}" matching "${searchTerm}".`
                                : selectedDomain !== 'ALL'
                                ? `No community posts have been published under the "${selectedDomain}" domain yet.`
                                : `No community posts matching "${searchTerm}".`}
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            CLEAR FILTERS
                        </button>
                    </div>
                </div>
            ) : (
                /* Platform Empty State */
                <div className="bg-[#0c0c0e] border border-zinc-800 p-8 sm:p-12 text-center space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600">
                        <GlobeAltIcon className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-bold font-mono uppercase text-white tracking-wider">
                            NO COMMUNITY POSTS YET
                        </h3>
                        <p className="text-xs font-mono text-zinc-500 max-w-md mx-auto leading-relaxed">
                            Be the first to share an engineering dispatch, prototype demo, or project query with the global network.
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleOpenCreatePost}
                            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                            <span>PUBLISH FIRST POST</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllCommunitiesFeed;
