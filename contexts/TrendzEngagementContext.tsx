import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    bookmarkTrend as persistTrendBookmark,
    buildSampleBookmarkRecord,
    buildSampleUpvoteRecord,
    dedupeTrendBookmarkRecords,
    dedupeTrendUpvoteRecords,
    dedupeTrendViewRecords,
    fetchUserFollowedTrendDomains,
    fetchUserTrendBookmarks,
    fetchUserTrendUpvotes,
    fetchUserTrendViews,
    followTrendDomain,
    loadAnonymousTrendViews,
    loadSampleBookmarkRecords,
    loadSampleUpvoteRecords,
    loadSampleViewRecords,
    normalizeFollowedTrendDomains,
    recordAnonymousTrendView,
    recordSampleTrendView,
    recordTrendView,
    removeTrendBookmarkById,
    saveSampleBookmarkIds,
    saveSampleUpvoteIds,
    toggleTrendBookmark,
    toggleTrendUpvote,
    unfollowTrendDomain,
    type PersonalizationSignals,
    type TrendBookmarkRecord,
    type TrendUpvoteRecord,
    type TrendViewModel,
    type TrendViewRecord,
} from '../services/trendzService';
import {
    formatTrendzDomainName,
    normalizeTrendzDomainSlug,
    type TrendzDomainSlug,
} from '../utils/trendzDomains';

export interface TrendStatsOverride {
    likes?: number;
    views?: number;
    saves?: number;
}

interface TrendzEngagementContextValue {
    isAuthenticated: boolean;
    authLoading: boolean;
    preferencesLoading: boolean;
    preferencesError: string | null;
    actionError: string | null;
    clearActionError: () => void;
    refreshEngagement: () => Promise<void>;

    // Domain following
    followedDomainSlugs: TrendzDomainSlug[];
    isDomainFollowed: (rawDomain: string) => boolean;
    isDomainPending: (rawDomain: string) => boolean;
    followDomain: (rawDomain: string) => Promise<boolean>;
    unfollowDomain: (rawDomain: string) => Promise<boolean>;
    toggleFollowDomain: (rawDomain: string) => Promise<boolean>;

    // Bookmarks (LIVE Firestore + isolated DEV_FALLBACK localStorage)
    bookmarkRecords: TrendBookmarkRecord[];
    bookmarkedTrendIds: Set<string>;
    sampleBookmarkRecords: TrendBookmarkRecord[];
    sampleBookmarkedTrendIds: Set<string>;
    isTrendBookmarked: (trendId: string, isFallback?: boolean) => boolean;
    isBookmarkPending: (trendId: string, isFallback?: boolean) => boolean;
    bookmarkTrend: (trend: TrendViewModel) => Promise<boolean>;
    unbookmarkTrend: (trendId: string, isFallback?: boolean) => Promise<boolean>;
    toggleBookmark: (trend: TrendViewModel) => Promise<boolean>;
    removeBookmarkById: (trendId: string, isFallback?: boolean) => Promise<boolean>;

    // Upvotes (LIVE Firestore + isolated DEV_FALLBACK localStorage)
    upvoteRecords: TrendUpvoteRecord[];
    upvotedTrendIds: Set<string>;
    sampleUpvoteRecords: TrendUpvoteRecord[];
    sampleUpvotedTrendIds: Set<string>;
    isTrendUpvoted: (trendId: string, isFallback?: boolean) => boolean;
    isUpvotePending: (trendId: string, isFallback?: boolean) => boolean;
    toggleUpvote: (trend: TrendViewModel) => Promise<boolean>;

    // Views (LIVE auth Firestore / anon local + isolated DEV_FALLBACK local)
    viewRecords: TrendViewRecord[];
    sampleViewRecords: TrendViewRecord[];
    trackTrendView: (trend: TrendViewModel) => Promise<void>;

    // Live count sync across cards & detail views
    statsOverrides: Record<string, TrendStatsOverride>;
    getDisplayStats: (trend: TrendViewModel) => { likes: number; views: number; comments: number; saves: number };

    // Personalization signals bundles (strictly separated LIVE vs DEV_FALLBACK)
    personalizationSignals: PersonalizationSignals;
    samplePersonalizationSignals: PersonalizationSignals;
}

const TrendzEngagementContext = createContext<TrendzEngagementContextValue | undefined>(undefined);

function formatFirebaseActionError(err: any, fallbackMessage: string): string {
    const code = String(err?.code || '').toLowerCase();
    if (code === 'permission-denied') {
        return 'Permission denied while updating Trendz preferences. Please verify your sign-in session and Firestore rules.';
    }
    if (code === 'unavailable' || code === 'network-request-failed') {
        return 'Network unavailable. Could not sync your changes to Firestore.';
    }
    if (typeof err?.message === 'string' && err.message.trim()) {
        return err.message.trim();
    }
    return fallbackMessage;
}

export const TrendzEngagementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, loading: authLoading } = useAuth();
    const uid = currentUser?.uid || null;

    const [followedDomainSlugs, setFollowedDomainSlugs] = useState<TrendzDomainSlug[]>([]);
    const [bookmarkRecords, setBookmarkRecords] = useState<TrendBookmarkRecord[]>([]);
    const [sampleBookmarkRecords, setSampleBookmarkRecords] = useState<TrendBookmarkRecord[]>([]);
    const [upvoteRecords, setUpvoteRecords] = useState<TrendUpvoteRecord[]>([]);
    const [sampleUpvoteRecords, setSampleUpvoteRecords] = useState<TrendUpvoteRecord[]>([]);
    const [viewRecords, setViewRecords] = useState<TrendViewRecord[]>([]);
    const [sampleViewRecords, setSampleViewRecords] = useState<TrendViewRecord[]>([]);
    const [statsOverrides, setStatsOverrides] = useState<Record<string, TrendStatsOverride>>({});

    const [preferencesLoading, setPreferencesLoading] = useState(false);
    const [preferencesError, setPreferencesError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const [pendingDomains, setPendingDomains] = useState<Set<string>>(new Set());
    const [pendingBookmarks, setPendingBookmarks] = useState<Set<string>>(new Set());
    const [pendingUpvotes, setPendingUpvotes] = useState<Set<string>>(new Set());

    const loadSeqRef = useRef(0);
    const activeUidRef = useRef<string | null>(uid);
    activeUidRef.current = uid;
    const pendingDomainsRef = useRef<Set<string>>(new Set());
    const followedDomainSlugsRef = useRef<TrendzDomainSlug[]>(followedDomainSlugs);
    followedDomainSlugsRef.current = followedDomainSlugs;
    const pendingBookmarksRef = useRef<Set<string>>(new Set());
    const bookmarkRecordsRef = useRef<TrendBookmarkRecord[]>(bookmarkRecords);
    bookmarkRecordsRef.current = bookmarkRecords;
    const sampleBookmarkRecordsRef = useRef<TrendBookmarkRecord[]>(sampleBookmarkRecords);
    sampleBookmarkRecordsRef.current = sampleBookmarkRecords;
    const pendingUpvotesRef = useRef<Set<string>>(new Set());
    const upvoteRecordsRef = useRef<TrendUpvoteRecord[]>(upvoteRecords);
    upvoteRecordsRef.current = upvoteRecords;
    const sampleUpvoteRecordsRef = useRef<TrendUpvoteRecord[]>(sampleUpvoteRecords);
    sampleUpvoteRecordsRef.current = sampleUpvoteRecords;
    const sampleViewRecordsRef = useRef<TrendViewRecord[]>(sampleViewRecords);
    sampleViewRecordsRef.current = sampleViewRecords;
    const inFlightViewTracksRef = useRef<Set<string>>(new Set());
    const statsOverridesRef = useRef<Record<string, TrendStatsOverride>>(statsOverrides);
    statsOverridesRef.current = statsOverrides;

    const loadUserEngagement = useCallback(async (targetUid: string | null) => {
        const seq = ++loadSeqRef.current;

        if (!targetUid) {
            const anonViews = loadAnonymousTrendViews();
            const anonSampleViews = loadSampleViewRecords(null);
            followedDomainSlugsRef.current = [];
            bookmarkRecordsRef.current = [];
            sampleBookmarkRecordsRef.current = [];
            upvoteRecordsRef.current = [];
            sampleUpvoteRecordsRef.current = [];
            sampleViewRecordsRef.current = anonSampleViews;
            pendingDomainsRef.current = new Set();
            pendingBookmarksRef.current = new Set();
            pendingUpvotesRef.current = new Set();
            inFlightViewTracksRef.current = new Set();
            statsOverridesRef.current = {};
            setFollowedDomainSlugs([]);
            setBookmarkRecords([]);
            setSampleBookmarkRecords([]);
            setUpvoteRecords([]);
            setSampleUpvoteRecords([]);
            setViewRecords(anonViews);
            setSampleViewRecords(anonSampleViews);
            setStatsOverrides({});
            setPendingDomains(new Set());
            setPendingBookmarks(new Set());
            setPendingUpvotes(new Set());
            setPreferencesLoading(false);
            setPreferencesError(null);
            setActionError(null);
            return;
        }

        // Immediately restore user-scoped DEV_FALLBACK sample engagement from localStorage
        const restoredSampleBookmarks = loadSampleBookmarkRecords(targetUid);
        const restoredSampleUpvotes = loadSampleUpvoteRecords(targetUid);
        const restoredSampleViews = loadSampleViewRecords(targetUid);
        sampleBookmarkRecordsRef.current = restoredSampleBookmarks;
        sampleUpvoteRecordsRef.current = restoredSampleUpvotes;
        sampleViewRecordsRef.current = restoredSampleViews;
        setSampleBookmarkRecords(restoredSampleBookmarks);
        setSampleUpvoteRecords(restoredSampleUpvotes);
        setSampleViewRecords(restoredSampleViews);

        setPreferencesLoading(true);
        setPreferencesError(null);

        const [domainsRes, bookmarksRes, upvotesRes, viewsRes] = await Promise.allSettled([
            fetchUserFollowedTrendDomains(targetUid),
            fetchUserTrendBookmarks(targetUid),
            fetchUserTrendUpvotes(targetUid),
            fetchUserTrendViews(targetUid),
        ]);

        if (loadSeqRef.current !== seq || activeUidRef.current !== targetUid) {
            return;
        }

        const errors: string[] = [];

        if (domainsRes.status === 'fulfilled') {
            followedDomainSlugsRef.current = domainsRes.value;
            setFollowedDomainSlugs(domainsRes.value);
        } else {
            followedDomainSlugsRef.current = [];
            setFollowedDomainSlugs([]);
            errors.push('followed domains');
            console.error('[TRENDZ_LOAD_DOMAINS_ERROR]', domainsRes.reason);
        }

        if (bookmarksRes.status === 'fulfilled') {
            const deduped = dedupeTrendBookmarkRecords(bookmarksRes.value);
            bookmarkRecordsRef.current = deduped;
            setBookmarkRecords(deduped);
        } else {
            bookmarkRecordsRef.current = [];
            setBookmarkRecords([]);
            errors.push('saved trends');
            console.error('[TRENDZ_LOAD_BOOKMARKS_ERROR]', bookmarksRes.reason);
        }

        if (upvotesRes.status === 'fulfilled') {
            const dedupedUpvotes = dedupeTrendUpvoteRecords(upvotesRes.value);
            upvoteRecordsRef.current = dedupedUpvotes;
            setUpvoteRecords(dedupedUpvotes);
        } else {
            upvoteRecordsRef.current = [];
            setUpvoteRecords([]);
            errors.push('upvotes');
            console.error('[TRENDZ_LOAD_UPVOTES_ERROR]', upvotesRes.reason);
        }

        if (viewsRes.status === 'fulfilled') {
            setViewRecords(dedupeTrendViewRecords(viewsRes.value));
        } else {
            setViewRecords([]);
            console.warn('[TRENDZ_LOAD_VIEWS_WARN]', viewsRes.reason);
        }

        if (errors.length > 0) {
            setPreferencesError(
                `Unable to load your ${errors.join(', ')} from Firestore. Retry or check permissions.`
            );
        }

        setPreferencesLoading(false);
    }, []);

    // Strict user isolation: reset & reload whenever authenticated user changes.
    // Guard: do not fire while authLoading is true — the Firebase Auth token has not
    // propagated to Firestore yet, which causes a permission-denied error on getDoc.
    useEffect(() => {
        if (authLoading) {
            // Auth state is still resolving; do not attempt Firestore reads yet.
            return;
        }
        followedDomainSlugsRef.current = [];
        bookmarkRecordsRef.current = [];
        sampleBookmarkRecordsRef.current = [];
        upvoteRecordsRef.current = [];
        sampleUpvoteRecordsRef.current = [];
        sampleViewRecordsRef.current = [];
        pendingDomainsRef.current = new Set();
        pendingBookmarksRef.current = new Set();
        pendingUpvotesRef.current = new Set();
        inFlightViewTracksRef.current = new Set();
        statsOverridesRef.current = {};
        setFollowedDomainSlugs([]);
        setBookmarkRecords([]);
        setSampleBookmarkRecords([]);
        setUpvoteRecords([]);
        setSampleUpvoteRecords([]);
        setViewRecords([]);
        setSampleViewRecords([]);
        setStatsOverrides({});
        setPendingDomains(new Set());
        setPendingBookmarks(new Set());
        setPendingUpvotes(new Set());
        setPreferencesError(null);
        setActionError(null);
        void loadUserEngagement(uid);
    }, [uid, authLoading, loadUserEngagement]);

    const refreshEngagement = useCallback(async () => {
        if (authLoading) {
            return;
        }
        await loadUserEngagement(uid);
    }, [uid, authLoading, loadUserEngagement]);

    const clearActionError = useCallback(() => {
        setActionError(null);
    }, []);

    const followedDomainSet = useMemo(() => new Set<TrendzDomainSlug>(followedDomainSlugs), [followedDomainSlugs]);

    const bookmarkedTrendIds = useMemo(
        () => new Set<string>(bookmarkRecords.map((b) => b.targetId)),
        [bookmarkRecords]
    );

    const sampleBookmarkedTrendIds = useMemo(
        () => new Set<string>(sampleBookmarkRecords.map((b) => b.targetId)),
        [sampleBookmarkRecords]
    );

    const upvotedTrendIds = useMemo(
        () => new Set<string>(upvoteRecords.map((u) => u.targetId)),
        [upvoteRecords]
    );

    const sampleUpvotedTrendIds = useMemo(
        () => new Set<string>(sampleUpvoteRecords.map((u) => u.targetId)),
        [sampleUpvoteRecords]
    );

    const sampleViewedTrendIds = useMemo(
        () => new Set<string>(sampleViewRecords.map((v) => v.trendId)),
        [sampleViewRecords]
    );

    const isDomainFollowed = useCallback(
        (rawDomain: string): boolean => {
            const slug = normalizeTrendzDomainSlug(rawDomain);
            return slug ? followedDomainSet.has(slug) : false;
        },
        [followedDomainSet]
    );

    const isDomainPending = useCallback(
        (rawDomain: string): boolean => {
            const slug = normalizeTrendzDomainSlug(rawDomain);
            return slug ? pendingDomains.has(slug) : false;
        },
        [pendingDomains]
    );

    const isTrendBookmarked = useCallback(
        (trendId: string, isFallback = false): boolean =>
            isFallback ? sampleBookmarkedTrendIds.has(trendId) : bookmarkedTrendIds.has(trendId),
        [bookmarkedTrendIds, sampleBookmarkedTrendIds]
    );

    const isBookmarkPending = useCallback(
        (trendId: string, isFallback = false): boolean =>
            isFallback ? false : pendingBookmarks.has(trendId),
        [pendingBookmarks]
    );

    const isTrendUpvoted = useCallback(
        (trendId: string, isFallback = false): boolean =>
            isFallback ? sampleUpvotedTrendIds.has(trendId) : upvotedTrendIds.has(trendId),
        [upvotedTrendIds, sampleUpvotedTrendIds]
    );

    const isUpvotePending = useCallback(
        (trendId: string, isFallback = false): boolean =>
            isFallback ? false : pendingUpvotes.has(trendId),
        [pendingUpvotes]
    );

    const mutateDomainFollow = useCallback(
        async (rawDomain: string, intent: 'follow' | 'unfollow' | 'toggle'): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to follow or unfollow Trendz domains.');
                return false;
            }
            const slug = normalizeTrendzDomainSlug(rawDomain);
            if (!slug) {
                setActionError('Invalid Trendz domain selected.');
                return false;
            }
            if (pendingDomainsRef.current.has(slug)) {
                return false;
            }

            const previous = followedDomainSlugsRef.current;
            const currentlyFollowed = previous.includes(slug);
            const shouldFollow =
                intent === 'follow' ? true : intent === 'unfollow' ? false : !currentlyFollowed;

            if (shouldFollow && currentlyFollowed) {
                return true;
            }
            if (!shouldFollow && !currentlyFollowed) {
                return true;
            }

            const optimisticNext = shouldFollow
                ? normalizeFollowedTrendDomains([...previous, slug])
                : previous.filter((item) => item !== slug);

            setActionError(null);
            followedDomainSlugsRef.current = optimisticNext;
            setFollowedDomainSlugs(optimisticNext);

            pendingDomainsRef.current.add(slug);
            setPendingDomains((prev) => {
                const next = new Set(prev);
                next.add(slug);
                return next;
            });

            try {
                const persisted = shouldFollow
                    ? await followTrendDomain(uid, slug)
                    : await unfollowTrendDomain(uid, slug);

                if (activeUidRef.current === uid) {
                    followedDomainSlugsRef.current = persisted;
                    setFollowedDomainSlugs(persisted);
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_FOLLOW_DOMAIN_ERROR]', err);
                if (activeUidRef.current === uid) {
                    followedDomainSlugsRef.current = previous;
                    setFollowedDomainSlugs(previous);
                    setActionError(
                        formatFirebaseActionError(
                            err,
                            `Failed to ${shouldFollow ? 'follow' : 'unfollow'} ${formatTrendzDomainName(slug)}.`
                        )
                    );
                }
                return false;
            } finally {
                pendingDomainsRef.current.delete(slug);
                setPendingDomains((prev) => {
                    const next = new Set(prev);
                    next.delete(slug);
                    return next;
                });
            }
        },
        [uid]
    );

    const followDomain = useCallback(
        (rawDomain: string) => mutateDomainFollow(rawDomain, 'follow'),
        [mutateDomainFollow]
    );

    const unfollowDomain = useCallback(
        (rawDomain: string) => mutateDomainFollow(rawDomain, 'unfollow'),
        [mutateDomainFollow]
    );

    const toggleFollowDomain = useCallback(
        (rawDomain: string) => mutateDomainFollow(rawDomain, 'toggle'),
        [mutateDomainFollow]
    );

    const toggleBookmark = useCallback(
        async (trend: TrendViewModel): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to bookmark trends.');
                return false;
            }

            // DEV_FALLBACK sample trends: store locally per user in localStorage (never write to Firestore)
            if (trend.isFallback) {
                setActionError(null);
                const previousSample = sampleBookmarkRecordsRef.current;
                const wasBookmarked = previousSample.some((item) => item.targetId === trend.id);
                let nextSample: TrendBookmarkRecord[];

                if (wasBookmarked) {
                    nextSample = previousSample.filter((item) => item.targetId !== trend.id);
                } else {
                    const newRecord = buildSampleBookmarkRecord(uid, trend, Date.now());
                    nextSample = dedupeTrendBookmarkRecords([
                        newRecord,
                        ...previousSample.filter((item) => item.targetId !== trend.id),
                    ]);
                }

                const persistedIds = saveSampleBookmarkIds(
                    uid,
                    nextSample.map((item) => item.targetId)
                );
                const persistedIdSet = new Set(persistedIds);
                const normalizedNext = nextSample.filter((item) => persistedIdSet.has(item.targetId));

                sampleBookmarkRecordsRef.current = normalizedNext;
                setSampleBookmarkRecords(normalizedNext);
                return true;
            }

            if (pendingBookmarksRef.current.has(trend.id)) {
                return false;
            }

            const previousRecords = bookmarkRecordsRef.current;
            const wasBookmarked = previousRecords.some((item) => item.targetId === trend.id);
            const previousOverride = statsOverridesRef.current[trend.id];
            const currentDisplayedSaves = previousOverride?.saves ?? trend.savesCount ?? 0;
            const optimisticSaves = Math.max(0, currentDisplayedSaves + (wasBookmarked ? -1 : 1));

            setActionError(null);
            pendingBookmarksRef.current.add(trend.id);
            setPendingBookmarks((prev) => {
                const next = new Set(prev);
                next.add(trend.id);
                return next;
            });

            // Immediate optimistic UI update (both bookmark list and save count)
            setStatsOverrides((prev) => {
                const next = {
                    ...prev,
                    [trend.id]: {
                        ...prev[trend.id],
                        saves: optimisticSaves,
                    },
                };
                statsOverridesRef.current = next;
                return next;
            });

            if (wasBookmarked) {
                const nextRecords = previousRecords.filter((item) => item.targetId !== trend.id);
                bookmarkRecordsRef.current = nextRecords;
                setBookmarkRecords(nextRecords);
            } else {
                const optimisticRecord: TrendBookmarkRecord = {
                    id: `${uid}_trendz_${trend.id}`,
                    userId: uid,
                    targetType: 'trendz',
                    targetId: trend.id,
                    domainSlug: trend.domainSlug,
                    trendTitle: (trend.title || '').trim() || 'Untitled Trend',
                    trendSummary: (trend.summary || '').trim(),
                    trendPublisher: (trend.details?.publishedBy || '').trim() || 'INVOX Desk',
                    trendPublishedOn: (trend.details?.publishedOn || '').trim() || 'RECENT',
                    trendMediaUrl: trend.mediaUrl || '',
                    trendMediaType: trend.mediaType === 'video' ? 'video' : 'image',
                    createdAtMs: Date.now(),
                };
                const nextRecords = dedupeTrendBookmarkRecords([
                    optimisticRecord,
                    ...previousRecords.filter((item) => item.targetId !== trend.id),
                ]);
                bookmarkRecordsRef.current = nextRecords;
                setBookmarkRecords(nextRecords);
            }

            try {
                const result = await toggleTrendBookmark(uid, trend);
                if (activeUidRef.current === uid) {
                    setStatsOverrides((prev) => {
                        const next = {
                            ...prev,
                            [trend.id]: {
                                ...prev[trend.id],
                                saves: result.savesCount,
                            },
                        };
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setBookmarkRecords((prev) => {
                        const updated =
                            result.bookmarked && result.bookmark
                                ? dedupeTrendBookmarkRecords([
                                      result.bookmark,
                                      ...prev.filter((item) => item.targetId !== trend.id),
                                  ])
                                : prev.filter((item) => item.targetId !== trend.id);
                        bookmarkRecordsRef.current = updated;
                        return updated;
                    });
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_BOOKMARK_ERROR]', err);
                if (activeUidRef.current === uid) {
                    bookmarkRecordsRef.current = previousRecords;
                    setBookmarkRecords(previousRecords);
                    setStatsOverrides((prev) => {
                        const next = { ...prev };
                        if (previousOverride) {
                            next[trend.id] = previousOverride;
                        } else {
                            delete next[trend.id];
                        }
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setActionError(
                        formatFirebaseActionError(
                            err,
                            `Failed to ${wasBookmarked ? 'remove bookmark for' : 'bookmark'} this trend.`
                        )
                    );
                }
                return false;
            } finally {
                pendingBookmarksRef.current.delete(trend.id);
                setPendingBookmarks((prev) => {
                    const next = new Set(prev);
                    next.delete(trend.id);
                    return next;
                });
            }
        },
        [uid]
    );

    const bookmarkTrend = useCallback(
        async (trend: TrendViewModel): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to bookmark trends.');
                return false;
            }

            // DEV_FALLBACK sample trends: store locally per user in localStorage (never write to Firestore)
            if (trend.isFallback) {
                setActionError(null);
                const previousSample = sampleBookmarkRecordsRef.current;
                if (previousSample.some((item) => item.targetId === trend.id)) {
                    return true;
                }
                const newRecord = buildSampleBookmarkRecord(uid, trend, Date.now());
                const nextSample = dedupeTrendBookmarkRecords([
                    newRecord,
                    ...previousSample.filter((item) => item.targetId !== trend.id),
                ]);
                const persistedIds = saveSampleBookmarkIds(
                    uid,
                    nextSample.map((item) => item.targetId)
                );
                const persistedIdSet = new Set(persistedIds);
                const normalizedNext = nextSample.filter((item) => persistedIdSet.has(item.targetId));
                sampleBookmarkRecordsRef.current = normalizedNext;
                setSampleBookmarkRecords(normalizedNext);
                return true;
            }

            if (bookmarkRecordsRef.current.some((item) => item.targetId === trend.id)) {
                return true;
            }
            if (pendingBookmarksRef.current.has(trend.id)) {
                return false;
            }

            const previousRecords = bookmarkRecordsRef.current;
            const previousOverride = statsOverridesRef.current[trend.id];
            const optimisticSaves = Math.max(0, (previousOverride?.saves ?? trend.savesCount ?? 0) + 1);

            setActionError(null);
            pendingBookmarksRef.current.add(trend.id);
            setPendingBookmarks((prev) => {
                const next = new Set(prev);
                next.add(trend.id);
                return next;
            });

            const optimisticRecord: TrendBookmarkRecord = {
                id: `${uid}_trendz_${trend.id}`,
                userId: uid,
                targetType: 'trendz',
                targetId: trend.id,
                domainSlug: trend.domainSlug,
                trendTitle: (trend.title || '').trim() || 'Untitled Trend',
                trendSummary: (trend.summary || '').trim(),
                trendPublisher: (trend.details?.publishedBy || '').trim() || 'INVOX Desk',
                trendPublishedOn: (trend.details?.publishedOn || '').trim() || 'RECENT',
                trendMediaUrl: trend.mediaUrl || '',
                trendMediaType: trend.mediaType === 'video' ? 'video' : 'image',
                createdAtMs: Date.now(),
            };
            const optimisticList = dedupeTrendBookmarkRecords([
                optimisticRecord,
                ...previousRecords.filter((item) => item.targetId !== trend.id),
            ]);
            bookmarkRecordsRef.current = optimisticList;
            setBookmarkRecords(optimisticList);
            setStatsOverrides((prev) => {
                const next = {
                    ...prev,
                    [trend.id]: { ...prev[trend.id], saves: optimisticSaves },
                };
                statsOverridesRef.current = next;
                return next;
            });

            try {
                const result = await persistTrendBookmark(uid, trend);
                if (activeUidRef.current === uid) {
                    setStatsOverrides((prev) => {
                        const next = {
                            ...prev,
                            [trend.id]: { ...prev[trend.id], saves: result.savesCount },
                        };
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setBookmarkRecords((prev) => {
                        const updated = dedupeTrendBookmarkRecords([
                            result.bookmark,
                            ...prev.filter((item) => item.targetId !== trend.id),
                        ]);
                        bookmarkRecordsRef.current = updated;
                        return updated;
                    });
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_BOOKMARK_ERROR]', err);
                if (activeUidRef.current === uid) {
                    bookmarkRecordsRef.current = previousRecords;
                    setBookmarkRecords(previousRecords);
                    setStatsOverrides((prev) => {
                        const next = { ...prev };
                        if (previousOverride) next[trend.id] = previousOverride;
                        else delete next[trend.id];
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setActionError(
                        formatFirebaseActionError(err, 'Failed to bookmark this trend.')
                    );
                }
                return false;
            } finally {
                pendingBookmarksRef.current.delete(trend.id);
                setPendingBookmarks((prev) => {
                    const next = new Set(prev);
                    next.delete(trend.id);
                    return next;
                });
            }
        },
        [uid]
    );

    const removeBookmarkById = useCallback(
        async (trendId: string, isFallback = false): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to manage your saved trends.');
                return false;
            }

            // DEV_FALLBACK sample trends: remove strictly from localStorage (never touch Firestore)
            if (isFallback) {
                setActionError(null);
                const nextSample = sampleBookmarkRecordsRef.current.filter(
                    (item) => item.targetId !== trendId
                );
                saveSampleBookmarkIds(
                    uid,
                    nextSample.map((item) => item.targetId)
                );
                sampleBookmarkRecordsRef.current = nextSample;
                setSampleBookmarkRecords(nextSample);
                return true;
            }

            if (pendingBookmarksRef.current.has(trendId)) {
                return false;
            }

            const previousRecords = bookmarkRecordsRef.current;
            const previousOverride = statsOverridesRef.current[trendId];
            setActionError(null);
            pendingBookmarksRef.current.add(trendId);
            setPendingBookmarks((prev) => {
                const next = new Set(prev);
                next.add(trendId);
                return next;
            });
            const nextRecords = previousRecords.filter((item) => item.targetId !== trendId);
            bookmarkRecordsRef.current = nextRecords;
            setBookmarkRecords(nextRecords);

            if (previousOverride?.saves !== undefined) {
                setStatsOverrides((prev) => {
                    const next = {
                        ...prev,
                        [trendId]: {
                            ...prev[trendId],
                            saves: Math.max(0, (previousOverride.saves ?? 1) - 1),
                        },
                    };
                    statsOverridesRef.current = next;
                    return next;
                });
            }

            try {
                const res = await removeTrendBookmarkById(uid, trendId);
                if (activeUidRef.current === uid && typeof res.savesCount === 'number') {
                    setStatsOverrides((prev) => {
                        const next = {
                            ...prev,
                            [trendId]: {
                                ...prev[trendId],
                                saves: res.savesCount,
                            },
                        };
                        statsOverridesRef.current = next;
                        return next;
                    });
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_REMOVE_BOOKMARK_ERROR]', err);
                if (activeUidRef.current === uid) {
                    bookmarkRecordsRef.current = previousRecords;
                    setBookmarkRecords(previousRecords);
                    setStatsOverrides((prev) => {
                        const next = { ...prev };
                        if (previousOverride) next[trendId] = previousOverride;
                        else delete next[trendId];
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setActionError(
                        formatFirebaseActionError(err, 'Failed to remove saved trend bookmark.')
                    );
                }
                return false;
            } finally {
                pendingBookmarksRef.current.delete(trendId);
                setPendingBookmarks((prev) => {
                    const next = new Set(prev);
                    next.delete(trendId);
                    return next;
                });
            }
        },
        [uid]
    );

    const toggleUpvote = useCallback(
        async (trend: TrendViewModel): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to upvote trends.');
                return false;
            }

            // DEV_FALLBACK sample trends: persist strictly in user-scoped localStorage (never Firestore)
            if (trend.isFallback) {
                setActionError(null);
                const previousSample = sampleUpvoteRecordsRef.current;
                const wasUpvoted = previousSample.some((item) => item.targetId === trend.id);
                let nextSample: TrendUpvoteRecord[];

                if (wasUpvoted) {
                    nextSample = previousSample.filter((item) => item.targetId !== trend.id);
                } else {
                    const newRecord = buildSampleUpvoteRecord(uid, trend, Date.now());
                    nextSample = dedupeTrendUpvoteRecords([
                        newRecord,
                        ...previousSample.filter((item) => item.targetId !== trend.id),
                    ]);
                }

                const persistedIds = saveSampleUpvoteIds(
                    uid,
                    nextSample.map((item) => item.targetId)
                );
                const persistedIdSet = new Set(persistedIds);
                const normalizedNext = nextSample.filter((item) => persistedIdSet.has(item.targetId));

                sampleUpvoteRecordsRef.current = normalizedNext;
                setSampleUpvoteRecords(normalizedNext);
                return true;
            }

            if (pendingUpvotesRef.current.has(trend.id)) {
                return false;
            }

            const previousRecords = upvoteRecordsRef.current;
            const wasUpvoted = previousRecords.some((item) => item.targetId === trend.id);
            const previousOverride = statsOverridesRef.current[trend.id];
            const currentDisplayedLikes = previousOverride?.likes ?? trend.stats?.likes ?? 0;
            const optimisticLikes = Math.max(0, currentDisplayedLikes + (wasUpvoted ? -1 : 1));

            setActionError(null);
            pendingUpvotesRef.current.add(trend.id);
            setPendingUpvotes((prev) => {
                const next = new Set(prev);
                next.add(trend.id);
                return next;
            });

            setStatsOverrides((prev) => {
                const next = {
                    ...prev,
                    [trend.id]: {
                        ...prev[trend.id],
                        likes: optimisticLikes,
                    },
                };
                statsOverridesRef.current = next;
                return next;
            });

            if (wasUpvoted) {
                const nextRecords = previousRecords.filter((item) => item.targetId !== trend.id);
                upvoteRecordsRef.current = nextRecords;
                setUpvoteRecords(nextRecords);
            } else {
                const optimisticUpvote: TrendUpvoteRecord = {
                    id: `${uid}_trendz_${trend.id}`,
                    userId: uid,
                    targetType: 'trendz',
                    targetId: trend.id,
                    domainSlug: trend.domainSlug,
                    createdAtMs: Date.now(),
                };
                const nextRecords = dedupeTrendUpvoteRecords([
                    optimisticUpvote,
                    ...previousRecords.filter((item) => item.targetId !== trend.id),
                ]);
                upvoteRecordsRef.current = nextRecords;
                setUpvoteRecords(nextRecords);
            }

            try {
                const result = await toggleTrendUpvote(uid, trend);
                if (activeUidRef.current === uid) {
                    setStatsOverrides((prev) => {
                        const next = {
                            ...prev,
                            [trend.id]: {
                                ...prev[trend.id],
                                likes: result.likesCount,
                            },
                        };
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setUpvoteRecords((prev) => {
                        const updated =
                            result.upvoted && result.record
                                ? dedupeTrendUpvoteRecords([
                                      result.record,
                                      ...prev.filter((item) => item.targetId !== trend.id),
                                  ])
                                : prev.filter((item) => item.targetId !== trend.id);
                        upvoteRecordsRef.current = updated;
                        return updated;
                    });
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_UPVOTE_ERROR]', err);
                if (activeUidRef.current === uid) {
                    upvoteRecordsRef.current = previousRecords;
                    setUpvoteRecords(previousRecords);
                    setStatsOverrides((prev) => {
                        const next = { ...prev };
                        if (previousOverride) {
                            next[trend.id] = previousOverride;
                        } else {
                            delete next[trend.id];
                        }
                        statsOverridesRef.current = next;
                        return next;
                    });
                    setActionError(
                        formatFirebaseActionError(
                            err,
                            `Failed to ${wasUpvoted ? 'remove upvote from' : 'upvote'} this trend.`
                        )
                    );
                }
                return false;
            } finally {
                pendingUpvotesRef.current.delete(trend.id);
                setPendingUpvotes((prev) => {
                    const next = new Set(prev);
                    next.delete(trend.id);
                    return next;
                });
            }
        },
        [uid]
    );

    const trackTrendView = useCallback(
        async (trend: TrendViewModel): Promise<void> => {
            if (!trend?.id) {
                return;
            }

            // DEV_FALLBACK sample trends: deduplicated local view tracking (never touches Firestore)
            if (trend.isFallback) {
                const res = recordSampleTrendView(trend, uid);
                if (res.recorded && res.record) {
                    const updated = dedupeTrendViewRecords([
                        res.record,
                        ...sampleViewRecordsRef.current.filter((item) => item.trendId !== trend.id),
                    ]);
                    sampleViewRecordsRef.current = updated;
                    setSampleViewRecords(updated);
                }
                return;
            }

            // Anonymous LIVE visits: deduplicated local view tracking without attempting unauthorized Firestore writes
            if (!uid) {
                const res = recordAnonymousTrendView(trend);
                if (res.recorded) {
                    setStatsOverrides((prev) => {
                        const next = {
                            ...prev,
                            [trend.id]: {
                                ...prev[trend.id],
                                views: res.viewsCount,
                            },
                        };
                        statsOverridesRef.current = next;
                        return next;
                    });
                    if (res.record) {
                        setViewRecords((prev) =>
                            dedupeTrendViewRecords([
                                res.record!,
                                ...prev.filter((item) => item.trendId !== trend.id),
                            ])
                        );
                    }
                }
                return;
            }

            const trackKey = `${uid}:${trend.id}`;
            if (inFlightViewTracksRef.current.has(trackKey)) {
                return;
            }
            inFlightViewTracksRef.current.add(trackKey);

            try {
                const result = await recordTrendView(uid, trend);
                if (activeUidRef.current !== uid) return;

                if (result.recorded) {
                    setStatsOverrides((prev) => {
                        const next = {
                            ...prev,
                            [trend.id]: {
                                ...prev[trend.id],
                                views: result.viewsCount,
                            },
                        };
                        statsOverridesRef.current = next;
                        return next;
                    });
                    if (result.record) {
                        setViewRecords((prev) =>
                            dedupeTrendViewRecords([
                                result.record!,
                                ...prev.filter((item) => item.trendId !== trend.id),
                            ])
                        );
                    }
                }
            } catch (err) {
                console.warn('[TRENDZ_VIEW_TRACK_WARN]', err);
            } finally {
                inFlightViewTracksRef.current.delete(trackKey);
            }
        },
        [uid]
    );

    const getDisplayStats = useCallback(
        (trend: TrendViewModel) => {
            if (trend.isFallback) {
                return {
                    likes: (trend.stats?.likes ?? 0) + (sampleUpvotedTrendIds.has(trend.id) ? 1 : 0),
                    views: (trend.stats?.views ?? 0) + (sampleViewedTrendIds.has(trend.id) ? 1 : 0),
                    comments: trend.stats?.comments ?? 0,
                    saves: (trend.savesCount ?? 0) + (sampleBookmarkedTrendIds.has(trend.id) ? 1 : 0),
                };
            }
            const override = statsOverrides[trend.id];
            return {
                likes: override?.likes ?? trend.stats?.likes ?? 0,
                views: override?.views ?? trend.stats?.views ?? 0,
                comments: trend.stats?.comments ?? 0,
                saves: override?.saves ?? trend.savesCount ?? 0,
            };
        },
        [statsOverrides, sampleBookmarkedTrendIds, sampleUpvotedTrendIds, sampleViewedTrendIds]
    );

    const personalizationSignals = useMemo<PersonalizationSignals>(
        () => ({
            followedDomainSlugs,
            bookmarkedRecords: bookmarkRecords,
            upvoteRecords,
            viewRecords,
        }),
        [followedDomainSlugs, bookmarkRecords, upvoteRecords, viewRecords]
    );

    const samplePersonalizationSignals = useMemo<PersonalizationSignals>(
        () => ({
            followedDomainSlugs,
            bookmarkedRecords: sampleBookmarkRecords,
            upvoteRecords: sampleUpvoteRecords,
            viewRecords: sampleViewRecords,
        }),
        [followedDomainSlugs, sampleBookmarkRecords, sampleUpvoteRecords, sampleViewRecords]
    );

    const value = useMemo<TrendzEngagementContextValue>(
        () => ({
            isAuthenticated: Boolean(uid),
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
            isTrendBookmarked,
            isBookmarkPending,
            bookmarkTrend,
            unbookmarkTrend: removeBookmarkById,
            toggleBookmark,
            removeBookmarkById,
            upvoteRecords,
            upvotedTrendIds,
            sampleUpvoteRecords,
            sampleUpvotedTrendIds,
            isTrendUpvoted,
            isUpvotePending,
            toggleUpvote,
            viewRecords,
            sampleViewRecords,
            trackTrendView,
            statsOverrides,
            getDisplayStats,
            personalizationSignals,
            samplePersonalizationSignals,
        }),
        [
            uid,
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
            isTrendBookmarked,
            isBookmarkPending,
            bookmarkTrend,
            toggleBookmark,
            removeBookmarkById,
            upvoteRecords,
            upvotedTrendIds,
            sampleUpvoteRecords,
            sampleUpvotedTrendIds,
            isTrendUpvoted,
            isUpvotePending,
            toggleUpvote,
            viewRecords,
            sampleViewRecords,
            trackTrendView,
            statsOverrides,
            getDisplayStats,
            personalizationSignals,
            samplePersonalizationSignals,
        ]
    );

    return (
        <TrendzEngagementContext.Provider value={value}>
            {children}
        </TrendzEngagementContext.Provider>
    );
};

export function useTrendzEngagement(): TrendzEngagementContextValue {
    const ctx = useContext(TrendzEngagementContext);
    if (!ctx) {
        throw new Error('useTrendzEngagement must be used within a TrendzEngagementProvider');
    }
    return ctx;
}
