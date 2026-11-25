import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import DomainFilter from '../components/ui/DomainFilter';
import TrendzCard from '../components/trendz/TrendzCard';
import TrendzDetail from '../components/trendz/TrendzDetail';
import TrendzCardSkeleton from '../components/trendz/TrendzCardSkeleton';
import {
    TRENDZ_CATEGORY_FILTERS,
    TRENDZ_DOMAIN_FILTER_OPTIONS,
    TRENDZ_DOMAINS,
    formatTrendzDomainName,
    normalizeTrendzDomainSlug,
    type TrendzDomainSlug,
} from '../utils/trendzDomains';
import { useFilters } from '../contexts/AIAssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { useTrendzEngagement } from '../contexts/TrendzEngagementContext';
import {
    DEVELOPMENT_MOCK_TRENDS,
    dedupeTrendsById,
    fetchPersonalizedTrendsFeed,
    fetchPublishedTrendsPage,
    fetchRelatedTrends,
    fetchSavedTrendsForUser,
    fetchTrendById,
    getFallbackMockTrendById,
    getFallbackRelatedMockTrends,
    queryFallbackMockTrends,
    rankPersonalizedTrends,
    type PersonalizedTrendReason,
    type SavedTrendEntry,
    type TrendSortMode,
    type TrendViewModel,
} from '../services/trendzService';

// Preserved development fallback dataset (never mixed silently with live Firestore records)
export const mockTrends: TrendViewModel[] = DEVELOPMENT_MOCK_TRENDS;

const categoryFilters = TRENDZ_CATEGORY_FILTERS;
const trendzDomains = TRENDZ_DOMAIN_FILTER_OPTIONS;
const PAGE_SIZE = 10;

type FeedDataSource = 'live' | 'dev_fallback';
type TrendzFeedView = 'all' | 'for-you' | 'saved';

interface TrendzOutletContext {
    setRightSidebarVariant?: (variant: string) => void;
    followedDomainsFilter?: string | null;
    setFollowedDomainsFilter?: (filter: string | null) => void;
    trendzSearchQuery?: string;
    setTrendzSearchQuery?: (query: string) => void;
    refreshKey?: number;
}

const TrendzPage = () => {
    const { trendId: rawTrendId } = ReactRouterDOM.useParams<{ trendId?: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();

    const outletContext = ReactRouterDOM.useOutletContext<TrendzOutletContext>() || {};
    const {
        setRightSidebarVariant,
        followedDomainsFilter = null,
        setFollowedDomainsFilter,
        trendzSearchQuery = '',
        setTrendzSearchQuery,
        refreshKey = 0,
    } = outletContext;

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
        isDomainFollowed,
        isDomainPending,
        toggleFollowDomain,
        bookmarkRecords,
        bookmarkedTrendIds,
        isBookmarkPending,
        removeBookmarkById,
        upvoteRecords,
        personalizationSignals,
    } = useTrendzEngagement();

    const isSavedPath = location.pathname === '/trendz/saved';
    const trendId = rawTrendId && rawTrendId !== 'saved' ? rawTrendId : undefined;
    const viewParam = searchParams.get('view');
    const feedView: TrendzFeedView =
        isSavedPath || viewParam === 'saved'
            ? 'saved'
            : viewParam === 'for-you'
                ? 'for-you'
                : 'all';

    const sortBy: TrendSortMode = searchParams.get('sort') === 'momentum' ? 'momentum' : 'latest';
    const isDevSourceParam = searchParams.get('source') === 'dev';

    // Explicit live vs. development fallback mode — never silently mixed
    const [dataSource, setDataSource] = useState<FeedDataSource>(
        isDevSourceParam ? 'dev_fallback' : 'live'
    );

    // Feed state
    const [trends, setTrends] = useState<TrendViewModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [retryTick, setRetryTick] = useState(0);

    // Debounced search query synchronized with RightSidebar
    const [localSearchInput, setLocalSearchInput] = useState(trendzSearchQuery);
    const [debouncedSearch, setDebouncedSearch] = useState(trendzSearchQuery.trim());

    // Detail view state (/trendz/:trendId)
    const [selectedTrend, setSelectedTrend] = useState<TrendViewModel | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailNotFound, setDetailNotFound] = useState(false);
    const [detailRetryTick, setDetailRetryTick] = useState(0);

    // Similar Signals state (backed strictly by relatedTrendIds)
    const [relatedTrends, setRelatedTrends] = useState<TrendViewModel[]>([]);
    const [relatedLoading, setRelatedLoading] = useState(false);

    // Personalized ("For You") feed state
    const [personalizedReasons, setPersonalizedReasons] = useState<
        Record<string, PersonalizedTrendReason>
    >({});
    const [hasPersonalizationSignals, setHasPersonalizationSignals] = useState(false);

    // Saved Trends view state (/trendz/saved or /trendz?view=saved)
    const [savedEntries, setSavedEntries] = useState<SavedTrendEntry[]>([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedError, setSavedError] = useState<string | null>(null);
    const [savedRetryTick, setSavedRetryTick] = useState(0);

    // Cursor & stale-request cancellation refs
    const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const feedRequestIdRef = useRef(0);
    const savedRequestIdRef = useRef(0);
    const detailRequestIdRef = useRef(0);
    const relatedRequestIdRef = useRef(0);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Keep URL ?source=dev synchronized with explicit dev fallback state
    useEffect(() => {
        if (isDevSourceParam && dataSource !== 'dev_fallback') {
            setDataSource('dev_fallback');
        }
    }, [isDevSourceParam, dataSource]);

    // Sync local search input when sidebar search updates
    useEffect(() => {
        setLocalSearchInput(trendzSearchQuery);
    }, [trendzSearchQuery]);

    // Debounce search query for Firestore queries
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(localSearchInput.trim());
        }, 250);
        return () => clearTimeout(timer);
    }, [localSearchInput]);

    const handleSearchInputChange = (value: string) => {
        setLocalSearchInput(value);
        setTrendzSearchQuery?.(value);
    };

    // Single canonical domain selection model shared across Category Pills, DomainFilter, and Followed Domains
    const selectedDomainSlugs = useMemo<TrendzDomainSlug[]>(() => {
        const rawNames = domainSelections.trendz || [];
        const uniqueSlugs = new Set<TrendzDomainSlug>();
        for (const entry of rawNames) {
            const slug = normalizeTrendzDomainSlug(entry);
            if (slug) uniqueSlugs.add(slug);
        }
        if (uniqueSlugs.size === 0 && followedDomainsFilter) {
            const followedSlug = normalizeTrendzDomainSlug(followedDomainsFilter);
            if (followedSlug) uniqueSlugs.add(followedSlug);
        }
        return Array.from(uniqueSlugs);
    }, [domainSelections.trendz, followedDomainsFilter]);

    const selectedDomainNames = useMemo(
        () => selectedDomainSlugs.map((slug) => formatTrendzDomainName(slug)),
        [selectedDomainSlugs]
    );

    const domainKey = selectedDomainSlugs.join(',');

    const updateCanonicalDomainSelection = useCallback(
        (rawNames: string[], syncFollowedLabel?: string | null) => {
            const uniqueNames: string[] = [];
            const seenSlugs = new Set<TrendzDomainSlug>();

            for (const name of rawNames) {
                const slug = normalizeTrendzDomainSlug(name);
                if (slug && !seenSlugs.has(slug)) {
                    seenSlugs.add(slug);
                    uniqueNames.push(formatTrendzDomainName(slug));
                }
            }

            setDomainSelection('trendz', uniqueNames);

            if (syncFollowedLabel !== undefined) {
                setFollowedDomainsFilter?.(syncFollowedLabel);
            } else if (uniqueNames.length === 0) {
                setFollowedDomainsFilter?.(null);
            } else if (followedDomainsFilter) {
                const followedSlug = normalizeTrendzDomainSlug(followedDomainsFilter);
                if (!followedSlug || !seenSlugs.has(followedSlug)) {
                    setFollowedDomainsFilter?.(null);
                }
            }
        },
        [followedDomainsFilter, setDomainSelection, setFollowedDomainsFilter]
    );

    const handleClearAllFilters = useCallback(() => {
        updateCanonicalDomainSelection([], null);
        setLocalSearchInput('');
        setDebouncedSearch('');
        setTrendzSearchQuery?.('');
        if (sortBy === 'momentum') {
            const next = new URLSearchParams(searchParams);
            next.delete('sort');
            setSearchParams(next, { replace: true });
        }
    }, [updateCanonicalDomainSelection, setTrendzSearchQuery, sortBy, searchParams, setSearchParams]);

    const handleCategoryClick = useCallback(
        (category: string) => {
            if (category === 'All') {
                updateCanonicalDomainSelection([], null);
                return;
            }
            const slug = normalizeTrendzDomainSlug(category);
            if (!slug) return;
            const canonicalName = formatTrendzDomainName(slug);
            const isSoleSelected =
                selectedDomainSlugs.length === 1 && selectedDomainSlugs[0] === slug;

            if (isSoleSelected) {
                updateCanonicalDomainSelection([], null);
            } else {
                updateCanonicalDomainSelection([canonicalName], null);
            }
        },
        [selectedDomainSlugs, updateCanonicalDomainSelection]
    );

    const handleToggleSortToLatest = useCallback(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('sort');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const handleSwitchToDevFallback = useCallback(() => {
        setDataSource('dev_fallback');
        const next = new URLSearchParams(searchParams);
        next.set('source', 'dev');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const handleSwitchToLive = useCallback(() => {
        setDataSource('live');
        const next = new URLSearchParams(searchParams);
        next.delete('source');
        setSearchParams(next, { replace: true });
        setRetryTick((prev) => prev + 1);
    }, [searchParams, setSearchParams]);

    const handleSwitchFeedView = useCallback(
        (targetView: TrendzFeedView) => {
            if (targetView === 'saved') {
                navigate('/trendz/saved');
                return;
            }
            const next = new URLSearchParams();
            if (targetView === 'for-you') {
                next.set('view', 'for-you');
            }
            if (dataSource === 'dev_fallback') {
                next.set('source', 'dev');
            }
            const qs = next.toString();
            navigate(qs ? `/trendz?${qs}` : '/trendz');
        },
        [navigate, dataSource]
    );

    const personalizationFingerprint = useMemo(
        () =>
            [
                followedDomainSlugs.join(','),
                bookmarkRecords.map((b) => b.targetId).slice(0, 20).join(','),
                upvoteRecords.map((u) => u.targetId).slice(0, 20).join(','),
                personalizationSignals.viewRecords.map((v) => v.trendId).slice(0, 20).join(','),
            ].join('|'),
        [followedDomainSlugs, bookmarkRecords, upvoteRecords, personalizationSignals.viewRecords]
    );

    // Mount Trendz right sidebar variant
    useEffect(() => {
        setRightSidebarVariant?.('trendz');
        return () => {
            setRightSidebarVariant?.('default');
            setFollowedDomainsFilter?.(null);
        };
    }, [setRightSidebarVariant, setFollowedDomainsFilter]);

    // Scroll main viewport to top on route or filter changes
    useEffect(() => {
        document.querySelector('main')?.scrollTo(0, 0);
    }, [trendId, feedView, domainKey, sortBy]);

    // Primary feed fetch (ALL & FOR YOU views)
    useEffect(() => {
        if (trendId || feedView === 'saved') {
            return;
        }

        const requestId = ++feedRequestIdRef.current;
        cursorRef.current = null;
        setFeedError(null);

        if (feedView === 'for-you') {
            if (dataSource === 'dev_fallback') {
                const fallbackPool = queryFallbackMockTrends({
                    domainSlugs: selectedDomainSlugs,
                    searchQuery: debouncedSearch,
                    sortBy: 'latest',
                });
                const ranked = rankPersonalizedTrends(fallbackPool, personalizationSignals);
                setTrends(ranked.items);
                setPersonalizedReasons(ranked.reasonsByTrendId);
                setHasPersonalizationSignals(ranked.hasPersonalizationSignals);
                setHasMore(false);
                setLoading(false);
                setIsFetchingMore(false);
                return;
            }

            if (preferencesLoading) {
                setLoading(true);
                return;
            }

            setLoading(true);
            setIsFetchingMore(false);
            setHasMore(false);

            fetchPersonalizedTrendsFeed(personalizationSignals, {
                domainSlugs: selectedDomainSlugs,
                searchQuery: debouncedSearch,
                poolSize: 30,
            })
                .then((result) => {
                    if (feedRequestIdRef.current !== requestId) return;
                    setTrends(dedupeTrendsById(result.items));
                    setPersonalizedReasons(result.reasonsByTrendId);
                    setHasPersonalizationSignals(result.hasPersonalizationSignals);
                    setHasMore(false);
                    setLoading(false);
                })
                .catch((err) => {
                    if (feedRequestIdRef.current !== requestId) return;
                    console.error('[TRENDZ_PERSONALIZED_FEED_ERROR]', err);
                    setTrends([]);
                    setPersonalizedReasons({});
                    setHasMore(false);
                    setFeedError(
                        err?.code === 'permission-denied'
                            ? 'Permission denied while loading personalized Trendz. Please verify you are signed in.'
                            : 'Unable to generate your personalized Trendz feed right now. Please retry.'
                    );
                    setLoading(false);
                });
            return;
        }

        // Standard ALL feed (never hides any published content)
        setPersonalizedReasons({});

        if (dataSource === 'dev_fallback') {
            const fallbackItems = queryFallbackMockTrends({
                domainSlugs: selectedDomainSlugs,
                searchQuery: debouncedSearch,
                sortBy,
            });
            setTrends(fallbackItems);
            setHasMore(false);
            setLoading(false);
            setIsFetchingMore(false);
            return;
        }

        setLoading(true);
        setIsFetchingMore(false);
        setHasMore(false);

        fetchPublishedTrendsPage({
            pageSize: PAGE_SIZE,
            cursor: null,
            domainSlugs: selectedDomainSlugs,
            sortBy,
            searchQuery: debouncedSearch,
        })
            .then((pageResult) => {
                if (feedRequestIdRef.current !== requestId) return;
                cursorRef.current = pageResult.lastDoc;
                setTrends(dedupeTrendsById(pageResult.items));
                setHasMore(pageResult.hasMore && Boolean(pageResult.lastDoc));
                setLoading(false);
            })
            .catch((err) => {
                if (feedRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_FEED_LOAD_ERROR]', err);
                setTrends([]);
                setHasMore(false);
                setFeedError(
                    err?.code === 'permission-denied'
                        ? 'Permission denied while reading Trendz. Please verify you are signed in.'
                        : 'Unable to load published Trendz from Firestore. Please check your connection and retry.'
                );
                setLoading(false);
            });
    }, [
        trendId,
        feedView,
        dataSource,
        domainKey,
        debouncedSearch,
        sortBy,
        refreshKey,
        retryTick,
        selectedDomainSlugs,
        preferencesLoading,
        personalizationFingerprint,
    ]);

    // Saved Trends view hydration (/trendz/saved or /trendz?view=saved)
    useEffect(() => {
        if (trendId || feedView !== 'saved') {
            return;
        }

        const uid = currentUser?.uid;
        if (!uid) {
            setSavedEntries([]);
            setSavedLoading(false);
            setSavedError(null);
            return;
        }

        const requestId = ++savedRequestIdRef.current;
        setSavedLoading(true);
        setSavedError(null);

        fetchSavedTrendsForUser(uid)
            .then((entries) => {
                if (savedRequestIdRef.current !== requestId) return;
                setSavedEntries(entries);
                setSavedLoading(false);
            })
            .catch((err) => {
                if (savedRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_SAVED_LOAD_ERROR]', err);
                setSavedEntries([]);
                setSavedError(
                    err?.code === 'permission-denied'
                        ? 'Permission denied while loading your saved trends.'
                        : 'Unable to load your saved trends from Firestore. Please retry.'
                );
                setSavedLoading(false);
            });
    }, [trendId, feedView, currentUser?.uid, refreshKey, savedRetryTick]);

    // Keep Saved Trends list immediately synchronized when user removes a bookmark
    const visibleSavedEntries = useMemo(
        () => savedEntries.filter((entry) => bookmarkedTrendIds.has(entry.trendId)),
        [savedEntries, bookmarkedTrendIds]
    );

    // Cursor-based pagination loader (active on ALL live feed)
    const loadMoreTrends = useCallback(() => {
        if (
            trendId ||
            feedView !== 'all' ||
            dataSource !== 'live' ||
            loading ||
            isFetchingMore ||
            !hasMore ||
            !cursorRef.current
        ) {
            return;
        }

        const requestId = feedRequestIdRef.current;
        setIsFetchingMore(true);

        fetchPublishedTrendsPage({
            pageSize: PAGE_SIZE,
            cursor: cursorRef.current,
            domainSlugs: selectedDomainSlugs,
            sortBy,
            searchQuery: debouncedSearch,
        })
            .then((pageResult) => {
                if (feedRequestIdRef.current !== requestId) return;
                cursorRef.current = pageResult.lastDoc;
                setTrends((prev) => dedupeTrendsById([...prev, ...pageResult.items]));
                setHasMore(pageResult.hasMore && Boolean(pageResult.lastDoc));
                setIsFetchingMore(false);
            })
            .catch((err) => {
                if (feedRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_PAGINATION_ERROR]', err);
                setIsFetchingMore(false);
                setHasMore(false);
            });
    }, [trendId, feedView, dataSource, loading, isFetchingMore, hasMore, selectedDomainSlugs, sortBy, debouncedSearch]);

    // IntersectionObserver for automatic cursor pagination
    const lastTrendElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (loading || isFetchingMore) return;
            if (observerRef.current) observerRef.current.disconnect();
            if (!node || !hasMore || dataSource !== 'live' || feedView !== 'all') return;

            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0]?.isIntersecting && hasMore) {
                        loadMoreTrends();
                    }
                },
                { rootMargin: '200px 0px' }
            );
            observerRef.current.observe(node);
        },
        [loading, isFetchingMore, hasMore, dataSource, feedView, loadMoreTrends]
    );

    useEffect(() => {
        return () => {
            observerRef.current?.disconnect();
        };
    }, []);

    // URL-driven individual trend detail loader (/trendz/:trendId)
    useEffect(() => {
        if (!trendId) {
            setSelectedTrend(null);
            setDetailLoading(false);
            setDetailError(null);
            setDetailNotFound(false);
            setRelatedTrends([]);
            return;
        }

        const requestId = ++detailRequestIdRef.current;
        setDetailError(null);
        setDetailNotFound(false);

        if (dataSource === 'dev_fallback') {
            const mockMatch = getFallbackMockTrendById(trendId);
            if (mockMatch) {
                setSelectedTrend(mockMatch);
                setDetailLoading(false);
            } else {
                setSelectedTrend(null);
                setDetailNotFound(true);
                setDetailLoading(false);
            }
            return;
        }

        // Show cached live record immediately while refreshing from Firestore if available
        const cachedLive = trends.find((t) => !t.isFallback && t.id === trendId) || null;
        if (cachedLive) {
            setSelectedTrend(cachedLive);
            setDetailLoading(false);
        } else {
            setSelectedTrend(null);
            setDetailLoading(true);
        }

        fetchTrendById(trendId)
            .then((record) => {
                if (detailRequestIdRef.current !== requestId) return;
                if (!record) {
                    setSelectedTrend(null);
                    setDetailNotFound(true);
                } else {
                    setSelectedTrend(record);
                    setDetailNotFound(false);
                }
                setDetailLoading(false);
            })
            .catch((err) => {
                if (detailRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_DETAIL_LOAD_ERROR]', err);
                if (!cachedLive) {
                    setDetailError(
                        err?.code === 'permission-denied'
                            ? 'This trend is unavailable or requires sign-in.'
                            : 'Unable to retrieve this trend from Firestore.'
                    );
                }
                setDetailLoading(false);
            });
    }, [trendId, dataSource, detailRetryTick]);

    // Similar Signals loader driven strictly by selectedTrend.relatedTrendIds
    useEffect(() => {
        if (!selectedTrend) {
            setRelatedTrends([]);
            setRelatedLoading(false);
            return;
        }

        const requestId = ++relatedRequestIdRef.current;
        const relatedIds = selectedTrend.relatedTrendIds || [];

        if (relatedIds.length === 0) {
            setRelatedTrends([]);
            setRelatedLoading(false);
            return;
        }

        if (selectedTrend.isFallback || dataSource === 'dev_fallback') {
            setRelatedTrends(getFallbackRelatedMockTrends(relatedIds, selectedTrend.id, 4));
            setRelatedLoading(false);
            return;
        }

        setRelatedLoading(true);
        fetchRelatedTrends(relatedIds, selectedTrend.id, 4)
            .then((items) => {
                if (relatedRequestIdRef.current !== requestId) return;
                setRelatedTrends(items);
                setRelatedLoading(false);
            })
            .catch((err) => {
                if (relatedRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_RELATED_LOAD_ERROR]', err);
                setRelatedTrends([]);
                setRelatedLoading(false);
            });
    }, [selectedTrend?.id, selectedTrend?.isFallback, dataSource]);

    const handleSelectTrend = useCallback(
        (trend: TrendViewModel) => {
            const targetPath = `/trendz/${encodeURIComponent(trend.id)}`;
            const params = new URLSearchParams();
            if (dataSource === 'dev_fallback') params.set('source', 'dev');
            if (feedView === 'saved') params.set('from', 'saved');
            else if (feedView === 'for-you') params.set('from', 'for-you');
            const qs = params.toString();
            navigate(qs ? `${targetPath}?${qs}` : targetPath);
        },
        [navigate, dataSource, feedView]
    );

    const handleBackToFeed = useCallback(() => {
        const fromView = searchParams.get('from');
        if (fromView === 'saved') {
            navigate('/trendz/saved');
            return;
        }
        const params = new URLSearchParams();
        if (fromView === 'for-you') params.set('view', 'for-you');
        if (sortBy === 'momentum') params.set('sort', 'momentum');
        if (dataSource === 'dev_fallback') params.set('source', 'dev');
        const qs = params.toString();
        navigate(qs ? `/trendz?${qs}` : '/trendz');
    }, [navigate, searchParams, sortBy, dataSource]);

    const hasActiveFilters =
        selectedDomainSlugs.length > 0 || Boolean(debouncedSearch) || sortBy === 'momentum';

    // ==========================================
    // Detail View (/trendz/:trendId)
    // ==========================================
    if (trendId) {
        if (detailLoading) {
            return (
                <div className="space-y-4">
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-6">
                        <button
                            type="button"
                            onClick={handleBackToFeed}
                            className="flex items-center gap-2 mb-4 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                        >
                            <span>// BACK_TO_TRENDZ</span>
                        </button>
                        <TrendzCardSkeleton />
                    </div>
                </div>
            );
        }

        if (detailError) {
            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-4">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">// SIGNAL_FETCH_ERROR</p>
                    <p className="text-xs text-zinc-400">{detailError}</p>
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => setDetailRetryTick((prev) => prev + 1)}
                            className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                        >
                            RETRY
                        </button>
                        <button
                            type="button"
                            onClick={handleBackToFeed}
                            className="px-3.5 py-2 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-xs uppercase tracking-wider transition-colors"
                        >
                            // BACK_TO_TRENDZ
                        </button>
                    </div>
                </div>
            );
        }

        if (detailNotFound || !selectedTrend) {
            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-4">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">// SIGNAL_NOT_FOUND</p>
                    <p className="text-xs text-zinc-400">
                        This trend record could not be found, has been removed, or is not published.
                    </p>
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={handleBackToFeed}
                            className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                        >
                            // BACK_TO_TRENDZ
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {selectedTrend.isFallback && (
                    <div className="bg-[#0c0c0e] px-3.5 py-2.5 border border-zinc-800 flex items-center justify-between gap-3 font-mono text-[11px]">
                        <span className="text-zinc-400">
                            // DATA_SOURCE: DEV_FALLBACK (LOCAL SAMPLE RECORD)
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setDataSource('live');
                                navigate('/trendz');
                            }}
                            className="text-white underline hover:text-zinc-300 uppercase tracking-wider shrink-0"
                        >
                            SWITCH TO LIVE
                        </button>
                    </div>
                )}

                <TrendzDetail trend={selectedTrend} onBack={handleBackToFeed} />

                <div className="mt-8 border-t border-zinc-800/80 pt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-1.5 h-1.5 bg-white"></span>
                        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                            // SIMILAR_SIGNALS
                        </h3>
                    </div>

                    {relatedLoading ? (
                        <TrendzCardSkeleton />
                    ) : relatedTrends.length > 0 ? (
                        relatedTrends.map((trend) => (
                            <TrendzCard
                                key={trend.id}
                                trend={trend}
                                onClick={() => handleSelectTrend(trend)}
                            />
                        ))
                    ) : (
                        <p className="text-zinc-500 font-mono text-xs">
                            // No published related signals linked to this trend.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    const soleSelectedDomainSlug =
        selectedDomainSlugs.length === 1 ? selectedDomainSlugs[0] : null;
    const soleSelectedDomainName = soleSelectedDomainSlug
        ? formatTrendzDomainName(soleSelectedDomainSlug)
        : null;

    // ==========================================
    // Main Trendz Feed (/trendz, ?view=for-you, /trendz/saved)
    // ==========================================
    return (
        <div className="space-y-4">
            {/* Feed View Switcher (ALL / FOR YOU / SAVED) */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        type="button"
                        onClick={() => handleSwitchFeedView('all')}
                        className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                            feedView === 'all'
                                ? 'bg-white text-black border-white font-bold'
                                : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                        }`}
                    >
                        ALL
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchFeedView('for-you')}
                        className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                            feedView === 'for-you'
                                ? 'bg-white text-black border-white font-bold'
                                : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                        }`}
                    >
                        FOR YOU
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchFeedView('saved')}
                        className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                            feedView === 'saved'
                                ? 'bg-white text-black border-white font-bold'
                                : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                        }`}
                    >
                        SAVED{!preferencesLoading && bookmarkRecords.length > 0 ? ` [${bookmarkRecords.length}]` : ''}
                    </button>
                </div>
                {preferencesLoading && isAuthenticated && (
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider shrink-0">
                        // SYNCING_PREFS...
                    </span>
                )}
            </div>

            {/* Engagement / Preferences Error Banner (never silent) */}
            {(actionError || preferencesError) && (
                <div className="bg-[#0c0c0e] px-3.5 py-2.5 border border-zinc-700 flex items-center justify-between gap-3 font-mono text-xs">
                    <span className="text-zinc-300">
                        // ERROR: {actionError || preferencesError}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        {preferencesError && (
                            <button
                                type="button"
                                onClick={() => void refreshEngagement()}
                                className="px-2 py-0.5 border border-zinc-600 text-white text-[10px] uppercase tracking-wider hover:border-zinc-400"
                            >
                                RETRY
                            </button>
                        )}
                        {actionError && (
                            <button
                                type="button"
                                onClick={clearActionError}
                                className="px-2 py-0.5 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] uppercase tracking-wider"
                            >
                                DISMISS
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ==========================================
                SAVED TRENDS VIEW (/trendz/saved)
               ========================================== */}
            {feedView === 'saved' ? (
                <div className="space-y-4">
                    <div className="bg-[#0c0c0e] p-3.5 border border-zinc-800 flex items-center justify-between gap-3 font-mono">
                        <div>
                            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                                // SAVED_TRENDS
                            </h2>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                Bookmarked industry developments synced to your account.
                            </p>
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0">
                            [{visibleSavedEntries.length}]
                        </span>
                    </div>

                    {!isAuthenticated ? (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">
                                // SIGN_IN_REQUIRED
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Sign in to view and manage your saved trends across sessions.
                            </p>
                        </div>
                    ) : savedLoading || preferencesLoading ? (
                        <>
                            <TrendzCardSkeleton />
                            <TrendzCardSkeleton />
                        </>
                    ) : savedError ? (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">
                                // SAVED_TRENDS_ERROR
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">{savedError}</p>
                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => setSavedRetryTick((prev) => prev + 1)}
                                    className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                >
                                    RETRY
                                </button>
                            </div>
                        </div>
                    ) : visibleSavedEntries.length === 0 ? (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">
                                // NO_SAVED_TRENDS
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                You haven&apos;t bookmarked any trends yet. Click the bookmark icon on any live trend to save it here.
                            </p>
                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => handleSwitchFeedView('all')}
                                    className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                >
                                    BROWSE ALL TRENDZ
                                </button>
                            </div>
                        </div>
                    ) : (
                        visibleSavedEntries.map((entry) => {
                            if (entry.trend && !entry.isUnavailable) {
                                return (
                                    <TrendzCard
                                        key={entry.trendId}
                                        trend={entry.trend}
                                        onClick={() => handleSelectTrend(entry.trend!)}
                                    />
                                );
                            }

                            const pendingRemove = isBookmarkPending(entry.trendId);
                            const domainLabel = formatTrendzDomainName(entry.bookmark.domainSlug);
                            return (
                                <div
                                    key={entry.trendId}
                                    className="bg-[#0c0c0e] border border-zinc-800/90 p-4 mb-4 font-mono space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-3 border-b border-zinc-800/60 pb-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider truncate">
                                                {entry.bookmark.trendPublisher}
                                            </p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">
                                                // DOMAIN: {domainLabel.toUpperCase()} · {entry.bookmark.trendPublishedOn}
                                            </p>
                                        </div>
                                        <span className="px-2 py-0.5 border border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider shrink-0">
                                            UNAVAILABLE
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <h3 className="text-sm font-semibold text-zinc-300">
                                            &quot;{entry.bookmark.trendTitle}&quot;
                                        </h3>
                                        <p className="text-xs text-zinc-500 leading-relaxed">
                                            // SIGNAL_UNAVAILABLE — This trend has been removed or unpublished and is no longer publicly viewable.
                                        </p>
                                    </div>
                                    <div className="pt-1 flex justify-end">
                                        <button
                                            type="button"
                                            disabled={pendingRemove}
                                            onClick={() => void removeBookmarkById(entry.trendId)}
                                            className="px-3 py-1.5 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50"
                                        >
                                            {pendingRemove ? 'REMOVING...' : 'REMOVE BOOKMARK'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                <>
                    {/* Explicit Dev Fallback Indicator — never silently mixed with live records */}
                    {dataSource === 'dev_fallback' && (
                        <div className="bg-[#0c0c0e] px-3.5 py-2.5 border border-zinc-700 flex items-center justify-between gap-3 font-mono text-[11px]">
                            <span className="text-zinc-300">
                                // DATA_SOURCE: DEV_FALLBACK (LOCAL SAMPLE DATA — NOT LIVE FIRESTORE)
                            </span>
                            <button
                                type="button"
                                onClick={handleSwitchToLive}
                                className="px-2.5 py-1 bg-white text-black font-bold text-[10px] uppercase tracking-wider hover:bg-zinc-200 transition-colors shrink-0"
                            >
                                SWITCH TO LIVE
                            </button>
                        </div>
                    )}

                    {/* Personalized ("For You") Context Banner */}
                    {feedView === 'for-you' && (
                        <div className="bg-[#0c0c0e] p-3.5 border border-zinc-800 font-mono space-y-2.5">
                            {!isAuthenticated ? (
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                                        // SIGN_IN_TO_PERSONALIZE
                                    </p>
                                    <p className="text-[11px] text-zinc-400">
                                        Showing high-momentum and recent trends. Sign in to personalize by followed domains, bookmarks, and upvotes.
                                    </p>
                                </div>
                            ) : hasPersonalizationSignals ? (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                                            // FOR_YOU_FEED
                                        </p>
                                        <p className="text-[11px] text-zinc-400">
                                            Ranked by followed domains ({followedDomainSlugs.length}), saved trends ({bookmarkRecords.length}), upvotes ({upvoteRecords.length}), recent views &amp; momentum.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                                            // PERSONALIZE_YOUR_STREAM
                                        </p>
                                        <p className="text-[11px] text-zinc-400">
                                            No domain preferences yet — showing top momentum &amp; recent signals. Follow domains below to tailor this feed:
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TRENDZ_DOMAINS.slice(0, 6).map((domain) => {
                                            const followed = isDomainFollowed(domain.slug);
                                            const pending = isDomainPending(domain.slug);
                                            return (
                                                <button
                                                    key={domain.slug}
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() => void toggleFollowDomain(domain.slug)}
                                                    className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border transition-colors disabled:opacity-50 ${
                                                        followed
                                                            ? 'bg-white text-black border-white font-bold'
                                                            : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-500 hover:text-white'
                                                    }`}
                                                >
                                                    {pending ? '...' : followed ? `✓ ${domain.name}` : `+ ${domain.name}`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Active Single Domain Banner with Follow/Unfollow Control */}
                    {(followedDomainsFilter || soleSelectedDomainSlug) && soleSelectedDomainSlug && soleSelectedDomainName && (
                        <div className="bg-[#0c0c0e] p-3 border border-zinc-800 mb-2 flex items-center justify-between gap-2">
                            <h2 className="font-mono text-xs text-white uppercase tracking-wider truncate">
                                {`// DOMAIN: ${soleSelectedDomainName}`}
                            </h2>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    disabled={isDomainPending(soleSelectedDomainSlug)}
                                    onClick={() => void toggleFollowDomain(soleSelectedDomainSlug)}
                                    className={`font-mono text-[10px] px-2.5 py-0.5 uppercase tracking-wider border transition-colors disabled:opacity-50 ${
                                        isDomainFollowed(soleSelectedDomainSlug)
                                            ? 'bg-zinc-900 text-white border-zinc-600 font-bold hover:border-zinc-500'
                                            : 'text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                    }`}
                                >
                                    {isDomainPending(soleSelectedDomainSlug)
                                        ? '...'
                                        : isDomainFollowed(soleSelectedDomainSlug)
                                            ? 'FOLLOWING'
                                            : '+ FOLLOW'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateCanonicalDomainSelection([], null)}
                                    className="font-mono text-[10px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 uppercase transition-colors"
                                >
                                    CLEAR
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Category Filter Pills (synchronized with canonical domain registry) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 no-scrollbar">
                        {categoryFilters.map((category) => {
                            const slug = category === 'All' ? null : normalizeTrendzDomainSlug(category);
                            const isActive =
                                category === 'All'
                                    ? selectedDomainSlugs.length === 0
                                    : Boolean(slug && selectedDomainSlugs.includes(slug));

                            return (
                                <button
                                    type="button"
                                    key={category}
                                    onClick={() => handleCategoryClick(category)}
                                    className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                                        isActive
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    {category}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Bar */}
                    <div className="mb-4">
                        <input
                            type="search"
                            placeholder="SEARCH_TRENDS_OR_DOMAINS..."
                            value={localSearchInput}
                            onChange={(e) => handleSearchInputChange(e.target.value)}
                            className="w-full bg-[#0c0c0e] border border-zinc-800/90 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                    </div>

                    {/* DomainFilter Dropdown (synchronized with Category Pills & Followed Domains) */}
                    <DomainFilter
                        domains={trendzDomains}
                        selectedDomains={selectedDomainNames}
                        onSelectionChange={(domains) => updateCanonicalDomainSelection(domains)}
                    />

                    {/* Active Momentum Sort Banner (triggered by Momentum Now VIEW_ALL) */}
                    {feedView === 'all' && sortBy === 'momentum' && (
                        <div className="bg-[#0c0c0e] px-3.5 py-2.5 border border-zinc-800 flex items-center justify-between gap-2 font-mono text-xs">
                            <span className="text-white uppercase tracking-wider">// SORT: MOMENTUM_NOW</span>
                            <button
                                type="button"
                                onClick={handleToggleSortToLatest}
                                className="text-[10px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 uppercase tracking-wider transition-colors"
                            >
                                SHOW LATEST
                            </button>
                        </div>
                    )}

                    {/* Main Feed Stream */}
                    <div className="mt-4">
                        {loading ? (
                            <>
                                <TrendzCardSkeleton />
                                <TrendzCardSkeleton />
                                <TrendzCardSkeleton />
                            </>
                        ) : feedError ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                    // FEED_SYNC_ERROR
                                </p>
                                <p className="text-xs text-zinc-400 leading-relaxed">{feedError}</p>
                                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setRetryTick((prev) => prev + 1)}
                                        className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                    >
                                        RETRY
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSwitchToDevFallback}
                                        className="px-3.5 py-2 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-xs uppercase tracking-wider transition-colors"
                                    >
                                        LOAD DEV SAMPLE DATA
                                    </button>
                                </div>
                            </div>
                        ) : trends.length === 0 ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                    {hasActiveFilters
                                        ? '// NO_MATCHING_SIGNALS'
                                        : feedView === 'for-you'
                                            ? '// NO_PERSONALIZED_RECOMMENDATIONS'
                                            : '// NO_PUBLISHED_SIGNALS'}
                                </p>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    {hasActiveFilters
                                        ? 'No published Trendz match your active domain filter or search query.'
                                        : feedView === 'for-you'
                                            ? 'No personalized recommendations are currently available. Switch to All Trendz or follow additional domains.'
                                            : 'No published Trendz records are currently available in Firestore.'}
                                </p>
                                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                                    {hasActiveFilters ? (
                                        <button
                                            type="button"
                                            onClick={handleClearAllFilters}
                                            className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                        >
                                            CLEAR FILTERS
                                        </button>
                                    ) : (
                                        <>
                                            {feedView === 'for-you' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSwitchFeedView('all')}
                                                    className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                                >
                                                    VIEW ALL TRENDZ
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setRetryTick((prev) => prev + 1)}
                                                className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                            >
                                                REFRESH LIVE FEED
                                            </button>
                                            {dataSource === 'live' && (
                                                <button
                                                    type="button"
                                                    onClick={handleSwitchToDevFallback}
                                                    className="px-3.5 py-2 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-xs uppercase tracking-wider transition-colors"
                                                >
                                                    LOAD DEV SAMPLE DATA
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            trends.map((trend, index) => {
                                const reason =
                                    feedView === 'for-you'
                                        ? personalizedReasons[trend.id]
                                        : undefined;
                                if (feedView === 'all' && trends.length === index + 1) {
                                    return (
                                        <div ref={lastTrendElementRef} key={trend.id}>
                                            <TrendzCard
                                                trend={trend}
                                                onClick={() => handleSelectTrend(trend)}
                                                personalizationReason={reason}
                                            />
                                        </div>
                                    );
                                }
                                return (
                                    <TrendzCard
                                        key={trend.id}
                                        trend={trend}
                                        onClick={() => handleSelectTrend(trend)}
                                        personalizationReason={reason}
                                    />
                                );
                            })
                        )}
                    </div>

                    {/* Pagination Footer */}
                    <div className="flex flex-col items-center justify-center py-4 gap-3">
                        {isFetchingMore && <TrendzCardSkeleton />}
                        {!loading &&
                            !isFetchingMore &&
                            hasMore &&
                            feedView === 'all' &&
                            dataSource === 'live' &&
                            trends.length > 0 && (
                                <button
                                    type="button"
                                    onClick={loadMoreTrends}
                                    className="px-4 py-2 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                                >
                                    LOAD MORE SIGNALS
                                </button>
                            )}
                        {!hasMore && trends.length > 0 && !loading && !isFetchingMore && (
                            <p className="text-zinc-600 font-mono text-xs tracking-wider">
                                // END OF STREAM REACHED
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default TrendzPage;