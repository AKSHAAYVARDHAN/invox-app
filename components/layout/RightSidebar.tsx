import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Trend, MyCommunity, Conference, Event, HubConversation } from '../../types';
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
    CheckBadgeIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import MyCommunityCardSkeleton from '../communities/MyCommunityCardSkeleton';
import DomainFilter from '../ui/DomainFilter';

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

const mockTrends: Trend[] = [
    {
        id: '1',
        domain: { name: 'Health Care', icon: ShieldCheckIcon, isFollowed: true },
        title: "Super Skin Heals Wounds 90% In 4 Hours",
        summary: "Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing.",
        fullContent: "Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing.",
        mediaUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1612536539035-1a8335aa8823?q=80&w=1974&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        details: {
            publishedBy: 'MedTech',
            publishedOn: '11-03-2025',
            link: 'https://x.com/Akshaay_24'
        },
        createdAt: new Date(),
    },
    {
        id: '2',
        domain: { name: 'Health Care', icon: ShieldCheckIcon, isFollowed: true },
        title: "AI Achieved 99% Accuracy Detecting Cancer",
        summary: "A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools.",
        fullContent: "A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools.",
        mediaUrl: 'https://images.unsplash.com/photo-1554734867-bf3c00a49371?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1526253752538-345100688942?q=80&w=2070&auto=format&fit=crop',
        stats: { likes: 95600, views: 51200000, comments: 15800 },
        details: {
            publishedBy: 'AI Forward',
            publishedOn: '10-03-2025',
            link: 'https://x.com/Invox'
        },
        createdAt: new Date(),
    },
    {
        id: '3',
        domain: { name: 'Technology', icon: CodeBracketIcon, isFollowed: true },
        title: "Quantum Computing Achieves New Milestone",
        summary: "Researchers have successfully maintained quantum coherence for a record-breaking duration.",
        fullContent: "In a significant leap for quantum computing, researchers at a leading institute have successfully maintained quantum coherence in a qubit system.",
        mediaUrl: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1964&auto=format&fit=crop',
        stats: { likes: 120000, views: 65000000, comments: 25000 },
        details: {
            publishedBy: 'Tech Frontiers',
            publishedOn: '09-03-2025',
            link: 'https://x.com/Invox'
        },
        createdAt: new Date(),
    }
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

const mockConferences: Conference[] = [
    { id: 'conf1', title: 'AI in 2025: The Future', date: 'Oct 26', time: '10:00 AM', timezone: 'PST', communityName: 'AI ClubTech', communityAvatarUrl: 'https://picsum.photos/seed/ai-clubtech/200', type: 'Online' },
    { id: 'conf2', title: 'Design Systems Summit', date: 'Nov 02', time: '1:00 PM', timezone: 'EST', communityName: 'UI/UX Guild', communityAvatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200', type: 'Offline' },
    { id: 'conf3', title: 'React Forward Conf', date: 'Nov 15', time: '9:00 AM', timezone: 'GMT', communityName: 'JS Junkies', communityAvatarUrl: 'https://picsum.photos/seed/js-junkies/200', type: 'Online' },
];

const mockEvents: Event[] = [
    { id: 'evt1', title: 'Web3 & The Metaverse', date: 'Dec 01', time: '4:00 PM', timezone: 'PST', communityName: 'Startup Grind', communityAvatarUrl: 'https://picsum.photos/seed/startup-grind/200', eventType: 'Talk', locationType: 'Online' },
    { id: 'evt2', title: 'Figma Design-a-thon', date: 'Dec 05', time: '9:00 AM', timezone: 'EST', communityName: 'UI/UX Guild', communityAvatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200', eventType: 'Hackathon', locationType: 'Offline' },
    { id: 'evt3', title: 'Python for Data Science', date: 'Dec 10', time: '11:00 AM', timezone: 'GMT', communityName: 'Pythonic Geeks', communityAvatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200', eventType: 'Meetup', locationType: 'Online' },
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
}

const DiscoverSidebar: React.FC<Pick<RightSidebarProps, 'activityFilter' | 'setActivityFilter'>> = ({ activityFilter, setActivityFilter }) => {
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
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="search"
                        placeholder="SEARCH_THREADS_QUERIES..."
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
                            <p className="text-xs text-zinc-400 font-mono mb-4">View commented threads and shared insights.</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActivityFilter('threads')}
                                    className={`w-full text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${activityFilter === 'threads' ? 'bg-white text-black border-white font-bold' : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'}`}
                                >
                                    &gt; THREADS
                                </button>
                                <button
                                    onClick={() => setActivityFilter('queries')}
                                    className={`w-full text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${activityFilter === 'queries' ? 'bg-white text-black border-white font-bold' : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'}`}
                                >
                                    &gt; QUERIES
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


const TrendzSidebar: React.FC<Pick<RightSidebarProps, 'followedDomainsFilter' | 'setFollowedDomainsFilter'>> = ({ followedDomainsFilter, setFollowedDomainsFilter }) => {
    const [isFollowedView, setIsFollowedView] = useState(false);
    
    const formatNumber = (num: number) => {
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
        return num;
    };

    const trendingItems = mockTrends.slice(0, 3).map(trend => ({
        id: trend.id,
        title: trend.title,
        source: trend.details.publishedBy,
        timestamp: trend.details.publishedOn,
        upvotes: formatNumber(trend.stats.likes),
        imageUrl: trend.thumbnailUrl || trend.mediaUrl
    }));
    
    const followedDomains = [
        { name: 'Health Care', icon: ShieldCheckIcon },
        { name: 'Technology', icon: CodeBracketIcon },
    ];

    useEffect(() => {
        if (followedDomainsFilter) {
            setIsFollowedView(true);
        }
    }, [followedDomainsFilter]);

    const handleBackFromFollowed = () => {
        setIsFollowedView(false);
        setFollowedDomainsFilter(null);
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
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <button onClick={handleBackFromFollowed} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                    <ArrowLeftIcon className="w-4 h-4" />
                                    <span>// FOLLOWED_DOMAINS</span>
                                </button>
                            </div>
                        </div>
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                            <div className="space-y-2">
                                {followedDomains.map(domain => (
                                    <button
                                        key={domain.name}
                                        onClick={() => setFollowedDomainsFilter(domain.name)}
                                        className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${followedDomainsFilter === domain.name ? 'bg-white text-black border-white font-bold' : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'}`}
                                    >
                                        <domain.icon className="w-4 h-4" />
                                        <span>{domain.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="px-4 flex flex-col gap-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="search"
                                    placeholder="SEARCH_TRENDZ..."
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                            </div>
                            <button
                                onClick={() => setIsFollowedView(true)}
                                className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <BookmarkIcon className="w-4 h-4 text-zinc-500" />
                                    <span>// FOLLOWED_DOMAINS</span>
                                </div>
                                <span className="text-zinc-600">&gt;&gt;</span>
                            </button>
                        </div>
                        
                        <div>
                            <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col">
                                <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// MOMENTUM_NOW</h3>
                                    <EllipsisVerticalIcon className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-white transition-colors" />
                                </div>

                                <div className="p-3.5 space-y-4">
                                    {trendingItems.map((item) => (
                                        <div key={item.id} className="flex items-start gap-3 group cursor-pointer">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={item.imageUrl} 
                                                    onError={handleImageError} 
                                                    alt={item.title} 
                                                    className="w-10 h-10 object-cover border border-zinc-800" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
                                                <p className="font-mono font-bold text-white text-xs truncate group-hover:text-zinc-200 transition-colors">
                                                    {item.title}
                                                </p>
                                                <p className="text-[11px] text-zinc-500 font-mono">{item.source}</p>
                                                <p className="text-[10px] text-zinc-600 font-mono">[{item.timestamp} // {item.upvotes} UPVOTES]</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-3 border-t border-zinc-800 bg-black/40">
                                    <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
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

const SpotlightSidebar: React.FC<Pick<RightSidebarProps, 'spotlightBrowseState' | 'setSpotlightBrowseState' | 'showPinnedHighlights' | 'setShowPinnedHighlights' | 'variant'>> = ({ spotlightBrowseState, setSpotlightBrowseState, showPinnedHighlights, setShowPinnedHighlights, variant }) => {
    const [isBrowsingView, setIsBrowsingView] = useState(false);
    const [isPinnedView, setIsPinnedView] = useState(false);
    const [pinnedViewMode, setPinnedViewMode] = useState<'options' | 'profiles'>('options');

    useEffect(() => {
        setIsBrowsingView(false);
        setIsPinnedView(false);
        setPinnedViewMode('options');
        setSpotlightBrowseState(null);
        setShowPinnedHighlights(false);
    }, [variant, setSpotlightBrowseState, setShowPinnedHighlights]);

    useEffect(() => {
        if (!isBrowsingView) {
            setSpotlightBrowseState(null);
        }
    }, [isBrowsingView, setSpotlightBrowseState]);

    useEffect(() => {
        if (!isPinnedView) {
            setPinnedViewMode('options');
        }
    }, [isPinnedView]);

    const pinnedUsers = [
        { name: 'Elon Musk', handle: '@elonmusk', avatarUrl: 'https://picsum.photos/seed/elon/200' },
        { name: 'Satya Nadella', handle: '@satyanadella', avatarUrl: 'https://picsum.photos/seed/satya/200' },
        { name: 'Ada Lovelace', handle: '@ada', avatarUrl: 'https://picsum.photos/seed/ada/200' },
        { name: 'Crash Adams', handle: '@crashadams', avatarUrl: 'https://picsum.photos/id/10/200/200' },
        { name: 'Marco Rossi', handle: '@marcorossi', avatarUrl: 'https://picsum.photos/id/12/200/200' },
    ];

    const browseDescription = variant === 'spotlight-collabs' 
        ? "Explore collaboration opportunities and connect with builders."
        : "Explore projects and profiles from creators across the platform.";

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5 overflow-y-auto no-scrollbar">
                {isBrowsingView ? (
                    <>
                        <div className="flex items-center justify-between px-4">
                            <button onClick={() => setIsBrowsingView(false)} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                <ArrowLeftIcon className="w-4 h-4" />
                                <span>// BACK_TO_SPOTLIGHT</span>
                            </button>
                        </div>
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// DIRECTORY</h3>
                            <p className="text-xs text-zinc-400 font-mono mb-4">{browseDescription}</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setSpotlightBrowseState('projects')}
                                    className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                        spotlightBrowseState === 'projects' 
                                            ? 'bg-white text-black border-white font-bold' 
                                            : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'
                                    }`}
                                >
                                    <CubeIcon className="w-4 h-4" />
                                    <span>BROWSE_PROJECTS</span>
                                </button>
                                <button
                                     onClick={() => setSpotlightBrowseState('profiles')}
                                     className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                        spotlightBrowseState === 'profiles' 
                                            ? 'bg-white text-black border-white font-bold' 
                                            : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'
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
                                    <button onClick={() => { setIsPinnedView(false); setShowPinnedHighlights(false); }} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                        <ArrowLeftIcon className="w-4 h-4" />
                                        <span>// PINNED</span>
                                    </button>
                                </div>
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// PINNED_ITEMS</h3>
                                    <p className="text-xs text-zinc-400 font-mono mb-4">Explore projects and profiles from creators you've pinned.</p>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setShowPinnedHighlights(true)}
                                            className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                                showPinnedHighlights
                                                    ? 'bg-white text-black border-white font-bold'
                                                    : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'
                                            }`}
                                        >
                                            <StarIcon className="w-4 h-4" />
                                            <span>PINNED_HIGHLIGHTS</span>
                                        </button>
                                        <button
                                            onClick={() => { setPinnedViewMode('profiles'); setShowPinnedHighlights(false); }}
                                            className="w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600"
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
                                    <button onClick={() => setPinnedViewMode('options')} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                        <ArrowLeftIcon className="w-4 h-4" />
                                        <span>// PINNED_PROFILES</span>
                                    </button>
                                </div>
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4">
                                    <div className="space-y-3">
                                        {pinnedUsers.map((user, index) => (
                                            <div key={index} className="flex items-center justify-between border-b border-zinc-900 pb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <img src={user.avatarUrl} onError={handleImageError} alt={user.name} className="w-7 h-7 object-cover border border-zinc-800" />
                                                    <p className="font-mono text-xs text-white">{user.name}</p>
                                                </div>
                                                <button className="bg-black text-zinc-300 border border-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase hover:text-white hover:border-zinc-600">VIEW</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <div className="px-4 flex flex-col gap-2.5">
                            <button
                                onClick={() => { setIsBrowsingView(true); setShowPinnedHighlights(false); }}
                                className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500" />
                                    <span>// BROWSE</span>
                                </div>
                                <span className="text-zinc-600">&gt;&gt;</span>
                            </button>
                            {variant !== 'spotlight-collabs' && (
                                <button
                                    onClick={() => { setIsPinnedView(true); setShowPinnedHighlights(false); }}
                                    className="w-full flex items-center justify-between bg-[#0c0c0e] border border-zinc-800 p-2.5 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <BookmarkIcon className="w-4 h-4 text-zinc-500" />
                                        <span>// PINNED</span>
                                    </div>
                                    <span className="text-zinc-600">&gt;&gt;</span>
                                </button>
                            )}
                        </div>

                        {variant === 'spotlight-collabs' && (
                            <div className="bg-[#0c0c0e] border border-zinc-800 mx-4 flex flex-col">
                                <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// MY_COLLABORATIONS</h3>
                                    <EllipsisVerticalIcon className="w-4 h-4 text-zinc-500" />
                                </div>

                                <div className="p-3.5 space-y-3 font-mono text-xs">
                                    <div className="flex items-center justify-between p-2 bg-black border border-zinc-850">
                                        <span className="text-zinc-400">PENDING_REQUESTS:</span>
                                        <span className="text-white font-bold bg-zinc-800 px-1.5 py-0.5">12</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-black border border-zinc-850">
                                        <span className="text-zinc-400">ACTIVE_COLLABS:</span>
                                        <span className="text-white font-bold bg-zinc-800 px-1.5 py-0.5">4</span>
                                    </div>
                                </div>

                                <div className="p-3 border-t border-zinc-800 bg-black/40">
                                    <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
                                        OPEN_DASHBOARD
                                    </button>
                                </div>
                            </div>
                        )}

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
                                        <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
                                            VIEW_ALL
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
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'
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
                        <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
                            ENHANCE_PROFILE
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const MyCommunityCard: React.FC<{ community: MyCommunity }> = ({ community }) => (
    <div className="bg-[#0c0c0e] p-2.5 border border-zinc-800 hover:border-zinc-600 flex items-center justify-between cursor-pointer transition-colors">
        <div className="flex items-center gap-2.5 overflow-hidden">
            <img src={community.avatarUrl} onError={handleImageError} alt={community.name} className="w-8 h-8 object-cover border border-zinc-800 flex-shrink-0" />
            <div className="overflow-hidden">
                <p className="font-mono font-bold text-xs text-white truncate">{community.name}</p>
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
    const [loading, setLoading] = useState(false);
    const [myCommunitiesSearchTerm, setMyCommunitiesSearchTerm] = useState('');
    const [myCommunityDomains, setMyCommunityDomains] = useState<string[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    
    const [conferenceFilter, setConferenceFilter] = useState<'All' | 'Online' | 'Offline'>('All');
    const [hasNewConference, setHasNewConference] = useState(true);
    const [isConferenceFilterMenuOpen, setIsConferenceFilterMenuOpen] = useState(false);
    const conferenceFilterMenuRef = useRef<HTMLDivElement>(null);
    
    const [eventFilter, setEventFilter] = useState<'All' | 'Online' | 'Offline'>('All');
    const [hasNewEvent, setHasNewEvent] = useState(true);
    const [isEventFilterMenuOpen, setIsEventFilterMenuOpen] = useState(false);
    const eventFilterMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (conferenceFilterMenuRef.current && !conferenceFilterMenuRef.current.contains(event.target as Node)) {
                setIsConferenceFilterMenuOpen(false);
            }
            if (eventFilterMenuRef.current && !eventFilterMenuRef.current.contains(event.target as Node)) {
                setIsEventFilterMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (communityView === 'my-communities') {
            setLoading(true);
            const timer = setTimeout(() => setLoading(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [communityView]);

    const filteredMyCommunities = mockMyCommunities.filter(community => {
        const searchMatch = community.name.toLowerCase().includes(myCommunitiesSearchTerm.toLowerCase());
        const domainMatch = myCommunityDomains.length === 0 || myCommunityDomains.includes(community.category);
        return searchMatch && domainMatch;
    });
    
    const filteredConferences = mockConferences.filter(c => 
        conferenceFilter === 'All' || c.type === conferenceFilter
    );

    const filteredEvents = mockEvents.filter(e =>
        eventFilter === 'All' || e.locationType === eventFilter
    );

    const showOtherElements = !isSearchFocused && communityFilters.searchTerm.trim() === '';

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-5">
                {communityView === 'my-communities' ? (
                     <>
                        <div className="px-4 space-y-3">
                             <div className="flex items-center justify-between">
                                <button onClick={() => setCommunityView('leaderboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                                    <ArrowLeftIcon className="w-4 h-4" />
                                    <span>// MY_COMMUNITIES</span>
                                </button>
                            </div>
                            <DomainFilter
                                domains={communityPageDomains}
                                selectedDomains={myCommunityDomains}
                                onSelectionChange={setMyCommunityDomains}
                                buttonText="Filter by Domain"
                            />
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="search"
                                    placeholder="SEARCH_MY_COMMUNITIES..."
                                    value={myCommunitiesSearchTerm}
                                    onChange={(e) => setMyCommunitiesSearchTerm(e.target.value)}
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                            </div>
                        </div>
                        <div className="px-4 space-y-2 flex-1 overflow-y-auto no-scrollbar">
                            {loading ? (
                                <>
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                </>
                            ) : filteredMyCommunities.length > 0 ? (
                                filteredMyCommunities.map(community => (
                                   <MyCommunityCard key={community.id} community={community} />
                                ))
                            ) : (
                                <p className="text-center font-mono text-xs text-zinc-600 pt-8">// NO_COMMUNITIES_FOUND</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className='overflow-y-auto no-scrollbar flex flex-col gap-5'>
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
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-3">
                                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-2">// VIEWS</h3>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setCommunityView('my-communities')}
                                            className="w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                                        >
                                            <BookmarkIcon className="w-4 h-4" />
                                            <span>MY_COMMUNITIES</span>
                                        </button>
                                        <button
                                             onClick={() => setCommunityView('all')}
                                             className="w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                                        >
                                            <GlobeAltIcon className="w-4 h-4" />
                                            <span>ALL_COMMUNITIES</span>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col">
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// CONFERENCES</h3>
                                            {hasNewConference && (
                                                <span className="w-1.5 h-1.5 bg-red-500 inline-block"></span>
                                            )}
                                        </div>
                                        <div className="relative" ref={conferenceFilterMenuRef}>
                                            <button onClick={() => setIsConferenceFilterMenuOpen(prev => !prev)} className="p-1 text-zinc-400 hover:text-white transition-colors">
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </button>
                                            {isConferenceFilterMenuOpen && (
                                                <div className="absolute right-0 mt-1 w-28 bg-[#0c0c0e] border border-zinc-800 z-10 py-1 font-mono text-xs">
                                                    {(['All', 'Online', 'Offline'] as const).map(filter => (
                                                        <button
                                                            key={filter}
                                                            onClick={() => {
                                                                setConferenceFilter(filter);
                                                                setIsConferenceFilterMenuOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 hover:bg-zinc-800 ${conferenceFilter === filter ? 'text-white font-bold bg-zinc-900' : 'text-zinc-400'}`}
                                                        >
                                                            {filter}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Conference List */}
                                    <div className="p-3.5 space-y-3">
                                        {filteredConferences.slice(0, 3).map(conf => (
                                            <div key={conf.id} className="flex items-start gap-2.5 border-b border-zinc-900 pb-2.5 last:border-0 last:pb-0">
                                                <img src={conf.communityAvatarUrl} onError={handleImageError} alt={conf.communityName} className="w-8 h-8 object-cover border border-zinc-800" />
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="font-mono font-bold text-white text-xs truncate">{conf.title}</p>
                                                    <p className="text-[11px] font-mono text-zinc-500 truncate">{conf.communityName}</p>
                                                    <p className="text-[10px] font-mono text-zinc-600">[{conf.date} // {conf.time}]</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-3 border-t border-zinc-800 bg-black/40">
                                        <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
                                            VIEW_ALL
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col">
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// EVENTS</h3>
                                            {hasNewEvent && (
                                                <span className="w-1.5 h-1.5 bg-red-500 inline-block"></span>
                                            )}
                                        </div>
                                        <div className="relative" ref={eventFilterMenuRef}>
                                            <button onClick={() => setIsEventFilterMenuOpen(prev => !prev)} className="p-1 text-zinc-400 hover:text-white transition-colors">
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </button>
                                            {isEventFilterMenuOpen && (
                                                <div className="absolute right-0 mt-1 w-28 bg-[#0c0c0e] border border-zinc-800 z-10 py-1 font-mono text-xs">
                                                    {(['All', 'Online', 'Offline'] as const).map(filter => (
                                                        <button
                                                            key={filter}
                                                            onClick={() => {
                                                                setEventFilter(filter);
                                                                setIsEventFilterMenuOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 hover:bg-zinc-800 ${eventFilter === filter ? 'text-white font-bold bg-zinc-900' : 'text-zinc-400'}`}
                                                        >
                                                            {filter}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Event List */}
                                    <div className="p-3.5 space-y-3">
                                        {filteredEvents.slice(0, 3).map(event => (
                                            <div key={event.id} className="flex items-start gap-2.5 border-b border-zinc-900 pb-2.5 last:border-0 last:pb-0">
                                                <img src={event.communityAvatarUrl} onError={handleImageError} alt={event.communityName} className="w-8 h-8 object-cover border border-zinc-800" />
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-mono font-bold text-white text-xs truncate">{event.title}</p>
                                                        <span className="bg-zinc-800 text-zinc-300 px-1 py-0.2 font-mono text-[9px] uppercase">
                                                            {event.eventType}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] font-mono text-zinc-500 truncate">{event.communityName}</p>
                                                    <p className="text-[10px] font-mono text-zinc-600">[{event.date} // {event.time}]</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-3 border-t border-zinc-800 bg-black/40">
                                        <button className="w-full bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-xs uppercase tracking-wider py-1.5 transition-colors">
                                            VIEW_ALL
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
}> = ({ onBack, setSelectedHubConversation, conversations }) => {
    const [filter, setFilter] = useState('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    
    const filterOptionsWithIcons = [
        { name: 'All', icon: ClipboardListIcon },
        { name: 'Unread', icon: BellIcon },
        { name: 'Comrades', icon: UsersIcon },
        { name: 'Groups', icon: ShieldCheckIcon },
        { name: 'Explore', icon: ExploreIcon },
        { name: 'Spotlight', icon: SpotlightIcon },
    ];

    const filterRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredConversations = conversations.filter(convo => {
        const filterMatch =
            filter === 'All' ||
            (filter === 'Unread' && convo.unreadCount > 0) ||
            (filter.toLowerCase().replace(/s$/, '') === convo.category);

        const searchMatch = convo.name.toLowerCase().includes(searchTerm.toLowerCase());

        return filterMatch && searchMatch;
    });

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4">
                <div className="flex items-center gap-2 px-4">
                    <button onClick={onBack} className="p-1.5 border border-zinc-800 bg-[#0c0c0e] hover:border-zinc-600 text-zinc-400 hover:text-white" aria-label="Back to Hub main">
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// CONVERSATIONS</h2>
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
                
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-2">
                    {filteredConversations.map(convo => {
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
                                        <p className="font-mono font-bold text-xs text-white truncate">{convo.name}</p>
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
                    })}
                </div>
            </div>
        </aside>
    );
};

const HubSidebar: React.FC<Pick<RightSidebarProps, 'hubView' | 'setHubView' | 'hubRightSidebarView' | 'setHubRightSidebarView' | 'setSelectedHubConversation' | 'hubConversations'>> = ({ hubView, setHubView, hubRightSidebarView, setHubRightSidebarView, setSelectedHubConversation, hubConversations }) => {
    
    if (hubRightSidebarView === 'conversations') {
        if (!setHubRightSidebarView || !setSelectedHubConversation || !hubConversations) return null;
        return <HubConversationsSidebar onBack={() => { setHubRightSidebarView('main'); setSelectedHubConversation(null); if (setHubView) setHubView('welcome'); }} setSelectedHubConversation={setSelectedHubConversation} conversations={hubConversations} />;
    }

    const hubNavItems = [
        { name: 'Stream', icon: SoundWaveIcon, view: 'stream' },
        { name: 'Conversations', icon: ChatBubbleIcon, action: () => setHubRightSidebarView && setHubRightSidebarView('conversations') },
    ];

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4 overflow-y-auto no-scrollbar">
                {hubView === 'stream' && (
                    <div className="flex items-center gap-2 px-4">
                        <button onClick={() => setHubView && setHubView('welcome')} className="p-1.5 border border-zinc-800 bg-[#0c0c0e] hover:border-zinc-600 text-zinc-400 hover:text-white" aria-label="Back to Global Collective">
                            <ArrowLeftIcon className="w-4 h-4" />
                        </button>
                        <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">// STREAM</h2>
                    </div>
                )}

                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input type="search" placeholder="SEARCH_HUB..." className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-9 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors" />
                </div>

                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4">
                    <div className="space-y-2">
                        {hubNavItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => {
                                    if (item.action) item.action();
                                    else if (item.view && setHubView) setHubView(item.view);
                                }}
                                className={`w-full flex items-center gap-2.5 text-left p-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                                    hubView === item.view ? 'bg-white text-black border-white font-bold' : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'
                                }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

const MySpaceSidebar = () => {
    const sidebarButtons = [
        { name: 'Uploads', icon: ArrowUpTrayIcon, path: '/myspace/uploads' },
        { name: 'Analytics', icon: PresentationChartBarIcon, path: '#' },
        { name: 'My Activity', icon: ClipboardListIcon, path: '#' },
    ];

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4 overflow-y-auto no-scrollbar">
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
                { name: 'Stills', context: 'Still', icon: PencilIcon },
                { name: 'Tapes', context: 'Tape', icon: PlayIcon },
                { name: 'Knacks', context: 'Knack', icon: WrenchScrewdriverIcon },
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
                                        className="w-full flex items-center gap-3 p-3 bg-black border border-zinc-850 hover:border-zinc-600 transition-all group font-mono text-xs text-left"
                                    >
                                        <div className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-white transition-colors">
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
    const renderSidebarContent = () => {
        switch (variant) {
            case 'feeds':
                return <DiscoverSidebar activityFilter={props.activityFilter} setActivityFilter={props.setActivityFilter} />;
            case 'discover':
                return <DiscoverSidebar activityFilter={props.activityFilter} setActivityFilter={props.setActivityFilter} />;
            case 'trendz':
                return <TrendzSidebar followedDomainsFilter={props.followedDomainsFilter} setFollowedDomainsFilter={props.setFollowedDomainsFilter} />;
            case 'spotlight-showcase':
            case 'spotlight-collabs':
            case 'spotlight':
                 return <SpotlightSidebar 
                    variant={variant}
                    spotlightBrowseState={props.spotlightBrowseState} 
                    setSpotlightBrowseState={props.setSpotlightBrowseState} 
                    showPinnedHighlights={props.showPinnedHighlights} 
                    setShowPinnedHighlights={props.setShowPinnedHighlights} 
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
