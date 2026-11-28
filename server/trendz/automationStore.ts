import { getApp as getAdminApp, getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import type {
  TrendAutomationConfig,
  TrendAutomationState,
  TrendCorroboratingSource,
  TrendIngestionItem,
  TrendIngestionRun,
} from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import { normalizeServerDomainSlug } from './domainCatalog';
import type { DuplicateCheckCandidate } from './sourceValidation';
import type { ExistingPublishedTrendContext } from './geminiTrendProcessor';

export const AUTOMATION_COLLECTION = 'trendAutomation';
export const AUTOMATION_CONFIG_DOC_ID = 'config';
export const AUTOMATION_STATE_DOC_ID = 'state';
export const INGESTION_RUNS_COLLECTION = 'trendIngestionRuns';
export const INGESTION_ITEMS_COLLECTION = 'trendIngestionItems';
export const TRENDZ_COLLECTION = 'trendz';

export interface LockAcquireRequest {
  runId: string;
  ownerId: string;
  triggerMode: 'manual' | 'single_url' | 'scheduled';
  leaseMinutes: number;
  nowMs?: number;
}

export interface LockAcquireResult {
  acquired: boolean;
  reclaimedStaleLock?: boolean;
  existingLock?: {
    runId: string | null;
    owner: string | null;
    triggerMode: 'manual' | 'single_url' | 'scheduled' | null;
    acquiredAtIso: string | null;
    expiresAtIso: string | null;
  };
}

export interface HeadlessDedupeContext {
  existingCandidates: DuplicateCheckCandidate[];
  existingPublishedTrends: ExistingPublishedTrendContext[];
  recoverableFailedItems: TrendIngestionItem[];
}

export interface TrendAutomationStore {
  readonly mode: 'firestore_admin' | 'firestore_rest' | 'memory';
  getConfig(): Promise<TrendAutomationConfig | null>;
  saveConfig(config: TrendAutomationConfig): Promise<TrendAutomationConfig>;
  getState(): Promise<TrendAutomationState | null>;
  saveState(state: TrendAutomationState): Promise<TrendAutomationState>;
  acquireLock(req: LockAcquireRequest): Promise<LockAcquireResult>;
  renewLock(runId: string, leaseMinutes: number, nowMs?: number): Promise<boolean>;
  releaseLock(
    runId: string,
    stateUpdate: Partial<TrendAutomationState>,
    nowMs?: number
  ): Promise<TrendAutomationState>;
  listRecentRuns(limit?: number): Promise<TrendIngestionRun[]>;
  loadDedupeAndRecoveryContext(options?: {
    maxPublished?: number;
    maxItems?: number;
  }): Promise<HeadlessDedupeContext>;
  persistExecutionOutput(output: {
    run: TrendIngestionRun;
    items: TrendIngestionItem[];
    corroborationUpdates: Array<{
      targetKind: 'published_trend' | 'ingestion_item';
      targetId: string;
      corroboratingSource: TrendCorroboratingSource;
    }>;
  }): Promise<void>;
}

export function createDefaultAutomationConfig(nowIso = new Date().toISOString()): TrendAutomationConfig {
  return {
    id: 'config',
    // Disabled by default for safe rollout until credentials, config, and monitoring are verified
    enabled: process.env.TRENDZ_AUTOMATION_ENABLED_DEFAULT === 'true',
    intervalMinutes: 15,
    timezone: 'UTC',
    domains: ['technology', 'science', 'finance', 'space'],
    providerIds: ['curated_rss', 'gnews_api', 'newsdata_api'],
    windowHours: 24,
    maxItemsPerDomain: 2,
    maxArticlesPerExecution: Math.min(
      25,
      Math.max(1, Number.parseInt(process.env.TRENDZ_MAX_ARTICLES_PER_RUN || '8', 10) || 8)
    ),
    maxConcurrentArticles: 2,
    requestTimeoutMs: 10_000,
    maxRetryAttempts: 3,
    retryBackoffBaseMinutes: 15,
    maxRecoveriesPerRun: 3,
    lockLeaseMinutes: 10,
    updatedAtIso: nowIso,
    updatedBy: 'system_default',
  };
}

export function createDefaultAutomationState(nowIso = new Date().toISOString()): TrendAutomationState {
  return {
    id: 'state',
    locked: false,
    lockRunId: null,
    lockOwner: null,
    lockTriggerMode: null,
    lockAcquiredAtIso: null,
    lockExpiresAtIso: null,
    lastExecutionAtIso: null,
    lastCompletedAtIso: null,
    lastDurationMs: null,
    lastRunId: null,
    lastTriggerMode: null,
    lastStatus: null,
    lastError: null,
    lastCounts: null,
    lastProviderResults: [],
    nextScheduledRunAtIso: null,
    consecutiveFailures: 0,
    totalScheduledRuns: 0,
    updatedAtIso: nowIso,
  };
}

function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (
    input &&
    typeof input === 'object' &&
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

function isLockStillValid(state: TrendAutomationState | null, nowMs: number): boolean {
  if (!state || !state.locked) return false;
  if (!state.lockExpiresAtIso) return false;
  const expiresMs = Date.parse(state.lockExpiresAtIso);
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > nowMs;
}

// ==========================================
// 1. In-Memory Transactional Store (Tests & Fallback)
// ==========================================

export class InMemoryTrendAutomationStore implements TrendAutomationStore {
  readonly mode = 'memory' as const;
  private config: TrendAutomationConfig | null;
  private state: TrendAutomationState;
  private runs = new Map<string, TrendIngestionRun>();
  private items = new Map<string, TrendIngestionItem>();
  private publishedTrends = new Map<
    string,
    {
      id: string;
      title: string;
      domainSlug: TrendzDomainSlug;
      urlHash: string;
      canonicalUrl?: string;
      contentHash?: string;
      summary?: string;
      tags?: string[];
    }
  >();

  constructor(initial?: {
    config?: TrendAutomationConfig | null;
    state?: TrendAutomationState;
    items?: TrendIngestionItem[];
    runs?: TrendIngestionRun[];
    publishedTrends?: Array<{
      id: string;
      title: string;
      domainSlug: TrendzDomainSlug;
      urlHash: string;
      canonicalUrl?: string;
      contentHash?: string;
      summary?: string;
      tags?: string[];
    }>;
  }) {
    this.config = initial?.config !== undefined ? initial.config : createDefaultAutomationConfig();
    this.state = initial?.state ? { ...initial.state } : createDefaultAutomationState();
    for (const r of initial?.runs || []) this.runs.set(r.id, { ...r });
    for (const i of initial?.items || []) this.items.set(i.id, { ...i });
    for (const t of initial?.publishedTrends || []) this.publishedTrends.set(t.id, { ...t });
  }

  async getConfig(): Promise<TrendAutomationConfig | null> {
    return this.config ? structuredClone(this.config) : null;
  }

  async saveConfig(config: TrendAutomationConfig): Promise<TrendAutomationConfig> {
    this.config = structuredClone(config);
    return structuredClone(this.config);
  }

  async getState(): Promise<TrendAutomationState | null> {
    return structuredClone(this.state);
  }

  async saveState(state: TrendAutomationState): Promise<TrendAutomationState> {
    this.state = structuredClone(state);
    return structuredClone(this.state);
  }

  async acquireLock(req: LockAcquireRequest): Promise<LockAcquireResult> {
    const nowMs = req.nowMs ?? Date.now();
    const currentlyValid = isLockStillValid(this.state, nowMs);
    if (currentlyValid) {
      return {
        acquired: false,
        existingLock: {
          runId: this.state.lockRunId ?? null,
          owner: this.state.lockOwner ?? null,
          triggerMode: this.state.lockTriggerMode ?? null,
          acquiredAtIso: this.state.lockAcquiredAtIso ?? null,
          expiresAtIso: this.state.lockExpiresAtIso ?? null,
        },
      };
    }

    const reclaimed = Boolean(this.state.locked && !currentlyValid);
    const acquiredAtIso = new Date(nowMs).toISOString();
    const expiresAtIso = new Date(nowMs + req.leaseMinutes * 60_000).toISOString();

    this.state = {
      ...this.state,
      locked: true,
      lockRunId: req.runId,
      lockOwner: req.ownerId,
      lockTriggerMode: req.triggerMode,
      lockAcquiredAtIso: acquiredAtIso,
      lockExpiresAtIso: expiresAtIso,
      updatedAtIso: acquiredAtIso,
    };

    return { acquired: true, reclaimedStaleLock: reclaimed };
  }

  async renewLock(runId: string, leaseMinutes: number, nowMs = Date.now()): Promise<boolean> {
    if (!this.state.locked || this.state.lockRunId !== runId) {
      return false;
    }
    const nowIso = new Date(nowMs).toISOString();
    this.state = {
      ...this.state,
      lockExpiresAtIso: new Date(nowMs + leaseMinutes * 60_000).toISOString(),
      updatedAtIso: nowIso,
    };
    return true;
  }

  async releaseLock(
    runId: string,
    stateUpdate: Partial<TrendAutomationState>,
    nowMs = Date.now()
  ): Promise<TrendAutomationState> {
    const nowIso = new Date(nowMs).toISOString();
    const shouldClearLock = !this.state.locked || this.state.lockRunId === runId;
    this.state = {
      ...this.state,
      ...stateUpdate,
      ...(shouldClearLock
        ? {
            locked: false,
            lockRunId: null,
            lockOwner: null,
            lockTriggerMode: null,
            lockAcquiredAtIso: null,
            lockExpiresAtIso: null,
          }
        : {}),
      updatedAtIso: nowIso,
    };
    return structuredClone(this.state);
  }

  async listRecentRuns(limit = 20): Promise<TrendIngestionRun[]> {
    return Array.from(this.runs.values())
      .sort((a, b) => Date.parse(b.startedAt || '') - Date.parse(a.startedAt || ''))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }

  async loadDedupeAndRecoveryContext(): Promise<HeadlessDedupeContext> {
    const existingPublishedTrends: ExistingPublishedTrendContext[] = [];
    const existingCandidates: DuplicateCheckCandidate[] = [];
    const recoverableFailedItems: TrendIngestionItem[] = [];

    for (const t of this.publishedTrends.values()) {
      existingPublishedTrends.push({
        id: t.id,
        title: t.title,
        domainSlug: t.domainSlug,
        tags: t.tags,
      });
      existingCandidates.push({
        id: t.id,
        kind: 'published_trend',
        urlHash: t.urlHash,
        canonicalUrl: t.canonicalUrl,
        title: t.title,
        contentHash: t.contentHash,
        excerpt: t.summary,
      });
    }

    for (const item of this.items.values()) {
      if (item.stage === 'FAILED') {
        recoverableFailedItems.push(structuredClone(item));
      } else if (item.stage !== 'REJECTED') {
        existingCandidates.push({
          id: item.id,
          kind: 'ingestion_item',
          urlHash: item.source.urlHash,
          canonicalUrl: item.source.canonicalUrl,
          title: item.aiDraft?.title || item.source.rawTitle,
          contentHash: item.source.contentHash,
          excerpt: item.source.sanitizedExcerpt.slice(0, 500),
        });
      }
    }

    return { existingCandidates, existingPublishedTrends, recoverableFailedItems };
  }

  async persistExecutionOutput(output: {
    run: TrendIngestionRun;
    items: TrendIngestionItem[];
    corroborationUpdates: Array<{
      targetKind: 'published_trend' | 'ingestion_item';
      targetId: string;
      corroboratingSource: TrendCorroboratingSource;
    }>;
  }): Promise<void> {
    this.runs.set(output.run.id, structuredClone(output.run));
    for (const item of output.items) {
      this.items.set(item.id, structuredClone(item));
    }
    for (const update of output.corroborationUpdates) {
      if (update.targetKind !== 'ingestion_item') continue;
      const existing = this.items.get(update.targetId);
      if (!existing) continue;
      if (!existing.corroboratingSources.some((c) => c.urlHash === update.corroboratingSource.urlHash)) {
        existing.corroboratingSources = [
          ...existing.corroboratingSources,
          update.corroboratingSource,
        ].slice(0, 15);
        existing.updatedAtIso = new Date().toISOString();
      }
    }
  }

  // Test helpers
  getStoredItems(): TrendIngestionItem[] {
    return Array.from(this.items.values()).map((i) => structuredClone(i));
  }

  getStoredRuns(): TrendIngestionRun[] {
    return Array.from(this.runs.values()).map((r) => structuredClone(r));
  }
}

// ==========================================
// 2. Firebase Admin SDK Firestore Store (Cloud Functions & IAM Production Servers)
// ==========================================

export class FirestoreAdminTrendAutomationStore implements TrendAutomationStore {
  readonly mode = 'firestore_admin' as const;
  private readonly db: Firestore;

  constructor(projectId: string, existingDb?: Firestore) {
    if (existingDb) {
      this.db = existingDb;
    } else {
      const app = getAdminApps().length
        ? getAdminApp()
        : initializeAdminApp({ projectId });
      this.db = getAdminFirestore(app);
    }
  }

  private get configRef() {
    return this.db.collection(AUTOMATION_COLLECTION).doc(AUTOMATION_CONFIG_DOC_ID);
  }

  private get stateRef() {
    return this.db.collection(AUTOMATION_COLLECTION).doc(AUTOMATION_STATE_DOC_ID);
  }

  async getConfig(): Promise<TrendAutomationConfig | null> {
    const snap = await this.configRef.get();
    if (!snap.exists) return null;
    return { ...(snap.data() as TrendAutomationConfig), id: 'config' };
  }

  async saveConfig(config: TrendAutomationConfig): Promise<TrendAutomationConfig> {
    const clean = stripUndefinedDeep({ ...config, id: 'config' as const });
    await this.configRef.set(clean, { merge: false });
    return clean;
  }

  async getState(): Promise<TrendAutomationState | null> {
    const snap = await this.stateRef.get();
    if (!snap.exists) return null;
    return { ...(snap.data() as TrendAutomationState), id: 'state' };
  }

  async saveState(state: TrendAutomationState): Promise<TrendAutomationState> {
    const clean = stripUndefinedDeep({ ...state, id: 'state' as const });
    await this.stateRef.set(clean, { merge: false });
    return clean;
  }

  async acquireLock(req: LockAcquireRequest): Promise<LockAcquireResult> {
    const nowMs = req.nowMs ?? Date.now();
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(this.stateRef);
      const current: TrendAutomationState = snap.exists
        ? { ...createDefaultAutomationState(), ...(snap.data() as Partial<TrendAutomationState>), id: 'state' }
        : createDefaultAutomationState(new Date(nowMs).toISOString());

      if (isLockStillValid(current, nowMs)) {
        return {
          acquired: false,
          existingLock: {
            runId: current.lockRunId ?? null,
            owner: current.lockOwner ?? null,
            triggerMode: current.lockTriggerMode ?? null,
            acquiredAtIso: current.lockAcquiredAtIso ?? null,
            expiresAtIso: current.lockExpiresAtIso ?? null,
          },
        };
      }

      const reclaimed = Boolean(current.locked);
      const acquiredAtIso = new Date(nowMs).toISOString();
      const expiresAtIso = new Date(nowMs + req.leaseMinutes * 60_000).toISOString();

      const nextState: TrendAutomationState = {
        ...current,
        id: 'state',
        locked: true,
        lockRunId: req.runId,
        lockOwner: req.ownerId,
        lockTriggerMode: req.triggerMode,
        lockAcquiredAtIso: acquiredAtIso,
        lockExpiresAtIso: expiresAtIso,
        updatedAtIso: acquiredAtIso,
      };

      tx.set(this.stateRef, stripUndefinedDeep(nextState));
      return { acquired: true, reclaimedStaleLock: reclaimed };
    });
  }

  async renewLock(runId: string, leaseMinutes: number, nowMs = Date.now()): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(this.stateRef);
      if (!snap.exists) return false;
      const current = snap.data() as TrendAutomationState;
      if (!current.locked || current.lockRunId !== runId) return false;
      const nowIso = new Date(nowMs).toISOString();
      tx.set(
        this.stateRef,
        stripUndefinedDeep({
          ...current,
          id: 'state',
          lockExpiresAtIso: new Date(nowMs + leaseMinutes * 60_000).toISOString(),
          updatedAtIso: nowIso,
        })
      );
      return true;
    });
  }

  async releaseLock(
    runId: string,
    stateUpdate: Partial<TrendAutomationState>,
    nowMs = Date.now()
  ): Promise<TrendAutomationState> {
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(this.stateRef);
      const nowIso = new Date(nowMs).toISOString();
      const current: TrendAutomationState = snap.exists
        ? { ...createDefaultAutomationState(nowIso), ...(snap.data() as Partial<TrendAutomationState>), id: 'state' }
        : createDefaultAutomationState(nowIso);

      const shouldClearLock = !current.locked || current.lockRunId === runId;
      const nextState: TrendAutomationState = {
        ...current,
        ...stateUpdate,
        id: 'state',
        ...(shouldClearLock
          ? {
              locked: false,
              lockRunId: null,
              lockOwner: null,
              lockTriggerMode: null,
              lockAcquiredAtIso: null,
              lockExpiresAtIso: null,
            }
          : {}),
        updatedAtIso: nowIso,
      };

      tx.set(this.stateRef, stripUndefinedDeep(nextState));
      return nextState;
    });
  }

  async listRecentRuns(limit = 20): Promise<TrendIngestionRun[]> {
    const snap = await this.db
      .collection(INGESTION_RUNS_COLLECTION)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ ...(d.data() as TrendIngestionRun), id: d.id }));
  }

  async loadDedupeAndRecoveryContext(options?: {
    maxPublished?: number;
    maxItems?: number;
  }): Promise<HeadlessDedupeContext> {
    const maxPublished = options?.maxPublished ?? 50;
    const maxItems = options?.maxItems ?? 120;

    const [publishedSnap, itemsSnap] = await Promise.all([
      this.db
        .collection(TRENDZ_COLLECTION)
        .where('status', '==', 'published')
        .orderBy('publishedAt', 'desc')
        .limit(maxPublished)
        .get()
        .catch(async () =>
          this.db.collection(TRENDZ_COLLECTION).where('status', '==', 'published').limit(maxPublished).get()
        ),
      this.db
        .collection(INGESTION_ITEMS_COLLECTION)
        .orderBy('updatedAtIso', 'desc')
        .limit(maxItems)
        .get()
        .catch(async () => this.db.collection(INGESTION_ITEMS_COLLECTION).limit(maxItems).get()),
    ]);

    const existingPublishedTrends: ExistingPublishedTrendContext[] = [];
    const existingCandidates: DuplicateCheckCandidate[] = [];
    const recoverableFailedItems: TrendIngestionItem[] = [];

    for (const docSnap of publishedSnap.docs) {
      const data = docSnap.data() as any;
      const domainSlug = normalizeServerDomainSlug(data?.domainSlug) || 'technology';
      existingPublishedTrends.push({
        id: docSnap.id,
        title: String(data?.title || ''),
        domainSlug,
        tags: Array.isArray(data?.tags) ? data.tags.slice(0, 10).map(String) : [],
      });
      existingCandidates.push({
        id: docSnap.id,
        kind: 'published_trend',
        urlHash: String(data?.source?.urlHash || ''),
        canonicalUrl: typeof data?.source?.url === 'string' ? data.source.url : undefined,
        title: String(data?.title || ''),
        contentHash: typeof data?.contentHash === 'string' ? data.contentHash : undefined,
        excerpt: typeof data?.summary === 'string' ? data.summary.slice(0, 500) : undefined,
      });
    }

    for (const docSnap of itemsSnap.docs) {
      const item = { ...(docSnap.data() as TrendIngestionItem), id: docSnap.id };
      if (item.stage === 'FAILED') {
        recoverableFailedItems.push(item);
      } else if (item.stage !== 'REJECTED') {
        existingCandidates.push({
          id: item.id,
          kind: 'ingestion_item',
          urlHash: item.source?.urlHash || '',
          canonicalUrl: item.source?.canonicalUrl,
          title: item.aiDraft?.title || item.source?.rawTitle || '',
          contentHash: item.source?.contentHash,
          excerpt: (item.source?.sanitizedExcerpt || '').slice(0, 500),
        });
      }
    }

    return { existingCandidates, existingPublishedTrends, recoverableFailedItems };
  }

  async persistExecutionOutput(output: {
    run: TrendIngestionRun;
    items: TrendIngestionItem[];
    corroborationUpdates: Array<{
      targetKind: 'published_trend' | 'ingestion_item';
      targetId: string;
      corroboratingSource: TrendCorroboratingSource;
    }>;
  }): Promise<void> {
    await this.db
      .collection(INGESTION_RUNS_COLLECTION)
      .doc(output.run.id)
      .set(stripUndefinedDeep({ ...output.run, updatedAt: FieldValue.serverTimestamp() }));

    for (const item of output.items) {
      await this.db
        .collection(INGESTION_ITEMS_COLLECTION)
        .doc(item.id)
        .set(
          stripUndefinedDeep({
            ...item,
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );
    }

    for (const update of output.corroborationUpdates) {
      if (update.targetKind !== 'ingestion_item') continue;
      const ref = this.db.collection(INGESTION_ITEMS_COLLECTION).doc(update.targetId);
      await this.db
        .runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const current = snap.data() as TrendIngestionItem;
          const existing = Array.isArray(current.corroboratingSources)
            ? current.corroboratingSources
            : [];
          if (existing.some((c) => c.urlHash === update.corroboratingSource.urlHash)) return;
          tx.update(ref, {
            corroboratingSources: stripUndefinedDeep([...existing, update.corroboratingSource]).slice(0, 15),
            updatedAtIso: new Date().toISOString(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        })
        .catch((err) => {
          console.warn('[TRENDZ_AUTOMATION] Corroboration merge skipped:', err?.message || err);
        });
    }
  }
}

// ==========================================
// 3. Firestore REST Store (Delegated Admin Bearer Token for Preview / Non-IAM Node)
// ==========================================

function decodeRestValue(raw: any): any {
  if (!raw || typeof raw !== 'object') return undefined;
  if ('nullValue' in raw) return null;
  if ('stringValue' in raw) return String(raw.stringValue);
  if ('booleanValue' in raw) return Boolean(raw.booleanValue);
  if ('integerValue' in raw) {
    const n = Number(raw.integerValue);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  if ('doubleValue' in raw) {
    const n = Number(raw.doubleValue);
    return Number.isFinite(n) ? n : 0;
  }
  if ('timestampValue' in raw) return String(raw.timestampValue);
  if ('arrayValue' in raw) {
    const vals = Array.isArray(raw.arrayValue?.values) ? raw.arrayValue.values : [];
    return vals.map(decodeRestValue).filter((v: any) => v !== undefined);
  }
  if ('mapValue' in raw) {
    const fields = raw.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      const decoded = decodeRestValue(v);
      if (decoded !== undefined) out[k] = decoded;
    }
    return out;
  }
  return undefined;
}

function encodeRestValue(val: any): Record<string, any> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map(encodeRestValue),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeRestValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeRestDocument(doc: any): { id: string; data: Record<string, any>; updateTime?: string } {
  const name = typeof doc?.name === 'string' ? doc.name : '';
  const id = name.split('/').pop() || '';
  const data = decodeRestValue({ mapValue: { fields: doc?.fields || {} } }) || {};
  return { id, data, updateTime: doc?.updateTime };
}

export class FirestoreRestTrendAutomationStore implements TrendAutomationStore {
  readonly mode = 'firestore_rest' as const;
  private readonly baseUrl: string;
  private readonly bearerToken: string;

  constructor(projectId: string, bearerToken: string) {
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
    this.bearerToken = bearerToken;
  }

  private async restGet(docPath: string): Promise<{ exists: boolean; data?: Record<string, any>; updateTime?: string }> {
    const res = await fetch(`${this.baseUrl}/${docPath}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.bearerToken}` },
    });
    if (res.status === 404) return { exists: false };
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Firestore REST GET ${docPath} failed (${res.status}): ${txt.slice(0, 180)}`);
    }
    const json = await res.json();
    const decoded = decodeRestDocument(json);
    return { exists: true, data: decoded.data, updateTime: decoded.updateTime };
  }

  private async restPut(
    docPath: string,
    payload: Record<string, any>,
    precondition?: { exists?: boolean; updateTime?: string }
  ): Promise<{ ok: boolean; conflict?: boolean }> {
    const clean = stripUndefinedDeep(payload);
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(clean)) {
      if (v !== undefined) fields[k] = encodeRestValue(v);
    }

    const url = new URL(`${this.baseUrl}/${docPath}`);
    if (precondition?.exists !== undefined) {
      url.searchParams.set('currentDocument.exists', String(precondition.exists));
    }
    if (precondition?.updateTime) {
      url.searchParams.set('currentDocument.updateTime', precondition.updateTime);
    }

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (res.status === 409 || res.status === 412) {
      return { ok: false, conflict: true };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Firestore REST PATCH ${docPath} failed (${res.status}): ${txt.slice(0, 220)}`);
    }
    return { ok: true };
  }

  private async restListCollection(collectionName: string, pageSize = 50): Promise<Array<{ id: string; data: Record<string, any> }>> {
    const res = await fetch(`${this.baseUrl}/${collectionName}?pageSize=${pageSize}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.bearerToken}` },
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Firestore REST LIST ${collectionName} failed (${res.status}): ${txt.slice(0, 180)}`);
    }
    const json = await res.json();
    const docs = Array.isArray(json?.documents) ? json.documents : [];
    return docs.map(decodeRestDocument);
  }

  async getConfig(): Promise<TrendAutomationConfig | null> {
    const res = await this.restGet(`${AUTOMATION_COLLECTION}/${AUTOMATION_CONFIG_DOC_ID}`);
    if (!res.exists || !res.data) return null;
    return { ...(res.data as TrendAutomationConfig), id: 'config' };
  }

  async saveConfig(config: TrendAutomationConfig): Promise<TrendAutomationConfig> {
    const clean = stripUndefinedDeep({ ...config, id: 'config' as const });
    await this.restPut(`${AUTOMATION_COLLECTION}/${AUTOMATION_CONFIG_DOC_ID}`, clean);
    return clean;
  }

  async getState(): Promise<TrendAutomationState | null> {
    const res = await this.restGet(`${AUTOMATION_COLLECTION}/${AUTOMATION_STATE_DOC_ID}`);
    if (!res.exists || !res.data) return null;
    return { ...(res.data as TrendAutomationState), id: 'state' };
  }

  async saveState(state: TrendAutomationState): Promise<TrendAutomationState> {
    const clean = stripUndefinedDeep({ ...state, id: 'state' as const });
    await this.restPut(`${AUTOMATION_COLLECTION}/${AUTOMATION_STATE_DOC_ID}`, clean);
    return clean;
  }

  async acquireLock(req: LockAcquireRequest): Promise<LockAcquireResult> {
    const nowMs = req.nowMs ?? Date.now();
    const docPath = `${AUTOMATION_COLLECTION}/${AUTOMATION_STATE_DOC_ID}`;
    const existing = await this.restGet(docPath);
    const current: TrendAutomationState =
      existing.exists && existing.data
        ? { ...createDefaultAutomationState(), ...(existing.data as Partial<TrendAutomationState>), id: 'state' }
        : createDefaultAutomationState(new Date(nowMs).toISOString());

    if (isLockStillValid(current, nowMs)) {
      return {
        acquired: false,
        existingLock: {
          runId: current.lockRunId ?? null,
          owner: current.lockOwner ?? null,
          triggerMode: current.lockTriggerMode ?? null,
          acquiredAtIso: current.lockAcquiredAtIso ?? null,
          expiresAtIso: current.lockExpiresAtIso ?? null,
        },
      };
    }

    const reclaimed = Boolean(current.locked);
    const acquiredAtIso = new Date(nowMs).toISOString();
    const expiresAtIso = new Date(nowMs + req.leaseMinutes * 60_000).toISOString();

    const nextState: TrendAutomationState = {
      ...current,
      id: 'state',
      locked: true,
      lockRunId: req.runId,
      lockOwner: req.ownerId,
      lockTriggerMode: req.triggerMode,
      lockAcquiredAtIso: acquiredAtIso,
      lockExpiresAtIso: expiresAtIso,
      updatedAtIso: acquiredAtIso,
    };

    const write = await this.restPut(
      docPath,
      nextState,
      existing.exists ? { updateTime: existing.updateTime } : { exists: false }
    );

    if (!write.ok && write.conflict) {
      return { acquired: false };
    }

    return { acquired: true, reclaimedStaleLock: reclaimed };
  }

  async renewLock(runId: string, leaseMinutes: number, nowMs = Date.now()): Promise<boolean> {
    const docPath = `${AUTOMATION_COLLECTION}/${AUTOMATION_STATE_DOC_ID}`;
    const existing = await this.restGet(docPath);
    if (!existing.exists || !existing.data) return false;
    const current = existing.data as TrendAutomationState;
    if (!current.locked || current.lockRunId !== runId) return false;
    const nowIso = new Date(nowMs).toISOString();
    const write = await this.restPut(
      docPath,
      {
        ...current,
        id: 'state',
        lockExpiresAtIso: new Date(nowMs + leaseMinutes * 60_000).toISOString(),
        updatedAtIso: nowIso,
      },
      { updateTime: existing.updateTime }
    );
    return write.ok;
  }

  async releaseLock(
    runId: string,
    stateUpdate: Partial<TrendAutomationState>,
    nowMs = Date.now()
  ): Promise<TrendAutomationState> {
    const docPath = `${AUTOMATION_COLLECTION}/${AUTOMATION_STATE_DOC_ID}`;
    const existing = await this.restGet(docPath);
    const nowIso = new Date(nowMs).toISOString();
    const current: TrendAutomationState =
      existing.exists && existing.data
        ? { ...createDefaultAutomationState(nowIso), ...(existing.data as Partial<TrendAutomationState>), id: 'state' }
        : createDefaultAutomationState(nowIso);

    const shouldClearLock = !current.locked || current.lockRunId === runId;
    const nextState: TrendAutomationState = {
      ...current,
      ...stateUpdate,
      id: 'state',
      ...(shouldClearLock
        ? {
            locked: false,
            lockRunId: null,
            lockOwner: null,
            lockTriggerMode: null,
            lockAcquiredAtIso: null,
            lockExpiresAtIso: null,
          }
        : {}),
      updatedAtIso: nowIso,
    };

    await this.restPut(docPath, nextState);
    return nextState;
  }

  async listRecentRuns(limit = 20): Promise<TrendIngestionRun[]> {
    const docs = await this.restListCollection(INGESTION_RUNS_COLLECTION, Math.min(100, limit * 2));
    return docs
      .map((d) => ({ ...(d.data as TrendIngestionRun), id: d.id }))
      .sort((a, b) => Date.parse(b.startedAt || '') - Date.parse(a.startedAt || ''))
      .slice(0, limit);
  }

  async loadDedupeAndRecoveryContext(options?: {
    maxPublished?: number;
    maxItems?: number;
  }): Promise<HeadlessDedupeContext> {
    const [trendDocs, itemDocs] = await Promise.all([
      this.restListCollection(TRENDZ_COLLECTION, options?.maxPublished ?? 50).catch(() => []),
      this.restListCollection(INGESTION_ITEMS_COLLECTION, options?.maxItems ?? 120).catch(() => []),
    ]);

    const existingPublishedTrends: ExistingPublishedTrendContext[] = [];
    const existingCandidates: DuplicateCheckCandidate[] = [];
    const recoverableFailedItems: TrendIngestionItem[] = [];

    for (const d of trendDocs) {
      if (d.data?.status !== 'published') continue;
      const domainSlug = normalizeServerDomainSlug(d.data?.domainSlug) || 'technology';
      existingPublishedTrends.push({
        id: d.id,
        title: String(d.data?.title || ''),
        domainSlug,
        tags: Array.isArray(d.data?.tags) ? d.data.tags.slice(0, 10).map(String) : [],
      });
      existingCandidates.push({
        id: d.id,
        kind: 'published_trend',
        urlHash: String(d.data?.source?.urlHash || ''),
        canonicalUrl: typeof d.data?.source?.url === 'string' ? d.data.source.url : undefined,
        title: String(d.data?.title || ''),
        contentHash: typeof d.data?.contentHash === 'string' ? d.data.contentHash : undefined,
        excerpt: typeof d.data?.summary === 'string' ? d.data.summary.slice(0, 500) : undefined,
      });
    }

    for (const d of itemDocs) {
      const item = { ...(d.data as TrendIngestionItem), id: d.id };
      if (item.stage === 'FAILED') {
        recoverableFailedItems.push(item);
      } else if (item.stage !== 'REJECTED') {
        existingCandidates.push({
          id: item.id,
          kind: 'ingestion_item',
          urlHash: item.source?.urlHash || '',
          canonicalUrl: item.source?.canonicalUrl,
          title: item.aiDraft?.title || item.source?.rawTitle || '',
          contentHash: item.source?.contentHash,
          excerpt: (item.source?.sanitizedExcerpt || '').slice(0, 500),
        });
      }
    }

    return { existingCandidates, existingPublishedTrends, recoverableFailedItems };
  }

  async persistExecutionOutput(output: {
    run: TrendIngestionRun;
    items: TrendIngestionItem[];
    corroborationUpdates: Array<{
      targetKind: 'published_trend' | 'ingestion_item';
      targetId: string;
      corroboratingSource: TrendCorroboratingSource;
    }>;
  }): Promise<void> {
    await this.restPut(`${INGESTION_RUNS_COLLECTION}/${output.run.id}`, output.run);

    for (const item of output.items) {
      await this.restPut(`${INGESTION_ITEMS_COLLECTION}/${item.id}`, item);
    }

    for (const update of output.corroborationUpdates) {
      if (update.targetKind !== 'ingestion_item') continue;
      try {
        const docPath = `${INGESTION_ITEMS_COLLECTION}/${update.targetId}`;
        const existing = await this.restGet(docPath);
        if (!existing.exists || !existing.data) continue;
        const current = existing.data as TrendIngestionItem;
        const sources = Array.isArray(current.corroboratingSources) ? current.corroboratingSources : [];
        if (sources.some((s) => s.urlHash === update.corroboratingSource.urlHash)) continue;
        await this.restPut(
          docPath,
          {
            ...current,
            corroboratingSources: [...sources, update.corroboratingSource].slice(0, 15),
            updatedAtIso: new Date().toISOString(),
          },
          { updateTime: existing.updateTime }
        );
      } catch (err: any) {
        console.warn('[TRENDZ_AUTOMATION_REST] Corroboration merge skipped:', err?.message || err);
      }
    }
  }
}

/**
 * Returns true when this Node runtime has explicit server-side Firebase Admin credentials
 * (Cloud Functions, Cloud Run with GCP ADC, service account JSON, or Firestore emulator).
 */
export function hasServerSideFirestoreAdminCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FUNCTION_TARGET ||
      process.env.K_SERVICE ||
      process.env.TRENDZ_USE_ADMIN_FIRESTORE === 'true'
  );
}
