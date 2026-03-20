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

// Data duplicated from Trendz.tsx to avoid complex state passing
const mockTrends: Trend[] = [
    {
        id: '1',
        domain: { name: 'Health Care', icon: ShieldCheckIcon, isFollowed: true },
        title: "Super Skin Heals Wounds 90% In 4 Hours",
        summary: "Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing.",
        fullContent: "Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing. It enhances the natural healing process, repairing wounds up to 90% within just 4 hours. Whether for minor cuts, surgical recovery, or injuries, super skin promotes rapid repair, minimizes scarring, and promotes healthier skin regeneration in record time.",
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
        summary: "A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools. It was trained on thousands of microscope images, covering everything from normal tissue.",
        fullContent: "A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools. It was trained on thousands of microscope images, covering everything from normal tissue to malignant cells. This breakthrough promises earlier diagnosis, more effective treatment planning, and a significant step forward in the fight against cancer.",
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
        summary: "Researchers have successfully maintained quantum coherence for a record-breaking duration, paving the way for more stable and powerful quantum computers.",
        fullContent: "In a significant leap for quantum computing, researchers at a leading institute have successfully maintained quantum coherence in a qubit system for a record-breaking duration. This breakthrough addresses one of the primary obstacles in building functional quantum computers, paving the way for more stable, powerful, and error-resistant machines capable of solving problems far beyond the reach of classical computers.",
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
    },
    {
        id: '4',
        domain: { name: 'Trading', icon: ShieldCheckIcon, isFollowed: false },
        title: "AI-Powered Trading Bots Outperform Market",
        summary: "A new study reveals that advanced AI-powered trading bots are consistently outperforming traditional market benchmarks, leveraging real-time data analysis.",
        fullContent: "A new comprehensive study has revealed that advanced AI-powered trading bots are consistently outperforming traditional market benchmarks. By leveraging sophisticated algorithms and real-time data analysis, these bots can identify and act on market opportunities faster than human traders, marking a significant shift in the landscape of financial trading and investment strategies.",
        mediaUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1640286599723-3a479a3243c2?q=80&w=1964&auto=format&fit=crop',
        stats: { likes: 78000, views: 32000000, comments: 9500 },
        details: {
            publishedBy: 'FinTech Today',
            publishedOn: '08-03-2025',
            link: 'https://x.com/Invox'
        },
        createdAt: new Date(),
    },
    {
        id: '5',
        domain: { name: 'Stock Market', icon: PresentationChartBarIcon, isFollowed: false },
        title: "Green Energy Stocks Surge on New Policy",
        summary: "Following the announcement of new global green energy policies, stocks in the renewable energy sector have seen an unprecedented surge, attracting significant investor interest.",
        fullContent: "Following the announcement of new global green energy policies, stocks in the renewable energy sector have experienced an unprecedented surge. This rally is attracting significant investor interest, as companies specializing in solar, wind, and other sustainable technologies are expected to see massive growth, signaling a major shift in market dynamics towards sustainability.",
        mediaUrl: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1623352013854-a65c275a59a6?q=80&w=1965&auto=format&fit=crop',
        stats: { likes: 91000, views: 41000000, comments: 11200 },
        details: {
            publishedBy: 'Market Watch',
            publishedOn: '07-03-2025',
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
    { id: 'mc7', name: 'Market Movers', latestMessage: 'Interesting trend in the renewable energy sector.', timestamp: '5d ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/market-movers/200', category: 'Business' },
    { id: 'mc8', name: 'Creative Canvas', latestMessage: 'New design challenge posted!', timestamp: '5d ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/creative-canvas/200', category: 'Design' },
    { id: 'mc9', name: 'DevOps Den', latestMessage: 'Check out this new CI/CD pipeline setup.', timestamp: '6d ago', hasNotification: true, avatarUrl: 'https://picsum.photos/seed/devops-den/200', category: 'Coding' },
    { id: 'mc10', name: 'Data Mavericks', latestMessage: 'Anyone working with Polars instead of Pandas?', timestamp: '1w ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/data-mavericks/200', category: 'Artificial Intelligence' },
    { id: 'mc11', name: 'Growth Hackers Inc.', latestMessage: 'We just passed 10,000 members!', timestamp: '1w ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/growth-hackers/200', category: 'Business' },
    { id: 'mc12', name: 'Sales Superstars', latestMessage: 'What are your go-to closing techniques?', timestamp: '2w ago', hasNotification: false, avatarUrl: 'https://picsum.photos/seed/sales-superstars/200', category: 'Business' },
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
    { id: 'conf4', title: 'The Pythonic Web', date: 'Nov 20', time: '11:00 AM', timezone: 'PST', communityName: 'Pythonic Geeks', communityAvatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200', type: 'Online' },
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
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-6 overflow-y-auto no-scrollbar">
                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Search Threads and Queries"
                        className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                    />
                </div>

                {isActivityView ? (
                    <>
                        <div className="flex items-center justify-between px-4">
                            <button onClick={handleBackFromActivity} className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors">
                                <ArrowLeftIcon className="w-5 h-5" />
                                <h3 className="font-bold text-lg text-white">Activity</h3>
                            </button>
                        </div>
                        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4">
                            <p className="text-sm text-gray-400 mb-4">View your commented threads and shared insights.</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActivityFilter('threads')}
                                    className={`w-full text-left p-3 rounded-md font-semibold transition-colors ${activityFilter === 'threads' ? 'bg-invox-red text-white' : 'bg-invox-dark text-gray-300 hover:bg-gray-700'}`}
                                >
                                    Threads
                                </button>
                                <button
                                    onClick={() => setActivityFilter('queries')}
                                    className={`w-full text-left p-3 rounded-md font-semibold transition-colors ${activityFilter === 'queries' ? 'bg-invox-red text-white' : 'bg-invox-dark text-gray-300 hover:bg-gray-700'}`}
                                >
                                    Queries
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="px-4">
                            <button
                                onClick={() => setIsActivityView(true)}
                                className="w-full flex items-center justify-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg p-3 text-white font-semibold hover:bg-gray-700 transition-colors"
                                title="Activity"
                            >
                                <PencilIcon className="w-5 h-5" />
                                <span>Activity</span>
                            </button>
                        </div>

                        <div>
                            {/* Suggestions Card with improved themed profile images */}
                            <div className="bg-invox-dark-accent rounded-xl border border-gray-800 mx-4 overflow-hidden flex flex-col shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 pb-4">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-white">Suggestions</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="h-6 w-px bg-gray-800/50"></div>
                                        <button className="p-1 text-gray-400 hover:text-white transition-colors">
                                            <EllipsisVerticalIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gray-800 mx-5"></div>

                                {/* User List */}
                                <div className="p-5 space-y-6">
                                    {suggestedChannels.map((channel, index) => (
                                        <div key={index} className="flex items-start gap-4 group cursor-pointer">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={channel.avatarUrl} 
                                                    onError={handleImageError} 
                                                    alt={channel.name} 
                                                    className="w-12 h-12 rounded-lg object-cover border border-white/5 shadow-lg group-hover:scale-105 transition-transform duration-300" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-semibold text-white text-base truncate">{channel.name}</p>
                                                    {channel.isVerified && <CheckBadgeIcon className="w-4 h-4 text-invox-blue" />}
                                                </div>
                                                <p className="text-sm text-gray-400 truncate">{channel.followers}</p>
                                                <p className="text-sm text-gray-500 truncate font-semibold">{channel.domain}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer Action Button - Standardized size and style */}
                                <div className="px-5 pb-5 mt-auto">
                                    <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                                        View All
                                    </button>
                                </div>
                            </div>
                        </div>

                        <footer className="text-xs text-gray-500 space-x-2 px-4 mt-8 opacity-50">
                            <a href="#" className="hover:underline">Terms of Service</a>
                            <a href="#" className="hover:underline">Privacy Policy</a>
                            <a href="#" className="hover:underline">About</a>
                            <span>© 2024 Invox Corp.</span>
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
        source: trend.details.publishedBy, // Use the actual source/publisher name
        timestamp: trend.details.publishedOn, // Added timestamp
        upvotes: formatNumber(trend.stats.likes), // Added upvotes (likes)
        imageUrl: trend.thumbnailUrl || trend.mediaUrl
    }));
    
    // In a real app, this would come from user data
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
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-6 overflow-y-auto no-scrollbar">
                {isFollowedView ? (
                    <>
                        <div className="px-4 flex flex-col gap-4">
                             <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="search"
                                    placeholder="Search Trendz"
                                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <button onClick={handleBackFromFollowed} className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                    <h3 className="font-bold text-lg text-white">Followed Domains</h3>
                                </button>
                            </div>
                        </div>
                        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4">
                            <div className="space-y-2">
                                {followedDomains.map(domain => (
                                    <button
                                        key={domain.name}
                                        onClick={() => setFollowedDomainsFilter(domain.name)}
                                        className={`w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold transition-colors ${followedDomainsFilter === domain.name ? 'bg-invox-red text-white' : 'bg-invox-dark text-gray-300 hover:bg-gray-700'}`}
                                    >
                                        <domain.icon className="w-5 h-5" />
                                        <span>{domain.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="px-4 flex flex-col gap-4">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="search"
                                    placeholder="Search Trendz"
                                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                                />
                            </div>
                            <button
                                onClick={() => setIsFollowedView(true)}
                                className="w-full flex items-center justify-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg p-3 text-white font-semibold hover:bg-gray-700 transition-colors"
                                title="Followed Domains"
                            >
                                <BookmarkIcon className="w-5 h-5" />
                                <span>Followed Domains</span>
                            </button>
                        </div>
                        
                        <div>
                            {/* MIMICKING CONFERENCE NOTIFY CARD UI */}
                            <div className="bg-invox-dark-accent rounded-xl border border-gray-800 mx-4 overflow-hidden flex flex-col shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 pb-4">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-white">Momentum Now</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="h-6 w-px bg-gray-800/50"></div>
                                        <button className="p-1 text-gray-400 hover:text-white transition-colors">
                                            <EllipsisVerticalIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gray-800 mx-5"></div>

                                {/* List Body */}
                                <div className="p-5 space-y-6">
                                    {trendingItems.map((item, index) => (
                                        <div key={item.id} className="flex items-start gap-4 group cursor-pointer">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={item.imageUrl} 
                                                    onError={handleImageError} 
                                                    alt={item.title} 
                                                    className="w-12 h-12 rounded-lg object-cover border border-white/5 shadow-lg group-hover:scale-105 transition-transform duration-300" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                                                {/* REVEAL FULL ONE-LINE ON HOVER - Removed native tooltip title */}
                                                <p className="font-semibold text-white text-base truncate group-hover:whitespace-normal group-hover:break-words group-hover:text-invox-red transition-all duration-300">
                                                    {item.title}
                                                </p>
                                                <p className="text-sm text-gray-400">{item.source}</p>
                                                {/* REPLACED VIEWS WITH TIMESTAMP AND UPVOTES */}
                                                <p className="text-xs text-gray-500 font-medium">{item.timestamp} • {item.upvotes} Upvotes</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer Action */}
                                <div className="px-5 pb-5 mt-auto">
                                    <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                                        View All
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

    // Reset local view states when the variant changes (Showcase <-> Collabs)
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
        { name: 'Dr. Evelyn Reed', handle: '@evelynreed', avatarUrl: 'https://picsum.photos/id/13/200/200' },
        { name: 'Chloe Bennet', handle: '@chloebennet', avatarUrl: 'https://picsum.photos/id/15/200/200' },
        { name: 'Liam Johnson', handle: '@liamjohnson', avatarUrl: 'https://picsum.photos/id/16/200/200' },
        { name: 'Mc Benny', handle: '@mcbenny', avatarUrl: 'https://picsum.photos/id/25/200/200' },
        { name: 'Julia Chen', handle: '@juliachen', avatarUrl: 'https://picsum.photos/id/26/200/200' },
    ];

    const browseDescription = variant === 'spotlight-collabs' 
        ? "Explore collaboration opportunities and connect with builders looking to work together."
        : "Explore projects and profiles from creators across the platform.";

    return (
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-6 overflow-y-auto no-scrollbar">
                {isBrowsingView ? (
                    <>
                        <div className="flex items-center justify-between px-4">
                            <button onClick={() => setIsBrowsingView(false)} className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors">
                                <ArrowLeftIcon className="w-5 h-5" />
                                <h3 className="font-bold text-lg text-white">Browse</h3>
                            </button>
                        </div>
                        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4">
                            <p className="text-sm text-gray-400 mb-4">{browseDescription}</p>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setSpotlightBrowseState('projects')}
                                    className={`w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold transition-colors ${
                                        spotlightBrowseState === 'projects' 
                                            ? 'bg-invox-red text-white' 
                                            : 'bg-invox-dark text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    <CubeIcon className="w-5 h-5" />
                                    <span>Browse Projects</span>
                                </button>
                                <button
                                     onClick={() => setSpotlightBrowseState('profiles')}
                                     className={`w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold transition-colors ${
                                        spotlightBrowseState === 'profiles' 
                                            ? 'bg-invox-red text-white' 
                                            : 'bg-invox-dark text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    <ProfileIcon className="w-5 h-5" />
                                    <span>Browse Profiles</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : isPinnedView ? (
                    <>
                        {pinnedViewMode === 'options' ? (
                            <>
                                <div className="flex items-center justify-between px-4">
                                    <button onClick={() => { setIsPinnedView(false); setShowPinnedHighlights(false); }} className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors">
                                        <ArrowLeftIcon className="w-5 h-5" />
                                        <h3 className="font-bold text-lg text-white">Pinned</h3>
                                    </button>
                                </div>
                                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4">
                                    <p className="text-sm text-gray-400 mb-4">Explore projects and profiles from creators you've pinned.</p>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setShowPinnedHighlights(true)}
                                            className={`w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold transition-colors ${
                                                showPinnedHighlights
                                                    ? 'bg-invox-red text-white'
                                                    : 'bg-invox-dark text-gray-300 hover:bg-gray-700'
                                            }`}
                                        >
                                            <StarIcon className="w-5 h-5" />
                                            <span>Pinned Highlights</span>
                                        </button>
                                        <button
                                            onClick={() => { setPinnedViewMode('profiles'); setShowPinnedHighlights(false); }}
                                            className="w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold bg-invox-dark text-gray-300 hover:bg-gray-700 transition-colors"
                                        >
                                            <ProfileIcon className="w-5 h-5" />
                                            <span>Pinned Profiles</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : ( // Pinned Profiles View
                            <>
                                <div className="flex items-center justify-between px-4">
                                    <button onClick={() => setPinnedViewMode('options')} className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors">
                                        <ArrowLeftIcon className="w-5 h-5" />
                                        <h3 className="font-bold text-lg text-white">Pinned Profiles</h3>
                                    </button>
                                </div>
                                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4">
                                    <p className="text-sm text-gray-400 mb-4">Profiles you have followed from the Spotlight section.</p>
                                    <div className="space-y-4">
                                        {pinnedUsers.map((user, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <img src={user.avatarUrl} onError={handleImageError} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                                                    <div>
                                                        <p className="font-semibold text-white hover:underline cursor-pointer">{user.name}</p>
                                                    </div>
                                                </div>
                                                <button className="bg-invox-dark text-white border border-gray-800 px-4 py-1 rounded-full text-sm font-bold hover:bg-gray-700">View</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="text-invox-red text-sm mt-4 hover:underline">Show more</button>
                                </div>
                            </>
                        )}
                    </>
                ) : ( // Default Spotlight Sidebar View
                    <>
                        <div className="px-4 flex flex-col gap-4">
                            <button
                                onClick={() => { setIsBrowsingView(true); setShowPinnedHighlights(false); }}
                                className="w-full flex items-center justify-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg p-3 text-white font-semibold hover:bg-gray-700 transition-colors"
                                title="Browse"
                            >
                                <MagnifyingGlassIcon className="w-5 h-5" />
                                <span>Browse</span>
                            </button>
                            {variant !== 'spotlight-collabs' && (
                                <button
                                    onClick={() => { setIsPinnedView(true); setShowPinnedHighlights(false); }}
                                    className="w-full flex items-center justify-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg p-3 text-white font-semibold hover:bg-gray-700 transition-colors"
                                    title="Pinned"
                                >
                                    <BookmarkIcon className="w-5 h-5" />
                                    <span>Pinned</span>
                                </button>
                            )}
                        </div>

                        {/* MY COLLABORATIONS CARD - Only show in Collabs section */}
                        {variant === 'spotlight-collabs' && (
                            <div className="bg-invox-dark-accent rounded-xl border border-gray-800 mx-4 overflow-hidden flex flex-col shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 pb-4">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-white">My Collaborations</h3>
                                    </div>
                                    <button className="p-1 text-gray-400 hover:text-white transition-colors">
                                        <EllipsisVerticalIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gray-800 mx-5"></div>

                                {/* Metrics Body */}
                                <div className="p-5 space-y-4">
                                    <div className="flex items-center justify-between group cursor-pointer">
                                        <div className="flex items-center gap-3 text-gray-400 font-medium">
                                            <div className="p-2 rounded-lg bg-gray-800/50 text-invox-red flex items-center justify-center transition-transform group-hover:scale-110">
                                                <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm group-hover:text-white transition-colors">Pending Requests</span>
                                        </div>
                                        <span className="text-white font-bold tabular-nums bg-invox-red/10 px-2 py-0.5 rounded text-sm">12</span>
                                    </div>
                                    <div className="flex items-center justify-between group cursor-pointer">
                                        <div className="flex items-center gap-3 text-gray-400 font-medium">
                                            <div className="p-2 rounded-lg bg-gray-800/50 text-green-500 flex items-center justify-center transition-transform group-hover:scale-110">
                                                <CheckCircleIcon className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm group-hover:text-white transition-colors">Active Collaborations</span>
                                        </div>
                                        <span className="text-white font-bold tabular-nums bg-green-500/10 px-2 py-0.5 rounded text-sm">4</span>
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="px-5 pb-5 mt-auto">
                                    <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 active:scale-95 transform">
                                        Open
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CREATORS TO WATCH CARD - Only show in Showcase section */}
                        {variant !== 'spotlight-collabs' && (
                            <div>
                                <div className="bg-invox-dark-accent rounded-xl border border-gray-800 mx-4 overflow-hidden flex flex-col shadow-2xl">
                                    <div className="flex items-center justify-between p-5 pb-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-white">Creators to Watch</h3>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-6 w-px bg-gray-800/50"></div>
                                            <button className="p-1 text-gray-400 hover:text-white transition-colors">
                                                <EllipsisVerticalIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-800 mx-5"></div>

                                    <div className="p-5 space-y-6">
                                        {creatorsToWatch.map((creator, index) => (
                                            <div key={index} className="flex items-start gap-4 group cursor-pointer">
                                                <div className="relative flex-shrink-0">
                                                    <img 
                                                        src={creator.avatarUrl} 
                                                        onError={handleImageError} 
                                                        alt={creator.name} 
                                                        className="w-12 h-12 rounded-lg object-cover border border-white/5 shadow-lg group-hover:scale-105 transition-transform duration-300" 
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                                                    <p className="font-semibold text-white text-base truncate">{creator.name}</p>
                                                    <p className="text-sm text-gray-400 truncate">{creator.domain}</p>
                                                    <p className="text-xs text-gray-500 font-medium truncate group-hover:whitespace-normal group-hover:break-words transition-all duration-300">
                                                        {creator.oneLine}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="px-5 pb-5 mt-auto">
                                        <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                                            View All
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <footer className="text-xs text-gray-500 space-x-2 px-4 mt-auto">
                            <a href="#" className="hover:underline">Terms of Service</a>
                            <a href="#" className="hover:underline">Privacy Policy</a>
                            <a href="#" className="hover:underline">About</a>
                            <span>© 2024 Invox Corp.</span>
                        </footer>
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
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-6 overflow-y-auto no-scrollbar">
                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Search by title, role..."
                        value={filters.searchTerm}
                        onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                        className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                    />
                </div>
                <div className="px-4">
                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg p-3 text-white font-semibold hover:bg-gray-700 transition-colors"
                    >
                        <FilterIcon className="w-5 h-5" />
                        <span>Filter Opportunities</span>
                    </button>
                </div>

                {/* Status Board */}
                <div>
                    <div className="px-4 mb-3">
                        <h3 className="font-bold text-lg text-white">Status Board</h3>
                    </div>
                    <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-3 mx-4">
                        <div className="space-y-2">
                            {statusTabs.map((tab) => (
                                <button
                                    key={tab.name}
                                    onClick={() => {
                                        if (tab.path && tab.path !== '#') {
                                            navigate(tab.path);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-3 text-left p-3 rounded-lg font-semibold transition-colors border ${
                                        location.pathname === tab.path
                                            ? 'bg-invox-red text-white border-invox-red hover:bg-invox-red-hover'
                                            : 'bg-invox-dark text-invox-light-gray border-transparent hover:bg-gray-700/50'
                                    }`}
                                >
                                    <tab.icon className="w-5 h-5" />
                                    <span>{tab.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Profile Strength */}
                <div>
                    <div className="px-4 mb-3">
                        <h3 className="font-bold text-lg text-white">Profile Strength</h3>
                    </div>
                    <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4 text-center">
                        <p className="font-semibold text-lg text-white">Intermediate</p>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 my-3">
                            <div className="bg-invox-red h-2.5 rounded-full" style={{width: '65%'}}></div>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Complete your profile to stand out to recruiters.</p>
                        <button className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-200">Enhance Profile</button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const MyCommunityCard: React.FC<{ community: MyCommunity }> = ({ community }) => (
    <div className="bg-invox-dark-accent p-3 rounded-lg flex items-center justify-between border border-gray-800 hover:bg-gray-800/50 cursor-pointer">
        <div className="flex items-center gap-3 overflow-hidden">
            <img src={community.avatarUrl} onError={handleImageError} alt={community.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            <div className="overflow-hidden">
                <p className="font-semibold text-white truncate">{community.name}</p>
                <p className="text-sm text-gray-400 truncate">{community.latestMessage}</p>
            </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 ml-2">
            <p className="text-xs text-invox-light-gray">{community.timestamp}</p>
            <div className="h-5 flex items-center justify-end">
                 {community.hasNotification && <span className="w-2.5 h-2.5 bg-invox-red rounded-full mt-1"></span>}
            </div>
        </div>
    </div>
);

const CommunitiesSidebar: React.FC<Pick<RightSidebarProps, 'communityFilters' | 'setCommunityFilters' | 'communityView' | 'setCommunityView'>> = ({ communityFilters, setCommunityFilters, communityView, setCommunityView }) => {
    const [loading, setLoading] = useState(false);
    const [myCommunitiesSearchTerm, setMyCommunitiesSearchTerm] = useState('');
    const [myCommunityDomains, setMyCommunityDomains] = useState<string[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    
    const [conferenceFilter, setConferenceFilter] = useState<'All' | 'Online' | 'Offline'>('All');
    const [hasNewConference, setHasNewConference] = useState(true); // Mock state for new conference notification
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

    const getBadgeColor = (type: 'Meetup' | 'Hackathon' | 'Talk') => {
      switch (type) {
        case 'Meetup': return 'bg-blue-500/20 text-blue-300';
        case 'Hackathon': return 'bg-purple-500/20 text-purple-300';
        case 'Talk': return 'bg-green-500/20 text-green-300';
        default: return 'bg-gray-700 text-gray-300';
      }
    };

    const showOtherElements = !isSearchFocused && communityFilters.searchTerm.trim() === '';

    return (
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-6">
                {communityView === 'my-communities' ? (
                     <>
                        <div className="px-4 space-y-4">
                             <div className="flex items-center justify-between">
                                <button onClick={() => setCommunityView('leaderboard')} className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                    <h3 className="font-bold text-lg text-white">My Communities</h3>
                                </button>
                            </div>
                            <DomainFilter
                                domains={communityPageDomains}
                                selectedDomains={myCommunityDomains}
                                onSelectionChange={setMyCommunityDomains}
                                buttonText="Filter by Domain"
                            />
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="search"
                                    placeholder="Search my communities..."
                                    value={myCommunitiesSearchTerm}
                                    onChange={(e) => setMyCommunitiesSearchTerm(e.target.value)}
                                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                                />
                            </div>
                        </div>
                        <div className="px-4 space-y-2 flex-1 overflow-y-auto no-scrollbar">
                            {loading ? (
                                <>
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                    <MyCommunityCardSkeleton />
                                </>
                            ) : filteredMyCommunities.length > 0 ? (
                                filteredMyCommunities.map(community => (
                                   <MyCommunityCard key={community.id} community={community} />
                                ))
                            ) : (
                                <p className="text-center text-gray-500 pt-8">No communities found.</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className='overflow-y-auto no-scrollbar flex flex-col gap-6'>
                        <div className="relative px-4">
                            <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="search"
                                placeholder="Search Communities or Domains"
                                value={communityFilters.searchTerm}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                onChange={(e) => setCommunityFilters(prev => ({...prev, searchTerm: e.target.value}))}
                                className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                            />
                        </div>

                        {showOtherElements && (
                            <div className="px-4 transition-all duration-300 space-y-6">
                                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4">
                                    <p className="text-sm text-gray-400 mb-4">Navigate between your personalized feed and the global community feed.</p>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setCommunityView('my-communities')}
                                            className="w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold bg-invox-dark text-gray-300 hover:bg-gray-700 transition-colors"
                                            title="Personalized community feed"
                                        >
                                            <BookmarkIcon className="w-5 h-5" />
                                            <span>My Communities</span>
                                        </button>
                                        <button
                                             onClick={() => setCommunityView('all')}
                                             className="w-full flex items-center gap-3 text-left p-3 rounded-md font-semibold bg-invox-dark text-gray-300 hover:bg-gray-700 transition-colors"
                                             title="Explore across all communities"
                                        >
                                            <GlobeAltIcon className="w-5 h-5" />
                                            <span>All Communities</span>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 h-[25rem] flex flex-col">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-white">Conference Notify</h3>
                                            {hasNewConference && (
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-invox-red opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-invox-red"></span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-6 w-px bg-gray-800"></div>
                                            <div className="relative" ref={conferenceFilterMenuRef}>
                                                <button onClick={() => setIsConferenceFilterMenuOpen(prev => !prev)} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors">
                                                    <EllipsisVerticalIcon className="w-5 h-5" />
                                                </button>
                                                {isConferenceFilterMenuOpen && (
                                                    <div className="absolute right-0 mt-2 w-32 bg-invox-dark rounded-lg shadow-lg z-10 py-1">
                                                        <ul>
                                                            {(['All', 'Online', 'Offline'] as const).map(filter => (
                                                                <li key={filter}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setConferenceFilter(filter);
                                                                            setIsConferenceFilterMenuOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${conferenceFilter === filter ? 'text-white font-semibold' : 'text-gray-300'}`}
                                                                    >
                                                                        {filter}
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="border-gray-800 my-4" />
                                    
                                    {/* Conference List */}
                                    <div className="space-y-5 flex-grow overflow-y-auto no-scrollbar">
                                        {filteredConferences.slice(0, 3).map(conf => (
                                            <div key={conf.id} className="flex items-start gap-4">
                                                <img src={conf.communityAvatarUrl} onError={handleImageError} alt={conf.communityName} className="w-12 h-12 rounded-lg object-cover" />
                                                <div className="flex-1 overflow-hidden space-y-1">
                                                    <p className="font-semibold text-white text-base truncate">{conf.title}</p>
                                                    <p className="text-sm text-gray-400">{conf.communityName}</p>
                                                    <p className="text-sm text-gray-500">{conf.date} at {conf.time} {conf.timezone}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer - Standardized View All button */}
                                    <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 mt-auto">
                                        View All
                                    </button>
                                </div>
                                
                                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 h-[25rem] flex flex-col">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-white">Event Notify</h3>
                                            {hasNewEvent && (
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-invox-red opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-invox-red"></span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-6 w-px bg-gray-800"></div>
                                            <div className="relative" ref={eventFilterMenuRef}>
                                                <button onClick={() => setIsEventFilterMenuOpen(prev => !prev)} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors">
                                                    <EllipsisVerticalIcon className="w-5 h-5" />
                                                </button>
                                                {isEventFilterMenuOpen && (
                                                    <div className="absolute right-0 mt-2 w-32 bg-invox-dark rounded-lg shadow-lg z-10 py-1">
                                                        <ul>
                                                            {(['All', 'Online', 'Offline'] as const).map(filter => (
                                                                <li key={filter}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEventFilter(filter);
                                                                            setIsEventFilterMenuOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${eventFilter === filter ? 'text-white font-semibold' : 'text-gray-300'}`}
                                                                    >
                                                                        {filter}
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="border-gray-800 my-4" />
                                    
                                    {/* Event List */}
                                    <div className="space-y-5 flex-grow overflow-y-auto no-scrollbar">
                                        {filteredEvents.slice(0, 3).map(event => (
                                            <div key={event.id} className="flex items-start gap-4">
                                                <img src={event.communityAvatarUrl} onError={handleImageError} alt={event.communityName} className="w-12 h-12 rounded-lg object-cover" />
                                                <div className="flex-1 overflow-hidden space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold text-white text-base truncate">{event.title}</p>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getBadgeColor(event.eventType)}`}>
                                                            {event.eventType}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-400">{event.communityName}</p>
                                                    <p className="text-sm text-gray-500">{event.date} at {event.time} {event.timezone}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer - Standardized View All button */}
                                    <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 mt-auto">
                                        View All
                                    </button>
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

    useEffect(() => {
        if (!isFilterOpen) {
            setFilterSearchTerm('');
        }
    }, [isFilterOpen]);

    const filteredConversations = conversations.filter(convo => {
        const filterMatch =
            filter === 'All' ||
            (filter === 'Unread' && convo.unreadCount > 0) ||
            (filter.toLowerCase().replace(/s$/, '') === convo.category);

        const searchMatch = convo.name.toLowerCase().includes(searchTerm.toLowerCase());

        return filterMatch && searchMatch;
    });

    const filteredOptions = filterOptionsWithIcons.filter(option =>
        option.name.toLowerCase().includes(filterSearchTerm.toLowerCase())
    );

    return (
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-4">
                <div className="flex items-center gap-2 px-4">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-invox-dark-accent" aria-label="Back to Hub main">
                        <ArrowLeftIcon className="w-6 h-6 text-white" />
                    </button>
                    <h2 className="text-xl font-bold text-white">Conversations</h2>
                </div>

                <div ref={filterRef} className="relative w-full px-4">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="group flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-left text-white bg-invox-dark-accent border border-gray-800 rounded-lg focus:outline-none transition-all duration-200"
                    >
                        <div className="flex items-center">
                            <span className="tracking-wider group-hover:tracking-widest transition-all duration-300 uppercase">
                                {filter === 'All' ? 'FILTERS' : filter}
                            </span>
                            <ChevronDownIcon className={`w-5 h-5 ml-2 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </button>
                    {isFilterOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-invox-dark-accent border border-gray-800 rounded-lg shadow-lg">
                            <div className="p-2">
                                <input
                                    type="search"
                                    placeholder="Search filters..."
                                    value={filterSearchTerm}
                                    onChange={e => setFilterSearchTerm(e.target.value)}
                                    className="w-full bg-invox-dark rounded p-2 focus:outline-none text-sm text-white"
                                />
                            </div>
                            <ul className="py-1 max-h-60 overflow-y-auto">
                                {filteredOptions.map(option => (
                                    <li key={option.name}>
                                        <button
                                            onClick={() => { setFilter(option.name); setIsFilterOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700/50 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <option.icon className="w-5 h-5 text-gray-400" />
                                                <span>{option.name}</span>
                                            </div>
                                            {filter === option.name && <CheckIcon className="w-5 h-5" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white"
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-2">
                    {filteredConversations.map(convo => {
                        const lastMessage = convo.messages[convo.messages.length - 1];
                        const lastMessageText = lastMessage?.text || (lastMessage ? `[${lastMessage.type}]` : 'No messages yet');
                        return (
                            <button 
                                key={convo.id}
                                onClick={() => setSelectedHubConversation && setSelectedHubConversation(convo)}
                                className="w-full text-left bg-invox-dark-accent p-3 rounded-lg flex items-center justify-between gap-3 border border-gray-800 hover:bg-gray-700 transition-all"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="relative flex-shrink-0">
                                        <img src={convo.avatarUrl} onError={handleImageError} alt={convo.name} className="w-12 h-12 rounded-full object-cover" />
                                        {convo.isGroup && <div className="absolute -bottom-1 -right-1 bg-blue-500 p-1 rounded-full border-2 border-invox-dark-accent"><UsersIcon className="w-3 h-3 text-white" /></div>}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-semibold text-white truncate">{convo.name}</p>
                                        <p className="text-sm text-gray-400 truncate">{lastMessageText}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0">
                                    <p className="text-xs text-invox-light-gray mb-1">{convo.timestamp}</p>
                                    {convo.unreadCount > 0 && (
                                        <span className="bg-invox-red text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
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
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-3 overflow-y-auto no-scrollbar">
                {hubView === 'stream' && (
                    <div className="flex items-center gap-2 px-4">
                        <button onClick={() => setHubView && setHubView('welcome')} className="p-2 rounded-full hover:bg-invox-dark-accent transition-colors" aria-label="Back to Global Collective">
                            <ArrowLeftIcon className="w-6 h-6 text-white" />
                        </button>
                        <h2 className="text-xl font-bold text-white">Stream</h2>
                    </div>
                )}

                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="search" placeholder="Search Hub" className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white" />
                </div>

                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-3 mx-4 shadow-sm">
                    <div className="space-y-2">
                        {hubNavItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => {
                                    if (item.action) item.action();
                                    else if (item.view && setHubView) setHubView(item.view);
                                }}
                                className={`w-full flex items-center gap-3 text-left p-3 rounded-lg font-semibold transition-colors border ${
                                    hubView === item.view ? 'bg-invox-red text-white border-invox-red' : 'bg-invox-dark text-invox-light-gray border-transparent hover:bg-gray-700/50 hover:text-white'
                                }`}
                            >
                                <item.icon className="w-5 h-5" />
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
        <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
            <div className="h-full flex flex-col gap-3 overflow-y-auto no-scrollbar">
                <div className="relative px-4">
                    <MagnifyingGlassIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="search" placeholder="Search My Space" className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-10 focus:outline-none text-white" />
                </div>

                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-3 mx-4 shadow-sm">
                    <div className="space-y-2">
                        {sidebarButtons.map((btn) => (
                            <ReactRouterDOM.Link
                                key={btn.name}
                                to={btn.path}
                                className="w-full flex items-center gap-3 text-left p-3 rounded-lg font-semibold transition-colors border border-transparent bg-invox-dark text-invox-light-gray hover:bg-gray-700/50 hover:text-white"
                            >
                                <btn.icon className="w-5 h-5" />
                                <span>{btn.name}</span>
                            </ReactRouterDOM.Link>
                        ))}
                    </div>
                </div>

                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mx-4 mt-3">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Quick Insights</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Profile Views</span>
                            <span className="text-white font-bold tabular-nums">1,204</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Post Reach</span>
                            <span className="text-green-400 font-bold tabular-nums">+12%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Connections</span>
                            <span className="text-white font-bold tabular-nums">842</span>
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
            
            <div className="relative w-full max-w-md bg-invox-dark-accent border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeInUp">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h3 className="text-xl font-bold text-white">Select destination</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                    {categories.map((category) => (
                        <div key={category.title}>
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">{category.title}</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {category.targets.map((target) => (
                                    <button
                                        key={target.name}
                                        onClick={() => {
                                            onSelect(target.context);
                                            onClose();
                                        }}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-invox-dark border border-transparent hover:border-invox-red/50 hover:bg-gray-800/50 transition-all group"
                                    >
                                        <div className="p-2.5 rounded-lg bg-gray-800 group-hover:bg-invox-red/10 transition-colors">
                                            <target.icon className="w-5 h-5 text-gray-300 group-hover:text-invox-red" />
                                        </div>
                                        <span className="font-semibold text-white text-lg">{target.name}</span>
                                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                            <CheckIcon className="w-5 h-5 text-invox-red" />
                                        </div>
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
            <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
                <div className="h-full flex flex-col gap-4">
                    <div className="px-4">
                        <button 
                            onClick={() => navigate('/myspace')} 
                            className="flex items-center gap-2 text-invox-light-gray hover:text-white transition-colors" 
                            aria-label="Back to My Space"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                            <h3 className="font-bold text-lg text-white">Uploads</h3>
                        </button>
                    </div>

                    <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-3 mx-4 shadow-sm">
                        <div className="space-y-2">
                            {creationItems.map((item) => (
                                <div key={item.name}>
                                    <button
                                        onClick={() => setIsTargetModalOpen(true)}
                                        className="w-full flex items-center gap-3 text-left p-3 rounded-lg font-semibold transition-colors border border-transparent bg-invox-dark text-invox-light-gray hover:bg-gray-700/50 hover:text-white"
                                    >
                                        <item.icon className="w-5 h-5" />
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
                     <aside className="hidden lg:block w-80 xl:w-[350px] flex-shrink-0 border-l border-gray-800 h-screen sticky top-0 py-6">
                        <div className="p-4 text-center text-gray-500">
                           <p>Contextual actions will appear here.</p>
                        </div>
                    </aside>
                );
        }
    };

    return renderSidebarContent();
};

export default RightSidebar;