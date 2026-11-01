import React, { useState, useMemo, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    useUserJoinedCommunities, 
    leaveCommunity, 
    syncCommunityMemberCount, 
    getAdjustedMemberCount,
    JoinedCommunityRecord 
} from '../../services/communityService';
import {
    UsersIcon,
    MagnifyingGlassIcon,
    ShieldCheckIcon,
    StarIcon,
    ArrowLeftIcon,
    CloseIcon,
    TrashIcon,
    FireIcon,
    CodeBracketIcon,
    PencilSquareIcon,
    BriefcaseIcon,
    SparklesIcon,
    ChatIcon,
    CheckCircleIcon,
    ClockIcon,
    ArrowUpRightIcon,
    BookmarkIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface MyCommunitiesDirectoryProps {
    onExploreAll?: () => void;
    onOpenCommunity?: (communityId: string) => void;
}

type SortOption = 'recently-joined' | 'recently-active' | 'alphabetical' | 'most-members';

const DOMAIN_ICONS: Record<string, React.FC<{ className?: string }>> = {
    'Startup': FireIcon,
    'Coding': CodeBracketIcon,
    'Design': PencilSquareIcon,
    'Business': BriefcaseIcon,
    'Artificial Intelligence': SparklesIcon,
    'Idea Exchange': ChatIcon,
};

const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
};

const formatRelativeTime = (date?: Date | null) => {
    if (!date) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 5) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const MyCommunitiesDirectory: React.FC<MyCommunitiesDirectoryProps> = ({
    onExploreAll,
    onOpenCommunity
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const { joinedCommunities, loading, error, count, roleSummary } = useUserJoinedCommunities(currentUser);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('recently-joined');

    // Leave confirmation modal state
    const [communityToLeave, setCommunityToLeave] = useState<JoinedCommunityRecord | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveFeedback, setLeaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Auto-dismiss feedback message after 5 seconds
    useEffect(() => {
        if (!leaveFeedback) return;
        const timer = setTimeout(() => setLeaveFeedback(null), 5000);
        return () => clearTimeout(timer);
    }, [leaveFeedback]);

    // Compute distinct domain counts from user's joined communities
    const domainCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of joinedCommunities) {
            const cat = item.community.category || 'General';
            counts[cat] = (counts[cat] || 0) + 1;
        }
        return counts;
    }, [joinedCommunities]);

    const availableDomains = useMemo(() => {
        const standard = ['Startup', 'Coding', 'Design', 'Business', 'Artificial Intelligence', 'Idea Exchange'];
        const existing = Object.keys(domainCounts);
        const combined = Array.from(new Set([...standard, ...existing]));
        return combined;
    }, [domainCounts]);

    // Filter and sort joined communities
    const filteredCommunities = useMemo(() => {
        let result = [...joinedCommunities];

        // 1. Search term
        const query = searchTerm.trim().toLowerCase();
        if (query) {
            const cleanQuery = query.startsWith('@') ? query.slice(1).trim() : query;
            result = result.filter(item => {
                const c = item.community;
                const name = (c.name || '').toLowerCase();
                const handle = (c.handle || '').toLowerCase().replace(/^@/, '');
                const category = (c.category || '').toLowerCase();
                const desc = (c.description || '').toLowerCase();
                const topics = Array.isArray(c.topics) ? c.topics.map(t => t.toLowerCase()) : [];

                return (
                    name.includes(cleanQuery) ||
                    handle.includes(cleanQuery) ||
                    category.includes(cleanQuery) ||
                    desc.includes(cleanQuery) ||
                    topics.some(t => t.includes(cleanQuery))
                );
            });
        }

        // 2. Domain category filter
        if (selectedDomain !== 'ALL') {
            result = result.filter(item => item.community.category === selectedDomain);
        }

        // 3. Sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'recently-joined': {
                    const timeA = a.joinedAt ? a.joinedAt.getTime() : 0;
                    const timeB = b.joinedAt ? b.joinedAt.getTime() : 0;
                    return timeB - timeA;
                }
                case 'recently-active': {
                    const timeA = a.updatedAt ? a.updatedAt.getTime() : (a.joinedAt ? a.joinedAt.getTime() : 0);
                    const timeB = b.updatedAt ? b.updatedAt.getTime() : (b.joinedAt ? b.joinedAt.getTime() : 0);
                    return timeB - timeA;
                }
                case 'alphabetical': {
                    const nameA = (a.community.name || '').toLowerCase();
                    const nameB = (b.community.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                }
                case 'most-members': {
                    const membersA = a.community.members || (a.community as any).memberCount || 0;
                    const membersB = b.community.members || (b.community as any).memberCount || 0;
                    return membersB - membersA;
                }
                default:
                    return 0;
            }
        });

        return result;
    }, [joinedCommunities, searchTerm, selectedDomain, sortBy]);

    const handleOpen = (communityId: string) => {
        if (onOpenCommunity) {
            onOpenCommunity(communityId);
        } else {
            navigate(`/communities/${communityId}`);
        }
    };

    const handleInitiateLeave = (item: JoinedCommunityRecord, e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.isOwner) {
            setLeaveFeedback({
                type: 'error',
                message: 'Community Owners cannot leave their collective. Manage ownership transfer via Community Manager in My Space.'
            });
            return;
        }
        setCommunityToLeave(item);
    };

    const handleConfirmLeave = async () => {
        if (!communityToLeave || !currentUser?.uid) return;

        setIsLeaving(true);
        try {
            const success = await leaveCommunity(communityToLeave.id, currentUser.uid);
            if (success) {
                await syncCommunityMemberCount(communityToLeave.id);
                setLeaveFeedback({
                    type: 'success',
                    message: `// MEMBERSHIP_TERMINATED: Successfully departed "${communityToLeave.community.name}".`
                });
                setCommunityToLeave(null);
            } else {
                setLeaveFeedback({
                    type: 'error',
                    message: 'Failed to leave community. Please try again or check connection.'
                });
            }
        } catch (err: any) {
            setLeaveFeedback({
                type: 'error',
                message: err.message || 'An unexpected error occurred while departing the collective.'
            });
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <div className="space-y-6 font-mono">
            {/* Notification Toast */}
            {leaveFeedback && (
                <div className={`p-3 border font-mono text-xs flex items-center justify-between ${
                    leaveFeedback.type === 'success' 
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}>
                    <div className="flex items-center gap-2">
                        {leaveFeedback.type === 'success' ? (
                            <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                            <CloseIcon className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                        <span>{leaveFeedback.message}</span>
                    </div>
                    <button onClick={() => setLeaveFeedback(null)} className="p-1 hover:text-white">
                        <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onExploreAll}
                            className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors mr-1"
                            title="Back to All Communities"
                        >
                            <ArrowLeftIcon className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">// PERSONAL_DIRECTORY</span>
                    </div>
                    <h1 className="text-xl font-bold uppercase tracking-wide text-white">MY COMMUNITIES</h1>
                    <p className="text-zinc-400 text-xs">Your collectives. Your connections. Your space.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                    {/* Role summary counters */}
                    <div className="bg-[#0c0c0e] border border-zinc-800 px-3 py-1.5 flex items-center gap-2">
                        <BookmarkIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-400 uppercase text-[11px]">JOINED:</span>
                        <span className="font-bold text-white">{count}</span>
                    </div>

                    <div className="bg-[#0c0c0e] border border-emerald-500/30 px-3 py-1.5 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-400"></span>
                        <span className="text-emerald-400 uppercase text-[11px]">OWNER:</span>
                        <span className="font-bold text-white">{roleSummary.owners}</span>
                    </div>

                    {roleSummary.admins > 0 && (
                        <div className="bg-[#0c0c0e] border border-cyan-500/30 px-3 py-1.5 flex items-center gap-2">
                            <span className="w-2 h-2 bg-cyan-400"></span>
                            <span className="text-cyan-400 uppercase text-[11px]">ADMIN:</span>
                            <span className="font-bold text-white">{roleSummary.admins}</span>
                        </div>
                    )}

                    <div className="bg-[#0c0c0e] border border-zinc-800 px-3 py-1.5 flex items-center gap-2">
                        <span className="text-zinc-500 uppercase text-[11px]">MEMBER:</span>
                        <span className="font-bold text-zinc-300">{roleSummary.members}</span>
                    </div>

                    {onExploreAll && (
                        <button 
                            onClick={onExploreAll}
                            className="px-3 py-1.5 font-mono text-xs font-bold uppercase bg-white text-black hover:bg-zinc-200 transition-colors border border-white"
                        >
                            EXPLORE ALL
                        </button>
                    )}
                </div>
            </div>

            {/* Search, Domain Filter & Sorting Controls */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="SEARCH_MY_COMMUNITIES (NAME, HANDLE, TOPIC)..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 pr-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                aria-label="Clear search"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Sorting dropdown */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-zinc-500 text-[11px] uppercase whitespace-nowrap">// SORT:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-[#0c0c0e] border border-zinc-800 p-2 font-mono text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 cursor-pointer"
                        >
                            <option value="recently-joined">Recently Joined</option>
                            <option value="recently-active">Recently Active</option>
                            <option value="alphabetical">Alphabetical (A-Z)</option>
                            <option value="most-members">Most Members</option>
                        </select>
                    </div>
                </div>

                {/* Domain Category Filter Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                        onClick={() => setSelectedDomain('ALL')}
                        className={`px-3 py-1 font-mono text-xs uppercase font-bold transition-colors border ${
                            selectedDomain === 'ALL'
                                ? 'bg-white text-black border-white'
                                : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        ALL DOMAINS ({count})
                    </button>
                    {availableDomains.map((domain) => {
                        const domainCount = domainCounts[domain] || 0;
                        const Icon = DOMAIN_ICONS[domain];
                        const isSelected = selectedDomain === domain;
                        return (
                            <button
                                key={domain}
                                onClick={() => setSelectedDomain(domain)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs uppercase font-bold transition-colors border ${
                                    isSelected
                                        ? 'bg-zinc-800 text-white border-zinc-600'
                                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                }`}
                            >
                                {Icon && <Icon className="w-3.5 h-3.5 text-zinc-500" />}
                                <span>{domain}</span>
                                <span className={`text-[10px] ml-1 ${isSelected ? 'text-white' : 'text-zinc-600'}`}>
                                    ({domainCount})
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Community Listing or Empty States */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="bg-[#0c0c0e] p-5 border border-zinc-800 animate-pulse space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-zinc-800"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-zinc-800 w-1/2"></div>
                                    <div className="h-3 bg-zinc-850 w-1/3"></div>
                                </div>
                            </div>
                            <div className="h-10 bg-zinc-850"></div>
                            <div className="h-8 bg-zinc-800 w-full"></div>
                        </div>
                    ))}
                </div>
            ) : filteredCommunities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCommunities.map((item) => {
                        const { community, role, status, isOwner, isAdmin, joinedAt, updatedAt } = item;
                        const displayedMembers = getAdjustedMemberCount(community.members, true, community);
                        const handle = community.handle 
                            ? `@${community.handle.replace(/^@/, '')}` 
                            : `@${(community.name || '').toLowerCase().replace(/\s+/g, '')}`;

                        return (
                            <div
                                key={item.id}
                                className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-5 flex flex-col justify-between transition-all group"
                            >
                                <div className="space-y-3">
                                    {/* Top row: Avatar, Info, and Role Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {community.avatarUrl ? (
                                                <img
                                                    src={community.avatarUrl}
                                                    alt={community.name}
                                                    onError={handleImageError}
                                                    className="w-12 h-12 object-cover border border-zinc-800 bg-zinc-950 flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 bg-zinc-950 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                                    <UsersIcon className="w-6 h-6 text-zinc-500" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h3 className="font-bold text-white text-sm truncate">
                                                        {community.name}
                                                    </h3>
                                                    {community.isVerified && (
                                                        <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-zinc-500 font-mono truncate">{handle}</p>
                                                <span className="inline-block mt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5">
                                                    {community.category || 'General'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Role badge */}
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            {isOwner ? (
                                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                                                    OWNER
                                                </span>
                                            ) : isAdmin ? (
                                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-cyan-400"></span>
                                                    ADMIN
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-700">
                                                    MEMBER
                                                </span>
                                            )}

                                            {status === 'pending' && (
                                                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-950/40 text-amber-400 border border-amber-500/30">
                                                    PENDING
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                                        {community.description || 'Active technical collective on INVOX platform.'}
                                    </p>

                                    {/* Metrics & Activity Overview */}
                                    <div className="border-t border-zinc-850 pt-2.5 grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Members</p>
                                            <p className="font-bold text-white mt-0.5">{formatNumber(displayedMembers)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Status</p>
                                            <p className="font-bold text-emerald-400 mt-0.5 uppercase text-[11px]">
                                                {status === 'active' ? 'ACTIVE' : 'PENDING'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Activity</p>
                                            <p className="font-bold text-zinc-300 mt-0.5 text-[11px] truncate" title={updatedAt ? formatRelativeTime(updatedAt) : formatRelativeTime(joinedAt)}>
                                                {updatedAt ? formatRelativeTime(updatedAt) : formatRelativeTime(joinedAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Row */}
                                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpen(community.id)}
                                        className="flex-1 font-mono text-xs font-bold uppercase py-2 transition-colors border bg-white text-black border-white hover:bg-zinc-200 text-center flex items-center justify-center gap-1.5"
                                    >
                                        <span>OPEN COMMUNITY</span>
                                        <ArrowUpRightIcon className="w-3.5 h-3.5" />
                                    </button>

                                    {isOwner ? (
                                        <button
                                            onClick={() => navigate('/myspace')}
                                            title="Manage in Community Manager"
                                            className="px-3 py-2 font-mono text-xs font-bold uppercase border border-zinc-800 bg-zinc-900 hover:border-zinc-600 text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
                                        >
                                            <span>MANAGE</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => handleInitiateLeave(item, e)}
                                            title="Leave this community"
                                            className="px-3 py-2 font-mono text-xs font-bold uppercase border border-zinc-800 bg-zinc-950 hover:border-rose-800/80 hover:bg-rose-950/30 text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                            <span>LEAVE</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Empty States */
                <div className="text-center py-16 px-4 border border-dashed border-zinc-800 bg-[#09090b] space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <UsersIcon className="w-6 h-6" />
                    </div>

                    {searchTerm ? (
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-white uppercase tracking-wide">
                                // NO_COMMUNITIES_MATCHING_SEARCH
                            </p>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                No joined collectives matched &quot;{searchTerm}&quot;. Check your query or clear the filter.
                            </p>
                            <button
                                onClick={() => setSearchTerm('')}
                                className="mt-3 px-4 py-2 font-mono text-xs font-bold uppercase bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
                            >
                                CLEAR SEARCH DIRECTIVE
                            </button>
                        </div>
                    ) : selectedDomain !== 'ALL' ? (
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-white uppercase tracking-wide">
                                // NO_COLLECTIVES_IN_DOMAIN
                            </p>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                You have not joined any collectives in &quot;{selectedDomain}&quot;.
                            </p>
                            <button
                                onClick={() => setSelectedDomain('ALL')}
                                className="mt-3 px-4 py-2 font-mono text-xs font-bold uppercase bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
                            >
                                SHOW ALL DOMAINS
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-white uppercase tracking-wide">
                                // NO_COMMUNITY_MEMBERSHIPS_DETECTED
                            </p>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                You have not joined any collectives yet. Discover high-signal communities to collaborate, build, and share.
                            </p>
                            {onExploreAll && (
                                <button
                                    onClick={onExploreAll}
                                    className="mt-3 px-5 py-2 font-mono text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
                                >
                                    EXPLORE COMMUNITIES
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Leave Community Confirmation Modal */}
            {communityToLeave && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#0c0c0e] border border-zinc-800 max-w-md w-full p-6 space-y-5 font-mono shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                                    // MEMBERSHIP_OPERATION
                                </span>
                                <h3 className="text-sm font-bold text-white uppercase">
                                    CONFIRM COMMUNITY DEPARTURE
                                </h3>
                            </div>
                            <button
                                onClick={() => setCommunityToLeave(null)}
                                disabled={isLeaving}
                                className="p-1 text-zinc-500 hover:text-white transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Community preview in modal */}
                        <div className="p-3 bg-zinc-950 border border-zinc-850 flex items-center gap-3">
                            {communityToLeave.community.avatarUrl ? (
                                <img
                                    src={communityToLeave.community.avatarUrl}
                                    alt={communityToLeave.community.name}
                                    onError={handleImageError}
                                    className="w-10 h-10 object-cover border border-zinc-800"
                                />
                            ) : (
                                <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                    <UsersIcon className="w-5 h-5 text-zinc-500" />
                                </div>
                            )}
                            <div>
                                <p className="font-bold text-white text-xs">{communityToLeave.community.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">
                                    ROLE: {communityToLeave.role.toUpperCase()}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
                            <p>
                                Are you sure you want to depart from <strong className="text-white">{communityToLeave.community.name}</strong>?
                            </p>
                            <p className="text-zinc-500 text-[11px]">
                                This action will remove your membership record. You will lose access to internal conclaves, discussions, and member broadcasts.
                            </p>
                            {communityToLeave.isAdmin && (
                                <p className="text-amber-400 text-[11px] bg-amber-950/20 p-2 border border-amber-500/20">
                                    WARNING: You currently hold Administrator status in this collective. Departing will relinquish administrative rights.
                                </p>
                            )}
                        </div>

                        <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setCommunityToLeave(null)}
                                disabled={isLeaving}
                                className="px-4 py-2 font-mono text-xs uppercase font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-transparent transition-colors"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleConfirmLeave}
                                disabled={isLeaving}
                                className="px-4 py-2 font-mono text-xs uppercase font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 transition-colors flex items-center gap-1.5"
                            >
                                {isLeaving ? (
                                    <>
                                        <span className="w-3 h-3 border-2 border-white border-t-transparent animate-spin inline-block"></span>
                                        <span>DEPARTING...</span>
                                    </>
                                ) : (
                                    <span>CONFIRM LEAVE</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyCommunitiesDirectory;
