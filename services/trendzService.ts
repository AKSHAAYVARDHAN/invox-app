import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    startAfter,
    Timestamp,
    where,
    type DocumentData,
    type QueryConstraint,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
    Trend,
    TrendMedia,
    TrendRecord,
    TrendSourceAttribution,
    TrendStats,
    TrendStatus,
} from '../types';
import {
    formatTrendzDomainName,
    normalizeTrendzDomainSlug,
    resolveTrendzDomainIcon,
    type TrendzDomainSlug,
} from '../utils/trendzDomains';
import { calculateTrendingScore, getNormalizedTimestamp } from '../utils/trendingScore';
import { sanitizeExternalUrl } from '../utils/urlSanitizer';

export type TrendSortMode = 'latest' | 'momentum';

/**
 * UI view model compatible with existing TrendzCard and TrendzDetail components,
 * enriched with normalized metadata from TrendRecord.
 */
export interface TrendViewModel extends Trend {
    domainSlug: TrendzDomainSlug;
    tags: string[];
    searchKeywords: string[];
    momentumScore: number;
    relatedTrendIds: string[];
    keyTakeaways: string[];
    whyItMatters?: string;
    groundingStatus?: 'verified' | 'needs_review';
    status: TrendStatus;
    publishedAtMs: number;
    isFallback?: boolean;
}

export interface TrendFeedPage {
    items: TrendViewModel[];
    records: TrendRecord[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
    usedFallbackQuery?: boolean;
}

export interface TrendFeedQueryOptions {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    domainSlugs?: TrendzDomainSlug[];
    sortBy?: TrendSortMode;
    searchQuery?: string;
}

const TRENDZ_COLLECTION = 'trendz';
const DEFAULT_PAGE_SIZE = 10;
const FALLBACK_SCAN_LIMIT = 60;
const TREND_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidTrendId(trendId: unknown): trendId is string {
    return typeof trendId === 'string' && TREND_ID_PATTERN.test(trendId.trim());
}

/**
 * Formats a Timestamp / Date / millisecond value into DD-MM-YYYY to match existing Trendz UI.
 */
export function formatTrendDate(value: unknown): string {
    const ms = getNormalizedTimestamp(value);
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
        return 'RECENT';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function toTimestamp(value: unknown): Timestamp {
    if (value instanceof Timestamp) {
        return value;
    }
    if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
        try {
            return Timestamp.fromDate((value as any).toDate());
        } catch {
            // fall through
        }
    }
    if (value && typeof value === 'object' && typeof (value as any).seconds === 'number') {
        return new Timestamp(
            Number((value as any).seconds) || 0,
            Number((value as any).nanoseconds) || 0
        );
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return Timestamp.fromDate(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Timestamp.fromMillis(value);
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return Timestamp.fromMillis(parsed);
        }
    }
    return Timestamp.now();
}

function sanitizeStringArray(raw: unknown, maxItems = 50): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const result: string[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
        if (typeof entry !== 'string') continue;
        const cleaned = entry.trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(cleaned);
            if (result.length >= maxItems) break;
        }
    }
    return result;
}

function toSafeNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
}

/**
 * Reuses utils/trendingScore.ts without duplicating scoring math.
 */
export function computeTrendMomentumFallbackScore(item: {
    stats?: Partial<TrendStats>;
    createdAt?: unknown;
    publishedAt?: unknown;
}): number {
    return calculateTrendingScore({
        stats: {
            likes: toSafeNumber(item.stats?.likes),
            views: toSafeNumber(item.stats?.views),
            comments: toSafeNumber(item.stats?.comments),
        },
        saveCount: toSafeNumber(item.stats?.saves),
        shareCount: toSafeNumber(item.stats?.shares),
        createdAt: item.publishedAt ?? item.createdAt ?? new Date(),
    });
}

/**
 * Normalizes a raw Firestore document from /trendz/{trendId} into a strict TrendRecord.
 * Returns null if the document is missing critical fields or fails publication status check.
 */
export function parseTrendDocument(
    docId: string,
    raw: DocumentData | undefined,
    publishedOnly = true
): TrendRecord | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const status: TrendStatus =
        raw.status === 'draft' ||
        raw.status === 'published' ||
        raw.status === 'archived' ||
        raw.status === 'flagged'
            ? raw.status
            : 'draft';

    if (publishedOnly && status !== 'published') {
        return null;
    }

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) {
        return null;
    }

    const summary =
        typeof raw.summary === 'string' && raw.summary.trim()
            ? raw.summary.trim()
            : typeof raw.fullContent === 'string'
                ? raw.fullContent.trim().slice(0, 280)
                : '';

    const fullContent =
        typeof raw.fullContent === 'string' && raw.fullContent.trim()
            ? raw.fullContent.trim()
            : summary;

    const domainSlug: TrendzDomainSlug =
        normalizeTrendzDomainSlug(raw.domainSlug) ||
        normalizeTrendzDomainSlug(raw.domain) ||
        normalizeTrendzDomainSlug(raw.category) ||
        'technology';

    const domainName = formatTrendzDomainName(domainSlug);

    const rawSource = raw.source && typeof raw.source === 'object' ? raw.source : {};
    const safeSourceUrl = sanitizeExternalUrl(rawSource.url) || '';
    const source: TrendSourceAttribution = {
        name:
            typeof rawSource.name === 'string' && rawSource.name.trim()
                ? rawSource.name.trim()
                : 'INVOX Desk',
        domain:
            typeof rawSource.domain === 'string' && rawSource.domain.trim()
                ? rawSource.domain.trim()
                : '',
        url: safeSourceUrl,
        urlHash: typeof rawSource.urlHash === 'string' ? rawSource.urlHash : '',
        author: typeof rawSource.author === 'string' ? rawSource.author.trim() : undefined,
        credibilityTier:
            rawSource.credibilityTier === 'primary' ||
            rawSource.credibilityTier === 'reputable' ||
            rawSource.credibilityTier === 'trade'
                ? rawSource.credibilityTier
                : 'reputable',
    };

    const rawMedia = raw.media && typeof raw.media === 'object' ? raw.media : {};
    const mediaType: 'image' | 'video' = rawMedia.type === 'video' ? 'video' : 'image';
    const mediaUrl = sanitizeExternalUrl(rawMedia.url) || '';
    const thumbnailUrl = sanitizeExternalUrl(rawMedia.thumbnailUrl) || undefined;
    const overlayUrl = sanitizeExternalUrl(rawMedia.overlayUrl) || undefined;

    const media: TrendMedia = {
        type: mediaType,
        url: mediaUrl,
        thumbnailUrl,
        overlayUrl,
        origin:
            rawMedia.origin === 'source_og' ||
            rawMedia.origin === 'ai_generated' ||
            rawMedia.origin === 'domain_fallback'
                ? rawMedia.origin
                : 'domain_fallback',
        attribution:
            typeof rawMedia.attribution === 'string' ? rawMedia.attribution.trim() : undefined,
        storagePath:
            typeof rawMedia.storagePath === 'string' ? rawMedia.storagePath.trim() : undefined,
    };

    const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    const stats: TrendStats = {
        likes: toSafeNumber(rawStats.likes),
        views: toSafeNumber(rawStats.views),
        comments: toSafeNumber(rawStats.comments),
        saves: toSafeNumber(rawStats.saves),
        shares: toSafeNumber(rawStats.shares),
    };

    const publishedAt = toTimestamp(raw.publishedAt ?? raw.createdAt);
    const createdAt = toTimestamp(raw.createdAt ?? raw.publishedAt);
    const discoveredAt = toTimestamp(raw.discoveredAt ?? raw.createdAt ?? raw.publishedAt);
    const updatedAt = toTimestamp(raw.updatedAt ?? raw.createdAt ?? raw.publishedAt);

    const momentumScore =
        typeof raw.momentumScore === 'number' && Number.isFinite(raw.momentumScore)
            ? raw.momentumScore
            : computeTrendMomentumFallbackScore({ stats, publishedAt, createdAt });

    const tags = sanitizeStringArray(raw.tags, 15);
    const searchKeywords = sanitizeStringArray(raw.searchKeywords, 60).map((kw) =>
        kw.toLowerCase()
    );
    const relatedTrendIds = sanitizeStringArray(raw.relatedTrendIds, 10).filter(
        (relId) => isValidTrendId(relId) && relId !== docId
    );
    const keyTakeaways = sanitizeStringArray(raw.keyTakeaways, 10);

    return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : docId,
        slug: typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : docId,
        status,
        domainSlug,
        domain: domainName,
        category:
            typeof raw.category === 'string' && raw.category.trim()
                ? raw.category.trim()
                : domainName,
        tags,
        searchKeywords,
        title,
        summary,
        fullContent,
        keyTakeaways,
        source,
        additionalSources: Array.isArray(raw.additionalSources)
            ? raw.additionalSources
            : undefined,
        publishedAt,
        discoveredAt,
        createdAt,
        updatedAt,
        media,
        momentumScore,
        relatedTrendIds,
        stats,
        schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
        aiModel: typeof raw.aiModel === 'string' ? raw.aiModel : undefined,
        contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : undefined,
        language: typeof raw.language === 'string' ? raw.language : undefined,
        region: typeof raw.region === 'string' ? raw.region : undefined,
        whyItMatters:
            typeof raw.whyItMatters === 'string' && raw.whyItMatters.trim()
                ? raw.whyItMatters.trim()
                : undefined,
        sourceRetrievedAt: raw.sourceRetrievedAt ? toTimestamp(raw.sourceRetrievedAt) : undefined,
        ingestionRunId: typeof raw.ingestionRunId === 'string' ? raw.ingestionRunId : undefined,
        ingestionItemId: typeof raw.ingestionItemId === 'string' ? raw.ingestionItemId : undefined,
        reviewedBy: typeof raw.reviewedBy === 'string' ? raw.reviewedBy : undefined,
        reviewedAt: raw.reviewedAt ? toTimestamp(raw.reviewedAt) : undefined,
        groundingStatus:
            raw.groundingStatus === 'verified' || raw.groundingStatus === 'needs_review'
                ? raw.groundingStatus
                : undefined,
    };
}

/**
 * Converts a serializable TrendRecord into the UI TrendViewModel used by TrendzCard & TrendzDetail.
 */
export function trendRecordToViewModel(record: TrendRecord): TrendViewModel {
    const publishedAtMs = getNormalizedTimestamp(record.publishedAt ?? record.createdAt);
    const domainName = formatTrendzDomainName(record.domainSlug || record.domain);

    return {
        id: record.id,
        domain: {
            name: domainName,
            icon: resolveTrendzDomainIcon(record.domainSlug),
            isFollowed: false,
        },
        title: record.title,
        summary: record.summary,
        fullContent: record.fullContent,
        mediaUrl: record.media.url,
        mediaType: record.media.type,
        thumbnailUrl: record.media.thumbnailUrl,
        mediaOverlayUrl: record.media.overlayUrl || '',
        stats: {
            likes: record.stats.likes,
            views: record.stats.views,
            comments: record.stats.comments,
        },
        details: {
            publishedBy: record.source.name,
            publishedOn: formatTrendDate(publishedAtMs),
            link: record.source.url,
        },
        createdAt: new Date(publishedAtMs),
        domainSlug: record.domainSlug,
        tags: record.tags,
        searchKeywords: record.searchKeywords,
        momentumScore: record.momentumScore,
        relatedTrendIds: record.relatedTrendIds,
        keyTakeaways: record.keyTakeaways,
        whyItMatters: record.whyItMatters,
        groundingStatus: record.groundingStatus,
        status: record.status,
        publishedAtMs,
        isFallback: false,
    };
}

/**
 * Extracts clean, lowercase, deduplicated search tokens from a user search query.
 */
export function normalizeSearchTokens(queryText: string): string[] {
    if (!queryText || typeof queryText !== 'string') {
        return [];
    }
    const rawTokens = queryText
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 1);

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const token of rawTokens) {
        if (!seen.has(token)) {
            seen.add(token);
            unique.push(token);
        }
    }
    return unique;
}

/**
 * Safely checks whether a TrendViewModel matches a user search query across:
 * title, summary, fullContent, tags/searchKeywords, publisher name, and domain name/slug.
 */
export function matchesTrendSearch(trend: TrendViewModel, rawQuery: string): boolean {
    const trimmed = (rawQuery || '').trim().toLowerCase();
    if (!trimmed) {
        return true;
    }

    const tokens = normalizeSearchTokens(trimmed);
    if (tokens.length === 0) {
        return true;
    }

    const searchableHaystack = [
        trend.title || '',
        trend.summary || '',
        trend.fullContent || '',
        trend.details?.publishedBy || '',
        trend.domain?.name || '',
        trend.domainSlug || '',
        ...(trend.tags || []),
        ...(trend.searchKeywords || []),
    ]
        .join(' ')
        .toLowerCase();

    return tokens.every((token) => searchableHaystack.includes(token));
}

export function dedupeTrendsById(items: TrendViewModel[]): TrendViewModel[] {
    const seen = new Set<string>();
    const result: TrendViewModel[] = [];
    for (const item of items) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
    }
    return result;
}

function isMissingIndexError(err: any): boolean {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return (
        code === 'failed-precondition' ||
        message.includes('requires an index') ||
        message.includes('index')
    );
}

function sortTrendsDeterministically(
    items: TrendViewModel[],
    sortBy: TrendSortMode
): TrendViewModel[] {
    return [...items].sort((a, b) => {
        if (sortBy === 'momentum') {
            if (Math.abs(b.momentumScore - a.momentumScore) > 0.0001) {
                return b.momentumScore - a.momentumScore;
            }
            const bFallback = computeTrendMomentumFallbackScore({
                stats: b.stats,
                publishedAt: b.publishedAtMs,
            });
            const aFallback = computeTrendMomentumFallbackScore({
                stats: a.stats,
                publishedAt: a.publishedAtMs,
            });
            if (Math.abs(bFallback - aFallback) > 0.0001) {
                return bFallback - aFallback;
            }
        }
        return b.publishedAtMs - a.publishedAtMs;
    });
}

function normalizeDomainSlugList(domainSlugs?: TrendzDomainSlug[]): TrendzDomainSlug[] {
    if (!Array.isArray(domainSlugs) || domainSlugs.length === 0) {
        return [];
    }
    const unique = new Set<TrendzDomainSlug>();
    for (const slug of domainSlugs) {
        const normalized = normalizeTrendzDomainSlug(slug);
        if (normalized) {
            unique.add(normalized);
        }
    }
    return Array.from(unique);
}

/**
 * Fetches a paginated page of published Trendz records from Firestore using cursor pagination (`startAfter`).
 *
 * Uses Phase 02/03 composite indexes:
 * - (status ASC, publishedAt DESC)
 * - (status ASC, momentumScore DESC)
 * - (status ASC, domainSlug ASC, publishedAt DESC)
 * - (status ASC, domainSlug ASC, momentumScore DESC)
 * - (status ASC, searchKeywords ARRAY_CONTAINS, publishedAt DESC)
 * - (status ASC, domainSlug ASC, searchKeywords ARRAY_CONTAINS, publishedAt DESC)
 *
 * Falls back gracefully when a composite index is not yet deployed or when a partial
 * search substring requires bounded client-side matching.
 */
export async function fetchPublishedTrendsPage(
    options: TrendFeedQueryOptions = {}
): Promise<TrendFeedPage> {
    const pageSize = Math.max(1, Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, 30));
    const sortBy: TrendSortMode = options.sortBy === 'momentum' ? 'momentum' : 'latest';
    const domainSlugs = normalizeDomainSlugList(options.domainSlugs);
    const trimmedSearch = (options.searchQuery || '').trim();
    const searchTokens = normalizeSearchTokens(trimmedSearch);
    const orderField = sortBy === 'momentum' ? 'momentumScore' : 'publishedAt';
    const trendzRef = collection(db, TRENDZ_COLLECTION);

    // 1. Primary indexed query path when search is active (single keyword via searchKeywords array-contains)
    // Skip `in` + `array-contains` combination when multiple domains are selected so we stay within Firestore index constraints.
    const canUseKeywordIndex =
        searchTokens.length > 0 && sortBy === 'latest' && domainSlugs.length <= 1;

    if (canUseKeywordIndex) {
        // Choose the longest token as the most selective Firestore array-contains filter
        const primaryToken = [...searchTokens].sort((a, b) => b.length - a.length)[0];
        const constraints: QueryConstraint[] = [
            where('status', '==', 'published'),
            where('searchKeywords', 'array-contains', primaryToken),
        ];
        if (domainSlugs.length === 1) {
            constraints.push(where('domainSlug', '==', domainSlugs[0]));
        }
        constraints.push(orderBy('publishedAt', 'desc'));
        if (options.cursor) {
            constraints.push(startAfter(options.cursor));
        }
        constraints.push(limit(pageSize + 1));

        try {
            const snap = await getDocs(query(trendzRef, ...constraints));
            const rawDocs = snap.docs;
            const hasMore = rawDocs.length > pageSize;
            const pageDocs = hasMore ? rawDocs.slice(0, pageSize) : rawDocs;

            const records: TrendRecord[] = [];
            const items: TrendViewModel[] = [];
            for (const docSnap of pageDocs) {
                const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
                if (!parsed) continue;
                const vm = trendRecordToViewModel(parsed);
                if (matchesTrendSearch(vm, trimmedSearch)) {
                    records.push(parsed);
                    items.push(vm);
                }
            }

            // If exact keyword lookup returned matches (or we are paginating an active keyword cursor), return immediately.
            // If page 1 returned 0 exact-token matches, fall through to bounded scan so partial substrings / publisher names still match.
            if (items.length > 0 || options.cursor) {
                return {
                    items: dedupeTrendsById(items),
                    records,
                    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
                    hasMore,
                };
            }
        } catch (err: any) {
            if (!isMissingIndexError(err)) {
                throw err;
            }
            console.warn(
                '[TRENDZ_SERVICE] searchKeywords composite index not deployed yet; using bounded published scan fallback.'
            );
        }
    }

    // 2. Standard indexed Firestore query (latest or momentum, with optional 1..10 domainSlug filter)
    const constraints: QueryConstraint[] = [where('status', '==', 'published')];
    const applyClientDomainFilter = domainSlugs.length > 10;

    if (domainSlugs.length === 1) {
        constraints.push(where('domainSlug', '==', domainSlugs[0]));
    } else if (domainSlugs.length > 1 && domainSlugs.length <= 10) {
        constraints.push(where('domainSlug', 'in', domainSlugs));
    }

    constraints.push(orderBy(orderField, 'desc'));
    if (options.cursor) {
        constraints.push(startAfter(options.cursor));
    }

    const fetchLimit = trimmedSearch || applyClientDomainFilter ? FALLBACK_SCAN_LIMIT : pageSize + 1;
    constraints.push(limit(fetchLimit));

    try {
        const snap = await getDocs(query(trendzRef, ...constraints));
        const rawDocs = snap.docs;

        if (!trimmedSearch && !applyClientDomainFilter) {
            const hasMore = rawDocs.length > pageSize;
            const pageDocs = hasMore ? rawDocs.slice(0, pageSize) : rawDocs;

            const records: TrendRecord[] = [];
            const items: TrendViewModel[] = [];
            for (const docSnap of pageDocs) {
                const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
                if (!parsed) continue;
                records.push(parsed);
                items.push(trendRecordToViewModel(parsed));
            }

            return {
                items: dedupeTrendsById(items),
                records,
                lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
                hasMore,
            };
        }

        // Bounded scan mode (for partial substring search, multi-domain + search, or >10 domains)
        const matchedRecords: TrendRecord[] = [];
        const matchedItems: TrendViewModel[] = [];
        let lastMatchedDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMoreMatchesInBatch = false;

        for (let i = 0; i < rawDocs.length; i++) {
            const docSnap = rawDocs[i];
            const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
            if (!parsed) continue;
            if (applyClientDomainFilter && !domainSlugs.includes(parsed.domainSlug)) {
                continue;
            }
            const vm = trendRecordToViewModel(parsed);
            if (trimmedSearch && !matchesTrendSearch(vm, trimmedSearch)) {
                continue;
            }

            if (matchedItems.length < pageSize) {
                matchedRecords.push(parsed);
                matchedItems.push(vm);
                lastMatchedDoc = docSnap;
            } else {
                hasMoreMatchesInBatch = true;
                break;
            }
        }

        const reachedEndOfCollection = rawDocs.length < fetchLimit;
        const lastDoc = hasMoreMatchesInBatch
            ? lastMatchedDoc
            : rawDocs.length > 0
                ? rawDocs[rawDocs.length - 1]
                : null;

        return {
            items: dedupeTrendsById(matchedItems),
            records: matchedRecords,
            lastDoc,
            hasMore: hasMoreMatchesInBatch || (!reachedEndOfCollection && rawDocs.length > 0),
        };
    } catch (err: any) {
        if (!isMissingIndexError(err)) {
            throw err;
        }

        // Graceful fallback when composite indexes have not yet been deployed to Firestore
        console.warn(
            `[TRENDZ_SERVICE] Missing Firestore composite index for (${orderField}, domains=${domainSlugs.join(',')}); falling back to status-filtered query.`
        );
        const fallbackSnap = await getDocs(
            query(trendzRef, where('status', '==', 'published'), limit(FALLBACK_SCAN_LIMIT))
        );

        const records: TrendRecord[] = [];
        let items: TrendViewModel[] = [];

        for (const docSnap of fallbackSnap.docs) {
            const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
            if (!parsed) continue;
            if (domainSlugs.length > 0 && !domainSlugs.includes(parsed.domainSlug)) {
                continue;
            }
            const vm = trendRecordToViewModel(parsed);
            if (trimmedSearch && !matchesTrendSearch(vm, trimmedSearch)) {
                continue;
            }
            records.push(parsed);
            items.push(vm);
        }

        items = sortTrendsDeterministically(dedupeTrendsById(items), sortBy);

        return {
            items,
            records,
            lastDoc: null,
            hasMore: false,
            usedFallbackQuery: true,
        };
    }
}

/**
 * Fetches published trends for a single canonical domain slug using cursor pagination.
 */
export async function fetchTrendsByDomain(
    domainSlug: TrendzDomainSlug,
    pageSize = DEFAULT_PAGE_SIZE,
    cursor: QueryDocumentSnapshot<DocumentData> | null = null,
    sortBy: TrendSortMode = 'latest'
): Promise<TrendFeedPage> {
    return fetchPublishedTrendsPage({
        domainSlugs: [domainSlug],
        pageSize,
        cursor,
        sortBy,
    });
}

/**
 * Fetches a single published trend by its Firestore document ID.
 * Returns null if the ID is invalid, does not exist, or is not published.
 */
export async function fetchTrendById(trendId: string): Promise<TrendViewModel | null> {
    if (!isValidTrendId(trendId)) {
        return null;
    }

    const docRef = doc(db, TRENDZ_COLLECTION, trendId.trim());
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        return null;
    }

    const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
    if (!parsed) {
        return null;
    }

    return trendRecordToViewModel(parsed);
}

/**
 * Retrieves top published trends ordered by momentumScore for the Momentum Now sidebar.
 * Reuses utils/trendingScore.ts as tie-breaker / fallback when composite index is missing.
 */
export async function fetchMomentumTrends(limitCount = 5): Promise<TrendViewModel[]> {
    const safeLimit = Math.max(1, Math.min(limitCount, 20));
    const trendzRef = collection(db, TRENDZ_COLLECTION);

    try {
        const q = query(
            trendzRef,
            where('status', '==', 'published'),
            orderBy('momentumScore', 'desc'),
            limit(safeLimit)
        );
        const snap = await getDocs(q);
        const items: TrendViewModel[] = [];
        for (const docSnap of snap.docs) {
            const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
            if (parsed) {
                items.push(trendRecordToViewModel(parsed));
            }
        }
        return sortTrendsDeterministically(dedupeTrendsById(items), 'momentum').slice(0, safeLimit);
    } catch (err: any) {
        if (!isMissingIndexError(err)) {
            throw err;
        }
        console.warn(
            '[TRENDZ_SERVICE] Missing (status, momentumScore) composite index; scoring published trends via utils/trendingScore.ts.'
        );
        const fallbackSnap = await getDocs(
            query(trendzRef, where('status', '==', 'published'), limit(30))
        );
        const items: TrendViewModel[] = [];
        for (const docSnap of fallbackSnap.docs) {
            const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
            if (parsed) {
                items.push(trendRecordToViewModel(parsed));
            }
        }
        return sortTrendsDeterministically(dedupeTrendsById(items), 'momentum').slice(0, safeLimit);
    }
}

/**
 * Retrieves published related trends strictly from a trend's `relatedTrendIds` array.
 * Excludes the currently opened trend and skips missing, unpublished, or inaccessible docs gracefully.
 */
export async function fetchRelatedTrends(
    relatedTrendIds: string[] | undefined,
    excludeTrendId: string,
    maxCount = 4
): Promise<TrendViewModel[]> {
    if (!Array.isArray(relatedTrendIds) || relatedTrendIds.length === 0) {
        return [];
    }

    const candidateIds = Array.from(
        new Set(
            relatedTrendIds
                .map((id) => (typeof id === 'string' ? id.trim() : ''))
                .filter((id) => isValidTrendId(id) && id !== excludeTrendId)
        )
    ).slice(0, Math.max(1, Math.min(maxCount + 2, 10)));

    if (candidateIds.length === 0) {
        return [];
    }

    const settled = await Promise.allSettled(candidateIds.map((id) => fetchTrendById(id)));
    const resolved: TrendViewModel[] = [];

    for (const result of settled) {
        if (result.status === 'fulfilled' && result.value && result.value.id !== excludeTrendId) {
            resolved.push(result.value);
            if (resolved.length >= maxCount) {
                break;
            }
        }
    }

    return dedupeTrendsById(resolved);
}

/**
 * Preserved development fallback dataset for explicit UI testing when Firestore /trendz has no published records.
 * NEVER silently mixed with live Firestore data.
 */
export const DEVELOPMENT_MOCK_TRENDS: TrendViewModel[] = [
    {
        id: '8',
        domain: { name: 'Technology', icon: resolveTrendzDomainIcon('technology'), isFollowed: true },
        domainSlug: 'technology',
        title: 'AI-Driven Cinematography: The Next Film Revolution',
        summary:
            'Discover how artificial intelligence is transforming filmmaking, from automated editing to generating entire scenes. This video showcases the cutting-edge tools changing Hollywood.',
        fullContent:
            'The film industry is on the brink of a new revolution, powered by artificial intelligence. Sophisticated AI algorithms are now capable of analyzing scripts to predict box office success, automating tedious editing processes, and even generating photorealistic scenes and characters. This trend explores how AI-driven cinematography and virtual production are enabling filmmakers to bring their most ambitious visions to life, while also raising questions about the future of creativity in an automated world.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
        mediaOverlayUrl: '',
        stats: { likes: 130000, views: 72000000, comments: 28000 },
        details: {
            publishedBy: 'CineTech AI',
            publishedOn: '12-03-2025',
            link: 'https://x.com/Invox',
        },
        createdAt: new Date('2025-03-12T10:00:00Z'),
        publishedAtMs: new Date('2025-03-12T10:00:00Z').getTime(),
        tags: ['ai', 'cinematography', 'film', 'virtual-production'],
        searchKeywords: ['ai', 'cinematography', 'film', 'hollywood', 'cinetech', 'technology'],
        momentumScore: 98.4,
        relatedTrendIds: ['3', '2'],
        keyTakeaways: [
            'AI tooling accelerates pre-visualization and virtual production pipelines.',
            'Automated editing and script analysis reduce post-production bottlenecks.',
        ],
        status: 'published',
        isFallback: true,
    },
    {
        id: '1',
        domain: { name: 'Health Care', icon: resolveTrendzDomainIcon('health-care'), isFollowed: true },
        domainSlug: 'health-care',
        title: 'Super Skin Heals Wounds 90% In 4 Hours',
        summary:
            'Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing.',
        fullContent:
            'Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing. It enhances the natural healing process, repairing wounds up to 90% within just 4 hours. Whether for minor cuts, surgical recovery, or injuries, super skin promotes rapid repair, minimizes scarring, and promotes healthier skin regeneration in record time.',
        mediaUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1612536539035-1a8335aa8823?q=80&w=1974&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        details: {
            publishedBy: 'MedTech',
            publishedOn: '11-03-2025',
            link: 'https://x.com/Akshaay_24',
        },
        createdAt: new Date('2025-03-11T10:00:00Z'),
        publishedAtMs: new Date('2025-03-11T10:00:00Z').getTime(),
        tags: ['medtech', 'biotech', 'regenerative-medicine', 'healthcare'],
        searchKeywords: ['super', 'skin', 'wound', 'healing', 'medtech', 'health', 'care'],
        momentumScore: 89.1,
        relatedTrendIds: ['2'],
        keyTakeaways: [
            'Bioengineered hydrogel matrix accelerates tissue regeneration within 4 hours.',
        ],
        status: 'published',
        isFallback: true,
    },
    {
        id: '2',
        domain: { name: 'Health Care', icon: resolveTrendzDomainIcon('health-care'), isFollowed: true },
        domainSlug: 'health-care',
        title: 'AI Achieved 99% Accuracy Detecting Cancer',
        summary:
            'A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools. It was trained on thousands of microscope images, covering everything from normal tissue.',
        fullContent:
            'A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools. It was trained on thousands of microscope images, covering everything from normal tissue to malignant cells. This breakthrough promises earlier diagnosis, more effective treatment planning, and a significant step forward in the fight against cancer.',
        mediaUrl: 'https://images.unsplash.com/photo-1554734867-bf3c00a49371?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1526253752538-345100688942?q=80&w=2070&auto=format&fit=crop',
        stats: { likes: 95600, views: 51200000, comments: 15800 },
        details: {
            publishedBy: 'AI Forward',
            publishedOn: '10-03-2025',
            link: 'https://x.com/Invox',
        },
        createdAt: new Date('2025-03-10T10:00:00Z'),
        publishedAtMs: new Date('2025-03-10T10:00:00Z').getTime(),
        tags: ['ai', 'oncology', 'diagnostics', 'healthcare'],
        searchKeywords: ['ai', 'cancer', 'detection', 'diagnostics', 'forward', 'health', 'care'],
        momentumScore: 93.7,
        relatedTrendIds: ['1', '8'],
        keyTakeaways: [
            'Pathology vision model reaches 99.2% detection sensitivity across biopsy slides.',
        ],
        status: 'published',
        isFallback: true,
    },
    {
        id: '3',
        domain: { name: 'Technology', icon: resolveTrendzDomainIcon('technology'), isFollowed: true },
        domainSlug: 'technology',
        title: 'Quantum Computing Achieves New Milestone',
        summary:
            'Researchers have successfully maintained quantum coherence for a record-breaking duration, paving the way for more stable and powerful quantum computers.',
        fullContent:
            'In a significant leap for quantum computing, researchers at a leading institute have successfully maintained quantum coherence in a qubit system for a record-breaking duration. This breakthrough addresses one of the primary obstacles in building functional quantum computers, paving the way for more stable, powerful, and error-resistant machines capable of solving problems far beyond the reach of classical computers.',
        mediaUrl: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1964&auto=format&fit=crop',
        stats: { likes: 120000, views: 65000000, comments: 25000 },
        details: {
            publishedBy: 'Tech Frontiers',
            publishedOn: '09-03-2025',
            link: 'https://x.com/Invox',
        },
        createdAt: new Date('2025-03-09T10:00:00Z'),
        publishedAtMs: new Date('2025-03-09T10:00:00Z').getTime(),
        tags: ['quantum', 'computing', 'qubits', 'technology'],
        searchKeywords: ['quantum', 'computing', 'coherence', 'qubit', 'frontiers', 'technology'],
        momentumScore: 96.2,
        relatedTrendIds: ['8'],
        keyTakeaways: [
            'Extended qubit coherence reduces logical error rates for fault-tolerant computing.',
        ],
        status: 'published',
        isFallback: true,
    },
    {
        id: '4',
        domain: { name: 'Trading', icon: resolveTrendzDomainIcon('trading'), isFollowed: false },
        domainSlug: 'trading',
        title: 'AI-Powered Trading Bots Outperform Market',
        summary:
            'A new study reveals that advanced AI-powered trading bots are consistently outperforming traditional market benchmarks, leveraging real-time data analysis.',
        fullContent:
            'A new comprehensive study has revealed that advanced AI-powered trading bots are consistently outperforming traditional market benchmarks. By leveraging sophisticated algorithms and real-time data analysis, these bots can identify and act on market opportunities faster than human traders, marking a significant shift in the landscape of financial trading and investment strategies.',
        mediaUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1640286599723-3a479a3243c2?q=80&w=1964&auto=format&fit=crop',
        stats: { likes: 78000, views: 32000000, comments: 9500 },
        details: {
            publishedBy: 'FinTech Today',
            publishedOn: '08-03-2025',
            link: 'https://x.com/Invox',
        },
        createdAt: new Date('2025-03-08T10:00:00Z'),
        publishedAtMs: new Date('2025-03-08T10:00:00Z').getTime(),
        tags: ['trading', 'fintech', 'ai', 'quant'],
        searchKeywords: ['trading', 'bots', 'fintech', 'market', 'algorithms', 'ai'],
        momentumScore: 84.5,
        relatedTrendIds: ['5'],
        keyTakeaways: [
            'Real-time multi-signal models improve execution speed over legacy heuristics.',
        ],
        status: 'published',
        isFallback: true,
    },
    {
        id: '5',
        domain: { name: 'Stock Market', icon: resolveTrendzDomainIcon('stock-market'), isFollowed: false },
        domainSlug: 'stock-market',
        title: 'Green Energy Stocks Surge on New Policy',
        summary:
            'Following the announcement of new global green energy policies, stocks in the renewable energy sector have seen an unprecedented surge, attracting significant investor interest.',
        fullContent:
            'Following the announcement of new global green energy policies, stocks in the renewable energy sector have experienced an unprecedented surge. This rally is attracting significant investor interest, as companies specializing in solar, wind, and other sustainable technologies are expected to see massive growth, signaling a major shift in market dynamics towards sustainability.',
        mediaUrl: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        mediaOverlayUrl: 'https://images.unsplash.com/photo-1623352013854-a65c275a59a6?q=80&w=1965&auto=format&fit=crop',
        stats: { likes: 91000, views: 41000000, comments: 11200 },
        details: {
            publishedBy: 'Market Watch',
            publishedOn: '07-03-2025',
            link: 'https://x.com/Invox',
        },
        createdAt: new Date('2025-03-07T10:00:00Z'),
        publishedAtMs: new Date('2025-03-07T10:00:00Z').getTime(),
        tags: ['stock-market', 'green-energy', 'renewables', 'policy'],
        searchKeywords: ['green', 'energy', 'stocks', 'renewable', 'market', 'watch', 'policy'],
        momentumScore: 87.3,
        relatedTrendIds: ['4'],
        keyTakeaways: [
            'Clean-energy incentives drive broad institutional inflows across solar and wind equities.',
        ],
        status: 'published',
        isFallback: true,
    },
];

export function queryFallbackMockTrends(options: {
    domainSlugs?: TrendzDomainSlug[];
    searchQuery?: string;
    sortBy?: TrendSortMode;
}): TrendViewModel[] {
    const domainSlugs = normalizeDomainSlugList(options.domainSlugs);
    const searchQuery = (options.searchQuery || '').trim();
    const sortBy = options.sortBy === 'momentum' ? 'momentum' : 'latest';

    const filtered = DEVELOPMENT_MOCK_TRENDS.filter((item) => {
        const domainOk = domainSlugs.length === 0 || domainSlugs.includes(item.domainSlug);
        const searchOk = !searchQuery || matchesTrendSearch(item, searchQuery);
        return domainOk && searchOk;
    });

    return sortTrendsDeterministically(filtered, sortBy);
}

export function getFallbackMockTrendById(trendId: string): TrendViewModel | null {
    return DEVELOPMENT_MOCK_TRENDS.find((item) => item.id === trendId) || null;
}

export function getFallbackRelatedMockTrends(
    relatedTrendIds: string[],
    excludeTrendId: string,
    maxCount = 4
): TrendViewModel[] {
    if (!Array.isArray(relatedTrendIds) || relatedTrendIds.length === 0) {
        return [];
    }
    const result: TrendViewModel[] = [];
    for (const relId of relatedTrendIds) {
        if (relId === excludeTrendId) continue;
        const found = getFallbackMockTrendById(relId);
        if (found) {
            result.push(found);
            if (result.length >= maxCount) break;
        }
    }
    return dedupeTrendsById(result);
}

// ============================================================================
// PHASE 04: USER ENGAGEMENT & PERSONALIZATION (FIRESTORE-PERSISTED)
// ============================================================================

const USERS_COLLECTION = 'users';
const LIKES_COLLECTION = 'likes';
const BOOKMARKS_COLLECTION = 'bookmarks';
const TREND_VIEWS_SUBCOLLECTION = 'trendViews';
const TRENDZ_PREFERENCES_SUBCOLLECTION = 'trendzPreferences';
const TRENDZ_DOMAIN_PREFERENCES_DOC_ID = 'domains';
const TRENDZ_TARGET_TYPE = 'trendz' as const;

export interface TrendBookmarkRecord {
    id: string;
    userId: string;
    targetType: typeof TRENDZ_TARGET_TYPE;
    targetId: string;
    domainSlug: TrendzDomainSlug;
    trendTitle: string;
    trendSummary: string;
    trendPublisher: string;
    trendPublishedOn: string;
    trendMediaUrl: string;
    trendMediaType: 'image' | 'video';
    createdAtMs: number;
}

export interface SavedTrendEntry {
    trendId: string;
    savedAtMs: number;
    bookmark: TrendBookmarkRecord;
    trend: TrendViewModel | null;
    isUnavailable: boolean;
}

export interface TrendUpvoteRecord {
    id: string;
    userId: string;
    targetType: typeof TRENDZ_TARGET_TYPE;
    targetId: string;
    domainSlug: TrendzDomainSlug;
    createdAtMs: number;
}

export interface TrendViewRecord {
    userId: string;
    trendId: string;
    domainSlug: TrendzDomainSlug;
    viewedAtMs: number;
}

export interface PersonalizationSignals {
    followedDomainSlugs: TrendzDomainSlug[];
    bookmarkedRecords: TrendBookmarkRecord[];
    upvoteRecords: TrendUpvoteRecord[];
    viewRecords: TrendViewRecord[];
}

export type PersonalizedTrendReason =
    | 'FOLLOWED_DOMAIN'
    | 'SAVED_DOMAIN_MATCH'
    | 'UPVOTED_DOMAIN_MATCH'
    | 'RECENT_INTEREST'
    | 'HIGH_MOMENTUM';

export interface PersonalizedFeedResult {
    items: TrendViewModel[];
    hasPersonalizationSignals: boolean;
    matchedPreferenceCount: number;
    reasonsByTrendId: Record<string, PersonalizedTrendReason>;
    scoresByTrendId: Record<string, number>;
}

const sessionRecordedViewsByUser = new Map<string, Set<string>>();

function assertValidUserId(userId: string): string {
    const cleaned = typeof userId === 'string' ? userId.trim() : '';
    if (!cleaned || cleaned.includes('/')) {
        throw new Error('Authentication required. Please sign in to save your Trendz activity.');
    }
    return cleaned;
}

function normalizeStatsForWrite(raw: unknown): TrendStats {
    const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        likes: Math.max(0, Math.floor(toSafeNumber(src.likes))),
        views: Math.max(0, Math.floor(toSafeNumber(src.views))),
        comments: Math.max(0, Math.floor(toSafeNumber(src.comments))),
        saves: Math.max(0, Math.floor(toSafeNumber(src.saves))),
        shares: Math.max(0, Math.floor(toSafeNumber(src.shares))),
    };
}

/**
 * Deterministic document ID for Trendz likes and bookmarks.
 * Namespaced with `_trendz_` so it never collides with post/poll engagement docs
 * and prevents duplicate records per user per trend.
 */
export function getTrendEngagementDocId(userId: string, trendId: string): string {
    const cleanUid = assertValidUserId(userId);
    if (!isValidTrendId(trendId)) {
        throw new Error('Invalid trend identifier.');
    }
    return `${cleanUid}_trendz_${trendId.trim()}`;
}

/**
 * Normalizes and deduplicates a list of followed Trendz domain slugs against the canonical registry.
 */
export function normalizeFollowedTrendDomains(raw: unknown): TrendzDomainSlug[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const unique = new Set<TrendzDomainSlug>();
    for (const entry of raw) {
        const slug = normalizeTrendzDomainSlug(entry);
        if (slug) {
            unique.add(slug);
            if (unique.size >= 20) break;
        }
    }
    return Array.from(unique);
}

/**
 * Returns the canonical private Firestore document path for a user's followed Trendz domains.
 */
export function getUserTrendzDomainPreferencesPath(userId: string): string {
    const cleanUid = assertValidUserId(userId);
    return `${USERS_COLLECTION}/${cleanUid}/${TRENDZ_PREFERENCES_SUBCOLLECTION}/${TRENDZ_DOMAIN_PREFERENCES_DOC_ID}`;
}

function getUserTrendzDomainPreferencesRef(cleanUid: string) {
    return doc(
        db,
        USERS_COLLECTION,
        cleanUid,
        TRENDZ_PREFERENCES_SUBCOLLECTION,
        TRENDZ_DOMAIN_PREFERENCES_DOC_ID
    );
}

/**
 * Reads the authenticated user's followed Trendz domain slugs from the private owner-only
 * document users/{userId}/trendzPreferences/domains, falling back gracefully to legacy
 * users/{userId}.followedTrendDomains if the private preferences document has not yet been initialized.
 */
export async function fetchUserFollowedTrendDomains(userId: string): Promise<TrendzDomainSlug[]> {
    const cleanUid = assertValidUserId(userId);
    const prefRef = getUserTrendzDomainPreferencesRef(cleanUid);
    const prefSnap = await getDoc(prefRef);

    if (prefSnap.exists()) {
        return normalizeFollowedTrendDomains(prefSnap.data()?.followedDomains);
    }

    // Legacy Phase 04 fallback for accounts that followed domains before migration
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, cleanUid));
    if (!userSnap.exists()) {
        return [];
    }
    return normalizeFollowedTrendDomains(userSnap.data()?.followedTrendDomains);
}

/**
 * Persists a validated, deduplicated list of followed Trendz domains in the private owner-only
 * document users/{userId}/trendzPreferences/domains using a Firestore transaction.
 */
export async function setUserFollowedTrendDomains(
    userId: string,
    domainSlugs: string[]
): Promise<TrendzDomainSlug[]> {
    const cleanUid = assertValidUserId(userId);
    const normalized = normalizeFollowedTrendDomains(domainSlugs);
    const prefRef = getUserTrendzDomainPreferencesRef(cleanUid);

    return runTransaction(db, async (tx) => {
        const prefSnap = await tx.get(prefRef);
        if (prefSnap.exists()) {
            tx.update(prefRef, {
                userId: cleanUid,
                followedDomains: normalized,
                updatedAt: serverTimestamp(),
            });
        } else {
            tx.set(prefRef, {
                userId: cleanUid,
                followedDomains: normalized,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        }
        return normalized;
    });
}

/**
 * Follows a canonical Trendz domain for the authenticated user using a Firestore transaction
 * on users/{userId}/trendzPreferences/domains so duplicate entries cannot be created by
 * concurrent requests.
 */
export async function followTrendDomain(
    userId: string,
    rawDomain: string
): Promise<TrendzDomainSlug[]> {
    const cleanUid = assertValidUserId(userId);
    const slug = normalizeTrendzDomainSlug(rawDomain);
    if (!slug) {
        throw new Error('Invalid Trendz domain.');
    }

    const prefRef = getUserTrendzDomainPreferencesRef(cleanUid);
    const userRef = doc(db, USERS_COLLECTION, cleanUid);

    return runTransaction(db, async (tx) => {
        const prefSnap = await tx.get(prefRef);
        if (prefSnap.exists()) {
            const current = normalizeFollowedTrendDomains(prefSnap.data()?.followedDomains);
            if (current.includes(slug)) {
                return current;
            }
            const next = normalizeFollowedTrendDomains([...current, slug]);
            tx.update(prefRef, {
                userId: cleanUid,
                followedDomains: next,
                updatedAt: serverTimestamp(),
            });
            return next;
        }

        const userSnap = await tx.get(userRef);
        const legacy = userSnap.exists()
            ? normalizeFollowedTrendDomains(userSnap.data()?.followedTrendDomains)
            : [];
        const next = normalizeFollowedTrendDomains([...legacy, slug]);
        tx.set(prefRef, {
            userId: cleanUid,
            followedDomains: next,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return next;
    });
}

/**
 * Unfollows a canonical Trendz domain for the authenticated user using a Firestore transaction
 * on users/{userId}/trendzPreferences/domains.
 */
export async function unfollowTrendDomain(
    userId: string,
    rawDomain: string
): Promise<TrendzDomainSlug[]> {
    const cleanUid = assertValidUserId(userId);
    const slug = normalizeTrendzDomainSlug(rawDomain);
    if (!slug) {
        throw new Error('Invalid Trendz domain.');
    }

    const prefRef = getUserTrendzDomainPreferencesRef(cleanUid);
    const userRef = doc(db, USERS_COLLECTION, cleanUid);

    return runTransaction(db, async (tx) => {
        const prefSnap = await tx.get(prefRef);
        if (prefSnap.exists()) {
            const current = normalizeFollowedTrendDomains(prefSnap.data()?.followedDomains);
            if (!current.includes(slug)) {
                return current;
            }
            const next = current.filter((item) => item !== slug);
            tx.update(prefRef, {
                userId: cleanUid,
                followedDomains: next,
                updatedAt: serverTimestamp(),
            });
            return next;
        }

        const userSnap = await tx.get(userRef);
        const legacy = userSnap.exists()
            ? normalizeFollowedTrendDomains(userSnap.data()?.followedTrendDomains)
            : [];
        const next = legacy.filter((item) => item !== slug);
        tx.set(prefRef, {
            userId: cleanUid,
            followedDomains: next,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return next;
    });
}

function parseTrendBookmarkDoc(
    docId: string,
    raw: DocumentData | undefined
): TrendBookmarkRecord | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.targetType !== TRENDZ_TARGET_TYPE) return null;
    if (typeof raw.userId !== 'string' || !raw.userId.trim()) return null;
    if (!isValidTrendId(raw.targetId)) return null;

    const domainSlug = normalizeTrendzDomainSlug(raw.domainSlug) || 'technology';
    return {
        id: docId,
        userId: raw.userId.trim(),
        targetType: TRENDZ_TARGET_TYPE,
        targetId: raw.targetId.trim(),
        domainSlug,
        trendTitle:
            typeof raw.trendTitle === 'string' && raw.trendTitle.trim()
                ? raw.trendTitle.trim()
                : 'Saved Trend',
        trendSummary: typeof raw.trendSummary === 'string' ? raw.trendSummary.trim() : '',
        trendPublisher:
            typeof raw.trendPublisher === 'string' && raw.trendPublisher.trim()
                ? raw.trendPublisher.trim()
                : 'INVOX Desk',
        trendPublishedOn:
            typeof raw.trendPublishedOn === 'string' && raw.trendPublishedOn.trim()
                ? raw.trendPublishedOn.trim()
                : 'RECENT',
        trendMediaUrl: sanitizeExternalUrl(raw.trendMediaUrl) || '',
        trendMediaType: raw.trendMediaType === 'video' ? 'video' : 'image',
        createdAtMs: getNormalizedTimestamp(raw.createdAt),
    };
}

/**
 * Fetches all Trendz bookmarks belonging strictly to the authenticated user.
 */
export async function fetchUserTrendBookmarks(userId: string): Promise<TrendBookmarkRecord[]> {
    const cleanUid = assertValidUserId(userId);
    const bookmarksRef = collection(db, BOOKMARKS_COLLECTION);

    try {
        const snap = await getDocs(
            query(
                bookmarksRef,
                where('userId', '==', cleanUid),
                where('targetType', '==', TRENDZ_TARGET_TYPE),
                orderBy('createdAt', 'desc'),
                limit(100)
            )
        );
        const records: TrendBookmarkRecord[] = [];
        for (const docSnap of snap.docs) {
            const parsed = parseTrendBookmarkDoc(docSnap.id, docSnap.data());
            if (parsed) records.push(parsed);
        }
        return records;
    } catch (err: any) {
        if (!isMissingIndexError(err)) {
            throw err;
        }
        const fallbackSnap = await getDocs(
            query(
                bookmarksRef,
                where('userId', '==', cleanUid),
                where('targetType', '==', TRENDZ_TARGET_TYPE),
                limit(100)
            )
        );
        const records: TrendBookmarkRecord[] = [];
        for (const docSnap of fallbackSnap.docs) {
            const parsed = parseTrendBookmarkDoc(docSnap.id, docSnap.data());
            if (parsed) records.push(parsed);
        }
        return records.sort((a, b) => b.createdAtMs - a.createdAtMs);
    }
}

/**
 * Atomically toggles a Trendz bookmark for the authenticated user using a Firestore transaction.
 * Verifies the target trend is published before creating a bookmark and synchronizes `stats.saves`.
 */
export async function toggleTrendBookmark(
    userId: string,
    trend: TrendViewModel
): Promise<{ bookmarked: boolean; savesCount: number; bookmark: TrendBookmarkRecord | null }> {
    const cleanUid = assertValidUserId(userId);
    if (trend.isFallback) {
        throw new Error('Sample fallback trends cannot be bookmarked. Switch to live Trendz first.');
    }
    const bookmarkId = getTrendEngagementDocId(cleanUid, trend.id);
    const bookmarkRef = doc(db, BOOKMARKS_COLLECTION, bookmarkId);
    const trendRef = doc(db, TRENDZ_COLLECTION, trend.id);

    return runTransaction(db, async (tx) => {
        const [bookmarkSnap, trendSnap] = await Promise.all([
            tx.get(bookmarkRef),
            tx.get(trendRef),
        ]);

        const isPublished = trendSnap.exists() && trendSnap.data()?.status === 'published';
        const currentStats = normalizeStatsForWrite(trendSnap.data()?.stats);

        if (bookmarkSnap.exists()) {
            tx.delete(bookmarkRef);
            const nextSaves = Math.max(0, currentStats.saves - 1);
            if (isPublished) {
                tx.update(trendRef, {
                    stats: {
                        ...currentStats,
                        saves: nextSaves,
                    },
                });
            }
            return { bookmarked: false, savesCount: nextSaves, bookmark: null };
        }

        if (!isPublished) {
            throw new Error('This trend is no longer published and cannot be bookmarked.');
        }

        const safeDomainSlug =
            normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';
        const safeTitle = (trend.title || 'Untitled Trend').trim().slice(0, 240);
        const safeSummary = (trend.summary || trend.fullContent || '').trim().slice(0, 500);
        const safePublisher = (trend.details?.publishedBy || 'INVOX Desk').trim().slice(0, 160);
        const safePublishedOn = (trend.details?.publishedOn || 'RECENT').trim().slice(0, 32);
        const safeMediaUrl = (sanitizeExternalUrl(trend.mediaUrl) || '').slice(0, 2048);
        const safeMediaType: 'image' | 'video' = trend.mediaType === 'video' ? 'video' : 'image';

        tx.set(bookmarkRef, {
            userId: cleanUid,
            targetType: TRENDZ_TARGET_TYPE,
            targetId: trend.id,
            domainSlug: safeDomainSlug,
            trendTitle: safeTitle,
            trendSummary: safeSummary,
            trendPublisher: safePublisher,
            trendPublishedOn: safePublishedOn,
            trendMediaUrl: safeMediaUrl,
            trendMediaType: safeMediaType,
            createdAt: serverTimestamp(),
        });

        const nextSaves = currentStats.saves + 1;
        tx.update(trendRef, {
            stats: {
                ...currentStats,
                saves: nextSaves,
            },
        });

        return {
            bookmarked: true,
            savesCount: nextSaves,
            bookmark: {
                id: bookmarkId,
                userId: cleanUid,
                targetType: TRENDZ_TARGET_TYPE,
                targetId: trend.id,
                domainSlug: safeDomainSlug,
                trendTitle: safeTitle,
                trendSummary: safeSummary,
                trendPublisher: safePublisher,
                trendPublishedOn: safePublishedOn,
                trendMediaUrl: safeMediaUrl,
                trendMediaType: safeMediaType,
                createdAtMs: Date.now(),
            },
        };
    });
}

/**
 * Removes a user's saved trend bookmark by ID, even if the underlying trend was deleted or unpublished.
 */
export async function removeTrendBookmarkById(userId: string, trendId: string): Promise<void> {
    const cleanUid = assertValidUserId(userId);
    const bookmarkId = getTrendEngagementDocId(cleanUid, trendId);
    const bookmarkRef = doc(db, BOOKMARKS_COLLECTION, bookmarkId);
    const trendRef = doc(db, TRENDZ_COLLECTION, trendId.trim());

    await runTransaction(db, async (tx) => {
        const [bookmarkSnap, trendSnap] = await Promise.all([
            tx.get(bookmarkRef),
            tx.get(trendRef),
        ]);
        if (!bookmarkSnap.exists()) {
            return;
        }
        tx.delete(bookmarkRef);
        if (trendSnap.exists() && trendSnap.data()?.status === 'published') {
            const currentStats = normalizeStatsForWrite(trendSnap.data()?.stats);
            tx.update(trendRef, {
                stats: {
                    ...currentStats,
                    saves: Math.max(0, currentStats.saves - 1),
                },
            });
        }
    });
}

/**
 * Hydrates a user's Saved Trends list by resolving each bookmark against live published /trendz records.
 * Deleted or unpublished trends are preserved as graceful unavailable entries with their saved snapshot.
 */
export async function fetchSavedTrendsForUser(userId: string): Promise<SavedTrendEntry[]> {
    const bookmarks = await fetchUserTrendBookmarks(userId);
    if (bookmarks.length === 0) {
        return [];
    }

    const hydrated = await Promise.all(
        bookmarks.map(async (bookmark): Promise<SavedTrendEntry> => {
            try {
                const liveTrend = await fetchTrendById(bookmark.targetId);
                return {
                    trendId: bookmark.targetId,
                    savedAtMs: bookmark.createdAtMs,
                    bookmark,
                    trend: liveTrend,
                    isUnavailable: !liveTrend,
                };
            } catch {
                return {
                    trendId: bookmark.targetId,
                    savedAtMs: bookmark.createdAtMs,
                    bookmark,
                    trend: null,
                    isUnavailable: true,
                };
            }
        })
    );

    return hydrated;
}

function parseTrendUpvoteDoc(
    docId: string,
    raw: DocumentData | undefined
): TrendUpvoteRecord | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.targetType !== TRENDZ_TARGET_TYPE) return null;
    if (typeof raw.userId !== 'string' || !raw.userId.trim()) return null;
    if (!isValidTrendId(raw.targetId)) return null;

    return {
        id: docId,
        userId: raw.userId.trim(),
        targetType: TRENDZ_TARGET_TYPE,
        targetId: raw.targetId.trim(),
        domainSlug: normalizeTrendzDomainSlug(raw.domainSlug) || 'technology',
        createdAtMs: getNormalizedTimestamp(raw.createdAt),
    };
}

/**
 * Fetches all Trendz upvotes belonging strictly to the authenticated user.
 */
export async function fetchUserTrendUpvotes(userId: string): Promise<TrendUpvoteRecord[]> {
    const cleanUid = assertValidUserId(userId);
    const likesRef = collection(db, LIKES_COLLECTION);

    try {
        const snap = await getDocs(
            query(
                likesRef,
                where('userId', '==', cleanUid),
                where('targetType', '==', TRENDZ_TARGET_TYPE),
                orderBy('createdAt', 'desc'),
                limit(200)
            )
        );
        const records: TrendUpvoteRecord[] = [];
        for (const docSnap of snap.docs) {
            const parsed = parseTrendUpvoteDoc(docSnap.id, docSnap.data());
            if (parsed) records.push(parsed);
        }
        return records;
    } catch (err: any) {
        if (!isMissingIndexError(err)) {
            throw err;
        }
        const fallbackSnap = await getDocs(
            query(
                likesRef,
                where('userId', '==', cleanUid),
                where('targetType', '==', TRENDZ_TARGET_TYPE),
                limit(200)
            )
        );
        const records: TrendUpvoteRecord[] = [];
        for (const docSnap of fallbackSnap.docs) {
            const parsed = parseTrendUpvoteDoc(docSnap.id, docSnap.data());
            if (parsed) records.push(parsed);
        }
        return records.sort((a, b) => b.createdAtMs - a.createdAtMs);
    }
}

/**
 * Atomically toggles an upvote on a published trend using a Firestore transaction.
 * Deterministic doc ID `${userId}_trendz_${trendId}` guarantees no duplicate upvotes per user.
 */
export async function toggleTrendUpvote(
    userId: string,
    trend: TrendViewModel
): Promise<{ upvoted: boolean; likesCount: number; record: TrendUpvoteRecord | null }> {
    const cleanUid = assertValidUserId(userId);
    if (trend.isFallback) {
        throw new Error('Sample fallback trends cannot be upvoted. Switch to live Trendz first.');
    }
    const likeId = getTrendEngagementDocId(cleanUid, trend.id);
    const likeRef = doc(db, LIKES_COLLECTION, likeId);
    const trendRef = doc(db, TRENDZ_COLLECTION, trend.id);

    return runTransaction(db, async (tx) => {
        const [likeSnap, trendSnap] = await Promise.all([tx.get(likeRef), tx.get(trendRef)]);
        const isPublished = trendSnap.exists() && trendSnap.data()?.status === 'published';
        const currentStats = normalizeStatsForWrite(trendSnap.data()?.stats);

        if (likeSnap.exists()) {
            tx.delete(likeRef);
            const nextLikes = Math.max(0, currentStats.likes - 1);
            if (isPublished) {
                tx.update(trendRef, {
                    stats: {
                        ...currentStats,
                        likes: nextLikes,
                    },
                });
            }
            return { upvoted: false, likesCount: nextLikes, record: null };
        }

        if (!isPublished) {
            throw new Error('This trend is no longer published and cannot be upvoted.');
        }

        const safeDomainSlug =
            normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';

        tx.set(likeRef, {
            userId: cleanUid,
            targetType: TRENDZ_TARGET_TYPE,
            targetId: trend.id,
            domainSlug: safeDomainSlug,
            createdAt: serverTimestamp(),
        });

        const nextLikes = currentStats.likes + 1;
        tx.update(trendRef, {
            stats: {
                ...currentStats,
                likes: nextLikes,
            },
        });

        return {
            upvoted: true,
            likesCount: nextLikes,
            record: {
                id: likeId,
                userId: cleanUid,
                targetType: TRENDZ_TARGET_TYPE,
                targetId: trend.id,
                domainSlug: safeDomainSlug,
                createdAtMs: Date.now(),
            },
        };
    });
}

/**
 * Fetches the authenticated user's private recent trend views from users/{userId}/trendViews.
 */
export async function fetchUserTrendViews(userId: string): Promise<TrendViewRecord[]> {
    const cleanUid = assertValidUserId(userId);
    const viewsRef = collection(db, USERS_COLLECTION, cleanUid, TREND_VIEWS_SUBCOLLECTION);

    try {
        const snap = await getDocs(
            query(viewsRef, orderBy('viewedAt', 'desc'), limit(100))
        );
        const records: TrendViewRecord[] = [];
        for (const docSnap of snap.docs) {
            const raw = docSnap.data();
            if (!isValidTrendId(docSnap.id)) continue;
            records.push({
                userId: cleanUid,
                trendId: docSnap.id,
                domainSlug: normalizeTrendzDomainSlug(raw.domainSlug) || 'technology',
                viewedAtMs: getNormalizedTimestamp(raw.viewedAt),
            });
        }
        return records;
    } catch {
        const fallbackSnap = await getDocs(query(viewsRef, limit(100)));
        const records: TrendViewRecord[] = [];
        for (const docSnap of fallbackSnap.docs) {
            const raw = docSnap.data();
            if (!isValidTrendId(docSnap.id)) continue;
            records.push({
                userId: cleanUid,
                trendId: docSnap.id,
                domainSlug: normalizeTrendzDomainSlug(raw.domainSlug) || 'technology',
                viewedAtMs: getNormalizedTimestamp(raw.viewedAt),
            });
        }
        return records.sort((a, b) => b.viewedAtMs - a.viewedAtMs);
    }
}

/**
 * Records a deduplicated trend view for the authenticated user.
 * Uses both in-session deduplication and a Firestore transaction against private
 * `users/{userId}/trendViews/{trendId}` so each user increments `stats.views` at most once.
 */
export async function recordTrendView(
    userId: string,
    trend: TrendViewModel
): Promise<{ recorded: boolean; viewsCount: number; record: TrendViewRecord | null }> {
    const cleanUid = typeof userId === 'string' ? userId.trim() : '';
    const baseViews = Math.max(0, Math.floor(toSafeNumber(trend.stats?.views)));
    if (!cleanUid || trend.isFallback || !isValidTrendId(trend.id)) {
        return { recorded: false, viewsCount: baseViews, record: null };
    }

    let userSessionSet = sessionRecordedViewsByUser.get(cleanUid);
    if (!userSessionSet) {
        userSessionSet = new Set<string>();
        sessionRecordedViewsByUser.set(cleanUid, userSessionSet);
    }
    if (userSessionSet.has(trend.id)) {
        return { recorded: false, viewsCount: baseViews, record: null };
    }

    const viewRef = doc(db, USERS_COLLECTION, cleanUid, TREND_VIEWS_SUBCOLLECTION, trend.id);
    const trendRef = doc(db, TRENDZ_COLLECTION, trend.id);

    const result = await runTransaction(db, async (tx) => {
        const [viewSnap, trendSnap] = await Promise.all([tx.get(viewRef), tx.get(trendRef)]);
        if (!trendSnap.exists() || trendSnap.data()?.status !== 'published') {
            return { recorded: false, viewsCount: baseViews, record: null };
        }
        const currentStats = normalizeStatsForWrite(trendSnap.data()?.stats);
        if (viewSnap.exists()) {
            return { recorded: false, viewsCount: currentStats.views, record: null };
        }

        const safeDomainSlug =
            normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';

        tx.set(viewRef, {
            userId: cleanUid,
            trendId: trend.id,
            domainSlug: safeDomainSlug,
            viewedAt: serverTimestamp(),
        });

        const nextViews = currentStats.views + 1;
        tx.update(trendRef, {
            stats: {
                ...currentStats,
                views: nextViews,
            },
        });

        return {
            recorded: true,
            viewsCount: nextViews,
            record: {
                userId: cleanUid,
                trendId: trend.id,
                domainSlug: safeDomainSlug,
                viewedAtMs: Date.now(),
            },
        };
    });

    userSessionSet.add(trend.id);
    return result;
}

/**
 * Deterministic, transparent, non-AI personalized feed ranking engine.
 * Combines:
 * 1. Followed domain preference (+45 pts)
 * 2. Bookmark domain affinity (up to +24 pts)
 * 3. Upvote domain affinity (up to +18 pts)
 * 4. Recent view domain affinity (up to +10 pts)
 * 5. Momentum + recency baseline (0..55 pts via utils/trendingScore.ts)
 * 6. Gentle unseen freshness bias (-6 pts for already-viewed items without hiding content)
 */
export function rankPersonalizedTrends(
    candidates: TrendViewModel[],
    signals: PersonalizationSignals,
    nowMs = Date.now()
): PersonalizedFeedResult {
    const uniqueCandidates = dedupeTrendsById(candidates);
    const followedSet = new Set<TrendzDomainSlug>(
        normalizeFollowedTrendDomains(signals.followedDomainSlugs)
    );

    const bookmarkDomainCounts = new Map<TrendzDomainSlug, number>();
    for (const bookmark of signals.bookmarkedRecords || []) {
        const slug = normalizeTrendzDomainSlug(bookmark.domainSlug);
        if (slug) {
            bookmarkDomainCounts.set(slug, (bookmarkDomainCounts.get(slug) || 0) + 1);
        }
    }

    const upvoteDomainCounts = new Map<TrendzDomainSlug, number>();
    for (const upvote of signals.upvoteRecords || []) {
        const slug = normalizeTrendzDomainSlug(upvote.domainSlug);
        if (slug) {
            upvoteDomainCounts.set(slug, (upvoteDomainCounts.get(slug) || 0) + 1);
        }
    }

    const viewDomainCounts = new Map<TrendzDomainSlug, number>();
    const viewedTrendIds = new Set<string>();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    for (const view of signals.viewRecords || []) {
        viewedTrendIds.add(view.trendId);
        const slug = normalizeTrendzDomainSlug(view.domainSlug);
        if (slug && nowMs - view.viewedAtMs <= thirtyDaysMs) {
            viewDomainCounts.set(slug, (viewDomainCounts.get(slug) || 0) + 1);
        }
    }

    const hasPersonalizationSignals =
        followedSet.size > 0 ||
        bookmarkDomainCounts.size > 0 ||
        upvoteDomainCounts.size > 0 ||
        viewDomainCounts.size > 0;

    const reasonsByTrendId: Record<string, PersonalizedTrendReason> = {};
    const scoresByTrendId: Record<string, number> = {};
    let matchedPreferenceCount = 0;

    const scored = uniqueCandidates.map((trend) => {
        const isFollowed = followedSet.has(trend.domainSlug);
        const bookmarkHits = bookmarkDomainCounts.get(trend.domainSlug) || 0;
        const upvoteHits = upvoteDomainCounts.get(trend.domainSlug) || 0;
        const viewHits = viewDomainCounts.get(trend.domainSlug) || 0;

        const followedBoost = isFollowed ? 45 : 0;
        const bookmarkBoost = Math.min(24, bookmarkHits * 10);
        const upvoteBoost = Math.min(18, upvoteHits * 7);
        const viewBoost = Math.min(10, viewHits * 3);

        const ageHours = Math.max(0, (nowMs - trend.publishedAtMs) / 3_600_000);
        const recencyBaseline = 20 / Math.pow(1 + ageHours / 24, 0.75);
        const fallbackVelocity = computeTrendMomentumFallbackScore({
            stats: trend.stats,
            publishedAt: trend.publishedAtMs,
        });
        const momentumBaseline = Math.min(
            35,
            Math.log10(1 + Math.max(0, trend.momentumScore)) * 14 +
                Math.min(10, fallbackVelocity / 1000)
        );
        const seenPenalty = viewedTrendIds.has(trend.id) ? -6 : 0;

        const totalScore = Number(
            (
                followedBoost +
                bookmarkBoost +
                upvoteBoost +
                viewBoost +
                momentumBaseline +
                recencyBaseline +
                seenPenalty
            ).toFixed(4)
        );

        let reason: PersonalizedTrendReason = 'HIGH_MOMENTUM';
        if (isFollowed) {
            reason = 'FOLLOWED_DOMAIN';
            matchedPreferenceCount++;
        } else if (bookmarkHits > 0) {
            reason = 'SAVED_DOMAIN_MATCH';
            matchedPreferenceCount++;
        } else if (upvoteHits > 0) {
            reason = 'UPVOTED_DOMAIN_MATCH';
            matchedPreferenceCount++;
        } else if (viewHits > 0) {
            reason = 'RECENT_INTEREST';
            matchedPreferenceCount++;
        }

        reasonsByTrendId[trend.id] = reason;
        scoresByTrendId[trend.id] = totalScore;

        return { trend, totalScore };
    });

    scored.sort((a, b) => {
        if (Math.abs(b.totalScore - a.totalScore) > 0.0001) {
            return b.totalScore - a.totalScore;
        }
        if (Math.abs(b.trend.momentumScore - a.trend.momentumScore) > 0.0001) {
            return b.trend.momentumScore - a.trend.momentumScore;
        }
        if (b.trend.publishedAtMs !== a.trend.publishedAtMs) {
            return b.trend.publishedAtMs - a.trend.publishedAtMs;
        }
        return a.trend.id.localeCompare(b.trend.id);
    });

    return {
        items: scored.map((entry) => entry.trend),
        hasPersonalizationSignals,
        matchedPreferenceCount,
        reasonsByTrendId,
        scoresByTrendId,
    };
}

/**
 * Fetches a bounded candidate pool of published trends for the Personalized ("For You") feed,
 * prioritizing followed domains alongside general recent/high-momentum trends so users
 * without preferences still receive a complete, high-signal feed.
 */
export async function fetchPersonalizedTrendsFeed(
    signals: PersonalizationSignals,
    options: {
        domainSlugs?: TrendzDomainSlug[];
        searchQuery?: string;
        poolSize?: number;
    } = {}
): Promise<PersonalizedFeedResult> {
    const poolSize = Math.max(10, Math.min(options.poolSize ?? 30, 40));
    const explicitDomains = normalizeDomainSlugList(options.domainSlugs);
    const trimmedSearch = (options.searchQuery || '').trim();
    const followedSlugs = normalizeFollowedTrendDomains(signals.followedDomainSlugs);

    const requests: Promise<TrendFeedPage>[] = [
        fetchPublishedTrendsPage({
            pageSize: poolSize,
            domainSlugs: explicitDomains,
            sortBy: 'latest',
            searchQuery: trimmedSearch,
        }),
    ];

    // When no explicit domain filter is active and user follows domains, also pull targeted followed-domain items
    if (explicitDomains.length === 0 && followedSlugs.length > 0 && !trimmedSearch) {
        requests.push(
            fetchPublishedTrendsPage({
                pageSize: Math.min(20, poolSize),
                domainSlugs: followedSlugs.slice(0, 10),
                sortBy: 'momentum',
            })
        );
    }

    const settled = await Promise.allSettled(requests);
    const combined: TrendViewModel[] = [];
    let firstRejection: unknown = null;

    for (const res of settled) {
        if (res.status === 'fulfilled') {
            combined.push(...res.value.items);
        } else if (!firstRejection) {
            firstRejection = res.reason;
        }
    }

    if (combined.length === 0 && firstRejection) {
        throw firstRejection;
    }

    return rankPersonalizedTrends(combined, signals);
}

