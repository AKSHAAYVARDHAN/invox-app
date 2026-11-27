import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import DomainFilter from '../components/ui/DomainFilter';
import TrendzCard from '../components/trendz/TrendzCard';
import TrendzDetail from '../components/trendz/TrendzDetail';
import TrendzCardSkeleton from '../components/trendz/TrendzCardSkeleton';
import RelatedTrendsSection from '../components/trendz/RelatedTrendsSection';
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
    clearRelatedTrendsCache,
    dedupeTrendsById,
    fetchFollowingTrendsPage,
    fetchPersonalizedTrendsFeed,
    fetchPublishedTrendsPage,
    fetchRelatedTrendsForTrend,
    fetchSavedTrendsForUser,
    fetchTrendById,
    getFallbackMockTrendById,
    getFallbackRelatedTrendsForTrend,
    hydrateSampleSavedTrendsFromBookmarks,
    hydrateSavedTrendsFromBookmarks,
    queryFallbackMockTrends,
    rankPersonalizedTrends,
    resolveDetailBackTarget,
    resolveFollowingTargetDomains,
    type PersonalizedTrendReason,
    type RelatedTrendMatch,
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
type TrendzFeedView = 'all' | 'for-you' | 'following' | 'saved';

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
        authLoading,
        preferencesLoading,
        preferencesError,
        actionError,
        clearActionError,
        refreshEngagement,
        followedDomainSlugs,
        isDomainFollowed,
        isDomainPending,
        followDomain,
        unfollowDomain,
        toggleFollowDomain,
        bookmarkRecords,
        bookmarkedTrendIds,
        sampleBookmarkRecords,
        sampleBookmarkedTrendIds,
        isBookmarkPending,
        removeBookmarkById,
        upvoteRecords,
        sampleUpvoteRecords,
        sampleViewRecords,
        personalizationSignals,
        samplePersonalizationSignals,
    } = useTrendzEngagement();

    const isSavedPath = location.pathname === '/trendz/saved';
    const isFollowingPath = location.pathname === '/trendz/following';
    const trendId =
        rawTrendId && rawTrendId !== 'saved' && rawTrendId !== 'following'
            ? rawTrendId
            : undefined;
    const viewParam = searchParams.get('view');
    const feedView: TrendzFeedView =
        isSavedPath || viewParam === 'saved'
            ? 'saved'
            : isFollowingPath || viewParam === 'following'
                ? 'following'
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
    const [detailAccessState, setDetailAccessState] = useState<
        'ok' | 'not_found' | 'unavailable' | 'sign_in_required' | 'error'
    >('ok');
    const [detailRetryTick, setDetailRetryTick] = useState(0);

    // Related Trends state (multi-signal topical discovery + session cache)
    const [relatedMatches, setRelatedMatches] = useState<RelatedTrendMatch[]>([]);
    const [relatedLoading, setRelatedLoading] = useState(false);
    const [relatedError, setRelatedError] = useState<string | null>(null);
    const [relatedRetryTick, setRelatedRetryTick] = useState(0);

    // Personalized ("For You") feed state & bounded client-side pagination
    const [personalizedReasons, setPersonalizedReasons] = useState<
        Record<string, PersonalizedTrendReason>
    >({});
    const [hasPersonalizationSignals, setHasPersonalizationSignals] = useState(false);
    const [visibleForYouCount, setVisibleForYouCount] = useState(PAGE_SIZE);

    // Responsive mobile/tablet domain management drawer inside Following mode
    const [showMobileManageDomains, setShowMobileManageDomains] = useState(false);

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
        setDataSource(isDevSourceParam ? 'dev_fallback' : 'live');
    }, [isDevSourceParam]);

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
    const followedDomainsKey = followedDomainSlugs.join(',');

    // Active single domain filter inside Following mode (must be one of the user's followed domains)
    const activeFollowingDomainSlug = useMemo<TrendzDomainSlug | null>(() => {
        if (feedView !== 'following' || followedDomainSlugs.length === 0) {
            return null;
        }
        if (selectedDomainSlugs.length === 1 && followedDomainSlugs.includes(selectedDomainSlugs[0])) {
            return selectedDomainSlugs[0];
        }
        return null;
    }, [feedView, followedDomainSlugs, selectedDomainSlugs]);

    const effectiveFollowingTargetDomains = useMemo<TrendzDomainSlug[]>(
        () => resolveFollowingTargetDomains(followedDomainSlugs, activeFollowingDomainSlug),
        [followedDomainSlugs, activeFollowingDomainSlug]
    );
    const effectiveFollowingKey = effectiveFollowingTargetDomains.join(',');

    // Clear stale individual filter if user unfollows the currently filtered domain in Following mode
    useEffect(() => {
        if (feedView !== 'following') return;
        if (selectedDomainSlugs.length === 1 && !followedDomainSlugs.includes(selectedDomainSlugs[0])) {
            setDomainSelection('trendz', []);
            setFollowedDomainsFilter?.(null);
        }
    }, [feedView, selectedDomainSlugs, followedDomainSlugs, setDomainSelection, setFollowedDomainsFilter]);

    // Clean up user-scoped view state on account switch or sign-out
    const prevPageUidRef = useRef<string | null>(currentUser?.uid ?? null);
    useEffect(() => {
        const nextUid = currentUser?.uid ?? null;
        if (prevPageUidRef.current !== nextUid) {
            prevPageUidRef.current = nextUid;
            setSavedEntries([]);
            setPersonalizedReasons({});
            setHasPersonalizationSignals(false);
            setShowMobileManageDomains(false);
            setDomainSelection('trendz', []);
            setFollowedDomainsFilter?.(null);
        }
    }, [currentUser?.uid, setDomainSelection, setFollowedDomainsFilter]);

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

    const handleFollowingChipClick = useCallback(
        (slug: TrendzDomainSlug | null) => {
            if (!slug) {
                updateCanonicalDomainSelection([], null);
                return;
            }
            const canonicalName = formatTrendzDomainName(slug);
            if (activeFollowingDomainSlug === slug) {
                updateCanonicalDomainSelection([], null);
            } else {
                updateCanonicalDomainSelection([canonicalName], canonicalName);
            }
        },
        [activeFollowingDomainSlug, updateCanonicalDomainSelection]
    );

    const handleSetSortBy = useCallback(
        (nextSort: TrendSortMode) => {
            const next = new URLSearchParams(searchParams);
            if (nextSort === 'momentum') {
                next.set('sort', 'momentum');
            } else {
                next.delete('sort');
            }
            setSearchParams(next, { replace: true });
        },
        [searchParams, setSearchParams]
    );

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
            if (targetView !== 'following') {
                setFollowedDomainsFilter?.(null);
            } else {
                // Entering Following mode: preserve selection only if it's a single followed domain
                const keepSoleFollowed =
                    selectedDomainSlugs.length === 1 &&
                    followedDomainSlugs.includes(selectedDomainSlugs[0]);
                if (!keepSoleFollowed) {
                    setDomainSelection('trendz', []);
                    setFollowedDomainsFilter?.(null);
                }
            }

            if (targetView === 'saved') {
                navigate(dataSource === 'dev_fallback' ? '/trendz/saved?source=dev' : '/trendz/saved');
                return;
            }
            const next = new URLSearchParams();
            if (targetView === 'for-you') {
                next.set('view', 'for-you');
            } else if (targetView === 'following') {
                next.set('view', 'following');
            }
            if (sortBy === 'momentum' && (targetView === 'all' || targetView === 'following')) {
                next.set('sort', 'momentum');
            }
            if (dataSource === 'dev_fallback') {
                next.set('source', 'dev');
            }
            const qs = next.toString();
            navigate(qs ? `/trendz?${qs}` : '/trendz');
        },
        [
            navigate,
            dataSource,
            sortBy,
            selectedDomainSlugs,
            followedDomainSlugs,
            setDomainSelection,
            setFollowedDomainsFilter,
        ]
    );

    const activeBookmarkRecords =
        dataSource === 'dev_fallback' ? sampleBookmarkRecords : bookmarkRecords;
    const activeBookmarkedTrendIds =
        dataSource === 'dev_fallback' ? sampleBookmarkedTrendIds : bookmarkedTrendIds;
    const activePersonalizationSignals =
        dataSource === 'dev_fallback' ? samplePersonalizationSignals : personalizationSignals;

    const personalizationFingerprint = useMemo(() => {
        const activeUpvotes = dataSource === 'dev_fallback' ? sampleUpvoteRecords : upvoteRecords;
        const activeViews =
            dataSource === 'dev_fallback'
                ? sampleViewRecords
                : personalizationSignals.viewRecords;
        return [
            dataSource,
            followedDomainSlugs.join(','),
            `${activeBookmarkRecords.length}:${activeBookmarkRecords.map((b) => b.targetId).slice(0, 30).join(',')}`,
            `${activeUpvotes.length}:${activeUpvotes.map((u) => u.targetId).slice(0, 30).join(',')}`,
            `${activeViews.length}:${activeViews.map((v) => v.trendId).slice(0, 30).join(',')}`,
        ].join('|');
    }, [
        dataSource,
        followedDomainSlugs,
        activeBookmarkRecords,
        upvoteRecords,
        sampleUpvoteRecords,
        sampleViewRecords,
        personalizationSignals.viewRecords,
    ]);

    const bookmarkIdsFingerprint = useMemo(
        () => activeBookmarkRecords.map((b) => b.targetId).join(','),
        [activeBookmarkRecords]
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

    // Primary feed fetch (ALL, FOR YOU, and FOLLOWING views)
    useEffect(() => {
        if (trendId || feedView === 'saved') {
            return;
        }

        const requestId = ++feedRequestIdRef.current;
        cursorRef.current = null;
        setFeedError(null);

        // 1. FOLLOWING FEED — strictly published trends from the user's followed domains
        if (feedView === 'following') {
            setPersonalizedReasons({});

            if (authLoading) {
                setLoading(true);
                setIsFetchingMore(false);
                return;
            }

            if (!isAuthenticated) {
                setTrends([]);
                setHasMore(false);
                setLoading(false);
                setIsFetchingMore(false);
                return;
            }

            if (preferencesLoading) {
                setLoading(true);
                setIsFetchingMore(false);
                return;
            }

            if (effectiveFollowingTargetDomains.length === 0) {
                setTrends([]);
                setHasMore(false);
                setLoading(false);
                setIsFetchingMore(false);
                return;
            }

            if (dataSource === 'dev_fallback') {
                const fallbackItems = queryFallbackMockTrends({
                    domainSlugs: effectiveFollowingTargetDomains,
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

            fetchFollowingTrendsPage({
                followedDomainSlugs,
                activeDomainSlug: activeFollowingDomainSlug,
                pageSize: PAGE_SIZE,
                cursor: null,
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
                    console.error('[TRENDZ_FOLLOWING_FEED_ERROR]', err);
                    setTrends([]);
                    setHasMore(false);
                    setFeedError(
                        err?.code === 'permission-denied'
                            ? 'Permission denied while loading your Following feed. Please verify you are signed in.'
                            : 'Unable to load published trends for your followed domains right now. Please retry.'
                    );
                    setLoading(false);
                });
            return;
        }

        // 2. FOR YOU FEED — deterministic multi-signal personalized ranking
        if (feedView === 'for-you') {
            setVisibleForYouCount(PAGE_SIZE);

            if (dataSource === 'dev_fallback') {
                const fallbackPool = queryFallbackMockTrends({
                    domainSlugs: selectedDomainSlugs,
                    searchQuery: debouncedSearch,
                    sortBy: 'latest',
                });
                const ranked = rankPersonalizedTrends(fallbackPool, activePersonalizationSignals);
                setTrends(ranked.items);
                setPersonalizedReasons(ranked.reasonsByTrendId);
                setHasPersonalizationSignals(ranked.hasPersonalizationSignals);
                setHasMore(ranked.items.length > PAGE_SIZE);
                setLoading(false);
                setIsFetchingMore(false);
                return;
            }

            if (authLoading || preferencesLoading) {
                setLoading(true);
                return;
            }

            setLoading(true);
            setIsFetchingMore(false);
            setHasMore(false);

            fetchPersonalizedTrendsFeed(personalizationSignals, {
                domainSlugs: selectedDomainSlugs,
                searchQuery: debouncedSearch,
                poolSize: 45,
            })
                .then((result) => {
                    if (feedRequestIdRef.current !== requestId) return;
                    const deduped = dedupeTrendsById(result.items);
                    setTrends(deduped);
                    setPersonalizedReasons(result.reasonsByTrendId);
                    setHasPersonalizationSignals(result.hasPersonalizationSignals);
                    setHasMore(deduped.length > PAGE_SIZE);
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

        // 3. STANDARD ALL FEED — general published Trendz feed
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

        if (authLoading) {
            setLoading(true);
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
        followedDomainsKey,
        effectiveFollowingKey,
        activeFollowingDomainSlug,
        debouncedSearch,
        sortBy,
        refreshKey,
        retryTick,
        selectedDomainSlugs,
        effectiveFollowingTargetDomains,
        followedDomainSlugs,
        isAuthenticated,
        authLoading,
        preferencesLoading,
        personalizationFingerprint,
        activePersonalizationSignals,
    ]);

    const savedEntriesRef = useRef<SavedTrendEntry[]>(savedEntries);
    savedEntriesRef.current = savedEntries;
    const savedHydrationForceKeyRef = useRef<string>('');

    // Saved Trends view hydration (/trendz/saved or /trendz?view=saved)
    // LIVE mode hydrates strictly from Firestore; DEV_FALLBACK mode hydrates strictly from local sample bookmarks.
    useEffect(() => {
        if (trendId || feedView !== 'saved') {
            return;
        }

        const uid = currentUser?.uid;

        if (dataSource === 'dev_fallback') {
            if (authLoading) {
                return;
            }
            if (!uid) {
                setSavedEntries([]);
                setSavedLoading(false);
                setSavedError(null);
                return;
            }
            setSavedEntries(hydrateSampleSavedTrendsFromBookmarks(sampleBookmarkRecords));
            setSavedLoading(false);
            setSavedError(null);
            return;
        }

        if (authLoading || preferencesLoading) {
            return;
        }

        if (!uid) {
            setSavedEntries([]);
            setSavedLoading(false);
            setSavedError(null);
            return;
        }

        if (bookmarkRecords.length === 0) {
            if (savedRetryTick > 0 && preferencesError) {
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
                return;
            }
            setSavedEntries([]);
            setSavedLoading(false);
            setSavedError(null);
            return;
        }

        const forceKey = `live:${uid}:${refreshKey}:${savedRetryTick}`;
        const isForceRefresh = savedHydrationForceKeyRef.current !== forceKey;
        const hydratedById = new Map(
            savedEntriesRef.current
                .filter((e) => !e.trend?.isFallback)
                .map((e) => [e.trendId, e])
        );
        const hasMissingBookmarks = bookmarkRecords.some((b) => !hydratedById.has(b.targetId));

        if (!isForceRefresh && !hasMissingBookmarks) {
            // Only removal/reordering occurred — reconcile immediately without flashing skeletons
            setSavedEntries(
                bookmarkRecords
                    .map((b) => hydratedById.get(b.targetId))
                    .filter((entry): entry is SavedTrendEntry => Boolean(entry))
            );
            setSavedLoading(false);
            setSavedError(null);
            return;
        }

        savedHydrationForceKeyRef.current = forceKey;
        const requestId = ++savedRequestIdRef.current;
        if (isForceRefresh || savedEntriesRef.current.length === 0) {
            setSavedLoading(true);
        }
        setSavedError(null);

        hydrateSavedTrendsFromBookmarks(bookmarkRecords)
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
    }, [
        trendId,
        feedView,
        dataSource,
        authLoading,
        preferencesLoading,
        preferencesError,
        currentUser?.uid,
        bookmarkIdsFingerprint,
        sampleBookmarkRecords,
        refreshKey,
        savedRetryTick,
    ]);

    // Keep Saved Trends list immediately synchronized when user removes a bookmark or searches
    const visibleSavedEntries = useMemo(() => {
        const activeEntries = savedEntries.filter((entry) =>
            activeBookmarkedTrendIds.has(entry.trendId)
        );
        const q = debouncedSearch.toLowerCase();
        if (!q) {
            return activeEntries;
        }
        return activeEntries.filter((entry) => {
            const title = (entry.trend?.title || entry.bookmark.trendTitle || '').toLowerCase();
            const summary = (entry.trend?.summary || entry.bookmark.trendSummary || '').toLowerCase();
            const publisher = (
                entry.trend?.details?.publishedBy ||
                entry.bookmark.trendPublisher ||
                ''
            ).toLowerCase();
            const domainName = formatTrendzDomainName(entry.bookmark.domainSlug).toLowerCase();
            return (
                title.includes(q) ||
                summary.includes(q) ||
                publisher.includes(q) ||
                domainName.includes(q)
            );
        });
    }, [savedEntries, activeBookmarkedTrendIds, debouncedSearch]);

    // Pagination loader: Firestore cursor pagination for ALL & FOLLOWING, bounded slice pagination for FOR YOU
    const loadMoreTrends = useCallback(() => {
        if (trendId || feedView === 'saved' || loading || isFetchingMore) {
            return;
        }

        if (feedView === 'for-you') {
            if (visibleForYouCount >= trends.length) {
                setHasMore(false);
                return;
            }
            const nextCount = visibleForYouCount + PAGE_SIZE;
            setVisibleForYouCount(nextCount);
            setHasMore(nextCount < trends.length);
            return;
        }

        if (dataSource !== 'live' || !hasMore || !cursorRef.current) {
            return;
        }

        const requestId = feedRequestIdRef.current;
        setIsFetchingMore(true);

        const nextPagePromise =
            feedView === 'following'
                ? fetchFollowingTrendsPage({
                      followedDomainSlugs,
                      activeDomainSlug: activeFollowingDomainSlug,
                      pageSize: PAGE_SIZE,
                      cursor: cursorRef.current,
                      sortBy,
                      searchQuery: debouncedSearch,
                  })
                : fetchPublishedTrendsPage({
                      pageSize: PAGE_SIZE,
                      cursor: cursorRef.current,
                      domainSlugs: selectedDomainSlugs,
                      sortBy,
                      searchQuery: debouncedSearch,
                  });

        nextPagePromise
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
    }, [
        trendId,
        feedView,
        dataSource,
        loading,
        isFetchingMore,
        hasMore,
        visibleForYouCount,
        trends.length,
        followedDomainSlugs,
        activeFollowingDomainSlug,
        selectedDomainSlugs,
        sortBy,
        debouncedSearch,
    ]);

    // IntersectionObserver for automatic pagination (ALL, FOLLOWING, and FOR YOU)
    const lastTrendElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (loading || isFetchingMore) return;
            if (observerRef.current) observerRef.current.disconnect();
            if (!node || !hasMore || feedView === 'saved') return;
            if ((feedView === 'all' || feedView === 'following') && dataSource !== 'live') return;

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

    // Scroll to top cleanly when opening or switching a dedicated Trend detail page
    useEffect(() => {
        if (trendId && typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [trendId]);

    // URL-driven individual trend detail loader (/trendz/:trendId)
    useEffect(() => {
        if (!trendId) {
            setSelectedTrend(null);
            setDetailLoading(false);
            setDetailError(null);
            setDetailNotFound(false);
            setDetailAccessState('ok');
            setRelatedMatches([]);
            setRelatedError(null);
            return;
        }

        const requestId = ++detailRequestIdRef.current;
        setDetailError(null);
        setDetailNotFound(false);
        setDetailAccessState('ok');

        if (dataSource === 'dev_fallback') {
            const mockMatch = getFallbackMockTrendById(trendId);
            if (mockMatch) {
                setSelectedTrend(mockMatch);
                setDetailNotFound(false);
                setDetailAccessState('ok');
            } else {
                setSelectedTrend(null);
                setDetailNotFound(true);
                setDetailAccessState('not_found');
            }
            setDetailLoading(false);
            return;
        }

        // Wait for Firebase Auth resolution on direct URL navigation / browser refresh
        if (authLoading) {
            setDetailLoading(true);
            return;
        }

        // Show cached live record immediately while refreshing from Firestore if available
        const cachedLive =
            trends.find((t) => !t.isFallback && t.id === trendId) ||
            savedEntries.find(
                (entry) => entry.trend && !entry.trend.isFallback && entry.trendId === trendId
            )?.trend ||
            null;

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
                    setDetailAccessState('not_found');
                } else {
                    setSelectedTrend(record);
                    setDetailNotFound(false);
                    setDetailAccessState('ok');
                }
                setDetailLoading(false);
            })
            .catch((err) => {
                if (detailRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_DETAIL_LOAD_ERROR]', err);
                const errCode = String(err?.code || '').toLowerCase();
                if (errCode === 'permission-denied') {
                    setSelectedTrend(null);
                    if (!isAuthenticated) {
                        setDetailAccessState('sign_in_required');
                        setDetailError('Sign in to access published Trendz briefings.');
                    } else {
                        setDetailNotFound(true);
                        setDetailAccessState('unavailable');
                        setDetailError(null);
                    }
                } else if (!cachedLive) {
                    setDetailAccessState('error');
                    setDetailError('Unable to retrieve this trend from Firestore.');
                }
                setDetailLoading(false);
            });
    }, [trendId, dataSource, authLoading, isAuthenticated, detailRetryTick]);

    // Keep a ref to already-loaded live published trends so Related Trends can reuse them without extra reads
    const knownLiveCandidatesRef = useRef<TrendViewModel[]>([]);
    knownLiveCandidatesRef.current = useMemo(() => {
        const pool: TrendViewModel[] = [];
        for (const item of trends) {
            if (!item.isFallback && item.status === 'published') {
                pool.push(item);
            }
        }
        for (const entry of savedEntries) {
            if (entry.trend && !entry.trend.isFallback && entry.trend.status === 'published') {
                pool.push(entry.trend);
            }
        }
        return dedupeTrendsById(pool);
    }, [trends, savedEntries]);

    const selectedTrendRelatedSignature = useMemo(() => {
        if (!selectedTrend) return '';
        return [
            selectedTrend.id,
            selectedTrend.isFallback ? 'dev' : 'live',
            selectedTrend.domainSlug,
            selectedTrend.category || '',
            selectedTrend.publishedAtMs || 0,
            (selectedTrend.tags || []).join(','),
            (selectedTrend.relatedTrendIds || []).join(','),
            selectedTrend.title || '',
        ].join('|');
    }, [selectedTrend]);

    const lastRelatedRetryTickRef = useRef(0);

    // Intelligent Related Trends loader (multi-signal topical ranking, cached per trend signature)
    useEffect(() => {
        if (!selectedTrend) {
            setRelatedMatches([]);
            setRelatedLoading(false);
            setRelatedError(null);
            return;
        }

        const requestId = ++relatedRequestIdRef.current;
        const isExplicitRetry = relatedRetryTick !== lastRelatedRetryTickRef.current;
        lastRelatedRetryTickRef.current = relatedRetryTick;
        setRelatedError(null);

        if (selectedTrend.isFallback || dataSource === 'dev_fallback') {
            const fallbackResult = getFallbackRelatedTrendsForTrend(selectedTrend, { maxCount: 4 });
            setRelatedMatches(fallbackResult.items);
            setRelatedLoading(false);
            return;
        }

        setRelatedLoading(true);
        fetchRelatedTrendsForTrend(selectedTrend, {
            maxCount: 4,
            knownCandidates: knownLiveCandidatesRef.current,
            forceRefresh: isExplicitRetry,
        })
            .then((result) => {
                if (relatedRequestIdRef.current !== requestId) return;
                setRelatedMatches(result.items);
                setRelatedError(null);
                setRelatedLoading(false);
            })
            .catch((err) => {
                if (relatedRequestIdRef.current !== requestId) return;
                console.error('[TRENDZ_RELATED_LOAD_ERROR]', err);
                setRelatedMatches([]);
                setRelatedError(
                    err?.code === 'permission-denied'
                        ? 'Permission denied while loading related trends.'
                        : 'Unable to load related trends right now.'
                );
                setRelatedLoading(false);
            });
    }, [selectedTrendRelatedSignature, dataSource, refreshKey, relatedRetryTick]);

    const handleRetryRelatedTrends = useCallback(() => {
        if (selectedTrend?.id) {
            clearRelatedTrendsCache(selectedTrend.id);
        }
        setRelatedRetryTick((prev) => prev + 1);
    }, [selectedTrend?.id]);

    const detailBackTarget = useMemo(
        () =>
            resolveDetailBackTarget({
                fromParam: searchParams.get('from'),
                sortParam: searchParams.get('sort'),
                isDevSource: dataSource === 'dev_fallback',
            }),
        [searchParams, dataSource]
    );

    const handleSelectTrend = useCallback(
        (trend: TrendViewModel) => {
            const targetPath = `/trendz/${encodeURIComponent(trend.id)}`;
            const params = new URLSearchParams();
            if (dataSource === 'dev_fallback' || trend.isFallback) params.set('source', 'dev');

            const activeFrom = trendId
                ? searchParams.get('from')
                : feedView === 'saved'
                  ? 'saved'
                  : feedView === 'following'
                    ? 'following'
                    : feedView === 'for-you'
                      ? 'for-you'
                      : null;

            if (activeFrom) params.set('from', activeFrom);

            const activeSort = trendId ? searchParams.get('sort') : sortBy;
            if (activeSort === 'momentum' && activeFrom !== 'for-you' && activeFrom !== 'saved') {
                params.set('sort', 'momentum');
            }

            const qs = params.toString();
            navigate(qs ? `${targetPath}?${qs}` : targetPath);
        },
        [navigate, dataSource, trendId, searchParams, feedView, sortBy]
    );

    const handleBackToFeed = useCallback(() => {
        navigate(detailBackTarget.path);
    }, [navigate, detailBackTarget.path]);

    const handleSelectDomainFromDetail = useCallback(
        (domainSlug: TrendzDomainSlug) => {
            const formatted = formatTrendzDomainName(domainSlug);
            updateCanonicalDomainSelection([formatted], null);
            navigate(dataSource === 'dev_fallback' ? '/trendz?source=dev' : '/trendz');
        },
        [updateCanonicalDomainSelection, navigate, dataSource]
    );

    const hasActiveFilters =
        feedView === 'following'
            ? Boolean(activeFollowingDomainSlug) || Boolean(debouncedSearch) || sortBy === 'momentum'
            : selectedDomainSlugs.length > 0 || Boolean(debouncedSearch) || sortBy === 'momentum';

    const displayedTrends = useMemo(
        () => (feedView === 'for-you' ? trends.slice(0, visibleForYouCount) : trends),
        [feedView, trends, visibleForYouCount]
    );

    // ==========================================
    // Detail View (/trendz/:trendId)
    // ==========================================
    if (trendId) {
        const isCurrentDetailBookmarked = activeBookmarkedTrendIds.has(trendId);
        const isDevDetail = dataSource === 'dev_fallback';

        if (detailLoading || authLoading) {
            return (
                <div className="space-y-4">
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-6">
                        <button
                            type="button"
                            onClick={handleBackToFeed}
                            className="flex items-center gap-2 mb-4 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                        >
                            <span>{detailBackTarget.label}</span>
                        </button>
                        <TrendzCardSkeleton />
                    </div>
                </div>
            );
        }

        if (detailAccessState === 'sign_in_required') {
            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-4">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">// SIGN_IN_REQUIRED</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        {detailError || 'Sign in to view published Trendz briefings.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={handleBackToFeed}
                            className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                        >
                            {detailBackTarget.label}
                        </button>
                    </div>
                </div>
            );
        }

        if (detailError) {
            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-4">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">// SIGNAL_FETCH_ERROR</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{detailError}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
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
                            {detailBackTarget.label}
                        </button>
                    </div>
                </div>
            );
        }

        if (detailNotFound || !selectedTrend) {
            const isUnavailable = detailAccessState === 'unavailable';
            return (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-4">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                        {isUnavailable ? '// SIGNAL_UNAVAILABLE' : '// SIGNAL_NOT_FOUND'}
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        {isUnavailable
                            ? 'This trend record is currently unpublished, archived, or no longer publicly available.'
                            : 'This trend record could not be found, has been removed, or is not published.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={handleBackToFeed}
                            className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                        >
                            {detailBackTarget.label}
                        </button>
                        {isCurrentDetailBookmarked && (
                            <button
                                type="button"
                                disabled={isBookmarkPending(trendId, isDevDetail)}
                                onClick={() => void removeBookmarkById(trendId, isDevDetail)}
                                className="px-3.5 py-2 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                {isBookmarkPending(trendId, isDevDetail) ? 'REMOVING...' : 'REMOVE FROM SAVED'}
                            </button>
                        )}
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

                <TrendzDetail
                    trend={selectedTrend}
                    onBack={handleBackToFeed}
                    backLabel={detailBackTarget.label}
                    onSelectDomain={handleSelectDomainFromDetail}
                />

                <RelatedTrendsSection
                    matches={relatedMatches}
                    loading={relatedLoading}
                    error={relatedError}
                    isFallbackMode={Boolean(selectedTrend.isFallback || dataSource === 'dev_fallback')}
                    onSelectTrend={handleSelectTrend}
                    onRetry={handleRetryRelatedTrends}
                />
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
            {/* Feed View Switcher (ALL / FOR YOU / FOLLOWING / SAVED) */}
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
                        onClick={() => handleSwitchFeedView('following')}
                        className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                            feedView === 'following'
                                ? 'bg-white text-black border-white font-bold'
                                : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                        }`}
                    >
                        FOLLOWING
                        {!preferencesLoading && isAuthenticated
                            ? ` [${followedDomainSlugs.length}]`
                            : ''}
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
                        SAVED
                        {!authLoading &&
                        (dataSource === 'dev_fallback' || !preferencesLoading) &&
                        isAuthenticated
                            ? ` [${activeBookmarkRecords.length}]`
                            : ''}
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
                    {dataSource === 'dev_fallback' && (
                        <div className="bg-[#0c0c0e] px-3.5 py-2.5 border border-zinc-700 flex items-center justify-between gap-3 font-mono text-[11px]">
                            <span className="text-zinc-300">
                                // DATA_SOURCE: DEV_FALLBACK (LOCAL SAMPLE BOOKMARKS)
                            </span>
                            <button
                                type="button"
                                onClick={handleSwitchToLive}
                                className="text-white underline hover:text-zinc-300 uppercase tracking-wider shrink-0"
                            >
                                SWITCH TO LIVE
                            </button>
                        </div>
                    )}

                    <div className="bg-[#0c0c0e] p-3.5 border border-zinc-800 flex items-center justify-between gap-3 font-mono">
                        <div>
                            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                                // SAVED_TRENDS
                            </h2>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                {dataSource === 'dev_fallback'
                                    ? 'Bookmarked sample trends stored locally for this account.'
                                    : 'Bookmarked industry developments synced to your account.'}
                            </p>
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0">
                            {debouncedSearch
                                ? `[${visibleSavedEntries.length}/${activeBookmarkRecords.length}]`
                                : `[${activeBookmarkRecords.length}]`}
                        </span>
                    </div>

                    {isAuthenticated && activeBookmarkRecords.length > 0 && (
                        <div>
                            <input
                                type="search"
                                placeholder="SEARCH_SAVED_TRENDS..."
                                value={localSearchInput}
                                onChange={(e) => handleSearchInputChange(e.target.value)}
                                className="w-full bg-[#0c0c0e] border border-zinc-800/90 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                            />
                        </div>
                    )}

                    {authLoading ||
                    savedLoading ||
                    (dataSource === 'live' && preferencesLoading) ? (
                        <>
                            <TrendzCardSkeleton />
                            <TrendzCardSkeleton />
                        </>
                    ) : !isAuthenticated ? (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">
                                // SIGN_IN_REQUIRED
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Sign in to view and manage your saved trends across sessions.
                            </p>
                        </div>
                    ) : dataSource === 'live' &&
                      (savedError || (preferencesError && bookmarkRecords.length === 0)) ? (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">
                                // SAVED_TRENDS_ERROR
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                {savedError || preferencesError}
                            </p>
                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        void refreshEngagement();
                                        setSavedRetryTick((prev) => prev + 1);
                                    }}
                                    className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                >
                                    RETRY
                                </button>
                            </div>
                        </div>
                    ) : visibleSavedEntries.length === 0 ? (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">
                                {debouncedSearch && activeBookmarkRecords.length > 0
                                    ? '// NO_MATCHING_SAVED_TRENDS'
                                    : '// NO_SAVED_TRENDS'}
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                {debouncedSearch && activeBookmarkRecords.length > 0
                                    ? 'No saved trends match your search query.'
                                    : "You haven't bookmarked any trends yet. Click the bookmark icon on any trend to save it here."}
                            </p>
                            <div className="pt-1">
                                {debouncedSearch && activeBookmarkRecords.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => handleSearchInputChange('')}
                                        className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                    >
                                        CLEAR SEARCH
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchFeedView('all')}
                                        className="px-3.5 py-2 bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                    >
                                        BROWSE ALL TRENDZ
                                    </button>
                                )}
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

                            const pendingRemove = isBookmarkPending(
                                entry.trendId,
                                dataSource === 'dev_fallback'
                            );
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
                                            onClick={() =>
                                                void removeBookmarkById(
                                                    entry.trendId,
                                                    dataSource === 'dev_fallback'
                                                )
                                            }
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

                    {/* Following Feed Context Banner & Controls */}
                    {feedView === 'following' && (
                        <div className="bg-[#0c0c0e] p-3.5 border border-zinc-800 font-mono space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                                        // FOLLOWING_FEED
                                        {activeFollowingDomainSlug
                                            ? ` :: ${formatTrendzDomainName(activeFollowingDomainSlug).toUpperCase()}`
                                            : ''}
                                    </p>
                                    <p className="text-[11px] text-zinc-400">
                                        {!isAuthenticated
                                            ? 'Sign in to follow domains and receive a dedicated stream of published trends.'
                                            : followedDomainSlugs.length === 0
                                                ? 'You are not following any domains yet. Follow domains below or from the sidebar to populate this feed.'
                                                : activeFollowingDomainSlug
                                                    ? `Showing published trends from ${formatTrendzDomainName(activeFollowingDomainSlug)} (${followedDomainSlugs.length} followed domains total).`
                                                    : `Showing published trends across all ${followedDomainSlugs.length} followed domain${followedDomainSlugs.length === 1 ? '' : 's'}.`}
                                    </p>
                                </div>
                                {isAuthenticated && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {followedDomainSlugs.length > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetSortBy('latest')}
                                                    className={`px-2 py-1 text-[10px] uppercase tracking-wider border transition-colors ${
                                                        sortBy === 'latest'
                                                            ? 'bg-white text-black border-white font-bold'
                                                            : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                                    }`}
                                                >
                                                    LATEST
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetSortBy('momentum')}
                                                    className={`px-2 py-1 text-[10px] uppercase tracking-wider border transition-colors ${
                                                        sortBy === 'momentum'
                                                            ? 'bg-white text-black border-white font-bold'
                                                            : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                                    }`}
                                                >
                                                    MOMENTUM
                                                </button>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileManageDomains((prev) => !prev)}
                                            className="lg:hidden px-2 py-1 text-[10px] uppercase tracking-wider border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
                                        >
                                            {showMobileManageDomains ? 'CLOSE' : 'MANAGE'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Responsive mobile/tablet domain management panel (desktop uses RightSidebar) */}
                            {isAuthenticated && showMobileManageDomains && (
                                <div className="lg:hidden pt-2 border-t border-zinc-800/80 space-y-2">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                        // MANAGE_FOLLOWED_DOMAINS
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TRENDZ_DOMAINS.map((domain) => {
                                            const followed = isDomainFollowed(domain.slug);
                                            const pending = isDomainPending(domain.slug);
                                            return (
                                                <button
                                                    key={domain.slug}
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        void (followed
                                                            ? unfollowDomain(domain.slug)
                                                            : followDomain(domain.slug))
                                                    }
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

                    {/* Personalized ("For You") Context Banner */}
                    {feedView === 'for-you' && (
                        <div className="bg-[#0c0c0e] p-3.5 border border-zinc-800 font-mono space-y-2.5">
                            {!isAuthenticated ? (
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                                        // SIGN_IN_TO_PERSONALIZE
                                    </p>
                                    <p className="text-[11px] text-zinc-400">
                                        Showing balanced high-momentum and fresh trends. Sign in to personalize by followed domains, bookmarks, upvotes, and recent views.
                                    </p>
                                </div>
                            ) : hasPersonalizationSignals ? (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                                            // FOR_YOU_FEED
                                        </p>
                                        <p className="text-[11px] text-zinc-400">
                                            Ranked by followed domains ({followedDomainSlugs.length}), bookmarks ({bookmarkRecords.length}), upvotes ({upvoteRecords.length}), recent views ({personalizationSignals.viewRecords.length}), momentum, freshness &amp; domain diversity.
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
                                            No personal signals yet — showing diverse high-momentum &amp; fresh signals. Follow domains below to tailor your recommendations:
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

                    {/* Active Single Domain Banner with Follow/Unfollow Control (ALL & FOR YOU) */}
                    {feedView !== 'following' &&
                        (followedDomainsFilter || soleSelectedDomainSlug) &&
                        soleSelectedDomainSlug &&
                        soleSelectedDomainName && (
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

                    {/* Following Mode Filter Bar (All Following + each followed domain) */}
                    {feedView === 'following' && isAuthenticated && followedDomainSlugs.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                            <button
                                type="button"
                                onClick={() => handleFollowingChipClick(null)}
                                className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                                    activeFollowingDomainSlug === null
                                        ? 'bg-white text-black border-white font-bold'
                                        : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                ALL FOLLOWING [{followedDomainSlugs.length}]
                            </button>
                            {followedDomainSlugs.map((slug) => {
                                const name = formatTrendzDomainName(slug);
                                const isActive = activeFollowingDomainSlug === slug;
                                return (
                                    <button
                                        type="button"
                                        key={slug}
                                        onClick={() => handleFollowingChipClick(slug)}
                                        className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                                            isActive
                                                ? 'bg-white text-black border-white font-bold'
                                                : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                        }`}
                                    >
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Category Filter Pills for ALL & FOR YOU (synchronized with canonical domain registry) */}
                    {feedView !== 'following' && (
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
                    )}

                    {/* Search Bar (shown in ALL, FOR YOU, and active FOLLOWING) */}
                    {(feedView !== 'following' || (isAuthenticated && followedDomainSlugs.length > 0)) && (
                        <div className="mb-4">
                            <input
                                type="search"
                                placeholder={
                                    feedView === 'following'
                                        ? 'SEARCH_FOLLOWING_TRENDS...'
                                        : 'SEARCH_TRENDS_OR_DOMAINS...'
                                }
                                value={localSearchInput}
                                onChange={(e) => handleSearchInputChange(e.target.value)}
                                className="w-full bg-[#0c0c0e] border border-zinc-800/90 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                            />
                        </div>
                    )}

                    {/* DomainFilter Dropdown (ALL & FOR YOU) */}
                    {feedView !== 'following' && (
                        <DomainFilter
                            domains={trendzDomains}
                            selectedDomains={selectedDomainNames}
                            onSelectionChange={(domains) => updateCanonicalDomainSelection(domains)}
                        />
                    )}

                    {/* Active Momentum Sort Banner (ALL mode — Following has inline sort toggle) */}
                    {feedView === 'all' && sortBy === 'momentum' && (
                        <div className="bg-[#0c0c0e] px-3.5 py-2.5 border border-zinc-800 flex items-center justify-between gap-2 font-mono text-xs">
                            <span className="text-white uppercase tracking-wider">// SORT: MOMENTUM_NOW</span>
                            <button
                                type="button"
                                onClick={() => handleSetSortBy('latest')}
                                className="text-[10px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 uppercase tracking-wider transition-colors"
                            >
                                SHOW LATEST
                            </button>
                        </div>
                    )}

                    {/* Main Feed Stream */}
                    <div className="mt-4">
                        {feedView === 'following' && !isAuthenticated ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                    // SIGN_IN_REQUIRED
                                </p>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    Sign in to follow Trendz domains and view your dedicated Following stream.
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
                        ) : feedView === 'following' && !preferencesLoading && followedDomainSlugs.length === 0 ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-4">
                                <div className="space-y-1.5">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">
                                        // NO_FOLLOWED_DOMAINS
                                    </p>
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        Follow one or more domains below to build your Following stream. Published trends from your followed domains will appear here immediately.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {TRENDZ_DOMAINS.map((domain) => {
                                        const pending = isDomainPending(domain.slug);
                                        return (
                                            <button
                                                key={domain.slug}
                                                type="button"
                                                disabled={pending}
                                                onClick={() => void followDomain(domain.slug)}
                                                className="px-2.5 py-1.5 text-[11px] uppercase tracking-wider border bg-black text-zinc-300 border-zinc-800 hover:border-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                                            >
                                                {pending ? '...' : `+ ${domain.name}`}
                                            </button>
                                        );
                                    })}
                                </div>
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
                        ) : loading ? (
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
                        ) : displayedTrends.length === 0 ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-6 font-mono space-y-3">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                    {hasActiveFilters
                                        ? '// NO_MATCHING_SIGNALS'
                                        : feedView === 'following'
                                            ? '// NO_FOLLOWING_SIGNALS'
                                            : feedView === 'for-you'
                                                ? '// NO_PERSONALIZED_RECOMMENDATIONS'
                                                : '// NO_PUBLISHED_SIGNALS'}
                                </p>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    {hasActiveFilters
                                        ? 'No published Trendz match your active domain filter or search query.'
                                        : feedView === 'following'
                                            ? 'No published Trendz are currently available in your followed domains. Follow additional domains or browse All Trendz.'
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
                                            {(feedView === 'for-you' || feedView === 'following') && (
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
                            displayedTrends.map((trend, index) => {
                                const reason =
                                    feedView === 'for-you'
                                        ? personalizedReasons[trend.id]
                                        : undefined;
                                const isLastItem = displayedTrends.length === index + 1;
                                const attachPaginationRef =
                                    isLastItem &&
                                    (feedView === 'all' ||
                                        feedView === 'following' ||
                                        feedView === 'for-you');
                                if (attachPaginationRef) {
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
                            displayedTrends.length > 0 &&
                            (feedView === 'for-you' ||
                                ((feedView === 'all' || feedView === 'following') &&
                                    dataSource === 'live')) && (
                                <button
                                    type="button"
                                    onClick={loadMoreTrends}
                                    className="px-4 py-2 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                                >
                                    LOAD MORE SIGNALS
                                </button>
                            )}
                        {!hasMore && displayedTrends.length > 0 && !loading && !isFetchingMore && (
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