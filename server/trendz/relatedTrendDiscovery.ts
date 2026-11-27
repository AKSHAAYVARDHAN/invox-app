import type { TrendStatus } from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import {
  TRENDZ_FALLBACK_SAMPLE_DATA,
  type FallbackSampleTrendData,
} from '../../utils/trendzFallbackData';
import { normalizeServerDomainSlug } from './domainCatalog';
import { canonicalizeSourceUrl } from './sourceValidation';
import type { RawRelatedTrendInput } from './trendContextBuilder';

export const SERVER_RELATED_TRENDS_MAX_RESULTS = 4;
export const SERVER_RELATED_TRENDS_MIN_SCORE = 16;
export const SERVER_RELATED_DOMAIN_QUERY_LIMIT = 12;

const GENERIC_DOMAIN_TAGS = new Set([
  'tech',
  'technology',
  'healthcare',
  'health-care',
  'health',
  'trading',
  'stock-market',
  'stocks',
  'market',
  'markets',
  'design',
  'finance',
  'science',
  'gaming',
  'art',
  'automotive',
  'space',
  'news',
  'trending',
  'trend',
  'trends',
  'update',
  'industry',
  'global',
  'innovation',
  'business',
  'research',
]);

const RELATED_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after',
  'under', 'more', 'most', 'less', 'than', 'have', 'has', 'had', 'were', 'been',
  'being', 'will', 'would', 'could', 'should', 'about', 'across', 'amid', 'new',
  'latest', 'report', 'reports', 'reported', 'says', 'said', 'how', 'why', 'what',
  'when', 'where', 'who', 'their', 'there', 'these', 'those', 'they', 'them',
  'also', 'just', 'only', 'very', 'much', 'many', 'such', 'some', 'each', 'other',
  'first', 'second', 'third', 'next', 'year', 'years', 'month', 'months', 'week',
  'weeks', 'today', 'now', 'using', 'used', 'make', 'makes', 'made', 'shows',
  'shown', 'according', 'study', 'analysis', 'briefing', 'development', 'developments',
]);

const RELATED_DOMAIN_CLUSTERS: Record<TrendzDomainSlug, TrendzDomainSlug[]> = {
  technology: ['science', 'space', 'automotive', 'design', 'gaming'],
  'health-care': ['science', 'technology'],
  trading: ['stock-market', 'finance'],
  'stock-market': ['trading', 'finance'],
  design: ['art', 'technology', 'gaming'],
  finance: ['stock-market', 'trading', 'technology'],
  science: ['technology', 'health-care', 'space'],
  gaming: ['technology', 'design', 'art'],
  art: ['design', 'gaming'],
  automotive: ['technology', 'space'],
  space: ['science', 'technology', 'automotive'],
};

export interface RelatedTrendCandidateInput {
  id: string;
  status: TrendStatus;
  isFallback: boolean;
  title: string;
  domainSlug: TrendzDomainSlug;
  domainName?: string;
  category?: string;
  summary?: string;
  whyItMatters?: string;
  keyTakeaways?: string[];
  tags?: string[];
  searchKeywords?: string[];
  relatedTrendIds?: string[];
  publisherName?: string;
  sourceDomain?: string;
  originalUrl?: string;
  canonicalUrl?: string;
  publishedAtIso?: string;
  sourceRetrievedAtIso?: string;
  sourceExcerpt?: string;
  sourceExcerptTruncated?: boolean;
  sourceExcerptCompleteness?: 'full_excerpt' | 'truncated' | 'unavailable';
  isSimulatedSource?: boolean;
}

function lightStemToken(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith('ies') && token.length > 5) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ing') && token.length > 6) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('es') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) return token.slice(0, -1);
  return token;
}

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractNormalizedTagSet(item: RelatedTrendCandidateInput): Set<string> {
  const out = new Set<string>();
  for (const tag of item.tags || []) {
    if (typeof tag !== 'string') continue;
    const norm = normalizeTag(tag);
    if (norm.length >= 2) out.add(norm);
  }
  return out;
}

function extractWeightedLexicalVector(item: RelatedTrendCandidateInput): Map<string, number> {
  const vec = new Map<string, number>();
  const addText = (text: string | undefined, weight: number) => {
    if (!text) return;
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((t) => t.replace(/^-+|-+$/g, ''))
      .filter((t) => t.length >= 3 && !RELATED_STOP_WORDS.has(t));
    for (const token of tokens) {
      const stem = lightStemToken(token);
      vec.set(stem, (vec.get(stem) || 0) + weight);
    }
  };

  addText(item.title, 3.0);
  addText(item.category, 2.0);
  addText(item.summary, 1.8);
  addText(item.whyItMatters, 1.2);
  for (const kw of item.searchKeywords || []) {
    addText(kw, 2.2);
  }
  for (const kt of (item.keyTakeaways || []).slice(0, 4)) {
    addText(kt, 1.0);
  }
  return vec;
}

function extractEntities(item: RelatedTrendCandidateInput): Set<string> {
  const entities = new Set<string>();
  const combined = `${item.title || ''}. ${item.summary || ''}. ${(item.tags || []).join(' ')}`;
  // Multi-word capitalized proper nouns or uppercase acronyms (e.g., NASA, CRISPR, OpenAI, Solid-State)
  const matches = combined.match(
    /\b(?:[A-Z]{2,}[0-9]*|[A-Z][a-z]+(?:\s+[A-Z][a-z0-9]+){1,2}|[A-Z][a-z]+[A-Z][a-zA-Z0-9]*)\b/g
  );
  if (matches) {
    for (const m of matches) {
      const norm = m.trim().toLowerCase();
      if (norm.length >= 2 && !RELATED_STOP_WORDS.has(norm) && !GENERIC_DOMAIN_TAGS.has(norm)) {
        entities.add(norm);
      }
    }
  }
  return entities;
}

function normalizeDedupeTitleKey(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function parseTimestampMs(iso: string | undefined): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function areDomainsInRelatedCluster(a: TrendzDomainSlug, b: TrendzDomainSlug): boolean {
  if (a === b) return true;
  return (RELATED_DOMAIN_CLUSTERS[a] || []).includes(b);
}

/**
 * Deterministic, multi-signal Related Trends ranking helper mirroring Phase 06.4's
 * `rankRelatedTrends` engine for server-side Contextual AI cross-trend discovery.
 *
 * Strictly enforces:
 * - Published records only (`status === 'published'`)
 * - Same data mode isolation (`live` vs `dev_fallback`)
 * - Excludes self and duplicate stories (matching normalized title or canonical URL)
 * - Meaningful topical signal gate (prevents unrelated same-domain filler from mixing in)
 */
export function rankRelatedCandidatesForAiContext(
  primary: RelatedTrendCandidateInput,
  candidates: RelatedTrendCandidateInput[],
  options: {
    maxCount?: number;
    minScore?: number;
    nowMs?: number;
  } = {}
): RawRelatedTrendInput[] {
  const maxCount = Math.max(1, Math.min(options.maxCount ?? SERVER_RELATED_TRENDS_MAX_RESULTS, 6));
  const minScore = options.minScore ?? SERVER_RELATED_TRENDS_MIN_SCORE;
  const nowMs = options.nowMs ?? Date.now();

  const sourceTags = extractNormalizedTagSet(primary);
  const sourceCategory = (primary.category || '').trim().toLowerCase();
  const sourceVector = extractWeightedLexicalVector(primary);
  const sourceEntities = extractEntities(primary);
  const sourceCuratedIds = new Set(
    (primary.relatedTrendIds || []).map((id) => String(id || '').trim()).filter(Boolean)
  );
  const sourceCanonicalUrl =
    canonicalizeSourceUrl(primary.canonicalUrl || primary.originalUrl || '') || null;
  const sourceTitleKey = normalizeDedupeTitleKey(primary.title);
  const sourceHost =
    (primary.sourceDomain || '').trim().toLowerCase() || extractHostname(primary.originalUrl);
  const sourcePublisher = (primary.publisherName || '').trim().toLowerCase();
  const sourcePublishedMs = parseTimestampMs(primary.publishedAtIso) || nowMs;

  let sourceNormSq = 0;
  for (const val of sourceVector.values()) {
    sourceNormSq += val * val;
  }
  const sourceNorm = Math.sqrt(sourceNormSq);

  const seenIds = new Set<string>([primary.id.trim()]);
  const scored: Array<{ score: number; candidate: RelatedTrendCandidateInput; reasons: string[] }> = [];

  for (const cand of candidates) {
    if (!cand || typeof cand.id !== 'string' || !cand.id.trim()) continue;
    const candId = cand.id.trim();
    if (seenIds.has(candId)) continue;
    if (cand.status !== 'published') continue;
    if (Boolean(cand.isFallback) !== Boolean(primary.isFallback)) continue;
    seenIds.add(candId);

    const candCanonicalUrl =
      canonicalizeSourceUrl(cand.canonicalUrl || cand.originalUrl || '') || null;
    const candTitleKey = normalizeDedupeTitleKey(cand.title);
    if (
      (sourceTitleKey && candTitleKey && candTitleKey === sourceTitleKey) ||
      (sourceCanonicalUrl && candCanonicalUrl && candCanonicalUrl === sourceCanonicalUrl)
    ) {
      continue;
    }

    const candTags = extractNormalizedTagSet(cand);
    const candCategory = (cand.category || '').trim().toLowerCase();
    const candVector = extractWeightedLexicalVector(cand);
    const candEntities = extractEntities(cand);

    // 1. Shared topics & tags (0..38)
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
    let crossTagHits = 0;
    for (const tag of sourceTags) {
      if (GENERIC_DOMAIN_TAGS.has(tag) || candTags.has(tag)) continue;
      const parts = tag.split('-').filter((p) => p.length >= 4 && !RELATED_STOP_WORDS.has(p));
      if (parts.some((p) => candVector.has(lightStemToken(p)))) {
        crossTagHits += 1;
      }
    }
    if (crossTagHits > 0) {
      tagScore += Math.min(10, crossTagHits * 5);
    }
    tagScore = Math.min(38, tagScore);

    // 2. Shared entities (0..26)
    const matchedTagLower = new Set(
      [...matchedSpecificTags, ...matchedGenericTags].map((t) => t.replace(/-/g, ' '))
    );
    const matchedEntities: string[] = [];
    let entityScore = 0;
    for (const entity of sourceEntities) {
      if (!candEntities.has(entity)) continue;
      matchedEntities.push(entity);
      if (matchedTagLower.has(entity)) {
        entityScore += 4;
      } else if (entity.includes(' ')) {
        entityScore += 12;
      } else {
        entityScore += 8;
      }
    }
    entityScore = Math.min(26, entityScore);

    // 3. Lexical cosine + overlap (0..24)
    let dot = 0;
    let candNormSq = 0;
    for (const val of candVector.values()) {
      candNormSq += val * val;
    }
    const matchedTerms: string[] = [];
    for (const [stem, sw] of sourceVector.entries()) {
      const cw = candVector.get(stem);
      if (cw !== undefined) {
        dot += sw * cw;
        matchedTerms.push(stem);
      }
    }
    const candNorm = Math.sqrt(candNormSq);
    const cosineSim = sourceNorm > 0 && candNorm > 0 ? dot / (sourceNorm * candNorm) : 0;
    const distinctOutsideTags = matchedTerms.filter((t) => !matchedTagLower.has(t));
    const textScore = Number(
      Math.min(24, cosineSim * 28 + Math.min(12, distinctOutsideTags.length * 3.5)).toFixed(2)
    );

    // 4. Domain & category similarity (0..18)
    const sameDomain = cand.domainSlug === primary.domainSlug;
    const sameSpecificCategory = Boolean(
      sourceCategory && candCategory && sourceCategory === candCategory
    );
    const relatedCluster = areDomainsInRelatedCluster(primary.domainSlug, cand.domainSlug);
    let domainCategoryScore = 0;
    if (sameSpecificCategory) domainCategoryScore += 10;
    if (sameDomain) domainCategoryScore += 8;
    else if (relatedCluster) domainCategoryScore += 4;
    domainCategoryScore = Math.min(18, domainCategoryScore);

    // 5. Curated editorial links & source relationship (0..20)
    const isCuratedLink =
      sourceCuratedIds.has(candId) ||
      (Array.isArray(cand.relatedTrendIds) && cand.relatedTrendIds.includes(primary.id));

    const candHost =
      (cand.sourceDomain || '').trim().toLowerCase() || extractHostname(cand.originalUrl);
    const candPublisher = (cand.publisherName || '').trim().toLowerCase();
    const sharedSourceRelation =
      Boolean(sourceHost && candHost && sourceHost === candHost) ||
      Boolean(
        sourcePublisher &&
          candPublisher &&
          sourcePublisher === candPublisher &&
          sourcePublisher !== 'invox desk'
      );

    let sourceCuratedScore = 0;
    if (isCuratedLink) sourceCuratedScore += 15;
    if (sharedSourceRelation) sourceCuratedScore += 6;
    sourceCuratedScore = Math.min(20, sourceCuratedScore);

    // 6. Bounded publication recency & proximity (0..8)
    const candPublishedMs = parseTimestampMs(cand.publishedAtIso);
    const ageDays = candPublishedMs > 0 ? Math.max(0, (nowMs - candPublishedMs) / 86_400_000) : 30;
    const deltaDays =
      candPublishedMs > 0 ? Math.abs(sourcePublishedMs - candPublishedMs) / 86_400_000 : 30;
    const recencyScore = Number(
      Math.min(
        8,
        (ageDays <= 180 ? 5 / (1 + ageDays / 30) : 0) +
          (deltaDays <= 90 ? 3 / (1 + deltaDays / 14) : 0)
      ).toFixed(2)
    );

    // Topical relevance gate: prevents pure same-domain or recency padding
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
        sourceCuratedScore +
        recencyScore
      ).toFixed(2)
    );

    if (!hasMeaningfulTopicalSignal || totalScore < minScore) {
      continue;
    }

    const reasons: string[] = [];
    if (isCuratedLink) reasons.push('Curated related briefing');
    if (matchedSpecificTags.length > 0) reasons.push(`Shared topic: #${matchedSpecificTags[0]}`);
    if (matchedEntities.length > 0 && !matchedSpecificTags.includes(matchedEntities[0])) {
      reasons.push(`Shared entity: ${matchedEntities[0]}`);
    }
    if (sameSpecificCategory) reasons.push(`Same category: ${cand.category}`);
    if (reasons.length === 0 && textScore >= 6) reasons.push('Topical lexical overlap');

    scored.push({
      score: totalScore,
      candidate: cand,
      reasons: reasons.slice(0, 3),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxCount).map(({ score, candidate, reasons }) => ({
    id: candidate.id,
    title: candidate.title,
    domainSlug: candidate.domainSlug,
    domainName: candidate.domainName,
    category: candidate.category,
    summary: candidate.summary,
    whyItMatters: candidate.whyItMatters,
    keyTakeaways: candidate.keyTakeaways,
    tags: candidate.tags,
    publisherName: candidate.publisherName,
    sourceDomain: candidate.sourceDomain,
    originalUrl: candidate.originalUrl,
    publishedAtIso: candidate.publishedAtIso,
    sourceRetrievedAtIso: candidate.sourceRetrievedAtIso,
    sourceExcerpt: candidate.sourceExcerpt,
    sourceExcerptTruncated: candidate.sourceExcerptTruncated,
    sourceExcerptCompleteness: candidate.sourceExcerptCompleteness,
    isSimulatedSource: candidate.isSimulatedSource,
    relationReasons: reasons,
    relevanceScore: score,
    status: 'published',
    isFallback: candidate.isFallback,
  }));
}

/**
 * Converts a `FallbackSampleTrendData` sample record into a candidate for
 * `rankRelatedCandidatesForAiContext`, strictly isolated to `DEV_FALLBACK` mode.
 */
export function fallbackSampleToRelatedCandidate(
  sample: FallbackSampleTrendData
): RelatedTrendCandidateInput {
  return {
    id: sample.id,
    status: sample.status,
    isFallback: true,
    title: sample.title,
    domainSlug: sample.domainSlug,
    domainName: sample.domainName,
    category: sample.category,
    summary: sample.summary,
    whyItMatters: sample.whyItMatters,
    keyTakeaways: sample.keyTakeaways,
    tags: sample.tags,
    searchKeywords: sample.searchKeywords,
    relatedTrendIds: sample.relatedTrendIds,
    publisherName: sample.publishedBy,
    sourceDomain: sample.sourceDomain,
    originalUrl: sample.sourceUrl,
    canonicalUrl: sample.canonicalUrl,
    publishedAtIso: sample.publishedAtIso,
    sourceExcerpt: sample.sourceExcerpt,
    sourceExcerptTruncated: sample.sourceExcerptTruncated,
    sourceExcerptCompleteness: sample.sourceExcerptCompleteness,
    isSimulatedSource: true,
  };
}

/**
 * Discovers relevant published sample related trends for a `DEV_FALLBACK` trend
 * using the exact multi-signal topical relevance engine (strictly sample-only).
 */
export function discoverFallbackRelatedTrendsForAi(
  sample: FallbackSampleTrendData,
  maxCount = SERVER_RELATED_TRENDS_MAX_RESULTS
): RawRelatedTrendInput[] {
  const primary = fallbackSampleToRelatedCandidate(sample);
  const candidates = TRENDZ_FALLBACK_SAMPLE_DATA.filter(
    (item) => item.id !== sample.id && item.status === 'published'
  ).map(fallbackSampleToRelatedCandidate);

  return rankRelatedCandidatesForAiContext(primary, candidates, { maxCount });
}

/**
 * Converts a decoded live Firestore `/trendz/{id}` document into a related candidate.
 * Strictly returns `null` if the document is not `'published'` or lacks a title.
 */
export function liveRawDocToRelatedCandidate(
  trendId: string,
  rawDoc: Record<string, unknown>
): RelatedTrendCandidateInput | null {
  const rawStatus = typeof rawDoc.status === 'string' ? rawDoc.status.trim() : '';
  if (rawStatus !== 'published') return null;

  const title = typeof rawDoc.title === 'string' ? rawDoc.title.trim() : '';
  if (!title) return null;

  const sourceObj =
    rawDoc.source && typeof rawDoc.source === 'object'
      ? (rawDoc.source as Record<string, unknown>)
      : {};
  const detailsObj =
    rawDoc.details && typeof rawDoc.details === 'object'
      ? (rawDoc.details as Record<string, unknown>)
      : {};

  const domainSlug =
    normalizeServerDomainSlug(typeof rawDoc.domainSlug === 'string' ? rawDoc.domainSlug : undefined) ||
    normalizeServerDomainSlug(typeof rawDoc.domain === 'string' ? rawDoc.domain : undefined) ||
    'technology';

  const rawCompleteness = rawDoc.sourceExcerptCompleteness;
  const sourceExcerptCompleteness =
    rawCompleteness === 'full_excerpt' ||
    rawCompleteness === 'truncated' ||
    rawCompleteness === 'unavailable'
      ? rawCompleteness
      : undefined;

  return {
    id: trendId.trim(),
    status: 'published',
    isFallback: false,
    title,
    domainSlug,
    domainName: typeof rawDoc.domain === 'string' ? rawDoc.domain : undefined,
    category: typeof rawDoc.category === 'string' ? rawDoc.category : undefined,
    summary: typeof rawDoc.summary === 'string' ? rawDoc.summary : undefined,
    whyItMatters: typeof rawDoc.whyItMatters === 'string' ? rawDoc.whyItMatters : undefined,
    keyTakeaways: Array.isArray(rawDoc.keyTakeaways)
      ? rawDoc.keyTakeaways.filter((x): x is string => typeof x === 'string')
      : [],
    tags: Array.isArray(rawDoc.tags)
      ? rawDoc.tags.filter((x): x is string => typeof x === 'string')
      : [],
    searchKeywords: Array.isArray(rawDoc.searchKeywords)
      ? rawDoc.searchKeywords.filter((x): x is string => typeof x === 'string')
      : [],
    relatedTrendIds: Array.isArray(rawDoc.relatedTrendIds)
      ? rawDoc.relatedTrendIds.filter((x): x is string => typeof x === 'string')
      : [],
    publisherName:
      (typeof sourceObj.name === 'string' && sourceObj.name) ||
      (typeof detailsObj.publishedBy === 'string' && detailsObj.publishedBy) ||
      undefined,
    sourceDomain: typeof sourceObj.domain === 'string' ? sourceObj.domain : undefined,
    originalUrl:
      (typeof sourceObj.url === 'string' && sourceObj.url) ||
      (typeof detailsObj.link === 'string' && detailsObj.link) ||
      undefined,
    canonicalUrl: typeof rawDoc.canonicalUrl === 'string' ? rawDoc.canonicalUrl : undefined,
    publishedAtIso:
      (typeof rawDoc.publishedAt === 'string' && rawDoc.publishedAt) ||
      (typeof rawDoc.createdAt === 'string' && rawDoc.createdAt) ||
      undefined,
    sourceRetrievedAtIso:
      typeof rawDoc.sourceRetrievedAt === 'string' ? rawDoc.sourceRetrievedAt : undefined,
    sourceExcerpt: typeof rawDoc.sourceExcerpt === 'string' ? rawDoc.sourceExcerpt : undefined,
    sourceExcerptTruncated: rawDoc.sourceExcerptTruncated === true,
    sourceExcerptCompleteness,
    isSimulatedSource: rawDoc.isSimulatedSource === true,
  };
}
