import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    fetchUserFollowedTrendDomains,
    fetchUserTrendBookmarks,
    fetchUserTrendUpvotes,
    fetchUserTrendViews,
    followTrendDomain,
    normalizeFollowedTrendDomains,
    recordTrendView,
    removeTrendBookmarkById,
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
    toggleFollowDomain: (rawDomain: string) => Promise<boolean>;

    // Bookmarks
    bookmarkRecords: TrendBookmarkRecord[];
    bookmarkedTrendIds: Set<string>;
    isTrendBookmarked: (trendId: string) => boolean;
    isBookmarkPending: (trendId: string) => boolean;
    toggleBookmark: (trend: TrendViewModel) => Promise<boolean>;
    removeBookmarkById: (trendId: string) => Promise<boolean>;

    // Upvotes
    upvoteRecords: TrendUpvoteRecord[];
    upvotedTrendIds: Set<string>;
    isTrendUpvoted: (trendId: string) => boolean;
    isUpvotePending: (trendId: string) => boolean;
    toggleUpvote: (trend: TrendViewModel) => Promise<boolean>;

    // Views
    viewRecords: TrendViewRecord[];
    trackTrendView: (trend: TrendViewModel) => Promise<void>;

    // Live count sync across cards & detail views
    statsOverrides: Record<string, TrendStatsOverride>;
    getDisplayStats: (trend: TrendViewModel) => { likes: number; views: number; comments: number };

    // Personalization signals bundle
    personalizationSignals: PersonalizationSignals;
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
    const { currentUser, userProfile, loading: authLoading } = useAuth();
    const uid = currentUser?.uid || null;

    const [followedDomainSlugs, setFollowedDomainSlugs] = useState<TrendzDomainSlug[]>([]);
    const [bookmarkRecords, setBookmarkRecords] = useState<TrendBookmarkRecord[]>([]);
    const [upvoteRecords, setUpvoteRecords] = useState<TrendUpvoteRecord[]>([]);
    const [viewRecords, setViewRecords] = useState<TrendViewRecord[]>([]);
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

    // Keep followed domains synchronized with real-time AuthContext userProfile snapshot
    useEffect(() => {
        if (!uid) {
            setFollowedDomainSlugs([]);
            return;
        }
        if (userProfile && userProfile.uid === uid && Array.isArray(userProfile.followedTrendDomains)) {
            setFollowedDomainSlugs(normalizeFollowedTrendDomains(userProfile.followedTrendDomains));
        }
    }, [uid, userProfile]);

    const loadUserEngagement = useCallback(async (targetUid: string | null) => {
        const seq = ++loadSeqRef.current;

        if (!targetUid) {
            setFollowedDomainSlugs([]);
            setBookmarkRecords([]);
            setUpvoteRecords([]);
            setViewRecords([]);
            setStatsOverrides({});
            setPendingDomains(new Set());
            setPendingBookmarks(new Set());
            setPendingUpvotes(new Set());
            setPreferencesLoading(false);
            setPreferencesError(null);
            setActionError(null);
            return;
        }

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
            setFollowedDomainSlugs(domainsRes.value);
        } else {
            errors.push('followed domains');
            console.error('[TRENDZ_LOAD_DOMAINS_ERROR]', domainsRes.reason);
        }

        if (bookmarksRes.status === 'fulfilled') {
            setBookmarkRecords(bookmarksRes.value);
        } else {
            setBookmarkRecords([]);
            errors.push('saved trends');
            console.error('[TRENDZ_LOAD_BOOKMARKS_ERROR]', bookmarksRes.reason);
        }

        if (upvotesRes.status === 'fulfilled') {
            setUpvoteRecords(upvotesRes.value);
        } else {
            setUpvoteRecords([]);
            errors.push('upvotes');
            console.error('[TRENDZ_LOAD_UPVOTES_ERROR]', upvotesRes.reason);
        }

        if (viewsRes.status === 'fulfilled') {
            setViewRecords(viewsRes.value);
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
        setStatsOverrides({});
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

    const upvotedTrendIds = useMemo(
        () => new Set<string>(upvoteRecords.map((u) => u.targetId)),
        [upvoteRecords]
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
        (trendId: string): boolean => bookmarkedTrendIds.has(trendId),
        [bookmarkedTrendIds]
    );

    const isBookmarkPending = useCallback(
        (trendId: string): boolean => pendingBookmarks.has(trendId),
        [pendingBookmarks]
    );

    const isTrendUpvoted = useCallback(
        (trendId: string): boolean => upvotedTrendIds.has(trendId),
        [upvotedTrendIds]
    );

    const isUpvotePending = useCallback(
        (trendId: string): boolean => pendingUpvotes.has(trendId),
        [pendingUpvotes]
    );

    const toggleFollowDomain = useCallback(
        async (rawDomain: string): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to follow or unfollow Trendz domains.');
                return false;
            }
            const slug = normalizeTrendzDomainSlug(rawDomain);
            if (!slug) {
                setActionError('Invalid Trendz domain selected.');
                return false;
            }
            if (pendingDomains.has(slug)) {
                return false;
            }

            const wasFollowed = followedDomainSet.has(slug);
            const previous = followedDomainSlugs;
            const optimisticNext = wasFollowed
                ? previous.filter((item) => item !== slug)
                : normalizeFollowedTrendDomains([...previous, slug]);

            setActionError(null);
            setFollowedDomainSlugs(optimisticNext);
            setPendingDomains((prev) => {
                const next = new Set(prev);
                next.add(slug);
                return next;
            });

            try {
                const persisted = wasFollowed
                    ? await unfollowTrendDomain(uid, slug)
                    : await followTrendDomain(uid, slug);

                if (activeUidRef.current === uid) {
                    setFollowedDomainSlugs(persisted);
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_FOLLOW_DOMAIN_ERROR]', err);
                if (activeUidRef.current === uid) {
                    setFollowedDomainSlugs(previous);
                    setActionError(
                        formatFirebaseActionError(
                            err,
                            `Failed to ${wasFollowed ? 'unfollow' : 'follow'} ${formatTrendzDomainName(slug)}.`
                        )
                    );
                }
                return false;
            } finally {
                setPendingDomains((prev) => {
                    const next = new Set(prev);
                    next.delete(slug);
                    return next;
                });
            }
        },
        [uid, pendingDomains, followedDomainSet, followedDomainSlugs]
    );

    const toggleBookmark = useCallback(
        async (trend: TrendViewModel): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to bookmark trends.');
                return false;
            }
            if (trend.isFallback) {
                setActionError(
                    'Sample fallback trends cannot be bookmarked. Switch to live Trendz to save items.'
                );
                return false;
            }
            if (pendingBookmarks.has(trend.id)) {
                return false;
            }

            const wasBookmarked = bookmarkedTrendIds.has(trend.id);
            const previousRecords = bookmarkRecords;

            setActionError(null);
            setPendingBookmarks((prev) => {
                const next = new Set(prev);
                next.add(trend.id);
                return next;
            });

            // Immediate optimistic UI update
            if (wasBookmarked) {
                setBookmarkRecords((prev) => prev.filter((item) => item.targetId !== trend.id));
            } else {
                const optimisticRecord: TrendBookmarkRecord = {
                    id: `${uid}_trendz_${trend.id}`,
                    userId: uid,
                    targetType: 'trendz',
                    targetId: trend.id,
                    domainSlug: trend.domainSlug,
                    trendTitle: trend.title,
                    trendSummary: trend.summary,
                    trendPublisher: trend.details.publishedBy,
                    trendPublishedOn: trend.details.publishedOn,
                    trendMediaUrl: trend.mediaUrl,
                    trendMediaType: trend.mediaType,
                    createdAtMs: Date.now(),
                };
                setBookmarkRecords((prev) => [
                    optimisticRecord,
                    ...prev.filter((item) => item.targetId !== trend.id),
                ]);
            }

            try {
                const result = await toggleTrendBookmark(uid, trend);
                if (activeUidRef.current === uid) {
                    setStatsOverrides((prev) => ({
                        ...prev,
                        [trend.id]: {
                            ...prev[trend.id],
                            saves: result.savesCount,
                        },
                    }));
                    if (result.bookmarked && result.bookmark) {
                        setBookmarkRecords((prev) => [
                            result.bookmark!,
                            ...prev.filter((item) => item.targetId !== trend.id),
                        ]);
                    } else {
                        setBookmarkRecords((prev) =>
                            prev.filter((item) => item.targetId !== trend.id)
                        );
                    }
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_BOOKMARK_ERROR]', err);
                if (activeUidRef.current === uid) {
                    setBookmarkRecords(previousRecords);
                    setActionError(
                        formatFirebaseActionError(
                            err,
                            `Failed to ${wasBookmarked ? 'remove bookmark for' : 'bookmark'} this trend.`
                        )
                    );
                }
                return false;
            } finally {
                setPendingBookmarks((prev) => {
                    const next = new Set(prev);
                    next.delete(trend.id);
                    return next;
                });
            }
        },
        [uid, pendingBookmarks, bookmarkedTrendIds, bookmarkRecords]
    );

    const removeBookmarkById = useCallback(
        async (trendId: string): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to manage your saved trends.');
                return false;
            }
            if (pendingBookmarks.has(trendId)) {
                return false;
            }

            const previousRecords = bookmarkRecords;
            setActionError(null);
            setPendingBookmarks((prev) => {
                const next = new Set(prev);
                next.add(trendId);
                return next;
            });
            setBookmarkRecords((prev) => prev.filter((item) => item.targetId !== trendId));

            try {
                await removeTrendBookmarkById(uid, trendId);
                return true;
            } catch (err) {
                console.error('[TRENDZ_REMOVE_BOOKMARK_ERROR]', err);
                if (activeUidRef.current === uid) {
                    setBookmarkRecords(previousRecords);
                    setActionError(
                        formatFirebaseActionError(err, 'Failed to remove saved trend bookmark.')
                    );
                }
                return false;
            } finally {
                setPendingBookmarks((prev) => {
                    const next = new Set(prev);
                    next.delete(trendId);
                    return next;
                });
            }
        },
        [uid, pendingBookmarks, bookmarkRecords]
    );

    const toggleUpvote = useCallback(
        async (trend: TrendViewModel): Promise<boolean> => {
            if (!uid) {
                setActionError('Sign in to upvote trends.');
                return false;
            }
            if (trend.isFallback) {
                setActionError(
                    'Sample fallback trends cannot be upvoted. Switch to live Trendz to upvote items.'
                );
                return false;
            }
            if (pendingUpvotes.has(trend.id)) {
                return false;
            }

            const wasUpvoted = upvotedTrendIds.has(trend.id);
            const previousRecords = upvoteRecords;
            const previousOverride = statsOverrides[trend.id];
            const currentDisplayedLikes = previousOverride?.likes ?? trend.stats?.likes ?? 0;
            const optimisticLikes = Math.max(0, currentDisplayedLikes + (wasUpvoted ? -1 : 1));

            setActionError(null);
            setPendingUpvotes((prev) => {
                const next = new Set(prev);
                next.add(trend.id);
                return next;
            });

            setStatsOverrides((prev) => ({
                ...prev,
                [trend.id]: {
                    ...prev[trend.id],
                    likes: optimisticLikes,
                },
            }));

            if (wasUpvoted) {
                setUpvoteRecords((prev) => prev.filter((item) => item.targetId !== trend.id));
            } else {
                const optimisticUpvote: TrendUpvoteRecord = {
                    id: `${uid}_trendz_${trend.id}`,
                    userId: uid,
                    targetType: 'trendz',
                    targetId: trend.id,
                    domainSlug: trend.domainSlug,
                    createdAtMs: Date.now(),
                };
                setUpvoteRecords((prev) => [
                    optimisticUpvote,
                    ...prev.filter((item) => item.targetId !== trend.id),
                ]);
            }

            try {
                const result = await toggleTrendUpvote(uid, trend);
                if (activeUidRef.current === uid) {
                    setStatsOverrides((prev) => ({
                        ...prev,
                        [trend.id]: {
                            ...prev[trend.id],
                            likes: result.likesCount,
                        },
                    }));
                    if (result.upvoted && result.record) {
                        setUpvoteRecords((prev) => [
                            result.record!,
                            ...prev.filter((item) => item.targetId !== trend.id),
                        ]);
                    } else {
                        setUpvoteRecords((prev) =>
                            prev.filter((item) => item.targetId !== trend.id)
                        );
                    }
                }
                return true;
            } catch (err) {
                console.error('[TRENDZ_UPVOTE_ERROR]', err);
                if (activeUidRef.current === uid) {
                    setUpvoteRecords(previousRecords);
                    setStatsOverrides((prev) => {
                        const next = { ...prev };
                        if (previousOverride) {
                            next[trend.id] = previousOverride;
                        } else {
                            delete next[trend.id];
                        }
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
                setPendingUpvotes((prev) => {
                    const next = new Set(prev);
                    next.delete(trend.id);
                    return next;
                });
            }
        },
        [uid, pendingUpvotes, upvotedTrendIds, upvoteRecords, statsOverrides]
    );

    const trackTrendView = useCallback(
        async (trend: TrendViewModel): Promise<void> => {
            if (!uid || trend.isFallback) {
                return;
            }
            try {
                const result = await recordTrendView(uid, trend);
                if (activeUidRef.current !== uid) return;

                if (result.recorded) {
                    setStatsOverrides((prev) => ({
                        ...prev,
                        [trend.id]: {
                            ...prev[trend.id],
                            views: result.viewsCount,
                        },
                    }));
                    if (result.record) {
                        setViewRecords((prev) => [
                            result.record!,
                            ...prev.filter((item) => item.trendId !== trend.id),
                        ]);
                    }
                }
            } catch (err) {
                console.warn('[TRENDZ_VIEW_TRACK_WARN]', err);
            }
        },
        [uid]
    );

    const getDisplayStats = useCallback(
        (trend: TrendViewModel) => {
            const override = statsOverrides[trend.id];
            return {
                likes: override?.likes ?? trend.stats?.likes ?? 0,
                views: override?.views ?? trend.stats?.views ?? 0,
                comments: trend.stats?.comments ?? 0,
            };
        },
        [statsOverrides]
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
            toggleFollowDomain,
            bookmarkRecords,
            bookmarkedTrendIds,
            isTrendBookmarked,
            isBookmarkPending,
            toggleBookmark,
            removeBookmarkById,
            upvoteRecords,
            upvotedTrendIds,
            isTrendUpvoted,
            isUpvotePending,
            toggleUpvote,
            viewRecords,
            trackTrendView,
            statsOverrides,
            getDisplayStats,
            personalizationSignals,
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
            toggleFollowDomain,
            bookmarkRecords,
            bookmarkedTrendIds,
            isTrendBookmarked,
            isBookmarkPending,
            toggleBookmark,
            removeBookmarkById,
            upvoteRecords,
            upvotedTrendIds,
            isTrendUpvoted,
            isUpvotePending,
            toggleUpvote,
            viewRecords,
            trackTrendView,
            statsOverrides,
            getDisplayStats,
            personalizationSignals,
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
