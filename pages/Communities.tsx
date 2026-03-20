
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Community } from '../types';
import { 
    StarIcon,
    UsersIcon,
    ShieldCheckIcon,
    FireIcon,
    CodeBracketIcon,
    PencilSquareIcon,
    BriefcaseIcon,
    SparklesIcon,
    ChatIcon,
    ForwardIcon,
    FilterIcon,
    ChevronDownIcon,
    ArrowLeftIcon
} from '../components/ui/Icons';
import DomainFilter from '../components/ui/DomainFilter';
import { handleImageError } from '../components/utils/imageUtils';
import MyCommunityCardSkeleton from '../components/communities/MyCommunityCardSkeleton';
import ComingSoonPage from './ComingSoon';

const mockCommunities: Community[] = [
    { id: 'startup-1', name: 'Startup Grind', description: 'Connect with founders, investors, and innovators in the startup ecosystem.', members: 25000, rating: 4.7, category: 'Startup', isVerified: true, avatarUrl: 'https://picsum.photos/seed/startup-grind/200' },
    { id: 'coding-4', name: 'Pythonic Geeks', description: 'From web dev with Django to data science with Pandas.', members: 18000, rating: 4.7, category: 'Coding', isVerified: true, avatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200' },
    { id: 'coding-3', name: 'JS Junkies', description: 'Everything JavaScript: frameworks, libraries, Node.js, and more.', members: 15000, rating: 4.8, category: 'Coding', isVerified: true, avatarUrl: 'https://picsum.photos/seed/js-junkies/200' },
    { id: 'design-1', name: 'UI/UX Guild', description: 'A community for designers to share work, get feedback, and discuss trends.', members: 14000, rating: 4.9, category: 'Design', isVerified: true, avatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200' },
    { id: 'business-1', name: 'Market Movers', description: 'Analyzing market trends, business strategies, and corporate news.', members: 13000, rating: 4.5, category: 'Business', isVerified: true, avatarUrl: 'https://picsum.photos/seed/market-movers/200' },
    { id: 'coding-1', name: 'CodeFrel Start', description: 'A community for beginner and intermediate coders to collaborate and grow.', members: 12000, rating: 4.6, category: 'Coding', avatarUrl: 'https://picsum.photos/seed/codefrel-start/200' },
    { id: 'design-4', name: 'Creative Canvas', description: 'A place for all creative designers to share their passion.', members: 11000, rating: 4.6, category: 'Design', avatarUrl: 'https://picsum.photos/seed/creative-canvas/200' },
    { id: 'business-3', name: 'Growth Hackers Inc.', description: 'Innovative strategies for rapid business growth.', members: 11500, rating: 4.8, category: 'Business', isVerified: true, avatarUrl: 'https://picsum.photos/seed/growth-hackers/200' },
    { id: 'ai-1', name: 'AI ClubTech', description: 'Here Comes The Description Of The Community Lorem Ipsum Dolor Sit Amet, Consectetur', members: 10000, rating: 4.5, category: 'Artificial Intelligence', isVerified: true, avatarUrl: 'https://picsum.photos/seed/ai-clubtech/200' },
    { id: 'coding-5', name: 'DevOps Den', description: 'CI/CD, Docker, Kubernetes, and all things DevOps.', members: 9500, rating: 4.6, category: 'Coding', avatarUrl: 'https://picsum.photos/seed/devops-den/200' },
    { id: 'ai-3', name: 'Data Mavericks', description: 'Deep dive into data science, analytics, and big data technologies.', members: 9200, rating: 4.7, category: 'Artificial Intelligence', avatarUrl: 'https://picsum.photos/seed/data-mavericks/200' },
    { id: 'business-2', name: 'Sales Superstars', description: 'Sharing tips, techniques, and success stories in sales.', members: 9000, rating: 4.7, category: 'Business', avatarUrl: 'https://picsum.photos/seed/sales-superstars/200' },
    { id: 'ai-2', name: 'ML Innovators', description: 'Exploring the frontiers of Machine Learning and deep learning applications.', members: 8500, rating: 4.8, category: 'Artificial Intelligence', isVerified: true, avatarUrl: 'https://picsum.photos/seed/ml-innovators/200' },
    { id: 'design-2', name: 'Pixel Perfect', description: 'For digital artists, illustrators, and graphic designers.', members: 8000, rating: 4.7, category: 'Design', avatarUrl: 'https://picsum.photos/seed/pixel-perfect/200' },
    { id: 'coding-2', name: 'Algo Wizards', description: 'Tackling complex algorithms and data structures. For the love of problem solving.', members: 7200, rating: 4.9, category: 'Coding', isVerified: true, avatarUrl: 'https://picsum.photos/seed/algo-wizards/200' },
    { id: 'ai-4', name: 'Neural Nets Hub', description: 'Discussing the latest in neural networks and AI research.', members: 6800, rating: 4.9, category: 'Artificial Intelligence', isVerified: true, avatarUrl: 'https://picsum.photos/seed/neural-nets-hub/200' },
    { id: 'design-3', name: 'Motion Masters', description: 'Animation, motion graphics, and everything that moves.', members: 6500, rating: 4.8, category: 'Design', isVerified: true, avatarUrl: 'https://picsum.photos/seed/motion-masters/200' },
    { id: 'startup-3', name: 'Venture Visionaries', description: 'Discussing venture capital, funding rounds, and startup strategy.', members: 6000, rating: 4.5, category: 'Startup', avatarUrl: 'https://picsum.photos/seed/venture-visionaries/200' },
    { id: 'idea-1', name: 'Idea Circle', description: 'A brainstorming hub to share, refine, and validate new ideas.', members: 5500, rating: 4.4, category: 'Idea Exchange', avatarUrl: 'https://picsum.photos/seed/idea-circle/200' },
    { id: 'idea-2', name: 'Innovate & Create', description: 'Where ideas take flight. Join us to build the future.', members: 4800, rating: 4.6, category: 'Idea Exchange', isVerified: true, avatarUrl: 'https://picsum.photos/seed/innovate-create/200' },
    { id: 'ai-5', name: 'Cognitive Coders', description: 'Where AI meets cognitive science. A place for deep discussions.', members: 4500, rating: 4.6, category: 'Artificial Intelligence', avatarUrl: 'https://picsum.photos/seed/cognitive-coders/200' },
    { id: 'startup-4', name: 'Bootstrapper Hub', description: 'For founders building businesses without venture capital.', members: 4200, rating: 4.8, category: 'Startup', isVerified: true, avatarUrl: 'https://picsum.photos/seed/bootstrapper-hub/200' },
    { id: 'idea-3', name: 'Concept Corner', description: 'A space for raw ideas and conceptual thinking.', members: 3200, rating: 4.3, category: 'Idea Exchange', avatarUrl: 'https://picsum.photos/seed/concept-corner/200' },
    { id: 'startup-2', name: 'Founder Circle', description: 'A private group for founders to share challenges and successes.', members: 3000, rating: 4.9, category: 'Startup', isVerified: true, avatarUrl: 'https://picsum.photos/seed/founder-circle/200' },
    { id: 'business-4', name: 'E-commerce Experts', description: 'Strategies for online retail success.', members: 2800, rating: 4.6, category: 'Business', avatarUrl: 'https://picsum.photos/seed/ecommerce-experts/200' },
    { id: 'design-5', name: '3D Artists Collective', description: 'Blender, Maya, ZBrush, and more.', members: 2700, rating: 4.9, category: 'Design', isVerified: true, avatarUrl: 'https://picsum.photos/seed/3d-artists/200' },
    { id: 'coding-6', name: 'Game Dev Guild', description: 'Unity, Unreal, and game development discussions.', members: 2600, rating: 4.8, category: 'Coding', isVerified: true, avatarUrl: 'https://picsum.photos/seed/game-dev-guild/200' },
    { id: 'startup-5', name: 'SaaS Builders', description: 'Building and scaling Software as a Service products.', members: 2500, rating: 4.7, category: 'Startup', avatarUrl: 'https://picsum.photos/seed/saas-builders/200' },
    { id: 'ai-6', name: 'Robotics & Automation', description: 'The future of intelligent machines.', members: 2400, rating: 4.6, category: 'Artificial Intelligence', avatarUrl: 'https://picsum.photos/seed/robotics-automation/200' },
    { id: 'business-5', name: 'Freelancer Alliance', description: 'Community for independent professionals.', members: 2300, rating: 4.5, category: 'Business', avatarUrl: 'https://picsum.photos/seed/freelancer-alliance/200' },
    { id: 'design-6', name: 'TypoGraphy Titans', description: 'For the love of fonts and lettering.', members: 2200, rating: 4.9, category: 'Design', avatarUrl: 'https://picsum.photos/seed/typography-titans/200' },
    { id: 'coding-7', name: 'Rustaceans', description: 'A community for developers using the Rust programming language.', members: 2100, rating: 4.9, category: 'Coding', isVerified: true, avatarUrl: 'https://picsum.photos/seed/rustaceans/200' },
    { id: 'idea-4', name: 'Side Project Heroes', description: 'Showcasing and getting feedback on side projects.', members: 2000, rating: 4.7, category: 'Idea Exchange', avatarUrl: 'https://picsum.photos/seed/side-project-heroes/200' },
    { id: 'startup-6', name: 'Pre-Seed Founders', description: 'For founders in the earliest stages of their journey.', members: 1900, rating: 4.6, category: 'Startup', avatarUrl: 'https://picsum.photos/seed/pre-seed-founders/200' },
    { id: 'startup-7', name: 'Eco Founders', description: 'Building sustainable and eco-friendly startups.', members: 1850, rating: 4.8, category: 'Startup', isVerified: true, avatarUrl: 'https://picsum.photos/seed/eco-founders/200' },
    { id: 'coding-8', name: 'WebAssembly Wizards', description: 'Exploring the future of web development with Wasm.', members: 1700, rating: 4.9, category: 'Coding', avatarUrl: 'https://picsum.photos/seed/wasm-wizards/200' },
    { id: 'design-7', name: 'AR/VR Designers', description: 'Designing immersive experiences for augmented and virtual reality.', members: 1650, rating: 4.8, category: 'Design', isVerified: true, avatarUrl: 'https://picsum.photos/seed/ar-vr-designers/200' },
    { id: 'business-6', name: 'Product Leaders', description: 'For product managers, strategists, and visionaries.', members: 1600, rating: 4.7, category: 'Business', avatarUrl: 'https://picsum.photos/seed/product-leaders/200' },
    { id: 'ai-7', name: 'NLP Circle', description: 'Natural Language Processing and conversational AI.', members: 1550, rating: 4.7, category: 'Artificial Intelligence', isVerified: true, avatarUrl: 'https://picsum.photos/seed/nlp-circle/200' },
    { id: 'idea-5', name: 'Future Thinkers', description: 'Discussing futurism, transhumanism, and long-term thinking.', members: 1500, rating: 4.6, category: 'Idea Exchange', avatarUrl: 'https://picsum.photos/seed/future-thinkers/200' },
    { id: 'coding-9', name: 'Go Gophers', description: 'A community for Go language enthusiasts.', members: 1450, rating: 4.8, category: 'Coding', isVerified: true, avatarUrl: 'https://picsum.photos/seed/go-gophers/200' },
    { id: 'startup-8', name: 'B2B SaaS Growth', description: 'Strategies for growing a business-to-business SaaS.', members: 1400, rating: 4.7, category: 'Startup', avatarUrl: 'https://picsum.photos/seed/b2b-saas-growth/200' },
    { id: 'design-8', name: 'Inclusive Design', description: 'Making technology accessible to everyone.', members: 1350, rating: 4.9, category: 'Design', isVerified: true, avatarUrl: 'https://picsum.photos/seed/inclusive-design/200' },
    { id: 'business-7', name: 'Remote Work Pros', description: 'Tips and tricks for thriving in a remote work environment.', members: 1300, rating: 4.6, category: 'Business', avatarUrl: 'https://picsum.photos/seed/remote-work-pros/200' },
    { id: 'ai-8', name: 'Computer Visionaries', description: 'Exploring image recognition, object detection, and more.', members: 1250, rating: 4.8, category: 'Artificial Intelligence', avatarUrl: 'https://picsum.photos/seed/computer-visionaries/200' },
    { id: 'coding-10', name: 'Mobile Devs Unite', description: 'iOS, Android, React Native, and Flutter development.', members: 1200, rating: 4.7, category: 'Coding', avatarUrl: 'https://picsum.photos/seed/mobile-devs-unite/200' },
    { id: 'startup-9', name: 'Fintech Founders', description: 'Disrupting the world of finance.', members: 1150, rating: 4.7, category: 'Startup', isVerified: true, avatarUrl: 'https://picsum.photos/seed/fintech-founders/200' },
    { id: 'design-9', name: 'Design Systems Hub', description: 'Building and maintaining scalable design systems.', members: 1100, rating: 4.8, category: 'Design', avatarUrl: 'https://picsum.photos/seed/design-systems-hub/200' },
    { id: 'business-8', name: 'Agile & Scrum Masters', description: 'Mastering agile methodologies for project management.', members: 1050, rating: 4.6, category: 'Business', avatarUrl: 'https://picsum.photos/seed/agile-scrum-masters/200' },
    { id: 'ai-9', name: 'AI Ethics', description: 'Discussing the ethical implications of artificial intelligence.', members: 1000, rating: 4.9, category: 'Artificial Intelligence', isVerified: true, avatarUrl: 'https://picsum.photos/seed/ai-ethics/200' },
    { id: 'coding-11', name: 'Frontend Frameworks', description: 'React, Vue, Svelte, and the future of the frontend.', members: 950, rating: 4.7, category: 'Coding', avatarUrl: 'https://picsum.photos/seed/frontend-frameworks/200' },
    { id: 'startup-10', name: 'EdTech Innovators', description: 'Transforming education with technology.', members: 900, rating: 4.8, category: 'Startup', avatarUrl: 'https://picsum.photos/seed/edtech-innovators/200' },
    { id: 'design-10', name: 'Data Visualization', description: 'Telling stories with data through beautiful visualizations.', members: 850, rating: 4.9, category: 'Design', isVerified: true, avatarUrl: 'https://picsum.photos/seed/data-visualization/200' },
    { id: 'business-9', name: 'Marketing Masters', description: 'The latest trends in digital marketing and advertising.', members: 800, rating: 4.6, category: 'Business', avatarUrl: 'https://picsum.photos/seed/marketing-masters/200' },
];

const communityPageDomains = [
    { name: 'Startup', icon: FireIcon },
    { name: 'Coding', icon: CodeBracketIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Business', icon: BriefcaseIcon },
    { name: 'Artificial Intelligence', icon: SparklesIcon },
    { name: 'Idea Exchange', icon: ChatIcon },
];

const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num;
};

const PodiumCard = ({ community, rank }: { community: Community, rank?: number }) => {
    const cardStyle = "border-gray-800 shadow-lg";

    return (
        <div className={`relative bg-invox-dark-accent p-4 rounded-lg border-2 ${cardStyle} transition-all duration-300 mb-4`}>
             {rank && (
                <div className="absolute top-2 right-4 text-4xl font-black text-white/10">
                    #{rank}
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {community.avatarUrl ? (
                        <img src={community.avatarUrl} onError={handleImageError} alt={community.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-invox-dark flex items-center justify-center">
                           <UsersIcon className="w-6 h-6 text-gray-400" />
                        </div>
                    )}
                    <div>
                        <p className="font-bold text-white flex items-center gap-1.5">{community.name} {community.isVerified && <ShieldCheckIcon className="w-4 h-4 text-blue-400" />}</p>
                        <p className="text-sm text-gray-500">@{community.name.toLowerCase().replace(/\s+/g, '')}</p>
                    </div>
                </div>
            </div>
            <hr className="my-4 border-gray-800" />
            <div className="flex justify-between items-center text-sm">
                <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold">Members</p>
                    <p className="font-bold text-white text-lg">{formatNumber(community.members)}</p>
                </div>
                <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold">Rating</p>
                    <p className="font-bold text-white text-lg flex items-center gap-1">{community.rating.toFixed(1)} <StarIcon className="w-4 h-4 text-yellow-400" /></p>
                </div>
                 <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold">Category</p>
                    <p className="font-bold text-white text-lg">{community.category}</p>
                </div>
            </div>
             <div className="mt-4">
                <button className="w-full bg-invox-dark text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                    Join
                </button>
            </div>
        </div>
    );
};

const CommunitySuggestionCard: React.FC<{ community: Community }> = ({ community }) => {
    return (
        <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 w-96 flex-shrink-0 flex flex-col h-full min-h-[12rem]">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    {community.avatarUrl ? (
                        <img src={community.avatarUrl} onError={handleImageError} alt={community.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-invox-dark flex items-center justify-center border border-gray-800">
                            <UsersIcon className="w-6 h-6 text-gray-400" />
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-lg">{community.name}</p>
                        {community.isVerified && <ShieldCheckIcon className="w-5 h-5 text-blue-500" />}
                    </div>
                </div>
                <button className="bg-invox-dark text-white px-6 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-700 self-start transition-all transform hover:scale-105 active:scale-95">
                    Join
                </button>
            </div>
            <div className="flex-grow">
                <p className="text-sm text-invox-light-gray line-clamp-2">{community.description}</p>
            </div>
            <div className="mt-auto">
                <hr className="border-gray-800 mb-3" />
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-white">
                        Members : <span className="text-yellow-400">{formatNumber(community.members)}</span>
                    </p>
                    <div className="flex items-center gap-1">
                        <StarIcon className="w-5 h-5 text-yellow-400" />
                        <span className="font-bold text-white">{community.rating.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CommunitySearchResultSkeleton = () => (
    <div className="bg-invox-dark-accent p-4 rounded-lg border-2 border-gray-800 animate-pulse mb-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700"></div>
            <div>
                <div className="h-5 w-32 bg-gray-700 rounded"></div>
                <div className="h-4 w-24 bg-gray-700 rounded mt-2"></div>
            </div>
        </div>
        <hr className="my-4 border-gray-800" />
        <div className="flex justify-between items-center">
            <div className="h-6 w-20 bg-gray-700 rounded"></div>
            <div className="h-6 w-20 bg-gray-700 rounded"></div>
            <div className="h-6 w-20 bg-gray-700 rounded"></div>
        </div>
        <div className="mt-4 h-9 w-full bg-gray-700 rounded-lg"></div>
    </div>
);


const CommunitiesPage = () => {
    const [loading, setLoading] = useState(true);
    const [activeTimeframe, setActiveTimeframe] = useState<'All Time' | 'Daily' | 'Weekly' | 'Monthly'>('Daily');
    const [visibleCount, setVisibleCount] = useState(10);
    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        communityFilters: { searchTerm: string; domains: string[] };
        setCommunityFilters: (filters: React.SetStateAction<{ searchTerm: string; domains: string[] }>) => void;
        communityView: string;
        setCommunityView: (view: string) => void;
    }>();

    const { setRightSidebarVariant, communityFilters, setCommunityFilters, communityView, setCommunityView } = outletContext || {};

    
    // Refs for smooth scrolling
    const leaderboardItemsContainerRef = useRef<HTMLDivElement>(null);
    const previousVisibleCountRef = useRef(visibleCount);

     useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('communities');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
        };
    }, [setRightSidebarVariant]);

    useEffect(() => {
        setLoading(true);
        setVisibleCount(10); // Reset count on filter change
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    }, [activeTimeframe, communityFilters]);

    useEffect(() => {
        // This effect handles the smooth scroll animation when "Load More" or "View Less" is clicked.
        if (!leaderboardItemsContainerRef.current) return;
        const items = leaderboardItemsContainerRef.current.children;

        // "Load More" was clicked
        if (visibleCount > previousVisibleCountRef.current) {
            const firstNewItem = items[previousVisibleCountRef.current] as HTMLElement;
            if (firstNewItem) {
                requestAnimationFrame(() => {
                    firstNewItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            }
        } 
        // "View Less" was clicked
        else if (visibleCount < previousVisibleCountRef.current) {
            const lastItem = items[items.length - 1] as HTMLElement;
            if (lastItem) {
                 requestAnimationFrame(() => {
                    lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            }
        }

        previousVisibleCountRef.current = visibleCount;
    }, [visibleCount]);


    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    const handleViewLess = () => {
        setVisibleCount(prev => Math.max(10, prev - 10));
    };

    const handleBackToLeaderboard = () => {
        if (setCommunityFilters) {
            setCommunityFilters(prev => ({ ...prev, searchTerm: '' }));
        }
    };

    const isSearchView = communityFilters && communityFilters.searchTerm.trim() !== '';

    if (isSearchView) {
        let searchResults: Community[] = [];
        let searchResultTitle = '';
        const searchTermLower = communityFilters.searchTerm.toLowerCase();
        
        // Check if search term is a domain name (exact match)
        const matchingDomain = communityPageDomains.find(
            domain => domain.name.toLowerCase() === searchTermLower
        );
    
        if (matchingDomain) {
            // Filter by domain/category
            searchResults = mockCommunities.filter(
                community => community.category.toLowerCase() === searchTermLower
            );
            searchResultTitle = `Showing communities in the "${matchingDomain.name}" domain`;
        } else {
            // Filter by community name (partial match)
            searchResults = mockCommunities.filter(community =>
                community.name.toLowerCase().includes(searchTermLower)
            );
            searchResultTitle = `Based on your search for "${communityFilters.searchTerm}"`;
        }

        return (
            <div>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={handleBackToLeaderboard} className="text-invox-light-gray hover:text-white p-1 rounded-full hover:bg-invox-dark-accent transition-colors" aria-label="Back to communities">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <h1 className="text-2xl font-bold text-white">
                            {searchResultTitle}
                        </h1>
                    </div>
                    {matchingDomain && (
                        <button className="flex-shrink-0 flex items-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg px-4 py-2 text-sm text-white font-semibold hover:bg-gray-700 transition-all duration-200">
                            <FilterIcon className="w-5 h-5 text-gray-400" />
                            <span>Filter by</span>
                            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        </button>
                    )}
                </div>
                <hr className="border-gray-800 my-4" />

                {loading ? (
                    <div className="space-y-4">
                        <CommunitySearchResultSkeleton />
                        <CommunitySearchResultSkeleton />
                    </div>
                ) : searchResults.length > 0 ? (
                    <div>
                        {searchResults.map(community => (
                            <React.Fragment key={community.id}>
                                <PodiumCard community={community} />
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <p>No communities found matching your search.</p>
                    </div>
                )}
            </div>
        );
    }

    if (communityView === 'all') {
        return <ComingSoonPage pageName="All Communities" />;
    }

    if (communityView === 'my-communities') {
        return <ComingSoonPage pageName="My Communities" />;
    }

    const sortedCommunities = mockCommunities
        .filter(community => {
            const domainMatch = communityFilters.domains.length === 0 || communityFilters.domains.includes(community.category);
            return domainMatch;
        })
        .sort((a, b) => b.members - a.members);

    const topThree = sortedCommunities.slice(0, 3);
    const restOfLeaderboard = sortedCommunities.slice(3);

    const suggestionData = [
        {
            category: 'For Coders',
            communities: mockCommunities.filter(c => c.category === 'Coding').slice(0, 5),
        },
        {
            category: 'For Designers',
            communities: mockCommunities.filter(c => c.category === 'Design').slice(0, 5),
        },
        {
            category: 'For Entrepreneurs',
            communities: mockCommunities.filter(c => c.category === 'Startup').slice(0, 5),
        },
        {
            category: 'For AI Enthusiasts',
            communities: mockCommunities.filter(c => c.category === 'Artificial Intelligence').slice(0, 5),
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white">Leaderboard</h1>
                    <p className="text-gray-400 mt-1">Top communities on the platform</p>
                </div>
                <div className="inline-flex bg-invox-dark-accent p-1 rounded-lg border border-gray-800 space-x-1">
                    <button onClick={() => setActiveTimeframe('All Time')} className={`px-4 py-2 text-sm rounded-md font-semibold transition-colors duration-200 ${activeTimeframe === 'All Time' ? 'bg-invox-dark text-white' : 'text-gray-400 hover:bg-gray-800'}`}>All Time</button>
                    <button onClick={() => setActiveTimeframe('Daily')} className={`px-4 py-2 text-sm rounded-md font-semibold transition-colors duration-200 ${activeTimeframe === 'Daily' ? 'bg-invox-dark text-white' : 'text-gray-400 hover:bg-gray-800'}`}>Daily</button>
                    <button onClick={() => setActiveTimeframe('Weekly')} className={`px-4 py-2 text-sm rounded-md font-semibold transition-colors duration-200 ${activeTimeframe === 'Weekly' ? 'bg-invox-dark text-white' : 'text-gray-400 hover:bg-gray-800'}`}>Weekly</button>
                    <button onClick={() => setActiveTimeframe('Monthly')} className={`px-4 py-2 text-sm rounded-md font-semibold transition-colors duration-200 ${activeTimeframe === 'Monthly' ? 'bg-invox-dark text-white' : 'text-gray-400 hover:bg-gray-800'}`}>Monthly</button>
                </div>
            </div>

            <hr className="border-gray-800" />
            
            <DomainFilter
                buttonText="Filter Leaderboard by Domain"
                domains={communityPageDomains}
                selectedDomains={communityFilters?.domains || []}
                onSelectionChange={(newDomains) => {
                    if (setCommunityFilters) {
                        setCommunityFilters(prev => ({ ...prev, domains: newDomains }));
                    }
                }}
            />

            {/* Podium Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {topThree[1] && <PodiumCard community={topThree[1]} rank={2} />}
                {topThree[0] && <div className="lg:scale-110 z-10"><PodiumCard community={topThree[0]} rank={1} /></div>}
                {topThree[2] && <PodiumCard community={topThree[2]} rank={3} />}
            </div>
            
            {/* Full Leaderboard Table */}
            <div className="bg-invox-dark-accent backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden">
                <div className="grid grid-cols-12 items-center text-gray-400 font-semibold uppercase text-xs border-b border-gray-800 px-4 py-3">
                    <div className="col-span-1 text-left">Rank</div>
                    <div className="col-span-6 text-left">Community</div>
                    <div className="col-span-2 text-center">Members</div>
                    <div className="col-span-3 text-right">Rating</div>
                </div>
                <div ref={leaderboardItemsContainerRef} className="divide-y divide-gray-800">
                    {restOfLeaderboard.slice(0, visibleCount).map((community, index) => (
                         <div 
                            key={community.id} 
                            className="grid grid-cols-12 items-center py-3 px-4 hover:bg-invox-dark/30 transition-colors duration-200"
                        >
                            <div className="col-span-1 text-left font-bold text-lg text-gray-400">{index + 4}</div>
                            <div className="col-span-6 text-left">
                                <div className="flex items-center gap-3">
                                    {community.avatarUrl ? (
                                        <img src={community.avatarUrl} onError={handleImageError} alt={community.name} className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-invox-dark flex items-center justify-center">
                                            <UsersIcon className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-white flex items-center gap-1.5">{community.name} {community.isVerified && <ShieldCheckIcon className="w-4 h-4 text-blue-400" />}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-2 text-center font-semibold text-white">{formatNumber(community.members)}</div>
                            <div className="col-span-3 text-right font-semibold text-white flex items-center justify-end gap-1">
                                {community.rating.toFixed(1)} <StarIcon className="w-4 h-4 text-yellow-400" />
                            </div>
                        </div>
                    ))}
                </div>
                 {(visibleCount < restOfLeaderboard.length || visibleCount > 10) && (
                    <div className="p-4 text-center flex justify-center items-center gap-4">
                        {visibleCount > 10 && (
                             <button 
                                onClick={handleViewLess} 
                                className="bg-invox-dark text-white font-semibold py-2 px-6 rounded-lg hover:bg-gray-700 hover:bg-opacity-70 transition-colors"
                            >
                                View Less
                            </button>
                        )}
                        {visibleCount < restOfLeaderboard.length && (
                            <button 
                                onClick={handleLoadMore} 
                                className="bg-invox-red text-white font-semibold py-2 px-6 rounded-lg hover:bg-invox-red-hover transition-colors"
                            >
                                Load More
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Suggestions Section */}
            <div className="space-y-8 mt-12">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Suggestions</h2>
                    <button className="flex items-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg px-4 py-2 text-sm text-white font-semibold hover:bg-gray-700 transition-all duration-200">
                        <FilterIcon className="w-5 h-5 text-gray-400" />
                        <span>Filter by</span>
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                {suggestionData.map(categoryData => (
                  <div key={categoryData.category} className="mb-6">
                    <h3 className="text-lg font-semibold text-invox-light-gray mb-3 border-b border-gray-800 pb-2">{categoryData.category}</h3>
                    <div className="flex overflow-x-auto space-x-4 pb-2 no-scrollbar items-stretch">
                      {categoryData.communities.map(community => (
                        <CommunitySuggestionCard key={community.id} community={community} />
                      ))}
                       <button className="flex-shrink-0 w-40 h-auto bg-invox-dark-accent border border-gray-800 rounded-lg flex flex-col items-center justify-center text-invox-light-gray hover:bg-gray-700 hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-95">
                          <ForwardIcon className="w-8 h-8 mb-2" />
                          <span className="font-semibold">Load More</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
        </div>
    );
};

export default CommunitiesPage;
