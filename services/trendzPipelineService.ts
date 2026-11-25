import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  TrendAdditionalSource,
  TrendCorroboratingSource,
  TrendIngestionItem,
  TrendIngestionRun,
  TrendIngestionStage,
  TrendMedia,
  TrendRecord,
  TrendSourceProviderSummary,
} from '../types';
import {
  formatTrendzDomainName,
  normalizeTrendzDomainSlug,
  type TrendzDomainSlug,
} from '../utils/trendzDomains';
import { sanitizeExternalUrl } from '../utils/urlSanitizer';
import { fetchPublishedTrendsPage } from './trendzService';

const RUNS_COLLECTION = 'trendIngestionRuns';
const ITEMS_COLLECTION = 'trendIngestionItems';
const TRENDZ_COLLECTION = 'trendz';

export interface PipelineProvidersInfo {
  providers: TrendSourceProviderSummary[];
  domains: Array<{ slug: TrendzDomainSlug; name: string }>;
  models: string[];
  lock: { runId: string; startedAtMs: number; triggeredBy: string } | null;
  aiThumbnailsEnabled: boolean;
}

export interface EditorialApprovalEdits {
  title: string;
  summary: string;
  fullContent: string;
  whyItMatters: string;
  keyTakeaways: string[];
  domainSlug: TrendzDomainSlug;
  category: string;
  tags: string[];
  mediaUrl: string;
  mediaAttribution?: string;
}

interface PipelineApiRunResponse {
  run: TrendIngestionRun;
  items: TrendIngestionItem[];
  corroborationUpdates?: Array<{
    targetKind: 'published_trend' | 'ingestion_item';
    targetId: string;
    corroboratingSource: TrendCorroboratingSource;
  }>;
}

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in as an administrator to run Trendz pipeline actions.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Recursively strips undefined keys so Firestore setDoc/updateDoc never rejects optional fields.
 */
function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (
    input &&
    typeof input === 'object' &&
    !(input instanceof Timestamp) &&
    !(input instanceof Date) &&
    Object.getPrototypeOf(input) === Object.prototype
  ) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      if (v !== undefined) {
        clean[k] = stripUndefinedDeep(v);
      }
    }
    return clean as T;
  }
  return input;
}

function buildSlugFromTitle(title: string, urlHash: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 110)
    .replace(/^-|-$/g, '');
  return `${base || 'trend-signal'}-${urlHash.slice(0, 8)}`.slice(0, 160);
}

/**
 * Deterministic published trend ID derived from canonical source urlHash to prevent duplicates.
 */
export function buildPublishedTrendId(urlHash: string): string {
  return `trend_${urlHash.slice(0, 24)}`;
}

/**
 * Fetches server-side source provider statuses, Gemini fallback chain, and active lock status.
 */
export async function fetchPipelineProvidersInfo(): Promise<PipelineProvidersInfo> {
  const headers = await getAdminAuthHeaders();
  const response = await fetch('/api/admin/trendz/providers', {
    method: 'GET',
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to load pipeline providers (HTTP ${response.status}).`);
  }
  return data as PipelineProvidersInfo;
}

/**
 * Loads recent ingestion runs from Firestore (admin/moderator-only collection).
 */
export async function fetchTrendIngestionRuns(maxResults = 20): Promise<TrendIngestionRun[]> {
  try {
    const q = query(
      collection(db, RUNS_COLLECTION),
      orderBy('startedAt', 'desc'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as TrendIngestionRun), id: d.id }));
  } catch {
    const snap = await getDocs(query(collection(db, RUNS_COLLECTION), limit(maxResults)));
    return snap.docs
      .map((d) => ({ ...(d.data() as TrendIngestionRun), id: d.id }))
      .sort((a, b) => Date.parse(b.startedAt || '') - Date.parse(a.startedAt || ''));
  }
}

/**
 * Loads staged editorial review items from Firestore (admin/moderator-only collection).
 */
export async function fetchTrendIngestionItems(options?: {
  stage?: TrendIngestionStage | 'ALL';
  maxResults?: number;
}): Promise<TrendIngestionItem[]> {
  const maxResults = options?.maxResults ?? 60;
  const stage = options?.stage ?? 'ALL';

  try {
    const q =
      stage !== 'ALL'
        ? query(
            collection(db, ITEMS_COLLECTION),
            where('stage', '==', stage),
            orderBy('updatedAtIso', 'desc'),
            limit(maxResults)
          )
        : query(
            collection(db, ITEMS_COLLECTION),
            orderBy('updatedAtIso', 'desc'),
            limit(maxResults)
          );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as TrendIngestionItem), id: d.id }));
  } catch {
    // Graceful client-side sort fallback while composite indexes are deploying
    const snap = await getDocs(query(collection(db, ITEMS_COLLECTION), limit(maxResults * 2)));
    const all = snap.docs.map((d) => ({ ...(d.data() as TrendIngestionItem), id: d.id }));
    const filtered = stage === 'ALL' ? all : all.filter((item) => item.stage === stage);
    return filtered
      .sort((a, b) => Date.parse(b.updatedAtIso || '') - Date.parse(a.updatedAtIso || ''))
      .slice(0, maxResults);
  }
}

/**
 * Collects existing published trends and staged items so the server-side pipeline can
 * perform cross-run deduplication and ground `relatedTrendIds` against real published records.
 */
async function collectDedupeAndRelatedContext() {
  const [publishedPage, existingItems] = await Promise.all([
    fetchPublishedTrendsPage({ pageSize: 40, sortBy: 'latest' }).catch(() => ({
      items: [],
      records: [],
      lastDoc: null,
      hasMore: false,
    })),
    fetchTrendIngestionItems({ stage: 'ALL', maxResults: 100 }).catch(() => []),
  ]);

  const existingCandidates = [
    ...publishedPage.records.map((r) => ({
      id: r.id,
      kind: 'published_trend' as const,
      urlHash: r.source.urlHash,
      canonicalUrl: r.source.url,
      title: r.title,
      contentHash: r.contentHash,
      excerpt: r.summary,
    })),
    ...existingItems
      .filter((i) => i.stage !== 'REJECTED')
      .map((i) => ({
        id: i.id,
        kind: 'ingestion_item' as const,
        urlHash: i.source.urlHash,
        canonicalUrl: i.source.canonicalUrl,
        title: i.aiDraft?.title || i.source.rawTitle,
        contentHash: i.source.contentHash,
        excerpt: i.source.sanitizedExcerpt.slice(0, 500),
      })),
  ];

  const existingPublishedTrends = publishedPage.records.map((r) => ({
    id: r.id,
    title: r.title,
    domainSlug: r.domainSlug,
    tags: r.tags,
  }));

  return { existingCandidates, existingPublishedTrends };
}

/**
 * Persists server-produced run log, staged items, and corroborating source updates into Firestore.
 */
async function persistPipelineOutput(result: PipelineApiRunResponse): Promise<void> {
  const runRef = doc(db, RUNS_COLLECTION, result.run.id);
  await setDoc(
    runRef,
    stripUndefinedDeep({
      ...result.run,
      updatedAt: serverTimestamp(),
    })
  );

  for (const item of result.items) {
    const itemRef = doc(db, ITEMS_COLLECTION, item.id);
    await setDoc(
      itemRef,
      stripUndefinedDeep({
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  }

  // Merge corroborating sources onto matching staged ingestion items (never mutating published records silently)
  for (const update of result.corroborationUpdates || []) {
    if (update.targetKind !== 'ingestion_item') continue;
    try {
      const targetRef = doc(db, ITEMS_COLLECTION, update.targetId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(targetRef);
        if (!snap.exists()) return;
        const current = snap.data() as TrendIngestionItem;
        const existingSources = Array.isArray(current.corroboratingSources)
          ? current.corroboratingSources
          : [];
        if (existingSources.some((s) => s.urlHash === update.corroboratingSource.urlHash)) return;
        const merged = [...existingSources, update.corroboratingSource].slice(0, 15);
        tx.update(targetRef, {
          corroboratingSources: stripUndefinedDeep(merged),
          updatedAtIso: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.warn('[TRENDZ_PIPELINE] Failed to merge corroborating source:', err);
    }
  }
}

/**
 * Triggers a controlled server-side Trendz ingestion run and saves staged results to Firestore.
 */
export async function triggerManualIngestionRun(params: {
  domains: TrendzDomainSlug[];
  windowHours: number;
  maxItemsPerDomain: number;
  providerIds?: string[];
}): Promise<PipelineApiRunResponse> {
  const headers = await getAdminAuthHeaders();
  const { existingCandidates, existingPublishedTrends } = await collectDedupeAndRelatedContext();

  const response = await fetch('/api/admin/trendz/ingest', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      domains: params.domains,
      windowHours: params.windowHours,
      maxItemsPerDomain: params.maxItemsPerDomain,
      providerIds: params.providerIds,
      existingCandidates,
      existingPublishedTrends,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Ingestion run failed (HTTP ${response.status}).`);
  }

  const output = data as PipelineApiRunResponse;
  await persistPipelineOutput(output);
  return output;
}

/**
 * Submits a single verified external article URL for server-side validation and AI synthesis.
 */
export async function triggerSingleUrlIngestion(params: {
  url: string;
  domainSlug: TrendzDomainSlug;
}): Promise<PipelineApiRunResponse> {
  const headers = await getAdminAuthHeaders();
  const { existingCandidates, existingPublishedTrends } = await collectDedupeAndRelatedContext();

  const response = await fetch('/api/admin/trendz/process-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: params.url.trim(),
      domainSlug: params.domainSlug,
      existingCandidates,
      existingPublishedTrends,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Failed to process URL (HTTP ${response.status}).`);
  }

  const output = data as PipelineApiRunResponse;
  await persistPipelineOutput(output);
  return output;
}

/**
 * Safely retries a FAILED ingestion item on the server and persists its updated stage to Firestore.
 */
export async function retryTrendIngestionItem(item: TrendIngestionItem): Promise<TrendIngestionItem> {
  const headers = await getAdminAuthHeaders();
  const { existingPublishedTrends } = await collectDedupeAndRelatedContext();

  const response = await fetch('/api/admin/trendz/retry-item', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      item,
      existingPublishedTrends,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Retry failed (HTTP ${response.status}).`);
  }

  const updated = data.item as TrendIngestionItem;
  await setDoc(
    doc(db, ITEMS_COLLECTION, updated.id),
    stripUndefinedDeep({
      ...updated,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );

  return updated;
}

/**
 * Pure builder that constructs a strict Firestore-rules-compliant TrendRecord payload
 * from a reviewed TrendIngestionItem and admin edits (also testable in unit tests).
 */
export function buildPublishedTrendRecordPayload(params: {
  item: TrendIngestionItem;
  edits: EditorialApprovalEdits;
  reviewerUid: string;
  publishedAtTimestamp: Timestamp;
  discoveredAtTimestamp: Timestamp;
  retrievedAtTimestamp: Timestamp;
  createdAtField: any;
  updatedAtField: any;
  reviewedAtField: any;
}): Omit<TrendRecord, 'createdAt' | 'updatedAt' | 'reviewedAt'> & {
  createdAt: any;
  updatedAt: any;
  reviewedAt: any;
} {
  const { item, edits, reviewerUid } = params;
  const domainSlug = normalizeTrendzDomainSlug(edits.domainSlug) || item.domainSlug;
  const domainName = formatTrendzDomainName(domainSlug);
  const trendId = buildPublishedTrendId(item.source.urlHash);

  const safeTitle = edits.title.trim().slice(0, 240);
  const safeSummary = edits.summary.trim().slice(0, 1200);
  const safeFullContent = edits.fullContent.trim().slice(0, 20000);
  const safeWhyItMatters = edits.whyItMatters.trim().slice(0, 1200);

  if (safeTitle.length < 3) {
    throw new Error('Title must be at least 3 characters.');
  }
  if (safeSummary.length < 10) {
    throw new Error('Summary must be at least 10 characters.');
  }
  if (safeFullContent.length < 10) {
    throw new Error('Full content must be at least 10 characters.');
  }

  const safeSourceUrl = sanitizeExternalUrl(item.source.canonicalUrl || item.source.originalUrl);
  if (!safeSourceUrl) {
    throw new Error('Cannot publish a trend without a verified HTTP/HTTPS original source URL.');
  }

  const safeMediaUrl =
    sanitizeExternalUrl(edits.mediaUrl) || sanitizeExternalUrl(item.media.url);
  if (!safeMediaUrl) {
    throw new Error('A valid HTTP/HTTPS media URL is required.');
  }

  const media: TrendMedia = {
    type: 'image',
    url: safeMediaUrl,
    thumbnailUrl: safeMediaUrl,
    origin: item.media.origin,
    ...(edits.mediaAttribution?.trim()
      ? { attribution: edits.mediaAttribution.trim().slice(0, 300) }
      : item.media.attribution
        ? { attribution: item.media.attribution.slice(0, 300) }
        : {}),
    ...(item.media.storagePath ? { storagePath: item.media.storagePath.slice(0, 512) } : {}),
  };

  const cleanTags = Array.from(
    new Set(
      edits.tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40)
    )
  ).slice(0, 10);

  const cleanTakeaways = edits.keyTakeaways
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .slice(0, 10);

  const searchKeywords = Array.from(
    new Set([
      ...(item.aiDraft?.searchKeywords || []),
      ...cleanTags,
      domainSlug,
      domainName.toLowerCase(),
      item.source.name.toLowerCase(),
      ...safeTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3),
    ])
  ).slice(0, 40);

  const additionalSources: TrendAdditionalSource[] = (item.corroboratingSources || [])
    .filter((c) => Boolean(sanitizeExternalUrl(c.url)))
    .slice(0, 10)
    .map((c) => {
      const ms = Date.parse(c.publishedAtIso);
      return {
        name: c.name.slice(0, 140),
        url: sanitizeExternalUrl(c.url)!,
        publishedAt: Timestamp.fromMillis(Number.isNaN(ms) ? Date.now() : ms),
      };
    });

  return stripUndefinedDeep({
    id: trendId,
    slug: buildSlugFromTitle(safeTitle, item.source.urlHash),
    status: 'published' as const,
    domainSlug,
    domain: domainName,
    category: (edits.category.trim() || domainName).slice(0, 80),
    tags: cleanTags,
    searchKeywords,
    title: safeTitle,
    summary: safeSummary,
    fullContent: safeFullContent,
    keyTakeaways: cleanTakeaways,
    source: {
      name: item.source.name.slice(0, 160),
      domain: item.source.domain.slice(0, 255),
      url: safeSourceUrl,
      urlHash: item.source.urlHash.slice(0, 128),
      ...(item.source.author ? { author: item.source.author.slice(0, 160) } : {}),
      credibilityTier: item.source.credibilityTier,
    },
    ...(additionalSources.length > 0 ? { additionalSources } : {}),
    publishedAt: params.publishedAtTimestamp,
    discoveredAt: params.discoveredAtTimestamp,
    createdAt: params.createdAtField,
    updatedAt: params.updatedAtField,
    media,
    momentumScore: Math.max(1, Number(item.aiDraft?.momentumScore ?? 50)),
    relatedTrendIds: (item.aiDraft?.relatedTrendIds || []).slice(0, 10),
    stats: {
      likes: 0,
      views: 0,
      comments: 0,
      saves: 0,
      shares: 0,
    },
    schemaVersion: 2,
    ...(item.aiDraft?.aiModel ? { aiModel: item.aiDraft.aiModel.slice(0, 100) } : {}),
    ...(item.source.contentHash ? { contentHash: item.source.contentHash.slice(0, 128) } : {}),
    language: 'en',
    ...(safeWhyItMatters ? { whyItMatters: safeWhyItMatters } : {}),
    sourceRetrievedAt: params.retrievedAtTimestamp,
    ingestionRunId: item.runId.slice(0, 128),
    ingestionItemId: item.id.slice(0, 128),
    reviewedBy: reviewerUid.slice(0, 128),
    reviewedAt: params.reviewedAtField,
    groundingStatus:
      item.aiDraft?.evidenceStatus === 'insufficient' ? ('needs_review' as const) : ('verified' as const),
  });
}

/**
 * Atomically approves and publishes a reviewed TrendIngestionItem into `/trendz/{trendId}`.
 * Uses deterministic trend ID + Firestore transaction to guarantee idempotency and zero duplicates.
 * Transitions stage history through APPROVED -> PUBLISHED.
 */
export async function approveAndPublishTrendItem(params: {
  item: TrendIngestionItem;
  edits: EditorialApprovalEdits;
  reviewerUid: string;
  reviewerEmail?: string;
}): Promise<{ trendId: string; alreadyPublished: boolean }> {
  const { item, edits, reviewerUid, reviewerEmail } = params;
  if (item.stage !== 'PENDING_REVIEW' && item.stage !== 'APPROVED') {
    throw new Error(`Item cannot be published from stage '${item.stage}'.`);
  }

  const trendId = buildPublishedTrendId(item.source.urlHash);
  const trendRef = doc(db, TRENDZ_COLLECTION, trendId);
  const itemRef = doc(db, ITEMS_COLLECTION, item.id);

  const pubMs = Date.parse(item.source.publishedAtIso);
  const discMs = Date.parse(item.createdAtIso);
  const retMs = Date.parse(item.source.retrievedAtIso);

  const publishedAtTs = Timestamp.fromMillis(Number.isNaN(pubMs) ? Date.now() : pubMs);
  const discoveredAtTs = Timestamp.fromMillis(Number.isNaN(discMs) ? Date.now() : discMs);
  const retrievedAtTs = Timestamp.fromMillis(Number.isNaN(retMs) ? Date.now() : retMs);

  const trendPayload = buildPublishedTrendRecordPayload({
    item,
    edits,
    reviewerUid,
    publishedAtTimestamp: publishedAtTs,
    discoveredAtTimestamp: discoveredAtTs,
    retrievedAtTimestamp: retrievedAtTs,
    createdAtField: serverTimestamp(),
    updatedAtField: serverTimestamp(),
    reviewedAtField: serverTimestamp(),
  });

  let alreadyPublished = false;

  await runTransaction(db, async (tx) => {
    const existingTrendSnap = await tx.get(trendRef);
    const nowIso = new Date().toISOString();

    if (existingTrendSnap.exists()) {
      alreadyPublished = true;
    } else {
      tx.set(trendRef, trendPayload);
    }

    const updatedHistory = [
      ...(item.stageHistory || []),
      { stage: 'APPROVED' as const, timestamp: nowIso, note: `Approved by ${reviewerEmail || reviewerUid}` },
      {
        stage: 'PUBLISHED' as const,
        timestamp: nowIso,
        note: alreadyPublished
          ? `Linked to already-published trend ${trendId} (idempotent)`
          : `Published to /trendz/${trendId}`,
      },
    ].slice(-40);

    tx.set(
      itemRef,
      stripUndefinedDeep({
        ...item,
        stage: 'PUBLISHED' as const,
        stageHistory: updatedHistory,
        domainSlug: trendPayload.domainSlug,
        publishedTrendId: trendId,
        reviewedBy: reviewerUid,
        reviewedByEmail: reviewerEmail,
        reviewedAtIso: nowIso,
        updatedAtIso: nowIso,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  });

  return { trendId, alreadyPublished };
}

/**
 * Rejects an ingestion item so it never enters the public Trendz feed.
 */
export async function rejectTrendIngestionItem(params: {
  item: TrendIngestionItem;
  reason: string;
  reviewerUid: string;
  reviewerEmail?: string;
}): Promise<void> {
  const { item, reason, reviewerUid, reviewerEmail } = params;
  const nowIso = new Date().toISOString();
  const cleanReason = reason.trim().slice(0, 400) || 'Rejected during editorial review.';

  const updatedHistory = [
    ...(item.stageHistory || []),
    {
      stage: 'REJECTED' as const,
      timestamp: nowIso,
      note: `${cleanReason} (${reviewerEmail || reviewerUid})`.slice(0, 300),
    },
  ].slice(-40);

  await updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
    stage: 'REJECTED',
    stageHistory: updatedHistory,
    rejectionReason: cleanReason,
    reviewedBy: reviewerUid,
    ...(reviewerEmail ? { reviewedByEmail: reviewerEmail } : {}),
    reviewedAtIso: nowIso,
    updatedAtIso: nowIso,
    updatedAt: serverTimestamp(),
  });
}
