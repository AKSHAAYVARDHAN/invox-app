import type { TrendzDomainSlug } from './trendzDomains';

export interface SampleTrendAiGrounding {
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

export interface SampleTrendAiConversationRecord {
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

export interface SampleTrendAiCitationRecord {
  id: string;
  trendId: string;
  sourceType:
    | 'primary_source'
    | 'additional_source'
    | 'related_trend_source'
    | 'editorial_briefing';
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

export interface SampleTrendAiEvidenceAssessment {
  groundingBasis:
    | 'source_cited'
    | 'editorial_cited'
    | 'source_available_uncited'
    | 'limited_evidence';
  citedSourceCount: number;
  citedEditorialCount: number;
  retrievedEvidenceCount: number;
  hasDirectSourceExcerpts: boolean;
}

export interface SampleTrendAiMessageRecord {
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
  grounding?: SampleTrendAiGrounding;
  citations?: SampleTrendAiCitationRecord[];
  evidenceAssessment?: SampleTrendAiEvidenceAssessment;
  createdAtIso: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredSampleBundle {
  version: 1;
  conversations: Record<string, SampleTrendAiConversationRecord>;
  messagesByConversation: Record<string, SampleTrendAiMessageRecord[]>;
}

const SAMPLE_STORAGE_PREFIX = 'invox_trendz_ai_sample_conversations_v1_';
const ACTIVE_POINTER_PREFIX = 'invox_trendz_ai_active_conv_v1_';
const MAX_SAMPLE_CONVERSATIONS_PER_USER = 40;
const MAX_SAMPLE_MESSAGES_PER_CONVERSATION = 200;
const MAX_TITLE_CHARS = 140;
const MAX_PREVIEW_CHARS = 240;

function getStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) return customStorage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSampleKey(userId: string): string {
  return `${SAMPLE_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function getActivePointerKey(userId: string): string {
  return `${ACTIVE_POINTER_PREFIX}${encodeURIComponent(userId)}`;
}

function clampText(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 3) return clean.slice(0, maxChars);
  return `${clean.slice(0, maxChars - 3).trimEnd()}...`;
}

export function deriveSampleConversationTitle(
  firstQuestion: string,
  fallbackHeadline?: string
): string {
  const collapsed = String(firstQuestion || '').replace(/\s+/g, ' ').trim();
  const base =
    collapsed ||
    String(fallbackHeadline || 'Sample trend conversation').replace(/\s+/g, ' ').trim() ||
    'Sample trend conversation';
  const targetMax = Math.min(84, MAX_TITLE_CHARS);
  if (base.length <= targetMax) return base;
  const cut = base.slice(0, targetMax);
  const lastSpace = cut.lastIndexOf(' ');
  const prefix = lastSpace > 32 ? cut.slice(0, lastSpace) : cut;
  return `${prefix.replace(/[.,;:!?-]+$/, '').trim()}...`;
}

export function buildSampleMessagePreview(text: string): string {
  const collapsed = String(text || '')
    .replace(/[#*_`>[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clampText(collapsed, MAX_PREVIEW_CHARS);
}

function createEmptyBundle(): StoredSampleBundle {
  return {
    version: 1,
    conversations: {},
    messagesByConversation: {},
  };
}

function readBundle(userId: string, storage?: StorageLike): StoredSampleBundle {
  const store = getStorage(storage);
  if (!store || !userId) return createEmptyBundle();
  try {
    const raw = store.getItem(getSampleKey(userId));
    if (!raw) return createEmptyBundle();
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== 1 ||
      !parsed.conversations ||
      typeof parsed.conversations !== 'object'
    ) {
      return createEmptyBundle();
    }
    return {
      version: 1,
      conversations: parsed.conversations as Record<string, SampleTrendAiConversationRecord>,
      messagesByConversation:
        parsed.messagesByConversation && typeof parsed.messagesByConversation === 'object'
          ? (parsed.messagesByConversation as Record<string, SampleTrendAiMessageRecord[]>)
          : {},
    };
  } catch {
    return createEmptyBundle();
  }
}

function writeBundle(userId: string, bundle: StoredSampleBundle, storage?: StorageLike): void {
  const store = getStorage(storage);
  if (!store || !userId) return;

  // Enforce bounded conversation count per user (evict oldest updated)
  const sortedIds = Object.values(bundle.conversations)
    .sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso))
    .map((c) => c.id);

  if (sortedIds.length > MAX_SAMPLE_CONVERSATIONS_PER_USER) {
    for (const staleId of sortedIds.slice(MAX_SAMPLE_CONVERSATIONS_PER_USER)) {
      delete bundle.conversations[staleId];
      delete bundle.messagesByConversation[staleId];
    }
  }

  try {
    store.setItem(getSampleKey(userId), JSON.stringify(bundle));
  } catch {
    // Attempt graceful trim if storage quota is tight
    const trimmedIds = sortedIds.slice(0, Math.max(5, Math.floor(sortedIds.length / 2)));
    const keepSet = new Set(trimmedIds);
    for (const id of Object.keys(bundle.conversations)) {
      if (!keepSet.has(id)) {
        delete bundle.conversations[id];
        delete bundle.messagesByConversation[id];
      }
    }
    try {
      store.setItem(getSampleKey(userId), JSON.stringify(bundle));
    } catch {
      // Ignore unrecoverable browser storage quota restriction
    }
  }
}

function randomId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

export function listSampleTrendConversations(
  userId: string,
  options?: { trendId?: string; storage?: StorageLike }
): SampleTrendAiConversationRecord[] {
  if (!userId) return [];
  const bundle = readBundle(userId, options?.storage);
  return Object.values(bundle.conversations)
    .filter((c) => c.userId === userId && (!options?.trendId || c.trendId === options.trendId))
    .sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso));
}

export function getSampleTrendConversation(
  userId: string,
  conversationId: string,
  options?: { storage?: StorageLike }
): {
  conversation: SampleTrendAiConversationRecord;
  messages: SampleTrendAiMessageRecord[];
} | null {
  if (!userId || !conversationId) return null;
  const bundle = readBundle(userId, options?.storage);
  const conv = bundle.conversations[conversationId];
  if (!conv || conv.userId !== userId) return null;
  const messages = (bundle.messagesByConversation[conversationId] ?? [])
    .filter((m) => m.userId === userId && m.conversationId === conversationId)
    .sort((a, b) => a.sequence - b.sequence);
  return { conversation: { ...conv }, messages: messages.map((m) => ({ ...m })) };
}

export function createSampleTrendConversation(
  userId: string,
  params: {
    trendId: string;
    trendTitle: string;
    trendDomainSlug: TrendzDomainSlug;
    trendDomainName: string;
    trendPublisher: string;
    title?: string;
    firstQuestion?: string;
  },
  options?: { storage?: StorageLike }
): SampleTrendAiConversationRecord {
  const bundle = readBundle(userId, options?.storage);
  const nowIso = new Date().toISOString();
  const id = randomId('stc');
  const title = params.title?.trim()
    ? clampText(params.title.trim(), MAX_TITLE_CHARS)
    : deriveSampleConversationTitle(params.firstQuestion || '', params.trendTitle);

  const record: SampleTrendAiConversationRecord = {
    id,
    userId,
    trendId: params.trendId,
    trendTitle: clampText(params.trendTitle || 'Sample Trend', 240),
    trendDomainSlug: params.trendDomainSlug,
    trendDomainName: clampText(params.trendDomainName || 'Technology', 80),
    trendPublisher: clampText(params.trendPublisher || 'Sample Source', 160),
    title,
    lastMessagePreview: params.firstQuestion
      ? buildSampleMessagePreview(params.firstQuestion)
      : '',
    messageCount: 0,
    memorySummary: '',
    summarizedMessageCount: 0,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  bundle.conversations[id] = record;
  bundle.messagesByConversation[id] = [];
  writeBundle(userId, bundle, options?.storage);
  return { ...record };
}

export function appendSampleUserMessage(
  userId: string,
  conversationId: string,
  params: {
    text: string;
    clientMessageId?: string;
  },
  options?: { storage?: StorageLike }
): {
  conversation: SampleTrendAiConversationRecord;
  message: SampleTrendAiMessageRecord;
  alreadyExists: boolean;
  existingAssistantReply?: SampleTrendAiMessageRecord;
} | null {
  const bundle = readBundle(userId, options?.storage);
  const conv = bundle.conversations[conversationId];
  if (!conv || conv.userId !== userId) return null;

  const list = bundle.messagesByConversation[conversationId] ?? [];
  if (params.clientMessageId) {
    const matchIdx = list.findIndex(
      (m) => m.role === 'user' && m.clientMessageId === params.clientMessageId
    );
    if (matchIdx !== -1) {
      const next = list[matchIdx + 1];
      return {
        conversation: { ...conv },
        message: { ...list[matchIdx] },
        alreadyExists: true,
        existingAssistantReply:
          next && next.role === 'assistant' && next.status === 'complete'
            ? { ...next }
            : undefined,
      };
    }
  }

  const nextSeq = list.length > 0 ? list[list.length - 1].sequence + 1 : 0;
  const nowIso = new Date().toISOString();
  const message: SampleTrendAiMessageRecord = {
    id: randomId('stm'),
    conversationId,
    userId,
    trendId: conv.trendId,
    role: 'user',
    text: params.text.trim(),
    status: 'complete',
    sequence: nextSeq,
    clientMessageId: params.clientMessageId,
    createdAtIso: nowIso,
  };

  const nextList = [...list, message].slice(-MAX_SAMPLE_MESSAGES_PER_CONVERSATION);
  bundle.messagesByConversation[conversationId] = nextList;

  const updatedConv: SampleTrendAiConversationRecord = {
    ...conv,
    title:
      list.length === 0 &&
      (conv.title === 'Sample trend conversation' ||
        conv.title === deriveSampleConversationTitle('', conv.trendTitle))
        ? deriveSampleConversationTitle(params.text, conv.trendTitle)
        : conv.title,
    lastMessagePreview: buildSampleMessagePreview(params.text),
    messageCount: nextList.length,
    updatedAtIso: nowIso,
  };
  bundle.conversations[conversationId] = updatedConv;
  writeBundle(userId, bundle, options?.storage);

  return {
    conversation: { ...updatedConv },
    message: { ...message },
    alreadyExists: false,
  };
}

export function appendSampleAssistantMessage(
  userId: string,
  conversationId: string,
  params: {
    text: string;
    model?: string;
    grounding?: SampleTrendAiGrounding;
    citations?: SampleTrendAiCitationRecord[];
    evidenceAssessment?: SampleTrendAiEvidenceAssessment;
    memorySummary?: string;
    summarizedMessageCount?: number;
  },
  options?: { storage?: StorageLike }
): {
  conversation: SampleTrendAiConversationRecord;
  message: SampleTrendAiMessageRecord;
} | null {
  const bundle = readBundle(userId, options?.storage);
  const conv = bundle.conversations[conversationId];
  if (!conv || conv.userId !== userId) return null;

  const list = bundle.messagesByConversation[conversationId] ?? [];
  const nextSeq = list.length > 0 ? list[list.length - 1].sequence + 1 : 0;
  const nowIso = new Date().toISOString();
  const message: SampleTrendAiMessageRecord = {
    id: randomId('stm'),
    conversationId,
    userId,
    trendId: conv.trendId,
    role: 'assistant',
    text: params.text.trim(),
    status: 'complete',
    sequence: nextSeq,
    model: params.model,
    grounding: params.grounding,
    citations: Array.isArray(params.citations) ? params.citations.slice(0, 8) : undefined,
    evidenceAssessment: params.evidenceAssessment,
    createdAtIso: nowIso,
  };

  const nextList = [...list, message].slice(-MAX_SAMPLE_MESSAGES_PER_CONVERSATION);
  bundle.messagesByConversation[conversationId] = nextList;

  const updatedConv: SampleTrendAiConversationRecord = {
    ...conv,
    lastMessagePreview: buildSampleMessagePreview(params.text),
    messageCount: nextList.length,
    memorySummary:
      typeof params.memorySummary === 'string'
        ? params.memorySummary.slice(0, 3_000)
        : conv.memorySummary,
    summarizedMessageCount:
      typeof params.summarizedMessageCount === 'number' &&
      Number.isFinite(params.summarizedMessageCount)
        ? Math.max(0, Math.min(nextList.length, Math.trunc(params.summarizedMessageCount)))
        : conv.summarizedMessageCount,
    updatedAtIso: nowIso,
  };
  bundle.conversations[conversationId] = updatedConv;
  writeBundle(userId, bundle, options?.storage);

  return {
    conversation: { ...updatedConv },
    message: { ...message },
  };
}

export function renameSampleTrendConversation(
  userId: string,
  conversationId: string,
  title: string,
  options?: { storage?: StorageLike }
): SampleTrendAiConversationRecord | null {
  const cleanTitle = clampText(String(title || '').replace(/\s+/g, ' ').trim(), MAX_TITLE_CHARS);
  if (!cleanTitle) return null;
  const bundle = readBundle(userId, options?.storage);
  const conv = bundle.conversations[conversationId];
  if (!conv || conv.userId !== userId) return null;
  const updated: SampleTrendAiConversationRecord = {
    ...conv,
    title: cleanTitle,
    updatedAtIso: new Date().toISOString(),
  };
  bundle.conversations[conversationId] = updated;
  writeBundle(userId, bundle, options?.storage);
  return { ...updated };
}

export function deleteSampleTrendConversation(
  userId: string,
  conversationId: string,
  options?: { storage?: StorageLike }
): boolean {
  const bundle = readBundle(userId, options?.storage);
  const conv = bundle.conversations[conversationId];
  if (!conv || conv.userId !== userId) return false;
  delete bundle.conversations[conversationId];
  delete bundle.messagesByConversation[conversationId];
  writeBundle(userId, bundle, options?.storage);
  return true;
}

// ==========================================
// Active Conversation Restoration Pointers (Per User + Mode + Trend)
// ==========================================

function readPointerMap(userId: string, storage?: StorageLike): Record<string, string> {
  const store = getStorage(storage);
  if (!store || !userId) return {};
  try {
    const raw = store.getItem(getActivePointerKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getLastActiveTrendConversationId(params: {
  userId: string;
  mode: 'live' | 'dev_fallback';
  trendId: string;
  storage?: StorageLike;
}): string | null {
  if (!params.userId || !params.trendId) return null;
  const map = readPointerMap(params.userId, params.storage);
  const key = `${params.mode}::${params.trendId.trim()}`;
  const value = map[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function setLastActiveTrendConversationId(params: {
  userId: string;
  mode: 'live' | 'dev_fallback';
  trendId: string;
  conversationId: string | null;
  storage?: StorageLike;
}): void {
  const store = getStorage(params.storage);
  if (!store || !params.userId || !params.trendId) return;
  const map = readPointerMap(params.userId, params.storage);
  const key = `${params.mode}::${params.trendId.trim()}`;
  if (params.conversationId && params.conversationId.trim()) {
    map[key] = params.conversationId.trim();
  } else {
    delete map[key];
  }
  try {
    store.setItem(getActivePointerKey(params.userId), JSON.stringify(map));
  } catch {
    // Ignore storage quota issues for convenience pointer
  }
}
