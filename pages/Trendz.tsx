import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Trend } from '../types';
import DomainFilter from '../components/ui/DomainFilter';
import TrendzCard from '../components/trendz/TrendzCard';
import TrendzDetail from '../components/trendz/TrendzDetail';
import TrendzCardSkeleton from '../components/trendz/TrendzCardSkeleton';
import { 
    ShieldCheckIcon, 
    CodeBracketIcon, 
    PresentationChartBarIcon,
    PencilSquareIcon,
    CurrencyDollarIcon,
    AcademicCapIcon,
    CubeIcon,
    PencilIcon,
    WrenchScrewdriverIcon,
    GlobeAltIcon
} from '../components/ui/Icons';
import { useFilters } from '../contexts/AIAssistantContext';

const mockTrends: Trend[] = [
    {
        id: '8',
        domain: { name: 'Technology', icon: CodeBracketIcon, isFollowed: true },
        title: "AI-Driven Cinematography: The Next Film Revolution",
        summary: "Discover how artificial intelligence is transforming filmmaking, from automated editing to generating entire scenes. This video showcases the cutting-edge tools changing Hollywood.",
        fullContent: "The film industry is on the brink of a new revolution, powered by artificial intelligence. Sophisticated AI algorithms are now capable of analyzing scripts to predict box office success, automating tedious editing processes, and even generating photorealistic scenes and characters. This trend explores how AI-driven cinematography and virtual production are enabling filmmakers to bring their most ambitious visions to life, while also raising questions about the future of creativity in an automated world.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
        mediaOverlayUrl: '',
        stats: { likes: 130000, views: 72000000, comments: 28000 },
        details: {
            publishedBy: 'CineTech AI',
            publishedOn: '12-03-2025',
            link: 'https://x.com/Invox'
        },
        createdAt: new Date(),
    },
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
        domain: { name: 'Trading', icon: PresentationChartBarIcon, isFollowed: false },
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

const categoryFilters = ['All', 'Technology', 'Health Care', 'Trading', 'Stock Market', 'Design', 'Finance', 'Science', 'Gaming', 'Art', 'Automotive', 'Space'];

const trendzDomains = [
    { name: 'Technology', icon: CodeBracketIcon },
    { name: 'Health Care', icon: ShieldCheckIcon },
    { name: 'Trading', icon: PresentationChartBarIcon },
    { name: 'Stock Market', icon: PresentationChartBarIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Finance', icon: CurrencyDollarIcon },
    { name: 'Science', icon: AcademicCapIcon },
    { name: 'Gaming', icon: CubeIcon },
    { name: 'Art', icon: PencilIcon },
    { name: 'Automotive', icon: WrenchScrewdriverIcon },
    { name: 'Space', icon: GlobeAltIcon },
];

// Helper to generate more mock data for subsequent pages
const generateMoreTrends = (page: number): Trend[] => {
    return [...mockTrends]
        .sort(() => Math.random() - 0.5) // Shuffle to make it look like new data
        .map((trend, index) => ({
            ...trend,
            id: `${trend.id}-page-${page}-${index}`,
            title: `${trend.title} (Page ${page})`, // Add page number to title for visual confirmation
        }));
};

const TrendzPage = () => {
    const [trends, setTrends] = useState<Trend[]>([]);
    const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
    const [activeCategory, setActiveCategory] = useState('All');
    const [loading, setLoading] = useState(true); // Initial page load
    const [isFetchingMore, setIsFetchingMore] = useState(false); // Subsequent loads
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const { domainSelections, setDomainSelection } = useFilters();

    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        followedDomainsFilter: string | null;
        setFollowedDomainsFilter: (filter: string | null) => void;
        refreshKey: number;
    }>();

    const { setRightSidebarVariant, followedDomainsFilter, setFollowedDomainsFilter, refreshKey } = outletContext || {};
    
    const observer = useRef<IntersectionObserver>();
    const lastTrendElementRef = useCallback((node: HTMLDivElement) => {
        if (loading || isFetchingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, isFetchingMore, hasMore]);

    // Effect for initial data load and filter changes
    useEffect(() => {
        setLoading(true);
        setHasMore(true);
        setPage(1);
        const timer = setTimeout(() => {
            setTrends([...mockTrends].sort(() => Math.random() - 0.5));
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, [activeCategory, followedDomainsFilter, refreshKey]);

    // Effect for fetching more data when page changes
    useEffect(() => {
        if (page > 1) {
            fetchMoreTrends();
        }
    }, [page]);
    
    useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('trendz');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
            if (setFollowedDomainsFilter) {
                setFollowedDomainsFilter(null);
            }
        };
    }, [setRightSidebarVariant, setFollowedDomainsFilter]);

    // This effect ensures the view scrolls to the top whenever the main content changes,
    // which can be due to filter changes or selecting/deselecting a trend detail view.
    useEffect(() => {
        document.querySelector('main')?.scrollTo(0, 0);
    }, [selectedTrend, activeCategory, followedDomainsFilter]);

    const fetchMoreTrends = () => {
        setIsFetchingMore(true);
        setTimeout(() => {
            const newTrends = generateMoreTrends(page);
            setTrends(prev => [...prev, ...newTrends]);
            // Simulate having a total of 3 pages of data
            if (page >= 3) {
                setHasMore(false);
            }
            setIsFetchingMore(false);
        }, 1000);
    };

    const handleSelectTrend = (trend: Trend) => {
        setSelectedTrend(trend);
    };

    const handleBack = () => {
        setSelectedTrend(null);
    };
    
    const filteredTrends = trends.filter(trend => {
        if (followedDomainsFilter) {
            return trend.domain.name === followedDomainsFilter;
        }
        return activeCategory === 'All' || trend.domain.name === activeCategory
    });

    if (selectedTrend) {
        const similarTrends = trends.filter(t => t.id !== selectedTrend.id && t.domain.name === selectedTrend.domain.name);
        return (
            <div>
                <TrendzDetail trend={selectedTrend} onBack={handleBack} />
                <div className="p-4">
                    <h3 className="text-xl font-bold text-white mb-4">Similar Trendz</h3>
                    {similarTrends.length > 0 ? (
                        similarTrends.slice(0, 2).map(trend => (
                            <TrendzCard key={trend.id} trend={trend} onClick={() => handleSelectTrend(trend)} />
                        ))
                    ) : (
                        <p className="text-gray-400">No similar trends found.</p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {followedDomainsFilter ? (
                 <div className="bg-invox-dark-accent p-3 rounded-lg border border-gray-800 mb-4">
                    <h2 className="font-semibold text-white text-center">
                        {`Showing Trendz from "${followedDomainsFilter}"`}
                    </h2>
                </div>
            ) : (
                <>
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
                    <input
                        type="search"
                        placeholder="Search Trends or Domains"
                        className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 mb-4 focus:outline-none text-white"
                    />
                    <DomainFilter 
                        domains={trendzDomains}
                        selectedDomains={domainSelections.trendz || []}
                        onSelectionChange={(domains) => setDomainSelection('trendz', domains)}
                    />
                </>
            )}


            <div>
                {loading ? (
                    <>
                        <TrendzCardSkeleton />
                        <TrendzCardSkeleton />
                        <TrendzCardSkeleton />
                    </>
                ) : filteredTrends.map((trend, index) => {
                    if (filteredTrends.length === index + 1) {
                        return (
                            <div ref={lastTrendElementRef} key={trend.id}>
                                <TrendzCard trend={trend} onClick={() => handleSelectTrend(trend)} />
                            </div>
                        )
                    }
                    return <TrendzCard key={trend.id} trend={trend} onClick={() => handleSelectTrend(trend)} />
                })}
            </div>

            <div className="flex justify-center py-4">
                {isFetchingMore && (
                    <TrendzCardSkeleton />
                )}
                {!hasMore && trends.length > 0 && !loading && !isFetchingMore && (
                    <p className="text-gray-500">You've reached the end of the line.</p>
                )}
            </div>
        </div>
    );
};

export default TrendzPage;