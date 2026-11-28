import crypto from 'crypto';
import type {
  TrendCorroboratingSource,
  TrendIngestionItem,
  TrendIngestionRun,
  TrendIngestionStage,
  TrendIngestionStageEntry,
  TrendIngestionUsageMetrics,
  TrendProviderExecutionResult,
} from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import {
  SERVER_TRENDZ_DOMAIN_SLUGS,
  getServerDomainMeta,
  normalizeServerDomainSlug,
} from './domainCatalog';
import {
  type DiscoveredSourceCandidate,
  type TrendSourceProvider,
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

export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_BACKOFF_BASE_MINUTES = 15;
export const DEFAULT_MAX_ARTICLES_PER_EXECUTION = 10;
export const DEFAULT_MAX_CONCURRENT_ARTICLES = 2;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RECOVERIES_PER_RUN = 3;

// In-process concurrency guard preventing overlapping ingestion runs inside a single server instance
let activeIngestionLock: {
  runId: string;
  startedAtMs: number;
  triggeredBy: string;
  triggerMode: 'manual' | 'single_url' | 'scheduled';
} | null = null;
const LOCK_STALE_TIMEOUT_MS = 10 * 60_000;

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

function acquireIngestionLock(
  runId: string,
  triggeredBy: string,
  triggerMode: 'manual' | 'single_url' | 'scheduled'
): boolean {
  if (isIngestionLocked()) return false;
  activeIngestionLock = { runId, startedAtMs: Date.now(), triggeredBy, triggerMode };
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

/**
 * Computes exponential backoff timestamp for failed item recovery (capped at 24 hours).
 */
export function computeNextRetryIso(
  retryCount: number,
  baseMinutes = DEFAULT_RETRY_BACKOFF_BASE_MINUTES,
  nowMs = Date.now()
): string {
  const safeBase = Math.min(120, Math.max(1, Math.trunc(baseMinutes)));
  const safeCount = Math.max(0, Math.trunc(retryCount));
  const delayMinutes = Math.min(24 * 60, safeBase * Math.pow(2, safeCount));
  return new Date(nowMs + delayMinutes * 60_000).toISOString();
}

/**
 * Distinguishes permanent, non-retryable failures (SSRF blocks, invalid URLs, HTTP 400/401/403/404/410)
 * from transient failures (timeouts, 429, 5xx, temporary AI outages).
 */
export function isPermanentFailureReason(reason: string, httpStatus?: number): boolean {
  if (httpStatus !== undefined && [400, 401, 403, 404, 410, 451].includes(httpStatus)) {
    return true;
  }
  return /ssrf|blocked by|malformed url|unsupported url protocol|embedded credentials|single-label hostname|invalid url|exceeds size cap/i.test(
    reason
  );
}

/**
 * Checks whether a FAILED ingestion item is eligible for controlled automatic recovery.
 */
export function isItemEligibleForAutoRecovery(
  item: TrendIngestionItem,
  maxRetryAttempts = DEFAULT_MAX_RETRY_ATTEMPTS,
  nowMs = Date.now()
): boolean {
  if (item.stage !== 'FAILED') return false;
  if (item.permanentlyFailed === true) return false;
  const effectiveMax = Math.min(item.maxRetries ?? maxRetryAttempts, maxRetryAttempts);
  if (item.retryCount >= effectiveMax) return false;
  if (item.failureReason && isPermanentFailureReason(item.failureReason, item.source?.httpStatus)) {
    return false;
  }
  if (item.nextRetryAtIso) {
    const nextMs = Date.parse(item.nextRetryAtIso);
    if (!Number.isNaN(nextMs) && nextMs > nowMs) {
      return false;
    }
  }
  return true;
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
  ].slice(-40);
}

export interface RunPipelineParams {
  runId?: string;
  triggeredBy: string;
  triggeredByEmail?: string;
  triggerMode?: 'manual' | 'single_url' | 'scheduled';
  domains: TrendzDomainSlug[];
  windowHours: number;
  maxItemsPerDomain: number;
  maxArticlesPerExecution?: number;
  maxConcurrentArticles?: number;
  requestTimeoutMs?: number;
  maxRetryAttempts?: number;
  retryBackoffBaseMinutes?: number;
  maxRecoveriesPerRun?: number;
  providerIds?: string[];
  existingCandidates?: DuplicateCheckCandidate[];
  existingPublishedTrends?: ExistingPublishedTrendContext[];
  /** Previously FAILED items loaded from storage for controlled automatic recovery */
  recoverableFailedItems?: TrendIngestionItem[];
  /** Optional heartbeat callback invoked periodically while the run is active */
  onHeartbeat?: (runId: string) => Promise<void> | void;
  /** Optional injected providers, candidates, or executors for deterministic testing */
  customProviders?: TrendSourceProvider[];
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
 * Runs tasks with a bounded concurrency cap so external websites and Gemini never get flooded.
 */
async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const safeConcurrency = Math.max(1, Math.min(5, Math.trunc(concurrency)));
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
}

/**
 * Executes the multi-stage Trendz AI Intelligence Pipeline:
 * DISCOVERED -> VALIDATING -> VALIDATED -> PROCESSING -> PENDING_REVIEW (or FAILED).
 * Never auto-publishes items; every succeeded or recovered item awaits editorial review.
 */
export async function runTrendzIngestionPipeline(params: RunPipelineParams): Promise<RunPipelineOutput> {
  const runId = params.runId || createRunId();
  const triggerMode = params.triggerMode || 'manual';

  if (!acquireIngestionLock(runId, params.triggeredBy, triggerMode)) {
    const err: any = new Error(
      `Another Trendz ingestion run (${activeIngestionLock?.runId}) is already in progress. Wait for completion before starting a new run.`
    );
    err.statusCode = 409;
    throw err;
  }

  const runStartMs = Date.now();
  const startedAt = new Date(runStartMs).toISOString();
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
  const maxArticlesPerExecution = Math.min(
    25,
    Math.max(1, Math.round(params.maxArticlesPerExecution ?? DEFAULT_MAX_ARTICLES_PER_EXECUTION))
  );
  const maxConcurrentArticles = Math.min(
    5,
    Math.max(1, Math.round(params.maxConcurrentArticles ?? DEFAULT_MAX_CONCURRENT_ARTICLES))
  );
  const requestTimeoutMs = Math.min(
    20_000,
    Math.max(3_000, Math.round(params.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS))
  );
  const maxRetryAttempts = Math.min(
    5,
    Math.max(1, Math.round(params.maxRetryAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS))
  );
  const retryBackoffBaseMinutes = Math.min(
    120,
    Math.max(1, Math.round(params.retryBackoffBaseMinutes ?? DEFAULT_RETRY_BACKOFF_BASE_MINUTES))
  );
  const maxRecoveriesPerRun = Math.min(
    10,
    Math.max(0, Math.round(params.maxRecoveriesPerRun ?? DEFAULT_MAX_RECOVERIES_PER_RUN))
  );

  const providers: TrendSourceProvider[] = params.injectedCandidates
    ? []
    : params.customProviders
      ? params.customProviders.filter((p) => p.isConfigured())
      : getActiveSourceProviders(params.providerIds);

  const usageMetrics: TrendIngestionUsageMetrics = {
    providerRequests: 0,
    validationRequests: 0,
    geminiCalls: 0,
    recoveredItems: 0,
    skippedAlreadyProcessed: 0,
    cappedByExecutionLimit: 0,
  };

  const providerStatsMap = new Map<string, TrendProviderExecutionResult>();

  const ensureProviderStat = (providerId: string, providerName: string): TrendProviderExecutionResult => {
    let entry = providerStatsMap.get(providerId);
    if (!entry) {
      entry = {
        providerId,
        providerName,
        status: 'succeeded',
        discoveredCount: 0,
        validatedCount: 0,
        duplicatesMergedCount: 0,
        failedCount: 0,
        durationMs: 0,
        attempts: 0,
        rateLimited: false,
        errors: [],
      };
      providerStatsMap.set(providerId, entry);
    }
    return entry;
  };

  const run: TrendIngestionRun = {
    id: runId,
    status: 'running',
    triggeredBy: params.triggeredBy,
    triggeredByEmail: params.triggeredByEmail,
    triggerMode,
    domains,
    windowHours,
    maxItemsPerDomain,
    maxArticlesPerExecution,
    providerIds: params.injectedCandidates
      ? ['injected_test_source']
      : providers.map((p) => p.id),
    providerResults: [],
    usageMetrics,
    counts: {
      discovered: 0,
      validated: 0,
      duplicatesMerged: 0,
      processed: 0,
      pendingReview: 0,
      published: 0,
      rejected: 0,
      failed: 0,
      recovered: 0,
      skippedAlreadyProcessed: 0,
    },
    errors: [],
    startedAt,
  };

  const items: TrendIngestionItem[] = [];
  const corroborationUpdates: RunPipelineOutput['corroborationUpdates'] = [];

  // Track known items across existing DB + current batch for live in-run deduplication
  const dedupePool: DuplicateCheckCandidate[] = [...(params.existingCandidates || [])];
  const alreadyProcessedUrlHashes = new Set<string>(
    (params.existingCandidates || []).map((c) => c.urlHash).filter(Boolean)
  );
  const inBatchItemsById = new Map<string, TrendIngestionItem>();
  const validatorFn = params.customSourceValidator || fetchAndValidateSource;

  try {
    // ── STAGE 0: CONTROLLED RECOVERY OF ELIGIBLE PREVIOUSLY FAILED ITEMS ─────
    const recoverableItems = (params.recoverableFailedItems || [])
      .filter((item) => isItemEligibleForAutoRecovery(item, maxRetryAttempts, Date.now()))
      .slice(0, maxRecoveriesPerRun);

    for (const failedItem of recoverableItems) {
      try {
        const retried = await retryFailedIngestionItem({
          item: failedItem,
          maxRetryAttempts,
          retryBackoffBaseMinutes,
          requestTimeoutMs,
          existingPublishedTrends: params.existingPublishedTrends || [],
          customSourceValidator: validatorFn,
          customModelExecutor: params.customModelExecutor,
          customAiImageGenerator: params.customAiImageGenerator,
        });

        usageMetrics.validationRequests++;
        items.push(retried);
        inBatchItemsById.set(retried.id, retried);

        if (retried.stage === 'PENDING_REVIEW') {
          usageMetrics.geminiCalls++;
          usageMetrics.recoveredItems++;
          run.counts.recovered = (run.counts.recovered || 0) + 1;
          run.counts.validated++;
          run.counts.processed++;
          run.counts.pendingReview++;
          alreadyProcessedUrlHashes.add(retried.source.urlHash);
          dedupePool.push({
            id: retried.id,
            kind: 'ingestion_item',
            urlHash: retried.source.urlHash,
            canonicalUrl: retried.source.canonicalUrl,
            title: retried.aiDraft?.title || retried.source.rawTitle,
            contentHash: retried.source.contentHash,
            excerpt: retried.source.sanitizedExcerpt,
          });
        } else {
          run.counts.failed++;
          if (retried.failureStage === 'PROCESSING') {
            usageMetrics.geminiCalls++;
          }
          if (retried.failureReason) {
            run.errors.push(`Recovery retry #${retried.retryCount} failed for ${retried.id}: ${retried.failureReason.slice(0, 180)}`);
          }
        }
      } catch (recoveryErr: any) {
        run.errors.push(
          `Recovery error for ${failedItem.id}: ${String(recoveryErr?.message || 'Unknown error').slice(0, 180)}`
        );
      }
    }

    if (params.onHeartbeat) {
      await params.onHeartbeat(runId);
    }

    // ── STAGE 1: DISCOVERED (Independent Per-Provider Execution) ──────────────
    let discoveredCandidates: DiscoveredSourceCandidate[] = [];
    if (params.injectedCandidates) {
      discoveredCandidates = [...params.injectedCandidates];
      for (const c of discoveredCandidates) {
        const stat = ensureProviderStat(c.providerId, c.providerName);
        stat.discoveredCount++;
        stat.attempts = Math.max(1, stat.attempts);
      }
    } else if (providers.length === 0) {
      run.errors.push('No configured source providers are available for the requested run.');
    } else {
      // Execute each provider independently so failure/rate-limit in one never blocks others
      const discoveryResults = await Promise.all(
        providers.map(async (provider) => {
          const pStart = Date.now();
          const stat = ensureProviderStat(provider.id, provider.name);
          try {
            const result = await provider.discover({
              domains,
              windowHours,
              maxItemsPerDomain,
              requestTimeoutMs,
            });
            stat.discoveredCount = result.candidates.length;
            stat.durationMs = result.durationMs ?? Date.now() - pStart;
            stat.attempts = result.attempts ?? 1;
            stat.rateLimited = Boolean(result.rateLimited);
            stat.errors.push(...result.errors.slice(0, 15));
            usageMetrics.providerRequests += result.requestCount ?? 1;

            if (result.rateLimited && result.candidates.length === 0) {
              stat.status = 'rate_limited';
            } else if (result.errors.length > 0 && result.candidates.length === 0) {
              stat.status = 'failed';
            } else if (result.errors.length > 0 || result.rateLimited) {
              stat.status = 'partial';
            } else {
              stat.status = 'succeeded';
            }

            run.errors.push(...result.errors.slice(0, 15));
            return result.candidates;
          } catch (err: any) {
            const msg = `Provider '${provider.id}' crashed: ${err?.message || 'Unknown error'}`;
            stat.durationMs = Date.now() - pStart;
            stat.attempts = Math.max(1, stat.attempts);
            stat.status = 'failed';
            stat.errors.push(msg);
            run.errors.push(msg);
            return [] as DiscoveredSourceCandidate[];
          }
        })
      );

      for (const batch of discoveryResults) {
        discoveredCandidates.push(...batch);
      }
    }

    run.counts.discovered = discoveredCandidates.length;

    // ── PRE-DISPATCH FILTERING: PER-DOMAIN CAP, GLOBAL CAP, AND FAST DEDUPE ──
    const acceptedPerDomain = new Map<TrendzDomainSlug, number>();
    const selectedForValidation: Array<{
      candidate: DiscoveredSourceCandidate;
      preCanonical: string;
      preHash: string;
      preItemId: string;
      nowIso: string;
      stageHistory: TrendIngestionStageEntry[];
    }> = [];

    const reservedUrlHashes = new Set<string>();
    const remainingBudget = Math.max(0, maxArticlesPerExecution - (run.counts.recovered || 0));

    for (const candidate of discoveredCandidates) {
      const providerStat = ensureProviderStat(candidate.providerId, candidate.providerName);
      const currentDomainCount = acceptedPerDomain.get(candidate.domainSlug) || 0;
      if (currentDomainCount >= maxItemsPerDomain) {
        continue;
      }

      if (selectedForValidation.length >= remainingBudget) {
        usageMetrics.cappedByExecutionLimit++;
        continue;
      }

      const nowIso = new Date().toISOString();
      const preCanonical = canonicalizeSourceUrl(candidate.url) || candidate.url;
      const preHash = computeUrlHash(preCanonical);
      const preItemId = createDeterministicItemId(preHash);

      // Avoid repeating Gemini processing for already-processed articles (idempotency & cost control)
      if (alreadyProcessedUrlHashes.has(preHash) || reservedUrlHashes.has(preHash)) {
        run.counts.duplicatesMerged++;
        run.counts.skippedAlreadyProcessed = (run.counts.skippedAlreadyProcessed || 0) + 1;
        usageMetrics.skippedAlreadyProcessed++;
        providerStat.duplicatesMergedCount++;
        continue;
      }

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
        providerStat.duplicatesMergedCount++;
        if (preDup.matchType === 'url_hash') {
          run.counts.skippedAlreadyProcessed = (run.counts.skippedAlreadyProcessed || 0) + 1;
          usageMetrics.skippedAlreadyProcessed++;
        } else {
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

      reservedUrlHashes.add(preHash);
      acceptedPerDomain.set(candidate.domainSlug, currentDomainCount + 1);
      // Reserve into dedupePool immediately to prevent cross-provider duplicate processing in parallel waves
      dedupePool.push({
        id: preItemId,
        kind: 'ingestion_item',
        urlHash: preHash,
        canonicalUrl: preCanonical,
        title: candidate.title,
        contentHash: computeContentHash(candidate.title, candidate.excerpt),
        excerpt: candidate.excerpt,
      });

      selectedForValidation.push({
        candidate,
        preCanonical,
        preHash,
        preItemId,
        nowIso,
        stageHistory: pushStage([], 'DISCOVERED', `Discovered via ${candidate.providerName}`),
      });
    }

    // ── STAGES 2-5: BOUNDED CONCURRENT VALIDATION + GEMINI PROCESSING ────────
    await runWithConcurrencyLimit(
      selectedForValidation,
      maxConcurrentArticles,
      async (entry) => {
        const { candidate, preCanonical, preHash, preItemId, nowIso } = entry;
        let stageHistory = entry.stageHistory;
        const providerStat = ensureProviderStat(candidate.providerId, candidate.providerName);

        // STAGE 2: VALIDATING
        stageHistory = pushStage(
          stageHistory,
          'VALIDATING',
          'Verifying URL reachability, SSRF safety, and metadata'
        );

        usageMetrics.validationRequests++;
        const validatedResult = await validatorFn({
          url: candidate.url,
          fallbackTitle: candidate.title,
          fallbackPublisher: candidate.publisherName,
          fallbackPublishedAtIso: candidate.publishedAtIso,
          fallbackExcerpt: candidate.excerpt,
          fallbackOgImageUrl: candidate.ogImageUrl,
          timeoutMs: requestTimeoutMs,
        });

        const domainMeta = getServerDomainMeta(candidate.domainSlug);

        if (!validatedResult.ok) {
          const failedRes = validatedResult as { ok: false; error: string; httpStatus?: number };
          const failedAt = new Date().toISOString();
          const permanent = isPermanentFailureReason(failedRes.error, failedRes.httpStatus);
          stageHistory = pushStage(
            stageHistory,
            'FAILED',
            permanent
              ? `Permanent validation failure: ${failedRes.error}`
              : `Source validation failed (scheduled for retry): ${failedRes.error}`
          );
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
            maxRetries: maxRetryAttempts,
            permanentlyFailed: permanent,
            ...(permanent
              ? {}
              : { nextRetryAtIso: computeNextRetryIso(0, retryBackoffBaseMinutes) }),
            failureStage: 'VALIDATING',
            failureReason: failedRes.error.slice(0, 400),
            createdAtIso: nowIso,
            updatedAtIso: failedAt,
          };
          items.push(failedItem);
          run.counts.failed++;
          providerStat.failedCount++;
          providerStat.errors.push(`Validation failed (${preCanonical}): ${failedRes.error.slice(0, 160)}`);
          return;
        }

        const verifiedSource: ValidatedSourceContent = validatedResult.source;
        const itemId = createDeterministicItemId(verifiedSource.urlHash);

        // Post-fetch duplicate check (catches redirects to already-known canonical URLs or full-body similarity)
        const postDupCandidates = dedupePool.filter((c) => c.id !== preItemId);
        const postDup = findDuplicateOrCorroboratingMatch(
          {
            urlHash: verifiedSource.urlHash,
            contentHash: verifiedSource.contentHash,
            title: verifiedSource.rawTitle,
            excerpt: verifiedSource.sanitizedExcerpt,
          },
          postDupCandidates
        );

        if (postDup.isDuplicate && postDup.matchedId && postDup.matchedKind) {
          run.counts.duplicatesMerged++;
          providerStat.duplicatesMergedCount++;
          if (postDup.matchType === 'url_hash') {
            run.counts.skippedAlreadyProcessed = (run.counts.skippedAlreadyProcessed || 0) + 1;
            usageMetrics.skippedAlreadyProcessed++;
          } else {
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
          return;
        }

        // STAGE 3: VALIDATED
        stageHistory = pushStage(
          stageHistory,
          'VALIDATED',
          `HTTP ${verifiedSource.httpStatus} verified from ${verifiedSource.publisherName}`
        );
        run.counts.validated++;
        providerStat.validatedCount++;

        alreadyProcessedUrlHashes.add(verifiedSource.urlHash);
        dedupePool.push({
          id: itemId,
          kind: 'ingestion_item',
          urlHash: verifiedSource.urlHash,
          canonicalUrl: verifiedSource.canonicalUrl,
          title: verifiedSource.rawTitle,
          contentHash: verifiedSource.contentHash,
          excerpt: verifiedSource.sanitizedExcerpt,
        });

        // Resolve editorial media (non-blocking fallback)
        const mediaResolution = await resolveTrendEditorialMedia({
          domainSlug: candidate.domainSlug,
          title: verifiedSource.rawTitle,
          publisherName: verifiedSource.publisherName,
          sourceOgImageUrl: verifiedSource.ogImageUrl,
          customAiImageGenerator: params.customAiImageGenerator,
        });

        // STAGE 4: PROCESSING (Gemini Structured Intelligence)
        stageHistory = pushStage(
          stageHistory,
          'PROCESSING',
          'Synthesizing source-grounded briefing via Gemini'
        );

        try {
          usageMetrics.geminiCalls++;
          const { draft, modelUsed } = await processValidatedSourceWithGemini({
            source: verifiedSource,
            hintedDomainSlug: candidate.domainSlug,
            corroboratingSources: [],
            existingPublishedTrends: params.existingPublishedTrends || [],
            customModelExecutor: params.customModelExecutor,
          });

          run.counts.processed++;

          // STAGE 5: PENDING_REVIEW (Phase 08.1 NEVER auto-publishes)
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
            maxRetries: maxRetryAttempts,
            permanentlyFailed: false,
            createdAtIso: nowIso,
            updatedAtIso: completedAt,
          };

          items.push(readyItem);
          inBatchItemsById.set(itemId, readyItem);
          run.counts.pendingReview++;
        } catch (aiErr: any) {
          const failedAt = new Date().toISOString();
          const reason = String(aiErr?.message || 'AI structured processing failed.');
          const permanent = /GEMINI_API_KEY_MISSING/i.test(reason);
          stageHistory = pushStage(
            stageHistory,
            'FAILED',
            permanent
              ? `Permanent AI processing error: ${reason}`
              : `AI processing failed (scheduled for retry): ${reason}`
          );

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
            maxRetries: maxRetryAttempts,
            permanentlyFailed: permanent,
            ...(permanent
              ? {}
              : { nextRetryAtIso: computeNextRetryIso(0, retryBackoffBaseMinutes) }),
            failureStage: 'PROCESSING',
            failureReason: reason.slice(0, 400),
            createdAtIso: nowIso,
            updatedAtIso: failedAt,
          };

          items.push(failedItem);
          run.counts.failed++;
          providerStat.failedCount++;
          const errLine = `AI processing failed for ${verifiedSource.canonicalUrl}: ${reason.slice(0, 180)}`;
          providerStat.errors.push(errLine);
          run.errors.push(errLine);
        }

        if (params.onHeartbeat) {
          await params.onHeartbeat(runId);
        }
      }
    );

    // Finalize provider statuses after article-level validation/AI stages
    run.providerResults = Array.from(providerStatsMap.values()).map((stat) => {
      const trimmedErrors = stat.errors.slice(0, 15);
      let status = stat.status;
      if (stat.rateLimited && stat.validatedCount === 0 && stat.discoveredCount === 0) {
        status = 'rate_limited';
      } else if (
        (stat.status === 'failed' || stat.failedCount > 0 || trimmedErrors.length > 0) &&
        stat.discoveredCount === 0 &&
        stat.validatedCount === 0 &&
        stat.duplicatesMergedCount === 0
      ) {
        status = 'failed';
      } else if (stat.failedCount > 0 && stat.validatedCount === 0 && stat.duplicatesMergedCount === 0) {
        status = 'failed';
      } else if (stat.failedCount > 0 || trimmedErrors.length > 0 || stat.rateLimited) {
        status = 'partial';
      }
      return { ...stat, status, errors: trimmedErrors };
    });

    run.errors = run.errors.slice(0, 50);
    const completedMs = Date.now();
    run.completedAt = new Date(completedMs).toISOString();
    run.durationMs = Math.max(0, completedMs - runStartMs);

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
    maxArticlesPerExecution: 1,
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
 * Enforces bounded retry attempts, exponential backoff, and permanent failure marking.
 */
export async function retryFailedIngestionItem(params: {
  item: TrendIngestionItem;
  maxRetryAttempts?: number;
  retryBackoffBaseMinutes?: number;
  requestTimeoutMs?: number;
  existingPublishedTrends?: ExistingPublishedTrendContext[];
  customSourceValidator?: typeof fetchAndValidateSource;
  customModelExecutor?: RunPipelineParams['customModelExecutor'];
  customAiImageGenerator?: RunPipelineParams['customAiImageGenerator'];
}): Promise<TrendIngestionItem> {
  const { item } = params;
  if (item.stage !== 'FAILED') {
    throw new Error(`Only FAILED items can be retried (current stage: ${item.stage}).`);
  }
  const maxRetries = Math.min(5, Math.max(1, Math.round(params.maxRetryAttempts ?? item.maxRetries ?? 5)));
  const backoffBase = Math.min(
    120,
    Math.max(1, Math.round(params.retryBackoffBaseMinutes ?? DEFAULT_RETRY_BACKOFF_BASE_MINUTES))
  );
  if (item.retryCount >= maxRetries) {
    throw new Error(`Maximum retry count (${maxRetries}) reached for this item.`);
  }

  const nextRetryCount = item.retryCount + 1;
  const attemptAtIso = new Date().toISOString();
  let stageHistory = pushStage(
    item.stageHistory || [],
    'VALIDATING',
    `Retry #${nextRetryCount}/${maxRetries} initiated`
  );

  const validatorFn = params.customSourceValidator || fetchAndValidateSource;
  const validated = await validatorFn({
    url: item.source.originalUrl || item.source.canonicalUrl,
    fallbackTitle: item.source.rawTitle,
    fallbackPublisher: item.source.name,
    fallbackPublishedAtIso: item.source.publishedAtIso,
    fallbackExcerpt: item.source.sanitizedExcerpt,
    fallbackOgImageUrl: item.source.ogImageUrl,
    timeoutMs: params.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  });

  if (!validated.ok) {
    const failedRes = validated as { ok: false; error: string; httpStatus?: number };
    const nowIso = new Date().toISOString();
    const permanent =
      nextRetryCount >= maxRetries ||
      isPermanentFailureReason(failedRes.error, failedRes.httpStatus);
    stageHistory = pushStage(
      stageHistory,
      'FAILED',
      permanent
        ? `Retry #${nextRetryCount}/${maxRetries} permanently failed: ${failedRes.error}`
        : `Retry #${nextRetryCount}/${maxRetries} validation failed: ${failedRes.error}`
    );
    return {
      ...item,
      stage: 'FAILED',
      stageHistory,
      retryCount: nextRetryCount,
      maxRetries,
      lastRetryAtIso: attemptAtIso,
      nextRetryAtIso: permanent ? undefined : computeNextRetryIso(nextRetryCount, backoffBase),
      permanentlyFailed: permanent,
      failureStage: 'VALIDATING',
      failureReason: failedRes.error.slice(0, 400),
      updatedAtIso: nowIso,
    };
  }

  const verifiedSource = validated.source;
  stageHistory = pushStage(
    stageHistory,
    'VALIDATED',
    `Retry #${nextRetryCount} verified HTTP ${verifiedSource.httpStatus}`
  );

  const mediaResolution = await resolveTrendEditorialMedia({
    domainSlug: item.domainSlug,
    title: verifiedSource.rawTitle,
    publisherName: verifiedSource.publisherName,
    sourceOgImageUrl: verifiedSource.ogImageUrl,
    customAiImageGenerator: params.customAiImageGenerator,
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
      maxRetries,
      lastRetryAtIso: attemptAtIso,
      nextRetryAtIso: undefined,
      permanentlyFailed: false,
      failureStage: undefined,
      failureReason: undefined,
      updatedAtIso: nowIso,
    };
  } catch (err: any) {
    const nowIso = new Date().toISOString();
    const reason = String(err?.message || 'AI processing failed on retry.').slice(0, 400);
    const permanent = nextRetryCount >= maxRetries || /GEMINI_API_KEY_MISSING/i.test(reason);
    stageHistory = pushStage(
      stageHistory,
      'FAILED',
      permanent
        ? `Retry #${nextRetryCount}/${maxRetries} permanently failed: ${reason}`
        : `Retry #${nextRetryCount}/${maxRetries} AI failed: ${reason}`
    );
    return {
      ...item,
      stage: 'FAILED',
      stageHistory,
      retryCount: nextRetryCount,
      maxRetries,
      lastRetryAtIso: attemptAtIso,
      nextRetryAtIso: permanent ? undefined : computeNextRetryIso(nextRetryCount, backoffBase),
      permanentlyFailed: permanent,
      failureStage: 'PROCESSING',
      failureReason: reason,
      updatedAtIso: nowIso,
    };
  }
}

export function getAllowedDomainSlugs(): readonly TrendzDomainSlug[] {
  return SERVER_TRENDZ_DOMAIN_SLUGS;
}
