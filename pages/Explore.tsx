
import React, { useState, useEffect } from 'react';
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
import {
    ClipboardListIcon,
    PresentationChartBarIcon,
    CodeBracketIcon,
    PencilSquareIcon,
    ChatIcon,
    CubeIcon
} from '../components/ui/Icons';

const mockPosts: Post[] = [
    {
        id: '1',
        author: { name: 'Galaxies', avatarUrl: 'https://picsum.photos/id/1/200/200', isVerified: true },
        aiSummary: "A mesmerizing view of the cosmos.",
        content: "Exploring the vastness of space, this stunning capture of a distant galaxy reminds us of the universe's beauty and mystery. Billions of stars, each a potential sun for other worlds.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Feed,
        category: 'Science',
        createdAt: new Date(),
    },
    {
        id: '2',
        author: { name: 'Albert Darwin', avatarUrl: 'https://picsum.photos/id/2/200/200', isVerified: true },
        aiSummary: "A thread on the world's largest forest.",
        content: "The Amazon isn't just a forest; it's the lungs of our planet. This thread dives into its incredible biodiversity, the indigenous communities that protect it, and the threats it faces.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Thread,
        category: 'Start Up',
        createdAt: new Date(),
        userCommented: true,
    },
    {
        id: '3',
        author: { name: 'Wozniak', avatarUrl: 'https://picsum.photos/id/3/200/200', isVerified: true },
        aiSummary: "Query: What will be the next true innovation?",
        content: "Beyond AI and blockchain, what emerging technology do you believe will fundamentally reshape our society in the next two decades? Share your most forward-thinking ideas.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1533758-542159882a88?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Query,
        category: 'Technology',
        createdAt: new Date(),
        userSharedInsight: true,
    },
    {
        id: '4',
        author: { name: 'TechCrunch', avatarUrl: 'https://picsum.photos/id/4/200/200', isVerified: true },
        aiSummary: "The Future of Quantum Computing is Now",
        content: "Exploring the latest breakthroughs in quantum supremacy and how it will revolutionize industries from medicine to finance. The implications are vast and the progress is accelerating.",
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 95000, views: 5000000, comments: 18000 },
        type: PostType.Feed,
        category: 'Technology',
        createdAt: new Date(),
    },
    {
        id: '5',
        author: { name: 'Sports Illustrated', avatarUrl: 'https://picsum.photos/id/5/200/200' },
        aiSummary: "Underdog Story: The Champion Nobody Saw Coming",
        content: "A deep dive into the incredible journey of the team that defied all odds. From rigorous training to their final victory, this is a story of perseverance and spirit.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217',
        stats: { likes: 120000, views: 8000000, comments: 25000 },
        type: PostType.Feed,
        category: 'Sports',
        createdAt: new Date(),
    },
    {
        id: '6',
        author: { name: 'Y Combinator', avatarUrl: 'https://picsum.photos/id/6/200/200', isVerified: true },
        aiSummary: "Building a Billion-Dollar Company from a Garage",
        content: "This thread breaks down the essential steps for aspiring entrepreneurs. From idea validation to securing your first round of funding, we cover it all. What are the key metrics you should be tracking?",
        mediaUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 250000, views: 15000000, comments: 40000 },
        type: PostType.Thread,
        category: 'Start Up',
        createdAt: new Date(),
    },
    {
        id: '7',
        author: { name: 'MusicNotes', avatarUrl: 'https://picsum.photos/id/7/200/200' },
        aiSummary: "What's the most influential album of the last decade?",
        content: "Looking for opinions from music lovers. Which album changed the game in terms of sound, production, or cultural impact? Drop your thoughts and justifications below.",
        mediaUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 45000, views: 2000000, comments: 8000 },
        type: PostType.Query,
        category: 'Music',
        createdAt: new Date(),
    },
    {
        id: '8',
        author: { name: 'Art Today', avatarUrl: 'https://picsum.photos/id/8/200/200', isVerified: true },
        aiSummary: "The Resurgence of Renaissance Techniques in Modern Art",
        content: "Contemporary artists are increasingly drawing inspiration from the old masters. This post explores how techniques like chiaroscuro and sfumato are being reinterpreted in the digital age.",
        mediaUrl: 'https://images.unsplash.com/photo-1547891654-e66ed7110189?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 78000, views: 3500000, comments: 12000 },
        type: PostType.Feed,
        category: 'Art',
        createdAt: new Date(),
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
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Feeds');
    const [activeCategory, setActiveCategory] = useState('All');
    const [discoverFilter, setDiscoverFilter] = useState('All');
    const { domainSelections, setDomainSelection } = useFilters();

    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        activityFilter: string | null;
        setActivityFilter: (filter: string | null) => void;
        refreshKey: number;
    }>();

    const { setRightSidebarVariant, activityFilter, setActivityFilter, refreshKey } = outletContext || {};


    useEffect(() => {
        setLoading(true);
        // Simulate fetching data
        const timer = setTimeout(() => {
            // Shuffle mock posts to simulate a refresh with new content
            setPosts([...mockPosts].sort(() => Math.random() - 0.5));
            setLoading(false);
        }, 1500);

        return () => clearTimeout(timer);
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
        if (!loading) { // Avoid scrolling on initial load if not desired
             document.querySelector('main')?.scrollTo(0, 0);
        }
    }, [activeTab, activeCategory, discoverFilter, activityFilter]);


    const filteredPosts = posts.filter(post => {
        // FIX: The activityFilter should be exclusive. If it's set, no other filters should apply.
        if (activityFilter) {
            if (activityFilter === 'threads') {
                return post.type === PostType.Thread && post.userCommented;
            }
            if (activityFilter === 'queries') {
                return post.type === PostType.Query && post.userSharedInsight;
            }
            return false; // Don't show any posts if there's an unknown activity filter
        }


        if (activeTab === 'Feeds') {
            const categoryMatch = activeCategory === 'All' || post.category === activeCategory;
            // FIX: Feeds should show only posts of type 'Feed'
            const typeMatch = post.type === PostType.Feed;
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

    return (
        <div className="p-4">
            {/* Conditional Header: Filters change based on active main tab */}
            {activeTab === 'Feeds' ? (
                <>
                    {/* Row 1: Category Buttons for Feeds */}
                    <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
                        {categoryFilters.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                    activeCategory === category
                                        ? 'bg-invox-red text-white'
                                        : 'bg-invox-dark-accent text-gray-300 hover:bg-gray-700'
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
                     <div className="flex space-x-2 border border-gray-800 rounded-lg p-1 bg-invox-dark-accent mb-4">
                        {discoverFilters.map(filter => (
                            <button 
                                key={filter}
                                onClick={() => setDiscoverFilter(filter)}
                                className={`flex-1 py-2 rounded-md transition-all duration-200 ${discoverFilter === filter ? 'bg-invox-red text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Main Tabs: Feeds/Discover */}
            <div className="flex border-b border-gray-800 mb-4">
                <button 
                    onClick={() => setActiveTab('Feeds')} 
                    className={`w-1/2 text-center py-3 font-semibold transition-all duration-200 transform hover:-translate-y-px ${activeTab === 'Feeds' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Feeds
                </button>
                <button 
                    onClick={() => setActiveTab('Discover')}
                    className={`w-1/2 text-center py-3 font-semibold transition-all duration-200 transform hover:-translate-y-px ${activeTab === 'Discover' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Discover
                </button>
            </div>

            {activityFilter && (
                <div className="bg-invox-dark-accent p-3 rounded-lg border border-gray-800 mb-4">
                    <h2 className="font-semibold text-white text-center">
                        {`Showing ${activityFilter === 'threads' ? "threads you've commented on" : "queries you've shared insights on"}`}
                    </h2>
                </div>
            )}

            <div>
                {loading ? (
                    <>
                        <FeedCardSkeleton />
                        <FeedCardSkeleton />
                        <FeedCardSkeleton />
                    </>
                ) : filteredPosts.length > 0 ? (
                    filteredPosts.map(post => {
                        if (post.type === PostType.Query) {
                            return (
                                // FIX: Wrapped the return in a standard React.Fragment with a key to avoid passing the key prop directly to ErrorBoundary, which can cause type mismatch issues when ErrorBoundaryProps doesn't explicitly include it.
                                <React.Fragment key={post.id}>
                                    <ErrorBoundary>
                                        <QueryCard post={post} />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        if (post.type === PostType.Thread) {
                             return (
                                // FIX: Wrapped the return in a standard React.Fragment with a key to avoid passing the key prop directly to ErrorBoundary, which can cause type mismatch issues when ErrorBoundaryProps doesn't explicitly include it.
                                <React.Fragment key={post.id}>
                                    <ErrorBoundary>
                                        <ThreadCard post={post} />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        return (
                            // FIX: Wrapped the return in a standard React.Fragment with a key to avoid passing the key prop directly to ErrorBoundary, which can cause type mismatch issues when ErrorBoundaryProps doesn't explicitly include it.
                            <React.Fragment key={post.id}>
                                <ErrorBoundary>
                                    <FeedCard post={post} />
                                </ErrorBoundary>
                            </React.Fragment>
                        );
                    })
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <p>No posts found for this filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExplorePage;
