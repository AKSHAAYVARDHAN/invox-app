import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { FeedCard } from '../components/feed/FeedCard';
import { QueryCard } from '../components/feed/QueryCard';
import { ThreadCard } from '../components/feed/ThreadCard';
import DomainFilter from '../components/ui/DomainFilter';
import type { Post } from '../types';
import { PostType } from '../types';
import ErrorBoundary from '../components/utils/ErrorBoundary';
import FeedCardSkeleton from '../components/feed/FeedCardSkeleton';
import { useFilters } from '../contexts/AIAssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToFeed, getUserLikedPostIds, getUserSavedPostIds, toggleLikePost, toggleBookmarkPost } from '../services/postService';
import {
    ClipboardListIcon,
    PresentationChartBarIcon,
    CodeBracketIcon,
    PencilSquareIcon,
    ChatIcon,
    CubeIcon
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
        category: 'Start Up',
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
        category: 'Sports',
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
        createdAt: new Date(Date.now() - 3600000 * 180),
    }
];

const categoryFilters = ['All', 'Technology', 'Start Up', 'Sports', 'Art', 'Music', 'Science', 'Health', 'Gaming', 'Finance', 'Food', 'Travel'];
const discoverFilters = ['All', 'Threads', 'Queries'];

const exploreDomains = [
    { name: 'Marketing', icon: ClipboardListIcon },
    { name: 'Sales', icon: PresentationChartBarIcon },
    { name: 'Development', icon: CodeBracketIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Content', icon: ChatIcon },
    { name: 'Product', icon: CubeIcon },
];

const ExplorePage = () => {
    const { currentUser } = useAuth();
    const [firestorePosts, setFirestorePosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Feeds');
    const [activeCategory, setActiveCategory] = useState('All');
    const [discoverFilter, setDiscoverFilter] = useState('All');
    const { domainSelections, setDomainSelection } = useFilters();
    const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        activityFilter: string | null;
        setActivityFilter: (filter: string | null) => void;
        refreshKey: number;
    }>();

    const { setRightSidebarVariant, activityFilter, setActivityFilter, refreshKey } = outletContext || {};

    // Load User interactions (likes and bookmarks)
    useEffect(() => {
        if (!currentUser?.uid) return;
        getUserLikedPostIds(currentUser.uid).then(setLikedPostIds).catch(console.warn);
        getUserSavedPostIds(currentUser.uid).then(setSavedPostIds).catch(console.warn);
    }, [currentUser?.uid]);

    // Real-time Firestore Feed Subscription
    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToFeed(
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

        return () => unsubscribe();
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
    }, [activeTab, activeCategory, discoverFilter, activityFilter, loading]);

    // Merge Firestore posts with baseline discovery items
    const combinedPosts = useMemo(() => {
        const firestoreIds = new Set(firestorePosts.map(p => p.id));
        const nonDuplicateMock = initialMockPosts.filter(p => !firestoreIds.has(p.id));
        return [...firestorePosts, ...nonDuplicateMock];
    }, [firestorePosts]);

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
        return combinedPosts.filter(post => {
            if (activityFilter) {
                if (activityFilter === 'threads') {
                    return post.type === PostType.Thread && post.userCommented;
                }
                if (activityFilter === 'queries') {
                    return post.type === PostType.Query && post.userSharedInsight;
                }
                return false;
            }

            if (activeTab === 'Feeds') {
                const categoryMatch = activeCategory === 'All' || 
                    post.category?.toLowerCase() === activeCategory.toLowerCase();
                const typeMatch = post.type === PostType.Feed || !post.type;
                return categoryMatch && typeMatch;
            }

            if (activeTab === 'Discover') {
                switch(discoverFilter) {
                    case 'All':
                        return post.type === PostType.Thread || post.type === PostType.Query;
                    case 'Threads':
                        return post.type === PostType.Thread;
                    case 'Queries':
                        return post.type === PostType.Query;
                    default:
                        return false;
                }
            }
            return false;
        });
    }, [combinedPosts, activityFilter, activeTab, activeCategory, discoverFilter]);

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
                        selectedDomains={domainSelections.explore || []}
                        onSelectionChange={(domains) => setDomainSelection('explore', domains)}
                    />
                </>
            ) : (
                <>
                    {/* Row 1: Domain Dropdown for Discover */}
                    <DomainFilter 
                        domains={exploreDomains}
                        selectedDomains={domainSelections.explore || []}
                        onSelectionChange={(domains) => setDomainSelection('explore', domains)}
                    />
                    {/* Row 2: Sub-filters for Discover */}
                     <div className="flex space-x-1 border border-zinc-800 bg-[#0c0c0e] p-1 mb-4">
                        {discoverFilters.map(filter => (
                            <button 
                                key={filter}
                                onClick={() => setDiscoverFilter(filter)}
                                className={`flex-1 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                                    discoverFilter === filter 
                                        ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </>
            )}

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
                    <div className="text-center py-16 border border-dashed border-zinc-800 bg-[#0c0c0e] p-8">
                        <p className="font-mono text-xs text-zinc-500 tracking-wider uppercase">// NO RECORDS FOUND FOR THIS FILTER</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExplorePage;
