import crypto from 'crypto';
import type {
  TrendCorroboratingSource,
  TrendIngestionItem,
  TrendIngestionRun,
  TrendIngestionStage,
  TrendIngestionStageEntry,
} from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import {
  SERVER_TRENDZ_DOMAIN_SLUGS,
  getServerDomainMeta,
  normalizeServerDomainSlug,
} from './domainCatalog';
import {
  type DiscoveredSourceCandidate,
  getActiveSourceProviders,
} from './sourceProviders';
import {
  type DuplicateCheckCandidate,
  type ValidatedSourceContent,
  canonicalizeSourceUrl,
  computeContentHash,
  computeUrlHash,
  fetchAndValidateSource,
  findDuplicateOrCorroboratingMatch,
  resolveCredibilityTier,
} from './sourceValidation';
import {
  type ExistingPublishedTrendContext,
  processValidatedSourceWithGemini,
} from './geminiTrendProcessor';
import { resolveTrendEditorialMedia } from './thumbnailGenerator';

// In-process concurrency guard preventing overlapping ingestion runs from duplicating processing
let activeIngestionLock: { runId: string; startedAtMs: number; triggeredBy: string } | null = null;
const LOCK_STALE_TIMEOUT_MS = 5 * 60_000;

export function isIngestionLocked(): boolean {
  if (!activeIngestionLock) return false;
  if (Date.now() - activeIngestionLock.startedAtMs > LOCK_STALE_TIMEOUT_MS) {
    activeIngestionLock = null;
    return false;
  }
  return true;
}

export function getActiveIngestionLockInfo() {
  if (!isIngestionLocked()) return null;
  return { ...activeIngestionLock! };
}

function acquireIngestionLock(runId: string, triggeredBy: string): boolean {
  if (isIngestionLocked()) return false;
  activeIngestionLock = { runId, startedAtMs: Date.now(), triggeredBy };
  return true;
}

function releaseIngestionLock(runId: string): void {
  if (activeIngestionLock?.runId === runId) {
    activeIngestionLock = null;
  }
}

export function createRunId(): string {
  const rand = crypto.randomBytes(4).toString('hex');
  return `run_${Date.now()}_${rand}`;
}

export function createDeterministicItemId(urlHash: string): string {
  return `job_${urlHash.slice(0, 24)}`;
}

export function createDeterministicTrendId(urlHash: string): string {
  return `trend_${urlHash.slice(0, 24)}`;
}

function pushStage(
  history: TrendIngestionStageEntry[],
  stage: TrendIngestionStage,
  note?: string
): TrendIngestionStageEntry[] {
  return [
    ...history,
    {
      stage,
      timestamp: new Date().toISOString(),
      ...(note ? { note: note.slice(0, 300) } : {}),
    },
  ];
}

export interface RunPipelineParams {
  triggeredBy: string;
  triggeredByEmail?: string;
  triggerMode?: 'manual' | 'single_url' | 'scheduled';
  domains: TrendzDomainSlug[];
  windowHours: number;
  maxItemsPerDomain: number;
  providerIds?: string[];
  existingCandidates?: DuplicateCheckCandidate[];
  existingPublishedTrends?: ExistingPublishedTrendContext[];
  /** Optional injected candidates or executors for deterministic testing */
  injectedCandidates?: DiscoveredSourceCandidate[];
  customSourceValidator?: typeof fetchAndValidateSource;
  customModelExecutor?: (params: {
    model: string;
    contents: string;
    config: Record<string, any>;
  }) => Promise<{ text?: string }>;
  customAiImageGenerator?: (prompt: string) => Promise<{ imageUrl?: string; storagePath?: string } | null>;
}

export interface RunPipelineOutput {
  run: TrendIngestionRun;
  items: TrendIngestionItem[];
  corroborationUpdates: Array<{
    targetKind: 'published_trend' | 'ingestion_item';
    targetId: string;
    corroboratingSource: TrendCorroboratingSource;
  }>;
}

/**
 * Executes the multi-stage Trendz AI Intelligence Pipeline:
 * DISCOVERED -> VALIDATING -> VALIDATED -> PROCESSING -> PENDING_REVIEW (or FAILED).
 * Never auto-publishes items; every succeeded item awaits editorial review.
 */
export async function runTrendzIngestionPipeline(params: RunPipelineParams): Promise<RunPipelineOutput> {
  const runId = createRunId();
  if (!acquireIngestionLock(runId, params.triggeredBy)) {
    const err: any = new Error(
      `Another Trendz ingestion run (${activeIngestionLock?.runId}) is already in progress. Wait for completion before starting a new run.`
    );
    err.statusCode = 409;
    throw err;
  }

  const startedAt = new Date().toISOString();
  const normalizedDomains = Array.from(
    new Set(
      params.domains
        .map((d) => normalizeServerDomainSlug(d))
        .filter((d): d is TrendzDomainSlug => d !== null)
    )
  );
  const domains: TrendzDomainSlug[] =
    normalizedDomains.length > 0 ? normalizedDomains : ['technology'];

  const windowHours = Math.min(720, Math.max(1, Math.round(params.windowHours || 48)));
  const maxItemsPerDomain = Math.min(10, Math.max(1, Math.round(params.maxItemsPerDomain || 2)));

  const providers = params.injectedCandidates
    ? []
    : getActiveSourceProviders(params.providerIds);

  const run: TrendIngestionRun = {
    id: runId,
    status: 'running',
    triggeredBy: params.triggeredBy,
    triggeredByEmail: params.triggeredByEmail,
    triggerMode: params.triggerMode || 'manual',
    domains,
    windowHours,
    maxItemsPerDomain,
    providerIds: params.injectedCandidates
      ? ['injected_test_source']
      : providers.map((p) => p.id),
    counts: {
      discovered: 0,
      validated: 0,
      duplicatesMerged: 0,
      processed: 0,
      pendingReview: 0,
      published: 0,
      rejected: 0,
      failed: 0,
    },
    errors: [],
    startedAt,
  };

  const items: TrendIngestionItem[] = [];
  const corroborationUpdates: RunPipelineOutput['corroborationUpdates'] = [];

  // Track known items across existing DB + current batch for live in-run deduplication
  const dedupePool: DuplicateCheckCandidate[] = [...(params.existingCandidates || [])];
  const inBatchItemsById = new Map<string, TrendIngestionItem>();

  try {
    // ── STAGE 1: DISCOVERED ───────────────────────────────────────────────────
    let discoveredCandidates: DiscoveredSourceCandidate[] = [];
    if (params.injectedCandidates) {
      discoveredCandidates = [...params.injectedCandidates];
    } else if (providers.length === 0) {
      run.errors.push('No configured source providers are available for the requested run.');
    } else {
      for (const provider of providers) {
        try {
          const result = await provider.discover({
            domains,
            windowHours,
            maxItemsPerDomain,
          });
          discoveredCandidates.push(...result.candidates);
          run.errors.push(...result.errors.slice(0, 20));
        } catch (err: any) {
          run.errors.push(`Provider '${provider.id}' crashed: ${err?.message || 'Unknown error'}`);
        }
      }
    }

    run.counts.discovered = discoveredCandidates.length;

    // Limit validated/processed items per domain to maxItemsPerDomain
    const acceptedPerDomain = new Map<TrendzDomainSlug, number>();
    const validatorFn = params.customSourceValidator || fetchAndValidateSource;

    for (const candidate of discoveredCandidates) {
      const currentDomainCount = acceptedPerDomain.get(candidate.domainSlug) || 0;
      if (currentDomainCount >= maxItemsPerDomain) {
        continue;
      }

      const nowIso = new Date().toISOString();
      const preCanonical = canonicalizeSourceUrl(candidate.url) || candidate.url;
      const preHash = computeUrlHash(preCanonical);
      const preItemId = createDeterministicItemId(preHash);

      let stageHistory: TrendIngestionStageEntry[] = pushStage(
        [],
        'DISCOVERED',
        `Discovered via ${candidate.providerName}`
      );

      // Quick pre-fetch duplicate check by canonical URL hash
      const preDup = findDuplicateOrCorroboratingMatch(
        {
          urlHash: preHash,
          contentHash: computeContentHash(candidate.title, candidate.excerpt),
          title: candidate.title,
          excerpt: candidate.excerpt,
        },
        dedupePool
      );

      if (preDup.isDuplicate && preDup.matchedId && preDup.matchedKind) {
        run.counts.duplicatesMerged++;
        if (preDup.matchType !== 'url_hash') {
          const corroborating: TrendCorroboratingSource = {
            name: candidate.publisherName,
            domain: (() => {
              try {
                return new URL(preCanonical).hostname.replace(/^www\./, '');
              } catch {
                return 'unknown';
              }
            })(),
            url: preCanonical,
            urlHash: preHash,
            publishedAtIso: candidate.publishedAtIso,
            title: candidate.title,
            providerId: candidate.providerId,
          };
          const inBatchTarget = inBatchItemsById.get(preDup.matchedId);
          if (inBatchTarget) {
            if (!inBatchTarget.corroboratingSources.some((c) => c.urlHash === preHash)) {
              inBatchTarget.corroboratingSources.push(corroborating);
            }
          } else {
            corroborationUpdates.push({
              targetKind: preDup.matchedKind,
              targetId: preDup.matchedId,
              corroboratingSource: corroborating,
            });
          }
        }
        continue;
      }

      // ── STAGE 2: VALIDATING ──────────────────────────────────────────────────
      stageHistory = pushStage(stageHistory, 'VALIDATING', 'Verifying URL reachability, SSRF safety, and metadata');

      const validatedResult = await validatorFn({
        url: candidate.url,
        fallbackTitle: candidate.title,
        fallbackPublisher: candidate.publisherName,
        fallbackPublishedAtIso: candidate.publishedAtIso,
        fallbackExcerpt: candidate.excerpt,
        fallbackOgImageUrl: candidate.ogImageUrl,
      });

      const domainMeta = getServerDomainMeta(candidate.domainSlug);

      if (!validatedResult.ok) {
        const failedRes = validatedResult as { ok: false; error: string; httpStatus?: number };
        const failedAt = new Date().toISOString();
        stageHistory = pushStage(stageHistory, 'FAILED', `Source validation failed: ${failedRes.error}`);
        const failedItem: TrendIngestionItem = {
          id: preItemId,
          runId,
          stage: 'FAILED',
          stageHistory,
          domainSlug: candidate.domainSlug,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          source: {
            name: candidate.publisherName,
            domain: (() => {
              try {
                return new URL(preCanonical).hostname.replace(/^www\./, '');
              } catch {
                return 'invalid-source';
              }
            })(),
            originalUrl: candidate.url,
            canonicalUrl: preCanonical,
            urlHash: preHash,
            credibilityTier: 'trade',
            publishedAtIso: candidate.publishedAtIso,
            retrievedAtIso: failedAt,
            rawTitle: candidate.title,
            sanitizedExcerpt: candidate.excerpt,
            contentHash: computeContentHash(candidate.title, candidate.excerpt),
            httpStatus: failedRes.httpStatus,
          },
          corroboratingSources: [],
          media: {
            type: 'image',
            url: domainMeta.fallbackImageUrl,
            thumbnailUrl: domainMeta.fallbackImageUrl,
            origin: 'domain_fallback',
            attribution: domainMeta.fallbackAttribution,
          },
          mediaFallbackUsed: true,
          retryCount: 0,
          failureStage: 'VALIDATING',
          failureReason: failedRes.error,
          createdAtIso: nowIso,
          updatedAtIso: failedAt,
        };
        items.push(failedItem);
        run.counts.failed++;
        continue;
      }

      const verifiedSource: ValidatedSourceContent = validatedResult.source;
      const itemId = createDeterministicItemId(verifiedSource.urlHash);

      // Post-fetch duplicate check (catches redirects to canonical URLs or full-body content similarity)
      const postDup = findDuplicateOrCorroboratingMatch(
        {
          urlHash: verifiedSource.urlHash,
          contentHash: verifiedSource.contentHash,
          title: verifiedSource.rawTitle,
          excerpt: verifiedSource.sanitizedExcerpt,
        },
        dedupePool
      );

      if (postDup.isDuplicate && postDup.matchedId && postDup.matchedKind) {
        run.counts.duplicatesMerged++;
        if (postDup.matchType !== 'url_hash') {
          const corroborating: TrendCorroboratingSource = {
            name: verifiedSource.publisherName,
            domain: verifiedSource.domain,
            url: verifiedSource.canonicalUrl,
            urlHash: verifiedSource.urlHash,
            publishedAtIso: verifiedSource.publishedAtIso,
            title: verifiedSource.rawTitle,
            providerId: candidate.providerId,
          };
          const inBatchTarget = inBatchItemsById.get(postDup.matchedId);
          if (inBatchTarget) {
            if (!inBatchTarget.corroboratingSources.some((c) => c.urlHash === verifiedSource.urlHash)) {
              inBatchTarget.corroboratingSources.push(corroborating);
            }
          } else {
            corroborationUpdates.push({
              targetKind: postDup.matchedKind,
              targetId: postDup.matchedId,
              corroboratingSource: corroborating,
            });
          }
        }
        continue;
      }

      // ── STAGE 3: VALIDATED ───────────────────────────────────────────────────
      stageHistory = pushStage(
        stageHistory,
        'VALIDATED',
        `HTTP ${verifiedSource.httpStatus} verified from ${verifiedSource.publisherName}`
      );
      run.counts.validated++;

      // Register into dedupe pool immediately to block duplicates within the same run
      dedupePool.push({
        id: itemId,
        kind: 'ingestion_item',
        urlHash: verifiedSource.urlHash,
        canonicalUrl: verifiedSource.canonicalUrl,
        title: verifiedSource.rawTitle,
        contentHash: verifiedSource.contentHash,
        excerpt: verifiedSource.sanitizedExcerpt,
      });

      // Resolve editorial media (non-blocking fallback guarantees thumbnail issues never drop a valid trend)
      const mediaResolution = await resolveTrendEditorialMedia({
        domainSlug: candidate.domainSlug,
        title: verifiedSource.rawTitle,
        publisherName: verifiedSource.publisherName,
        sourceOgImageUrl: verifiedSource.ogImageUrl,
        customAiImageGenerator: params.customAiImageGenerator,
      });

      // ── STAGE 4: PROCESSING (Gemini Structured Intelligence) ─────────────────
      stageHistory = pushStage(stageHistory, 'PROCESSING', 'Synthesizing source-grounded briefing via Gemini');

      try {
        const { draft, modelUsed } = await processValidatedSourceWithGemini({
          source: verifiedSource,
          hintedDomainSlug: candidate.domainSlug,
          corroboratingSources: [],
          existingPublishedTrends: params.existingPublishedTrends || [],
          customModelExecutor: params.customModelExecutor,
        });

        run.counts.processed++;

        // ── STAGE 5: PENDING_REVIEW ────────────────────────────────────────────
        const reviewNote =
          draft.evidenceStatus === 'insufficient'
            ? `Processed by ${modelUsed} — flagged for careful review (insufficient source detail)`
            : `Processed by ${modelUsed} — ready for editorial review`;

        stageHistory = pushStage(stageHistory, 'PENDING_REVIEW', reviewNote);

        const completedAt = new Date().toISOString();
        const readyItem: TrendIngestionItem = {
          id: itemId,
          runId,
          stage: 'PENDING_REVIEW',
          stageHistory,
          domainSlug: draft.domainSlug,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          source: {
            name: verifiedSource.publisherName,
            domain: verifiedSource.domain,
            originalUrl: verifiedSource.originalUrl,
            canonicalUrl: verifiedSource.canonicalUrl,
            urlHash: verifiedSource.urlHash,
            ...(verifiedSource.author ? { author: verifiedSource.author } : {}),
            credibilityTier: verifiedSource.credibilityTier,
            publishedAtIso: verifiedSource.publishedAtIso,
            retrievedAtIso: verifiedSource.retrievedAtIso,
            rawTitle: verifiedSource.rawTitle,
            sanitizedExcerpt: verifiedSource.sanitizedExcerpt,
            contentHash: verifiedSource.contentHash,
            ...(verifiedSource.ogImageUrl ? { ogImageUrl: verifiedSource.ogImageUrl } : {}),
            httpStatus: verifiedSource.httpStatus,
          },
          corroboratingSources: [],
          aiDraft: draft,
          media: mediaResolution.media,
          mediaFallbackUsed: mediaResolution.fallbackUsed,
          mediaNote: mediaResolution.note,
          retryCount: 0,
          createdAtIso: nowIso,
          updatedAtIso: completedAt,
        };

        items.push(readyItem);
        inBatchItemsById.set(itemId, readyItem);
        run.counts.pendingReview++;
        acceptedPerDomain.set(candidate.domainSlug, currentDomainCount + 1);
      } catch (aiErr: any) {
        const failedAt = new Date().toISOString();
        const reason = aiErr?.message || 'AI structured processing failed.';
        stageHistory = pushStage(stageHistory, 'FAILED', `AI processing failed: ${reason}`);

        const failedItem: TrendIngestionItem = {
          id: itemId,
          runId,
          stage: 'FAILED',
          stageHistory,
          domainSlug: candidate.domainSlug,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          source: {
            name: verifiedSource.publisherName,
            domain: verifiedSource.domain,
            originalUrl: verifiedSource.originalUrl,
            canonicalUrl: verifiedSource.canonicalUrl,
            urlHash: verifiedSource.urlHash,
            ...(verifiedSource.author ? { author: verifiedSource.author } : {}),
            credibilityTier: verifiedSource.credibilityTier,
            publishedAtIso: verifiedSource.publishedAtIso,
            retrievedAtIso: verifiedSource.retrievedAtIso,
            rawTitle: verifiedSource.rawTitle,
            sanitizedExcerpt: verifiedSource.sanitizedExcerpt,
            contentHash: verifiedSource.contentHash,
            ...(verifiedSource.ogImageUrl ? { ogImageUrl: verifiedSource.ogImageUrl } : {}),
            httpStatus: verifiedSource.httpStatus,
          },
          corroboratingSources: [],
          media: mediaResolution.media,
          mediaFallbackUsed: mediaResolution.fallbackUsed,
          mediaNote: mediaResolution.note,
          retryCount: 0,
          failureStage: 'PROCESSING',
          failureReason: reason.slice(0, 400),
          createdAtIso: nowIso,
          updatedAtIso: failedAt,
        };

        items.push(failedItem);
        run.counts.failed++;
        run.errors.push(`AI processing failed for ${verifiedSource.canonicalUrl}: ${reason.slice(0, 200)}`);
      }
    }

    run.completedAt = new Date().toISOString();
    if (run.counts.pendingReview > 0 && run.counts.failed === 0 && run.errors.length === 0) {
      run.status = 'completed';
    } else if (run.counts.pendingReview > 0 || run.counts.duplicatesMerged > 0) {
      run.status = run.counts.failed > 0 || run.errors.length > 0 ? 'partial_failure' : 'completed';
    } else if (run.counts.failed > 0 || run.errors.length > 0) {
      run.status = 'failed';
    } else {
      run.status = 'completed';
    }

    return { run, items, corroborationUpdates };
  } finally {
    releaseIngestionLock(runId);
  }
}

/**
 * Validates and processes a single explicit source URL into PENDING_REVIEW (or FAILED).
 */
export async function processSingleSourceUrlPipeline(params: {
  url: string;
  domainSlug: TrendzDomainSlug;
  triggeredBy: string;
  triggeredByEmail?: string;
  existingCandidates?: DuplicateCheckCandidate[];
  existingPublishedTrends?: ExistingPublishedTrendContext[];
  customSourceValidator?: typeof fetchAndValidateSource;
  customModelExecutor?: RunPipelineParams['customModelExecutor'];
}): Promise<RunPipelineOutput> {
  const domainSlug = normalizeServerDomainSlug(params.domainSlug) || 'technology';
  let publisherGuess = 'External Source';
  try {
    publisherGuess = new URL(params.url).hostname.replace(/^www\./, '');
  } catch {
    // will be rejected cleanly during VALIDATING
  }

  return runTrendzIngestionPipeline({
    triggeredBy: params.triggeredBy,
    triggeredByEmail: params.triggeredByEmail,
    triggerMode: 'single_url',
    domains: [domainSlug],
    windowHours: 168,
    maxItemsPerDomain: 1,
    existingCandidates: params.existingCandidates,
    existingPublishedTrends: params.existingPublishedTrends,
    injectedCandidates: [
      {
        providerId: 'manual_url',
        providerName: 'Manual Verified URL',
        domainSlug,
        title: publisherGuess,
        url: params.url,
        publisherName: publisherGuess,
        publishedAtIso: new Date().toISOString(),
        excerpt: '',
        discoveredAtIso: new Date().toISOString(),
      },
    ],
    customSourceValidator: params.customSourceValidator,
    customModelExecutor: params.customModelExecutor,
  });
}

/**
 * Safely retries a FAILED ingestion item without creating duplicate records.
 */
export async function retryFailedIngestionItem(params: {
  item: TrendIngestionItem;
  existingPublishedTrends?: ExistingPublishedTrendContext[];
  customSourceValidator?: typeof fetchAndValidateSource;
  customModelExecutor?: RunPipelineParams['customModelExecutor'];
}): Promise<TrendIngestionItem> {
  const { item } = params;
  if (item.stage !== 'FAILED') {
    throw new Error(`Only FAILED items can be retried (current stage: ${item.stage}).`);
  }
  if (item.retryCount >= 5) {
    throw new Error('Maximum retry count (5) reached for this item.');
  }

  const nextRetryCount = item.retryCount + 1;
  let stageHistory = pushStage(
    item.stageHistory || [],
    'VALIDATING',
    `Retry #${nextRetryCount} initiated`
  );

  const validatorFn = params.customSourceValidator || fetchAndValidateSource;
  const validated = await validatorFn({
    url: item.source.originalUrl || item.source.canonicalUrl,
    fallbackTitle: item.source.rawTitle,
    fallbackPublisher: item.source.name,
    fallbackPublishedAtIso: item.source.publishedAtIso,
    fallbackExcerpt: item.source.sanitizedExcerpt,
    fallbackOgImageUrl: item.source.ogImageUrl,
  });

  if (!validated.ok) {
    const failedRes = validated as { ok: false; error: string; httpStatus?: number };
    const nowIso = new Date().toISOString();
    stageHistory = pushStage(stageHistory, 'FAILED', `Retry #${nextRetryCount} validation failed: ${failedRes.error}`);
    return {
      ...item,
      stage: 'FAILED',
      stageHistory,
      retryCount: nextRetryCount,
      failureStage: 'VALIDATING',
      failureReason: failedRes.error.slice(0, 400),
      updatedAtIso: nowIso,
    };
  }

  const verifiedSource = validated.source;
  stageHistory = pushStage(stageHistory, 'VALIDATED', `Retry #${nextRetryCount} verified HTTP ${verifiedSource.httpStatus}`);

  const mediaResolution = await resolveTrendEditorialMedia({
    domainSlug: item.domainSlug,
    title: verifiedSource.rawTitle,
    publisherName: verifiedSource.publisherName,
    sourceOgImageUrl: verifiedSource.ogImageUrl,
  });

  stageHistory = pushStage(stageHistory, 'PROCESSING', `Retry #${nextRetryCount} Gemini synthesis`);

  try {
    const { draft, modelUsed } = await processValidatedSourceWithGemini({
      source: verifiedSource,
      hintedDomainSlug: item.domainSlug,
      corroboratingSources: item.corroboratingSources || [],
      existingPublishedTrends: params.existingPublishedTrends || [],
      customModelExecutor: params.customModelExecutor,
    });

    const nowIso = new Date().toISOString();
    stageHistory = pushStage(
      stageHistory,
      'PENDING_REVIEW',
      `Retry #${nextRetryCount} succeeded via ${modelUsed}`
    );

    return {
      ...item,
      stage: 'PENDING_REVIEW',
      stageHistory,
      domainSlug: draft.domainSlug,
      source: {
        name: verifiedSource.publisherName,
        domain: verifiedSource.domain,
        originalUrl: verifiedSource.originalUrl,
        canonicalUrl: verifiedSource.canonicalUrl,
        urlHash: verifiedSource.urlHash,
        ...(verifiedSource.author ? { author: verifiedSource.author } : {}),
        credibilityTier: resolveCredibilityTier(verifiedSource.domain),
        publishedAtIso: verifiedSource.publishedAtIso,
        retrievedAtIso: verifiedSource.retrievedAtIso,
        rawTitle: verifiedSource.rawTitle,
        sanitizedExcerpt: verifiedSource.sanitizedExcerpt,
        contentHash: verifiedSource.contentHash,
        ...(verifiedSource.ogImageUrl ? { ogImageUrl: verifiedSource.ogImageUrl } : {}),
        httpStatus: verifiedSource.httpStatus,
      },
      aiDraft: draft,
      media: mediaResolution.media,
      mediaFallbackUsed: mediaResolution.fallbackUsed,
      mediaNote: mediaResolution.note,
      retryCount: nextRetryCount,
      failureStage: undefined,
      failureReason: undefined,
      updatedAtIso: nowIso,
    };
  } catch (err: any) {
    const nowIso = new Date().toISOString();
    const reason = (err?.message || 'AI processing failed on retry.').slice(0, 400);
    stageHistory = pushStage(stageHistory, 'FAILED', `Retry #${nextRetryCount} AI failed: ${reason}`);
    return {
      ...item,
      stage: 'FAILED',
      stageHistory,
      retryCount: nextRetryCount,
      failureStage: 'PROCESSING',
      failureReason: reason,
      updatedAtIso: nowIso,
    };
  }
}

export function getAllowedDomainSlugs(): readonly TrendzDomainSlug[] {
  return SERVER_TRENDZ_DOMAIN_SLUGS;
}
