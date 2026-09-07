import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { FeedCard } from '../components/feed/FeedCard';
import { QueryCard } from '../components/feed/QueryCard';
import { ThreadCard } from '../components/feed/ThreadCard';
import { PollCard } from '../components/feed/PollCard';
import DomainFilter from '../components/ui/DomainFilter';
import type { Post, Poll } from '../types';
import { PostType } from '../types';
import ErrorBoundary from '../components/utils/ErrorBoundary';
import FeedCardSkeleton from '../components/feed/FeedCardSkeleton';
import { useFilters } from '../contexts/AIAssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToFeed, getUserLikedPostIds, getUserSavedPostIds, toggleLikePost, toggleBookmarkPost } from '../services/postService';
import { subscribeToPolls } from '../services/pollService';
import { applyDomainAndSearchFilter, calculateContentCounts } from '../utils/domainFilter';
import { sortItemsByTrending } from '../utils/trendingScore';
import {
    CodeBracketIcon,
    GlobeAltIcon,
    BriefcaseIcon,
    FireIcon,
    PencilSquareIcon,
    SparklesIcon,
    ShieldCheckIcon,
    AcademicCapIcon,
    CurrencyDollarIcon,
    UsersIcon,
    MagnifyingGlassIcon,
    XMarkIcon
} from '../components/ui/Icons';

const initialMockPosts: Post[] = [
    {
        id: 'mock-1',
        author: { name: 'Galaxies', avatarUrl: 'https://picsum.photos/id/1/200/200', isVerified: true },
        aiSummary: "A mesmerizing view of the cosmos.",
        content: "Exploring the vastness of space, this stunning capture of a distant galaxy reminds us of the universe's beauty and mystery. Billions of stars, each a potential sun for other worlds.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Feed,
        category: 'Science',
        domain: 'Science',
        createdAt: new Date(Date.now() - 3600000 * 24),
    },
    {
        id: 'mock-2',
        author: { name: 'Albert Darwin', avatarUrl: 'https://picsum.photos/id/2/200/200', isVerified: true },
        aiSummary: "A thread on the world's largest forest.",
        content: "The Amazon isn't just a forest; it's the lungs of our planet. This thread dives into its incredible biodiversity, the indigenous communities that protect it, and the threats it faces.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Thread,
        category: 'Society',
        domain: 'Society & Ideas',
        createdAt: new Date(Date.now() - 3600000 * 48),
        userCommented: true,
    },
    {
        id: 'mock-3',
        author: { name: 'Wozniak', avatarUrl: 'https://picsum.photos/id/3/200/200', isVerified: true },
        aiSummary: "Query: What will be the next true innovation?",
        content: "Beyond AI and blockchain, what emerging technology do you believe will fundamentally reshape our society in the next two decades? Share your most forward-thinking ideas.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1533758-542159882a88?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Query,
        category: 'Technology',
        domain: 'Technology',
        createdAt: new Date(Date.now() - 3600000 * 72),
        userSharedInsight: true,
    },
    {
        id: 'mock-4',
        author: { name: 'TechCrunch', avatarUrl: 'https://picsum.photos/id/4/200/200', isVerified: true },
        aiSummary: "The Future of Quantum Computing is Now",
        content: "Exploring the latest breakthroughs in quantum supremacy and how it will revolutionize industries from medicine to finance. The implications are vast and the progress is accelerating.",
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 95000, views: 5000000, comments: 18000 },
        type: PostType.Feed,
        category: 'Technology',
        domain: 'Technology',
        createdAt: new Date(Date.now() - 3600000 * 96),
    },
    {
        id: 'mock-5',
        author: { name: 'Sports Illustrated', avatarUrl: 'https://picsum.photos/id/5/200/200' },
        aiSummary: "Underdog Story: The Champion Nobody Saw Coming",
        content: "A deep dive into the incredible journey of the team that defied all odds. From rigorous training to their final victory, this is a story of perseverance and spirit.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217',
        stats: { likes: 120000, views: 8000000, comments: 25000 },
        type: PostType.Feed,
        category: 'Health',
        domain: 'Health & Medicine',
        createdAt: new Date(Date.now() - 3600000 * 120),
    },
    {
        id: 'mock-6',
        author: { name: 'Y Combinator', avatarUrl: 'https://picsum.photos/id/6/200/200', isVerified: true },
        aiSummary: "Building a Billion-Dollar Company from a Garage",
        content: "This thread breaks down the essential steps for aspiring entrepreneurs. From idea validation to securing your first round of funding, we cover it all. What are the key metrics you should be tracking?",
        mediaUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 250000, views: 15000000, comments: 40000 },
        type: PostType.Thread,
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        createdAt: new Date(Date.now() - 3600000 * 140),
    },
    {
        id: 'mock-7',
        author: { name: 'MusicNotes', avatarUrl: 'https://picsum.photos/id/7/200/200' },
        aiSummary: "What's the most influential album of the last decade?",
        content: "Looking for opinions from music lovers. Which album changed the game in terms of sound, production, or cultural impact? Drop your thoughts and justifications below.",
        mediaUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 45000, views: 2000000, comments: 8000 },
        type: PostType.Query,
        category: 'Music',
        domain: 'Arts & Culture',
        createdAt: new Date(Date.now() - 3600000 * 160),
    },
    {
        id: 'mock-8',
        author: { name: 'Art Today', avatarUrl: 'https://picsum.photos/id/8/200/200', isVerified: true },
        aiSummary: "The Resurgence of Renaissance Techniques in Modern Art",
        content: "Contemporary artists are increasingly drawing inspiration from the old masters. This post explores how techniques like chiaroscuro and sfumato are being reinterpreted in the digital age.",
        mediaUrl: 'https://images.unsplash.com/photo-1547891654-e66ed7110189?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 78000, views: 3500000, comments: 12000 },
        type: PostType.Feed,
        category: 'Art',
        domain: 'Arts & Culture',
        createdAt: new Date(Date.now() - 3600000 * 180),
    },
    {
        id: 'mock-9',
        author: { name: 'SaaS Pulse', avatarUrl: 'https://picsum.photos/id/15/200/200', isVerified: true },
        aiSummary: "B2B Outbound Sales Playbook for High-ACV Software",
        content: "Breaking down how developer-focused software companies scale from $1M to $10M ARR. When should you hire your first forward-deployed engineer or technical account executive?",
        stats: { likes: 42100, views: 1800000, comments: 6400 },
        type: PostType.Thread,
        category: 'Business',
        domain: 'Business',
        createdAt: new Date(Date.now() - 3600000 * 36),
    },
    {
        id: 'mock-10',
        author: { name: 'Enterprise Hub', avatarUrl: 'https://picsum.photos/id/16/200/200', isVerified: true },
        aiSummary: "Query: PLG vs Enterprise Sales motions in 2026",
        content: "How is your engineering or revenue organization navigating the transition between product-led user acquisition and enterprise annual contract values?",
        stats: { likes: 31000, views: 1200000, comments: 4500 },
        type: PostType.Query,
        category: 'Finance',
        domain: 'Finance',
        createdAt: new Date(Date.now() - 3600000 * 60),
    },
    {
        id: 'mock-11',
        author: { name: 'DevRel Daily', avatarUrl: 'https://picsum.photos/id/17/200/200', isVerified: true },
        aiSummary: "Query: Developer marketing in the post-search era",
        content: "With generative engines summarizing technical documentation, how are developer relations and growth teams measuring technical audience mindshare?",
        stats: { likes: 58000, views: 2400000, comments: 7200 },
        type: PostType.Query,
        category: 'Education',
        domain: 'Education & Research',
        createdAt: new Date(Date.now() - 3600000 * 80),
    },
    {
        id: 'mock-12',
        author: { name: 'Product Forge', avatarUrl: 'https://picsum.photos/id/18/200/200', isVerified: true },
        aiSummary: "Query: Defining North Star metrics for autonomous background agents",
        content: "Traditional active user metrics fail when background agents execute operations without direct human clicks. What retention and velocity KPIs are product leaders adopting?",
        stats: { likes: 49000, views: 1950000, comments: 6100 },
        type: PostType.Query,
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        createdAt: new Date(Date.now() - 3600000 * 100),
    },
    {
        id: 'mock-13',
        author: { name: 'Figma Lab', avatarUrl: 'https://picsum.photos/id/19/200/200', isVerified: true },
        aiSummary: "Spatial UI design principles for next-generation canvas interfaces",
        content: "A detailed breakdown of optical hierarchy, contrast ratios, and spatial typography in canvas-first application design. How density and negative space define readability.",
        stats: { likes: 64000, views: 2800000, comments: 8900 },
        type: PostType.Thread,
        category: 'Design',
        domain: 'Design',
        createdAt: new Date(Date.now() - 3600000 * 110),
    }
];

const initialMockPolls: Poll[] = [
    {
        id: 'mock-poll-1',
        authorId: 'system-research',
        author: { name: 'Invox Research', avatarUrl: 'https://picsum.photos/id/10/200/200', isVerified: true },
        question: "Which LLM deployment architecture will dominate enterprise production by 2026?",
        description: "Evaluating balance between inference latency, data sovereignty constraints, and hardware CapEx.",
        options: [
            { id: 'opt-1', text: 'Hybrid Edge + Cloud Orchestration', voteCount: 142 },
            { id: 'opt-2', text: 'Fully Localized On-Premise SLMs', voteCount: 98 },
            { id: 'opt-3', text: 'Centralized Frontier APIs Only', voteCount: 46 },
            { id: 'opt-4', text: 'Decentralized P2P Inference Networks', voteCount: 29 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 12),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 6),
        duration: '7d',
        totalVotes: 315,
        status: 'active',
        category: 'Technology',
        domain: 'Technology',
        stats: { likes: 340, views: 12500, comments: 52 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-2',
        authorId: 'system-startup',
        author: { name: 'Venture Metrics', avatarUrl: 'https://picsum.photos/id/24/200/200', isVerified: true },
        question: "For early-stage startups in 2026: Bootstrap to profitability or accelerate with VC debt?",
        description: "Given the current cost of compute and seed valuation environment.",
        options: [
            { id: 'opt-1', text: 'Bootstrap to positive unit economics', voteCount: 218 },
            { id: 'opt-2', text: 'Aggressive Venture Seed Round', voteCount: 84 },
            { id: 'opt-3', text: 'Venture Debt + Grant Capital', voteCount: 41 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 40),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 3),
        duration: '7d',
        totalVotes: 343,
        status: 'active',
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        stats: { likes: 412, views: 18900, comments: 76 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-3',
        authorId: 'system-design',
        author: { name: 'Design Tokens Hub', avatarUrl: 'https://picsum.photos/id/25/200/200', isVerified: true },
        question: "Design systems in 2026: Token-driven automated sync vs Code-first headless components?",
        description: "Assessing workflow integration between product designers and frontend systems engineers.",
        options: [
            { id: 'opt-1', text: 'Token-driven automated Figma sync', voteCount: 165 },
            { id: 'opt-2', text: 'Code-first headless primitives', voteCount: 198 },
            { id: 'opt-3', text: 'AI-generated component variants', voteCount: 74 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 55),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 5),
        duration: '7d',
        totalVotes: 437,
        status: 'active',
        category: 'Design',
        domain: 'Design',
        stats: { likes: 289, views: 9800, comments: 41 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-4',
        authorId: 'system-education',
        author: { name: 'Academic Signal', avatarUrl: 'https://picsum.photos/id/26/200/200', isVerified: true },
        question: "Primary growth lever for technical research platforms in 2026?",
        description: "Evaluating open reproducibility and community citation networks.",
        options: [
            { id: 'opt-1', text: 'Open-access peer reproduction datasets', voteCount: 312 },
            { id: 'opt-2', text: 'Interactive runnable benchmark papers', voteCount: 220 },
            { id: 'opt-3', text: 'Decentralized preprint governance', voteCount: 145 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 70),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 4),
        duration: '7d',
        totalVotes: 677,
        status: 'active',
        category: 'Education',
        domain: 'Education & Research',
        stats: { likes: 512, views: 15400, comments: 63 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-5',
        authorId: 'system-finance',
        author: { name: 'Capital Matrix', avatarUrl: 'https://picsum.photos/id/27/200/200', isVerified: true },
        question: "Fintech treasury management: Multi-currency digital assets vs Centralized yield vaults?",
        description: "Evaluating corporate treasury diversification in modern high-interest regimes.",
        options: [
            { id: 'opt-1', text: 'Centralized Tier-1 yield vaults', voteCount: 280 },
            { id: 'opt-2', text: 'Multi-currency tokenized T-bills', voteCount: 195 },
            { id: 'opt-3', text: 'Autonomous algorithmic treasury hedging', voteCount: 110 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 85),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 6),
        duration: '7d',
        totalVotes: 585,
        status: 'active',
        category: 'Finance',
        domain: 'Finance',
        stats: { likes: 380, views: 11200, comments: 49 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-6',
        authorId: 'system-science',
        author: { name: 'Science Frontiers', avatarUrl: 'https://picsum.photos/id/28/200/200', isVerified: true },
        question: "Which medium best communicates breakthrough scientific discoveries to practitioners?",
        description: "Assessing interdisciplinary comprehension and knowledge transfer.",
        options: [
            { id: 'opt-1', text: 'Interactive data models + runnable simulations', voteCount: 340 },
            { id: 'opt-2', text: 'Condensed visual video walkthroughs', voteCount: 185 },
            { id: 'opt-3', text: 'Structured narrative whitepaper threads', voteCount: 215 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 95),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 5),
        duration: '7d',
        totalVotes: 740,
        status: 'active',
        category: 'Science',
        domain: 'Science',
        stats: { likes: 490, views: 16800, comments: 58 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-7',
        authorId: 'system-business',
        author: { name: 'Executive Operations', avatarUrl: 'https://picsum.photos/id/29/200/200', isVerified: true },
        question: "Enterprise operating model: Async-first distributed teams vs Synchronous campus hubs?",
        description: "Balancing velocity, institutional knowledge retention, and cross-functional focus.",
        options: [
            { id: 'opt-1', text: 'Async-first globally distributed', voteCount: 324 },
            { id: 'opt-2', text: 'Hybrid 3-day regional hubs', voteCount: 241 },
            { id: 'opt-3', text: 'Fully co-located headquarters', voteCount: 88 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 105),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 5),
        duration: '7d',
        totalVotes: 653,
        status: 'active',
        category: 'Business',
        domain: 'Business',
        stats: { likes: 375, views: 13200, comments: 44 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-8',
        authorId: 'system-health',
        author: { name: 'BioMetrics Lab', avatarUrl: 'https://picsum.photos/id/30/200/200', isVerified: true },
        question: "Next leap in preventative medicine: Continuous multi-analyte monitors vs Epigenetic age clocks?",
        description: "Assessing clinical utility and accessible preventive wellness technology.",
        options: [
            { id: 'opt-1', text: 'Continuous multi-analyte wearable sensors', voteCount: 412 },
            { id: 'opt-2', text: 'Longitudinal epigenetic methylation testing', voteCount: 198 },
            { id: 'opt-3', text: 'AI-driven full-body MRI diagnostics', voteCount: 231 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 115),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 6),
        duration: '7d',
        totalVotes: 841,
        status: 'active',
        category: 'Health',
        domain: 'Health & Medicine',
        stats: { likes: 462, views: 17400, comments: 68 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-9',
        authorId: 'system-arts',
        author: { name: 'Culture Nexus', avatarUrl: 'https://picsum.photos/id/31/200/200', isVerified: true },
        question: "Generative tools in cinematic and musical composition: Amplification or commoditization?",
        description: "Evaluating artistic authorship and creative expression in digital media.",
        options: [
            { id: 'opt-1', text: 'Empowering multiplier for solo creators', voteCount: 388 },
            { id: 'opt-2', text: 'Over-saturation of formulaic content', voteCount: 310 },
            { id: 'opt-3', text: 'New hybrid collaborative medium', voteCount: 245 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 125),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 4),
        duration: '7d',
        totalVotes: 943,
        status: 'active',
        category: 'Art',
        domain: 'Arts & Culture',
        stats: { likes: 528, views: 20100, comments: 85 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-10',
        authorId: 'system-society',
        author: { name: 'Civic Futures', avatarUrl: 'https://picsum.photos/id/32/200/200', isVerified: true },
        question: "Digital commons in 2026: Open interoperable protocols vs Platform-governed safety enclaves?",
        description: "How public discourse and digital freedom of information should be structured.",
        options: [
            { id: 'opt-1', text: 'Open decentralized verifiable protocols', voteCount: 460 },
            { id: 'opt-2', text: 'Curated safety-moderated networks', voteCount: 184 },
            { id: 'opt-3', text: 'Community-governed sovereign DAOs', voteCount: 219 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 135),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 7),
        duration: '7d',
        totalVotes: 863,
        status: 'active',
        category: 'Society',
        domain: 'Society & Ideas',
        stats: { likes: 590, views: 22800, comments: 92 },
        type: PostType.Poll,
    }
];

const categoryFilters = ['All', 'Technology', 'Start Up', 'Sports', 'Art', 'Music', 'Science', 'Health', 'Gaming', 'Finance', 'Food', 'Travel'];
const discoverFilters = ['All', 'Threads', 'Queries', 'Polls'];

const exploreDomains = [
    { name: 'Technology', icon: CodeBracketIcon },
    { name: 'Science', icon: GlobeAltIcon },
    { name: 'Business', icon: BriefcaseIcon },
    { name: 'Startups & Entrepreneurship', icon: FireIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Arts & Culture', icon: SparklesIcon },
    { name: 'Health & Medicine', icon: ShieldCheckIcon },
    { name: 'Education & Research', icon: AcademicCapIcon },
    { name: 'Finance', icon: CurrencyDollarIcon },
    { name: 'Society & Ideas', icon: UsersIcon },
];

const ExplorePage = () => {
    const { currentUser } = useAuth();
    const [firestorePosts, setFirestorePosts] = useState<Post[]>([]);
    const [firestorePolls, setFirestorePolls] = useState<Poll[]>([]);
    const [mockPolls, setMockPolls] = useState<Poll[]>(initialMockPolls);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Feeds');
    const [activeCategory, setActiveCategory] = useState('All');
    const [discoverFilter, setDiscoverFilter] = useState('All');
    const { domainSelections, setDomainSelection } = useFilters();
    const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    const [localSearch, setLocalSearch] = useState('');

    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const domainParam = searchParams.get('domain') || '';
    const tabParam = searchParams.get('tab') || '';
    const filterParam = searchParams.get('filter') || '';
    const trendingParam = searchParams.get('trending') === 'true';

    const [isTrending, setIsTrending] = useState(() => searchParams.get('trending') === 'true');

    // Synchronize trending state with URL parameter safely
    useEffect(() => {
        if (trendingParam !== isTrending) {
            setIsTrending(trendingParam);
        }
    }, [trendingParam]);

    const handleToggleTrending = useCallback(() => {
        setIsTrending(prev => {
            const next = !prev;
            const newParams = new URLSearchParams(searchParams);
            if (next) {
                newParams.set('trending', 'true');
            } else {
                newParams.delete('trending');
            }
            setSearchParams(newParams, { replace: true });
            return next;
        });
    }, [searchParams, setSearchParams]);

    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        activityFilter: string | null;
        setActivityFilter: (filter: string | null) => void;
        refreshKey: number;
        discoverSearchTerm?: string;
        setDiscoverSearchTerm?: (term: string) => void;
    }>();

    const { 
        setRightSidebarVariant, 
        activityFilter, 
        setActivityFilter, 
        refreshKey,
        discoverSearchTerm,
        setDiscoverSearchTerm
    } = outletContext || {};

    const activeSearch = (discoverSearchTerm !== undefined ? discoverSearchTerm : localSearch);

    const handleSearchChange = useCallback((val: string) => {
        setLocalSearch(val);
        setDiscoverSearchTerm?.(val);
    }, [setDiscoverSearchTerm]);

    // Synchronize domain filter with URL search params safely
    useEffect(() => {
        if (!domainParam) return;
        const domainsFromUrl = domainParam.split(',').map(s => s.trim()).filter(Boolean);
        const currentDomains = domainSelections.explore || [];
        const isSame = currentDomains.length === domainsFromUrl.length &&
            currentDomains.every((d, i) => d === domainsFromUrl[i]);
        if (!isSame && domainsFromUrl.length > 0) {
            setDomainSelection('explore', domainsFromUrl);
        }
    }, [domainParam, setDomainSelection, domainSelections.explore]);

    const activeDomains = useMemo(() => {
        return domainSelections.explore || [];
    }, [domainSelections.explore]);

    const handleDomainChange = useCallback((newDomains: string[]) => {
        setDomainSelection('explore', newDomains);
        const newParams = new URLSearchParams(searchParams);
        if (newDomains.length > 0) {
            newParams.set('domain', newDomains.join(','));
        } else {
            newParams.delete('domain');
        }
        setSearchParams(newParams, { replace: true });
    }, [searchParams, setSearchParams, setDomainSelection]);

    // Deep link query parameters handling safely
    useEffect(() => {
        if ((tabParam === 'Discover' || tabParam === 'Feeds') && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
        if (filterParam && discoverFilters.some(f => f.toLowerCase() === filterParam.toLowerCase())) {
            const matched = discoverFilters.find(f => f.toLowerCase() === filterParam.toLowerCase());
            if (matched && matched !== discoverFilter) {
                setDiscoverFilter(matched);
            }
        }
    }, [tabParam, filterParam, activeTab, discoverFilter]);

    // Load User interactions (likes and bookmarks)
    useEffect(() => {
        if (!currentUser?.uid) return;
        getUserLikedPostIds(currentUser.uid).then(setLikedPostIds).catch(console.warn);
        getUserSavedPostIds(currentUser.uid).then(setSavedPostIds).catch(console.warn);
    }, [currentUser?.uid]);

    // Real-time Firestore Feed Subscription
    useEffect(() => {
        setLoading(true);
        const unsubscribePosts = subscribeToFeed(
            { pageSize: 50 },
            (posts) => {
                setFirestorePosts(posts);
                setLoading(false);
            },
            (err) => {
                console.error('[EXPLORE_FEED_ERROR]', err);
                setLoading(false);
            }
        );

        const unsubscribePolls = subscribeToPolls(
            (polls) => {
                setFirestorePolls(polls);
            },
            (err) => {
                console.error('[EXPLORE_POLLS_ERROR]', err);
            }
        );

        return () => {
            unsubscribePosts();
            unsubscribePolls();
        };
    }, [refreshKey]);

    useEffect(() => {
        if (setRightSidebarVariant) {
            if (activeTab === 'Feeds') {
                setRightSidebarVariant('feeds');
            } else if (activeTab === 'Discover') {
                setRightSidebarVariant('discover');
            } else {
                setRightSidebarVariant('default');
            }
        }
        
        if (setActivityFilter) {
            setActivityFilter(null);
        }

        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
            if (setActivityFilter) {
                setActivityFilter(null);
            }
        };
    }, [activeTab, setRightSidebarVariant, setActivityFilter]);

    useEffect(() => {
        // Scroll to top whenever filters or tabs change
        if (!loading) {
             document.querySelector('main')?.scrollTo(0, 0);
        }
    }, [activeTab, activeCategory, discoverFilter, activityFilter, activeDomains, loading]);

    // Merge Firestore posts with baseline discovery items
    const combinedPosts = useMemo(() => {
        const firestoreIds = new Set(firestorePosts.map(p => p.id));
        const nonDuplicateMock = initialMockPosts.filter(p => !firestoreIds.has(p.id));
        return [...firestorePosts, ...nonDuplicateMock];
    }, [firestorePosts]);

    // Merge Firestore polls with baseline discovery polls
    const combinedPolls = useMemo(() => {
        const firestoreIds = new Set(firestorePolls.map(p => p.id));
        const nonDuplicateMock = mockPolls.filter(p => !firestoreIds.has(p.id));
        return [...firestorePolls, ...nonDuplicateMock];
    }, [firestorePolls, mockPolls]);

    // Step 1: Apply domain and search filters to combined posts and polls
    const domainFilteredPosts = useMemo(() => {
        return applyDomainAndSearchFilter(combinedPosts, activeDomains, activeSearch);
    }, [combinedPosts, activeDomains, activeSearch]);

    const domainFilteredPolls = useMemo(() => {
        return applyDomainAndSearchFilter(combinedPolls, activeDomains, activeSearch);
    }, [combinedPolls, activeDomains, activeSearch]);

    // Step 2: Calculate dynamic counts reflecting active domain filters
    const dynamicCounts = useMemo(() => {
        return calculateContentCounts(domainFilteredPosts, domainFilteredPolls);
    }, [domainFilteredPosts, domainFilteredPolls]);

    const handleToggleLike = useCallback(async (postId: string) => {
        if (!currentUser) return;
        try {
            const res = await toggleLikePost(postId);
            setLikedPostIds(prev => {
                const next = new Set(prev);
                if (res.liked) next.add(postId);
                else next.delete(postId);
                return next;
            });
        } catch (e) {
            console.error('Like action error:', e);
        }
    }, [currentUser]);

    const handleToggleBookmark = useCallback(async (postId: string) => {
        if (!currentUser) return;
        try {
            const res = await toggleBookmarkPost(postId);
            setSavedPostIds(prev => {
                const next = new Set(prev);
                if (res.saved) next.add(postId);
                else next.delete(postId);
                return next;
            });
        } catch (e) {
            console.error('Bookmark action error:', e);
        }
    }, [currentUser]);

    const filteredPosts = useMemo(() => {
        let result: (Post | Poll)[] = [];

        if (activeTab === 'Feeds') {
            result = domainFilteredPosts.filter(post => {
                if (activityFilter) {
                    if (activityFilter === 'threads') {
                        return post.type === PostType.Thread && post.userCommented;
                    }
                    if (activityFilter === 'queries') {
                        return post.type === PostType.Query && post.userSharedInsight;
                    }
                    return false;
                }
                const categoryMatch = activeCategory === 'All' || 
                    post.category?.toLowerCase() === activeCategory.toLowerCase();
                const typeMatch = post.type === PostType.Feed || !post.type;
                return categoryMatch && typeMatch;
            });
        } else if (activeTab === 'Discover') {
            if (activityFilter) {
                if (activityFilter === 'threads') {
                    result = domainFilteredPosts.filter(p => p.type === PostType.Thread && p.userCommented);
                } else if (activityFilter === 'queries') {
                    result = domainFilteredPosts.filter(p => p.type === PostType.Query && p.userSharedInsight);
                } else {
                    result = [];
                }
            } else {
                switch(discoverFilter) {
                    case 'All': {
                        const threadsAndQueries = domainFilteredPosts.filter(
                            post => post.type === PostType.Thread || post.type === PostType.Query
                        );
                        result = [...threadsAndQueries, ...domainFilteredPolls];
                        break;
                    }
                    case 'Threads':
                        result = domainFilteredPosts.filter(post => post.type === PostType.Thread);
                        break;
                    case 'Queries':
                        result = domainFilteredPosts.filter(post => post.type === PostType.Query);
                        break;
                    case 'Polls':
                        result = domainFilteredPolls;
                        break;
                    default:
                        result = [];
                        break;
                }
            }
        }

        // Apply Trending ranking if active, otherwise default chronological order
        if (isTrending) {
            return sortItemsByTrending(result);
        }

        return [...result].sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [domainFilteredPosts, domainFilteredPolls, activityFilter, activeTab, activeCategory, discoverFilter, isTrending]);

    return (
        <div className="py-2">
            {/* Conditional Header: Filters change based on active main tab */}
            {activeTab === 'Feeds' ? (
                <>
                    {/* Row 1: Category Buttons for Feeds */}
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-3 mb-3 no-scrollbar">
                        {categoryFilters.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                                    activeCategory === category
                                        ? 'bg-white text-black border-white font-bold'
                                        : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                    {/* Row 2: Domain Dropdown */}
                    <DomainFilter 
                        domains={exploreDomains}
                        selectedDomains={activeDomains}
                        onSelectionChange={handleDomainChange}
                        isTrending={isTrending}
                        onToggleTrending={handleToggleTrending}
                    />
                </>
            ) : (
                <>
                    {/* Row 1: Domain Dropdown for Discover */}
                    <DomainFilter 
                        domains={exploreDomains}
                        selectedDomains={activeDomains}
                        onSelectionChange={handleDomainChange}
                        isTrending={isTrending}
                        onToggleTrending={handleToggleTrending}
                    />
                    {/* Row 2: Sub-filters for Discover */}
                    <div className="flex space-x-1 border border-zinc-800 bg-[#0c0c0e] p-1 mb-3">
                        {discoverFilters.map(filter => (
                            <button 
                                key={filter}
                                onClick={() => setDiscoverFilter(filter)}
                                className={`flex-1 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${
                                    discoverFilter === filter 
                                        ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                                }`}
                            >
                                <span>{filter}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* In-page Keyword Search Input (Bi-directionally synced with right sidebar & mobile) */}
            <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                    type="search"
                    placeholder="SEARCH_CONTENT_BY_KEYWORD..."
                    value={activeSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-zinc-800 px-3.5 py-2 pl-9 pr-9 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
                {activeSearch && (
                    <button
                        type="button"
                        onClick={() => handleSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        aria-label="Clear search"
                    >
                        <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Main Tabs: Feeds/Discover */}
            <div className="flex border-b border-zinc-800 mb-5">
                <button 
                    onClick={() => setActiveTab('Feeds')} 
                    className={`w-1/2 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                        activeTab === 'Feeds' 
                            ? 'border-b-2 border-white text-white font-bold bg-zinc-900/20' 
                            : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                    }`}
                >
                    <span className="w-1.5 h-1.5 bg-white opacity-0 transition-opacity" style={{ opacity: activeTab === 'Feeds' ? 1 : 0 }}></span>
                    <span>// Feeds</span>
                </button>
                <button 
                    onClick={() => setActiveTab('Discover')}
                    className={`w-1/2 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                        activeTab === 'Discover' 
                            ? 'border-b-2 border-white text-white font-bold bg-zinc-900/20' 
                            : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                    }`}
                >
                    <span className="w-1.5 h-1.5 bg-white opacity-0 transition-opacity" style={{ opacity: activeTab === 'Discover' ? 1 : 0 }}></span>
                    <span>// Discover</span>
                </button>
            </div>

            {isTrending && (
                <div className="bg-[#0c0c0e] p-2.5 px-3 border border-zinc-800 mb-4 flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center gap-2">
                        <FireIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest">// MODE:</span>
                        <span className="text-white font-semibold tracking-wider uppercase text-[11px]">
                            TRENDING &bull; {activeDomains.length === 1 ? activeDomains[0] : activeDomains.length > 1 ? `${activeDomains.length} DOMAINS` : 'ALL DOMAINS'}
                        </span>
                        <span className="text-zinc-500 text-[10px] hidden sm:inline">
                            (Ranked by engagement)
                        </span>
                    </div>
                    <button 
                        type="button"
                        onClick={handleToggleTrending} 
                        className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase tracking-wider px-2 py-0.5 border border-zinc-800 hover:border-zinc-600 bg-black transition-colors"
                        title="Return to default feed order"
                    >
                        DEFAULT ORDER &times;
                    </button>
                </div>
            )}

            {activityFilter && (
                <div className="bg-[#0c0c0e] p-3 border border-zinc-800 mb-4 flex items-center justify-between">
                    <p className="font-mono text-xs text-zinc-300">
                        <span className="text-zinc-500">// ACTIVE_FILTER: </span>
                        {`Showing ${activityFilter === 'threads' ? "threads you've commented on" : "queries you've shared insights on"}`}
                    </p>
                    <button 
                        onClick={() => setActivityFilter?.(null)} 
                        className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase tracking-wider px-2 py-0.5 border border-zinc-800 hover:border-zinc-600"
                    >
                        Clear [ESC]
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {loading ? (
                    <>
                        <FeedCardSkeleton />
                        <FeedCardSkeleton />
                        <FeedCardSkeleton />
                    </>
                ) : filteredPosts.length > 0 ? (
                    filteredPosts.map(post => {
                        const isLiked = likedPostIds.has(post.id);
                        const isSaved = savedPostIds.has(post.id);

                        if ((post as any).type === PostType.Poll) {
                            return (
                                <React.Fragment key={post.id}>
                                    <ErrorBoundary>
                                        <PollCard 
                                            poll={post as any as Poll} 
                                            onDelete={(pollId) => {
                                                setFirestorePolls(prev => prev.filter(p => p.id !== pollId));
                                            }}
                                            onVoteChange={(pollId, optionId, updatedOptions, updatedTotalVotes) => {
                                                setFirestorePolls(prev => prev.map(p => p.id === pollId ? { ...p, options: updatedOptions, totalVotes: updatedTotalVotes, userVotedOptionId: optionId } : p));
                                                setMockPolls(prev => prev.map(p => p.id === pollId ? { ...p, options: updatedOptions, totalVotes: updatedTotalVotes, userVotedOptionId: optionId } : p));
                                            }}
                                        />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        if (post.type === PostType.Query) {
                            return (
                                <React.Fragment key={post.id}>
                                    <ErrorBoundary>
                                        <QueryCard post={post} />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        if (post.type === PostType.Thread) {
                            return (
                                <React.Fragment key={post.id}>
                                    <ErrorBoundary>
                                        <ThreadCard post={post} />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        return (
                            <React.Fragment key={post.id}>
                                <ErrorBoundary>
                                    <FeedCard 
                                        post={post} 
                                    />
                                </ErrorBoundary>
                            </React.Fragment>
                        );
                    })
                ) : (
                    <div className="text-center py-16 border border-dashed border-zinc-800 bg-[#0c0c0e] p-8 font-mono space-y-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// NO RESULTS</span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            {isTrending
                                ? `NO TRENDING TRANSMISSIONS FOUND FOR ${activeDomains.length === 1 ? `"${activeDomains[0].toUpperCase()}"` : activeDomains.length > 1 ? `${activeDomains.length} SELECTED DOMAINS` : 'THIS FILTER'}`
                                : activeDomains.length > 0 
                                    ? `NO TRANSMISSIONS FOUND FOR ${activeDomains.length === 1 ? `"${activeDomains[0].toUpperCase()}"` : `${activeDomains.length} SELECTED DOMAINS`}`
                                    : activeSearch 
                                        ? `NO TRANSMISSIONS MATCHING "${activeSearch.toUpperCase()}"`
                                        : 'NO RECORDS FOUND FOR THIS FILTER'}
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            {isTrending
                                ? 'No trending transmissions met the engagement threshold. Switch to default order to see latest items.'
                                : activeDomains.length > 0 
                                    ? 'No transmissions found for this domain selection. Clear the filter to explore everything.'
                                    : 'No matching transmissions found. Adjust your search or filters to see content.'}
                        </p>
                        {(activeDomains.length > 0 || activeSearch || isTrending) && (
                            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                                {isTrending && (
                                    <button
                                        type="button"
                                        onClick={handleToggleTrending}
                                        className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider font-mono flex items-center gap-1.5"
                                    >
                                        <FireIcon className="w-3.5 h-3.5 text-zinc-400" />
                                        Default Order
                                    </button>
                                )}
                                {activeDomains.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleDomainChange([])}
                                        className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider"
                                    >
                                        Clear Domain Filter
                                    </button>
                                )}
                                {activeSearch && (
                                    <button
                                        type="button"
                                        onClick={() => handleSearchChange('')}
                                        className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider"
                                    >
                                        Clear Search
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExplorePage;
