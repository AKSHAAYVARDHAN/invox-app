import {
    collection,
    deleteDoc,
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
import { auth, db } from '../firebase';
import type {
    Trend,
    TrendMedia,
    TrendMediaOrigin,
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
import { TRENDZ_FALLBACK_SAMPLE_DATA } from '../utils/trendzFallbackData';

export type TrendSortMode = 'latest' | 'momentum';

export type SourceVerificationStatus = 'verified' | 'unavailable' | 'unverified' | 'pending';
export type SourceExcerptCompleteness = 'full_excerpt' | 'truncated' | 'unavailable';

export interface SourceVerificationResult {
    status: 'verified' | 'unavailable' | 'unverified';
    scope: 'url_reachability_only';
    checkedAtIso: string;
    originalUrl: string;
    finalUrl?: string;
    canonicalUrl?: string;
    redirected: boolean;
    redirectCount: number;
    httpStatus?: number;
    publisherName?: string;
    sourceDomain?: string;
    author?: string;
    sourceThumbnailUrl?: string;
    publishedAtIso?: string;
    excerpt?: string;
    excerptTruncated?: boolean;
    excerptCompleteness: SourceExcerptCompleteness;
    failureReason?: string;
    cached?: boolean;
}

export interface InitialSourceVerificationState {
    status: 'verified' | 'unverified';
    checkedAtMs?: number;
    needsLiveCheck: boolean;
    evidenceSource: 'persisted_record' | 'none';
    reason: string;
}

export interface TrendAdditionalSourceViewModel {
    name: string;
    url: string;
    publishedOn?: string;
}

/**
 * UI view model compatible with existing TrendzCard and TrendzDetail components,
 * enriched with normalized metadata from TrendRecord.
 */
export interface TrendViewModel extends Trend {
    domainSlug: TrendzDomainSlug;
    category?: string;
    slug?: string;
    tags: string[];
    searchKeywords: string[];
    momentumScore: number;
    relatedTrendIds: string[];
    keyTakeaways: string[];
    whyItMatters?: string;
    groundingStatus?: 'verified' | 'needs_review';
    sourceAuthor?: string;
    sourceDomain?: string;
    sourceCredibilityTier?: 'primary' | 'reputable' | 'trade';
    canonicalUrl?: string;
    discoveredAtMs?: number;
    sourceRetrievedAtMs?: number;
    reviewedAtMs?: number;
    aiModel?: string;
    mediaOrigin?: TrendMediaOrigin;
    sourceThumbnailUrl?: string;
    sourceExcerpt?: string;
    sourceExcerptTruncated?: boolean;
    sourceExcerptCompleteness?: SourceExcerptCompleteness;
    isSimulatedSource?: boolean;
    additionalSources?: TrendAdditionalSourceViewModel[];
    mediaAttribution?: string;
    region?: string;
    language?: string;
    status: TrendStatus;
    publishedAtMs: number;
    savesCount?: number;
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

/**
 * Formats a Timestamp / Date / millisecond value into an editorial date string (e.g. "12 Mar 2025").
 */
export function formatEditorialDate(value: unknown): string {
    const ms = getNormalizedTimestamp(value);
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
        return 'RECENT';
    }
    try {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return formatTrendDate(value);
    }
}

/**
 * Formats a verification or discovery timestamp with date + UTC time (e.g. "12 Mar 2025, 14:30 UTC").
 * Returns null if the value is missing or invalid (never fabricates a timestamp).
 */
export function formatVerificationTimestamp(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    let ms: number;
    if (typeof value === 'number') {
        ms = value;
    } else if (typeof value === 'string') {
        ms = Date.parse(value);
    } else if (value instanceof Date) {
        ms = value.getTime();
    } else {
        ms = getNormalizedTimestamp(value);
    }
    if (!Number.isFinite(ms) || ms <= 0) {
        return null;
    }
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    try {
        const datePart = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        });
        const hh = String(date.getUTCHours()).padStart(2, '0');
        const mm = String(date.getUTCMinutes()).padStart(2, '0');
        return `${datePart}, ${hh}:${mm} UTC`;
    } catch {
        return date.toISOString();
    }
}

const CLIENT_TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'dclid',
    'msclkid',
    'mc_cid',
    'mc_eid',
    'yclid',
    'igshid',
    'si',
    'ref',
    'ref_src',
    'ref_url',
    'spm',
]);

/**
 * Client-safe canonical URL normalizer (strips tracking parameters, hash fragments,
 * www prefix, and trailing slashes on non-root paths).
 */
export function canonicalizeExternalUrlClient(rawUrl?: string | null): string | undefined {
    const safe = sanitizeExternalUrl(rawUrl);
    if (!safe) return undefined;
    try {
        const parsed = new URL(safe);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return undefined;
        }
        if (parsed.username || parsed.password) {
            return undefined;
        }
        parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
        parsed.hash = '';
        const kept: Array<[string, string]> = [];
        for (const [k, v] of parsed.searchParams.entries()) {
            const lower = k.toLowerCase();
            if (lower.startsWith('utm_') || CLIENT_TRACKING_PARAMS.has(lower)) continue;
            kept.push([k, v]);
        }
        kept.sort(([a], [b]) => a.localeCompare(b));
        parsed.search = '';
        for (const [k, v] of kept) {
            parsed.searchParams.append(k, v);
        }
        if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
            parsed.pathname = parsed.pathname.replace(/\/+$/, '');
        }
        return parsed.toString();
    } catch {
        return undefined;
    }
}

export interface DetailBackTarget {
    path: string;
    label: string;
}

/**
 * Resolves the back-navigation target and contextual label from a Trend detail page
 * while preserving the user's originating feed context (All, For You, Following, Saved)
 * and momentum sort when applicable.
 */
export function resolveDetailBackTarget(options: {
    fromParam?: string | null;
    sortParam?: string | null;
    isDevSource?: boolean;
}): DetailBackTarget {
    const from = (options.fromParam || '').trim().toLowerCase();
    const isMomentum = options.sortParam === 'momentum';
    const isDev = Boolean(options.isDevSource);

    if (from === 'saved') {
        return {
            path: isDev ? '/trendz/saved?source=dev' : '/trendz/saved',
            label: '// BACK_TO_SAVED',
        };
    }

    const params = new URLSearchParams();
    let label = '// BACK_TO_TRENDZ';

    if (from === 'following') {
        params.set('view', 'following');
        label = '// BACK_TO_FOLLOWING';
    } else if (from === 'for-you') {
        params.set('view', 'for-you');
        label = '// BACK_TO_FOR_YOU';
    }

    if (isMomentum && from !== 'for-you') {
        params.set('sort', 'momentum');
    }
    if (isDev) {
        params.set('source', 'dev');
    }

    const qs = params.toString();
    return {
        path: qs ? `/trendz?${qs}` : '/trendz',
        label,
    };
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
                  .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
                  .map((item) => {
                      const cleanUrl = sanitizeExternalUrl(
                          typeof item.url === 'string' ? item.url : undefined
                      );
                      const cleanName =
                          typeof item.name === 'string' && item.name.trim()
                              ? item.name.trim()
                              : '';
                      if (!cleanUrl || !cleanName) return null;
                      return {
                          name: cleanName,
                          url: cleanUrl,
                          publishedAt: toTimestamp(item.publishedAt ?? raw.publishedAt ?? raw.createdAt),
                      };
                  })
                  .filter(
                      (
                          item
                      ): item is {
                          name: string;
                          url: string;
                          publishedAt: Timestamp;
                      } => item !== null
                  )
                  .slice(0, 6)
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

    const sanitizedAdditionalSources: TrendAdditionalSourceViewModel[] = Array.isArray(
        record.additionalSources
    )
        ? record.additionalSources
              .map((src): TrendAdditionalSourceViewModel | null => {
                  const safeUrl = sanitizeExternalUrl(src?.url);
                  const safeName = typeof src?.name === 'string' ? src.name.trim() : '';
                  if (!safeUrl || !safeName) return null;
                  return {
                      name: safeName,
                      url: safeUrl,
                      publishedOn: src.publishedAt ? formatTrendDate(src.publishedAt) : undefined,
                  };
              })
              .filter((item): item is TrendAdditionalSourceViewModel => item !== null)
        : [];

    const normalizedCategory =
        typeof record.category === 'string' && record.category.trim()
            ? record.category.trim()
            : domainName;

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
        category: normalizedCategory,
        slug: record.slug,
        tags: record.tags,
        searchKeywords: record.searchKeywords,
        momentumScore: record.momentumScore,
        relatedTrendIds: record.relatedTrendIds,
        keyTakeaways: record.keyTakeaways,
        whyItMatters: record.whyItMatters,
        groundingStatus: record.groundingStatus,
        sourceAuthor: record.source.author,
        sourceDomain: record.source.domain || undefined,
        sourceCredibilityTier: record.source.credibilityTier,
        canonicalUrl: canonicalizeExternalUrlClient(record.source.url),
        discoveredAtMs: record.discoveredAt
            ? getNormalizedTimestamp(record.discoveredAt)
            : undefined,
        sourceRetrievedAtMs: record.sourceRetrievedAt
            ? getNormalizedTimestamp(record.sourceRetrievedAt)
            : undefined,
        reviewedAtMs: record.reviewedAt ? getNormalizedTimestamp(record.reviewedAt) : undefined,
        aiModel: record.aiModel,
        mediaOrigin: record.media.origin,
        sourceThumbnailUrl:
            record.media.origin === 'source_og'
                ? sanitizeExternalUrl(record.media.thumbnailUrl || record.media.url) || undefined
                : undefined,
        additionalSources:
            sanitizedAdditionalSources.length > 0 ? sanitizedAdditionalSources : undefined,
        mediaAttribution: record.media.attribution,
        region: record.region,
        language: record.language,
        status: record.status,
        publishedAtMs,
        savesCount: record.stats.saves,
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
export const DEVELOPMENT_MOCK_TRENDS: TrendViewModel[] = TRENDZ_FALLBACK_SAMPLE_DATA.map((sample) => ({
    id: sample.id,
    domain: {
        name: sample.domainName,
        icon: resolveTrendzDomainIcon(sample.domainSlug),
        isFollowed: sample.isFollowedDefault,
    },
    domainSlug: sample.domainSlug,
    category: sample.category,
    title: sample.title,
    summary: sample.summary,
    fullContent: sample.fullContent,
    whyItMatters: sample.whyItMatters,
    mediaUrl: sample.mediaUrl,
    mediaType: sample.mediaType,
    thumbnailUrl: sample.thumbnailUrl,
    mediaOverlayUrl: sample.mediaOverlayUrl,
    mediaOrigin: sample.mediaOrigin,
    sourceThumbnailUrl: sample.sourceThumbnailUrl,
    mediaAttribution: sample.mediaAttribution,
    stats: { likes: 0, views: 0, comments: 0 },
    savesCount: 0,
    details: {
        publishedBy: sample.publishedBy,
        publishedOn: sample.publishedOn,
        link: sample.sourceUrl,
    },
    sourceAuthor: sample.sourceAuthor,
    sourceDomain: sample.sourceDomain,
    sourceCredibilityTier: sample.sourceCredibilityTier,
    canonicalUrl: sample.canonicalUrl,
    groundingStatus: sample.groundingStatus,
    aiModel: sample.aiModel,
    sourceExcerpt: sample.sourceExcerpt,
    sourceExcerptTruncated: sample.sourceExcerptTruncated,
    sourceExcerptCompleteness: sample.sourceExcerptCompleteness,
    additionalSources: sample.additionalSources ? [...sample.additionalSources] : undefined,
    createdAt: new Date(sample.publishedAtIso),
    publishedAtMs: new Date(sample.publishedAtIso).getTime(),
    discoveredAtMs: new Date(sample.discoveredAtIso).getTime(),
    tags: [...sample.tags],
    searchKeywords: [...sample.searchKeywords],
    momentumScore: sample.momentumScore,
    relatedTrendIds: [...sample.relatedTrendIds],
    keyTakeaways: [...sample.keyTakeaways],
    status: sample.status,
    isFallback: true,
}));

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

export interface PersonalizedScoreBreakdown {
    followedDomainBoost: number;
    bookmarkAffinityBoost: number;
    upvoteAffinityBoost: number;
    recentViewAffinityBoost: number;
    momentumScore: number;
    freshnessScore: number;
    consumedPenalty: number;
    diversityAdjustment: number;
    baseScore: number;
    finalScore: number;
}

export interface PersonalizedFeedResult {
    items: TrendViewModel[];
    hasPersonalizationSignals: boolean;
    matchedPreferenceCount: number;
    reasonsByTrendId: Record<string, PersonalizedTrendReason>;
    scoresByTrendId: Record<string, number>;
    breakdownByTrendId?: Record<string, PersonalizedScoreBreakdown>;
}

export interface FollowingFeedQueryOptions {
    followedDomainSlugs: TrendzDomainSlug[];
    activeDomainSlug?: TrendzDomainSlug | null;
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    sortBy?: TrendSortMode;
    searchQuery?: string;
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

function readFollowedDomainsFromPrefDoc(raw: DocumentData | undefined): TrendzDomainSlug[] {
    if (!raw || typeof raw !== 'object') {
        return [];
    }
    const field = Array.isArray(raw.followedDomainSlugs)
        ? raw.followedDomainSlugs
        : raw.followedDomains;
    return normalizeFollowedTrendDomains(field);
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
        return readFollowedDomainsFromPrefDoc(prefSnap.data());
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
        const payload = {
            uid: cleanUid,
            followedDomainSlugs: normalized,
            updatedAt: serverTimestamp(),
        };
        if (prefSnap.exists()) {
            tx.set(prefRef, payload);
        } else {
            tx.set(prefRef, payload);
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
            const current = readFollowedDomainsFromPrefDoc(prefSnap.data());
            if (current.includes(slug)) {
                return current;
            }
            const next = normalizeFollowedTrendDomains([...current, slug]);
            tx.set(prefRef, {
                uid: cleanUid,
                followedDomainSlugs: next,
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
            uid: cleanUid,
            followedDomainSlugs: next,
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
            const current = readFollowedDomainsFromPrefDoc(prefSnap.data());
            if (!current.includes(slug)) {
                return current;
            }
            const next = current.filter((item) => item !== slug);
            tx.set(prefRef, {
                uid: cleanUid,
                followedDomainSlugs: next,
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
            uid: cleanUid,
            followedDomainSlugs: next,
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

function isPermissionDeniedError(err: any): boolean {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return code === 'permission-denied' || message.includes('missing or insufficient permissions');
}

/**
 * Deduplicates Trendz bookmark records by targetId, preserving the newest entry first.
 */
export function dedupeTrendBookmarkRecords(
    records: TrendBookmarkRecord[]
): TrendBookmarkRecord[] {
    const byTargetId = new Map<string, TrendBookmarkRecord>();
    for (const record of records) {
        if (!record || !isValidTrendId(record.targetId)) continue;
        const existing = byTargetId.get(record.targetId);
        if (!existing || record.createdAtMs > existing.createdAtMs) {
            byTargetId.set(record.targetId, record);
        }
    }
    return Array.from(byTargetId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function buildTrendBookmarkSnapshot(cleanUid: string, trend: TrendViewModel) {
    const safeDomainSlug =
        normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';
    const safeTitle = (trend.title || '').trim().slice(0, 240) || 'Untitled Trend';
    const safeSummary = (trend.summary || trend.fullContent || '').trim().slice(0, 500);
    const safePublisher = (trend.details?.publishedBy || '').trim().slice(0, 160) || 'INVOX Desk';
    const safePublishedOn = (trend.details?.publishedOn || '').trim().slice(0, 32) || 'RECENT';
    const safeMediaUrl = (sanitizeExternalUrl(trend.mediaUrl) || '').slice(0, 2048);
    const safeMediaType: 'image' | 'video' = trend.mediaType === 'video' ? 'video' : 'image';

    return {
        userId: cleanUid,
        targetType: TRENDZ_TARGET_TYPE,
        targetId: trend.id.trim(),
        domainSlug: safeDomainSlug,
        trendTitle: safeTitle,
        trendSummary: safeSummary,
        trendPublisher: safePublisher,
        trendPublishedOn: safePublishedOn,
        trendMediaUrl: safeMediaUrl,
        trendMediaType: safeMediaType,
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
            if (parsed && parsed.userId === cleanUid) records.push(parsed);
        }
        return dedupeTrendBookmarkRecords(records);
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
            if (parsed && parsed.userId === cleanUid) records.push(parsed);
        }
        return dedupeTrendBookmarkRecords(records);
    }
}

/**
 * Idempotently bookmarks a published trend for the authenticated user.
 * Deterministic doc ID `${userId}_trendz_${trendId}` + Firestore transaction prevents duplicates.
 */
export async function bookmarkTrend(
    userId: string,
    trend: TrendViewModel
): Promise<{ bookmarked: true; savesCount: number; bookmark: TrendBookmarkRecord; alreadyExisted: boolean }> {
    const cleanUid = assertValidUserId(userId);
    if (trend.isFallback) {
        throw new Error('Sample fallback trends cannot be bookmarked. Switch to live Trendz first.');
    }
    const bookmarkId = getTrendEngagementDocId(cleanUid, trend.id);
    const bookmarkRef = doc(db, BOOKMARKS_COLLECTION, bookmarkId);
    const trendRef = doc(db, TRENDZ_COLLECTION, trend.id.trim());

    return runTransaction(db, async (tx) => {
        const [bookmarkSnap, trendSnap] = await Promise.all([
            tx.get(bookmarkRef),
            tx.get(trendRef),
        ]);

        const isPublished = trendSnap.exists() && trendSnap.data()?.status === 'published';
        const currentStats = normalizeStatsForWrite(trendSnap.data()?.stats);

        if (bookmarkSnap.exists()) {
            const parsed = parseTrendBookmarkDoc(bookmarkSnap.id, bookmarkSnap.data());
            const snapshot = buildTrendBookmarkSnapshot(cleanUid, trend);
            return {
                bookmarked: true,
                savesCount: currentStats.saves,
                bookmark: parsed || {
                    id: bookmarkId,
                    ...snapshot,
                    createdAtMs: Date.now(),
                },
                alreadyExisted: true,
            };
        }

        if (!isPublished) {
            throw new Error('This trend is no longer published and cannot be bookmarked.');
        }

        const snapshot = buildTrendBookmarkSnapshot(cleanUid, trend);
        tx.set(bookmarkRef, {
            ...snapshot,
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
                ...snapshot,
                createdAtMs: Date.now(),
            },
            alreadyExisted: false,
        };
    });
}

/**
 * Removes a user's saved trend bookmark by ID, even if the underlying trend was deleted or unpublished.
 * If the trend is unpublished (denying non-moderator reads), falls back cleanly to deleting the owner's bookmark doc.
 */
export async function removeTrendBookmarkById(
    userId: string,
    trendId: string
): Promise<{ removed: boolean; savesCount?: number }> {
    const cleanUid = assertValidUserId(userId);
    const bookmarkId = getTrendEngagementDocId(cleanUid, trendId);
    const bookmarkRef = doc(db, BOOKMARKS_COLLECTION, bookmarkId);
    const trendRef = doc(db, TRENDZ_COLLECTION, trendId.trim());

    try {
        return await runTransaction(db, async (tx) => {
            const [bookmarkSnap, trendSnap] = await Promise.all([
                tx.get(bookmarkRef),
                tx.get(trendRef),
            ]);
            if (!bookmarkSnap.exists()) {
                return { removed: false };
            }
            tx.delete(bookmarkRef);
            if (trendSnap.exists() && trendSnap.data()?.status === 'published') {
                const currentStats = normalizeStatsForWrite(trendSnap.data()?.stats);
                const nextSaves = Math.max(0, currentStats.saves - 1);
                tx.update(trendRef, {
                    stats: {
                        ...currentStats,
                        saves: nextSaves,
                    },
                });
                return { removed: true, savesCount: nextSaves };
            }
            return { removed: true };
        });
    } catch (err: any) {
        if (!isPermissionDeniedError(err)) {
            throw err;
        }
        // Underlying trend was unpublished/archived (unreadable to regular users) —
        // verify ownership via direct bookmark doc get and delete the bookmark cleanly.
        const bookmarkSnap = await getDoc(bookmarkRef);
        if (!bookmarkSnap.exists()) {
            return { removed: false };
        }
        await deleteDoc(bookmarkRef);
        return { removed: true };
    }
}

export const unbookmarkTrend = removeTrendBookmarkById;

/**
 * Atomically toggles a Trendz bookmark for the authenticated user using a Firestore transaction.
 * Verifies the target trend is published before creating a bookmark, synchronizes `stats.saves`,
 * and cleanly removes bookmarks even if the underlying trend was deleted or unpublished.
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
    const trendRef = doc(db, TRENDZ_COLLECTION, trend.id.trim());

    try {
        return await runTransaction(db, async (tx) => {
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

            const snapshot = buildTrendBookmarkSnapshot(cleanUid, trend);
            tx.set(bookmarkRef, {
                ...snapshot,
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
                    ...snapshot,
                    createdAtMs: Date.now(),
                },
            };
        });
    } catch (err: any) {
        if (!isPermissionDeniedError(err)) {
            throw err;
        }
        // If the bookmark already exists and the underlying trend was unpublished/archived,
        // allow graceful unbookmarking without failing on the unreadable trend document.
        const existingBookmark = await getDoc(bookmarkRef);
        if (existingBookmark.exists()) {
            await deleteDoc(bookmarkRef);
            return {
                bookmarked: false,
                savesCount: Math.max(0, (trend.savesCount ?? 1) - 1),
                bookmark: null,
            };
        }
        throw err;
    }
}

/**
 * Hydrates a list of TrendBookmarkRecord entries against live published /trendz documents.
 * Deleted or unpublished trends are preserved as graceful unavailable entries with their saved snapshot.
 */
export async function hydrateSavedTrendsFromBookmarks(
    bookmarks: TrendBookmarkRecord[]
): Promise<SavedTrendEntry[]> {
    const deduped = dedupeTrendBookmarkRecords(bookmarks);
    if (deduped.length === 0) {
        return [];
    }

    const hydrated = await Promise.all(
        deduped.map(async (bookmark): Promise<SavedTrendEntry> => {
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

/**
 * Fetches and hydrates a user's Saved Trends list by resolving each bookmark against live published /trendz records.
 * Deleted or unpublished trends are preserved as graceful unavailable entries with their saved snapshot.
 */
export async function fetchSavedTrendsForUser(userId: string): Promise<SavedTrendEntry[]> {
    const bookmarks = await fetchUserTrendBookmarks(userId);
    return hydrateSavedTrendsFromBookmarks(bookmarks);
}

// ==========================================
// DEV_FALLBACK Sample Bookmark Local Storage
// Strictly isolated from Firestore live bookmarks.
// ==========================================

export const SAMPLE_BOOKMARKS_STORAGE_PREFIX = 'invox_trendz_sample_bookmarks_';

const VALID_SAMPLE_TREND_ID_SET = new Set<string>(
    DEVELOPMENT_MOCK_TRENDS.map((trend) => trend.id)
);

export function getSampleBookmarksStorageKey(userId: string): string {
    const cleanUid = assertValidUserId(userId);
    return `${SAMPLE_BOOKMARKS_STORAGE_PREFIX}${cleanUid}`;
}

/**
 * Deduplicates and validates sample bookmark IDs strictly against DEVELOPMENT_MOCK_TRENDS.
 * Preserves newest-first ordering and discards invalid, unknown, or duplicate IDs.
 */
export function normalizeSampleBookmarkIds(rawIds: unknown): string[] {
    if (!Array.isArray(rawIds)) {
        return [];
    }
    const result: string[] = [];
    const seen = new Set<string>();
    for (const entry of rawIds) {
        const candidate =
            typeof entry === 'string'
                ? entry.trim()
                : entry && typeof entry === 'object' && typeof (entry as any).targetId === 'string'
                  ? (entry as any).targetId.trim()
                  : '';
        if (!candidate || seen.has(candidate) || !VALID_SAMPLE_TREND_ID_SET.has(candidate)) {
            continue;
        }
        seen.add(candidate);
        result.push(candidate);
    }
    return result;
}

function resolveBrowserStorage(): Storage | null {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        // Storage access blocked (e.g., restricted iframe or private mode)
    }
    return null;
}

/**
 * Safely reads a user's locally stored DEV_FALLBACK sample bookmark IDs.
 * Gracefully handles missing, invalid, or corrupted localStorage payloads.
 */
export function loadSampleBookmarkIds(
    userId: string,
    storage?: Pick<Storage, 'getItem'> | null
): string[] {
    let key: string;
    try {
        key = getSampleBookmarksStorageKey(userId);
    } catch {
        return [];
    }

    const store = storage === undefined ? resolveBrowserStorage() : storage;
    if (!store) {
        return [];
    }

    try {
        const raw = store.getItem(key);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return normalizeSampleBookmarkIds(parsed);
    } catch {
        return [];
    }
}

/**
 * Safely persists a user's DEV_FALLBACK sample bookmark IDs to localStorage.
 * Never touches Firestore.
 */
export function saveSampleBookmarkIds(
    userId: string,
    trendIds: string[],
    storage?: Pick<Storage, 'setItem'> | null
): string[] {
    const normalized = normalizeSampleBookmarkIds(trendIds);
    let key: string;
    try {
        key = getSampleBookmarksStorageKey(userId);
    } catch {
        return [];
    }

    const store = storage === undefined ? resolveBrowserStorage() : storage;
    if (!store) {
        return normalized;
    }

    try {
        store.setItem(key, JSON.stringify(normalized));
    } catch (err) {
        console.warn('[TRENDZ_SAMPLE_BOOKMARKS_STORAGE_WARN]', err);
    }
    return normalized;
}

/**
 * Constructs a TrendBookmarkRecord representation for a DEV_FALLBACK sample trend.
 */
export function buildSampleBookmarkRecord(
    userId: string,
    trend: TrendViewModel,
    createdAtMs = Date.now()
): TrendBookmarkRecord {
    const cleanUid = assertValidUserId(userId);
    const snapshot = buildTrendBookmarkSnapshot(cleanUid, trend);
    return {
        id: `sample_${cleanUid}_${TRENDZ_TARGET_TYPE}_${trend.id.trim()}`,
        ...snapshot,
        createdAtMs,
    };
}

/**
 * Restores a user's DEV_FALLBACK sample bookmarks as TrendBookmarkRecord objects from localStorage.
 */
export function loadSampleBookmarkRecords(
    userId: string,
    storage?: Pick<Storage, 'getItem'> | null
): TrendBookmarkRecord[] {
    const ids = loadSampleBookmarkIds(userId, storage);
    if (ids.length === 0) {
        return [];
    }

    const baseTime = Date.now();
    const records: TrendBookmarkRecord[] = [];
    for (let index = 0; index < ids.length; index++) {
        const sampleTrend = getFallbackMockTrendById(ids[index]);
        if (!sampleTrend) continue;
        // Preserve stored newest-first ordering via deterministic descending timestamps
        records.push(buildSampleBookmarkRecord(userId, sampleTrend, baseTime - index));
    }
    return records;
}

/**
 * Hydrates DEV_FALLBACK sample bookmark records strictly against local DEVELOPMENT_MOCK_TRENDS.
 * Never performs Firestore reads.
 */
export function hydrateSampleSavedTrendsFromBookmarks(
    bookmarks: TrendBookmarkRecord[]
): SavedTrendEntry[] {
    const deduped = dedupeTrendBookmarkRecords(bookmarks);
    return deduped.map((bookmark): SavedTrendEntry => {
        const sampleTrend = getFallbackMockTrendById(bookmark.targetId);
        return {
            trendId: bookmark.targetId,
            savedAtMs: bookmark.createdAtMs,
            bookmark,
            trend: sampleTrend,
            isUnavailable: !sampleTrend,
        };
    });
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

export function dedupeTrendUpvoteRecords(records: TrendUpvoteRecord[]): TrendUpvoteRecord[] {
    const byId = new Map<string, TrendUpvoteRecord>();
    for (const record of records) {
        if (!record?.targetId) continue;
        const existing = byId.get(record.targetId);
        if (!existing || (record.createdAtMs ?? 0) > (existing.createdAtMs ?? 0)) {
            byId.set(record.targetId, record);
        }
    }
    return Array.from(byId.values()).sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
}

export function dedupeTrendViewRecords(records: TrendViewRecord[]): TrendViewRecord[] {
    const byId = new Map<string, TrendViewRecord>();
    for (const record of records) {
        if (!record?.trendId) continue;
        const existing = byId.get(record.trendId);
        if (!existing || (record.viewedAtMs ?? 0) > (existing.viewedAtMs ?? 0)) {
            byId.set(record.trendId, record);
        }
    }
    return Array.from(byId.values()).sort((a, b) => (b.viewedAtMs ?? 0) - (a.viewedAtMs ?? 0));
}

/**
 * Atomically toggles an upvote on a published trend using a Firestore transaction.
 * Deterministic doc ID `${userId}_trendz_${trendId}` guarantees no duplicate upvotes per user.
 * Gracefully removes an existing upvote even if the underlying trend was later unpublished or archived.
 */
export async function toggleTrendUpvote(
    userId: string,
    trend: TrendViewModel
): Promise<{ upvoted: boolean; likesCount: number; record: TrendUpvoteRecord | null }> {
    const cleanUid = assertValidUserId(userId);
    if (trend.isFallback) {
        throw new Error('Sample fallback upvotes are managed locally.');
    }
    const likeId = getTrendEngagementDocId(cleanUid, trend.id);
    const likeRef = doc(db, LIKES_COLLECTION, likeId);
    const trendRef = doc(db, TRENDZ_COLLECTION, trend.id);

    try {
        return await runTransaction(db, async (tx) => {
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
    } catch (err: any) {
        // Graceful fallback when unvoting a trend that was later unpublished/archived
        if (String(err?.code || '').toLowerCase() === 'permission-denied') {
            try {
                const existingLike = await getDoc(likeRef);
                if (existingLike.exists()) {
                    await deleteDoc(likeRef);
                    return {
                        upvoted: false,
                        likesCount: Math.max(0, (trend.stats?.likes ?? 1) - 1),
                        record: null,
                    };
                }
            } catch {
                // Fall through to original error
            }
        }
        throw err;
    }
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
        const fallbackSnap = await getDocs(
            query(viewsRef, where('userId', '==', cleanUid), limit(100))
        );
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

export const TREND_VIEW_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const LIVE_VIEWS_CACHE_STORAGE_PREFIX = 'invox_trendz_live_views_';
const ANON_VIEWS_STORAGE_KEY = 'invox_trendz_anon_views';
const SAMPLE_UPVOTES_STORAGE_PREFIX = 'invox_trendz_sample_upvotes_';
const SAMPLE_VIEWS_STORAGE_PREFIX = 'invox_trendz_sample_views_';
const SAMPLE_VIEWS_ANON_STORAGE_KEY = 'invox_trendz_sample_views_anon';

interface StoredLocalViewEntry {
    trendId: string;
    domainSlug: TrendzDomainSlug;
    viewedAtMs: number;
}

function readStoredLocalViewEntries(
    storageKey: string,
    storage?: Pick<Storage, 'getItem'> | null
): StoredLocalViewEntry[] {
    const store = storage === undefined ? resolveBrowserStorage() : storage;
    if (!store) return [];
    try {
        const raw = store.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const entries: StoredLocalViewEntry[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const trendId = typeof (item as any).trendId === 'string' ? (item as any).trendId.trim() : '';
            const viewedAtMs = Number((item as any).viewedAtMs);
            if (!isValidTrendId(trendId) || seen.has(trendId) || !Number.isFinite(viewedAtMs) || viewedAtMs <= 0) {
                continue;
            }
            const domainSlug = normalizeTrendzDomainSlug((item as any).domainSlug) || 'technology';
            seen.add(trendId);
            entries.push({ trendId, domainSlug, viewedAtMs });
        }
        return entries.sort((a, b) => b.viewedAtMs - a.viewedAtMs).slice(0, 100);
    } catch {
        return [];
    }
}

function writeStoredLocalViewEntries(
    storageKey: string,
    entries: StoredLocalViewEntry[],
    storage?: Pick<Storage, 'setItem'> | null
): void {
    const store = storage === undefined ? resolveBrowserStorage() : storage;
    if (!store) return;
    try {
        store.setItem(storageKey, JSON.stringify(entries.slice(0, 100)));
    } catch {
        // Ignore storage quota / restricted iframe errors
    }
}

export function isTrendViewWithinDedupeWindow(
    viewedAtMs: number | undefined,
    nowMs = Date.now(),
    windowMs = TREND_VIEW_DEDUPE_WINDOW_MS
): boolean {
    if (typeof viewedAtMs !== 'number' || !Number.isFinite(viewedAtMs) || viewedAtMs <= 0) {
        return false;
    }
    return nowMs - viewedAtMs >= 0 && nowMs - viewedAtMs < windowMs;
}

function hasRecentLocalLiveView(
    userId: string,
    trendId: string,
    nowMs = Date.now(),
    storage?: Pick<Storage, 'getItem'> | null
): boolean {
    const entries = readStoredLocalViewEntries(`${LIVE_VIEWS_CACHE_STORAGE_PREFIX}${userId}`, storage);
    const match = entries.find((entry) => entry.trendId === trendId);
    return isTrendViewWithinDedupeWindow(match?.viewedAtMs, nowMs);
}

function markLocalLiveView(
    userId: string,
    trend: TrendViewModel,
    nowMs = Date.now(),
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): void {
    const key = `${LIVE_VIEWS_CACHE_STORAGE_PREFIX}${userId}`;
    const existing = readStoredLocalViewEntries(key, storage).filter((e) => e.trendId !== trend.id);
    const domainSlug = normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';
    writeStoredLocalViewEntries(
        key,
        [{ trendId: trend.id, domainSlug, viewedAtMs: nowMs }, ...existing],
        storage
    );
}

/**
 * Loads locally deduplicated live trend views for anonymous visitors (zero Firestore writes).
 */
export function loadAnonymousTrendViews(
    storage?: Pick<Storage, 'getItem'> | null
): TrendViewRecord[] {
    return readStoredLocalViewEntries(ANON_VIEWS_STORAGE_KEY, storage).map((entry) => ({
        userId: 'anonymous',
        trendId: entry.trendId,
        domainSlug: entry.domainSlug,
        viewedAtMs: entry.viewedAtMs,
    }));
}

/**
 * Records a locally deduplicated live trend view for an anonymous visitor (never writes to Firestore).
 */
export function recordAnonymousTrendView(
    trend: TrendViewModel,
    nowMs = Date.now(),
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): { recorded: boolean; viewsCount: number; record: TrendViewRecord | null } {
    const baseViews = Math.max(0, Math.floor(toSafeNumber(trend.stats?.views)));
    if (!trend || trend.isFallback || !isValidTrendId(trend.id)) {
        return { recorded: false, viewsCount: baseViews, record: null };
    }
    const existing = readStoredLocalViewEntries(ANON_VIEWS_STORAGE_KEY, storage);
    const prev = existing.find((entry) => entry.trendId === trend.id);
    if (isTrendViewWithinDedupeWindow(prev?.viewedAtMs, nowMs)) {
        return { recorded: false, viewsCount: baseViews, record: null };
    }
    const domainSlug = normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';
    const nextEntry: StoredLocalViewEntry = { trendId: trend.id, domainSlug, viewedAtMs: nowMs };
    writeStoredLocalViewEntries(
        ANON_VIEWS_STORAGE_KEY,
        [nextEntry, ...existing.filter((entry) => entry.trendId !== trend.id)],
        storage
    );
    return {
        recorded: true,
        viewsCount: baseViews + 1,
        record: {
            userId: 'anonymous',
            trendId: trend.id,
            domainSlug,
            viewedAtMs: nowMs,
        },
    };
}

/**
 * DEV_FALLBACK sample upvote persistence helpers (strictly user-scoped localStorage, never Firestore).
 */
export function getSampleUpvotesStorageKey(userId: string): string {
    const cleanUid = assertValidUserId(userId);
    return `${SAMPLE_UPVOTES_STORAGE_PREFIX}${cleanUid}`;
}

export function buildSampleUpvoteRecord(
    userId: string,
    trend: TrendViewModel,
    createdAtMs = Date.now()
): TrendUpvoteRecord {
    const cleanUid = assertValidUserId(userId);
    const safeDomainSlug =
        normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';
    return {
        id: `sample_${cleanUid}_${TRENDZ_TARGET_TYPE}_${trend.id.trim()}`,
        userId: cleanUid,
        targetType: TRENDZ_TARGET_TYPE,
        targetId: trend.id.trim(),
        domainSlug: safeDomainSlug,
        createdAtMs,
    };
}

export function loadSampleUpvoteIds(
    userId: string,
    storage?: Pick<Storage, 'getItem'> | null
): string[] {
    let key: string;
    try {
        key = getSampleUpvotesStorageKey(userId);
    } catch {
        return [];
    }
    const store = storage === undefined ? resolveBrowserStorage() : storage;
    if (!store) return [];
    try {
        const raw = store.getItem(key);
        if (!raw) return [];
        return normalizeSampleBookmarkIds(JSON.parse(raw));
    } catch {
        return [];
    }
}

export function saveSampleUpvoteIds(
    userId: string,
    trendIds: string[],
    storage?: Pick<Storage, 'setItem'> | null
): string[] {
    const normalized = normalizeSampleBookmarkIds(trendIds);
    let key: string;
    try {
        key = getSampleUpvotesStorageKey(userId);
    } catch {
        return [];
    }
    const store = storage === undefined ? resolveBrowserStorage() : storage;
    if (!store) return normalized;
    try {
        store.setItem(key, JSON.stringify(normalized));
    } catch (err) {
        console.warn('[TRENDZ_SAMPLE_UPVOTES_STORAGE_WARN]', err);
    }
    return normalized;
}

export function loadSampleUpvoteRecords(
    userId: string,
    storage?: Pick<Storage, 'getItem'> | null
): TrendUpvoteRecord[] {
    const ids = loadSampleUpvoteIds(userId, storage);
    if (ids.length === 0) return [];
    const baseMs = Date.now();
    const records: TrendUpvoteRecord[] = [];
    ids.forEach((trendId, index) => {
        const sample = getFallbackMockTrendById(trendId);
        if (!sample) return;
        records.push(buildSampleUpvoteRecord(userId, sample, baseMs - index * 1000));
    });
    return dedupeTrendUpvoteRecords(records);
}

/**
 * DEV_FALLBACK sample view persistence helpers (user-scoped when signed in, anonymous key otherwise).
 */
export function getSampleViewsStorageKey(userId?: string | null): string {
    const cleanUid = typeof userId === 'string' ? userId.trim() : '';
    return cleanUid ? `${SAMPLE_VIEWS_STORAGE_PREFIX}${cleanUid}` : SAMPLE_VIEWS_ANON_STORAGE_KEY;
}

export function loadSampleViewRecords(
    userId?: string | null,
    storage?: Pick<Storage, 'getItem'> | null
): TrendViewRecord[] {
    const key = getSampleViewsStorageKey(userId);
    const ownerId = typeof userId === 'string' && userId.trim() ? userId.trim() : 'anonymous';
    const entries = readStoredLocalViewEntries(key, storage);
    const records: TrendViewRecord[] = [];
    for (const entry of entries) {
        if (!VALID_SAMPLE_TREND_ID_SET.has(entry.trendId)) continue;
        records.push({
            userId: ownerId,
            trendId: entry.trendId,
            domainSlug: entry.domainSlug,
            viewedAtMs: entry.viewedAtMs,
        });
    }
    return dedupeTrendViewRecords(records);
}

export function recordSampleTrendView(
    trend: TrendViewModel,
    userId?: string | null,
    nowMs = Date.now(),
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): { recorded: boolean; record: TrendViewRecord | null } {
    if (!trend || !VALID_SAMPLE_TREND_ID_SET.has(trend.id)) {
        return { recorded: false, record: null };
    }
    const key = getSampleViewsStorageKey(userId);
    const ownerId = typeof userId === 'string' && userId.trim() ? userId.trim() : 'anonymous';
    const existing = readStoredLocalViewEntries(key, storage).filter((e) =>
        VALID_SAMPLE_TREND_ID_SET.has(e.trendId)
    );
    const prev = existing.find((entry) => entry.trendId === trend.id);
    if (isTrendViewWithinDedupeWindow(prev?.viewedAtMs, nowMs)) {
        return { recorded: false, record: null };
    }
    const domainSlug = normalizeTrendzDomainSlug(trend.domainSlug || trend.domain?.name) || 'technology';
    const nextEntry: StoredLocalViewEntry = { trendId: trend.id, domainSlug, viewedAtMs: nowMs };
    writeStoredLocalViewEntries(
        key,
        [nextEntry, ...existing.filter((entry) => entry.trendId !== trend.id)],
        storage
    );
    return {
        recorded: true,
        record: {
            userId: ownerId,
            trendId: trend.id,
            domainSlug,
            viewedAtMs: nowMs,
        },
    };
}

/**
 * Records a deduplicated trend view for the authenticated user.
 * Uses in-session + 24-hour local deduplication AND a Firestore transaction against private
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
    if (userSessionSet.has(trend.id) || hasRecentLocalLiveView(cleanUid, trend.id)) {
        userSessionSet.add(trend.id);
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
    markLocalLiveView(cleanUid, trend);
    return result;
}

export interface TrendShareResult {
    status: 'shared' | 'copied' | 'cancelled' | 'error';
    url: string;
    errorMessage?: string;
}

/**
 * Generates a clean canonical Trendz detail URL suitable for sharing.
 * Strips transient UI parameters (`from`, `sort`, `view`) and preserves `?source=dev`
 * strictly for DEV_FALLBACK sample records.
 */
export function buildCanonicalTrendShareUrl(
    trend: Pick<TrendViewModel, 'id' | 'isFallback'>,
    origin?: string
): string {
    const cleanId = typeof trend?.id === 'string' ? trend.id.trim() : '';
    const basePath = `/trendz/${encodeURIComponent(cleanId)}${trend?.isFallback ? '?source=dev' : ''}`;
    const resolvedOrigin =
        typeof origin === 'string' && origin.trim()
            ? origin.trim().replace(/\/+$/, '')
            : typeof window !== 'undefined' && window.location?.origin
              ? window.location.origin.replace(/\/+$/, '')
              : '';
    return resolvedOrigin ? `${resolvedOrigin}${basePath}` : basePath;
}

/**
 * Shares a Trendz item using the native Web Share API where supported, falling back
 * to Clipboard API and a hidden textarea copy fallback. Handles user cancellation gracefully.
 */
export async function shareTrendItem(
    trend: Pick<TrendViewModel, 'id' | 'title' | 'summary' | 'isFallback'>,
    options?: { origin?: string; preferClipboard?: boolean }
): Promise<TrendShareResult> {
    const url = buildCanonicalTrendShareUrl(trend, options?.origin);
    const title = (trend.title || 'INVOX Trendz Briefing').trim();
    const summaryText = (trend.summary || '').trim().slice(0, 180);

    if (
        !options?.preferClipboard &&
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
    ) {
        try {
            await navigator.share({
                title,
                text: summaryText || title,
                url,
            });
            return { status: 'shared', url };
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                return { status: 'cancelled', url };
            }
            // Fall through to clipboard fallback when native share is unavailable or blocked
        }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(url);
            return { status: 'copied', url };
        } catch {
            // Fall through to legacy textarea copy
        }
    }

    if (typeof document !== 'undefined' && document.body) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = url;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (ok) {
                return { status: 'copied', url };
            }
        } catch {
            // Fall through to error status
        }
    }

    return {
        status: 'error',
        url,
        errorMessage: 'Unable to copy or share link in this browser context.',
    };
}

/**
 * Resolves the canonical target domain slugs for Following mode:
 * - Returns [] if the user follows no domains.
 * - Returns [activeDomainSlug] if a specific followed domain filter is active.
 * - Otherwise returns all normalized followed domains (All Following).
 */
export function resolveFollowingTargetDomains(
    followedDomainSlugs: string[],
    activeDomainSlug?: string | null
): TrendzDomainSlug[] {
    const normalizedFollowed = normalizeFollowedTrendDomains(followedDomainSlugs);
    if (normalizedFollowed.length === 0) {
        return [];
    }
    if (activeDomainSlug) {
        const normalizedActive = normalizeTrendzDomainSlug(activeDomainSlug);
        if (normalizedActive && normalizedFollowed.includes(normalizedActive)) {
            return [normalizedActive];
        }
    }
    return normalizedFollowed;
}

/**
 * Fetches a paginated page of published trends strictly scoped to the user's followed domains
 * (either All Following or an individual followed domain), preserving search, sorting, and cursor pagination.
 */
export async function fetchFollowingTrendsPage(
    options: FollowingFeedQueryOptions
): Promise<TrendFeedPage> {
    const targetDomains = resolveFollowingTargetDomains(
        options.followedDomainSlugs,
        options.activeDomainSlug
    );
    if (targetDomains.length === 0) {
        return {
            items: [],
            records: [],
            lastDoc: null,
            hasMore: false,
        };
    }

    return fetchPublishedTrendsPage({
        pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
        cursor: options.cursor ?? null,
        domainSlugs: targetDomains,
        sortBy: options.sortBy ?? 'latest',
        searchQuery: options.searchQuery ?? '',
    });
}

/**
 * Deterministic, transparent, non-AI personalized feed ranking engine (Phase 05.2).
 *
 * Scoring factors:
 * 1. Followed domain affinity (+42 pts)
 * 2. Bookmarked domain affinity (+10 pts per saved trend in domain, capped at +24 pts)
 * 3. Upvoted domain affinity (+7 pts per upvoted trend in domain, capped at +18 pts)
 * 4. Recent view domain affinity (+4 pts per view <=7d, +2 pts per view 8..30d, capped at +12 pts)
 * 5. Trend momentum baseline (0..32 pts combining momentumScore + velocity fallback)
 * 6. Content freshness curve (0..24 pts smooth decay by ageHours)
 * 7. Consumed-item demotion (already viewed <=7d: -28, viewed >7d: -18, bookmarked: -16, upvoted: -12; capped at -48)
 *    so fresh, unseen trends are prioritized over already-consumed items without hiding content when pool is small.
 * 8. Deterministic diversity re-ranking pass: prevents 3+ consecutive items from the same domain and applies
 *    progressive saturation decay (-6 pts per additional appearance) whenever multi-domain candidates exist.
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
    const bookmarkedTrendIds = new Set<string>();
    for (const bookmark of signals.bookmarkedRecords || []) {
        if (bookmark.targetId) {
            bookmarkedTrendIds.add(bookmark.targetId);
        }
        const slug = normalizeTrendzDomainSlug(bookmark.domainSlug);
        if (slug) {
            bookmarkDomainCounts.set(slug, (bookmarkDomainCounts.get(slug) || 0) + 1);
        }
    }

    const upvoteDomainCounts = new Map<TrendzDomainSlug, number>();
    const upvotedTrendIds = new Set<string>();
    for (const upvote of signals.upvoteRecords || []) {
        if (upvote.targetId) {
            upvotedTrendIds.add(upvote.targetId);
        }
        const slug = normalizeTrendzDomainSlug(upvote.domainSlug);
        if (slug) {
            upvoteDomainCounts.set(slug, (upvoteDomainCounts.get(slug) || 0) + 1);
        }
    }

    const viewDomainWeights = new Map<TrendzDomainSlug, number>();
    const viewedTrendAtMs = new Map<string, number>();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const view of signals.viewRecords || []) {
        if (view.trendId) {
            const prevMs = viewedTrendAtMs.get(view.trendId) ?? -1;
            if (view.viewedAtMs > prevMs) {
                viewedTrendAtMs.set(view.trendId, view.viewedAtMs);
            }
        }
        const slug = normalizeTrendzDomainSlug(view.domainSlug);
        const viewAgeMs = Math.max(0, nowMs - view.viewedAtMs);
        if (slug && viewAgeMs <= thirtyDaysMs) {
            const weight = viewAgeMs <= sevenDaysMs ? 4 : 2;
            viewDomainWeights.set(slug, (viewDomainWeights.get(slug) || 0) + weight);
        }
    }

    const hasPersonalizationSignals =
        followedSet.size > 0 ||
        bookmarkDomainCounts.size > 0 ||
        upvoteDomainCounts.size > 0 ||
        viewDomainWeights.size > 0;

    const reasonsByTrendId: Record<string, PersonalizedTrendReason> = {};
    const scoresByTrendId: Record<string, number> = {};
    const breakdownByTrendId: Record<string, PersonalizedScoreBreakdown> = {};
    let matchedPreferenceCount = 0;

    interface ScoredCandidate {
        trend: TrendViewModel;
        baseScore: number;
        breakdown: PersonalizedScoreBreakdown;
    }

    const scoredPool: ScoredCandidate[] = uniqueCandidates.map((trend) => {
        const isFollowed = followedSet.has(trend.domainSlug);
        const bookmarkHits = bookmarkDomainCounts.get(trend.domainSlug) || 0;
        const upvoteHits = upvoteDomainCounts.get(trend.domainSlug) || 0;
        const viewWeight = viewDomainWeights.get(trend.domainSlug) || 0;

        const followedDomainBoost = isFollowed ? 42 : 0;
        const bookmarkAffinityBoost = Math.min(24, bookmarkHits * 10);
        const upvoteAffinityBoost = Math.min(18, upvoteHits * 7);
        const recentViewAffinityBoost = Math.min(12, viewWeight);

        const ageHours = Math.max(0, (nowMs - trend.publishedAtMs) / 3_600_000);
        const freshnessScore = Number((24 / Math.pow(1 + ageHours / 24, 0.8)).toFixed(4));

        const fallbackVelocity = computeTrendMomentumFallbackScore({
            stats: trend.stats,
            publishedAt: trend.publishedAtMs,
        });
        const momentumScore = Number(
            Math.min(
                32,
                Math.log10(1 + Math.max(0, trend.momentumScore)) * 13 +
                    Math.min(10, fallbackVelocity / 1000)
            ).toFixed(4)
        );

        let rawConsumedPenalty = 0;
        const viewedAt = viewedTrendAtMs.get(trend.id);
        if (viewedAt !== undefined) {
            rawConsumedPenalty += nowMs - viewedAt <= sevenDaysMs ? -28 : -18;
        }
        if (bookmarkedTrendIds.has(trend.id)) {
            rawConsumedPenalty += -16;
        }
        if (upvotedTrendIds.has(trend.id)) {
            rawConsumedPenalty += -12;
        }
        const consumedPenalty = Math.max(-48, rawConsumedPenalty);

        const baseScore = Number(
            (
                followedDomainBoost +
                bookmarkAffinityBoost +
                upvoteAffinityBoost +
                recentViewAffinityBoost +
                momentumScore +
                freshnessScore +
                consumedPenalty
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
        } else if (viewWeight > 0) {
            reason = 'RECENT_INTEREST';
            matchedPreferenceCount++;
        }

        reasonsByTrendId[trend.id] = reason;

        const breakdown: PersonalizedScoreBreakdown = {
            followedDomainBoost,
            bookmarkAffinityBoost,
            upvoteAffinityBoost,
            recentViewAffinityBoost,
            momentumScore,
            freshnessScore,
            consumedPenalty,
            diversityAdjustment: 0,
            baseScore,
            finalScore: baseScore,
        };

        return { trend, baseScore, breakdown };
    });

    // Initial deterministic ordering before diversity pass
    scoredPool.sort((a, b) => {
        if (Math.abs(b.baseScore - a.baseScore) > 0.0001) {
            return b.baseScore - a.baseScore;
        }
        if (Math.abs(b.trend.momentumScore - a.trend.momentumScore) > 0.0001) {
            return b.trend.momentumScore - a.trend.momentumScore;
        }
        if (b.trend.publishedAtMs !== a.trend.publishedAtMs) {
            return b.trend.publishedAtMs - a.trend.publishedAtMs;
        }
        return a.trend.id.localeCompare(b.trend.id);
    });

    // Deterministic diversity re-ranking pass to prevent single-domain concentration
    const remaining = [...scoredPool];
    const ordered: TrendViewModel[] = [];
    const domainAppearances = new Map<TrendzDomainSlug, number>();
    let lastDomain: TrendzDomainSlug | null = null;
    let consecutiveRun = 0;

    while (remaining.length > 0) {
        const remainingDomains = new Set<TrendzDomainSlug>(
            remaining.map((entry) => entry.trend.domainSlug)
        );
        const hasMultiDomainChoice = remainingDomains.size > 1;

        let bestIdx = 0;
        let bestEffective = -Infinity;
        let bestDiversityAdj = 0;

        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i];
            const slug = candidate.trend.domainSlug;
            let diversityAdj = 0;

            if (hasMultiDomainChoice) {
                const countSoFar = domainAppearances.get(slug) || 0;
                if (slug === lastDomain) {
                    diversityAdj += consecutiveRun >= 2 ? -38 : -10;
                }
                if (countSoFar >= 1) {
                    diversityAdj += -6 * Math.min(countSoFar, 6);
                }
            }

            const effective = Number((candidate.baseScore + diversityAdj).toFixed(4));
            if (i === 0 || effective > bestEffective + 0.0001) {
                bestIdx = i;
                bestEffective = effective;
                bestDiversityAdj = diversityAdj;
            } else if (Math.abs(effective - bestEffective) <= 0.0001) {
                const currentBest = remaining[bestIdx];
                if (
                    candidate.baseScore > currentBest.baseScore + 0.0001 ||
                    (Math.abs(candidate.baseScore - currentBest.baseScore) <= 0.0001 &&
                        (candidate.trend.momentumScore > currentBest.trend.momentumScore + 0.0001 ||
                            (Math.abs(candidate.trend.momentumScore - currentBest.trend.momentumScore) <= 0.0001 &&
                                (candidate.trend.publishedAtMs > currentBest.trend.publishedAtMs ||
                                    (candidate.trend.publishedAtMs === currentBest.trend.publishedAtMs &&
                                        candidate.trend.id.localeCompare(currentBest.trend.id) < 0)))))
                ) {
                    bestIdx = i;
                    bestEffective = effective;
                    bestDiversityAdj = diversityAdj;
                }
            }
        }

        const [picked] = remaining.splice(bestIdx, 1);
        const pickedSlug = picked.trend.domainSlug;
        domainAppearances.set(pickedSlug, (domainAppearances.get(pickedSlug) || 0) + 1);
        if (pickedSlug === lastDomain) {
            consecutiveRun += 1;
        } else {
            lastDomain = pickedSlug;
            consecutiveRun = 1;
        }

        picked.breakdown.diversityAdjustment = bestDiversityAdj;
        picked.breakdown.finalScore = bestEffective;
        scoresByTrendId[picked.trend.id] = bestEffective;
        breakdownByTrendId[picked.trend.id] = picked.breakdown;
        ordered.push(picked.trend);
    }

    return {
        items: ordered,
        hasPersonalizationSignals,
        matchedPreferenceCount,
        reasonsByTrendId,
        scoresByTrendId,
        breakdownByTrendId,
    };
}

/**
 * Fetches a bounded candidate pool of published trends for the Personalized ("For You") feed,
 * combining recent & high-momentum general trends with targeted candidates from the user's
 * followed and engaged domains so both active users and new users receive high-signal feeds.
 */
export async function fetchPersonalizedTrendsFeed(
    signals: PersonalizationSignals,
    options: {
        domainSlugs?: TrendzDomainSlug[];
        searchQuery?: string;
        poolSize?: number;
    } = {}
): Promise<PersonalizedFeedResult> {
    const poolSize = Math.max(10, Math.min(options.poolSize ?? 40, 50));
    const explicitDomains = normalizeDomainSlugList(options.domainSlugs);
    const trimmedSearch = (options.searchQuery || '').trim();
    const followedSlugs = normalizeFollowedTrendDomains(signals.followedDomainSlugs);

    // Build priority affinity domains (followed + bookmarked + upvoted + recent views, up to 10)
    const affinityDomains: TrendzDomainSlug[] = [...followedSlugs];
    const addAffinityDomain = (raw: string | undefined) => {
        const slug = normalizeTrendzDomainSlug(raw);
        if (slug && !affinityDomains.includes(slug) && affinityDomains.length < 10) {
            affinityDomains.push(slug);
        }
    };
    for (const b of signals.bookmarkedRecords || []) addAffinityDomain(b.domainSlug);
    for (const u of signals.upvoteRecords || []) addAffinityDomain(u.domainSlug);
    for (const v of signals.viewRecords || []) addAffinityDomain(v.domainSlug);

    const requests: Promise<TrendFeedPage>[] = [
        fetchPublishedTrendsPage({
            pageSize: Math.min(30, poolSize),
            domainSlugs: explicitDomains,
            sortBy: 'latest',
            searchQuery: trimmedSearch,
        }),
    ];

    if (explicitDomains.length === 0 && !trimmedSearch) {
        // Also sample high-momentum items so new-user fallbacks and cross-domain discovery stay rich
        requests.push(
            fetchPublishedTrendsPage({
                pageSize: 20,
                sortBy: 'momentum',
            })
        );

        if (affinityDomains.length > 0) {
            requests.push(
                fetchPublishedTrendsPage({
                    pageSize: Math.min(25, poolSize),
                    domainSlugs: affinityDomains.slice(0, 10),
                    sortBy: 'latest',
                })
            );
        }
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

// ==========================================
// Phase 06.2: Source Verification & Provenance Client Helpers
// ==========================================

const PERSISTED_VERIFICATION_FRESH_MS = 6 * 60 * 60 * 1000; // 6 hours
const CLIENT_VERIFY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CLIENT_VERIFY_CACHE_MAX_ENTRIES = 100;

const clientSourceVerifyCache = new Map<
    string,
    { expiresAt: number; result: SourceVerificationResult }
>();
const inFlightSourceVerifications = new Map<string, Promise<SourceVerificationResult>>();

export function clearSourceVerificationClientCache(): void {
    clientSourceVerifyCache.clear();
    inFlightSourceVerifications.clear();
}

/**
 * Deterministically derives the initial source verification state from persisted record metadata.
 * Avoids redundant network calls when a recent retrieval timestamp already exists,
 * and NEVER fabricates a 'verified' status when no check evidence exists.
 */
export function deriveInitialSourceVerification(
    trend: Pick<TrendViewModel, 'details' | 'sourceRetrievedAtMs' | 'isSimulatedSource'>,
    nowMs = Date.now()
): InitialSourceVerificationState {
    const safeUrl = sanitizeExternalUrl(trend.details?.link);
    if (!safeUrl) {
        return {
            status: 'unverified',
            checkedAtMs: undefined,
            needsLiveCheck: false,
            evidenceSource: 'none',
            reason: 'No valid publisher URL is attached to this record.',
        };
    }

    if (trend.isSimulatedSource) {
        return {
            status: 'unverified',
            checkedAtMs: undefined,
            needsLiveCheck: false,
            evidenceSource: 'none',
            reason: 'Sample fallback entry references a simulated source and has not been externally verified.',
        };
    }

    const retrievedMs =
        typeof trend.sourceRetrievedAtMs === 'number' &&
        Number.isFinite(trend.sourceRetrievedAtMs) &&
        trend.sourceRetrievedAtMs > 0
            ? trend.sourceRetrievedAtMs
            : undefined;

    if (retrievedMs !== undefined) {
        const ageMs = Math.max(0, nowMs - retrievedMs);
        const isFresh = ageMs <= PERSISTED_VERIFICATION_FRESH_MS;
        return {
            status: 'verified',
            checkedAtMs: retrievedMs,
            needsLiveCheck: !isFresh,
            evidenceSource: 'persisted_record',
            reason: isFresh
                ? 'Source URL was verified during ingestion within the last 6 hours.'
                : 'Last recorded check is older than 6 hours; running a fresh reachability check.',
        };
    }

    return {
        status: 'unverified',
        checkedAtMs: undefined,
        needsLiveCheck: true,
        evidenceSource: 'none',
        reason: 'No prior verification check is recorded yet.',
    };
}

/**
 * Calls the authenticated server-side `/api/trendz/verify-source` endpoint (with session
 * caching and in-flight deduplication) to check URL reachability and extract provenance metadata.
 * Works identically for LIVE published trends and DEV_FALLBACK sample trends with real URLs.
 */
export async function verifyTrendSourceUrl(
    rawUrl: string,
    options?: { forceRefresh?: boolean }
): Promise<SourceVerificationResult> {
    const checkedAtIso = new Date().toISOString();
    const safeUrl = sanitizeExternalUrl(rawUrl);
    if (!safeUrl) {
        return {
            status: 'unverified',
            scope: 'url_reachability_only',
            checkedAtIso,
            originalUrl: rawUrl || '',
            redirected: false,
            redirectCount: 0,
            excerptCompleteness: 'unavailable',
            failureReason: 'No valid HTTP(S) source URL is available to verify.',
        };
    }

    const canonicalKey = canonicalizeExternalUrlClient(safeUrl) || safeUrl;
    const forceRefresh = options?.forceRefresh === true;
    const now = Date.now();

    if (!forceRefresh) {
        const cached = clientSourceVerifyCache.get(canonicalKey);
        if (cached && cached.expiresAt > now) {
            return { ...cached.result, cached: true };
        }
        if (cached) {
            clientSourceVerifyCache.delete(canonicalKey);
        }

        const existingRequest = inFlightSourceVerifications.get(canonicalKey);
        if (existingRequest) {
            return existingRequest;
        }
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        return {
            status: 'unverified',
            scope: 'url_reachability_only',
            checkedAtIso,
            originalUrl: safeUrl,
            canonicalUrl: canonicalKey,
            redirected: false,
            redirectCount: 0,
            excerptCompleteness: 'unavailable',
            failureReason: 'Sign in to run a live source URL verification check.',
        };
    }

    const requestPromise = (async (): Promise<SourceVerificationResult> => {
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch('/api/trendz/verify-source', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    url: safeUrl,
                    forceRefresh,
                }),
            });

            if (response.status === 401 || response.status === 403) {
                return {
                    status: 'unverified',
                    scope: 'url_reachability_only',
                    checkedAtIso: new Date().toISOString(),
                    originalUrl: safeUrl,
                    canonicalUrl: canonicalKey,
                    redirected: false,
                    redirectCount: 0,
                    httpStatus: response.status,
                    excerptCompleteness: 'unavailable',
                    failureReason: 'Authentication required to verify source URLs.',
                };
            }

            if (response.status === 429) {
                return {
                    status: 'unverified',
                    scope: 'url_reachability_only',
                    checkedAtIso: new Date().toISOString(),
                    originalUrl: safeUrl,
                    canonicalUrl: canonicalKey,
                    redirected: false,
                    redirectCount: 0,
                    httpStatus: 429,
                    excerptCompleteness: 'unavailable',
                    failureReason: 'Too many verification checks requested. Try again shortly.',
                };
            }

            if (!response.ok) {
                return {
                    status: 'unavailable',
                    scope: 'url_reachability_only',
                    checkedAtIso: new Date().toISOString(),
                    originalUrl: safeUrl,
                    canonicalUrl: canonicalKey,
                    redirected: false,
                    redirectCount: 0,
                    httpStatus: response.status,
                    excerptCompleteness: 'unavailable',
                    failureReason: 'Verification service could not check this source right now.',
                };
            }

            const data = (await response.json()) as Partial<SourceVerificationResult>;
            const normalizedStatus: 'verified' | 'unavailable' | 'unverified' =
                data.status === 'verified' ||
                data.status === 'unavailable' ||
                data.status === 'unverified'
                    ? data.status
                    : 'unverified';

            const result: SourceVerificationResult = {
                status: normalizedStatus,
                scope: 'url_reachability_only',
                checkedAtIso:
                    typeof data.checkedAtIso === 'string' && data.checkedAtIso
                        ? data.checkedAtIso
                        : new Date().toISOString(),
                originalUrl:
                    typeof data.originalUrl === 'string' && data.originalUrl
                        ? data.originalUrl
                        : safeUrl,
                finalUrl: sanitizeExternalUrl(data.finalUrl) || undefined,
                canonicalUrl: sanitizeExternalUrl(data.canonicalUrl) || canonicalKey,
                redirected: Boolean(data.redirected),
                redirectCount:
                    typeof data.redirectCount === 'number' && Number.isFinite(data.redirectCount)
                        ? data.redirectCount
                        : 0,
                httpStatus:
                    typeof data.httpStatus === 'number' && Number.isFinite(data.httpStatus)
                        ? data.httpStatus
                        : undefined,
                publisherName:
                    typeof data.publisherName === 'string' && data.publisherName.trim()
                        ? data.publisherName.trim()
                        : undefined,
                sourceDomain:
                    typeof data.sourceDomain === 'string' && data.sourceDomain.trim()
                        ? data.sourceDomain.trim()
                        : undefined,
                author:
                    typeof data.author === 'string' && data.author.trim()
                        ? data.author.trim()
                        : undefined,
                sourceThumbnailUrl: sanitizeExternalUrl(data.sourceThumbnailUrl) || undefined,
                publishedAtIso:
                    typeof data.publishedAtIso === 'string' && data.publishedAtIso
                        ? data.publishedAtIso
                        : undefined,
                excerpt:
                    typeof data.excerpt === 'string' && data.excerpt.trim()
                        ? data.excerpt.trim()
                        : undefined,
                excerptTruncated: Boolean(data.excerptTruncated),
                excerptCompleteness:
                    data.excerptCompleteness === 'full_excerpt' ||
                    data.excerptCompleteness === 'truncated' ||
                    data.excerptCompleteness === 'unavailable'
                        ? data.excerptCompleteness
                        : data.excerpt
                          ? 'truncated'
                          : 'unavailable',
                failureReason:
                    typeof data.failureReason === 'string' && data.failureReason.trim()
                        ? data.failureReason.trim()
                        : undefined,
                cached: Boolean(data.cached),
            };

            if (clientSourceVerifyCache.size >= CLIENT_VERIFY_CACHE_MAX_ENTRIES) {
                const oldestKey = clientSourceVerifyCache.keys().next().value;
                if (oldestKey) clientSourceVerifyCache.delete(oldestKey);
            }
            clientSourceVerifyCache.set(canonicalKey, {
                expiresAt: Date.now() + CLIENT_VERIFY_CACHE_TTL_MS,
                result,
            });

            return result;
        } catch {
            return {
                status: 'unavailable',
                scope: 'url_reachability_only',
                checkedAtIso: new Date().toISOString(),
                originalUrl: safeUrl,
                canonicalUrl: canonicalKey,
                redirected: false,
                redirectCount: 0,
                excerptCompleteness: 'unavailable',
                failureReason: 'Network error while checking source reachability.',
            };
        } finally {
            inFlightSourceVerifications.delete(canonicalKey);
        }
    })();

    inFlightSourceVerifications.set(canonicalKey, requestPromise);
    return requestPromise;
}

// ============================================================================
// PHASE 06.4: INTELLIGENT RELATED TRENDS DISCOVERY & CACHING
// ============================================================================

export interface RelatedTrendScoreBreakdown {
    tagScore: number;
    entityScore: number;
    textScore: number;
    domainCategoryScore: number;
    sourceAndCuratedScore: number;
    recencyScore: number;
    totalScore: number;
}

export interface RelatedTrendMatch {
    trend: TrendViewModel;
    score: number;
    primaryReason: string;
    reasons: string[];
    matchedTags: string[];
    matchedEntities: string[];
    matchedTerms: string[];
    breakdown: RelatedTrendScoreBreakdown;
}

export interface RelatedTrendsResult {
    items: RelatedTrendMatch[];
    candidateCount: number;
    source: 'live' | 'dev_fallback';
    cached: boolean;
}

export interface RelatedTrendRankingOptions {
    maxCount?: number;
    minScore?: number;
    nowMs?: number;
}

export interface FetchRelatedTrendsOptions extends RelatedTrendRankingOptions {
    knownCandidates?: TrendViewModel[];
    forceRefresh?: boolean;
}

const RELATED_TRENDS_DEFAULT_LIMIT = 4;
const RELATED_TRENDS_MIN_SCORE = 18;
const RELATED_TRENDS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RELATED_TRENDS_CACHE_MAX_ENTRIES = 60;

const relatedTrendsCache = new Map<
    string,
    { expiresAt: number; result: RelatedTrendsResult }
>();
const inFlightRelatedTrends = new Map<string, Promise<RelatedTrendsResult>>();

const RELATED_STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'as',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'with',
    'from', 'into', 'onto', 'upon', 'over', 'under', 'above', 'below', 'between', 'among',
    'through', 'during', 'before', 'after', 'about', 'against', 'within', 'without', 'across',
    'around', 'that', 'this', 'these', 'those', 'they', 'them', 'their', 'theirs', 'there',
    'here', 'where', 'when', 'while', 'what', 'which', 'who', 'whom', 'whose', 'how', 'why',
    'not', 'no', 'nor', 'only', 'just', 'very', 'more', 'most', 'less', 'least', 'much', 'many',
    'some', 'any', 'all', 'both', 'each', 'few', 'other', 'another', 'such', 'same', 'than',
    'then', 'now', 'also', 'too', 'still', 'even', 'well', 'back', 'out', 'up', 'down', 'off',
    'its', 'our', 'your', 'his', 'her', 'per', 'via', 'new', 'next', 'first', 'second', 'third',
    'last', 'recent', 'latest', 'today', 'year', 'years', 'month', 'months', 'week', 'weeks',
    'day', 'days', 'hour', 'hours', 'time', 'times', 'record', 'breaking', 'global', 'world',
    'major', 'significant', 'leading', 'advanced', 'modern', 'current', 'traditional', 'industry',
    'study', 'report', 'news', 'article', 'update', 'updates', 'trend', 'trends', 'discover',
    'explores', 'explore', 'reveals', 'revealed', 'shows', 'show', 'showcases', 'says', 'said',
    'make', 'makes', 'made', 'using', 'used', 'uses', 'based', 'including', 'following',
    'according', 'expected', 'continues', 'continue', 'enabling', 'bringing', 'promises',
    'promising', 'shift', 'landscape', 'future', 'way', 'ways', 'set', 'see', 'seen', 'one',
    'two', 'three', 'four', 'five', 'percent', 'achieve', 'achieved', 'achieves', 'milestone',
    'powered', 'driven', 'based', 'tools', 'tool', 'system', 'systems', 'process', 'processes',
    'approach', 'approaches', 'development', 'developments', 'breakthrough', 'innovation',
    'innovations', 'research', 'researchers', 'scientists', 'team', 'global', 'general',
]);

const GENERIC_DOMAIN_TAGS = new Set([
    'technology', 'tech', 'health-care', 'healthcare', 'health', 'trading', 'stock-market',
    'finance', 'science', 'business', 'crypto', 'sports', 'politics', 'entertainment', 'design',
    'education', 'gaming', 'lifestyle', 'space', 'startups', 'economics', 'climate', 'energy',
    'general', 'news', 'world',
]);

const RELATED_DOMAIN_CLUSTERS: ReadonlyArray<ReadonlySet<string>> = [
    new Set(['trading', 'stock-market', 'finance', 'economics', 'crypto', 'business']),
    new Set(['technology', 'science', 'space', 'gaming']),
    new Set(['health-care', 'science']),
    new Set(['stock-market', 'business', 'startups', 'economics']),
    new Set(['entertainment', 'gaming', 'design']),
    new Set(['politics', 'economics', 'business']),
];

const KNOWN_TECH_ACRONYMS = new Set([
    'ai', 'ml', 'llm', 'llms', 'gpu', 'gpus', 'cpu', 'npu', 'tpu', 'api', 'sdk', 'fda', 'sec',
    'nih', 'iea', 'ibm', 'ev', 'evs', 'pv', 'rna', 'mrna', 'crispr', 'defi', 'etf', 'gdp',
    'vfx', 'ar', 'vr', 'xr', 'iot', '5g', '6g', 'esg', 'saas', 'b2b', 'ipo', 'mri', 'ct',
    'nasa', 'esa', 'cern', 'mit', 'who', 'eu', 'us', 'uk', 'un', 'ftc', 'doj', 'fed', 'ecb',
]);

function lightStemToken(token: string): string {
    const clean = token.toLowerCase().trim();
    if (clean.length <= 3) return clean;
    if (clean.endsWith('ization') && clean.length > 9) return clean.slice(0, -7);
    if (clean.endsWith('ations') && clean.length > 8) return clean.slice(0, -6);
    if (clean.endsWith('ation') && clean.length > 7) return clean.slice(0, -5);
    if (clean.endsWith('ities') && clean.length > 7) return `${clean.slice(0, -5)}y`;
    if (clean.endsWith('ments') && clean.length > 7) return clean.slice(0, -5);
    if (clean.endsWith('ment') && clean.length > 6) return clean.slice(0, -4);
    if (clean.endsWith('ings') && clean.length > 6) return clean.slice(0, -4);
    if (clean.endsWith('ing') && clean.length > 5) return clean.slice(0, -3);
    if (clean.endsWith('able') && clean.length > 6) return clean.slice(0, -4);
    if (clean.endsWith('ible') && clean.length > 6) return clean.slice(0, -4);
    if (clean.endsWith('ical') && clean.length > 6) return clean.slice(0, -4);
    if (clean.endsWith('ists') && clean.length > 6) return clean.slice(0, -4);
    if (clean.endsWith('ist') && clean.length > 5) return clean.slice(0, -3);
    if (clean.endsWith('ies') && clean.length > 5) return `${clean.slice(0, -3)}y`;
    if (clean.endsWith('ers') && clean.length > 5) return clean.slice(0, -3);
    if (clean.endsWith('ed') && clean.length > 5) return clean.slice(0, -2);
    if (clean.endsWith('es') && clean.length > 5) return clean.slice(0, -2);
    if (clean.endsWith('s') && !clean.endsWith('ss') && clean.length > 4) return clean.slice(0, -1);
    return clean;
}

function normalizeRelatedTag(rawTag: string): string {
    return rawTag
        .toLowerCase()
        .trim()
        .replace(/^#+/, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function extractNormalizedTagSet(trend: TrendViewModel): Set<string> {
    const tags = new Set<string>();
    for (const raw of trend.tags || []) {
        if (typeof raw !== 'string') continue;
        const clean = normalizeRelatedTag(raw);
        if (clean.length >= 2) {
            tags.add(clean);
        }
    }
    return tags;
}

function extractNormalizedCategory(trend: TrendViewModel): string | null {
    const rawCat = typeof trend.category === 'string' ? trend.category.trim().toLowerCase() : '';
    if (!rawCat || rawCat.length < 2) return null;
    const domainName = (trend.domain?.name || '').trim().toLowerCase();
    const domainSlug = (trend.domainSlug || '').trim().toLowerCase();
    if (
        rawCat === domainName ||
        rawCat === domainSlug ||
        rawCat.replace(/\s+/g, '-') === domainSlug
    ) {
        return null;
    }
    return rawCat;
}

function extractWeightedLexicalVector(trend: TrendViewModel): Map<string, number> {
    const weights = new Map<string, number>();

    const addText = (text: string | undefined, weight: number) => {
        if (!text || typeof text !== 'string') return;
        const rawTokens = text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/[\s-]+/);

        for (const rawToken of rawTokens) {
            const clean = rawToken.trim();
            if (!clean) continue;
            const isKnownAcronym = KNOWN_TECH_ACRONYMS.has(clean);
            if (!isKnownAcronym && clean.length < 3) continue;
            if (RELATED_STOP_WORDS.has(clean)) continue;
            if (/^\d+$/.test(clean)) continue;

            const stem = isKnownAcronym ? clean : lightStemToken(clean);
            if (!isKnownAcronym && (stem.length < 3 || RELATED_STOP_WORDS.has(stem))) continue;

            // Slight specificity weight for longer technical terms
            const specificity = isKnownAcronym ? 1.2 : Math.min(1.5, 0.85 + stem.length * 0.06);
            const prev = weights.get(stem) || 0;
            weights.set(stem, Math.min(8, prev + weight * specificity));
        }
    };

    addText(trend.title, 2.2);
    addText(trend.summary, 1.3);
    addText(trend.whyItMatters, 0.9);
    if (Array.isArray(trend.keyTakeaways) && trend.keyTakeaways.length > 0) {
        addText(trend.keyTakeaways.join(' '), 0.9);
    }
    if (Array.isArray(trend.searchKeywords) && trend.searchKeywords.length > 0) {
        addText(trend.searchKeywords.join(' '), 1.0);
    }

    return weights;
}

function extractTrendEntities(trend: TrendViewModel): Set<string> {
    const entities = new Set<string>();
    const domainNameLower = (trend.domain?.name || '').trim().toLowerCase();

    const addEntity = (raw: string) => {
        const clean = raw
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!clean) return;
        if (clean === domainNameLower || clean === trend.domainSlug) return;
        if (GENERIC_DOMAIN_TAGS.has(clean)) return;
        if (RELATED_STOP_WORDS.has(clean)) return;
        if (clean.length < 2) return;
        if (clean.length === 2 && !KNOWN_TECH_ACRONYMS.has(clean)) return;
        entities.add(clean);
    };

    const corpus = [
        trend.title || '',
        trend.summary || '',
        trend.whyItMatters || '',
        ...(trend.keyTakeaways || []),
    ].join('. ');

    // 1. Multi-word capitalized entity phrases (technologies, organizations, proper names)
    const multiWordMatches = corpus.match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,2}\b/g);
    if (multiWordMatches) {
        for (const phrase of multiWordMatches) {
            const words = phrase.split(/\s+/).map((w) => w.toLowerCase());
            if (words.every((w) => RELATED_STOP_WORDS.has(w))) continue;
            addEntity(phrase);
        }
    }

    // 2. Acronyms and technical abbreviations (e.g., AI, LLM, IBM, NIH, SEC, IEA, GPU)
    const acronymMatches = corpus.match(/\b[A-Z]{2,6}\b/g);
    if (acronymMatches) {
        for (const acro of acronymMatches) {
            const lower = acro.toLowerCase();
            if (KNOWN_TECH_ACRONYMS.has(lower) || lower.length >= 3) {
                addEntity(lower);
            }
        }
    }

    // 3. Hyphenated technical concepts from text and tags (e.g., virtual-production, green-energy)
    const hyphenMatches = corpus.match(/\b[a-zA-Z0-9]{2,}-[a-zA-Z0-9]{2,}(?:-[a-zA-Z0-9]{2,})?\b/g);
    if (hyphenMatches) {
        for (const compound of hyphenMatches) {
            const normalized = compound.toLowerCase().replace(/-/g, ' ');
            const parts = normalized.split(' ');
            if (!parts.every((p) => RELATED_STOP_WORDS.has(p))) {
                addEntity(normalized);
            }
        }
    }

    // 4. Specific category tokens and non-generic compound tags
    const specificCategory = extractNormalizedCategory(trend);
    if (specificCategory) {
        addEntity(specificCategory.replace(/&/g, ' ').replace(/\s+/g, ' ').trim());
    }
    for (const rawTag of trend.tags || []) {
        const cleanTag = normalizeRelatedTag(rawTag);
        if (cleanTag && !GENERIC_DOMAIN_TAGS.has(cleanTag)) {
            if (cleanTag.includes('-')) {
                addEntity(cleanTag.replace(/-/g, ' '));
            } else if (KNOWN_TECH_ACRONYMS.has(cleanTag)) {
                addEntity(cleanTag);
            }
        }
    }

    // 5. Known technical/organization tokens appearing in lowercase searchKeywords
    for (const kw of trend.searchKeywords || []) {
        const cleanKw = (kw || '').toLowerCase().trim();
        if (KNOWN_TECH_ACRONYMS.has(cleanKw)) {
            addEntity(cleanKw);
        }
    }

    return entities;
}

function extractSourceDomains(trend: TrendViewModel): Set<string> {
    const domains = new Set<string>();
    const addHost = (rawUrlOrDomain?: string) => {
        if (!rawUrlOrDomain || typeof rawUrlOrDomain !== 'string') return;
        const trimmed = rawUrlOrDomain.trim().toLowerCase();
        if (!trimmed) return;
        try {
            const host = trimmed.includes('://')
                ? new URL(trimmed).hostname.toLowerCase()
                : trimmed.split('/')[0];
            const clean = host.replace(/^www\./, '');
            if (clean && clean.includes('.')) {
                domains.add(clean);
            }
        } catch {
            // ignore malformed host
        }
    };

    addHost(trend.sourceDomain);
    addHost(trend.details?.link);
    addHost(trend.canonicalUrl);
    for (const extra of trend.additionalSources || []) {
        addHost(extra?.url);
    }
    return domains;
}

function areDomainsInRelatedCluster(a: TrendzDomainSlug, b: TrendzDomainSlug): boolean {
    if (!a || !b || a === b) return false;
    return RELATED_DOMAIN_CLUSTERS.some((cluster) => cluster.has(a) && cluster.has(b));
}

function normalizeDedupeTitleKey(title?: string): string {
    return (title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function buildTrendRelatedCacheSignature(trend: TrendViewModel): string {
    const tagsSig = (trend.tags || [])
        .map((t) => normalizeRelatedTag(t))
        .filter(Boolean)
        .sort()
        .join(',');
    const relatedSig = (trend.relatedTrendIds || [])
        .map((id) => id.trim())
        .filter(Boolean)
        .sort()
        .join(',');
    const titleSig = normalizeDedupeTitleKey(trend.title).slice(0, 60);
    return [
        trend.isFallback ? 'dev' : 'live',
        trend.id,
        trend.domainSlug,
        trend.category || '',
        trend.publishedAtMs || 0,
        tagsSig,
        relatedSig,
        titleSig,
    ].join('|');
}

export function clearRelatedTrendsCache(trendId?: string): void {
    if (!trendId) {
        relatedTrendsCache.clear();
        inFlightRelatedTrends.clear();
        return;
    }
    const cleanId = trendId.trim();
    for (const key of Array.from(relatedTrendsCache.keys())) {
        if (key.includes(`|${cleanId}|`)) {
            relatedTrendsCache.delete(key);
        }
    }
    for (const key of Array.from(inFlightRelatedTrends.keys())) {
        if (key.includes(`|${cleanId}|`)) {
            inFlightRelatedTrends.delete(key);
        }
    }
}

/**
 * Deterministic, multi-signal Related Trends ranking engine (Phase 06.4).
 *
 * Prioritizes genuine topical relevance over simple domain/category matching using:
 * 1. Shared topic tags (specific tags weighted strongly; generic domain tags capped low)
 * 2. Shared entities, technologies, companies, and events
 * 3. Headline, summary, takeaway, and keyword lexical similarity
 * 4. Domain & sub-category similarity (intentionally below threshold by itself)
 * 5. Curated editorial links (`relatedTrendIds`) & source domain/publisher relationships
 * 6. Bounded publication recency & news-cycle proximity
 *
 * Strictly excludes the opened trend, unpublished/rejected records, cross-mode records
 * (live vs DEV_FALLBACK), duplicates, and low-relevance filler.
 */
export function rankRelatedTrends(
    sourceTrend: TrendViewModel,
    candidates: TrendViewModel[],
    options: RelatedTrendRankingOptions = {}
): RelatedTrendsResult {
    const maxCount = Math.max(1, Math.min(options.maxCount ?? RELATED_TRENDS_DEFAULT_LIMIT, 8));
    const minScore = options.minScore ?? RELATED_TRENDS_MIN_SCORE;
    const nowMs = options.nowMs ?? Date.now();
    const sourceIsFallback = Boolean(sourceTrend.isFallback);

    const sourceTags = extractNormalizedTagSet(sourceTrend);
    const sourceCategory = extractNormalizedCategory(sourceTrend);
    const sourceVector = extractWeightedLexicalVector(sourceTrend);
    const sourceEntities = extractTrendEntities(sourceTrend);
    const sourceDomains = extractSourceDomains(sourceTrend);
    const sourcePublisher = (sourceTrend.details?.publishedBy || '').trim().toLowerCase();
    const sourceCuratedIds = new Set(
        (sourceTrend.relatedTrendIds || []).map((id) => (typeof id === 'string' ? id.trim() : ''))
    );
    const sourceCanonicalUrl =
        canonicalizeExternalUrlClient(sourceTrend.canonicalUrl || sourceTrend.details?.link) ||
        null;
    const sourceTitleKey = normalizeDedupeTitleKey(sourceTrend.title);

    let sourceVecNormSq = 0;
    for (const val of sourceVector.values()) {
        sourceVecNormSq += val * val;
    }
    const sourceVecNorm = Math.sqrt(sourceVecNormSq);

    const seenIds = new Set<string>([sourceTrend.id]);
    const validCandidates: TrendViewModel[] = [];

    for (const candidate of candidates || []) {
        if (!candidate || !candidate.id) continue;
        if (seenIds.has(candidate.id)) continue;
        if (candidate.status !== 'published') continue;
        if (Boolean(candidate.isFallback) !== sourceIsFallback) continue;
        seenIds.add(candidate.id);
        validCandidates.push(candidate);
    }

    const scoredMatches: RelatedTrendMatch[] = [];

    for (const candidate of validCandidates) {
        const candCanonicalUrl =
            canonicalizeExternalUrlClient(candidate.canonicalUrl || candidate.details?.link) ||
            null;
        const candTitleKey = normalizeDedupeTitleKey(candidate.title);

        // Skip duplicate story copies of the currently opened trend
        if (
            (sourceTitleKey && candTitleKey && candTitleKey === sourceTitleKey) ||
            (sourceCanonicalUrl && candCanonicalUrl && candCanonicalUrl === sourceCanonicalUrl)
        ) {
            continue;
        }

        const candTags = extractNormalizedTagSet(candidate);
        const candCategory = extractNormalizedCategory(candidate);
        const candVector = extractWeightedLexicalVector(candidate);
        const candEntities = extractTrendEntities(candidate);
        const candSourceDomains = extractSourceDomains(candidate);
        const candPublisher = (candidate.details?.publishedBy || '').trim().toLowerCase();

        // 1. Shared topics & tags (0..38 pts)
        const matchedSpecificTags: string[] = [];
        const matchedGenericTags: string[] = [];
        for (const tag of sourceTags) {
            if (candTags.has(tag)) {
                if (GENERIC_DOMAIN_TAGS.has(tag)) {
                    matchedGenericTags.push(tag);
                } else {
                    matchedSpecificTags.push(tag);
                }
            }
        }

        let tagScore = 0;
        if (matchedSpecificTags.length > 0) {
            tagScore += 16 + (matchedSpecificTags.length - 1) * 11;
        }
        if (matchedGenericTags.length > 0) {
            tagScore += 6;
        }

        // Cross-match specific compound source tags against candidate lexical stems (e.g., #regenerative-medicine -> regenerative)
        let crossTagPartHits = 0;
        for (const tag of sourceTags) {
            if (GENERIC_DOMAIN_TAGS.has(tag) || candTags.has(tag)) continue;
            const parts = tag.split('-').filter((p) => p.length >= 4 && !RELATED_STOP_WORDS.has(p));
            if (parts.some((part) => candVector.has(lightStemToken(part)))) {
                crossTagPartHits += 1;
            }
        }
        if (crossTagPartHits > 0) {
            tagScore += Math.min(10, crossTagPartHits * 5);
        }
        tagScore = Math.min(38, tagScore);

        // 2. Shared entities, technologies, companies, events (0..26 pts)
        const matchedTagSetLower = new Set(
            [...matchedSpecificTags, ...matchedGenericTags].map((t) => t.replace(/-/g, ' '))
        );
        const matchedEntities: string[] = [];
        let entityScore = 0;
        for (const entity of sourceEntities) {
            if (!candEntities.has(entity)) continue;
            matchedEntities.push(entity);
            // Avoid double-counting an entity that is identical to an already-scored tag
            if (matchedTagSetLower.has(entity)) {
                entityScore += 4;
            } else if (entity.includes(' ')) {
                entityScore += 12;
            } else {
                entityScore += 8;
            }
        }
        entityScore = Math.min(26, entityScore);

        // 3. Headline, summary & briefing lexical similarity (0..24 pts)
        let dotProduct = 0;
        let candVecNormSq = 0;
        for (const val of candVector.values()) {
            candVecNormSq += val * val;
        }
        const matchedTerms: string[] = [];
        for (const [stem, sWeight] of sourceVector.entries()) {
            const cWeight = candVector.get(stem);
            if (cWeight !== undefined) {
                dotProduct += sWeight * cWeight;
                matchedTerms.push(stem);
            }
        }
        const candVecNorm = Math.sqrt(candVecNormSq);
        const cosineSim =
            sourceVecNorm > 0 && candVecNorm > 0
                ? dotProduct / (sourceVecNorm * candVecNorm)
                : 0;
        const distinctTermsOutsideTags = matchedTerms.filter(
            (term) => !matchedTagSetLower.has(term)
        );
        const lexicalOverlapBonus = Math.min(12, distinctTermsOutsideTags.length * 3.5);
        const textScore = Number(Math.min(24, cosineSim * 28 + lexicalOverlapBonus).toFixed(2));

        // 4. Domain & category similarity (0..18 pts)
        const sameDomain = candidate.domainSlug === sourceTrend.domainSlug;
        const sameSpecificCategory =
            Boolean(sourceCategory && candCategory && sourceCategory === candCategory);
        const relatedCluster = areDomainsInRelatedCluster(
            sourceTrend.domainSlug,
            candidate.domainSlug
        );
        let domainCategoryScore = 0;
        if (sameSpecificCategory) {
            domainCategoryScore += 10;
        }
        if (sameDomain) {
            domainCategoryScore += 8;
        } else if (relatedCluster) {
            domainCategoryScore += 4;
        }
        domainCategoryScore = Math.min(18, domainCategoryScore);

        // 5. Curated editorial links & source relationships (0..20 pts)
        const isCuratedLink =
            sourceCuratedIds.has(candidate.id) ||
            (Array.isArray(candidate.relatedTrendIds) &&
                candidate.relatedTrendIds.includes(sourceTrend.id));

        let sharedSourceRelation = false;
        for (const dom of sourceDomains) {
            if (candSourceDomains.has(dom)) {
                sharedSourceRelation = true;
                break;
            }
        }
        if (
            !sharedSourceRelation &&
            sourcePublisher &&
            candPublisher &&
            sourcePublisher === candPublisher &&
            sourcePublisher !== 'invox desk'
        ) {
            sharedSourceRelation = true;
        }

        let sourceAndCuratedScore = 0;
        if (isCuratedLink) sourceAndCuratedScore += 15;
        if (sharedSourceRelation) sourceAndCuratedScore += 6;
        sourceAndCuratedScore = Math.min(20, sourceAndCuratedScore);

        // 6. Bounded publication recency & news-cycle proximity (0..8 pts)
        const ageDaysFromNow = Math.max(0, (nowMs - candidate.publishedAtMs) / 86_400_000);
        const deltaDaysFromSource =
            Math.abs((sourceTrend.publishedAtMs || nowMs) - candidate.publishedAtMs) / 86_400_000;
        const recencyDecay = ageDaysFromNow <= 180 ? 5 / (1 + ageDaysFromNow / 30) : 0;
        const proximityBonus = deltaDaysFromSource <= 90 ? 3 / (1 + deltaDaysFromSource / 14) : 0;
        const recencyScore = Number(Math.min(8, recencyDecay + proximityBonus).toFixed(2));

        // Topical relevance gate: prevents pure broad-domain or recency padding
        const hasMeaningfulTopicalSignal =
            matchedSpecificTags.length >= 1 ||
            matchedEntities.length >= 1 ||
            textScore >= 6 ||
            sameSpecificCategory ||
            isCuratedLink ||
            (sameDomain && matchedGenericTags.length >= 1 && textScore >= 3);

        const totalScore = Number(
            (
                tagScore +
                entityScore +
                textScore +
                domainCategoryScore +
                sourceAndCuratedScore +
                recencyScore
            ).toFixed(2)
        );

        if (!hasMeaningfulTopicalSignal || totalScore < minScore) {
            continue;
        }

        // Build concise, transparent editorial reasons
        const reasons: string[] = [];
        if (matchedSpecificTags.length > 0) {
            reasons.push(`TOPIC: #${matchedSpecificTags[0]}`);
        }
        if (matchedEntities.length > 0 && !matchedSpecificTags.includes(matchedEntities[0])) {
            reasons.push(`ENTITY: ${matchedEntities[0].toUpperCase()}`);
        }
        if (sameSpecificCategory && candidate.category) {
            reasons.push(`CATEGORY: ${candidate.category.toUpperCase()}`);
        }
        if (textScore >= 9) {
            reasons.push('SIMILAR_COVERAGE');
        }
        if (isCuratedLink) {
            reasons.push('LINKED_BRIEFING');
        }
        if (sharedSourceRelation) {
            reasons.push('RELATED_SOURCE');
        }
        if (reasons.length === 0 && sameDomain) {
            reasons.push(`DOMAIN: ${(candidate.domain?.name || candidate.domainSlug).toUpperCase()}`);
        }

        scoredMatches.push({
            trend: candidate,
            score: totalScore,
            primaryReason: reasons[0] || 'RELATED_TOPIC',
            reasons: reasons.slice(0, 3),
            matchedTags: [...matchedSpecificTags, ...matchedGenericTags],
            matchedEntities,
            matchedTerms: matchedTerms.slice(0, 8),
            breakdown: {
                tagScore,
                entityScore,
                textScore,
                domainCategoryScore,
                sourceAndCuratedScore,
                recencyScore,
                totalScore,
            },
        });
    }

    // Deterministic ranking: totalScore -> topical core -> publishedAtMs -> id
    scoredMatches.sort((a, b) => {
        if (Math.abs(b.score - a.score) > 0.01) {
            return b.score - a.score;
        }
        const bTopical = b.breakdown.tagScore + b.breakdown.entityScore + b.breakdown.textScore;
        const aTopical = a.breakdown.tagScore + a.breakdown.entityScore + a.breakdown.textScore;
        if (Math.abs(bTopical - aTopical) > 0.01) {
            return bTopical - aTopical;
        }
        if (b.trend.publishedAtMs !== a.trend.publishedAtMs) {
            return b.trend.publishedAtMs - a.trend.publishedAtMs;
        }
        return a.trend.id.localeCompare(b.trend.id);
    });

    // Deduplicate final selected list by ID, normalized title, and canonical URL
    const finalMatches: RelatedTrendMatch[] = [];
    const usedIds = new Set<string>();
    const usedTitles = new Set<string>();
    const usedUrls = new Set<string>();

    for (const match of scoredMatches) {
        if (usedIds.has(match.trend.id)) continue;
        const titleKey = normalizeDedupeTitleKey(match.trend.title);
        const urlKey =
            canonicalizeExternalUrlClient(match.trend.canonicalUrl || match.trend.details?.link) ||
            '';
        if (titleKey && usedTitles.has(titleKey)) continue;
        if (urlKey && usedUrls.has(urlKey)) continue;

        usedIds.add(match.trend.id);
        if (titleKey) usedTitles.add(titleKey);
        if (urlKey) usedUrls.add(urlKey);
        finalMatches.push(match);

        if (finalMatches.length >= maxCount) {
            break;
        }
    }

    return {
        items: finalMatches,
        candidateCount: validCandidates.length,
        source: sourceIsFallback ? 'dev_fallback' : 'live',
        cached: false,
    };
}

/**
 * DEV_FALLBACK parity helper: identifies genuinely related sample trends strictly from
 * DEVELOPMENT_MOCK_TRENDS without touching Firestore or mixing with live records.
 */
export function getFallbackRelatedTrendsForTrend(
    sourceTrend: TrendViewModel,
    options: RelatedTrendRankingOptions = {}
): RelatedTrendsResult {
    const fallbackSource: TrendViewModel = sourceTrend.isFallback
        ? sourceTrend
        : { ...sourceTrend, isFallback: true };
    return rankRelatedTrends(fallbackSource, DEVELOPMENT_MOCK_TRENDS, options);
}

/**
 * Retrieves and ranks related published live trends for a Trend detail page using bounded,
 * index-backed Firestore queries (no full-collection scans, no per-visit AI calls) and
 * session caching keyed to the trend's metadata signature.
 *
 * Uses existing composite indexes in firestore.indexes.json:
 * - (status ASC, tags ARRAY_CONTAINS, publishedAt DESC)
 * - (status ASC, searchKeywords ARRAY_CONTAINS, publishedAt DESC)
 * - (status ASC, domainSlug ASC, publishedAt DESC)
 */
export async function fetchRelatedTrendsForTrend(
    sourceTrend: TrendViewModel,
    options: FetchRelatedTrendsOptions = {}
): Promise<RelatedTrendsResult> {
    if (!sourceTrend || !sourceTrend.id) {
        return {
            items: [],
            candidateCount: 0,
            source: sourceTrend?.isFallback ? 'dev_fallback' : 'live',
            cached: false,
        };
    }

    if (sourceTrend.isFallback) {
        return getFallbackRelatedTrendsForTrend(sourceTrend, options);
    }

    const maxCount = Math.max(1, Math.min(options.maxCount ?? RELATED_TRENDS_DEFAULT_LIMIT, 8));
    const cacheKey = `${buildTrendRelatedCacheSignature(sourceTrend)}|max:${maxCount}`;
    const forceRefresh = options.forceRefresh === true;
    const now = Date.now();

    if (!forceRefresh) {
        const cached = relatedTrendsCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return { ...cached.result, cached: true };
        }
        if (cached) {
            relatedTrendsCache.delete(cacheKey);
        }

        const existingRequest = inFlightRelatedTrends.get(cacheKey);
        if (existingRequest) {
            return existingRequest;
        }
    }

    const requestPromise = (async (): Promise<RelatedTrendsResult> => {
        try {
            const trendzRef = collection(db, TRENDZ_COLLECTION);
            const knownLive = (options.knownCandidates || []).filter(
                (item) =>
                    Boolean(item) &&
                    !item.isFallback &&
                    item.status === 'published' &&
                    item.id !== sourceTrend.id
            );

            // Pick up to 2 most specific tags for indexed array-contains lookups
            const specificTags = Array.from(extractNormalizedTagSet(sourceTrend))
                .filter((tag) => !GENERIC_DOMAIN_TAGS.has(tag))
                .slice(0, 2);

            // Pick 1 discriminative searchKeyword not already covered by queried tags
            const tagSetForSkip = new Set(specificTags);
            const discriminativeKeyword = (sourceTrend.searchKeywords || [])
                .map((kw) => (typeof kw === 'string' ? kw.trim().toLowerCase() : ''))
                .filter(
                    (kw) =>
                        kw.length >= 3 &&
                        !RELATED_STOP_WORDS.has(kw) &&
                        !GENERIC_DOMAIN_TAGS.has(kw) &&
                        !tagSetForSkip.has(kw)
                )
                .sort((a, b) => b.length - a.length)[0];

            const fetchByIndexedArrayField = async (
                field: 'tags' | 'searchKeywords',
                value: string,
                fetchLimit: number
            ): Promise<TrendViewModel[]> => {
                try {
                    const snap = await getDocs(
                        query(
                            trendzRef,
                            where('status', '==', 'published'),
                            where(field, 'array-contains', value),
                            orderBy('publishedAt', 'desc'),
                            limit(fetchLimit)
                        )
                    );
                    const results: TrendViewModel[] = [];
                    for (const docSnap of snap.docs) {
                        const parsed = parseTrendDocument(docSnap.id, docSnap.data(), true);
                        if (parsed && parsed.id !== sourceTrend.id) {
                            results.push(trendRecordToViewModel(parsed));
                        }
                    }
                    return results;
                } catch (err: any) {
                    if (isMissingIndexError(err)) {
                        console.warn(
                            `[TRENDZ_RELATED] Composite index for (status, ${field}, publishedAt) unavailable; skipping ${field}="${value}" lookup.`
                        );
                        return [];
                    }
                    throw err;
                }
            };

            const requests: Promise<TrendViewModel[]>[] = [];

            // 1. Explicit editorial/ingestion relatedTrendIds (point lookups)
            if (Array.isArray(sourceTrend.relatedTrendIds) && sourceTrend.relatedTrendIds.length > 0) {
                requests.push(
                    fetchRelatedTrends(sourceTrend.relatedTrendIds, sourceTrend.id, 6)
                );
            }

            // 2. Indexed top specific tag lookups
            for (const tag of specificTags) {
                requests.push(fetchByIndexedArrayField('tags', tag, 12));
            }

            // 3. Indexed discriminative keyword lookup
            if (discriminativeKeyword) {
                requests.push(fetchByIndexedArrayField('searchKeywords', discriminativeKeyword, 12));
            }

            // 4. Indexed same-domain recent published trends (bounded to 16)
            requests.push(
                fetchPublishedTrendsPage({
                    domainSlugs: [sourceTrend.domainSlug],
                    pageSize: 16,
                    sortBy: 'latest',
                }).then((page) => page.items)
            );

            const settled = await Promise.allSettled(requests);
            const combinedCandidates: TrendViewModel[] = [...knownLive];
            let fulfilledRemoteCount = 0;
            let firstError: unknown = null;

            for (const res of settled) {
                if (res.status === 'fulfilled') {
                    fulfilledRemoteCount += 1;
                    combinedCandidates.push(...res.value);
                } else if (!firstError) {
                    firstError = res.reason;
                }
            }

            // Surface genuine error if every remote lookup failed and we have no local live candidates
            if (fulfilledRemoteCount === 0 && combinedCandidates.length === 0 && firstError) {
                throw firstError;
            }

            const ranked = rankRelatedTrends(sourceTrend, combinedCandidates, {
                maxCount,
                minScore: options.minScore,
                nowMs: options.nowMs,
            });

            if (relatedTrendsCache.size >= RELATED_TRENDS_CACHE_MAX_ENTRIES) {
                const oldestKey = relatedTrendsCache.keys().next().value;
                if (oldestKey) relatedTrendsCache.delete(oldestKey);
            }
            relatedTrendsCache.set(cacheKey, {
                expiresAt: Date.now() + RELATED_TRENDS_CACHE_TTL_MS,
                result: ranked,
            });

            return ranked;
        } finally {
            inFlightRelatedTrends.delete(cacheKey);
        }
    })();

    inFlightRelatedTrends.set(cacheKey, requestPromise);
    return requestPromise;
}
