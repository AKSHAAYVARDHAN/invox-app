import { auth } from '../firebase';
import type { GeminiChatContent } from './geminiService';
import type { TrendzDomainSlug } from '../utils/trendzDomains';
import {
  createSampleTrendConversation,
  deleteSampleTrendConversation,
  getLastActiveTrendConversationId,
  getSampleTrendConversation,
  listSampleTrendConversations,
  renameSampleTrendConversation,
  setLastActiveTrendConversationId,
} from '../utils/trendzSampleConversationStorage';

export type TrendContextualAiMode = 'live' | 'dev_fallback';

export interface TrendContextualAiContextSummary {
  schemaVersion: 1;
  trendId: string;
  mode: TrendContextualAiMode;
  contextHash: string;
  builtAtIso: string;
  trendIdentity: {
    headline: string;
    domainSlug: TrendzDomainSlug;
    domainName: string;
    category: string | null;
    publishedAtIso: string | null;
    publishedOn: string | null;
    region: string | null;
    language: string | null;
    tags: string[];
    searchKeywords: string[];
  };
  sourceEvidence: {
    publisherName: string;
    sourceDomain: string | null;
    author: string | null;
    credibilityTier: 'primary' | 'reputable' | 'trade' | null;
    originalUrl: string | null;
    canonicalUrl: string | null;
    discoveredAtIso: string | null;
    lastVerifiedAtIso: string | null;
    verificationStatus: 'verified' | 'unavailable' | 'unverified';
    verificationScope: 'url_reachability_only';
    verificationNote: string;
    isSimulated: boolean;
    excerpt: string | null;
    excerptCompleteness: 'full_excerpt' | 'truncated' | 'unavailable';
    additionalSources: Array<{
      name: string;
      url: string;
      publishedOn: string | null;
    }>;
    evidenceSufficiency: 'strong' | 'partial' | 'limited';
    evidenceWarnings: string[];
  };
  editorialBriefing: {
    origin: 'invox_ai_editorial_briefing';
    summary: string | null;
    detailedBriefing: string | null;
    whyItMatters: string | null;
    keyTakeaways: string[];
    aiModel: string | null;
    groundingStatus: 'verified' | 'needs_review' | 'unknown';
  };
  relatedTrends: Array<{
    id: string;
    headline: string;
    domainSlug: TrendzDomainSlug;
    domainName: string;
    category: string | null;
    summary: string | null;
    whyItMatters?: string | null;
    keyTakeaways?: string[];
    tags?: string[];
    publishedAtIso: string | null;
    publisherName?: string | null;
    sourceDomain?: string | null;
    originalUrl?: string | null;
    verificationStatus?: 'verified' | 'unavailable' | 'unverified';
    excerpt?: string | null;
    excerptCompleteness?: 'full_excerpt' | 'truncated' | 'unavailable';
    isSimulated?: boolean;
    relationReasons?: string[];
    relevanceScore?: number;
  }>;
  limits: {
    maxTotalChars: number;
    totalSerializedChars: number;
    truncatedFields: string[];
  };
}

export interface PrepareTrendAiContextResponse {
  context: TrendContextualAiContextSummary;
  cached: boolean;
}

export interface TrendAiMessageGrounding {
  verificationStatus: 'verified' | 'unavailable' | 'unverified';
  verificationScope: 'url_reachability_only';
  excerptCompleteness: 'full_excerpt' | 'truncated' | 'unavailable';
  evidenceSufficiency: 'strong' | 'partial' | 'limited';
  evidenceWarnings: string[];
  isSimulated: boolean;
  sourceAttribution: {
    publisherName: string;
    sourceDomain: string | null;
    originalUrl: string | null;
    canonicalUrl: string | null;
  };
}

export interface TrendAiConversationSummary {
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

export type TrendCitationSourceType =
  | 'primary_source'
  | 'additional_source'
  | 'related_trend_source'
  | 'editorial_briefing';

export type TrendEvidenceGroundingBasis =
  | 'source_cited'
  | 'editorial_cited'
  | 'source_available_uncited'
  | 'limited_evidence';

export interface TrendAiCitationRecord {
  id: string;
  trendId: string;
  sourceType: TrendCitationSourceType;
  publisher: string;
  sourceTitle: string;
  url: string | null;
  publishedAt: string | null;
  excerpt: string;
  citedInText: boolean;
  isSimulated: boolean;
  verificationStatus: 'verified' | 'unavailable' | 'unverified';
  excerptCompleteness: 'full_excerpt' | 'truncated' | 'unavailable';
}

export interface TrendAiEvidenceAssessment {
  groundingBasis: TrendEvidenceGroundingBasis;
  citedSourceCount: number;
  citedEditorialCount: number;
  retrievedEvidenceCount: number;
  hasDirectSourceExcerpts: boolean;
}

export interface TrendAiPersistedMessage {
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

export interface TrendAiConversationDetail {
  conversation: TrendAiConversationSummary;
  messages: TrendAiPersistedMessage[];
}

export interface TrendContextualAiQueryResponse {
  answer: string;
  sessionId: string;
  trendId: string;
  mode: TrendContextualAiMode;
  model: string;
  contextHash: string;
  cachedContext: boolean;
  turnCount: number;
  grounding: TrendAiMessageGrounding;
  citations: TrendAiCitationRecord[];
  evidenceAssessment: TrendAiEvidenceAssessment;
  conversation?: TrendAiConversationSummary;
  userMessage?: TrendAiPersistedMessage;
  assistantMessage?: TrendAiPersistedMessage;
  memorySummary: string;
  summarizedMessageCount: number;
  didSummarize: boolean;
  deduplicated?: boolean;
}

export const TREND_AI_CLIENT_MAX_QUESTION_CHARS = 2_000;
export const TREND_AI_CLIENT_MAX_TITLE_CHARS = 140;

export class TrendContextualAiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly isAuthError: boolean;
  readonly isRateLimited: boolean;
  readonly isTrendUnavailable: boolean;
  readonly isConversationNotFound: boolean;
  readonly isContextMismatch: boolean;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'TrendContextualAiClientError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.isAuthError = params.status === 401 || params.code === 'AUTH_REQUIRED';
    this.isRateLimited = params.status === 429 || params.code === 'RATE_LIMITED';
    this.isConversationNotFound = params.code === 'CONVERSATION_NOT_FOUND';
    this.isTrendUnavailable =
      params.code === 'TREND_NOT_FOUND' ||
      params.code === 'TREND_UNPUBLISHED' ||
      params.code === 'SAMPLE_TREND_NOT_FOUND' ||
      params.code === 'TREND_UNAVAILABLE';
    this.isContextMismatch =
      params.status === 409 || params.code === 'TREND_CONTEXT_MISMATCH';
    this.retryable =
      params.status === 0 ||
      params.status === 408 ||
      params.status === 429 ||
      params.status >= 500 ||
      this.isContextMismatch;
  }
}

interface ClientContextCacheEntry {
  expiresAt: number;
  response: PrepareTrendAiContextResponse;
}

const CLIENT_CONTEXT_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes (aligned under 5m server cache)
const CLIENT_CONTEXT_CACHE_MAX_ENTRIES = 30;
const clientContextCache = new Map<string, ClientContextCacheEntry>();

function buildClientCacheKey(uid: string, mode: TrendContextualAiMode, trendId: string): string {
  return `${uid}::${mode}::${trendId.trim()}`;
}

export function getCachedTrendContextualAiContext(params: {
  userId?: string | null;
  mode: TrendContextualAiMode;
  trendId: string;
}): PrepareTrendAiContextResponse | null {
  const uid = params.userId || auth.currentUser?.uid;
  if (!uid) return null;
  const key = buildClientCacheKey(uid, params.mode, params.trendId);
  const entry = clientContextCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    clientContextCache.delete(key);
    return null;
  }
  return entry.response;
}

export function clearTrendContextualAiContextCache(): void {
  clientContextCache.clear();
}

export function generateClientMessageId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `cm_${rand}`;
}

export { getLastActiveTrendConversationId, setLastActiveTrendConversationId };

async function getAuthenticatedTrendAiHeaders(): Promise<{
  uid: string;
  headers: Record<string, string>;
}> {
  const user = auth.currentUser;
  if (!user) {
    throw new TrendContextualAiClientError({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Please sign in to ask questions about this trend.',
    });
  }
  try {
    const idToken = await user.getIdToken();
    return {
      uid: user.uid,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    };
  } catch {
    throw new TrendContextualAiClientError({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Your session expired. Please sign in again to continue.',
    });
  }
}

async function parseErrorResponse(
  response: Response,
  fallbackMessage: string
): Promise<TrendContextualAiClientError> {
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  const rawCode = typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : '';
  const code =
    rawCode ||
    (response.status === 429
      ? 'RATE_LIMITED'
      : response.status === 401
        ? 'AUTH_REQUIRED'
        : response.status === 404
          ? 'TREND_NOT_FOUND'
          : response.status === 409
            ? 'TREND_CONTEXT_MISMATCH'
            : `HTTP_${response.status}`);

  const rawMessage =
    typeof body?.error === 'string' && body.error.trim()
      ? body.error.trim()
      : response.status === 429
        ? 'Too many AI requests in a short period. Please wait a moment and try again.'
        : fallbackMessage;

  const details =
    body?.details && typeof body.details === 'object'
      ? (body.details as Record<string, unknown>)
      : undefined;

  return new TrendContextualAiClientError({
    status: response.status,
    code,
    message: rawMessage,
    details,
  });
}

/**
 * Prepares and retrieves a server-validated, source-grounded context payload for a single trend.
 */
export async function prepareTrendContextualAiContext(params: {
  trendId: string;
  mode?: TrendContextualAiMode;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<PrepareTrendAiContextResponse> {
  const mode: TrendContextualAiMode = params.mode === 'dev_fallback' ? 'dev_fallback' : 'live';
  const { uid, headers } = await getAuthenticatedTrendAiHeaders();
  const cacheKey = buildClientCacheKey(uid, mode, params.trendId);

  if (!params.forceRefresh) {
    const cached = clientContextCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        context: cached.response.context,
        cached: true,
      };
    }
  }

  let response: Response;
  try {
    response = await fetch('/api/trendz/ai/context', {
      method: 'POST',
      headers,
      signal: params.signal,
      body: JSON.stringify({
        trendId: params.trendId,
        mode,
        forceRefresh: params.forceRefresh === true,
      }),
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network error while loading trend context. Check your connection and try again.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to prepare trend AI context (HTTP ${response.status}).`
    );
  }

  const data = (await response.json()) as PrepareTrendAiContextResponse;

  if (clientContextCache.size >= CLIENT_CONTEXT_CACHE_MAX_ENTRIES) {
    const oldestKey = clientContextCache.keys().next().value;
    if (oldestKey) clientContextCache.delete(oldestKey);
  }
  clientContextCache.set(cacheKey, {
    expiresAt: Date.now() + CLIENT_CONTEXT_CACHE_TTL_MS,
    response: data,
  });

  return data;
}

// ==========================================
// Phase 07.3: Persistent Conversation Management Client API
// ==========================================

export async function listTrendAiConversations(params: {
  mode: TrendContextualAiMode;
  trendId?: string;
  userId?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TrendAiConversationSummary[]> {
  if (params.mode === 'dev_fallback') {
    const uid = params.userId || auth.currentUser?.uid;
    if (!uid) return [];
    return listSampleTrendConversations(uid, { trendId: params.trendId });
  }

  const { headers } = await getAuthenticatedTrendAiHeaders();
  const qs = new URLSearchParams();
  if (params.trendId) qs.set('trendId', params.trendId);
  if (params.limit) qs.set('limit', String(params.limit));
  const queryStr = qs.toString();

  let response: Response;
  try {
    response = await fetch(`/api/trendz/ai/conversations${queryStr ? `?${queryStr}` : ''}`, {
      method: 'GET',
      headers,
      signal: params.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to load conversation history. Check your connection and retry.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to load saved conversations (HTTP ${response.status}).`
    );
  }

  const body = (await response.json()) as { conversations?: TrendAiConversationSummary[] };
  return Array.isArray(body?.conversations) ? body.conversations : [];
}

export async function getTrendAiConversation(params: {
  mode: TrendContextualAiMode;
  conversationId: string;
  userId?: string | null;
  signal?: AbortSignal;
}): Promise<TrendAiConversationDetail> {
  if (params.mode === 'dev_fallback') {
    const uid = params.userId || auth.currentUser?.uid;
    if (!uid) {
      throw new TrendContextualAiClientError({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Please sign in to load saved conversations.',
      });
    }
    const found = getSampleTrendConversation(uid, params.conversationId);
    if (!found) {
      throw new TrendContextualAiClientError({
        status: 404,
        code: 'CONVERSATION_NOT_FOUND',
        message: 'This sample conversation could not be found or was deleted.',
      });
    }
    return found;
  }

  const { headers } = await getAuthenticatedTrendAiHeaders();
  let response: Response;
  try {
    response = await fetch(
      `/api/trendz/ai/conversations/${encodeURIComponent(params.conversationId)}`,
      {
        method: 'GET',
        headers,
        signal: params.signal,
      }
    );
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to load this conversation. Check your connection and try again.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to load this conversation (HTTP ${response.status}).`
    );
  }

  return (await response.json()) as TrendAiConversationDetail;
}

export async function createTrendAiConversation(params: {
  mode: TrendContextualAiMode;
  trendId: string;
  trendMeta: {
    trendTitle: string;
    trendDomainSlug: TrendzDomainSlug;
    trendDomainName: string;
    trendPublisher: string;
  };
  title?: string;
  userId?: string | null;
  signal?: AbortSignal;
}): Promise<TrendAiConversationSummary> {
  if (params.mode === 'dev_fallback') {
    const uid = params.userId || auth.currentUser?.uid;
    if (!uid) {
      throw new TrendContextualAiClientError({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Please sign in to create a conversation.',
      });
    }
    return createSampleTrendConversation(uid, {
      trendId: params.trendId,
      trendTitle: params.trendMeta.trendTitle,
      trendDomainSlug: params.trendMeta.trendDomainSlug,
      trendDomainName: params.trendMeta.trendDomainName,
      trendPublisher: params.trendMeta.trendPublisher,
      title: params.title,
    });
  }

  const { headers } = await getAuthenticatedTrendAiHeaders();
  let response: Response;
  try {
    response = await fetch('/api/trendz/ai/conversations', {
      method: 'POST',
      headers,
      signal: params.signal,
      body: JSON.stringify({
        trendId: params.trendId,
        title: params.title,
      }),
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to start a saved conversation right now.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to create conversation (HTTP ${response.status}).`
    );
  }

  const body = (await response.json()) as { conversation: TrendAiConversationSummary };
  return body.conversation;
}

export async function renameTrendAiConversation(params: {
  mode: TrendContextualAiMode;
  conversationId: string;
  title: string;
  userId?: string | null;
  signal?: AbortSignal;
}): Promise<TrendAiConversationSummary> {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    throw new TrendContextualAiClientError({
      status: 400,
      code: 'INVALID_CONVERSATION_TITLE',
      message: 'Conversation title cannot be empty.',
    });
  }

  if (params.mode === 'dev_fallback') {
    const uid = params.userId || auth.currentUser?.uid;
    if (!uid) {
      throw new TrendContextualAiClientError({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Please sign in to rename conversations.',
      });
    }
    const updated = renameSampleTrendConversation(uid, params.conversationId, cleanTitle);
    if (!updated) {
      throw new TrendContextualAiClientError({
        status: 404,
        code: 'CONVERSATION_NOT_FOUND',
        message: 'This conversation could not be found.',
      });
    }
    return updated;
  }

  const { headers } = await getAuthenticatedTrendAiHeaders();
  let response: Response;
  try {
    response = await fetch(
      `/api/trendz/ai/conversations/${encodeURIComponent(params.conversationId)}`,
      {
        method: 'PATCH',
        headers,
        signal: params.signal,
        body: JSON.stringify({ title: cleanTitle }),
      }
    );
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network error while renaming conversation. Please try again.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to rename conversation (HTTP ${response.status}).`
    );
  }

  const body = (await response.json()) as { conversation: TrendAiConversationSummary };
  return body.conversation;
}

export async function deleteTrendAiConversation(params: {
  mode: TrendContextualAiMode;
  conversationId: string;
  userId?: string | null;
  signal?: AbortSignal;
}): Promise<{ deleted: boolean; conversationId: string }> {
  if (params.mode === 'dev_fallback') {
    const uid = params.userId || auth.currentUser?.uid;
    if (!uid) {
      throw new TrendContextualAiClientError({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Please sign in to delete conversations.',
      });
    }
    const deleted = deleteSampleTrendConversation(uid, params.conversationId);
    if (!deleted) {
      throw new TrendContextualAiClientError({
        status: 404,
        code: 'CONVERSATION_NOT_FOUND',
        message: 'This conversation could not be found or was already deleted.',
      });
    }
    return { deleted: true, conversationId: params.conversationId };
  }

  const { headers } = await getAuthenticatedTrendAiHeaders();
  let response: Response;
  try {
    response = await fetch(
      `/api/trendz/ai/conversations/${encodeURIComponent(params.conversationId)}`,
      {
        method: 'DELETE',
        headers,
        signal: params.signal,
      }
    );
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network error while deleting conversation. Please try again.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to delete conversation (HTTP ${response.status}).`
    );
  }

  return (await response.json()) as { deleted: boolean; conversationId: string };
}

/**
 * Sends a contextual question scoped to a single published (or DEV_FALLBACK sample) trend
 * to the server-side Gemini endpoint, with persistent live Firestore history or DEV_FALLBACK
 * rolling multi-turn memory parity.
 */
export async function queryTrendContextualAi(params: {
  trendId: string;
  question: string;
  mode?: TrendContextualAiMode;
  sessionId?: string;
  conversationId?: string;
  clientMessageId?: string;
  persist?: boolean;
  history?: GeminiChatContent[];
  memorySummary?: string;
  summarizedMessageCount?: number;
  signal?: AbortSignal;
}): Promise<TrendContextualAiQueryResponse> {
  const mode: TrendContextualAiMode = params.mode === 'dev_fallback' ? 'dev_fallback' : 'live';
  const { headers } = await getAuthenticatedTrendAiHeaders();

  let response: Response;
  try {
    response = await fetch('/api/trendz/ai/query', {
      method: 'POST',
      headers,
      signal: params.signal,
      body: JSON.stringify({
        trendId: params.trendId,
        question: params.question,
        mode,
        sessionId: params.sessionId,
        conversationId: params.conversationId,
        clientMessageId: params.clientMessageId,
        persist: mode === 'live' ? params.persist !== false : false,
        history: params.history,
        memorySummary: params.memorySummary,
        summarizedMessageCount: params.summarizedMessageCount,
      }),
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new TrendContextualAiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Connection interrupted before the AI response arrived. Please retry.',
    });
  }

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
      `Unable to answer this question right now (HTTP ${response.status}).`
    );
  }

  return (await response.json()) as TrendContextualAiQueryResponse;
}
