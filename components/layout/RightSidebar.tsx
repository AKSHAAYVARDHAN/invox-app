import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { MyCommunity, Event, HubConversation, InvoxUser } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useFilters } from '../../contexts/AIAssistantContext';
import { subscribeFollowedProfiles } from '../../services/connectionService';
import GoForItFilterModal from '../spotlight/GoForItFilterModal';
import { 
    MagnifyingGlassIcon, 
    ArrowLeftIcon, 
    PencilIcon, 
    BookmarkIcon,
    CodeBracketIcon,
    ShieldCheckIcon,
    PresentationChartBarIcon,
    CubeIcon,
    ProfileIcon,
    StarIcon,
    BriefcaseIcon,
    BuildingOffice2Icon,
    FilterIcon,
    ChevronDownIcon,
    MapPinIcon,
    CheckCircleIcon,
    SparklesIcon,
    PencilSwooshIcon,
    PencilSquareIcon,
    UsersIcon,
    FireIcon,
    ChatIcon,
    EllipsisVerticalIcon,
    GlobeAltIcon,
    SoundWaveIcon,
    ChatBubbleIcon,
    BellIcon,
    CheckIcon,
    ClipboardListIcon,
    ExploreIcon,
    SpotlightIcon,
    ChatBubbleBottomCenterTextIcon,
    ArrowUpTrayIcon,
    PlusIcon,
    CloseIcon,
    PlayIcon,
    WrenchScrewdriverIcon,
    CheckBadgeIcon,
    TrophyIcon,
    ChevronRightIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import MyCommunityCardSkeleton from '../communities/MyCommunityCardSkeleton';
import DomainFilter from '../ui/DomainFilter';
import { useCollabDashboardData } from '../spotlight/useCollabDashboardData';
import SettingsSidebar from '../settings/SettingsSidebar';
import { useCommunityMemberships, useUserJoinedCommunities } from '../../services/communityService';
import type { JoinedCommunityRecord } from '../../services/communityService';
import { mockCommunities } from '../../pages/Communities';
import { subscribeUpcomingConclaveEvents } from '../../services/conclaveService';
import type { ConclaveEvent } from '../../services/conclaveTypes';
import {
    TRENDZ_DOMAINS,
    getTrendzDomainBySlug,
    normalizeTrendzDomainSlug,
} from '../../utils/trendzDomains';
import { fetchMomentumTrends, type TrendViewModel } from '../../services/trendzService';
import { useTrendzEngagement } from '../../contexts/TrendzEngagementContext';

const trendingTopics = [
    { name: '#QuantumLeap', posts: '12.1K posts' },
    { name: '#AIforGood', posts: '8,456 posts' },
    { name: '#Web3', posts: '5,123 posts' },
    { name: '#SustainableTech', posts: '3,789 posts' },
];

const suggestedChannels = [
    { 
        name: 'Future Stack', 
        followers: '1.2M followers', 
        avatarUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=200&h=200&auto=format&fit=crop', 
        domain: '# Development', 
        isVerified: true 
    },
    { 
        name: 'Interface Lab', 
        followers: '850k followers', 
        avatarUrl: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=200&h=200&auto=format&fit=crop', 
        domain: '# Design', 
        isVerified: false 
    },
    { 
        name: 'Cosmos', 
        followers: '435k followers', 
        avatarUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=200&h=200&auto=format&fit=crop', 
        domain: '# Space', 
        isVerified: true 
    },
];

const creatorsToWatch = [
    {
        name: 'Jake Gyllenhaal',
        domain: 'AI · Machine Learning',
        oneLine: 'Open-source model for real-time anomaly detection',
        avatarUrl: 'https://picsum.photos/seed/jake/200'
    },
    {
        name: 'Sophia Martinez',
        domain: 'ClimateTech · Data Science',
        oneLine: 'Predictive platform for climate risk assessment',
        avatarUrl: 'https://picsum.photos/seed/sophia/200'
    },
    {
        name: 'Daniel Harper',
        domain: 'Cybersecurity · Privacy',
        oneLine: 'Zero-trust authentication framework for distributed systems',
        avatarUrl: 'https://picsum.photos/seed/daniel/200'
    }
];

const trackedChannels = [
    { id: '1', name: 'Tech Innovations', avatarUrl: 'https://picsum.photos/seed/tech/200', category: 'Technology', isLive: true },
    { id: '2', name: 'Startup Journey', avatarUrl: 'https://picsum.photos/seed/startup/200', category: 'Business', isLive: false },
    { id: '3', name: 'Design Minds', avatarUrl: 'https://picsum.photos/seed/design/200', category: 'Design', isLive: false },
    { id: '4', name: 'CodeStream', avatarUrl: 'https://picsum.photos/seed/coders/200', category: 'Development', isLive: true },
    { id: '5', name: 'Market Movers', avatarUrl: 'https://picsum.photos/seed/market/200', category: 'Finance', isLive: false },
];

const mockMyCommunities: MyCommunity[] = [
    { id: 'mc1', name: 'Startup Grind', latestMessage: 'Just hit 25k members!', timestamp: '2h ago', hasNotification: true, avatarUrl: 'https://picsum.photos/seed/startup-grind/200', category: 'Startup' },
    { id: 'mc2', name: 'UI/UX Guild', latestMessage: 'Anyone have thoughts on the new Figma update?', timestamp: '5h ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200', category: 'Design' },
    { id: 'mc3', name: 'Pythonic Geeks', latestMessage: 'New tutorial on async with FastAPI is up!', timestamp: '1d ago', hasNotification: true, avatarUrl: 'https://picsum.photos/seed/python-geeks/200', category: 'Coding' },
    { id: 'mc4', name: 'CodeFrel Start', latestMessage: 'Welcome to all the new members! Feel free to introduce yourselves.', timestamp: '3d ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/codefrel-start/200', category: 'Coding' },
    { id: 'mc5', name: 'AI ClubTech', latestMessage: 'Join our weekly discussion on LLMs.', timestamp: '4d ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/ai-clubtech/200', category: 'Artificial Intelligence' },
    { id: 'mc6', name: 'JS Junkies', latestMessage: 'React 19 is out! What are your thoughts?', timestamp: '4d ago', hasNotification: true, avatarUrl: 'https://picsum.photos/seed/js-junkies/200', category: 'Coding' },
];

const communityPageDomains = [
    { name: 'Startup', icon: FireIcon },
    { name: 'Coding', icon: CodeBracketIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Business', icon: BriefcaseIcon },
    { name: 'Artificial Intelligence', icon: SparklesIcon },
    { name: 'Idea Exchange', icon: ChatIcon },
];

interface RightSidebarProps {
    variant?: string;
    activityFilter: string | null;
    setActivityFilter: (filter: string | null) => void;
    followedDomainsFilter: string | null;
    setFollowedDomainsFilter: (filter: string | null) => void;
    spotlightBrowseState: string | null;
    setSpotlightBrowseState: (state: string | null) => void;
    showPinnedHighlights: boolean;
    setShowPinnedHighlights: (show: boolean) => void;
    showPinnedProfiles?: boolean;
    setShowPinnedProfiles?: (show: boolean) => void;
    goforitFilters: { company: string; skills: string; location: string; opportunityType: string; category: string; experienceLevel: string; searchTerm: string; };
    setGoforitFilters: (filters: { company: string; skills: string; location: string; opportunityType: string; category: string; experienceLevel: string; searchTerm: string; }) => void;
    setIsFilterModalOpen: (isOpen: boolean) => void;
    communityFilters: { searchTerm: string; domains: string[]; };
    setCommunityFilters: (filters: React.SetStateAction<{ searchTerm: string; domains: string[]; }>) => void;
    communityView: string;
    setCommunityView: (view: string) => void;
    hubView?: string;
    setHubView?: (view: string) => void;
    hubRightSidebarView?: string;
    setHubRightSidebarView?: (view: string) => void;
    hubConversations?: HubConversation[];
    selectedHubConversation?: HubConversation | null;
    setSelectedHubConversation?: (conversation: HubConversation | null) => void;
    setUploadTriggerTarget?: (target: string | null) => void;
    discoverSearchTerm?: string;
    setDiscoverSearchTerm?: (term: string) => void;
    trendzSearchQuery?: string;
    setTrendzSearchQuery?: (query: string) => void;
    collabManagementView?: 'incoming' | 'active' | 'my_applications' | 'inbox' | 'teams' | null;
    setCollabManagementView?: (view: 'incoming' | 'active' | 'my_applications' | 'inbox' | 'teams' | null) => void;
    spotlightIsBrowsing?: boolean;
    setSpotlightIsBrowsing?: (value: boolean) => void;
}

const DiscoverSidebar: React.FC<Pick<RightSidebarProps, 'activityFilter' | 'setActivityFilter' | 'discoverSearchTerm' | 'setDiscoverSearchTerm'>> = ({ 
    activityFilter, 
    setActivityFilter,
    discoverSearchTerm,
    setDiscoverSearchTerm
}) => {
    const [isActivityView, setIsActivityView] = useState(false);

    useEffect(() => {
        if (activityFilter) {
            setIsActivityView(true);
        }
    }, [activityFilter]);

    const handleBackFromActivity = () => {
        setIsActivityView(false);
        setActivityFilter(null);
    };

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5 overflow-y-auto no-scrollbar">
                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input
                        type="search"
                        placeholder="SEARCH_THREADS_QUERIES..."
                        value={discoverSearchTerm || ''}
                        onChange={(e) => setDiscoverSearchTerm?.(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                </div>

                {isActivityView ? (
                    <>
                        <div className="flex items-center justify-between px-4">
                            <button onClick={handleBackFromActivity} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                <ArrowLeftIcon className="w-4 h-4" />
                                <span>// BACK_TO_DISCOVER</span>
                            </button>
                        </div>
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// ACTIVITY_LOGS</h3>
                            <p className="text-xs text-zinc-400 font-mono mb-4">View commented threads, shared insights, and participated polls.</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActivityFilter('threads')}
                                    className={`w-full text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${activityFilter === 'threads' ? 'bg-[#18181d] text-white border-zinc-700 font-bold' : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'}`}
                                >
                                    &gt; THREADS
                                </button>
                                <button
                                    onClick={() => setActivityFilter('queries')}
                                    className={`w-full text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${activityFilter === 'queries' ? 'bg-[#18181d] text-white border-zinc-700 font-bold' : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'}`}
                                >
                                    &gt; QUERIES
                                </button>
                                <button
                                    onClick={() => setActivityFilter('polls')}
                                    className={`w-full text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${activityFilter === 'polls' ? 'bg-[#18181d] text-white border-zinc-700 font-bold' : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'}`}
                                >
                                    &gt; POLLS
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="px-4">
                            <button
                                onClick={() => setIsActivityView(true)}
                                className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <PencilIcon className="w-4 h-4 text-zinc-500" />
                                    <span>// ACTIVITY</span>
                                </div>
                                <span className="text-zinc-600">&gt;&gt;</span>
                            </button>
                        </div>

                        <div>
                            {/* Suggestions Card */}
                            <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// SUGGESTIONS</h3>
                                    <EllipsisVerticalIcon className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-white transition-colors" />
                                </div>

                                {/* User List */}
                                <div className="p-3.5 space-y-4">
                                    {suggestedChannels.map((channel, index) => (
                                        <div key={index} className="flex items-start gap-3 group cursor-pointer">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={channel.avatarUrl} 
                                                    onError={handleImageError} 
                                                    alt={channel.name} 
                                                    className="w-9 h-9 object-cover border border-zinc-800" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-mono font-bold text-white text-xs truncate group-hover:text-zinc-200">{channel.name}</p>
                                                    {channel.isVerified && <CheckBadgeIcon className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <p className="text-[11px] text-zinc-500 font-mono truncate">{channel.followers}</p>
                                                <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">{channel.domain}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer Action Button */}
                                <div className="p-3 border-t border-zinc-800 bg-black/40">
                                    <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
                                        VIEW_ALL
                                    </button>
                                </div>
                            </div>
                        </div>

                        <footer className="text-[11px] font-mono text-zinc-600 space-x-2 px-4 mt-auto">
                            <a href="#" className="hover:text-zinc-400">TERMS</a>
                            <span>/</span>
                            <a href="#" className="hover:text-zinc-400">PRIVACY</a>
                            <span>/</span>
                            <a href="#" className="hover:text-zinc-400">ABOUT</a>
                            <span className="block mt-1 text-[10px]">© 2025 INVOX SYSTEM</span>
                        </footer>
                    </>
                )}
            </div>
        </aside>
    );
};


const TrendzSidebar: React.FC<
    Pick<
        RightSidebarProps,
        'followedDomainsFilter' | 'setFollowedDomainsFilter' | 'trendzSearchQuery' | 'setTrendzSearchQuery'
    >
> = ({ followedDomainsFilter, setFollowedDomainsFilter, trendzSearchQuery = '', setTrendzSearchQuery }) => {
    const [isFollowedView, setIsFollowedView] = useState(false);
    const [momentumTrends, setMomentumTrends] = useState<TrendViewModel[]>([]);
    const [momentumLoading, setMomentumLoading] = useState(true);
    const [momentumError, setMomentumError] = useState<string | null>(null);
    const [reloadTick, setReloadTick] = useState(0);

    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const { currentUser } = useAuth();
    const { domainSelections, setDomainSelection } = useFilters();
    const {
        isAuthenticated,
        preferencesLoading,
        preferencesError,
        actionError,
        clearActionError,
        refreshEngagement,
        followedDomainSlugs,
        isDomainPending,
        followDomain,
        unfollowDomain,
        bookmarkRecords,
    } = useTrendzEngagement();

    const formatNumber = (num: number) => {
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
        return num;
    };

    useEffect(() => {
        let isActive = true;
        setMomentumLoading(true);
        setMomentumError(null);

        fetchMomentumTrends(5)
            .then((items) => {
                if (!isActive) return;
                setMomentumTrends(items);
                setMomentumLoading(false);
            })
            .catch((err) => {
                if (!isActive) return;
                console.error('[TRENDZ_MOMENTUM_LOAD_ERROR]', err);
                setMomentumTrends([]);
                setMomentumError('Unable to load live momentum signals.');
                setMomentumLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [reloadTick]);

    const followedSlugSet = new Set(followedDomainSlugs);
    const followedDomains = followedDomainSlugs
        .map((slug) => getTrendzDomainBySlug(slug))
        .filter((d): d is NonNullable<typeof d> => Boolean(d));
    const discoverDomains = TRENDZ_DOMAINS.filter((d) => !followedSlugSet.has(d.slug));

    const activeDomainSlugs = new Set(
        (domainSelections.trendz || [])
            .map((name) => normalizeTrendzDomainSlug(name))
            .filter((slug): slug is NonNullable<typeof slug> => Boolean(slug))
    );

    const isSavedViewActive =
        location.pathname === '/trendz/saved' ||
        new URLSearchParams(location.search).get('view') === 'saved';

    useEffect(() => {
        if (followedDomainsFilter) {
            setIsFollowedView(true);
        }
    }, [followedDomainsFilter]);

    // Clear sidebar followed-domain filter state whenever the authenticated user changes or signs out
    const prevAuthUidRef = useRef<string | null>(currentUser?.uid ?? null);
    useEffect(() => {
        const nextUid = currentUser?.uid ?? null;
        if (prevAuthUidRef.current !== nextUid) {
            prevAuthUidRef.current = nextUid;
            setIsFollowedView(false);
            setFollowedDomainsFilter(null);
            setDomainSelection('trendz', []);
        }
    }, [currentUser?.uid, setFollowedDomainsFilter, setDomainSelection]);

    const handleBackFromFollowed = () => {
        setIsFollowedView(false);
        if (followedDomainsFilter) {
            setFollowedDomainsFilter(null);
            setDomainSelection('trendz', []);
        }
    };

    const handleSelectFollowedDomain = (domainName: string) => {
        const targetSlug = normalizeTrendzDomainSlug(domainName);
        const isSoleActive =
            targetSlug !== null && activeDomainSlugs.size === 1 && activeDomainSlugs.has(targetSlug);

        if (isSoleActive) {
            setFollowedDomainsFilter(null);
            setDomainSelection('trendz', []);
        } else {
            setFollowedDomainsFilter(domainName);
            setDomainSelection('trendz', [domainName]);
        }

        if (location.pathname !== '/trendz' || isSavedViewActive) {
            navigate('/trendz');
        }
    };

    const handleFollowDomainInSidebar = async (slug: string) => {
        await followDomain(slug);
    };

    const handleUnfollowDomainInSidebar = async (slug: string, name: string) => {
        const ok = await unfollowDomain(slug);
        if (ok && (followedDomainsFilter === name || (activeDomainSlugs.size === 1 && activeDomainSlugs.has(slug as any)))) {
            setFollowedDomainsFilter(null);
            setDomainSelection('trendz', []);
        }
    };

    const handleSidebarSearchChange = (value: string) => {
        setTrendzSearchQuery?.(value);
        if (location.pathname !== '/trendz') {
            navigate('/trendz');
        }
    };

    const handleOpenMomentumTrend = (trendId: string) => {
        navigate(`/trendz/${encodeURIComponent(trendId)}`);
    };

    const handleViewAllMomentum = () => {
        setFollowedDomainsFilter(null);
        setDomainSelection('trendz', []);
        setTrendzSearchQuery?.('');
        navigate('/trendz?sort=momentum');
    };

    const handleOpenSavedTrends = () => {
        setIsFollowedView(false);
        setFollowedDomainsFilter(null);
        setDomainSelection('trendz', []);
        navigate('/trendz/saved');
    };

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5 overflow-y-auto no-scrollbar">
                {isFollowedView ? (
                    <>
                        <div className="px-4 flex flex-col gap-4">
                             <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="search"
                                    placeholder="SEARCH_TRENDZ..."
                                    value={trendzSearchQuery}
                                    onChange={(e) => handleSidebarSearchChange(e.target.value)}
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <button type="button" onClick={handleBackFromFollowed} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                    <ArrowLeftIcon className="w-4 h-4" />
                                    <span>// FOLLOWED_DOMAINS</span>
                                </button>
                                <span className="font-mono text-[10px] text-zinc-500">
                                    [{followedDomains.length}]
                                </span>
                            </div>
                        </div>

                        {(preferencesError || actionError) && (
                            <div className="mx-4 bg-[#0c0c0e] border border-zinc-700 p-3 font-mono text-[11px] space-y-2">
                                <p className="text-zinc-300 leading-relaxed">
                                    // {actionError || preferencesError}
                                </p>
                                <div className="flex items-center gap-2">
                                    {preferencesError && (
                                        <button
                                            type="button"
                                            onClick={() => void refreshEngagement()}
                                            className="px-2 py-0.5 border border-zinc-700 text-white text-[10px] uppercase hover:border-zinc-500"
                                        >
                                            RETRY
                                        </button>
                                    )}
                                    {actionError && (
                                        <button
                                            type="button"
                                            onClick={clearActionError}
                                            className="px-2 py-0.5 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] uppercase"
                                        >
                                            DISMISS
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4 space-y-3">
                            {!isAuthenticated ? (
                                <div className="py-2 font-mono text-xs space-y-1.5">
                                    <p className="text-white uppercase tracking-wider">// SIGN_IN_REQUIRED</p>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                                        Sign in to follow domains and sync preferences across sessions.
                                    </p>
                                </div>
                            ) : preferencesLoading ? (
                                <div className="space-y-2 animate-pulse">
                                    {[0, 1, 2].map((idx) => (
                                        <div key={idx} className="h-9 bg-zinc-900 border border-zinc-800" />
                                    ))}
                                </div>
                            ) : followedDomains.length === 0 ? (
                                <div className="py-2 font-mono text-xs space-y-1.5">
                                    <p className="text-white uppercase tracking-wider">// NO_FOLLOWED_DOMAINS</p>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                                        Follow domains below to filter quickly and personalize your For You stream.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {followedDomains.map((domain) => {
                                        const isActive =
                                            followedDomainsFilter === domain.name ||
                                            activeDomainSlugs.has(domain.slug);
                                        const pending = isDomainPending(domain.slug);
                                        return (
                                            <div key={domain.slug} className="flex items-stretch gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectFollowedDomain(domain.name)}
                                                    className={`flex-1 flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border min-w-0 ${
                                                        isActive
                                                            ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                                            : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'
                                                    }`}
                                                >
                                                    <domain.icon className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{domain.name}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleUnfollowDomainInSidebar(domain.slug, domain.name)}
                                                    disabled={pending}
                                                    aria-label={`Unfollow ${domain.name}`}
                                                    title={`Unfollow ${domain.name}`}
                                                    className="px-2.5 border border-zinc-800/90 bg-black/60 text-zinc-500 hover:text-white hover:border-zinc-600 font-mono text-xs transition-colors disabled:opacity-50"
                                                >
                                                    {pending ? '…' : '×'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {isAuthenticated && discoverDomains.length > 0 && (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                                <h4 className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                                    // ADD_DOMAINS
                                </h4>
                                <div className="space-y-1.5">
                                    {discoverDomains.map((domain) => {
                                        const pending = isDomainPending(domain.slug);
                                        return (
                                            <div
                                                key={domain.slug}
                                                className="flex items-center justify-between gap-2 p-2 border border-zinc-800/70 bg-black/40"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <domain.icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                    <span className="font-mono text-[11px] text-zinc-300 uppercase tracking-wider truncate">
                                                        {domain.name}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleFollowDomainInSidebar(domain.slug)}
                                                    disabled={pending}
                                                    aria-label={`Follow ${domain.name}`}
                                                    className="px-2 py-0.5 border border-zinc-800 hover:border-zinc-500 text-zinc-400 hover:text-white font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50 shrink-0"
                                                >
                                                    {pending ? '...' : '+ FOLLOW'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="px-4 flex flex-col gap-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="search"
                                    placeholder="SEARCH_TRENDZ..."
                                    value={trendzSearchQuery}
                                    onChange={(e) => handleSidebarSearchChange(e.target.value)}
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFollowedView(true)}
                                className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FilterIcon className="w-4 h-4 text-zinc-500" />
                                    <span>
                                        // FOLLOWED_DOMAINS
                                        {!preferencesLoading && isAuthenticated
                                            ? ` [${followedDomains.length}]`
                                            : ''}
                                    </span>
                                </div>
                                <span className="text-zinc-600">&gt;&gt;</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenSavedTrends}
                                className={`w-full flex items-center justify-between border p-2.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                                    isSavedViewActive
                                        ? 'bg-[#18181d] border-zinc-600 text-white font-bold'
                                        : 'bg-[#0c0c0e] border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <BookmarkIcon className="w-4 h-4 text-zinc-500" />
                                    <span>
                                        // SAVED_TRENDS
                                        {!preferencesLoading && bookmarkRecords.length > 0
                                            ? ` [${bookmarkRecords.length}]`
                                            : ''}
                                    </span>
                                </div>
                                <span className="text-zinc-600">&gt;&gt;</span>
                            </button>
                        </div>
                        
                        <div>
                            <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col">
                                <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// MOMENTUM_NOW</h3>
                                    <button
                                        type="button"
                                        onClick={() => setReloadTick(prev => prev + 1)}
                                        className="text-zinc-500 hover:text-white transition-colors"
                                        aria-label="Refresh momentum signals"
                                        title="Refresh momentum signals"
                                    >
                                        <EllipsisVerticalIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-3.5 space-y-4">
                                    {momentumLoading ? (
                                        [0, 1, 2].map((idx) => (
                                            <div key={idx} className="flex items-start gap-3 animate-pulse">
                                                <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex-shrink-0" />
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <div className="h-3 w-4/5 bg-zinc-800" />
                                                    <div className="h-2.5 w-1/2 bg-zinc-900" />
                                                    <div className="h-2 w-2/3 bg-zinc-900" />
                                                </div>
                                            </div>
                                        ))
                                    ) : momentumError ? (
                                        <div className="py-3 space-y-2 font-mono text-xs">
                                            <p className="text-zinc-400">// SIGNALS_UNAVAILABLE</p>
                                            <button
                                                type="button"
                                                onClick={() => setReloadTick(prev => prev + 1)}
                                                className="px-2.5 py-1 border border-zinc-800 bg-black text-zinc-300 hover:text-white hover:border-zinc-600 text-[10px] uppercase tracking-wider transition-colors"
                                            >
                                                RETRY
                                            </button>
                                        </div>
                                    ) : momentumTrends.length === 0 ? (
                                        <div className="py-3 font-mono text-xs text-zinc-500 space-y-1">
                                            <p className="text-zinc-400">// NO_LIVE_SIGNALS</p>
                                            <p className="text-[11px] text-zinc-600">Published trends ranked by momentum will appear here.</p>
                                        </div>
                                    ) : (
                                        momentumTrends.map((trend) => (
                                            <button
                                                key={trend.id}
                                                type="button"
                                                onClick={() => handleOpenMomentumTrend(trend.id)}
                                                className="w-full text-left flex items-start gap-3 group cursor-pointer focus:outline-none"
                                            >
                                                <div className="relative flex-shrink-0">
                                                    <img 
                                                        src={trend.thumbnailUrl || trend.mediaUrl} 
                                                        onError={handleImageError} 
                                                        alt={trend.title} 
                                                        className="w-10 h-10 object-cover border border-zinc-800" 
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
                                                    <p className="font-mono font-bold text-white text-xs truncate group-hover:text-zinc-200 transition-colors">
                                                        {trend.title}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-500 font-mono truncate">{trend.details.publishedBy}</p>
                                                    <p className="text-[10px] text-zinc-600 font-mono">
                                                        [{trend.details.publishedOn} // {formatNumber(trend.stats.likes)} UPVOTES]
                                                    </p>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>

                                <div className="p-3 border-t border-zinc-800 bg-black/40">
                                    <button
                                        type="button"
                                        onClick={handleViewAllMomentum}
                                        className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors"
                                    >
                                        VIEW_ALL
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
};

const SpotlightSidebar: React.FC<Pick<RightSidebarProps, 'spotlightBrowseState' | 'setSpotlightBrowseState' | 'showPinnedHighlights' | 'setShowPinnedHighlights' | 'showPinnedProfiles' | 'setShowPinnedProfiles' | 'variant' | 'collabManagementView' | 'setCollabManagementView' | 'spotlightIsBrowsing' | 'setSpotlightIsBrowsing'>> = ({ 
    spotlightBrowseState, 
    setSpotlightBrowseState, 
    showPinnedHighlights, 
    setShowPinnedHighlights, 
    showPinnedProfiles,
    setShowPinnedProfiles,
    variant,
    collabManagementView,
    setCollabManagementView,
    spotlightIsBrowsing,
    setSpotlightIsBrowsing,
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const isOnProjectDetail = location.pathname.startsWith('/spotlight/project/');
    const isOnProfileDetail = location.pathname.startsWith('/profile') || location.pathname.startsWith('/id/');
    const isExternalToSpotlight = isOnProjectDetail || isOnProfileDetail;
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const [isBrowsingView, setIsBrowsingView] = useState(false);
    const [isPinnedView, setIsPinnedView] = useState(false);
    const [pinnedViewMode, setPinnedViewMode] = useState<'options' | 'profiles'>('options');
    const [followedProfiles, setFollowedProfiles] = useState<InvoxUser[]>([]);
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

    useEffect(() => {
        if (!currentUser?.uid) {
            setFollowedProfiles([]);
            setIsLoadingProfiles(false);
            return;
        }

        setIsLoadingProfiles(true);
        const unsubscribe = subscribeFollowedProfiles(
            currentUser.uid,
            (profiles) => {
                setFollowedProfiles(profiles);
                setIsLoadingProfiles(false);
            },
            (err) => {
                console.error('[SUBSCRIBE_FOLLOWED_PROFILES_ERROR]', err);
                setIsLoadingProfiles(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    const activeCollabView = collabManagementView !== undefined && collabManagementView !== null 
        ? collabManagementView 
        : (searchParams.get('collabView') === 'incoming' || searchParams.get('collabView') === 'active' || searchParams.get('collabView') === 'my_applications' || searchParams.get('collabView') === 'inbox' || searchParams.get('collabView') === 'teams'
            ? (searchParams.get('collabView') as 'incoming' | 'active' | 'my_applications' | 'inbox' | 'teams') 
            : (searchParams.get('openCollabDashboard') === 'true' ? 'incoming' : null));

    const activeConvId = activeCollabView === 'inbox' ? searchParams.get('conversationId') : null;
    const activeTeamConvId = activeCollabView === 'teams' ? (searchParams.get('teamId') || searchParams.get('conversationId')) : null;
    const collabData = useCollabDashboardData(activeConvId, activeTeamConvId);

    const hasBrowseParam = searchParams.get('browse') === 'projects' || searchParams.get('browse') === 'profiles';

    useEffect(() => {
        // When navigating between spotlight sub-variants (e.g. showcase → collabs), reset local view state.
        // Skip the reset if we are restoring the browse state (e.g. coming from ProjectDetailsPage or ProfilePage).
        if (spotlightIsBrowsing || hasBrowseParam) return;
        setIsBrowsingView(false);
        setIsPinnedView(false);
        setPinnedViewMode('options');
        setSpotlightBrowseState(null);
        setShowPinnedHighlights(false);
        setShowPinnedProfiles?.(false);
    }, [variant, setSpotlightBrowseState, setShowPinnedHighlights, setShowPinnedProfiles, spotlightIsBrowsing, hasBrowseParam]);


    // Sync isBrowsingView from external prop (e.g., when ProjectDetailsPage or ProfilePage preserves browse state)
    useEffect(() => {
        if (spotlightIsBrowsing || hasBrowseParam) {
            setIsBrowsingView(true);
        }
    }, [spotlightIsBrowsing, hasBrowseParam]);

    useEffect(() => {
        if (!isBrowsingView) {
            setSpotlightBrowseState(null);
        }
    }, [isBrowsingView, setSpotlightBrowseState]);

    useEffect(() => {
        if (!isPinnedView) {
            setPinnedViewMode('options');
            setShowPinnedProfiles?.(false);
        }
    }, [isPinnedView, setShowPinnedProfiles]);

    const isCollabs = variant === 'spotlight-collabs' || searchParams.get('tab') === 'Collabs';

    const browseDescription = isCollabs 
        ? "Explore collaboration opportunities and connect with builders."
        : "Explore projects and profiles from creators across the platform.";

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5 overflow-y-auto no-scrollbar">
                {isBrowsingView ? (
                    <>
                        <div className="flex items-center justify-between px-4">
                            <button
                            onClick={() => {
                                setIsBrowsingView(false);
                                setSpotlightIsBrowsing?.(false);
                                setSpotlightBrowseState?.(null);
                                navigate(isCollabs ? '/spotlight?tab=Collabs' : '/spotlight?tab=Showcase');
                            }}
                            className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                                <ArrowLeftIcon className="w-4 h-4" />
                                <span>{isCollabs ? '// BACK_TO_COLLABS' : '// BACK_TO_SHOWCASE'}</span>
                            </button>
                        </div>
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// DIRECTORY</h3>
                            <p className="text-xs text-zinc-400 font-mono mb-4">{browseDescription}</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        if (isExternalToSpotlight) {
                                            navigate(isCollabs ? '/spotlight?tab=Collabs&browse=projects' : '/spotlight?browse=projects');
                                        } else {
                                            setSpotlightBrowseState('projects');
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                        spotlightBrowseState === 'projects' 
                                            ? 'bg-[#18181d] text-white border-zinc-700 font-bold' 
                                            : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'
                                    }`}
                                >
                                    <CubeIcon className="w-4 h-4" />
                                    <span>BROWSE_PROJECTS</span>
                                </button>
                                <button
                                     onClick={() => {
                                        if (isExternalToSpotlight) {
                                            navigate(isCollabs ? '/spotlight?tab=Collabs&browse=profiles' : '/spotlight?browse=profiles');
                                        } else {
                                            setSpotlightBrowseState('profiles');
                                        }
                                     }}
                                     className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                        spotlightBrowseState === 'profiles' 
                                            ? 'bg-[#18181d] text-white border-zinc-700 font-bold' 
                                            : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'
                                    }`}
                                >
                                    <ProfileIcon className="w-4 h-4" />
                                    <span>BROWSE_PROFILES</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : isPinnedView ? (
                    <>
                        {pinnedViewMode === 'options' ? (
                            <>
                                <div className="flex items-center justify-between px-4">
                                    <button onClick={() => { setIsPinnedView(false); setShowPinnedHighlights(false); setShowPinnedProfiles?.(false); }} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer">
                                        <ArrowLeftIcon className="w-4 h-4" />
                                        <span>// PINNED</span>
                                    </button>
                                </div>
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// PINNED_ITEMS</h3>
                                    <p className="text-xs text-zinc-400 font-mono mb-4">Explore projects and profiles from creators you've pinned.</p>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => {
                                                setShowPinnedHighlights(true);
                                                setShowPinnedProfiles?.(false);
                                            }}
                                            className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border cursor-pointer ${
                                                showPinnedHighlights
                                                    ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                                    : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'
                                            }`}
                                        >
                                            <StarIcon className="w-4 h-4" />
                                            <span>PINNED_HIGHLIGHTS</span>
                                        </button>
                                        <button
                                            onClick={() => { 
                                                setPinnedViewMode('profiles'); 
                                                setShowPinnedHighlights(false); 
                                                setShowPinnedProfiles?.(true); 
                                            }}
                                            className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border cursor-pointer ${
                                                showPinnedProfiles
                                                    ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                                    : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'
                                            }`}
                                        >
                                            <ProfileIcon className="w-4 h-4" />
                                            <span>PINNED_PROFILES</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-4">
                                    <button onClick={() => { setPinnedViewMode('options'); setShowPinnedProfiles?.(false); }} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer">
                                        <ArrowLeftIcon className="w-4 h-4" />
                                        <span>// PINNED_PROFILES</span>
                                    </button>
                                    {followedProfiles.length > 0 && (
                                        <span className="font-mono text-[10px] text-zinc-400 border border-zinc-800 bg-black px-2 py-0.5">
                                            // {followedProfiles.length} {followedProfiles.length === 1 ? 'CREATOR' : 'CREATORS'}
                                        </span>
                                    )}
                                </div>
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                                    {!currentUser ? (
                                        <div className="py-6 text-center font-mono text-xs text-zinc-500 space-y-3">
                                            <p className="text-zinc-300 font-bold text-xs">// SIGN IN REQUIRED</p>
                                            <p className="text-zinc-500 text-[11px] leading-relaxed">Sign in to view and manage your followed creators.</p>
                                            <button
                                                onClick={() => navigate('/login')}
                                                className="px-4 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                                            >
                                                SIGN IN
                                            </button>
                                        </div>
                                    ) : isLoadingProfiles ? (
                                        <div className="py-8 text-center font-mono text-xs text-zinc-500 space-y-2">
                                            <div className="w-5 h-5 border border-zinc-600 border-t-white animate-spin mx-auto" />
                                            <p className="text-[10px] uppercase tracking-widest text-zinc-500">// LOADING PROFILES...</p>
                                        </div>
                                    ) : followedProfiles.length === 0 ? (
                                        <div className="py-6 text-center font-mono text-xs space-y-3">
                                            <p className="text-zinc-300 font-bold text-xs">// NO FOLLOWED CREATORS</p>
                                            <p className="text-zinc-400 text-xs leading-relaxed">
                                                Your network starts here. Follow creators whose work interests you.
                                            </p>
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => {
                                                        setIsPinnedView(false);
                                                        setShowPinnedProfiles?.(false);
                                                        setShowPinnedHighlights(false);
                                                        navigate('/spotlight?tab=Showcase');
                                                    }}
                                                    className="w-full py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    BROWSE SHOWCASE
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-0.5">
                                            {followedProfiles.map((user) => {
                                                const userDisplayName = user.displayName || user.username || 'Creator';
                                                const userAvatar = user.photoURL || `https://picsum.photos/seed/${user.uid}/200`;
                                                return (
                                                    <div key={user.uid} className="flex items-center justify-between border-b border-zinc-900 pb-2.5 last:border-0 last:pb-0">
                                                        <div 
                                                            onClick={() => navigate(`/profile/${user.uid}`)}
                                                            className="flex items-center gap-2.5 min-w-0 pr-2 cursor-pointer group"
                                                        >
                                                            <img 
                                                                src={userAvatar} 
                                                                onError={handleImageError} 
                                                                alt={userDisplayName} 
                                                                className="w-8 h-8 object-cover border border-zinc-800 flex-shrink-0 group-hover:border-zinc-500 transition-colors" 
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="font-mono text-xs text-white truncate font-medium group-hover:text-zinc-300 transition-colors">
                                                                    {userDisplayName}
                                                                </p>
                                                                {user.username && (
                                                                    <p className="font-mono text-[10px] text-zinc-500 truncate">@{user.username}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => navigate(`/profile/${user.uid}`)}
                                                            className="bg-zinc-900 text-zinc-300 border border-zinc-750 hover:border-zinc-500 hover:text-white px-2.5 py-1 font-mono text-[10px] uppercase transition-colors flex-shrink-0 cursor-pointer"
                                                            title={`View ${userDisplayName}'s profile`}
                                                        >
                                                            VIEW
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {variant === 'spotlight-collabs' && activeCollabView ? (
                            <div className="px-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCollabManagementView?.(null);
                                        setSearchParams(prev => {
                                            const next = new URLSearchParams(prev);
                                            next.set('tab', 'Collabs');
                                            next.delete('collabView');
                                            next.delete('openCollabDashboard');
                                            return next;
                                        });
                                    }}
                                    className="w-full flex items-center gap-2 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-2.5 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    <ArrowLeftIcon className="w-4 h-4" />
                                    <span>// BACK TO COLLABS</span>
                                </button>
                            </div>
                        ) : (
                            <div className="px-4 flex flex-col gap-2.5">
                                <button
                                    onClick={() => { setIsBrowsingView(true); setShowPinnedHighlights(false); setShowPinnedProfiles?.(false); setSpotlightIsBrowsing?.(true); }}
                                    className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800/90 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500" />
                                        <span>// BROWSE</span>
                                    </div>
                                    <span className="text-zinc-600">&gt;&gt;</span>
                                </button>
                                {variant !== 'spotlight-collabs' && (
                                    <button
                                        onClick={() => { setIsPinnedView(true); setShowPinnedHighlights(false); setShowPinnedProfiles?.(false); }}
                                        className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800/90 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <BookmarkIcon className="w-4 h-4 text-zinc-500" />
                                            <span>// PINNED</span>
                                        </div>
                                        <span className="text-zinc-600">&gt;&gt;</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            {variant === 'spotlight-collabs' && (
                                /* Umbrella Card 1: // COLLABORATION */
                                <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col font-mono text-xs">
                                    {/* Umbrella Header */}
                                    <div className="p-3.5 border-b border-zinc-800 bg-[#09090b]">
                                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                                            // COLLABORATION
                                        </h3>
                                    </div>

                                    {/* Navigation Rows */}
                                    <div className="flex flex-col divide-y divide-zinc-800/80">
                                        {/* // MY APPLICATIONS */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCollabManagementView?.('my_applications');
                                                setSearchParams(prev => {
                                                    if (prev.get('tab') === 'Collabs' && prev.get('collabView') === 'my_applications' && !prev.get('openCollabDashboard')) {
                                                        return prev;
                                                    }
                                                    const next = new URLSearchParams(prev);
                                                    next.set('tab', 'Collabs');
                                                    next.set('collabView', 'my_applications');
                                                    next.delete('openCollabDashboard');
                                                    return next;
                                                });
                                            }}
                                            className={`w-full flex items-center justify-between p-3 transition-colors text-left group cursor-pointer ${
                                                activeCollabView === 'my_applications'
                                                    ? 'bg-zinc-900 text-white font-bold'
                                                    : 'bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                                            }`}
                                            title="View My Applications"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={activeCollabView === 'my_applications' ? 'text-emerald-400 font-bold' : 'text-zinc-500 font-bold'}>//</span>
                                                <span className={`truncate ${activeCollabView === 'my_applications' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-white transition-colors'}`}>
                                                    MY APPLICATIONS
                                                </span>
                                            </div>
                                            <span className={`font-bold px-2 py-0.5 border text-[11px] flex-shrink-0 ml-2 ${
                                                activeCollabView === 'my_applications'
                                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                                    : collabData.myAppsCount > 0
                                                    ? 'bg-zinc-800 text-white border-zinc-700'
                                                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                            }`}>
                                                {collabData.myAppsCount}
                                            </span>
                                        </button>

                                        {/* // INCOMING APPLICATIONS */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCollabManagementView?.('incoming');
                                                setSearchParams(prev => {
                                                    if (prev.get('tab') === 'Collabs' && prev.get('collabView') === 'incoming' && !prev.get('openCollabDashboard')) {
                                                        return prev;
                                                    }
                                                    const next = new URLSearchParams(prev);
                                                    next.set('tab', 'Collabs');
                                                    next.set('collabView', 'incoming');
                                                    next.delete('openCollabDashboard');
                                                    return next;
                                                });
                                            }}
                                            className={`w-full flex items-center justify-between p-3 transition-colors text-left group cursor-pointer ${
                                                activeCollabView === 'incoming'
                                                    ? 'bg-zinc-900 text-white font-bold'
                                                    : 'bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                                            }`}
                                            title="View Incoming Applications"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={activeCollabView === 'incoming' ? 'text-emerald-400 font-bold' : 'text-zinc-500 font-bold'}>//</span>
                                                <span className={`truncate ${activeCollabView === 'incoming' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-white transition-colors'}`}>
                                                    INCOMING APPLICATIONS
                                                </span>
                                            </div>
                                            <span className={`font-bold px-2 py-0.5 border text-[11px] flex-shrink-0 ml-2 ${
                                                activeCollabView === 'incoming'
                                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                                    : collabData.incomingCount > 0
                                                    ? collabData.pendingIncomingCount > 0
                                                        ? 'bg-amber-950/60 text-amber-400 border-amber-800'
                                                        : 'bg-zinc-800 text-white border-zinc-700'
                                                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                            }`}>
                                                {collabData.incomingCount}
                                            </span>
                                        </button>

                                        {/* // ONGOING COLLABORATIONS */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCollabManagementView?.('active');
                                                setSearchParams(prev => {
                                                    if (prev.get('tab') === 'Collabs' && prev.get('collabView') === 'active' && !prev.get('openCollabDashboard')) {
                                                        return prev;
                                                    }
                                                    const next = new URLSearchParams(prev);
                                                    next.set('tab', 'Collabs');
                                                    next.set('collabView', 'active');
                                                    next.delete('openCollabDashboard');
                                                    return next;
                                                });
                                            }}
                                            className={`w-full flex items-center justify-between p-3 transition-colors text-left group cursor-pointer ${
                                                activeCollabView === 'active'
                                                    ? 'bg-zinc-900 text-white font-bold'
                                                    : 'bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                                            }`}
                                            title="View Ongoing Collaborations"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={activeCollabView === 'active' ? 'text-emerald-400 font-bold' : 'text-zinc-500 font-bold'}>//</span>
                                                <span className={`truncate ${activeCollabView === 'active' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-white transition-colors'}`}>
                                                    ONGOING COLLABORATIONS
                                                </span>
                                            </div>
                                            <span className={`font-bold px-2 py-0.5 border text-[11px] flex-shrink-0 ml-2 ${
                                                activeCollabView === 'active'
                                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                                    : collabData.activeCollabsCount > 0
                                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                                    : 'bg-zinc-800 text-white border-zinc-700'
                                            }`}>
                                                {collabData.activeCollabsCount}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Umbrella Card 2: // MESSAGE BOARD */}
                            <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col font-mono text-xs">
                                {/* Umbrella Header */}
                                <div className="p-3.5 border-b border-zinc-800 bg-[#09090b]">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                                        // MESSAGE BOARD
                                    </h3>
                                </div>

                                {/* Navigation Rows */}
                                <div className="flex flex-col divide-y divide-zinc-800/80">
                                    {/* // INBOX */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCollabManagementView?.('inbox');
                                            setSearchParams(prev => {
                                                if (prev.get('tab') === 'Collabs' && prev.get('collabView') === 'inbox' && !prev.get('openCollabDashboard')) {
                                                    return prev;
                                                }
                                                const next = new URLSearchParams(prev);
                                                next.set('tab', 'Collabs');
                                                next.set('collabView', 'inbox');
                                                next.delete('openCollabDashboard');
                                                return next;
                                            });
                                        }}
                                        className={`w-full flex items-center justify-between p-3 transition-colors text-left group cursor-pointer ${
                                            activeCollabView === 'inbox'
                                                ? 'bg-zinc-900 text-white font-bold'
                                                : 'bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                                        }`}
                                        title="Inbox"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={activeCollabView === 'inbox' ? 'text-emerald-400 font-bold' : 'text-zinc-500 font-bold group-hover:text-zinc-400'}>//</span>
                                            <span className={`truncate ${activeCollabView === 'inbox' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-white transition-colors'}`}>
                                                INBOX
                                            </span>
                                        </div>
                                        {collabData.inboxUnreadCount > 0 && (
                                            <span className={`font-bold px-2 py-0.5 border text-[11px] flex-shrink-0 ml-2 ${
                                                activeCollabView === 'inbox'
                                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                                    : 'bg-zinc-800 text-white border-zinc-700'
                                            }`}>
                                                {collabData.inboxUnreadCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* // TEAMS */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCollabManagementView?.('teams');
                                            setSearchParams(prev => {
                                                if (prev.get('tab') === 'Collabs' && prev.get('collabView') === 'teams' && !prev.get('openCollabDashboard')) {
                                                    return prev;
                                                }
                                                const next = new URLSearchParams(prev);
                                                next.set('tab', 'Collabs');
                                                next.set('collabView', 'teams');
                                                next.delete('openCollabDashboard');
                                                return next;
                                            });
                                        }}
                                        className={`w-full flex items-center justify-between p-3 transition-colors text-left group cursor-pointer ${
                                            activeCollabView === 'teams'
                                                ? 'bg-zinc-900 text-white font-bold'
                                                : 'bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                                        }`}
                                        title="Teams"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={activeCollabView === 'teams' ? 'text-emerald-400 font-bold' : 'text-zinc-500 font-bold group-hover:text-zinc-400'}>//</span>
                                            <span className={`truncate ${activeCollabView === 'teams' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-white transition-colors'}`}>
                                                TEAMS
                                            </span>
                                        </div>
                                        {collabData.teamsUnreadCount > 0 && (
                                            <span className={`font-bold px-2 py-0.5 border text-[11px] flex-shrink-0 ml-2 ${
                                                activeCollabView === 'teams'
                                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                                    : 'bg-zinc-800 text-white border-zinc-700'
                                            }`}>
                                                {collabData.teamsUnreadCount}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {variant !== 'spotlight-collabs' && (
                            <div>
                                <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col">
                                    <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// CREATORS_TO_WATCH</h3>
                                        <EllipsisVerticalIcon className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-white transition-colors" />
                                    </div>

                                    <div className="p-3.5 space-y-3.5">
                                        {creatorsToWatch.map((creator, index) => (
                                            <div key={index} className="flex items-start gap-3 group cursor-pointer border-b border-zinc-900 pb-3 last:border-0 last:pb-0">
                                                <img 
                                                    src={creator.avatarUrl} 
                                                    onError={handleImageError} 
                                                    alt={creator.name} 
                                                    className="w-8 h-8 object-cover border border-zinc-800" 
                                                />
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <p className="font-mono font-bold text-white text-xs truncate group-hover:text-zinc-200">{creator.name}</p>
                                                    <p className="text-[11px] text-zinc-500 font-mono truncate">{creator.domain}</p>
                                                    <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                                                        {creator.oneLine}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-3 border-t border-zinc-800 bg-black/40">
                                        <button className="w-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-wider py-2 font-bold transition-all flex items-center justify-center gap-2">
                                            <span>// VIEW_ALL</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};

interface GoForItSidebarProps {
    filters: { company: string; skills: string; location: string; opportunityType: string; category: string; experienceLevel: string; searchTerm: string; };
    setFilters: (filters: { company: string; skills: string; location: string; opportunityType: string; category: string; experienceLevel: string; searchTerm: string; }) => void;
    setIsFilterModalOpen: (isOpen: boolean) => void;
}

const GoForItSidebar: React.FC<GoForItSidebarProps> = ({ filters, setFilters, setIsFilterModalOpen }) => {
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();

    const statusTabs = [
        { name: 'Applied', icon: CheckCircleIcon, path: '/applications' },
        { name: 'Saved', icon: BookmarkIcon, path: '/saved-applications' },
    ];

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5 overflow-y-auto no-scrollbar">
                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="search"
                        placeholder="SEARCH_ROLES_TITLES..."
                        value={filters.searchTerm}
                        onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                        className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                </div>
                <div className="px-4">
                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <FilterIcon className="w-4 h-4 text-zinc-500" />
                            <span>// FILTER_OPPORTUNITIES</span>
                        </div>
                        <span className="text-zinc-600">&gt;&gt;</span>
                    </button>
                </div>

                {/* Status Board */}
                <div>
                    <div className="px-4 mb-2">
                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// STATUS_BOARD</h3>
                    </div>
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                        <div className="space-y-2">
                            {statusTabs.map((tab) => (
                                <button
                                    key={tab.name}
                                    onClick={() => {
                                        if (tab.path && tab.path !== '#') {
                                            navigate(tab.path);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                        location.pathname === tab.path
                                            ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                            : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600'
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span>{tab.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Profile Strength */}
                <div>
                    <div className="px-4 mb-2">
                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// PROFILE_STRENGTH</h3>
                    </div>
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                        <div className="flex justify-between items-center font-mono text-xs mb-2">
                            <span className="text-zinc-400">SCORE:</span>
                            <span className="text-white font-bold">INTERMEDIATE (65%)</span>
                        </div>
                        <div className="w-full bg-zinc-850 h-1 mb-3">
                            <div className="bg-white h-1" style={{width: '65%'}}></div>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-500 mb-3">Complete metadata to optimize discoverability.</p>
                        <button className="w-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-wider py-2 font-bold transition-all flex items-center justify-center gap-2">
                            <span>// ENHANCE_PROFILE</span>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const MyCommunityCard: React.FC<{ community: MyCommunity; onClick?: () => void }> = ({ community, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-[#0c0c0e] p-2.5 border border-zinc-800 hover:border-zinc-600 flex items-center justify-between cursor-pointer transition-colors group"
    >
        <div className="flex items-center gap-2.5 overflow-hidden">
            <img src={community.avatarUrl} onError={handleImageError} alt={community.name} className="w-8 h-8 object-cover border border-zinc-800 flex-shrink-0" />
            <div className="overflow-hidden">
                <p className="font-mono font-bold text-xs text-white truncate group-hover:text-emerald-400 transition-colors">{community.name}</p>
                <p className="text-[11px] font-mono text-zinc-500 truncate">{community.latestMessage}</p>
            </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 ml-2">
            <p className="text-[10px] font-mono text-zinc-500">{community.timestamp}</p>
            {community.hasNotification && <span className="w-2 h-2 bg-red-600 mt-1"></span>}
        </div>
    </div>
);

const CommunitiesSidebar: React.FC<Pick<RightSidebarProps, 'communityFilters' | 'setCommunityFilters' | 'communityView' | 'setCommunityView'>> = ({ communityFilters, setCommunityFilters, communityView, setCommunityView }) => {
    const { currentUser } = useAuth();
    const { joinedCommunities, loading: joinedLoading } = useUserJoinedCommunities(currentUser);
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const searchParams = new URLSearchParams(location.search);
    const viewFromUrl = searchParams.get('view') || searchParams.get('tab');
    const activeInboxId = searchParams.get('inbox');
    const activeView = (activeInboxId && !viewFromUrl)
        ? 'my-communities'
        : (location.pathname === '/communities'
            ? (viewFromUrl === 'conclaves' ? 'conclave-discovery' : (viewFromUrl || 'all'))
            : communityView);

    const isCommunityDetailPage = location.pathname.startsWith('/communities/') && location.pathname !== '/communities';
    const [myCommunitiesSearchTerm, setMyCommunitiesSearchTerm] = useState('');
    const [myCommunityDomains, setMyCommunityDomains] = useState<string[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    
    const [conclaveEvents, setConclaveEvents] = useState<ConclaveEvent[]>([]);
    const [conclaveLoading, setConclaveLoading] = useState(true);
    const [conclaveFormatFilter, setConclaveFormatFilter] = useState<'ALL' | 'ONSITE' | 'VIRTUAL'>('ALL');
    const [isConclaveFilterOpen, setIsConclaveFilterOpen] = useState(false);
    const conclaveFilterRef = useRef<HTMLDivElement>(null);

    // Dynamic subscription to real-time Conclave gathering updates
    useEffect(() => {
        const unsubscribe = subscribeUpcomingConclaveEvents((events) => {
            setConclaveEvents(events);
            setConclaveLoading(false);
        }, 6);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (conclaveFilterRef.current && !conclaveFilterRef.current.contains(event.target as Node)) {
                setIsConclaveFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const liveUserCommunities: MyCommunity[] = React.useMemo(() => {
        if (!currentUser?.uid || !joinedCommunities || joinedCommunities.length === 0) {
            return [];
        }
        return joinedCommunities.map(item => {
            const c = item.community;
            const roleBadge = item.isOwner ? 'Owner' : item.isAdmin ? 'Admin' : 'Member';
            return {
                id: item.id,
                name: c.name || item.id,
                latestMessage: `${roleBadge} • ${c.category || 'General'}`,
                timestamp: item.status === 'active' ? 'Active' : 'Pending',
                hasNotification: false,
                avatarUrl: c.avatarUrl || `https://picsum.photos/seed/${item.id}/200`,
                category: c.category || 'General',
                isLiveMembership: true,
            };
        });
    }, [currentUser?.uid, joinedCommunities]);

    // For authenticated users, strictly show live user communities. For unauthenticated/guest users, allow mock fallback for testing.
    const activeMyCommunities = currentUser?.uid ? liveUserCommunities : mockMyCommunities;

    const filteredMyCommunities = activeMyCommunities.filter(community => {
        const searchMatch = community.name.toLowerCase().includes(myCommunitiesSearchTerm.toLowerCase());
        const domainMatch = myCommunityDomains.length === 0 || myCommunityDomains.includes(community.category);
        return searchMatch && domainMatch;
    });

    const filteredConclaveEvents = conclaveEvents.filter(ev => {
        if (conclaveFormatFilter === 'ALL') return true;
        return ev.eventType === conclaveFormatFilter;
    });

    const showOtherElements = !isSearchFocused && communityFilters.searchTerm.trim() === '';

    const isLoadingState = Boolean(currentUser?.uid) && joinedLoading && joinedCommunities.length === 0;
    const isLeaderboardActive =
        !isCommunityDetailPage &&
        location.pathname === '/communities' &&
        !activeInboxId &&
        activeView === 'leaderboard';
    const isGlobalCollectiveActive =
        !isCommunityDetailPage &&
        location.pathname === '/communities' &&
        !activeInboxId &&
        activeView === 'all';
    const isMyCollectiveActive =
        !isCommunityDetailPage &&
        location.pathname === '/communities' &&
        activeView === 'my-communities';

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5">
                {activeView === 'my-communities' && !isCommunityDetailPage ? (
                     <>
                        <div className="px-4 space-y-4">
                            <button 
                                onClick={() => {
                                    navigate('/communities');
                                    if (setCommunityView) {
                                        setCommunityView('all');
                                    }
                                }} 
                                className="w-full flex items-center gap-2.5 p-2.5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
                            >
                                <ArrowLeftIcon className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
                                <span>// BACK TO COMMUNITIES</span>
                            </button>

                            <div className="space-y-1">
                                <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                                    // PRIVATE_INTERACTIONS
                                </h3>
                                <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
                                    Member-only conversations across your collectives.
                                </p>
                            </div>

                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                    type="search"
                                    placeholder="FILTER_INBOXES..."
                                    value={myCommunitiesSearchTerm}
                                    onChange={(e) => setMyCommunitiesSearchTerm(e.target.value)}
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-8 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="px-4 space-y-2 flex-1 overflow-y-auto no-scrollbar">
                            {isLoadingState ? (
                                <>
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                </>
                            ) : joinedCommunities.length > 0 ? (
                                (() => {
                                    const searchLower = myCommunitiesSearchTerm.trim().toLowerCase();
                                    const inboxes = joinedCommunities.filter(item => {
                                        if (!searchLower) return true;
                                        return (
                                            item.community.name.toLowerCase().includes(searchLower) ||
                                            (item.community.handle && item.community.handle.toLowerCase().includes(searchLower))
                                        );
                                    });

                                    if (inboxes.length === 0) {
                                        return (
                                            <p className="text-center font-mono text-xs text-zinc-600 pt-8">
                                                // NO_INBOXES_MATCHING_FILTER
                                            </p>
                                        );
                                    }

                                    return inboxes.map(item => {
                                        const c = item.community;
                                        const commId = item.id || c.id;
                                        const isSelected = activeInboxId?.toLowerCase() === item.id.toLowerCase() || 
                                                           activeInboxId?.toLowerCase() === c.id.toLowerCase();
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    if (setCommunityView && communityView !== 'my-communities') {
                                                        setCommunityView('my-communities');
                                                    }
                                                    navigate(`/communities?view=my-communities&inbox=${commId}`);
                                                }}
                                                className={`p-3 border transition-all cursor-pointer group ${
                                                    isSelected
                                                        ? 'bg-zinc-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                                                        : 'bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2.5">
                                                    {c.avatarUrl ? (
                                                        <img
                                                            src={c.avatarUrl}
                                                            alt={c.name}
                                                            onError={handleImageError}
                                                            className="w-8 h-8 object-cover border border-zinc-800 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-zinc-950 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                                            <UsersIcon className="w-4 h-4 text-zinc-500" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <p className={`font-mono font-bold text-xs truncate transition-colors ${
                                                                isSelected ? 'text-emerald-400' : 'text-white group-hover:text-emerald-400'
                                                            }`}>
                                                                {c.name}
                                                            </p>
                                                            <span className="text-[9px] font-mono text-zinc-500 whitespace-nowrap">
                                                                {item.status === 'active' ? 'Active' : 'Pending'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                                                            Private community conversations
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-1.5 text-[9px] font-mono">
                                                            <span className={`px-1.5 py-0.5 uppercase font-bold tracking-wider ${
                                                                item.isOwner
                                                                    ? 'text-amber-400 bg-amber-950/40 border border-amber-500/30'
                                                                    : item.isAdmin
                                                                    ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-500/30'
                                                                    : 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                                                            }`}>
                                                                {item.role.toUpperCase()}
                                                            </span>
                                                            <span className="text-zinc-600">•</span>
                                                            {isSelected ? (
                                                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse"></span>
                                                                    <span>ACTIVE INBOX</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-zinc-500 flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 bg-emerald-400 inline-block"></span>
                                                                    <span>ENCLAVE</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()
                            ) : (
                                <div className="text-center font-mono py-8 px-2 space-y-3">
                                    <p className="text-xs text-zinc-500">
                                        // NO_COMMUNITIES_JOINED
                                    </p>
                                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                                        Join technical collectives to establish private member interaction channels.
                                    </p>
                                    <button
                                        onClick={() => {
                                            navigate('/communities');
                                            if (setCommunityView) {
                                                setCommunityView('all');
                                            }
                                        }}
                                        className="px-3 py-1.5 text-xs font-bold uppercase bg-white text-black hover:bg-zinc-200 border border-white transition-colors"
                                    >
                                        EXPLORE COMMUNITIES
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className='overflow-y-auto no-scrollbar flex flex-col gap-5'>
                        {(activeView === 'leaderboard' || activeView === 'conclave-discovery' || isCommunityDetailPage) && (
                            <div className="px-4">
                                <button
                                    onClick={() => {
                                        navigate('/communities');
                                        if (setCommunityView) {
                                            setCommunityView('all');
                                        }
                                    }}
                                    className="w-full flex items-center gap-2.5 p-2.5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
                                >
                                    <ArrowLeftIcon className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
                                    <span>// BACK TO COMMUNITIES</span>
                                </button>
                            </div>
                        )}
                        <div className="relative px-4">
                            <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="search"
                                placeholder="SEARCH_COMMUNITIES..."
                                value={communityFilters.searchTerm}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                onChange={(e) => setCommunityFilters(prev => ({...prev, searchTerm: e.target.value}))}
                                className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                            />
                        </div>

                        {showOtherElements && (
                            <div className="px-4 space-y-5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (setCommunityFilters && communityFilters.searchTerm) {
                                            setCommunityFilters(prev => ({ ...prev, searchTerm: '' }));
                                        }
                                        if (setCommunityView && communityView !== 'leaderboard') {
                                            setCommunityView('leaderboard');
                                        }
                                        if (location.pathname !== '/communities' || searchParams.get('view') !== 'leaderboard') {
                                            navigate('/communities?view=leaderboard');
                                        }
                                    }}
                                    aria-current={isLeaderboardActive ? 'page' : undefined}
                                    className={`w-full flex items-center justify-between gap-3 text-left p-3 border transition-colors cursor-pointer group ${
                                        isLeaderboardActive
                                            ? 'bg-zinc-900 border-emerald-500/50 text-white'
                                            : 'bg-[#0c0c0e] border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border transition-colors ${
                                                isLeaderboardActive
                                                    ? 'bg-black border-emerald-500/40 text-emerald-400'
                                                    : 'bg-black border-zinc-800 text-zinc-400 group-hover:text-white group-hover:border-zinc-700'
                                            }`}
                                        >
                                            <TrophyIcon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block font-mono text-xs font-bold text-white uppercase tracking-wider truncate">
                                                // LEADERBOARD
                                            </span>
                                            <span className="block font-mono text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5 truncate">
                                                TOP RANKED COMMUNITIES
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRightIcon
                                        className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                                            isLeaderboardActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-white'
                                        }`}
                                    />
                                </button>

                                <div className="bg-[#0c0c0e] border border-zinc-800 p-3">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// COLLECTIVES</h3>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => {
                                                if (setCommunityView && communityView !== 'all') {
                                                    setCommunityView('all');
                                                }
                                                if (!isGlobalCollectiveActive) {
                                                    navigate('/communities?view=all');
                                                }
                                            }}
                                            className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider border transition-colors cursor-pointer ${
                                                isGlobalCollectiveActive
                                                    ? 'bg-zinc-900 border-emerald-500/50 text-white font-bold'
                                                    : 'bg-black border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
                                            }`}
                                        >
                                            <GlobeAltIcon className={`w-4 h-4 ${isGlobalCollectiveActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                                            <span>GLOBAL_COLLECTIVE</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (setCommunityView) {
                                                    setCommunityView('my-communities');
                                                }
                                                navigate('/communities?view=my-communities');
                                            }}
                                            className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider border transition-colors cursor-pointer ${
                                                isMyCollectiveActive
                                                    ? 'bg-zinc-900 border-emerald-500/50 text-white font-bold'
                                                    : 'bg-black border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
                                            }`}
                                        >
                                            <BookmarkIcon className={`w-4 h-4 ${isMyCollectiveActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                                            <span>MY_COLLECTIVE</span>
                                        </button>
                                    </div>
                                </div>
                                

                                <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col">
                                    {/* Header */}
                                    <div className="p-3.5 border-b border-zinc-800 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// CONCLAVE UPDATES</h3>
                                                <span className="w-1.5 h-1.5 bg-emerald-500 inline-block animate-pulse"></span>
                                            </div>
                                            <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">
                                                UPCOMING COMMUNITY GATHERINGS
                                            </p>
                                        </div>
                                        <div className="relative" ref={conclaveFilterRef}>
                                            <button 
                                                onClick={() => setIsConclaveFilterOpen(prev => !prev)} 
                                                title="Filter Gathering Formats"
                                                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
                                            >
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </button>
                                            {isConclaveFilterOpen && (
                                                <div className="absolute right-0 mt-1 w-32 bg-[#0c0c0e] border border-zinc-800 z-20 py-1 font-mono text-xs shadow-2xl">
                                                    {(['ALL', 'ONSITE', 'VIRTUAL'] as const).map(filter => (
                                                        <button
                                                            key={filter}
                                                            onClick={() => {
                                                                setConclaveFormatFilter(filter);
                                                                setIsConclaveFilterOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 hover:bg-zinc-800 transition-colors ${
                                                                conclaveFormatFilter === filter ? 'text-white font-bold bg-zinc-900' : 'text-zinc-400'
                                                            }`}
                                                        >
                                                            {filter === 'ALL' ? 'ALL FORMATS' : filter === 'ONSITE' ? 'ON-SITE ONLY' : 'VIRTUAL ONLY'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Conclave Event List */}
                                    <div className="p-3 space-y-2.5">
                                        {conclaveLoading && filteredConclaveEvents.length === 0 ? (
                                            <div className="py-6 px-3 text-center space-y-2 animate-pulse">
                                                <div className="h-3 bg-zinc-800/60 w-3/4 mx-auto"></div>
                                                <div className="h-2 bg-zinc-800/40 w-1/2 mx-auto"></div>
                                            </div>
                                        ) : filteredConclaveEvents.length === 0 ? (
                                            <div className="py-6 px-3 text-center border border-dashed border-zinc-800/80 bg-zinc-950/40">
                                                <p className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider">NO UPCOMING CONCLAVES</p>
                                                <p className="font-mono text-[10px] text-zinc-600 mt-1 uppercase">No gatherings currently scheduled</p>
                                            </div>
                                        ) : (
                                            filteredConclaveEvents.slice(0, 3).map(event => {
                                                const isOnSite = event.eventType === 'ONSITE';
                                                const isOngoing = event.eventStatus === 'ONGOING';
                                                const dateDisplay = event.startDate || event.date || 'TBD';
                                                const timeDisplay = event.startTime || event.time || '';
                                                const thumbUrl = event.coverImageUrl || event.communityAvatarUrl;

                                                return (
                                                    <div 
                                                        key={event.id}
                                                        onClick={() => {
                                                            navigate(`/communities/${event.communityId}?tab=02_conclave&eventId=${event.id}`);
                                                        }}
                                                        className="group flex items-stretch gap-2.5 p-2 bg-black/40 hover:bg-zinc-900/70 border border-zinc-900 hover:border-zinc-700 transition-all cursor-pointer text-left"
                                                        role="button"
                                                        tabIndex={0}
                                                    >
                                                        {/* Thumbnail with Fallback and Format Indicator */}
                                                        <div className="relative w-12 h-14 flex-shrink-0 bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                                                            {thumbUrl ? (
                                                                <img 
                                                                    src={thumbUrl} 
                                                                    onError={handleImageError} 
                                                                    alt={event.title} 
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                                                />
                                                            ) : (
                                                                <div className={`w-full h-full flex flex-col items-center justify-center ${
                                                                    isOnSite ? 'bg-amber-950/20 text-amber-500' : 'bg-cyan-950/20 text-cyan-400'
                                                                }`}>
                                                                    {isOnSite ? (
                                                                        <MapPinIcon className="w-5 h-5 text-amber-500/80" />
                                                                    ) : (
                                                                        <GlobeAltIcon className="w-5 h-5 text-cyan-400/80" />
                                                                    )}
                                                                    <span className="font-mono text-[8px] font-bold mt-0.5 tracking-tighter">
                                                                        {isOnSite ? 'SITE' : 'VIRT'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {/* Format ribbon on thumbnail bottom */}
                                                            <div className="absolute bottom-0 inset-x-0 bg-black/85 backdrop-blur-[2px] py-0.5 text-center border-t border-zinc-800/80">
                                                                <span className={`font-mono text-[8px] font-bold tracking-wider ${
                                                                    isOnSite ? 'text-amber-400' : 'text-cyan-400'
                                                                }`}>
                                                                    {isOnSite ? 'ON-SITE' : 'VIRTUAL'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Details */}
                                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                            <div>
                                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                                    <span className={`font-mono text-[8px] uppercase tracking-wider font-bold px-1 py-0.2 border ${
                                                                        isOnSite 
                                                                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' 
                                                                            : 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                                                                    }`}>
                                                                        {isOnSite ? 'ON-SITE' : 'VIRTUAL'}
                                                                    </span>

                                                                    {isOngoing ? (
                                                                        <span className="flex items-center gap-1 font-mono text-[8px] text-emerald-400 font-bold uppercase tracking-wider">
                                                                            <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></span>
                                                                            LIVE NOW
                                                                        </span>
                                                                    ) : event.registrationStatus === 'OPEN' ? (
                                                                        <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-wider">
                                                                            OPEN
                                                                        </span>
                                                                    ) : null}
                                                                </div>

                                                                <h4 className="font-mono font-bold text-white text-xs truncate group-hover:text-emerald-400 transition-colors">
                                                                    {event.title}
                                                                </h4>
                                                            </div>

                                                            <div className="mt-1 space-y-0.5">
                                                                <p className="text-[11px] font-mono text-zinc-400 truncate">
                                                                    {event.communityName}
                                                                </p>
                                                                <p className="text-[10px] font-mono text-zinc-500">
                                                                    [{dateDisplay}{timeDisplay ? ` // ${timeDisplay}` : ''}]
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Action Footer */}
                                    <div className="p-3 border-t border-zinc-800 bg-black/40">
                                        <button 
                                            onClick={() => {
                                                navigate('/communities?view=conclave-discovery');
                                                if (setCommunityView) {
                                                    setCommunityView('conclave-discovery');
                                                }
                                            }}
                                            className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-2 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <span>VIEW ALL CONCLAVES</span>
                                            <span className="text-zinc-500 font-bold">→</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
};

const HubConversationsSidebar: React.FC<{
  onBack: () => void;
  setSelectedHubConversation: (conversation: HubConversation | null) => void;
  conversations: HubConversation[];
  initialFilter?: string;
}> = ({ onBack, setSelectedHubConversation, conversations, initialFilter = 'All' }) => {
    const [filter, setFilter] = useState(initialFilter);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialFilter) {
            setFilter(initialFilter);
        }
    }, [initialFilter]);

    const filterOptions = [
        { id: 'All', label: 'ALL' },
        { id: 'Comrades', label: 'COMRADES' },
        { id: 'Crew', label: 'CREW' },
        { id: 'Unread', label: 'UNREAD' },
    ];

    const filteredConversations = conversations.filter(convo => {
        const isCrew = filter === 'Crew' || filter === 'Groups';
        const isComrades = filter === 'Comrades';

        const filterMatch =
            filter === 'All' ||
            (filter === 'Unread' && convo.unreadCount > 0) ||
            (isComrades && (convo.category === 'comrade' || (!convo.isGroup && convo.category !== 'explore' && convo.category !== 'spotlight'))) ||
            (isCrew && (convo.category === 'group' || convo.isGroup === true)) ||
            (filter.toLowerCase().replace(/s$/, '') === convo.category);

        const searchMatch = convo.name.toLowerCase().includes(searchTerm.toLowerCase());

        return filterMatch && searchMatch;
    });

    const headerLabel = filter === 'Comrades' ? '// COMRADES' : filter === 'Crew' ? '// CREW' : '// CONVERSATIONS';

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4">
                <div className="flex items-center gap-2 px-4">
                    <button 
                        onClick={onBack} 
                        className="p-1.5 border border-zinc-800 bg-[#0c0c0e] hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors" 
                        aria-label="Back to Hub main"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">{headerLabel}</h2>
                </div>

                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="search"
                        placeholder="SEARCH_CONVERSATIONS..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 px-4 overflow-x-auto no-scrollbar">
                    {filterOptions.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap border transition-colors ${
                                filter === tab.id
                                    ? 'bg-white text-black border-white font-bold'
                                    : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-2">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map(convo => {
                            const lastMessage = convo.messages[convo.messages.length - 1];
                            const lastMessageText = lastMessage?.text || (lastMessage ? `[${lastMessage.type}]` : 'No messages');
                            return (
                                <button 
                                    key={convo.id}
                                    onClick={() => setSelectedHubConversation && setSelectedHubConversation(convo)}
                                    className="w-full text-left bg-[#0c0c0e] p-2.5 flex items-center justify-between gap-2.5 border border-zinc-800 hover:border-zinc-600 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <div className="relative flex-shrink-0">
                                            <img src={convo.avatarUrl} onError={handleImageError} alt={convo.name} className="w-8 h-8 object-cover border border-zinc-800" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-mono font-bold text-xs text-white truncate">{convo.name}</p>
                                                {convo.isGroup ? (
                                                    <span className="text-[9px] font-mono text-zinc-500 border border-zinc-800 px-1 uppercase">CREW</span>
                                                ) : (
                                                    <span className="text-[9px] font-mono text-zinc-500 border border-zinc-800 px-1 uppercase">1:1</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] font-mono text-zinc-500 truncate">{lastMessageText}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end flex-shrink-0">
                                        <p className="text-[10px] font-mono text-zinc-500 mb-1">{convo.timestamp}</p>
                                        {convo.unreadCount > 0 && (
                                            <span className="bg-red-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.2">
                                                {convo.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="p-6 text-center border border-zinc-800/80 bg-[#0c0c0e] font-mono">
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">// EMPTY_STREAM</span>
                            <p className="text-xs text-zinc-400">No {filter !== 'All' ? filter : 'active'} conversations found.</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

const HubSidebar: React.FC<Pick<RightSidebarProps, 'hubView' | 'setHubView' | 'hubRightSidebarView' | 'setHubRightSidebarView' | 'setSelectedHubConversation' | 'hubConversations'>> = ({ 
    hubView, 
    setHubView, 
    hubRightSidebarView, 
    setHubRightSidebarView, 
    setSelectedHubConversation, 
    hubConversations 
}) => {
    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4 overflow-y-auto no-scrollbar">
                {hubView === 'stream' && (
                    <div className="flex items-center gap-2 px-4">
                        <button 
                            onClick={() => setHubView && setHubView('welcome')} 
                            className="p-1.5 border border-zinc-800 bg-[#0c0c0e] hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors" 
                            aria-label="Back to Global Collective"
                        >
                            <ArrowLeftIcon className="w-4 h-4" />
                        </button>
                        <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// STREAM</h2>
                    </div>
                )}

                {/* Search Bar */}
                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                        type="search" 
                        placeholder="SEARCH_HUB..." 
                        className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors" 
                    />
                </div>

                {/* Card 1 — Stream */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                            // STREAM
                        </h3>
                        {hubView === 'stream' && (
                            <span className="w-1.5 h-1.5 bg-green-500"></span>
                        )}
                    </div>
                    <p className="font-mono text-[11px] text-zinc-400 mb-3.5 leading-relaxed">
                        Broadcast moments and share your latest loops.
                    </p>
                    <button
                        onClick={() => {
                            if (setHubView) setHubView('stream');
                            if (setHubRightSidebarView) setHubRightSidebarView('main');
                        }}
                        className={`w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider transition-all border ${
                            hubView === 'stream'
                                ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                : 'bg-black/60 text-zinc-300 border-zinc-800/90 hover:border-zinc-600 hover:text-white hover:bg-zinc-900/50'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <SoundWaveIcon className="w-4 h-4 text-zinc-400" />
                            <span className="font-bold">OPEN STREAM</span>
                        </div>
                        <span className="font-mono text-zinc-400">→</span>
                    </button>
                </div>

                {/* Card 2 — Converse */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                            // CONVERSE
                        </h3>
                        {(hubView === 'conversations' || hubRightSidebarView === 'conversations' || hubRightSidebarView === 'comrades' || hubRightSidebarView === 'crew') && (
                            <span className="w-1.5 h-1.5 bg-green-500"></span>
                        )}
                    </div>
                    <p className="font-mono text-[11px] text-zinc-400 mb-3.5 leading-relaxed">
                        Private conversations with your network.
                    </p>
                    <div className="space-y-2">
                        {/* COMRADES navigation row */}
                        <button
                            onClick={() => {
                                if (setHubView) setHubView('conversations');
                                if (setHubRightSidebarView) setHubRightSidebarView('comrades');
                            }}
                            className={`w-full text-left p-2.5 font-mono transition-all border group ${
                                hubView === 'conversations' && hubRightSidebarView === 'comrades'
                                    ? 'bg-[#18181d] border-zinc-700'
                                    : 'bg-black/60 border-zinc-800/90 hover:border-zinc-600 hover:bg-zinc-900/50'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UsersIcon className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-white">COMRADES</span>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-600">1:1</span>
                            </div>
                        </button>

                        {/* CREWS navigation row */}
                        <button
                            onClick={() => {
                                if (setHubView) setHubView('conversations');
                                if (setHubRightSidebarView) setHubRightSidebarView('crew');
                            }}
                            className={`w-full text-left p-2.5 font-mono transition-all border group ${
                                hubView === 'conversations' && hubRightSidebarView === 'crew'
                                    ? 'bg-[#18181d] border-zinc-700'
                                    : 'bg-black/60 border-zinc-800/90 hover:border-zinc-600 hover:bg-zinc-900/50'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-white">CREWS</span>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-600">GROUP</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const MySpaceSidebar = () => {
    const location = ReactRouterDOM.useLocation();
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams] = ReactRouterDOM.useSearchParams();
    const isCommunityManagerActive = (location.pathname === '/myspace' || location.pathname === '/my-space') && searchParams.get('tab') === 'communities';

    const sidebarButtons = [
        { name: 'Uploads', icon: ArrowUpTrayIcon, path: '/myspace/uploads' },
        { name: 'Analytics', icon: PresentationChartBarIcon, path: '#' },
        { name: 'My Activity', icon: ClipboardListIcon, path: '#' },
    ];

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4 overflow-y-auto no-scrollbar">
                {isCommunityManagerActive && (
                    <div className="px-4">
                        <button
                            onClick={() => {
                                navigate('/myspace?tab=galaxy');
                            }}
                            className="w-full flex items-center gap-2.5 p-2.5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
                        >
                            <ArrowLeftIcon className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
                            <span>BACK TO MY SPACE</span>
                        </button>
                    </div>
                )}

                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input type="search" placeholder="SEARCH_MY_SPACE..." className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors" />
                </div>

                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                    <div className="space-y-2">
                        {sidebarButtons.map((btn) => (
                            <ReactRouterDOM.Link
                                key={btn.name}
                                to={btn.path}
                                className="w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                            >
                                <btn.icon className="w-4 h-4" />
                                <span>{btn.name}</span>
                            </ReactRouterDOM.Link>
                        ))}
                    </div>
                </div>

                {/* COMMUNITY MANAGER Section */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">
                        // COMMUNITY MANAGER
                    </h3>
                    <div className="space-y-2">
                        <ReactRouterDOM.Link
                            to="/myspace?tab=communities"
                            className={`w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider border transition-all ${
                                isCommunityManagerActive
                                    ? 'bg-white text-black font-bold border-white'
                                    : 'bg-black border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <UsersIcon className={`w-4 h-4 ${isCommunityManagerActive ? 'text-black' : 'text-zinc-400'}`} />
                                <span>COMMUNITY MANAGER</span>
                            </div>
                            <span className={`text-[10px] font-mono ${isCommunityManagerActive ? 'text-zinc-700 font-bold' : 'text-zinc-600'}`}>
                                &gt;&gt;
                            </span>
                        </ReactRouterDOM.Link>
                    </div>
                </div>

                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-3">// QUICK_TELEMETRY</h3>
                    <div className="space-y-2.5 font-mono text-xs">
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                            <span className="text-zinc-500">PROFILE_VIEWS:</span>
                            <span className="text-white font-bold">1,204</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                            <span className="text-zinc-500">POST_REACH:</span>
                            <span className="text-white font-bold">+12%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-500">CONNECTIONS:</span>
                            <span className="text-white font-bold">842</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const TargetSelectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onSelect: (target: string) => void }> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    const categories = [
        {
            title: 'Explore',
            targets: [
                { name: 'Channels', context: 'Channel', icon: SoundWaveIcon },
                { name: 'Feeds', context: 'Feed', icon: ClipboardListIcon },
                { name: 'Discover', context: 'Discover', icon: MagnifyingGlassIcon },
            ]
        },
        {
            title: 'Spotlight',
            targets: [
                { name: 'Showcase', context: 'Showcase', icon: PresentationChartBarIcon },
                { name: 'Collabs', context: 'Collab', icon: UsersIcon },
            ]
        },
        {
            title: 'Hub',
            targets: [
                { name: 'Loops', context: 'Loop', icon: SparklesIcon },
                { name: 'Stills', context: 'Still', icon: PencilIcon },
                { name: 'Tapes', context: 'Tape', icon: PlayIcon },
                { name: 'Knacks', context: 'Knack', icon: WrenchScrewdriverIcon },
            ]
        },
        {
            title: 'Communities',
            targets: [
                { name: 'Community Post', context: 'Community Post', icon: UsersIcon },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 shadow-2xl overflow-hidden animate-fadeInUp">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// SELECT_DESTINATION</h3>
                    <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white transition-colors">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto no-scrollbar">
                    {categories.map((category) => (
                        <div key={category.title}>
                            <h4 className="font-mono text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">{category.title}</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {category.targets.map((target) => (
                                    <button
                                        key={target.name}
                                        onClick={() => {
                                            onSelect(target.context);
                                            onClose();
                                        }}
                                        className="w-full flex items-center gap-3 p-3 bg-black/60 border border-zinc-800/90 hover:border-zinc-600 hover:bg-zinc-900/50 transition-all group font-mono text-xs text-left"
                                    >
                                        <div className="p-1.5 bg-zinc-900/90 border border-zinc-800 text-zinc-400 group-hover:text-white transition-colors">
                                            <target.icon className="w-4 h-4" />
                                        </div>
                                        <span className="font-bold text-white uppercase">{target.name}</span>
                                        <span className="ml-auto text-zinc-600 group-hover:text-white font-mono">&gt;&gt;</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const UploadsSidebar: React.FC<{ setUploadTriggerTarget: (target: string | null) => void }> = ({ setUploadTriggerTarget }) => {
    const navigate = ReactRouterDOM.useNavigate();
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    
    const creationItems = [
        { 
            name: 'Create', 
            icon: PlusIcon
        },
        { 
            name: 'Smart Create', 
            icon: SparklesIcon
        },
    ];

    return (
        <>
            <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
                <div className="h-full flex flex-col gap-4">
                    <div className="px-4">
                        <button 
                            onClick={() => navigate('/myspace')} 
                            className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors" 
                            aria-label="Back to My Space"
                        >
                            <ArrowLeftIcon className="w-4 h-4" />
                            <span>// MY_SPACE</span>
                        </button>
                    </div>

                    <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                        <div className="space-y-2">
                            {creationItems.map((item) => (
                                <div key={item.name}>
                                    <button
                                        onClick={() => setIsTargetModalOpen(true)}
                                        className="w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                                    >
                                        <item.icon className="w-4 h-4" />
                                        <span>{item.name}</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>
            
            <TargetSelectionModal 
                isOpen={isTargetModalOpen} 
                onClose={() => setIsTargetModalOpen(false)} 
                onSelect={(ctx) => setUploadTriggerTarget(ctx)}
            />
        </>
    );
};

const RightSidebar: React.FC<RightSidebarProps> = ({ variant, ...props }) => {
    const location = ReactRouterDOM.useLocation();

    const renderSidebarContent = () => {
        if (variant === 'settings' || location.pathname.startsWith('/settings')) {
            return <SettingsSidebar />;
        }

        switch (variant) {
            case 'feeds':
                return (
                    <DiscoverSidebar 
                        activityFilter={props.activityFilter} 
                        setActivityFilter={props.setActivityFilter} 
                        discoverSearchTerm={props.discoverSearchTerm}
                        setDiscoverSearchTerm={props.setDiscoverSearchTerm}
                    />
                );
            case 'discover':
                return (
                    <DiscoverSidebar 
                        activityFilter={props.activityFilter} 
                        setActivityFilter={props.setActivityFilter} 
                        discoverSearchTerm={props.discoverSearchTerm}
                        setDiscoverSearchTerm={props.setDiscoverSearchTerm}
                    />
                );
            case 'trendz':
                return (
                    <TrendzSidebar
                        followedDomainsFilter={props.followedDomainsFilter}
                        setFollowedDomainsFilter={props.setFollowedDomainsFilter}
                        trendzSearchQuery={props.trendzSearchQuery}
                        setTrendzSearchQuery={props.setTrendzSearchQuery}
                    />
                );
            case 'spotlight-showcase':
            case 'spotlight-collabs':
            case 'spotlight':
                 return <SpotlightSidebar 
                    variant={variant}
                    spotlightBrowseState={props.spotlightBrowseState} 
                    setSpotlightBrowseState={props.setSpotlightBrowseState} 
                    showPinnedHighlights={props.showPinnedHighlights} 
                    setShowPinnedHighlights={props.setShowPinnedHighlights} 
                    showPinnedProfiles={props.showPinnedProfiles}
                    setShowPinnedProfiles={props.setShowPinnedProfiles}
                    collabManagementView={props.collabManagementView}
                    setCollabManagementView={props.setCollabManagementView}
                    spotlightIsBrowsing={props.spotlightIsBrowsing}
                    setSpotlightIsBrowsing={props.setSpotlightIsBrowsing}
                 />;
            case 'goforit':
                return <GoForItSidebar filters={props.goforitFilters} setFilters={props.setGoforitFilters} setIsFilterModalOpen={props.setIsFilterModalOpen}/>
            case 'communities':
                return <CommunitiesSidebar communityFilters={props.communityFilters} setCommunityFilters={props.setCommunityFilters} communityView={props.communityView} setCommunityView={props.setCommunityView} />;
            case 'hub':
                return <HubSidebar
                    hubView={props.hubView}
                    setHubView={props.setHubView}
                    hubRightSidebarView={props.hubRightSidebarView}
                    setHubRightSidebarView={props.setHubRightSidebarView}
                    setSelectedHubConversation={props.setSelectedHubConversation}
                    hubConversations={props.hubConversations}
                />;
            case 'myspace':
                return <MySpaceSidebar />;
            case 'uploads':
                return <UploadsSidebar setUploadTriggerTarget={props.setUploadTriggerTarget || (() => {})} />;
            default:
                return (
                     <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
                        <div className="p-4 text-center font-mono text-xs text-zinc-600">
                           <p>// CONTEXT_PANEL_IDLE</p>
                        </div>
                    </aside>
                );
        }
    };

    return renderSidebarContent();
};

export default RightSidebar;
