import crypto from 'crypto';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import type { TrendContextPayload } from './trendContextBuilder';
import {
  EVIDENCE_RETRIEVAL_LIMITS,
  type TrendAiCitationRecord,
  type TrendAiEvidenceAssessment,
} from './trendEvidenceRetrieval';

export const TREND_CONVERSATION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
export const TREND_CONVERSATION_MAX_LIST_LIMIT = 50;
export const TREND_CONVERSATION_MAX_MESSAGES = 1_000;
export const TREND_MESSAGE_MAX_TEXT_CHARS = 16_000;

export interface TrendAiMessageGrounding {
  verificationStatus: TrendContextPayload['sourceEvidence']['verificationStatus'];
  verificationScope: 'url_reachability_only';
  excerptCompleteness: TrendContextPayload['sourceEvidence']['excerptCompleteness'];
  evidenceSufficiency: TrendContextPayload['sourceEvidence']['evidenceSufficiency'];
  evidenceWarnings: string[];
  isSimulated: boolean;
  sourceAttribution: {
    publisherName: string;
    sourceDomain: string | null;
    originalUrl: string | null;
    canonicalUrl: string | null;
  };
}

export interface TrendAiConversationRecord {
  id: string;
  userId: string;
  trendId: string;
  trendTitle: string;
  trendDomainSlug: TrendzDomainSlug;
  trendDomainName: string;
  trendPublisher: string;
  title: string;
  lastMessagePreview: string;
  messageCount: number;
  memorySummary: string;
  summarizedMessageCount: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface TrendAiMessageRecord {
  id: string;
  conversationId: string;
  userId: string;
  trendId: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'complete' | 'partial' | 'error';
  sequence: number;
  clientMessageId?: string;
  model?: string;
  grounding?: TrendAiMessageGrounding;
  citations?: TrendAiCitationRecord[];
  evidenceAssessment?: TrendAiEvidenceAssessment;
  createdAtIso: string;
}

export interface TrendConversationStoreContext {
  userId: string;
  bearerToken: string;
  projectId: string;
}

export interface TrendConversationStore {
  listConversations(
    ctx: TrendConversationStoreContext,
    options?: { trendId?: string; limit?: number }
  ): Promise<TrendAiConversationRecord[]>;
  getConversation(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<TrendAiConversationRecord | null>;
  createConversation(
    ctx: TrendConversationStoreContext,
    conversation: TrendAiConversationRecord
  ): Promise<TrendAiConversationRecord>;
  updateConversation(
    ctx: TrendConversationStoreContext,
    conversation: TrendAiConversationRecord
  ): Promise<TrendAiConversationRecord>;
  deleteConversation(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<boolean>;
  listMessages(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<TrendAiMessageRecord[]>;
  appendMessage(
    ctx: TrendConversationStoreContext,
    message: TrendAiMessageRecord
  ): Promise<TrendAiMessageRecord>;
}

export class TrendConversationStoreError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'TrendConversationStoreError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isValidTrendConversationId(id: unknown): id is string {
  return typeof id === 'string' && TREND_CONVERSATION_ID_PATTERN.test(id.trim());
}

export function generateTrendConversationId(): string {
  return `tc_${crypto.randomBytes(12).toString('hex')}`;
}

export function generateTrendMessageId(sequence: number): string {
  const padded = String(Math.max(0, Math.trunc(sequence))).padStart(6, '0');
  return `tm_${padded}_${crypto.randomBytes(6).toString('hex')}`;
}

const VALID_DOMAIN_SLUGS = new Set<string>([
  'technology',
  'health-care',
  'trading',
  'stock-market',
  'design',
  'finance',
  'science',
  'gaming',
  'art',
  'automotive',
  'space',
]);

function normalizeDomainSlug(value: unknown): TrendzDomainSlug {
  if (typeof value === 'string' && VALID_DOMAIN_SLUGS.has(value)) {
    return value as TrendzDomainSlug;
  }
  return 'technology';
}

// ==========================================
// Firestore REST Value Encoding / Decoding
// ==========================================

function decodeRestValue(raw: any): unknown {
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
    const values = Array.isArray(raw.arrayValue?.values) ? raw.arrayValue.values : [];
    return values.map((v: any) => decodeRestValue(v));
  }
  if ('mapValue' in raw) {
    const fields = raw.mapValue?.fields;
    if (!fields || typeof fields !== 'object') return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeRestValue(v);
    }
    return out;
  }
  return undefined;
}

function decodeRestDoc(docJson: any): Record<string, unknown> | null {
  if (!docJson || typeof docJson !== 'object' || !docJson.fields) return null;
  const decoded: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(docJson.fields)) {
    decoded[key] = decodeRestValue(val);
  }
  return decoded;
}

function encodeRestValue(value: unknown, options?: { isTimestamp?: boolean }): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (options?.isTimestamp && typeof value === 'string') {
    const parsed = new Date(value);
    const iso = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    return { timestampValue: iso };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeRestValue(item)),
      },
    };
  }
  if (typeof value === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeRestValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function encodeConversationToRestFields(
  conv: TrendAiConversationRecord
): Record<string, unknown> {
  return {
    id: encodeRestValue(conv.id),
    userId: encodeRestValue(conv.userId),
    trendId: encodeRestValue(conv.trendId),
    trendTitle: encodeRestValue(conv.trendTitle.slice(0, 240)),
    trendDomainSlug: encodeRestValue(normalizeDomainSlug(conv.trendDomainSlug)),
    trendDomainName: encodeRestValue(conv.trendDomainName.slice(0, 80)),
    trendPublisher: encodeRestValue(conv.trendPublisher.slice(0, 160)),
    title: encodeRestValue(conv.title.slice(0, 140)),
    lastMessagePreview: encodeRestValue(conv.lastMessagePreview.slice(0, 240)),
    messageCount: encodeRestValue(Math.max(0, Math.min(TREND_CONVERSATION_MAX_MESSAGES, Math.trunc(conv.messageCount)))),
    memorySummary: encodeRestValue(conv.memorySummary.slice(0, 3_000)),
    summarizedMessageCount: encodeRestValue(
      Math.max(0, Math.min(Math.trunc(conv.messageCount), Math.trunc(conv.summarizedMessageCount)))
    ),
    createdAt: encodeRestValue(conv.createdAtIso, { isTimestamp: true }),
    updatedAt: encodeRestValue(conv.updatedAtIso, { isTimestamp: true }),
  };
}

function decodeConversationRecord(raw: Record<string, unknown>): TrendAiConversationRecord | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
  const trendId = typeof raw.trendId === 'string' ? raw.trendId.trim() : '';
  if (!id || !userId || !trendId) return null;

  const messageCount = typeof raw.messageCount === 'number' && Number.isFinite(raw.messageCount)
    ? Math.max(0, Math.trunc(raw.messageCount))
    : 0;
  const summarizedMessageCount =
    typeof raw.summarizedMessageCount === 'number' && Number.isFinite(raw.summarizedMessageCount)
      ? Math.max(0, Math.min(messageCount, Math.trunc(raw.summarizedMessageCount)))
      : 0;

  return {
    id,
    userId,
    trendId,
    trendTitle: typeof raw.trendTitle === 'string' && raw.trendTitle.trim() ? raw.trendTitle : 'Trend Briefing',
    trendDomainSlug: normalizeDomainSlug(raw.trendDomainSlug),
    trendDomainName:
      typeof raw.trendDomainName === 'string' && raw.trendDomainName.trim()
        ? raw.trendDomainName
        : 'Technology',
    trendPublisher:
      typeof raw.trendPublisher === 'string' && raw.trendPublisher.trim()
        ? raw.trendPublisher
        : 'Source',
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Trend conversation',
    lastMessagePreview: typeof raw.lastMessagePreview === 'string' ? raw.lastMessagePreview : '',
    messageCount,
    memorySummary: typeof raw.memorySummary === 'string' ? raw.memorySummary : '',
    summarizedMessageCount,
    createdAtIso: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    updatedAtIso: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };
}

function sanitizeHttpUrlOrNull(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  return /^https?:\/\/.+/.test(trimmed) ? trimmed : null;
}

function encodeMessageToRestFields(msg: TrendAiMessageRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    id: encodeRestValue(msg.id),
    conversationId: encodeRestValue(msg.conversationId),
    userId: encodeRestValue(msg.userId),
    trendId: encodeRestValue(msg.trendId),
    role: encodeRestValue(msg.role),
    text: encodeRestValue(msg.text.slice(0, TREND_MESSAGE_MAX_TEXT_CHARS)),
    status: encodeRestValue(msg.status),
    sequence: encodeRestValue(Math.max(0, Math.trunc(msg.sequence))),
    createdAt: encodeRestValue(msg.createdAtIso, { isTimestamp: true }),
  };

  if (msg.clientMessageId && msg.clientMessageId.trim()) {
    fields.clientMessageId = encodeRestValue(msg.clientMessageId.trim().slice(0, 128));
  }
  if (msg.model && msg.model.trim()) {
    fields.model = encodeRestValue(msg.model.trim().slice(0, 100));
  }
  if (msg.grounding) {
    fields.grounding = encodeRestValue({
      verificationStatus: msg.grounding.verificationStatus,
      verificationScope: 'url_reachability_only',
      excerptCompleteness: msg.grounding.excerptCompleteness,
      evidenceSufficiency: msg.grounding.evidenceSufficiency,
      evidenceWarnings: (msg.grounding.evidenceWarnings || []).slice(0, 8),
      isSimulated: Boolean(msg.grounding.isSimulated),
      sourceAttribution: {
        publisherName: (msg.grounding.sourceAttribution.publisherName || 'Source').slice(0, 160),
        sourceDomain: msg.grounding.sourceAttribution.sourceDomain
          ? msg.grounding.sourceAttribution.sourceDomain.slice(0, 255)
          : null,
        originalUrl: sanitizeHttpUrlOrNull(msg.grounding.sourceAttribution.originalUrl),
        canonicalUrl: sanitizeHttpUrlOrNull(msg.grounding.sourceAttribution.canonicalUrl),
      },
    });
  }
  if (Array.isArray(msg.citations)) {
    const boundedCitations = msg.citations
      .slice(0, EVIDENCE_RETRIEVAL_LIMITS.maxPersistedCitations)
      .map((c) => ({
        id: String(c.id || '').trim().slice(0, 16),
        trendId: String(c.trendId || msg.trendId).trim().slice(0, 128),
        sourceType:
          c.sourceType === 'primary_source' ||
          c.sourceType === 'additional_source' ||
          c.sourceType === 'editorial_briefing' ||
          c.sourceType === 'related_trend_source'
            ? c.sourceType
            : 'primary_source',
        publisher: String(c.publisher || 'Source').trim().slice(0, 160),
        sourceTitle: String(c.sourceTitle || 'Source reference').trim().slice(0, 260),
        url: sanitizeHttpUrlOrNull(c.url),
        publishedAt:
          typeof c.publishedAt === 'string' && c.publishedAt.trim()
            ? c.publishedAt.trim().slice(0, 64)
            : null,
        excerpt: String(c.excerpt || '').trim().slice(0, 460),
        citedInText: Boolean(c.citedInText),
        isSimulated: Boolean(c.isSimulated),
        verificationStatus:
          c.verificationStatus === 'verified' ||
          c.verificationStatus === 'unavailable' ||
          c.verificationStatus === 'unverified'
            ? c.verificationStatus
            : 'unverified',
        excerptCompleteness:
          c.excerptCompleteness === 'full_excerpt' ||
          c.excerptCompleteness === 'truncated' ||
          c.excerptCompleteness === 'unavailable'
            ? c.excerptCompleteness
            : 'unavailable',
      }))
      .filter((c) => Boolean(c.id));
    fields.citations = encodeRestValue(boundedCitations);
  }
  if (msg.evidenceAssessment) {
    const ea = msg.evidenceAssessment;
    fields.evidenceAssessment = encodeRestValue({
      groundingBasis:
        ea.groundingBasis === 'source_cited' ||
        ea.groundingBasis === 'editorial_cited' ||
        ea.groundingBasis === 'source_available_uncited' ||
        ea.groundingBasis === 'limited_evidence'
          ? ea.groundingBasis
          : 'limited_evidence',
      citedSourceCount: Math.max(0, Math.min(20, Math.trunc(ea.citedSourceCount || 0))),
      citedEditorialCount: Math.max(0, Math.min(20, Math.trunc(ea.citedEditorialCount || 0))),
      retrievedEvidenceCount: Math.max(
        0,
        Math.min(20, Math.trunc(ea.retrievedEvidenceCount || 0))
      ),
      hasDirectSourceExcerpts: Boolean(ea.hasDirectSourceExcerpts),
    });
  }

  return fields;
}

function decodeGrounding(raw: unknown): TrendAiMessageGrounding | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = raw as Record<string, unknown>;
  const verificationStatus =
    g.verificationStatus === 'verified' ||
    g.verificationStatus === 'unavailable' ||
    g.verificationStatus === 'unverified'
      ? g.verificationStatus
      : 'unverified';
  const excerptCompleteness =
    g.excerptCompleteness === 'full_excerpt' ||
    g.excerptCompleteness === 'truncated' ||
    g.excerptCompleteness === 'unavailable'
      ? g.excerptCompleteness
      : 'unavailable';
  const evidenceSufficiency =
    g.evidenceSufficiency === 'strong' ||
    g.evidenceSufficiency === 'partial' ||
    g.evidenceSufficiency === 'limited'
      ? g.evidenceSufficiency
      : 'limited';
  const attr =
    g.sourceAttribution && typeof g.sourceAttribution === 'object'
      ? (g.sourceAttribution as Record<string, unknown>)
      : {};

  return {
    verificationStatus,
    verificationScope: 'url_reachability_only',
    excerptCompleteness,
    evidenceSufficiency,
    evidenceWarnings: Array.isArray(g.evidenceWarnings)
      ? g.evidenceWarnings.filter((w): w is string => typeof w === 'string').slice(0, 8)
      : [],
    isSimulated: g.isSimulated === true,
    sourceAttribution: {
      publisherName:
        typeof attr.publisherName === 'string' && attr.publisherName.trim()
          ? attr.publisherName
          : 'Source',
      sourceDomain: typeof attr.sourceDomain === 'string' ? attr.sourceDomain : null,
      originalUrl: typeof attr.originalUrl === 'string' ? attr.originalUrl : null,
      canonicalUrl: typeof attr.canonicalUrl === 'string' ? attr.canonicalUrl : null,
    },
  };
}

function decodeCitations(raw: unknown): TrendAiCitationRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TrendAiCitationRecord[] = [];
  for (const item of raw.slice(0, EVIDENCE_RETRIEVAL_LIMITS.maxPersistedCitations)) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const id = typeof c.id === 'string' ? c.id.trim().slice(0, 16) : '';
    const trendId = typeof c.trendId === 'string' ? c.trendId.trim().slice(0, 128) : '';
    if (!id) continue;
    const sourceType =
      c.sourceType === 'primary_source' ||
      c.sourceType === 'additional_source' ||
      c.sourceType === 'editorial_briefing' ||
      c.sourceType === 'related_trend_source'
        ? c.sourceType
        : 'primary_source';
    const verificationStatus =
      c.verificationStatus === 'verified' ||
      c.verificationStatus === 'unavailable' ||
      c.verificationStatus === 'unverified'
        ? c.verificationStatus
        : 'unverified';
    const excerptCompleteness =
      c.excerptCompleteness === 'full_excerpt' ||
      c.excerptCompleteness === 'truncated' ||
      c.excerptCompleteness === 'unavailable'
        ? c.excerptCompleteness
        : 'unavailable';

    out.push({
      id,
      trendId,
      sourceType,
      publisher:
        typeof c.publisher === 'string' && c.publisher.trim()
          ? c.publisher.trim().slice(0, 160)
          : 'Source',
      sourceTitle:
        typeof c.sourceTitle === 'string' && c.sourceTitle.trim()
          ? c.sourceTitle.trim().slice(0, 260)
          : 'Source reference',
      url: sanitizeHttpUrlOrNull(typeof c.url === 'string' ? c.url : null),
      publishedAt:
        typeof c.publishedAt === 'string' && c.publishedAt.trim()
          ? c.publishedAt.trim().slice(0, 64)
          : null,
      excerpt: typeof c.excerpt === 'string' ? c.excerpt.slice(0, 460) : '',
      citedInText: c.citedInText === true,
      isSimulated: c.isSimulated === true,
      verificationStatus,
      excerptCompleteness,
    });
  }
  return out;
}

function decodeEvidenceAssessment(raw: unknown): TrendAiEvidenceAssessment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ea = raw as Record<string, unknown>;
  const groundingBasis =
    ea.groundingBasis === 'source_cited' ||
    ea.groundingBasis === 'editorial_cited' ||
    ea.groundingBasis === 'source_available_uncited' ||
    ea.groundingBasis === 'limited_evidence'
      ? ea.groundingBasis
      : 'limited_evidence';
  return {
    groundingBasis,
    citedSourceCount:
      typeof ea.citedSourceCount === 'number' && Number.isFinite(ea.citedSourceCount)
        ? Math.max(0, Math.trunc(ea.citedSourceCount))
        : 0,
    citedEditorialCount:
      typeof ea.citedEditorialCount === 'number' && Number.isFinite(ea.citedEditorialCount)
        ? Math.max(0, Math.trunc(ea.citedEditorialCount))
        : 0,
    retrievedEvidenceCount:
      typeof ea.retrievedEvidenceCount === 'number' && Number.isFinite(ea.retrievedEvidenceCount)
        ? Math.max(0, Math.trunc(ea.retrievedEvidenceCount))
        : 0,
    hasDirectSourceExcerpts: ea.hasDirectSourceExcerpts === true,
  };
}

function decodeMessageRecord(raw: Record<string, unknown>): TrendAiMessageRecord | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId.trim() : '';
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
  const trendId = typeof raw.trendId === 'string' ? raw.trendId.trim() : '';
  const role = raw.role === 'user' || raw.role === 'assistant' ? raw.role : null;
  const text = typeof raw.text === 'string' ? raw.text : '';
  if (!id || !conversationId || !userId || !trendId || !role || !text) return null;

  const status =
    raw.status === 'complete' || raw.status === 'partial' || raw.status === 'error'
      ? raw.status
      : 'complete';
  const sequence =
    typeof raw.sequence === 'number' && Number.isFinite(raw.sequence)
      ? Math.max(0, Math.trunc(raw.sequence))
      : 0;

  return {
    id,
    conversationId,
    userId,
    trendId,
    role,
    text,
    status,
    sequence,
    clientMessageId: typeof raw.clientMessageId === 'string' ? raw.clientMessageId : undefined,
    model: typeof raw.model === 'string' ? raw.model : undefined,
    grounding: decodeGrounding(raw.grounding),
    citations: decodeCitations(raw.citations),
    evidenceAssessment: decodeEvidenceAssessment(raw.evidenceAssessment),
    createdAtIso: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

// ==========================================
// Real Firestore REST Implementation
// ==========================================

export class FirestoreRestTrendConversationStore implements TrendConversationStore {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  private getBaseUrl(projectId: string): string {
    const cleanProject = projectId.trim();
    if (!cleanProject || !/^[a-zA-Z0-9_-]{1,100}$/.test(cleanProject)) {
      throw new TrendConversationStoreError(
        500,
        'FIREBASE_PROJECT_INVALID',
        'Invalid Firebase project configuration.'
      );
    }
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cleanProject
    )}/databases/(default)/documents`;
  }

  private async requestJson(
    url: string,
    ctx: TrendConversationStoreContext,
    init: RequestInit
  ): Promise<{ status: number; ok: boolean; json: any }> {
    if (!ctx.userId || !ctx.bearerToken) {
      throw new TrendConversationStoreError(
        401,
        'AUTH_REQUIRED',
        'Authentication is required to access saved conversations.'
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${ctx.bearerToken}`,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      const text = await response.text().catch(() => '');
      let json: any = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      if (response.status === 401) {
        throw new TrendConversationStoreError(
          401,
          'AUTH_REQUIRED',
          'Your authentication session expired. Please sign in again.'
        );
      }

      return { status: response.status, ok: response.ok, json };
    } catch (err: any) {
      if (err instanceof TrendConversationStoreError) {
        throw err;
      }
      if (err?.name === 'AbortError') {
        throw new TrendConversationStoreError(
          504,
          'CONVERSATION_STORE_TIMEOUT',
          'Timed out while syncing conversation history.'
        );
      }
      throw new TrendConversationStoreError(
        502,
        'CONVERSATION_STORE_UNAVAILABLE',
        'Unable to reach conversation storage right now.'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private assertOwned(record: { userId: string }, ctx: TrendConversationStoreContext): void {
    if (record.userId !== ctx.userId) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'You do not have permission to access this conversation.'
      );
    }
  }

  async listConversations(
    ctx: TrendConversationStoreContext,
    options?: { trendId?: string; limit?: number }
  ): Promise<TrendAiConversationRecord[]> {
    const base = this.getBaseUrl(ctx.projectId);
    const limit = Math.max(1, Math.min(options?.limit ?? TREND_CONVERSATION_MAX_LIST_LIMIT, 100));
    const url = `${base}/users/${encodeURIComponent(
      ctx.userId
    )}/trendzAiConversations?pageSize=${limit}&orderBy=${encodeURIComponent('updatedAt desc')}`;

    const res = await this.requestJson(url, ctx, { method: 'GET' });
    if (res.status === 404) {
      return [];
    }
    if (res.status === 403) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_PERMISSION_DENIED',
        'Conversation history access was denied by Firestore security rules.'
      );
    }
    if (!res.ok) {
      throw new TrendConversationStoreError(
        502,
        'CONVERSATION_LIST_FAILED',
        'Unable to load saved conversations right now.'
      );
    }

    const docs = Array.isArray(res.json?.documents) ? res.json.documents : [];
    const results: TrendAiConversationRecord[] = [];
    for (const rawDoc of docs) {
      const decoded = decodeRestDoc(rawDoc);
      if (!decoded) continue;
      const conv = decodeConversationRecord(decoded);
      if (!conv) continue;
      if (conv.userId !== ctx.userId) continue;
      if (options?.trendId && conv.trendId !== options.trendId) continue;
      results.push(conv);
    }

    results.sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso));
    return results.slice(0, limit);
  }

  async getConversation(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<TrendAiConversationRecord | null> {
    if (!isValidTrendConversationId(conversationId)) {
      throw new TrendConversationStoreError(
        400,
        'INVALID_CONVERSATION_ID',
        'Invalid conversation identifier.'
      );
    }
    const base = this.getBaseUrl(ctx.projectId);
    const url = `${base}/users/${encodeURIComponent(
      ctx.userId
    )}/trendzAiConversations/${encodeURIComponent(conversationId.trim())}`;

    const res = await this.requestJson(url, ctx, { method: 'GET' });
    if (res.status === 404) {
      return null;
    }
    if (res.status === 403) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'You do not have permission to access this conversation.'
      );
    }
    if (!res.ok) {
      throw new TrendConversationStoreError(
        502,
        'CONVERSATION_FETCH_FAILED',
        'Unable to load the selected conversation right now.'
      );
    }

    const decoded = decodeRestDoc(res.json);
    if (!decoded) return null;
    const conv = decodeConversationRecord(decoded);
    if (!conv) return null;
    this.assertOwned(conv, ctx);
    return conv;
  }

  async createConversation(
    ctx: TrendConversationStoreContext,
    conversation: TrendAiConversationRecord
  ): Promise<TrendAiConversationRecord> {
    this.assertOwned(conversation, ctx);
    if (!isValidTrendConversationId(conversation.id)) {
      throw new TrendConversationStoreError(
        400,
        'INVALID_CONVERSATION_ID',
        'Invalid conversation identifier.'
      );
    }
    const base = this.getBaseUrl(ctx.projectId);
    const url = `${base}/users/${encodeURIComponent(
      ctx.userId
    )}/trendzAiConversations?documentId=${encodeURIComponent(conversation.id)}`;

    const res = await this.requestJson(url, ctx, {
      method: 'POST',
      body: JSON.stringify({
        fields: encodeConversationToRestFields(conversation),
      }),
    });

    if (res.status === 403) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_CREATE_DENIED',
        'Unable to create conversation for this trend. Ensure the trend is published and your session is active.'
      );
    }
    if (res.status === 409) {
      throw new TrendConversationStoreError(
        409,
        'CONVERSATION_ALREADY_EXISTS',
        'A conversation with this identifier already exists.'
      );
    }
    if (!res.ok) {
      throw new TrendConversationStoreError(
        502,
        'CONVERSATION_CREATE_FAILED',
        'Unable to save a new conversation right now.'
      );
    }

    const decoded = decodeRestDoc(res.json);
    const saved = decoded ? decodeConversationRecord(decoded) : null;
    return saved ?? conversation;
  }

  async updateConversation(
    ctx: TrendConversationStoreContext,
    conversation: TrendAiConversationRecord
  ): Promise<TrendAiConversationRecord> {
    this.assertOwned(conversation, ctx);
    if (!isValidTrendConversationId(conversation.id)) {
      throw new TrendConversationStoreError(
        400,
        'INVALID_CONVERSATION_ID',
        'Invalid conversation identifier.'
      );
    }
    const base = this.getBaseUrl(ctx.projectId);
    const url = `${base}/users/${encodeURIComponent(
      ctx.userId
    )}/trendzAiConversations/${encodeURIComponent(conversation.id)}`;

    const res = await this.requestJson(url, ctx, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: encodeConversationToRestFields(conversation),
      }),
    });

    if (res.status === 404) {
      throw new TrendConversationStoreError(
        404,
        'CONVERSATION_NOT_FOUND',
        'This conversation no longer exists.'
      );
    }
    if (res.status === 403) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'You do not have permission to update this conversation.'
      );
    }
    if (!res.ok) {
      throw new TrendConversationStoreError(
        502,
        'CONVERSATION_UPDATE_FAILED',
        'Unable to update conversation metadata right now.'
      );
    }

    const decoded = decodeRestDoc(res.json);
    const saved = decoded ? decodeConversationRecord(decoded) : null;
    return saved ?? conversation;
  }

  async listMessages(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<TrendAiMessageRecord[]> {
    if (!isValidTrendConversationId(conversationId)) {
      throw new TrendConversationStoreError(
        400,
        'INVALID_CONVERSATION_ID',
        'Invalid conversation identifier.'
      );
    }
    const base = this.getBaseUrl(ctx.projectId);
    const allMessages: TrendAiMessageRecord[] = [];
    let pageToken = '';

    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({
        pageSize: '200',
        orderBy: 'sequence',
      });
      if (pageToken) {
        qs.set('pageToken', pageToken);
      }
      const url = `${base}/users/${encodeURIComponent(
        ctx.userId
      )}/trendzAiConversations/${encodeURIComponent(
        conversationId.trim()
      )}/messages?${qs.toString()}`;

      const res = await this.requestJson(url, ctx, { method: 'GET' });
      if (res.status === 404) {
        break;
      }
      if (res.status === 403) {
        throw new TrendConversationStoreError(
          403,
          'CONVERSATION_FORBIDDEN',
          'You do not have permission to read messages in this conversation.'
        );
      }
      if (!res.ok) {
        throw new TrendConversationStoreError(
          502,
          'CONVERSATION_MESSAGES_FAILED',
          'Unable to load messages for this conversation right now.'
        );
      }

      const docs = Array.isArray(res.json?.documents) ? res.json.documents : [];
      for (const rawDoc of docs) {
        const decoded = decodeRestDoc(rawDoc);
        if (!decoded) continue;
        const msg = decodeMessageRecord(decoded);
        if (!msg) continue;
        if (msg.userId !== ctx.userId || msg.conversationId !== conversationId.trim()) continue;
        allMessages.push(msg);
      }

      pageToken = typeof res.json?.nextPageToken === 'string' ? res.json.nextPageToken : '';
      if (!pageToken || allMessages.length >= TREND_CONVERSATION_MAX_MESSAGES) {
        break;
      }
    }

    allMessages.sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso);
    });
    return allMessages;
  }

  async appendMessage(
    ctx: TrendConversationStoreContext,
    message: TrendAiMessageRecord
  ): Promise<TrendAiMessageRecord> {
    this.assertOwned(message, ctx);
    if (
      !isValidTrendConversationId(message.conversationId) ||
      !isValidTrendConversationId(message.id)
    ) {
      throw new TrendConversationStoreError(
        400,
        'INVALID_MESSAGE_ID',
        'Invalid conversation or message identifier.'
      );
    }

    const base = this.getBaseUrl(ctx.projectId);
    const url = `${base}/users/${encodeURIComponent(
      ctx.userId
    )}/trendzAiConversations/${encodeURIComponent(
      message.conversationId
    )}/messages?documentId=${encodeURIComponent(message.id)}`;

    const res = await this.requestJson(url, ctx, {
      method: 'POST',
      body: JSON.stringify({
        fields: encodeMessageToRestFields(message),
      }),
    });

    if (res.status === 403) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'You do not have permission to write to this conversation.'
      );
    }
    if (!res.ok) {
      throw new TrendConversationStoreError(
        502,
        'MESSAGE_PERSIST_FAILED',
        'Unable to persist this message right now.'
      );
    }

    const decoded = decodeRestDoc(res.json);
    const saved = decoded ? decodeMessageRecord(decoded) : null;
    return saved ?? message;
  }

  async deleteConversation(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<boolean> {
    const existing = await this.getConversation(ctx, conversationId);
    if (!existing) {
      return false;
    }

    const base = this.getBaseUrl(ctx.projectId);
    const cleanId = conversationId.trim();

    // Cascade delete messages first while parent ownership doc still exists
    const messages = await this.listMessages(ctx, cleanId).catch(() => []);
    for (let i = 0; i < messages.length; i += 10) {
      const batch = messages.slice(i, i + 10);
      await Promise.allSettled(
        batch.map((m) =>
          this.requestJson(
            `${base}/users/${encodeURIComponent(
              ctx.userId
            )}/trendzAiConversations/${encodeURIComponent(cleanId)}/messages/${encodeURIComponent(
              m.id
            )}`,
            ctx,
            { method: 'DELETE' }
          )
        )
      );
    }

    const res = await this.requestJson(
      `${base}/users/${encodeURIComponent(
        ctx.userId
      )}/trendzAiConversations/${encodeURIComponent(cleanId)}`,
      ctx,
      { method: 'DELETE' }
    );

    if (res.status === 404) {
      return false;
    }
    if (res.status === 403) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'You do not have permission to delete this conversation.'
      );
    }
    if (!res.ok) {
      throw new TrendConversationStoreError(
        502,
        'CONVERSATION_DELETE_FAILED',
        'Unable to delete this conversation right now.'
      );
    }
    return true;
  }
}

// ==========================================
// In-Memory Store (Deterministic Automated Testing)
// ==========================================

export class InMemoryTrendConversationStore implements TrendConversationStore {
  private readonly conversations = new Map<string, TrendAiConversationRecord>();
  private readonly messages = new Map<string, TrendAiMessageRecord[]>();

  private assertOwnedOrNotFound(
    conv: TrendAiConversationRecord | undefined,
    ctx: TrendConversationStoreContext
  ): TrendAiConversationRecord | null {
    if (!conv) return null;
    if (conv.userId !== ctx.userId) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'You do not have permission to access this conversation.'
      );
    }
    return conv;
  }

  async listConversations(
    ctx: TrendConversationStoreContext,
    options?: { trendId?: string; limit?: number }
  ): Promise<TrendAiConversationRecord[]> {
    const limit = Math.max(1, Math.min(options?.limit ?? TREND_CONVERSATION_MAX_LIST_LIMIT, 100));
    const list: TrendAiConversationRecord[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.userId !== ctx.userId) continue;
      if (options?.trendId && conv.trendId !== options.trendId) continue;
      list.push({ ...conv });
    }
    list.sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso));
    return list.slice(0, limit);
  }

  async getConversation(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<TrendAiConversationRecord | null> {
    if (!isValidTrendConversationId(conversationId)) {
      throw new TrendConversationStoreError(
        400,
        'INVALID_CONVERSATION_ID',
        'Invalid conversation identifier.'
      );
    }
    const found = this.assertOwnedOrNotFound(this.conversations.get(conversationId.trim()), ctx);
    return found ? { ...found } : null;
  }

  async createConversation(
    ctx: TrendConversationStoreContext,
    conversation: TrendAiConversationRecord
  ): Promise<TrendAiConversationRecord> {
    if (conversation.userId !== ctx.userId) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'Cannot create a conversation for another user.'
      );
    }
    if (this.conversations.has(conversation.id)) {
      throw new TrendConversationStoreError(
        409,
        'CONVERSATION_ALREADY_EXISTS',
        'A conversation with this identifier already exists.'
      );
    }
    this.conversations.set(conversation.id, { ...conversation });
    this.messages.set(conversation.id, []);
    return { ...conversation };
  }

  async updateConversation(
    ctx: TrendConversationStoreContext,
    conversation: TrendAiConversationRecord
  ): Promise<TrendAiConversationRecord> {
    const existing = this.assertOwnedOrNotFound(this.conversations.get(conversation.id), ctx);
    if (!existing) {
      throw new TrendConversationStoreError(
        404,
        'CONVERSATION_NOT_FOUND',
        'This conversation no longer exists.'
      );
    }
    if (existing.trendId !== conversation.trendId) {
      throw new TrendConversationStoreError(
        409,
        'TREND_CONTEXT_MISMATCH',
        'Conversation trend binding is immutable.'
      );
    }
    this.conversations.set(conversation.id, { ...conversation });
    return { ...conversation };
  }

  async deleteConversation(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<boolean> {
    const existing = this.assertOwnedOrNotFound(this.conversations.get(conversationId.trim()), ctx);
    if (!existing) return false;
    this.conversations.delete(existing.id);
    this.messages.delete(existing.id);
    return true;
  }

  async listMessages(
    ctx: TrendConversationStoreContext,
    conversationId: string
  ): Promise<TrendAiMessageRecord[]> {
    const existing = this.assertOwnedOrNotFound(this.conversations.get(conversationId.trim()), ctx);
    if (!existing) return [];
    const list = this.messages.get(existing.id) ?? [];
    return list
      .map((m) => ({ ...m }))
      .sort((a, b) => a.sequence - b.sequence);
  }

  async appendMessage(
    ctx: TrendConversationStoreContext,
    message: TrendAiMessageRecord
  ): Promise<TrendAiMessageRecord> {
    const existing = this.assertOwnedOrNotFound(this.conversations.get(message.conversationId), ctx);
    if (!existing) {
      throw new TrendConversationStoreError(
        404,
        'CONVERSATION_NOT_FOUND',
        'This conversation no longer exists.'
      );
    }
    if (message.userId !== ctx.userId) {
      throw new TrendConversationStoreError(
        403,
        'CONVERSATION_FORBIDDEN',
        'Cannot write a message as another user.'
      );
    }
    const list = this.messages.get(existing.id) ?? [];
    list.push({ ...message });
    this.messages.set(existing.id, list);
    return { ...message };
  }
}
