import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    useUserJoinedCommunities, 
    JoinedCommunityRecord 
} from '../../services/communityService';
import { 
    subscribeToFeed, 
    toggleLikePost 
} from '../../services/postService';
import { MOCK_COMMUNITY_PUBLIC_POSTS } from '../../services/communitiesDemoData';
import type { Post } from '../../types';
import { 
    ArrowLeftIcon, 
    PlusIcon, 
    SparklesIcon, 
    ChatBubbleBottomCenterTextIcon, 
    HeartIcon, 
    ForwardIcon, 
    CheckBadgeIcon, 
    UsersIcon, 
    FireIcon, 
    BookmarkIcon,
    LockClosedIcon,
    ChevronDownIcon,
    CheckIcon,
    MagnifyingGlassIcon,
    CloseIcon,
    FilterIcon,
    CodeBracketIcon,
    PencilSquareIcon,
    BriefcaseIcon,
    ChatIcon,
    GlobeAltIcon
} from '../ui/Icons';
import DomainFilter from '../ui/DomainFilter';
import { handleImageError } from '../utils/imageUtils';
import { PrivateCommunityInteractionModal } from './PrivateCommunityInteractionModal';
import { CommunityFeedCard } from './CommunityFeedCard';

const DOMAIN_ICONS: Record<string, React.FC<{ className?: string }>> = {
    'Coding': CodeBracketIcon,
    'Startup': FireIcon,
    'Design': PencilSquareIcon,
    'Business': BriefcaseIcon,
    'Artificial Intelligence': SparklesIcon,
    'Idea Exchange': ChatIcon,
};

interface MyCommunitiesInteractionHubProps {
    onExploreAll?: () => void;
    onOpenCommunity?: (communityId: string) => void;
}

export const MyCommunitiesInteractionHub: React.FC<MyCommunitiesInteractionHubProps> = ({
    onExploreAll,
    onOpenCommunity
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams] = ReactRouterDOM.useSearchParams();
    const location = ReactRouterDOM.useLocation();

    const { joinedCommunities, loading: membershipsLoading } = useUserJoinedCommunities(currentUser);
    const [rawFirestorePosts, setRawFirestorePosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);

    // Filter states
    const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
    const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string>('ALL');
    const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');

    // Community dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownSearch, setDropdownSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Modals & feedback state
    const [selectedInboxRecord, setSelectedInboxRecord] = useState<JoinedCommunityRecord | null>(null);
    const [successBanner, setSuccessBanner] = useState<string | null>(null);

    // Sync selected community from query parameters or location state if provided
    useEffect(() => {
        const commParam = searchParams.get('community') || searchParams.get('communityId') || (location.state as any)?.communityId;
        if (commParam && commParam !== selectedCommunityFilter) {
            setSelectedCommunityFilter(commParam);
        }
    }, [searchParams, location.state, selectedCommunityFilter]);

    // Handle post publication success notification when redirected back
    useEffect(() => {
        const msg = (location.state as any)?.successMessage;
        if (msg) {
            setSuccessBanner(msg);
            const timer = setTimeout(() => setSuccessBanner(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [location.state]);

    // Navigate to unified detailed publisher under My Space -> Uploads -> Communities
    const handleOpenCreatePost = () => {
        const hasSpecificCommunity = selectedCommunityFilter !== 'ALL';
        const commParam = hasSpecificCommunity ? `&communityId=${encodeURIComponent(selectedCommunityFilter)}` : '';
        const returnUrl = `/communities?view=my-communities${hasSpecificCommunity ? `&community=${encodeURIComponent(selectedCommunityFilter)}` : ''}`;
        navigate(`/myspace/uploads?tab=Communities&create=true&from=communities${commParam}`, {
            state: {
                from: 'communities',
                fromCommunities: true,
                communityId: hasSpecificCommunity ? selectedCommunityFilter : undefined,
                returnUrl,
            }
        });
    };

    // Likes state tracking for snappy feedback
    const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
    const [likeOffsets, setLikeOffsets] = useState<Record<string, number>>({});
    const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

    // Close dropdown on click outside or escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDropdownOpen]);

    // Populate available domains dynamically from the user's joined communities
    const availableDomains = useMemo(() => {
        const set = new Set<string>();
        joinedCommunities.forEach(item => {
            const cat = item.community?.category?.trim();
            if (cat) {
                set.add(cat);
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [joinedCommunities]);

    // Handle domain selection with conflict resolution:
    // If a selected community does not belong to the selected domain, automatically reset to ALL
    const handleDomainSelect = (domain: string) => {
        setSelectedDomain(domain);
        if (selectedCommunityFilter !== 'ALL' && domain !== 'ALL') {
            const targetRecord = joinedCommunities.find(c => c.id.toLowerCase() === selectedCommunityFilter.toLowerCase());
            const targetCat = targetRecord?.community?.category?.trim();
            if (!targetCat || targetCat.toLowerCase() !== domain.toLowerCase()) {
                setSelectedCommunityFilter('ALL');
            }
        }
    };

    // Format domains for the standardized DomainFilter component
    const dynamicDomainFilterOptions = useMemo(() => {
        return availableDomains.map(name => ({
            name,
            icon: DOMAIN_ICONS[name] || GlobeAltIcon
        }));
    }, [availableDomains]);

    const handleDomainChange = (newSelectedDomains: string[]) => {
        const chosen = newSelectedDomains.length > 0 ? newSelectedDomains[0] : 'ALL';
        handleDomainSelect(chosen);
    };

    // Filter available communities matching the selected domain
    const communitiesInActiveDomain = useMemo(() => {
        if (selectedDomain === 'ALL') {
            return joinedCommunities;
        }
        const targetDomainLower = selectedDomain.toLowerCase();
        return joinedCommunities.filter(c => {
            const cat = c.community?.category?.trim();
            return cat && cat.toLowerCase() === targetDomainLower;
        });
    }, [joinedCommunities, selectedDomain]);

    // Search filter within dropdown options
    const dropdownFilteredCommunities = useMemo(() => {
        const query = dropdownSearch.trim().toLowerCase();
        if (!query) return communitiesInActiveDomain;
        return communitiesInActiveDomain.filter(c => {
            const name = c.community?.name?.toLowerCase() || '';
            const category = c.community?.category?.toLowerCase() || '';
            const handle = c.community?.handle?.toLowerCase() || '';
            return name.includes(query) || category.includes(query) || handle.includes(query);
        });
    }, [communitiesInActiveDomain, dropdownSearch]);

    // Currently selected community record
    const selectedCommunityRecord = useMemo(() => {
        if (selectedCommunityFilter === 'ALL') return null;
        return joinedCommunities.find(c => c.id.toLowerCase() === selectedCommunityFilter.toLowerCase()) || null;
    }, [joinedCommunities, selectedCommunityFilter]);

    // Label for the compact dropdown button
    const dropdownButtonLabel = useMemo(() => {
        if (selectedCommunityFilter === 'ALL') {
            return selectedDomain === 'ALL'
                ? 'ALL JOINED COMMUNITIES'
                : `ALL ${selectedDomain.toUpperCase()} COMMUNITIES`;
        }
        return selectedCommunityRecord?.community?.name?.toUpperCase() || 'ALL JOINED COMMUNITIES';
    }, [selectedCommunityFilter, selectedDomain, selectedCommunityRecord]);

    // Subscribe to public posts in Firestore
    useEffect(() => {
        const unsubscribe = subscribeToFeed(
            { pageSize: 100 },
            (posts) => {
                setRawFirestorePosts(posts);
                setLoadingPosts(false);
            },
            (err) => {
                console.warn('[FEED_SUBSCRIBE_ERR]', err);
                setLoadingPosts(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Extract all joined community IDs and names for filtering
    const joinedCommunityIds = useMemo(() => {
        return new Set(joinedCommunities.map(c => c.id.toLowerCase()));
    }, [joinedCommunities]);

    const joinedCommunityNames = useMemo(() => {
        return new Set(joinedCommunities.map(c => c.community.name.toLowerCase()));
    }, [joinedCommunities]);

    // Aggregate public community posts from joined communities
    const aggregatedPosts = useMemo(() => {
        if (joinedCommunities.length === 0) {
            return [];
        }

        // 1. Filter real Firestore posts belonging to the user's joined communities
        const realCommunityPosts = rawFirestorePosts.filter(post => {
            if (post.visibility && post.visibility !== 'public') return false;

            // Direct community ID match
            if (post.communityId && joinedCommunityIds.has(post.communityId.toLowerCase())) {
                return true;
            }

            // Channel ID matching community ID
            if (post.channelId && joinedCommunityIds.has(post.channelId.toLowerCase())) {
                return true;
            }

            // Community name match fallback
            if (post.communityName && joinedCommunityNames.has(post.communityName.toLowerCase())) {
                return true;
            }

            return false;
        });

        // 2. Include preserved mock public posts for any mock communities the user has joined
        const matchingMockPosts = MOCK_COMMUNITY_PUBLIC_POSTS.filter(post => {
            if (post.communityId && joinedCommunityIds.has(post.communityId.toLowerCase())) {
                return true;
            }
            if (post.communityName && joinedCommunityNames.has(post.communityName.toLowerCase())) {
                return true;
            }
            return false;
        });

        // Deduplicate
        const seenIds = new Set<string>();
        const merged: Post[] = [];

        for (const p of realCommunityPosts) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                merged.push(p);
            }
        }

        for (const p of matchingMockPosts) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                merged.push(p);
            }
        }

        // 3. Filter by domain if selected (only posts from joined communities in that domain)
        let filtered = merged;
        if (selectedDomain !== 'ALL') {
            const targetDomainLower = selectedDomain.toLowerCase();
            filtered = filtered.filter(p => {
                const commId = (p.communityId || p.channelId || '').toLowerCase();
                const commName = (p.communityName || '').toLowerCase();
                const matched = joinedCommunities.find(c =>
                    (commId && c.id.toLowerCase() === commId) ||
                    (commName && c.community.name.toLowerCase() === commName)
                );
                const postDomain = matched?.community?.category?.trim() || p.domain?.trim() || p.category?.trim();
                return Boolean(postDomain && postDomain.toLowerCase() === targetDomainLower);
            });
        }

        // 4. Filter by individual community if selected
        if (selectedCommunityFilter !== 'ALL') {
            const targetLower = selectedCommunityFilter.toLowerCase();
            const targetRecord = joinedCommunities.find(c => c.id.toLowerCase() === targetLower);
            const targetName = targetRecord?.community?.name?.toLowerCase();
            filtered = filtered.filter(p => {
                const commId = (p.communityId || p.channelId || '').toLowerCase();
                const commName = (p.communityName || '').toLowerCase();
                return commId === targetLower || (targetName && commName === targetName);
            });
        }

        // Sort posts
        filtered.sort((a, b) => {
            if (sortMode === 'popular') {
                const popA = (a.stats?.likes || 0) + (a.stats?.comments || 0);
                const popB = (b.stats?.likes || 0) + (b.stats?.comments || 0);
                return popB - popA;
            }
            // default latest
            const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return timeB - timeA;
        });

        return filtered;
    }, [joinedCommunities, rawFirestorePosts, joinedCommunityIds, joinedCommunityNames, selectedDomain, selectedCommunityFilter, sortMode]);

    // Handle like reaction
    const handleLike = async (post: Post, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser?.uid) return;

        const isCurrentlyLiked = likedPostIds.has(post.id);
        setLikedPostIds(prev => {
            const next = new Set(prev);
            if (isCurrentlyLiked) next.delete(post.id);
            else next.add(post.id);
            return next;
        });

        setLikeOffsets(prev => ({
            ...prev,
            [post.id]: (prev[post.id] || 0) + (isCurrentlyLiked ? -1 : 1)
        }));

        try {
            await toggleLikePost(post.id, currentUser.uid);
        } catch (err) {
            console.warn('[LIKE_POST_WARN]', err);
        }
    };

    // Handle share
    const handleShare = async (post: Post, e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/#/communities/${post.communityId || ''}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: post.title || post.aiSummary || post.communityName || 'Invox Community Post',
                    text: post.content,
                    url,
                });
            } catch (err) {}
        } else {
            try {
                await navigator.clipboard.writeText(`${post.title ? post.title + '\n\n' : ''}${post.content}\n\nVia Invox Collective: ${url}`);
                setCopiedPostId(post.id);
                setTimeout(() => setCopiedPostId(null), 2000);
            } catch (err) {}
        }
    };

    const formatTimestamp = (date: any) => {
        if (!date) return 'Recently';
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-6 font-mono">
            {/* Global Success Banner */}
            {successBanner && (
                <div className="p-3.5 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2">
                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold uppercase tracking-wider">{successBanner}</span>
                    </div>
                    <button
                        onClick={() => setSuccessBanner(null)}
                        className="text-emerald-400 hover:text-white ml-2"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div className="space-y-1">
                    <h1 className="text-xl font-bold uppercase tracking-wide text-white">COMMUNITY FEED</h1>
                    <p className="text-zinc-400 text-xs">Public conversations from your collectives.</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Create Post Button */}
                    <button
                        onClick={handleOpenCreatePost}
                        disabled={joinedCommunities.length === 0}
                        className="px-4 py-2 font-mono text-xs font-bold uppercase bg-white text-black hover:bg-zinc-200 transition-colors border border-white flex items-center gap-1.5 disabled:opacity-40 disabled:hover:bg-white"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>CREATE POST</span>
                    </button>
                </div>
            </div>

            {/* Feed Filters: Standardized Domain Filter Dropdown & Community Selection */}
            <div className="space-y-3">
                {/* 1. Standardized Domain Filter Dropdown */}
                <DomainFilter
                    domains={dynamicDomainFilterOptions}
                    selectedDomains={selectedDomain === 'ALL' ? [] : [selectedDomain]}
                    onSelectionChange={handleDomainChange}
                    singleSelect={true}
                    closeOnSelect={true}
                    className="mb-0"
                />

                {/* 2. Community Dropdown & Sorting Controls Row */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Community Selection Dropdown */}
                    <div className="relative flex-1 sm:max-w-md" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(prev => !prev)}
                            className={`w-full flex items-center justify-between gap-2.5 p-2.5 bg-black border transition-colors font-mono text-xs cursor-pointer group ${
                                isDropdownOpen
                                    ? 'border-zinc-500 text-white'
                                    : 'border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white'
                            }`}
                            aria-expanded={isDropdownOpen}
                            aria-haspopup="listbox"
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase flex-shrink-0">
                                    // COMMUNITY:
                                </span>
                                <span className="font-bold text-white uppercase tracking-wider truncate group-hover:text-emerald-400 transition-colors">
                                    {dropdownButtonLabel}
                                </span>
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                        </button>

                        {/* Dropdown Menu Popup */}
                        {isDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1.5 w-full bg-[#0c0c0e] border border-zinc-700 shadow-2xl z-40 overflow-hidden">
                                {/* Search in Dropdown */}
                                <div className="p-2 border-b border-zinc-800 bg-black">
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                        <input
                                            type="search"
                                            placeholder="SEARCH_JOINED_COLLECTIVES..."
                                            value={dropdownSearch}
                                            onChange={(e) => setDropdownSearch(e.target.value)}
                                            autoFocus
                                            className="w-full bg-[#141418] border border-zinc-800 p-1.5 pl-8 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Options List */}
                                <div className="max-h-64 overflow-y-auto no-scrollbar divide-y divide-zinc-900 p-1">
                                    {/* All Joined Communities option */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCommunityFilter('ALL');
                                            setIsDropdownOpen(false);
                                            setDropdownSearch('');
                                        }}
                                        className={`w-full flex items-center justify-between p-2.5 text-left transition-colors cursor-pointer ${
                                            selectedCommunityFilter === 'ALL'
                                                ? 'bg-zinc-900 text-white border-l-2 border-emerald-400 font-bold'
                                                : 'hover:bg-zinc-900/60 text-zinc-300 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                                <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                                            </div>
                                            <div className="truncate">
                                                <p className="font-mono text-xs uppercase truncate">
                                                    All Joined Communities
                                                </p>
                                                <p className="text-[10px] font-mono text-zinc-500">
                                                    {selectedDomain === 'ALL'
                                                        ? `All ${joinedCommunities.length} joined collectives`
                                                        : `All ${communitiesInActiveDomain.length} ${selectedDomain} collectives`}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedCommunityFilter === 'ALL' && (
                                            <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />
                                        )}
                                    </button>

                                    {/* Individual Communities */}
                                    {dropdownFilteredCommunities.length > 0 ? (
                                        dropdownFilteredCommunities.map((item) => {
                                            const isSelected = selectedCommunityFilter.toLowerCase() === item.id.toLowerCase();
                                            const c = item.community;
                                            const domainLabel = c.category || 'General';

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCommunityFilter(item.id);
                                                        setIsDropdownOpen(false);
                                                        setDropdownSearch('');
                                                    }}
                                                    className={`w-full flex items-center justify-between p-2.5 text-left transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-zinc-900 text-white border-l-2 border-emerald-400 font-bold'
                                                            : 'hover:bg-zinc-900/60 text-zinc-300 hover:text-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        {c.avatarUrl ? (
                                                            <img
                                                                src={c.avatarUrl}
                                                                alt={c.name}
                                                                onError={handleImageError}
                                                                className="w-6 h-6 object-cover border border-zinc-800 flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                                                <span className="font-mono text-[10px] text-zinc-400 font-bold">
                                                                    {c.name.substring(0, 2).toUpperCase()}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="truncate">
                                                            <p className="font-mono text-xs uppercase truncate">
                                                                {c.name} <span className="text-zinc-500 font-normal">— {domainLabel}</span>
                                                            </p>
                                                            {c.handle && (
                                                                <p className="text-[10px] font-mono text-zinc-500 truncate">
                                                                    @{c.handle.replace(/^@/, '')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />
                                                    )}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="p-4 text-center text-zinc-500 font-mono text-xs">
                                            // NO_MATCHING_COLLECTIVES
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sorting Controls */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 sm:hidden">
                            // SORT:
                        </span>
                        <div className="inline-flex bg-black p-0.5 border border-zinc-800 space-x-1">
                            <button
                                onClick={() => setSortMode('latest')}
                                className={`px-2.5 py-1 font-mono text-xs uppercase font-bold transition-colors cursor-pointer ${
                                    sortMode === 'latest' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                LATEST
                            </button>
                            <button
                                onClick={() => setSortMode('popular')}
                                className={`px-2.5 py-1 font-mono text-xs uppercase font-bold transition-colors cursor-pointer ${
                                    sortMode === 'popular' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                POPULAR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* Aggregated Feed Stream */}
            {membershipsLoading || loadingPosts ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-[#0c0c0e] p-5 border border-zinc-800 animate-pulse space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-zinc-800"></div>
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-3.5 bg-zinc-800 w-1/3"></div>
                                    <div className="h-2.5 bg-zinc-850 w-1/4"></div>
                                </div>
                            </div>
                            <div className="h-4 bg-zinc-800 w-3/4"></div>
                            <div className="h-16 bg-zinc-850"></div>
                        </div>
                    ))}
                </div>
            ) : joinedCommunities.length === 0 ? (
                /* Empty state: No memberships */
                <div className="text-center py-16 px-4 border border-dashed border-zinc-800 bg-[#09090b] space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                        <p className="text-sm font-bold text-white uppercase tracking-wide">
                            // NO_COMMUNITY_MEMBERSHIPS_DETECTED
                        </p>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Join technical collectives in the All Communities discovery view to populate your aggregated public feed and participate in private inboxes.
                        </p>
                    </div>
                    {onExploreAll && (
                        <button
                            onClick={onExploreAll}
                            className="mt-3 px-5 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                        >
                            EXPLORE ALL COMMUNITIES
                        </button>
                    )}
                </div>
            ) : aggregatedPosts.length === 0 ? (
                /* Empty state: No posts in this filter */
                <div className="text-center py-16 px-4 border border-dashed border-zinc-800 bg-[#09090b] space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                        <p className="text-sm font-bold text-white uppercase tracking-wide">
                            // NO_PUBLIC_POSTS_IN_FEED
                        </p>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            {selectedCommunityFilter !== 'ALL'
                                ? `No public discussions published in ${selectedCommunityRecord?.community.name || 'this collective'} yet.`
                                : selectedDomain !== 'ALL'
                                ? `No public discussions published across your joined ${selectedDomain} collectives yet.`
                                : 'No public discussions available across your joined collectives. Dispatch a public communication to start.'}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                        {(selectedDomain !== 'ALL' || selectedCommunityFilter !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setSelectedDomain('ALL');
                                    setSelectedCommunityFilter('ALL');
                                }}
                                className="px-4 py-2 font-mono text-xs uppercase font-bold text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 bg-black transition-colors"
                            >
                                RESET FILTERS
                            </button>
                        )}
                        <button
                            onClick={handleOpenCreatePost}
                            className="px-5 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                        >
                            CREATE FIRST POST
                        </button>
                    </div>
                </div>
            ) : (
                /* Aggregated Posts List */
                <div className="space-y-4">
                    {aggregatedPosts.map((post) => (
                        <CommunityFeedCard
                            key={post.id}
                            post={post}
                            initialLiked={likedPostIds.has(post.id)}
                            onPostUpdated={(updated) => {
                                setRawFirestorePosts(prev => prev.map(p => p.id === updated.id ? updated : p));
                            }}
                            onOpenCommunity={onOpenCommunity}
                        />
                    ))}
                </div>
            )}

            {/* Private Interaction Modal */}
            <PrivateCommunityInteractionModal
                isOpen={Boolean(selectedInboxRecord)}
                onClose={() => setSelectedInboxRecord(null)}
                communityRecord={selectedInboxRecord}
            />
        </div>
    );
};

export default MyCommunitiesInteractionHub;
