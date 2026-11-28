import crypto from 'crypto';
import type {
  TrendAutomationConfig,
  TrendAutomationSnapshot,
  TrendAutomationState,
  TrendIngestionItem,
  TrendIngestionRun,
} from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import { SERVER_TRENDZ_DOMAIN_SLUGS, normalizeServerDomainSlug } from './domainCatalog';
import {
  getRegisteredSourceProviders,
  listSourceProviderSummaries,
  type DiscoveredSourceCandidate,
  type TrendSourceProvider,
} from './sourceProviders';
import {
  createRunId,
  runTrendzIngestionPipeline,
  type RunPipelineOutput,
  type RunPipelineParams,
} from './pipelineOrchestrator';
import {
  createDefaultAutomationConfig,
  createDefaultAutomationState,
  hasServerSideFirestoreAdminCredentials,
  type TrendAutomationStore,
} from './automationStore';
import type { DuplicateCheckCandidate, fetchAndValidateSource } from './sourceValidation';
import type { ExistingPublishedTrendContext } from './geminiTrendProcessor';

export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 1440;
export const SCHEDULE_JITTER_TOLERANCE_MS = 10_000;

export const ALLOWED_PROVIDER_IDS = new Set(getRegisteredSourceProviders().map((p) => p.id));

export function isValidIanaTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz.trim() || tz.trim().length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export interface AutomationConfigPatch {
  enabled?: unknown;
  intervalMinutes?: unknown;
  timezone?: unknown;
  domains?: unknown;
  providerIds?: unknown;
  windowHours?: unknown;
  maxItemsPerDomain?: unknown;
  maxArticlesPerExecution?: unknown;
  maxConcurrentArticles?: unknown;
  requestTimeoutMs?: unknown;
  maxRetryAttempts?: unknown;
  retryBackoffBaseMinutes?: unknown;
  maxRecoveriesPerRun?: unknown;
  lockLeaseMinutes?: unknown;
}

export function validateAutomationConfigPatch(
  patch: AutomationConfigPatch,
  existing: TrendAutomationConfig,
  actor: { uid: string; email?: string },
  nowIso = new Date().toISOString()
): { ok: true; config: TrendAutomationConfig } | { ok: false; error: string } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'Configuration update payload must be a JSON object.' };
  }

  const next: TrendAutomationConfig = {
    ...existing,
    id: 'config',
    updatedAtIso: nowIso,
    updatedBy: actor.uid.slice(0, 128),
    ...(actor.email ? { updatedByEmail: actor.email.slice(0, 160) } : {}),
  };

  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== 'boolean') {
      return { ok: false, error: 'enabled must be a boolean.' };
    }
    next.enabled = patch.enabled;
  }

  if (patch.intervalMinutes !== undefined) {
    const val = Number(patch.intervalMinutes);
    if (!Number.isInteger(val) || val < MIN_INTERVAL_MINUTES || val > MAX_INTERVAL_MINUTES) {
      return {
        ok: false,
        error: `intervalMinutes must be an integer between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES}.`,
      };
    }
    next.intervalMinutes = val;
  }

  if (patch.timezone !== undefined) {
    if (!isValidIanaTimezone(patch.timezone)) {
      return { ok: false, error: 'timezone must be a valid IANA timezone (e.g., UTC, America/New_York).' };
    }
    next.timezone = patch.timezone.trim();
  }

  if (patch.domains !== undefined) {
    if (!Array.isArray(patch.domains)) {
      return { ok: false, error: 'domains must be an array of canonical Trendz domain slugs.' };
    }
    const normalized = Array.from(
      new Set(
        patch.domains
          .map((d) => normalizeServerDomainSlug(typeof d === 'string' ? d : null))
          .filter((d): d is TrendzDomainSlug => d !== null)
      )
    );
    if (normalized.length === 0) {
      return {
        ok: false,
        error: `At least one valid domain is required (${SERVER_TRENDZ_DOMAIN_SLUGS.join(', ')}).`,
      };
    }
    next.domains = normalized;
  }

  if (patch.providerIds !== undefined) {
    if (!Array.isArray(patch.providerIds)) {
      return { ok: false, error: 'providerIds must be an array of registered provider IDs.' };
    }
    const validProviders = Array.from(
      new Set(
        patch.providerIds
          .filter((id): id is string => typeof id === 'string' && ALLOWED_PROVIDER_IDS.has(id.trim()))
          .map((id) => id.trim())
      )
    );
    if (validProviders.length === 0) {
      return {
        ok: false,
        error: `At least one valid provider ID is required (${Array.from(ALLOWED_PROVIDER_IDS).join(', ')}).`,
      };
    }
    next.providerIds = validProviders;
  }

  if (patch.windowHours !== undefined) {
    const val = Number(patch.windowHours);
    if (!Number.isInteger(val) || val < 1 || val > 720) {
      return { ok: false, error: 'windowHours must be an integer between 1 and 720.' };
    }
    next.windowHours = val;
  }

  if (patch.maxItemsPerDomain !== undefined) {
    const val = Number(patch.maxItemsPerDomain);
    if (!Number.isInteger(val) || val < 1 || val > 10) {
      return { ok: false, error: 'maxItemsPerDomain must be an integer between 1 and 10.' };
    }
    next.maxItemsPerDomain = val;
  }

  if (patch.maxArticlesPerExecution !== undefined) {
    const val = Number(patch.maxArticlesPerExecution);
    if (!Number.isInteger(val) || val < 1 || val > 25) {
      return { ok: false, error: 'maxArticlesPerExecution must be an integer between 1 and 25.' };
    }
    next.maxArticlesPerExecution = val;
  }

  if (patch.maxConcurrentArticles !== undefined) {
    const val = Number(patch.maxConcurrentArticles);
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      return { ok: false, error: 'maxConcurrentArticles must be an integer between 1 and 5.' };
    }
    next.maxConcurrentArticles = val;
  }

  if (patch.requestTimeoutMs !== undefined) {
    const val = Number(patch.requestTimeoutMs);
    if (!Number.isInteger(val) || val < 3000 || val > 20000) {
      return { ok: false, error: 'requestTimeoutMs must be an integer between 3000 and 20000 ms.' };
    }
    next.requestTimeoutMs = val;
  }

  if (patch.maxRetryAttempts !== undefined) {
    const val = Number(patch.maxRetryAttempts);
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      return { ok: false, error: 'maxRetryAttempts must be an integer between 1 and 5.' };
    }
    next.maxRetryAttempts = val;
  }

  if (patch.retryBackoffBaseMinutes !== undefined) {
    const val = Number(patch.retryBackoffBaseMinutes);
    if (!Number.isInteger(val) || val < 1 || val > 120) {
      return { ok: false, error: 'retryBackoffBaseMinutes must be an integer between 1 and 120.' };
    }
    next.retryBackoffBaseMinutes = val;
  }

  if (patch.maxRecoveriesPerRun !== undefined) {
    const val = Number(patch.maxRecoveriesPerRun);
    if (!Number.isInteger(val) || val < 0 || val > 10) {
      return { ok: false, error: 'maxRecoveriesPerRun must be an integer between 0 and 10.' };
    }
    next.maxRecoveriesPerRun = val;
  }

  if (patch.lockLeaseMinutes !== undefined) {
    const val = Number(patch.lockLeaseMinutes);
    if (!Number.isInteger(val) || val < 2 || val > 30) {
      return { ok: false, error: 'lockLeaseMinutes must be an integer between 2 and 30.' };
    }
    next.lockLeaseMinutes = val;
  }

  return { ok: true, config: next };
}

/**
 * Computes the next scheduled execution timestamp in UTC ISO-8601 format.
 * Using UTC epoch arithmetic prevents DST transitions from skipping or double-running jobs.
 */
export function computeNextScheduledRunIso(
  config: TrendAutomationConfig,
  lastExecutionAtIso: string | null | undefined,
  nowMs = Date.now()
): string | null {
  if (!config.enabled) return null;
  const intervalMs = Math.max(MIN_INTERVAL_MINUTES, config.intervalMinutes) * 60_000;
  if (!lastExecutionAtIso) {
    return new Date(nowMs + intervalMs).toISOString();
  }
  const lastMs = Date.parse(lastExecutionAtIso);
  if (Number.isNaN(lastMs)) {
    return new Date(nowMs + intervalMs).toISOString();
  }
  const nextMs = lastMs + intervalMs;
  return new Date(nextMs > nowMs ? nextMs : nowMs + intervalMs).toISOString();
}

/**
 * Determines whether a scheduled run is due according to the configured interval.
 */
export function isScheduledRunDue(
  config: TrendAutomationConfig,
  state: TrendAutomationState,
  nowMs = Date.now()
): { due: boolean; reason?: string; remainingMs?: number } {
  if (!config.enabled) {
    return { due: false, reason: 'automation_paused' };
  }
  if (!state.lastExecutionAtIso) {
    return { due: true };
  }
  const lastMs = Date.parse(state.lastExecutionAtIso);
  if (Number.isNaN(lastMs)) {
    return { due: true };
  }
  const intervalMs = Math.max(MIN_INTERVAL_MINUTES, config.intervalMinutes) * 60_000;
  const elapsedMs = nowMs - lastMs;
  if (elapsedMs + SCHEDULE_JITTER_TOLERANCE_MS < intervalMs) {
    return {
      due: false,
      reason: 'interval_not_elapsed',
      remainingMs: Math.max(0, intervalMs - elapsedMs),
    };
  }
  return { due: true };
}

/**
 * Constant-time verification of the server-side scheduler secret for Cloud Scheduler / Functions webhooks.
 */
export function verifySchedulerSecret(providedHeader: unknown): {
  ok: boolean;
  statusCode?: number;
  error?: string;
} {
  const configured = process.env.TRENDZ_SCHEDULER_SECRET?.trim();
  if (!configured || configured.length < 16) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Scheduled ingestion webhook is not configured on this server (TRENDZ_SCHEDULER_SECRET unset).',
    };
  }
  if (typeof providedHeader !== 'string' || !providedHeader.trim()) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Missing scheduler authentication secret.',
    };
  }

  const a = Buffer.from(configured, 'utf8');
  const b = Buffer.from(providedHeader.trim(), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Invalid scheduler authentication secret.',
    };
  }

  return { ok: true };
}

export interface ExecuteIngestionCycleOptions {
  triggerMode: 'manual' | 'single_url' | 'scheduled';
  triggeredBy: string;
  triggeredByEmail?: string;
  ownerId?: string;
  /** When true, runs immediately even if automation is paused or interval has not elapsed (used for manual triggers) */
  force?: boolean;
  /** Optional parameter overrides for manual runs */
  overrideParams?: {
    domains?: TrendzDomainSlug[];
    windowHours?: number;
    maxItemsPerDomain?: number;
    maxArticlesPerExecution?: number;
    providerIds?: string[];
  };
  /** Optional caller-supplied context merged with headless store context */
  existingCandidates?: DuplicateCheckCandidate[];
  existingPublishedTrends?: ExistingPublishedTrendContext[];
  /** Optional per-request store override (e.g., FirestoreRestTrendAutomationStore with admin Bearer token) */
  storeOverride?: TrendAutomationStore;
  /** Deterministic test injections */
  nowMs?: number;
  customProviders?: TrendSourceProvider[];
  injectedCandidates?: DiscoveredSourceCandidate[];
  customSourceValidator?: typeof fetchAndValidateSource;
  customModelExecutor?: RunPipelineParams['customModelExecutor'];
  customAiImageGenerator?: RunPipelineParams['customAiImageGenerator'];
}

export interface ExecuteIngestionCycleResult {
  executed: boolean;
  skippedReason?: 'automation_paused' | 'interval_not_elapsed' | 'locked';
  conflict?: boolean;
  reclaimedStaleLock?: boolean;
  config: TrendAutomationConfig;
  state: TrendAutomationState;
  output?: RunPipelineOutput;
  persistedServerSide: boolean;
}

export class TrendAutomationController {
  private readonly defaultStore: TrendAutomationStore;
  private tickerHandle: ReturnType<typeof setInterval> | null = null;
  private readonly instanceId: string;

  constructor(defaultStore: TrendAutomationStore, instanceId?: string) {
    this.defaultStore = defaultStore;
    this.instanceId = instanceId || `srv_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  }

  private resolveStore(override?: TrendAutomationStore): TrendAutomationStore {
    return override || this.defaultStore;
  }

  async getOrInitConfig(storeOverride?: TrendAutomationStore): Promise<TrendAutomationConfig> {
    const store = this.resolveStore(storeOverride);
    const existing = await store.getConfig();
    if (existing) {
      return { ...createDefaultAutomationConfig(), ...existing, id: 'config' };
    }
    return createDefaultAutomationConfig();
  }

  async getOrInitState(storeOverride?: TrendAutomationStore): Promise<TrendAutomationState> {
    const store = this.resolveStore(storeOverride);
    const existing = await store.getState();
    if (existing) {
      return { ...createDefaultAutomationState(), ...existing, id: 'state' };
    }
    return createDefaultAutomationState();
  }

  async getSnapshot(storeOverride?: TrendAutomationStore): Promise<TrendAutomationSnapshot> {
    const store = this.resolveStore(storeOverride);
    const [config, state, recentRuns] = await Promise.all([
      this.getOrInitConfig(store),
      this.getOrInitState(store),
      store.listRecentRuns(20).catch(() => [] as TrendIngestionRun[]),
    ]);

    const effectiveNextRun = computeNextScheduledRunIso(config, state.lastExecutionAtIso);
    const normalizedState: TrendAutomationState = {
      ...state,
      nextScheduledRunAtIso: effectiveNextRun,
    };

    const schedulerSecretConfigured = Boolean(
      process.env.TRENDZ_SCHEDULER_SECRET && process.env.TRENDZ_SCHEDULER_SECRET.trim().length >= 16
    );
    const headlessExecutionReady =
      store.mode === 'firestore_admin' ||
      store.mode === 'memory' ||
      hasServerSideFirestoreAdminCredentials();

    const schedulerMode = this.tickerHandle
      ? 'in_process_and_api'
      : schedulerSecretConfigured || hasServerSideFirestoreAdminCredentials()
        ? 'cloud_functions_and_api'
        : 'manual_only';

    return {
      config,
      state: normalizedState,
      providers: listSourceProviderSummaries(),
      recentRuns,
      runtime: {
        schedulerMode,
        inProcessTickerActive: Boolean(this.tickerHandle),
        schedulerSecretConfigured,
        persistenceMode: store.mode,
        headlessExecutionReady,
      },
    };
  }

  async updateConfig(
    patch: AutomationConfigPatch,
    actor: { uid: string; email?: string },
    storeOverride?: TrendAutomationStore
  ): Promise<{ ok: true; config: TrendAutomationConfig; state: TrendAutomationState } | { ok: false; error: string }> {
    const store = this.resolveStore(storeOverride);
    const currentConfig = await this.getOrInitConfig(store);
    const currentState = await this.getOrInitState(store);
    const nowIso = new Date().toISOString();

    const validation = validateAutomationConfigPatch(patch, currentConfig, actor, nowIso);
    if (validation.ok === false) {
      return { ok: false, error: validation.error };
    }

    const savedConfig = await store.saveConfig(validation.config);
    const nextRunIso = computeNextScheduledRunIso(savedConfig, currentState.lastExecutionAtIso);
    const updatedState = await store.saveState({
      ...currentState,
      nextScheduledRunAtIso: nextRunIso,
      updatedAtIso: nowIso,
    });

    return { ok: true, config: savedConfig, state: updatedState };
  }

  /**
   * Executes a scheduled or manual ingestion cycle through the single unified pipeline,
   * protected by an atomic distributed lock, idempotent deduplication, and bounded failure recovery.
   * Never auto-publishes trends — every succeeded item enters PENDING_REVIEW.
   */
  async executeCycle(options: ExecuteIngestionCycleOptions): Promise<ExecuteIngestionCycleResult> {
    const store = this.resolveStore(options.storeOverride);
    const nowMs = options.nowMs ?? Date.now();
    const config = await this.getOrInitConfig(store);
    const state = await this.getOrInitState(store);

    // 1. Respect enabled/paused state and schedule interval for non-forced scheduled ticks
    if (options.triggerMode === 'scheduled' && !options.force) {
      const dueCheck = isScheduledRunDue(config, state, nowMs);
      if (!dueCheck.due) {
        return {
          executed: false,
          skippedReason: dueCheck.reason as 'automation_paused' | 'interval_not_elapsed',
          config,
          state: {
            ...state,
            nextScheduledRunAtIso: computeNextScheduledRunIso(config, state.lastExecutionAtIso, nowMs),
          },
          persistedServerSide: false,
        };
      }
    }

    // 2. Acquire atomic distributed execution lock (prevents overlapping manual + scheduled runs)
    const runId = createRunId();
    const lockOwner = options.ownerId || `${this.instanceId}:${options.triggeredBy}`;
    const lockAttempt = await store.acquireLock({
      runId,
      ownerId: lockOwner,
      triggerMode: options.triggerMode,
      leaseMinutes: config.lockLeaseMinutes,
      nowMs,
    });

    if (!lockAttempt.acquired) {
      return {
        executed: false,
        skippedReason: 'locked',
        conflict: true,
        config,
        state: (await store.getState()) || state,
        persistedServerSide: false,
      };
    }

    const executionStartMs = nowMs;
    const executionStartIso = new Date(executionStartMs).toISOString();

    try {
      // 3. Load dedupe + published + recoverable FAILED items headlessly from store
      const headlessCtx = await store.loadDedupeAndRecoveryContext().catch(() => ({
        existingCandidates: [] as DuplicateCheckCandidate[],
        existingPublishedTrends: [] as ExistingPublishedTrendContext[],
        recoverableFailedItems: [] as TrendIngestionItem[],
      }));

      // Merge any caller-supplied candidates without duplicating IDs
      const mergedCandidatesMap = new Map<string, DuplicateCheckCandidate>();
      for (const c of [...headlessCtx.existingCandidates, ...(options.existingCandidates || [])]) {
        mergedCandidatesMap.set(`${c.kind}:${c.id}`, c);
      }
      const mergedPublishedMap = new Map<string, ExistingPublishedTrendContext>();
      for (const t of [...headlessCtx.existingPublishedTrends, ...(options.existingPublishedTrends || [])]) {
        mergedPublishedMap.set(t.id, t);
      }

      const domains =
        options.overrideParams?.domains && options.overrideParams.domains.length > 0
          ? options.overrideParams.domains
          : config.domains;
      const windowHours = options.overrideParams?.windowHours ?? config.windowHours;
      const maxItemsPerDomain = options.overrideParams?.maxItemsPerDomain ?? config.maxItemsPerDomain;
      const maxArticlesPerExecution =
        options.overrideParams?.maxArticlesPerExecution ?? config.maxArticlesPerExecution;
      const providerIds =
        options.overrideParams?.providerIds && options.overrideParams.providerIds.length > 0
          ? options.overrideParams.providerIds
          : config.providerIds;

      // 4. Execute the single unified Trendz pipeline (no duplicate pipelines)
      const output = await runTrendzIngestionPipeline({
        runId,
        triggeredBy: options.triggeredBy,
        triggeredByEmail: options.triggeredByEmail,
        triggerMode: options.triggerMode,
        domains,
        windowHours,
        maxItemsPerDomain,
        maxArticlesPerExecution,
        maxConcurrentArticles: config.maxConcurrentArticles,
        requestTimeoutMs: config.requestTimeoutMs,
        maxRetryAttempts: config.maxRetryAttempts,
        retryBackoffBaseMinutes: config.retryBackoffBaseMinutes,
        maxRecoveriesPerRun: config.maxRecoveriesPerRun,
        providerIds,
        existingCandidates: Array.from(mergedCandidatesMap.values()),
        existingPublishedTrends: Array.from(mergedPublishedMap.values()),
        recoverableFailedItems: headlessCtx.recoverableFailedItems,
        onHeartbeat: async (activeRunId) => {
          await store.renewLock(activeRunId, config.lockLeaseMinutes).catch(() => {});
        },
        customProviders: options.customProviders,
        injectedCandidates: options.injectedCandidates,
        customSourceValidator: options.customSourceValidator,
        customModelExecutor: options.customModelExecutor,
        customAiImageGenerator: options.customAiImageGenerator,
      });

      // 5. Persist run log, staged items, and corroborating source updates headlessly
      let persistedServerSide = false;
      try {
        await store.persistExecutionOutput(output);
        persistedServerSide = true;
      } catch (persistErr: any) {
        console.error('[TRENDZ_AUTOMATION_PERSIST_ERROR]', persistErr?.message || persistErr);
      }

      const finishedMs = options.nowMs !== undefined ? executionStartMs + (output.run.durationMs || 0) : Date.now();
      const finishedIso = output.run.completedAt || new Date(finishedMs).toISOString();
      const isFailure = output.run.status === 'failed';
      const nextScheduledRunAtIso = computeNextScheduledRunIso(config, executionStartIso, finishedMs);

      // 6. Release distributed lock & record accurate monitoring state
      const updatedState = await store.releaseLock(
        runId,
        {
          lastExecutionAtIso: executionStartIso,
          lastCompletedAtIso: finishedIso,
          lastDurationMs: output.run.durationMs ?? Math.max(0, finishedMs - executionStartMs),
          lastRunId: output.run.id,
          lastTriggerMode: options.triggerMode,
          lastStatus: output.run.status,
          lastError: output.run.errors.length > 0 ? output.run.errors[0].slice(0, 300) : null,
          lastCounts: output.run.counts,
          lastProviderResults: output.run.providerResults || [],
          nextScheduledRunAtIso,
          consecutiveFailures: isFailure ? (state.consecutiveFailures || 0) + 1 : 0,
          totalScheduledRuns:
            options.triggerMode === 'scheduled'
              ? (state.totalScheduledRuns || 0) + 1
              : state.totalScheduledRuns || 0,
        },
        finishedMs
      );

      return {
        executed: true,
        reclaimedStaleLock: lockAttempt.reclaimedStaleLock,
        config,
        state: updatedState,
        output,
        persistedServerSide,
      };
    } catch (err: any) {
      const finishedMs = Date.now();
      const errMessage = String(err?.message || 'Unexpected ingestion orchestration error.').slice(0, 300);
      await store
        .releaseLock(
          runId,
          {
            lastExecutionAtIso: executionStartIso,
            lastCompletedAtIso: new Date(finishedMs).toISOString(),
            lastDurationMs: Math.max(0, finishedMs - executionStartMs),
            lastRunId: runId,
            lastTriggerMode: options.triggerMode,
            lastStatus: 'failed',
            lastError: errMessage,
            nextScheduledRunAtIso: computeNextScheduledRunIso(config, executionStartIso, finishedMs),
            consecutiveFailures: (state.consecutiveFailures || 0) + 1,
          },
          finishedMs
        )
        .catch(() => {});
      throw err;
    }
  }

  /**
   * Starts a lightweight server-side background ticker (only used in standalone Node deployments
   * when TRENDZ_IN_PROCESS_SCHEDULER_ENABLED=true and headless persistence is available).
   * Checks every 60s whether the configured interval has elapsed; never runs while disabled or locked.
   */
  startInProcessTicker(pollIntervalMs = 60_000): boolean {
    if (this.tickerHandle) return true;
    const safePollMs = Math.max(15_000, Math.min(5 * 60_000, pollIntervalMs));
    this.tickerHandle = setInterval(() => {
      void this.executeCycle({
        triggerMode: 'scheduled',
        triggeredBy: 'system_scheduler',
        ownerId: `${this.instanceId}:in_process_ticker`,
        force: false,
      }).catch((err) => {
        console.error('[TRENDZ_IN_PROCESS_SCHEDULER_ERROR]', err?.message || err);
      });
    }, safePollMs);
    if (typeof (this.tickerHandle as any).unref === 'function') {
      (this.tickerHandle as any).unref();
    }
    console.log(`[TRENDZ_SCHEDULER] In-process scheduler ticker active (polling every ${Math.round(safePollMs / 1000)}s).`);
    return true;
  }

  stopInProcessTicker(): void {
    if (this.tickerHandle) {
      clearInterval(this.tickerHandle);
      this.tickerHandle = null;
    }
  }
}
