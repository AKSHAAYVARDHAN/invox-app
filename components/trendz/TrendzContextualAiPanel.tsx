import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ClipboardIcon,
  ClockIcon,
  CloseIcon,
  InformationCircleIcon,
  PencilIcon,
  PlusIcon,
  RegenerateIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
} from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import type { GeminiChatContent } from '../../services/geminiService';
import {
  TREND_AI_CLIENT_MAX_QUESTION_CHARS,
  TREND_AI_CLIENT_MAX_TITLE_CHARS,
  TrendContextualAiClientError,
  deleteTrendAiConversation,
  generateClientMessageId,
  getCachedTrendContextualAiContext,
  getLastActiveTrendConversationId,
  getTrendAiConversation,
  listTrendAiConversations,
  prepareTrendContextualAiContext,
  queryTrendContextualAi,
  renameTrendAiConversation,
  setLastActiveTrendConversationId,
  type TrendAiCitationRecord,
  type TrendAiConversationSummary,
  type TrendAiEvidenceAssessment,
  type TrendAiMessageGrounding,
  type TrendAiPersistedMessage,
  type TrendContextualAiContextSummary,
  type TrendContextualAiMode,
} from '../../services/trendzContextualAiService';
import type { TrendViewModel } from '../../services/trendzService';
import {
  appendSampleAssistantMessage,
  appendSampleUserMessage,
  createSampleTrendConversation,
} from '../../utils/trendzSampleConversationStorage';
import {
  buildTrendConversationScopeKey,
  generateContextualFollowUpQuestions,
  generateTrendSuggestedQuestions,
  type TrendSuggestedQuestion,
} from '../../utils/trendzSuggestedQuestions';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';
import TrendzAiMarkdown from './TrendzAiMarkdown';

interface TrendzContextualAiPanelProps {
  trend: TrendViewModel;
  mode: TrendContextualAiMode;
  isOpen: boolean;
  onClose: () => void;
  onNavigateBackToFeed?: () => void;
  /** Optional callback to open a saved conversation belonging to another trend */
  onNavigateToTrendConversation?: (targetTrendId: string) => void;
  /** Optional question queued from an entry-point suggestion on the Trend Detail page */
  queuedPrompt?: { id: number; text: string } | null;
  onConsumeQueuedPrompt?: () => void;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAtIso: string;
  clientMessageId?: string;
  persisted?: boolean;
  grounding?: TrendAiMessageGrounding;
  citations?: TrendAiCitationRecord[];
  evidenceAssessment?: TrendAiEvidenceAssessment;
  additionalSources?: Array<{
    name: string;
    url: string;
    publishedOn: string | null;
  }>;
  model?: string;
}

interface PanelErrorState {
  message: string;
  code: string;
  retryable: boolean;
  isAuthError: boolean;
  isRateLimited: boolean;
  isTrendUnavailable: boolean;
  failedQuestion?: string;
  failedClientMessageId?: string;
  userMessagePersisted?: boolean;
}

const VERIFICATION_LABELS: Record<'verified' | 'unavailable' | 'unverified', string> = {
  verified: 'Source link reachable (URL check only)',
  unavailable: 'Source link unavailable',
  unverified: 'Source link unverified',
};

const EXCERPT_LABELS: Record<'full_excerpt' | 'truncated' | 'unavailable', string> = {
  full_excerpt: 'Full source excerpt available',
  truncated: 'Partial source excerpt only',
  unavailable: 'No extracted source excerpt',
};

function formatRelativeTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms <= 0) return 'Recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86_400) return `${Math.floor(diffSec / 86_400)}d ago`;
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Earlier';
  }
}

function mapPersistedMessageToUi(msg: TrendAiPersistedMessage): ConversationMessage {
  return {
    id: msg.id,
    role: msg.role,
    text: msg.text,
    createdAtIso: msg.createdAtIso,
    clientMessageId: msg.clientMessageId,
    persisted: true,
    grounding: msg.grounding,
    citations: msg.citations,
    evidenceAssessment: msg.evidenceAssessment,
    model: msg.model,
  };
}

const CopyAnswerButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        // Ignore clipboard errors gracefully
      });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap shrink-0"
      aria-label={copied ? 'Response copied' : 'Copy AI response'}
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <ClipboardIcon className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};

const GROUNDING_BASIS_LABELS: Record<
  TrendAiEvidenceAssessment['groundingBasis'],
  string
> = {
  source_cited: 'Cited directly from publisher source evidence',
  editorial_cited: 'Cited from INVOX AI editorial briefing',
  source_available_uncited: 'Grounded in available trend source record',
  limited_evidence: 'Limited source evidence available',
};

function formatCitationDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isFinite(ms)) {
    try {
      return new Date(ms).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function getCitationRoleLabel(citation: TrendAiCitationRecord): string {
  if (citation.sourceType === 'editorial_briefing') {
    return citation.isSimulated ? 'Sample Editorial Briefing' : 'INVOX Editorial Briefing';
  }
  if (citation.sourceType === 'related_trend_source') {
    return citation.isSimulated ? 'Sample Related Trend (DEV_FALLBACK)' : 'Related Trend Source';
  }
  if (citation.sourceType === 'additional_source') {
    return citation.isSimulated ? 'Sample Corroborating Source' : 'Corroborating Source';
  }
  return citation.isSimulated ? 'Sample Source (DEV_FALLBACK)' : 'Publisher Source';
}

const MessageGroundingFooter: React.FC<{
  currentTrendId: string;
  grounding: TrendAiMessageGrounding;
  citations?: TrendAiCitationRecord[];
  evidenceAssessment?: TrendAiEvidenceAssessment;
  additionalSources?: Array<{ name: string; url: string; publishedOn: string | null }>;
  highlightedCitationId?: string | null;
  expandedCitationIds: Record<string, boolean>;
  onToggleCitationExcerpt: (citationId: string) => void;
  onOpenRelatedTrend?: (targetTrendId: string) => void;
}> = ({
  currentTrendId,
  grounding,
  citations,
  evidenceAssessment,
  additionalSources,
  highlightedCitationId,
  expandedCitationIds,
  onToggleCitationExcerpt,
  onOpenRelatedTrend,
}) => {
  const primaryUrl =
    sanitizeExternalUrl(grounding.sourceAttribution.originalUrl) ||
    sanitizeExternalUrl(grounding.sourceAttribution.canonicalUrl);
  const safeAdditionalSources = (additionalSources || []).filter((src) =>
    Boolean(src.name && sanitizeExternalUrl(src.url))
  );
  const structuredCitations = Array.isArray(citations) ? citations : [];
  const hasRelatedCitations = structuredCitations.some(
    (c) => c.sourceType === 'related_trend_source'
  );
  const hasCitedRelatedTrends = structuredCitations.some(
    (c) => c.sourceType === 'related_trend_source' && c.citedInText
  );

  const showUncertaintyBanner =
    grounding.evidenceSufficiency === 'limited' ||
    grounding.excerptCompleteness !== 'full_excerpt' ||
    grounding.isSimulated ||
    grounding.evidenceWarnings.length > 0;

  return (
    <div className="mt-4 pt-3 border-t border-zinc-800/90 space-y-2.5">
      {/* Phase 07.4: Structured Evidence-Backed Citations */}
      {structuredCitations.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-200 font-medium">
              Sources & citations ({structuredCitations.length})
            </span>
            <span className="text-zinc-500">
              {hasCitedRelatedTrends
                ? 'Cross-trend synthesis across published sources'
                : evidenceAssessment
                  ? GROUNDING_BASIS_LABELS[evidenceAssessment.groundingBasis]
                  : 'Source-reported facts prioritized over AI interpretation'}
            </span>
          </div>

          <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
            {hasRelatedCitations
              ? '[S#] Primary source · [R#] Related trend · [E#] INVOX editorial · Uncited = AI analysis'
              : '[S#] Publisher source evidence · [E#] INVOX editorial briefing · Uncited commentary reflects AI analysis'}
          </p>

          <ul className="space-y-1.5" aria-label="Response citations">
            {structuredCitations.map((citation) => {
              const safeUrl = sanitizeExternalUrl(citation.url);
              const isEditorial = citation.sourceType === 'editorial_briefing';
              const isRelatedTrend = citation.sourceType === 'related_trend_source';
              const canOpenRelatedTrend = Boolean(
                isRelatedTrend &&
                  citation.trendId &&
                  citation.trendId !== currentTrendId &&
                  onOpenRelatedTrend
              );
              const isExpanded = Boolean(expandedCitationIds[citation.id]);
              const isHighlighted = highlightedCitationId === citation.id;
              const formattedDate = formatCitationDate(citation.publishedAt);
              const hasExcerpt = Boolean(citation.excerpt && citation.excerpt.trim());

              return (
                <li
                  key={citation.id}
                  className={`border transition-colors px-2.5 py-2 space-y-1.5 ${
                    isHighlighted
                      ? 'border-zinc-400 bg-zinc-950'
                      : 'border-zinc-800/90 bg-[#09090b]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-mono">
                        <span
                          className={`inline-flex items-center px-1 py-0.25 border text-[10px] font-semibold ${
                            isEditorial
                              ? 'border-zinc-700 bg-black text-zinc-300'
                              : isRelatedTrend
                                ? 'border-amber-700/80 bg-black text-amber-200'
                                : 'border-zinc-600 bg-zinc-900 text-white'
                          }`}
                        >
                          [{citation.id}]
                        </span>
                        <span className="text-zinc-200 font-medium truncate max-w-[180px]">
                          {citation.publisher}
                        </span>
                        <span className="text-zinc-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-zinc-400">{getCitationRoleLabel(citation)}</span>
                        {formattedDate && (
                          <>
                            <span className="text-zinc-600" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-zinc-500">{formattedDate}</span>
                          </>
                        )}
                      </div>

                      <p className="text-xs text-zinc-300 font-sans leading-snug break-words">
                        {citation.sourceTitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                      {hasExcerpt && (
                        <button
                          type="button"
                          onClick={() => onToggleCitationExcerpt(citation.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-zinc-800 hover:border-zinc-600 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap"
                        >
                          <span>{isExpanded ? 'Hide excerpt' : 'Excerpt'}</span>
                          <ChevronDownIcon
                            className={`w-3 h-3 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      )}
                      {canOpenRelatedTrend && (
                        <button
                          type="button"
                          onClick={() => onOpenRelatedTrend?.(citation.trendId)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-zinc-800 hover:border-zinc-500 text-[10px] font-mono text-zinc-200 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap"
                          aria-label={`Open related trend: ${citation.sourceTitle}`}
                        >
                          <span>Open trend</span>
                        </button>
                      )}
                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 border border-zinc-800 hover:border-zinc-500 text-[10px] font-mono text-zinc-200 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap"
                          aria-label={`Open source: ${citation.publisher}`}
                        >
                          <span>Source</span>
                          <ArrowUpRightIcon className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>

                  {!safeUrl && !isEditorial && (
                    <p className="text-[11px] font-mono text-zinc-500">
                      Original source link unavailable for this record.
                    </p>
                  )}

                  {isExpanded && hasExcerpt && (
                    <div className="pt-1.5 border-t border-zinc-800/80 space-y-1">
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans italic">
                        “{citation.excerpt}”
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono text-zinc-500">
                        <span>
                          {citation.citedInText
                            ? 'Referenced inline in this answer'
                            : 'Available trend source context'}
                        </span>
                        {citation.isSimulated && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-zinc-400">Simulated sample evidence</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        /* Graceful fallback for pre-Phase 07.4 persisted messages without structured citations */
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-300 font-medium">Source reference</span>
            <span className="text-zinc-500">
              Source-reported facts prioritized over AI editorial synthesis
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-sans text-zinc-300">
            {primaryUrl ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-white underline decoration-zinc-600 underline-offset-2 hover:decoration-white font-medium"
              >
                <span>{grounding.sourceAttribution.publisherName}</span>
                <ArrowUpRightIcon className="w-3.5 h-3.5 shrink-0" />
              </a>
            ) : (
              <span className="text-zinc-300 font-medium">
                {grounding.sourceAttribution.publisherName}
              </span>
            )}
            {grounding.sourceAttribution.sourceDomain && (
              <>
                <span className="text-zinc-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {grounding.sourceAttribution.sourceDomain}
                </span>
              </>
            )}
          </div>

          {safeAdditionalSources.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-400">
              <span className="text-zinc-500">Additional sources:</span>
              {safeAdditionalSources.map((src, idx) => {
                const safeUrl = sanitizeExternalUrl(src.url);
                if (!safeUrl) return null;
                return (
                  <a
                    key={`${src.name}-${idx}`}
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-zinc-300 hover:text-white underline decoration-zinc-700 underline-offset-2"
                  >
                    <span>{src.name}</span>
                    <ArrowUpRightIcon className="w-3 h-3 shrink-0" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-zinc-400">
        <span className="inline-flex items-center gap-1 text-zinc-300">
          {grounding.verificationStatus === 'verified' && (
            <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
          )}
          <span>{VERIFICATION_LABELS[grounding.verificationStatus]}</span>
        </span>
        <span className="text-zinc-700" aria-hidden="true">
          ·
        </span>
        <span>{EXCERPT_LABELS[grounding.excerptCompleteness]}</span>
        {grounding.isSimulated && (
          <>
            <span className="text-zinc-700" aria-hidden="true">
              ·
            </span>
            <span className="text-zinc-300">Development sample</span>
          </>
        )}
      </div>

      {showUncertaintyBanner && (
        <div
          className="px-3 py-2.5 bg-[#09090b] border border-zinc-800 text-xs text-zinc-300 space-y-1"
          role="note"
        >
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-200 font-medium">
            <InformationCircleIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>
              {grounding.evidenceSufficiency === 'limited'
                ? 'Limited source evidence available'
                : 'Evidence note'}
            </span>
          </div>
          {grounding.evidenceWarnings.length > 0 ? (
            <ul className="space-y-1 text-zinc-400 text-xs leading-relaxed font-sans pl-5 list-disc">
              {grounding.evidenceWarnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-400 text-xs leading-relaxed font-sans">
              Some details from the original publisher may not be present in the available excerpt.
              Consult the linked source for complete reporting.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const AssistantMessageCard: React.FC<{
  currentTrendId: string;
  msg: ConversationMessage;
  fallbackAdditionalSources?: Array<{
    name: string;
    url: string;
    publishedOn: string | null;
  }>;
  onOpenRelatedTrend?: (targetTrendId: string) => void;
}> = ({ currentTrendId, msg, fallbackAdditionalSources, onOpenRelatedTrend }) => {
  const [expandedCitationIds, setExpandedCitationIds] = useState<Record<string, boolean>>({});
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const handleToggleCitationExcerpt = useCallback((citationId: string) => {
    setExpandedCitationIds((prev) => ({
      ...prev,
      [citationId]: !prev[citationId],
    }));
  }, []);

  const handleSelectInlineCitation = useCallback((citationId: string) => {
    setExpandedCitationIds((prev) => ({
      ...prev,
      [citationId]: true,
    }));
    setHighlightedCitationId(citationId);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedCitationId(null);
    }, 2400);
  }, []);

  return (
    <article
      className="bg-black border border-zinc-800 p-4 space-y-2"
      aria-label="AI response"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-900">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
          <SparklesIcon className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="font-semibold text-white">INVOX Contextual AI</span>
        </div>
        <CopyAnswerButton text={msg.text} />
      </div>

      <div className="pt-1">
        <TrendzAiMarkdown
          content={msg.text}
          citations={msg.citations}
          onSelectCitation={handleSelectInlineCitation}
        />
      </div>

      {msg.grounding && (
        <MessageGroundingFooter
          currentTrendId={currentTrendId}
          grounding={msg.grounding}
          citations={msg.citations}
          evidenceAssessment={msg.evidenceAssessment}
          additionalSources={msg.additionalSources ?? fallbackAdditionalSources}
          highlightedCitationId={highlightedCitationId}
          expandedCitationIds={expandedCitationIds}
          onToggleCitationExcerpt={handleToggleCitationExcerpt}
          onOpenRelatedTrend={onOpenRelatedTrend}
        />
      )}
    </article>
  );
};

const TrendzContextualAiPanel: React.FC<TrendzContextualAiPanelProps> = ({
  trend,
  mode,
  isOpen,
  onClose,
  onNavigateBackToFeed,
  onNavigateToTrendConversation,
  queuedPrompt,
  onConsumeQueuedPrompt,
}) => {
  const { currentUser, loading: authLoading } = useAuth();
  const scopeKey = useMemo(
    () =>
      buildTrendConversationScopeKey({
        userId: currentUser?.uid,
        mode,
        trendId: trend.id,
      }),
    [currentUser?.uid, mode, trend.id]
  );

  // Context & active conversation state
  const [contextSummary, setContextSummary] = useState<TrendContextualAiContextSummary | null>(null);
  const [isPreparingContext, setIsPreparingContext] = useState(false);
  const [contextCached, setContextCached] = useState(false);
  const [activeConversation, setActiveConversation] = useState<TrendAiConversationSummary | null>(
    null
  );
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [memorySummary, setMemorySummary] = useState<string>('');
  const [summarizedMessageCount, setSummarizedMessageCount] = useState<number>(0);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorState, setErrorState] = useState<PanelErrorState | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showSuggestionsInChat, setShowSuggestionsInChat] = useState(false);

  // Phase 07.3: Persistent conversation history & management state
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [historyScope, setHistoryScope] = useState<'trend' | 'all'>('trend');
  const [trendConversations, setTrendConversations] = useState<TrendAiConversationSummary[]>([]);
  const [allConversations, setAllConversations] = useState<TrendAiConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [renamePendingId, setRenamePendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeScopeKeyRef = useRef<string>(scopeKey);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const queryAbortRef = useRef<AbortController | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  const conversationAbortRef = useRef<AbortController | null>(null);
  const inFlightSendRef = useRef(false);
  const isUserNearBottomRef = useRef(true);
  const lastConsumedPromptIdRef = useRef<number | null>(null);
  const hasBootstrappedScopeRef = useRef<string | null>(null);
  const userExplicitlyStartedNewRef = useRef(false);

  const sessionIdRef = useRef<string | undefined>(undefined);
  const activeConversationRef = useRef<TrendAiConversationSummary | null>(null);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const contextSummaryRef = useRef<TrendContextualAiContextSummary | null>(null);
  const memorySummaryRef = useRef<string>('');
  const summarizedCountRef = useRef<number>(0);

  sessionIdRef.current = sessionId;
  activeConversationRef.current = activeConversation;
  messagesRef.current = messages;
  contextSummaryRef.current = contextSummary;
  memorySummaryRef.current = memorySummary;
  summarizedCountRef.current = summarizedMessageCount;

  const suggestionTrendInput = useMemo(
    () => ({
      id: trend.id,
      title: trend.title,
      domainName: trend.domain?.name,
      domainSlug: trend.domainSlug,
      category: trend.category,
      publisherName: trend.details?.publishedBy,
      summary: trend.summary,
      whyItMatters: trend.whyItMatters,
      keyTakeaways: trend.keyTakeaways,
      tags: trend.tags,
      excerptCompleteness: trend.sourceExcerptCompleteness,
      groundingStatus: trend.groundingStatus,
      isFallback: mode === 'dev_fallback' || Boolean(trend.isFallback),
      hasRelatedTrends: Boolean(
        (contextSummary?.relatedTrends && contextSummary.relatedTrends.length > 0) ||
          (trend.relatedTrendIds && trend.relatedTrendIds.length > 0)
      ),
    }),
    [trend, mode, contextSummary]
  );

  const suggestedQuestions = useMemo<TrendSuggestedQuestion[]>(
    () => generateTrendSuggestedQuestions(suggestionTrendInput, contextSummary),
    [suggestionTrendInput, contextSummary]
  );

  const followUpSuggestions = useMemo<TrendSuggestedQuestion[]>(
    () =>
      messages.length === 0
        ? []
        : generateContextualFollowUpQuestions({
            trend: suggestionTrendInput,
            backendContext: contextSummary,
            messages: messages.map((m) => ({
              role: m.role,
              text: m.text,
              citations: m.citations,
              evidenceAssessment: m.evidenceAssessment,
            })),
            maxCount: 3,
          }),
    [suggestionTrendInput, contextSummary, messages]
  );

  // Strict context & conversation isolation whenever trend, data mode, or authenticated user changes
  useEffect(() => {
    activeScopeKeyRef.current = scopeKey;
    prepareAbortRef.current?.abort();
    prepareAbortRef.current = null;
    queryAbortRef.current?.abort();
    queryAbortRef.current = null;
    historyAbortRef.current?.abort();
    historyAbortRef.current = null;
    conversationAbortRef.current?.abort();
    conversationAbortRef.current = null;
    inFlightSendRef.current = false;
    hasBootstrappedScopeRef.current = null;
    userExplicitlyStartedNewRef.current = false;

    const cached = getCachedTrendContextualAiContext({
      userId: currentUser?.uid,
      mode,
      trendId: trend.id,
    });
    setContextSummary(cached?.context ?? null);
    setContextCached(Boolean(cached));
    setIsPreparingContext(false);
    setActiveConversation(null);
    setMessages([]);
    setSessionId(undefined);
    setMemorySummary('');
    setSummarizedMessageCount(0);
    setInput('');
    setIsSending(false);
    setErrorState(null);
    setShowJumpToLatest(false);
    setShowSuggestionsInChat(false);
    setShowHistoryView(false);
    setHistoryScope('trend');
    setTrendConversations([]);
    setAllConversations([]);
    setIsLoadingHistory(false);
    setIsLoadingConversation(false);
    setHistoryError(null);
    setEditingConvId(null);
    setEditingTitle('');
    setConfirmDeleteId(null);
    setStatusNotice(null);
    isUserNearBottomRef.current = true;
  }, [scopeKey, currentUser?.uid, mode, trend.id]);

  // Abort active requests on unmount
  useEffect(() => {
    return () => {
      prepareAbortRef.current?.abort();
      queryAbortRef.current?.abort();
      historyAbortRef.current?.abort();
      conversationAbortRef.current?.abort();
    };
  }, []);

  // Close drawer on Escape key (unless editing a conversation title)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingConvId) {
          setEditingConvId(null);
          setEditingTitle('');
          return;
        }
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingConvId, confirmDeleteId]);

  // Lock background body scroll on narrow mobile screens when full-screen sheet is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isNarrow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Auto-resize composer textarea cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input, isOpen, showHistoryView]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    isUserNearBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  const handleScrollMessages = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 84;
    isUserNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowJumpToLatest(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || showHistoryView) return;
    if (isUserNearBottomRef.current) {
      scrollToLatest(messages.length <= 2 ? 'auto' : 'smooth');
    } else if (messages.length > 0) {
      setShowJumpToLatest(true);
    }
  }, [messages, isSending, isOpen, showHistoryView, scrollToLatest]);

  const upsertConversationInLists = useCallback(
    (conv: TrendAiConversationSummary) => {
      const sortDesc = (items: TrendAiConversationSummary[]) =>
        [...items].sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso));

      if (conv.trendId === trend.id) {
        setTrendConversations((prev) =>
          sortDesc([conv, ...prev.filter((item) => item.id !== conv.id)])
        );
      }
      setAllConversations((prev) =>
        sortDesc([conv, ...prev.filter((item) => item.id !== conv.id)])
      );
    },
    [trend.id]
  );

  const removeConversationFromLists = useCallback((conversationId: string) => {
    setTrendConversations((prev) => prev.filter((item) => item.id !== conversationId));
    setAllConversations((prev) => prev.filter((item) => item.id !== conversationId));
  }, []);

  const toPanelError = useCallback(
    (
      err: unknown,
      failedQuestion?: string,
      failedClientMessageId?: string
    ): PanelErrorState => {
      if (err instanceof TrendContextualAiClientError) {
        return {
          message: err.message,
          code: err.code,
          retryable: err.retryable,
          isAuthError: err.isAuthError,
          isRateLimited: err.isRateLimited,
          isTrendUnavailable: err.isTrendUnavailable,
          failedQuestion,
          failedClientMessageId,
          userMessagePersisted: err.details?.userMessagePersisted === true,
        };
      }
      const fallbackMessage =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to reach Trendz Contextual AI right now. Please try again.';
      return {
        message: fallbackMessage,
        code: 'UNKNOWN_ERROR',
        retryable: true,
        isAuthError: false,
        isRateLimited: false,
        isTrendUnavailable: false,
        failedQuestion,
        failedClientMessageId,
      };
    },
    []
  );

  // Prepare grounded context once per (user, mode, trendId) when opened
  const loadContext = useCallback(
    async (forceRefresh = false) => {
      if (authLoading) return;
      if (!currentUser) {
        setErrorState({
          message: 'Please sign in to ask contextual AI questions about this trend.',
          code: 'AUTH_REQUIRED',
          retryable: false,
          isAuthError: true,
          isRateLimited: false,
          isTrendUnavailable: false,
        });
        return;
      }

      if (
        !forceRefresh &&
        contextSummaryRef.current?.trendId === trend.id &&
        contextSummaryRef.current.mode === mode
      ) {
        return;
      }

      const requestScopeKey = scopeKey;
      prepareAbortRef.current?.abort();
      const controller = new AbortController();
      prepareAbortRef.current = controller;

      setIsPreparingContext(true);
      setErrorState((prev) => (prev?.failedQuestion ? prev : null));

      try {
        const prepared = await prepareTrendContextualAiContext({
          trendId: trend.id,
          mode,
          forceRefresh,
          signal: controller.signal,
        });
        if (activeScopeKeyRef.current !== requestScopeKey) return;
        setContextSummary(prepared.context);
        setContextCached(prepared.cached);
      } catch (err: any) {
        if (err?.name === 'AbortError' || activeScopeKeyRef.current !== requestScopeKey) {
          return;
        }
        setErrorState(toPanelError(err));
      } finally {
        if (activeScopeKeyRef.current === requestScopeKey) {
          setIsPreparingContext(false);
        }
      }
    },
    [authLoading, currentUser, trend.id, mode, scopeKey, toPanelError]
  );

  // Load saved conversations list (for this trend or all trends)
  const loadConversationHistory = useCallback(
    async (scope: 'trend' | 'all'): Promise<TrendAiConversationSummary[]> => {
      if (!currentUser) return [];
      const requestScopeKey = scopeKey;
      historyAbortRef.current?.abort();
      const controller = new AbortController();
      historyAbortRef.current = controller;

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const list = await listTrendAiConversations({
          mode,
          trendId: scope === 'trend' ? trend.id : undefined,
          userId: currentUser.uid,
          limit: 50,
          signal: controller.signal,
        });
        if (activeScopeKeyRef.current !== requestScopeKey) return [];
        if (scope === 'trend') {
          setTrendConversations(list);
        } else {
          setAllConversations(list);
          setTrendConversations(list.filter((c) => c.trendId === trend.id));
        }
        return list;
      } catch (err: any) {
        if (err?.name === 'AbortError' || activeScopeKeyRef.current !== requestScopeKey) {
          return [];
        }
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Unable to load your conversation history right now.';
        setHistoryError(msg);
        return [];
      } finally {
        if (activeScopeKeyRef.current === requestScopeKey) {
          setIsLoadingHistory(false);
        }
      }
    },
    [currentUser, mode, scopeKey, trend.id]
  );

  // Load & restore a specific saved conversation
  const openSavedConversation = useCallback(
    async (conversationId: string, options?: { silentOnMissing?: boolean }) => {
      if (!currentUser) return false;
      const requestScopeKey = scopeKey;
      conversationAbortRef.current?.abort();
      const controller = new AbortController();
      conversationAbortRef.current = controller;

      setIsLoadingConversation(true);
      setStatusNotice(null);

      try {
        const detail = await getTrendAiConversation({
          mode,
          conversationId,
          userId: currentUser.uid,
          signal: controller.signal,
        });
        if (activeScopeKeyRef.current !== requestScopeKey) return false;

        if (detail.conversation.trendId !== trend.id) {
          // Guard strictly against cross-trend leakage inside the current panel
          setLastActiveTrendConversationId({
            userId: currentUser.uid,
            mode,
            trendId: detail.conversation.trendId,
            conversationId: detail.conversation.id,
          });
          if (onNavigateToTrendConversation) {
            onNavigateToTrendConversation(detail.conversation.trendId);
          }
          return false;
        }

        userExplicitlyStartedNewRef.current = false;
        setActiveConversation(detail.conversation);
        setSessionId(detail.conversation.id);
        setMemorySummary(detail.conversation.memorySummary || '');
        setSummarizedMessageCount(detail.conversation.summarizedMessageCount || 0);
        setMessages(detail.messages.map(mapPersistedMessageToUi));
        setErrorState((prev) => (prev?.isTrendUnavailable ? prev : null));
        setShowHistoryView(false);
        setShowJumpToLatest(false);
        isUserNearBottomRef.current = true;

        setLastActiveTrendConversationId({
          userId: currentUser.uid,
          mode,
          trendId: trend.id,
          conversationId: detail.conversation.id,
        });
        upsertConversationInLists(detail.conversation);
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError' || activeScopeKeyRef.current !== requestScopeKey) {
          return false;
        }
        if (err instanceof TrendContextualAiClientError && err.isConversationNotFound) {
          removeConversationFromLists(conversationId);
          if (activeConversationRef.current?.id === conversationId) {
            setActiveConversation(null);
            setMessages([]);
            setSessionId(undefined);
            setMemorySummary('');
            setSummarizedMessageCount(0);
          }
          setLastActiveTrendConversationId({
            userId: currentUser.uid,
            mode,
            trendId: trend.id,
            conversationId: null,
          });
          if (!options?.silentOnMissing) {
            setStatusNotice('That conversation was deleted. Started a fresh conversation.');
          }
          return false;
        }
        setHistoryError(
          err instanceof Error && err.message
            ? err.message
            : 'Unable to open this conversation right now.'
        );
        return false;
      } finally {
        if (activeScopeKeyRef.current === requestScopeKey) {
          setIsLoadingConversation(false);
        }
      }
    },
    [
      currentUser,
      mode,
      onNavigateToTrendConversation,
      removeConversationFromLists,
      scopeKey,
      trend.id,
      upsertConversationInLists,
    ]
  );

  // Load context + restore last active conversation when panel opens
  useEffect(() => {
    if (!isOpen || authLoading) return;
    void loadContext(false);

    if (!currentUser) return;
    if (hasBootstrappedScopeRef.current === scopeKey) return;
    hasBootstrappedScopeRef.current = scopeKey;

    const bootstrapScopeKey = scopeKey;
    void (async () => {
      const list = await loadConversationHistory('trend');
      if (activeScopeKeyRef.current !== bootstrapScopeKey) return;

      // Do not overwrite if user already launched a fresh suggested prompt or clicked New Chat
      if (
        queuedPrompt ||
        userExplicitlyStartedNewRef.current ||
        inFlightSendRef.current ||
        messagesRef.current.length > 0
      ) {
        return;
      }

      if (list.length === 0) return;

      const lastActiveId = getLastActiveTrendConversationId({
        userId: currentUser.uid,
        mode,
        trendId: trend.id,
      });

      const targetConv =
        (lastActiveId ? list.find((c) => c.id === lastActiveId) : undefined) ?? list[0];

      if (targetConv) {
        await openSavedConversation(targetConv.id, { silentOnMissing: true });
      }
    })();
  }, [
    isOpen,
    authLoading,
    currentUser,
    scopeKey,
    mode,
    trend.id,
    queuedPrompt,
    loadContext,
    loadConversationHistory,
    openSavedConversation,
  ]);

  // Refresh the "All trends" tab whenever the user switches to it inside History view
  useEffect(() => {
    if (!isOpen || !showHistoryView || !currentUser) return;
    void loadConversationHistory(historyScope);
  }, [isOpen, showHistoryView, historyScope, currentUser, loadConversationHistory]);

  // Focus composer subtly when drawer opens on desktop/tablet
  useEffect(() => {
    if (!isOpen || showHistoryView) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      const timer = window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, scopeKey, showHistoryView]);

  const sendQuestion = useCallback(
    async (
      rawQuestion: string,
      options?: {
        isRetry?: boolean;
        resetSession?: boolean;
        clientMessageId?: string;
        forceNewConversation?: boolean;
      }
    ) => {
      const trimmed = rawQuestion.trim();
      if (!trimmed) return;
      if (inFlightSendRef.current) return;
      if (trimmed.length > TREND_AI_CLIENT_MAX_QUESTION_CHARS) {
        setErrorState({
          message: `Your question exceeds the ${TREND_AI_CLIENT_MAX_QUESTION_CHARS.toLocaleString()} character limit.`,
          code: 'QUESTION_TOO_LONG',
          retryable: false,
          isAuthError: false,
          isRateLimited: false,
          isTrendUnavailable: false,
        });
        return;
      }
      if (!currentUser) {
        setErrorState({
          message: 'Please sign in to ask questions about this trend.',
          code: 'AUTH_REQUIRED',
          retryable: false,
          isAuthError: true,
          isRateLimited: false,
          isTrendUnavailable: false,
        });
        return;
      }

      const requestScopeKey = scopeKey;
      inFlightSendRef.current = true;
      setIsSending(true);
      setErrorState(null);
      setStatusNotice(null);
      setShowSuggestionsInChat(false);
      setShowHistoryView(false);

      isUserNearBottomRef.current = true;
      setShowJumpToLatest(false);

      const clientMessageId = options?.clientMessageId || generateClientMessageId();

      // Snapshot prior messages BEFORE appending the optimistic user message
      const priorMessagesSnapshot = options?.forceNewConversation
        ? []
        : options?.isRetry
          ? messagesRef.current.filter((m) => m.clientMessageId !== clientMessageId)
          : [...messagesRef.current];

      if (options?.forceNewConversation) {
        userExplicitlyStartedNewRef.current = false;
        setActiveConversation(null);
        setSessionId(undefined);
        setMemorySummary('');
        setSummarizedMessageCount(0);
        setMessages([]);
      }

      if (!options?.isRetry) {
        const userMessage: ConversationMessage = {
          id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          text: trimmed,
          createdAtIso: new Date().toISOString(),
          clientMessageId,
          persisted: false,
        };
        setMessages((prev) =>
          options?.forceNewConversation ? [userMessage] : [...prev, userMessage]
        );
        setInput('');
      }

      queryAbortRef.current?.abort();
      const controller = new AbortController();
      queryAbortRef.current = controller;

      // DEV_FALLBACK mode: persist conversation + user message in user-scoped localStorage BEFORE calling AI
      let workingSampleConv: TrendAiConversationSummary | null =
        options?.forceNewConversation || options?.resetSession
          ? null
          : activeConversationRef.current;

      if (mode === 'dev_fallback') {
        if (!workingSampleConv) {
          workingSampleConv = createSampleTrendConversation(currentUser.uid, {
            trendId: trend.id,
            trendTitle: contextSummaryRef.current?.trendIdentity.headline || trend.title || 'Sample Trend',
            trendDomainSlug:
              contextSummaryRef.current?.trendIdentity.domainSlug || trend.domainSlug || 'technology',
            trendDomainName:
              contextSummaryRef.current?.trendIdentity.domainName || trend.domain?.name || 'Technology',
            trendPublisher:
              contextSummaryRef.current?.sourceEvidence.publisherName ||
              trend.details?.publishedBy ||
              'Sample Source',
            firstQuestion: trimmed,
          });
          setActiveConversation(workingSampleConv);
          setSessionId(workingSampleConv.id);
          upsertConversationInLists(workingSampleConv);
          setLastActiveTrendConversationId({
            userId: currentUser.uid,
            mode: 'dev_fallback',
            trendId: trend.id,
            conversationId: workingSampleConv.id,
          });
        }

        const savedUser = appendSampleUserMessage(currentUser.uid, workingSampleConv.id, {
          text: trimmed,
          clientMessageId,
        });
        if (savedUser) {
          workingSampleConv = savedUser.conversation;
          setActiveConversation(savedUser.conversation);
          upsertConversationInLists(savedUser.conversation);
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === clientMessageId
                ? { ...m, id: savedUser.message.id, persisted: true }
                : m
            )
          );
          // Idempotent short-circuit if duplicate submit already has a persisted assistant reply
          if (savedUser.alreadyExists && savedUser.existingAssistantReply) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === savedUser.existingAssistantReply!.id)) return prev;
              return [...prev, mapPersistedMessageToUi(savedUser.existingAssistantReply!)];
            });
            inFlightSendRef.current = false;
            setIsSending(false);
            return;
          }
        }
      }

      const activeConversationId =
        options?.resetSession || options?.forceNewConversation
          ? undefined
          : mode === 'live'
            ? activeConversationRef.current?.id
            : undefined;

      // For DEV_FALLBACK mode, send bounded prior messages + rolling memory summary so server executes identical multi-turn memory & summarization logic
      let devFallbackHistory: GeminiChatContent[] | undefined;
      if (mode === 'dev_fallback' && priorMessagesSnapshot.length > 0) {
        const mapped: GeminiChatContent[] = priorMessagesSnapshot
          .slice(-24)
          .map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }],
          }));
        while (mapped.length > 0 && mapped[0].role !== 'user') {
          mapped.shift();
        }
        while (mapped.length > 0 && mapped[mapped.length - 1].role !== 'model') {
          mapped.pop();
        }
        if (mapped.length > 0) {
          devFallbackHistory = mapped;
        }
      }

      try {
        const response = await queryTrendContextualAi({
          trendId: trend.id,
          mode,
          question: trimmed,
          sessionId:
            mode === 'dev_fallback' && !options?.resetSession && !options?.forceNewConversation
              ? sessionIdRef.current
              : undefined,
          conversationId: activeConversationId,
          clientMessageId,
          persist: mode === 'live',
          history: devFallbackHistory,
          memorySummary:
            mode === 'dev_fallback'
              ? workingSampleConv?.memorySummary || memorySummaryRef.current
              : undefined,
          summarizedMessageCount:
            mode === 'dev_fallback'
              ? workingSampleConv?.summarizedMessageCount ?? summarizedCountRef.current
              : undefined,
          signal: controller.signal,
        });

        if (activeScopeKeyRef.current !== requestScopeKey) return;

        if (response.trendId !== trend.id || response.mode !== mode) {
          throw new TrendContextualAiClientError({
            status: 409,
            code: 'TREND_CONTEXT_MISMATCH',
            message: 'The response did not match the currently opened trend. Please retry.',
          });
        }

        setMemorySummary(response.memorySummary || '');
        setSummarizedMessageCount(response.summarizedMessageCount || 0);

        if (mode === 'live' && response.conversation) {
          setActiveConversation(response.conversation);
          setSessionId(response.conversation.id);
          upsertConversationInLists(response.conversation);
          setLastActiveTrendConversationId({
            userId: currentUser.uid,
            mode: 'live',
            trendId: trend.id,
            conversationId: response.conversation.id,
          });

          const aiMessage: ConversationMessage = response.assistantMessage
            ? {
                ...mapPersistedMessageToUi(response.assistantMessage),
                citations: response.assistantMessage.citations ?? response.citations,
                evidenceAssessment:
                  response.assistantMessage.evidenceAssessment ?? response.evidenceAssessment,
                additionalSources: contextSummaryRef.current?.sourceEvidence.additionalSources,
              }
            : {
                id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                role: 'assistant',
                text: response.answer,
                createdAtIso: new Date().toISOString(),
                persisted: true,
                grounding: response.grounding,
                citations: response.citations,
                evidenceAssessment: response.evidenceAssessment,
                additionalSources: contextSummaryRef.current?.sourceEvidence.additionalSources,
                model: response.model,
              };

          setMessages((prev) => {
            const updatedUser = prev.map((m) =>
              m.clientMessageId === clientMessageId && response.userMessage
                ? { ...m, id: response.userMessage.id, persisted: true }
                : m
            );
            if (updatedUser.some((m) => m.id === aiMessage.id)) {
              return updatedUser;
            }
            return [...updatedUser, aiMessage];
          });
        } else {
          // DEV_FALLBACK persistence of assistant message, citations & rolling memory summary
          setSessionId(response.sessionId);
          let persistedAssistantId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          if (mode === 'dev_fallback' && workingSampleConv) {
            const savedAi = appendSampleAssistantMessage(currentUser.uid, workingSampleConv.id, {
              text: response.answer,
              model: response.model,
              grounding: response.grounding,
              citations: response.citations,
              evidenceAssessment: response.evidenceAssessment,
              memorySummary: response.memorySummary,
              summarizedMessageCount: response.summarizedMessageCount,
            });
            if (savedAi) {
              persistedAssistantId = savedAi.message.id;
              setActiveConversation(savedAi.conversation);
              upsertConversationInLists(savedAi.conversation);
            }
          }

          const aiMessage: ConversationMessage = {
            id: persistedAssistantId,
            role: 'assistant',
            text: response.answer,
            createdAtIso: new Date().toISOString(),
            persisted: true,
            grounding: response.grounding,
            citations: response.citations,
            evidenceAssessment: response.evidenceAssessment,
            additionalSources: contextSummaryRef.current?.sourceEvidence.additionalSources,
            model: response.model,
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || activeScopeKeyRef.current !== requestScopeKey) {
          return;
        }

        if (err instanceof TrendContextualAiClientError) {
          // If server persisted the user message in a newly created conversation before Gemini failed,
          // capture that conversationId so retry reuses it without duplicating the user message!
          const savedConvId =
            typeof err.details?.conversationId === 'string'
              ? err.details.conversationId
              : undefined;
          const savedUserMsgId =
            typeof err.details?.userMessageId === 'string'
              ? err.details.userMessageId
              : undefined;

          if (savedConvId && mode === 'live') {
            setSessionId(savedConvId);
            setLastActiveTrendConversationId({
              userId: currentUser.uid,
              mode: 'live',
              trendId: trend.id,
              conversationId: savedConvId,
            });
            if (!activeConversationRef.current) {
              const nowIso = new Date().toISOString();
              const stubConv: TrendAiConversationSummary = {
                id: savedConvId,
                userId: currentUser.uid,
                trendId: trend.id,
                trendTitle:
                  contextSummaryRef.current?.trendIdentity.headline ||
                  trend.title ||
                  'Trend Briefing',
                trendDomainSlug:
                  contextSummaryRef.current?.trendIdentity.domainSlug ||
                  trend.domainSlug ||
                  'technology',
                trendDomainName:
                  contextSummaryRef.current?.trendIdentity.domainName ||
                  trend.domain?.name ||
                  'Technology',
                trendPublisher:
                  contextSummaryRef.current?.sourceEvidence.publisherName ||
                  trend.details?.publishedBy ||
                  'Source',
                title: trimmed.slice(0, 84),
                lastMessagePreview: trimmed.slice(0, 240),
                messageCount: 1,
                memorySummary: '',
                summarizedMessageCount: 0,
                createdAtIso: nowIso,
                updatedAtIso: nowIso,
              };
              setActiveConversation(stubConv);
              upsertConversationInLists(stubConv);
            }
            if (savedUserMsgId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.clientMessageId === clientMessageId
                    ? { ...m, id: savedUserMsgId, persisted: true }
                    : m
                )
              );
            }
          }

          if (err.isConversationNotFound) {
            if (activeConversationRef.current) {
              removeConversationFromLists(activeConversationRef.current.id);
            }
            setActiveConversation(null);
            setSessionId(undefined);
            setMemorySummary('');
            setSummarizedMessageCount(0);
            setLastActiveTrendConversationId({
              userId: currentUser.uid,
              mode,
              trendId: trend.id,
              conversationId: null,
            });
          } else if (err.isContextMismatch) {
            setActiveConversation(null);
            setSessionId(undefined);
          }
        }

        const panelErr = toPanelError(err, trimmed, clientMessageId);
        if (mode === 'dev_fallback') {
          panelErr.userMessagePersisted = true;
        }
        setErrorState(panelErr);
      } finally {
        if (activeScopeKeyRef.current === requestScopeKey) {
          inFlightSendRef.current = false;
          setIsSending(false);
        }
      }
    },
    [
      currentUser,
      scopeKey,
      trend.id,
      trend.title,
      trend.domainSlug,
      trend.domain?.name,
      trend.details?.publishedBy,
      mode,
      toPanelError,
      upsertConversationInLists,
      removeConversationFromLists,
    ]
  );

  // Consume queued suggested prompt launched directly from the Trend Detail page
  useEffect(() => {
    if (!isOpen || !queuedPrompt) return;
    if (lastConsumedPromptIdRef.current === queuedPrompt.id) return;
    if (authLoading) return;
    lastConsumedPromptIdRef.current = queuedPrompt.id;
    const promptText = queuedPrompt.text;
    onConsumeQueuedPrompt?.();
    void sendQuestion(promptText, { forceNewConversation: true });
  }, [isOpen, queuedPrompt, authLoading, onConsumeQueuedPrompt, sendQuestion]);

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isSending && !errorState?.isTrendUnavailable && input.trim()) {
        void sendQuestion(input);
      }
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSending && !errorState?.isTrendUnavailable && input.trim()) {
      void sendQuestion(input);
    }
  };

  const handleStartNewConversation = () => {
    queryAbortRef.current?.abort();
    conversationAbortRef.current?.abort();
    inFlightSendRef.current = false;
    userExplicitlyStartedNewRef.current = true;
    setIsSending(false);
    setActiveConversation(null);
    setMessages([]);
    setSessionId(undefined);
    setMemorySummary('');
    setSummarizedMessageCount(0);
    setErrorState((prev) => (prev?.isTrendUnavailable ? prev : null));
    setStatusNotice(null);
    setShowJumpToLatest(false);
    setShowSuggestionsInChat(false);
    setShowHistoryView(false);
    setEditingConvId(null);
    setConfirmDeleteId(null);
    if (currentUser) {
      setLastActiveTrendConversationId({
        userId: currentUser.uid,
        mode,
        trendId: trend.id,
        conversationId: null,
      });
    }
    window.setTimeout(() => textareaRef.current?.focus(), 60);
  };

  const handleSelectConversationItem = (conv: TrendAiConversationSummary) => {
    if (conv.trendId !== trend.id) {
      if (currentUser) {
        setLastActiveTrendConversationId({
          userId: currentUser.uid,
          mode,
          trendId: conv.trendId,
          conversationId: conv.id,
        });
      }
      if (onNavigateToTrendConversation) {
        onNavigateToTrendConversation(conv.trendId);
      } else {
        setStatusNotice(
          `This conversation belongs to "${conv.trendTitle}". Open that trend to continue.`
        );
      }
      return;
    }
    void openSavedConversation(conv.id);
  };

  const handleBeginRename = (conv: TrendAiConversationSummary) => {
    setConfirmDeleteId(null);
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (conversationId: string) => {
    const cleanTitle = editingTitle.trim();
    if (!cleanTitle || !currentUser) return;
    setRenamePendingId(conversationId);
    setHistoryError(null);
    try {
      const updated = await renameTrendAiConversation({
        mode,
        conversationId,
        title: cleanTitle,
        userId: currentUser.uid,
      });
      upsertConversationInLists(updated);
      if (activeConversationRef.current?.id === updated.id) {
        setActiveConversation(updated);
      }
      setEditingConvId(null);
      setEditingTitle('');
    } catch (err: any) {
      setHistoryError(
        err instanceof Error && err.message ? err.message : 'Unable to rename conversation.'
      );
    } finally {
      setRenamePendingId(null);
    }
  };

  const handleConfirmDelete = async (conv: TrendAiConversationSummary) => {
    if (!currentUser) return;
    setDeletePendingId(conv.id);
    setHistoryError(null);
    try {
      await deleteTrendAiConversation({
        mode,
        conversationId: conv.id,
        userId: currentUser.uid,
      });
      removeConversationFromLists(conv.id);
      setConfirmDeleteId(null);
      if (activeConversationRef.current?.id === conv.id) {
        setActiveConversation(null);
        setMessages([]);
        setSessionId(undefined);
        setMemorySummary('');
        setSummarizedMessageCount(0);
        userExplicitlyStartedNewRef.current = true;
        setLastActiveTrendConversationId({
          userId: currentUser.uid,
          mode,
          trendId: trend.id,
          conversationId: null,
        });
        setStatusNotice('Conversation deleted.');
      }
    } catch (err: any) {
      if (err instanceof TrendContextualAiClientError && err.isConversationNotFound) {
        removeConversationFromLists(conv.id);
        setConfirmDeleteId(null);
      } else {
        setHistoryError(
          err instanceof Error && err.message ? err.message : 'Unable to delete conversation.'
        );
      }
    } finally {
      setDeletePendingId(null);
    }
  };

  const handleRetryError = () => {
    if (!errorState) return;
    if (errorState.failedQuestion) {
      void sendQuestion(errorState.failedQuestion, {
        isRetry: true,
        clientMessageId: errorState.failedClientMessageId,
        resetSession:
          errorState.code === 'TREND_CONTEXT_MISMATCH' ||
          errorState.code === 'CONVERSATION_NOT_FOUND',
      });
    } else {
      void loadContext(true);
    }
  };

  if (!isOpen) {
    return null;
  }

  const effectiveHeadline = contextSummary?.trendIdentity.headline || trend.title || 'Untitled Trend';
  const effectiveDomain = contextSummary?.trendIdentity.domainName || trend.domain?.name || 'General';
  const effectivePublisher =
    contextSummary?.sourceEvidence.publisherName || trend.details?.publishedBy || 'Source';
  const isSimulatedMode =
    mode === 'dev_fallback' ||
    Boolean(contextSummary?.sourceEvidence.isSimulated || trend.isFallback);
  const isTrendBlocked = Boolean(errorState?.isTrendUnavailable);
  const isAuthBlocked = Boolean(errorState?.isAuthError) || (!authLoading && !currentUser);
  const canSubmit =
    !isSending &&
    !isLoadingConversation &&
    !isTrendBlocked &&
    !isAuthBlocked &&
    input.trim().length > 0 &&
    input.trim().length <= TREND_AI_CLIENT_MAX_QUESTION_CHARS;

  const visibleHistoryList =
    historyScope === 'trend' ? trendConversations : allConversations;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trendz-contextual-ai-title"
      onClick={onClose}
    >
      <aside
        className="relative flex flex-col w-full h-[100dvh] sm:w-[480px] lg:w-[540px] max-w-full bg-[#0c0c0e] border-l border-zinc-800 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Bound strictly to the active Trend */}
        <header className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-[#09090b]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-white shrink-0" />
                <h2
                  id="trendz-contextual-ai-title"
                  className="font-mono text-xs font-bold tracking-wider uppercase text-white truncate"
                >
                  Ask AI · Trend Briefing
                </h2>
              </div>
              <p
                className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2"
                title={effectiveHeadline}
              >
                {effectiveHeadline}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-zinc-400">
                <span>{effectiveDomain}</span>
                <span className="text-zinc-700" aria-hidden="true">
                  ·
                </span>
                <span>{effectivePublisher}</span>
                {isSimulatedMode && (
                  <>
                    <span className="text-zinc-700" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-zinc-300">Sample trend (DEV_FALLBACK)</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isAuthBlocked && (
                <button
                  type="button"
                  onClick={() => setShowHistoryView((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-2.5 py-2 border font-mono text-[11px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap shrink-0 ${
                    showHistoryView
                      ? 'bg-white text-black border-white font-bold'
                      : 'border-zinc-800 bg-[#0c0c0e] text-zinc-300 hover:text-white hover:border-zinc-600'
                  }`}
                  aria-pressed={showHistoryView}
                  title="View saved conversations"
                >
                  <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    History{trendConversations.length > 0 ? ` (${trendConversations.length})` : ''}
                  </span>
                </button>
              )}
              {!isAuthBlocked && (messages.length > 0 || activeConversation) && (
                <button
                  type="button"
                  onClick={handleStartNewConversation}
                  className="inline-flex items-center gap-1 min-h-[40px] px-2.5 py-2 border border-zinc-800 bg-[#0c0c0e] text-zinc-300 hover:text-white hover:border-zinc-600 font-mono text-[11px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap shrink-0"
                  title="Start a new conversation on this trend"
                >
                  <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">New</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center border border-zinc-800 bg-[#0c0c0e] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white shrink-0"
                aria-label="Close Ask AI panel"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Conversation State + Grounding Context Bar */}
          <div className="mt-2.5 pt-2.5 border-t border-zinc-900 space-y-1.5">
            {!isAuthBlocked && !showHistoryView && (
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                {activeConversation ? (
                  editingConvId === activeConversation.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSaveRename(activeConversation.id);
                      }}
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                    >
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        maxLength={TREND_AI_CLIENT_MAX_TITLE_CHARS}
                        autoFocus
                        aria-label="Conversation title"
                        className="flex-1 min-w-0 bg-black border border-zinc-600 px-2 py-1 text-xs text-white focus:outline-none focus:border-white font-sans"
                      />
                      <button
                        type="submit"
                        disabled={!editingTitle.trim() || renamePendingId === activeConversation.id}
                        className="px-2 py-1 bg-white text-black font-bold text-[11px] disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingConvId(null);
                          setEditingTitle('');
                        }}
                        className="px-2 py-1 border border-zinc-700 text-zinc-300 hover:text-white text-[11px]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 text-zinc-300">
                        <span className="text-zinc-500 shrink-0">Saved chat:</span>
                        <span className="truncate text-zinc-100" title={activeConversation.title}>
                          {activeConversation.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {summarizedMessageCount > 0 && (
                          <span
                            className="text-zinc-500"
                            title="Earlier turns were condensed into conversation memory to maintain multi-turn continuity within context limits."
                          >
                            Memory compacted
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleBeginRename(activeConversation)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                          title="Rename this conversation"
                          aria-label="Rename active conversation"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <div className="flex items-center justify-between gap-2 w-full text-zinc-400">
                    <span>New conversation · saves automatically on first message</span>
                    {isSimulatedMode && (
                      <span className="text-zinc-500 shrink-0">Local session</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
              {isPreparingContext ? (
                <span>Preparing grounded context for this trend...</span>
              ) : contextSummary ? (
                <span className="truncate">
                  {VERIFICATION_LABELS[contextSummary.sourceEvidence.verificationStatus]} ·{' '}
                  {EXCERPT_LABELS[contextSummary.sourceEvidence.excerptCompleteness]}
                </span>
              ) : (
                <span>Scoped strictly to this trend and its source evidence</span>
              )}
              {contextSummary && contextCached && (
                <span className="text-zinc-500 shrink-0">Context ready</span>
              )}
            </div>
          </div>
        </header>

        {/* Body: Either Conversation History View OR Active Conversation View */}
        {showHistoryView && !isAuthBlocked ? (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowHistoryView(false)}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Back to chat</span>
              </button>
              <button
                type="button"
                onClick={handleStartNewConversation}
                disabled={isTrendBlocked}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-white text-black font-mono text-xs font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>New conversation</span>
              </button>
            </div>

            {/* Scope Filter Tabs */}
            <div className="flex items-center border-b border-zinc-800" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={historyScope === 'trend'}
                onClick={() => setHistoryScope('trend')}
                className={`px-3 py-2 font-mono text-xs border-b-2 transition-colors ${
                  historyScope === 'trend'
                    ? 'border-white text-white font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                This trend ({trendConversations.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={historyScope === 'all'}
                onClick={() => setHistoryScope('all')}
                className={`px-3 py-2 font-mono text-xs border-b-2 transition-colors ${
                  historyScope === 'all'
                    ? 'border-white text-white font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All trends{allConversations.length > 0 ? ` (${allConversations.length})` : ''}
              </button>
            </div>

            {isSimulatedMode && (
              <p className="text-xs text-zinc-400 font-sans bg-black border border-zinc-800 px-3 py-2">
                DEV_FALLBACK sample conversations are saved locally in your browser and kept
                separate from live Trendz history.
              </p>
            )}

            {historyError && (
              <div
                className="bg-black border border-zinc-700 p-3 space-y-2 text-xs text-zinc-300"
                role="alert"
              >
                <p>{historyError}</p>
                <button
                  type="button"
                  onClick={() => void loadConversationHistory(historyScope)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-black font-mono text-[11px] font-bold hover:bg-zinc-200"
                >
                  <RegenerateIcon className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {isLoadingHistory ? (
              <div className="space-y-2.5" aria-busy="true">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-black border border-zinc-800 space-y-2 animate-pulse"
                  >
                    <div className="h-3.5 w-3/4 bg-zinc-900" />
                    <div className="h-3 w-full bg-zinc-900" />
                    <div className="h-2.5 w-1/3 bg-zinc-900" />
                  </div>
                ))}
              </div>
            ) : visibleHistoryList.length === 0 ? (
              <div className="bg-black border border-zinc-800 p-5 text-center space-y-2">
                <p className="font-mono text-xs text-zinc-200 font-semibold">
                  {historyScope === 'trend'
                    ? 'No saved conversations for this trend yet'
                    : 'No saved Trendz conversations yet'}
                </p>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Start asking questions about this briefing and your conversation will be saved
                  automatically so you can return anytime.
                </p>
              </div>
            ) : (
              <ul className="space-y-2" aria-label="Saved conversations">
                {visibleHistoryList.map((conv) => {
                  const isActive = activeConversation?.id === conv.id;
                  const isEditing = editingConvId === conv.id;
                  const isConfirmingDelete = confirmDeleteId === conv.id;
                  const isDifferentTrend = conv.trendId !== trend.id;

                  return (
                    <li
                      key={conv.id}
                      className={`bg-black border transition-colors ${
                        isActive ? 'border-zinc-500' : 'border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleSaveRename(conv.id);
                          }}
                          className="p-3 space-y-2"
                        >
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                            Rename conversation
                          </label>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            maxLength={TREND_AI_CLIENT_MAX_TITLE_CHARS}
                            autoFocus
                            className="w-full bg-[#09090b] border border-zinc-600 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-white font-sans"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-zinc-500">
                              {editingTitle.trim().length}/{TREND_AI_CLIENT_MAX_TITLE_CHARS}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingConvId(null);
                                  setEditingTitle('');
                                }}
                                className="px-2.5 py-1 border border-zinc-700 text-zinc-300 hover:text-white font-mono text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={!editingTitle.trim() || renamePendingId === conv.id}
                                className="px-2.5 py-1 bg-white text-black font-mono text-[11px] font-bold hover:bg-zinc-200 disabled:opacity-50"
                              >
                                {renamePendingId === conv.id ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectConversationItem(conv)}
                              className="min-w-0 flex-1 text-left space-y-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white leading-snug line-clamp-2">
                                  {conv.title}
                                </span>
                                {isActive && (
                                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-300 shrink-0">
                                    · Active
                                  </span>
                                )}
                              </div>
                              {historyScope === 'all' && (
                                <p className="text-xs font-mono text-zinc-400 truncate">
                                  {conv.trendDomainName} · {conv.trendTitle}
                                  {isDifferentTrend ? ' (opens trend)' : ''}
                                </p>
                              )}
                              {conv.lastMessagePreview && (
                                <p className="text-xs text-zinc-400 font-sans line-clamp-2 leading-relaxed">
                                  {conv.lastMessagePreview}
                                </p>
                              )}
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleBeginRename(conv)}
                                className="p-1.5 text-zinc-400 hover:text-white border border-transparent hover:border-zinc-700 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                                title="Rename conversation"
                                aria-label={`Rename ${conv.title}`}
                              >
                                <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingConvId(null);
                                  setConfirmDeleteId((prev) =>
                                    prev === conv.id ? null : conv.id
                                  );
                                }}
                                className="p-1.5 text-zinc-400 hover:text-red-300 border border-transparent hover:border-zinc-700 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                                title="Delete conversation"
                                aria-label={`Delete ${conv.title}`}
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                            <span>
                              {conv.messageCount}{' '}
                              {conv.messageCount === 1 ? 'message' : 'messages'}
                              {conv.summarizedMessageCount > 0 ? ' · Memory active' : ''}
                            </span>
                            <time
                              dateTime={conv.updatedAtIso}
                              title={new Date(conv.updatedAtIso).toLocaleString()}
                            >
                              Updated {formatRelativeTimestamp(conv.updatedAtIso)}
                            </time>
                          </div>

                          {isConfirmingDelete && (
                            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                              <span className="text-xs text-zinc-300 font-sans">
                                Permanently delete this conversation?
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1 border border-zinc-700 text-zinc-300 hover:text-white font-mono text-[11px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={deletePendingId === conv.id}
                                  onClick={() => void handleConfirmDelete(conv)}
                                  className="px-2.5 py-1 bg-red-600 text-white hover:bg-red-500 font-mono text-[11px] font-bold disabled:opacity-50"
                                >
                                  {deletePendingId === conv.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          /* Scrollable Active Conversation Body */
          <div
            ref={scrollContainerRef}
            onScroll={handleScrollMessages}
            className="relative flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4"
          >
            {statusNotice && (
              <div
                className="flex items-center justify-between gap-2 bg-black border border-zinc-800 px-3 py-2 text-xs text-zinc-300 font-sans"
                role="status"
              >
                <span>{statusNotice}</span>
                <button
                  type="button"
                  onClick={() => setStatusNotice(null)}
                  className="text-zinc-500 hover:text-white font-mono text-[11px] shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Deleted / Unavailable / Unpublished Trend Banner */}
            {isTrendBlocked && (
              <div className="bg-black border border-zinc-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-zinc-100 font-mono text-xs font-bold uppercase tracking-wider">
                  <AlertTriangleIcon className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Trend Unavailable</span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                  {errorState?.message ||
                    'This trend is no longer published or available for new AI questions.'}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {onNavigateBackToFeed && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateBackToFeed();
                      }}
                      className="min-h-[40px] px-4 py-2 bg-white text-black font-mono text-xs font-bold hover:bg-zinc-200 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                    >
                      Return to Trendz
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[40px] px-4 py-2 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 font-mono text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {isAuthBlocked ? (
              <div className="bg-black border border-zinc-800 p-4 sm:p-5 space-y-2.5">
                <p className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  Sign in required
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                  {errorState?.message ||
                    'Please sign in to start or resume an evidence-grounded conversation about this trend.'}
                </p>
              </div>
            ) : isLoadingConversation ? (
              <div className="bg-black border border-zinc-800 p-4 space-y-2.5" aria-busy="true">
                <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                  <span
                    className="w-3.5 h-3.5 border border-zinc-600 border-t-white rounded-full animate-spin shrink-0"
                    aria-hidden="true"
                  />
                  <span>Restoring saved conversation...</span>
                </div>
                <div className="space-y-2 pt-1" aria-hidden="true">
                  <div className="h-3 w-4/5 bg-zinc-900 animate-pulse" />
                  <div className="h-3 w-11/12 bg-zinc-900 animate-pulse" />
                  <div className="h-3 w-2/3 bg-zinc-900 animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                {/* Empty Conversation Welcome + Trend-Adapted Suggested Questions */}
                {messages.length === 0 && !isTrendBlocked && (
                  <div className="space-y-4">
                    <div className="bg-black border border-zinc-800 p-4 space-y-2">
                      <p className="text-sm text-zinc-200 leading-relaxed font-sans">
                        Ask anything about this briefing. Responses prioritize{' '}
                        <strong className="font-semibold text-white">source-reported evidence</strong>{' '}
                        over the INVOX AI editorial summary and flag gaps honestly.
                      </p>

                      {trendConversations.length > 0 && (
                        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-400 font-sans">
                            You have {trendConversations.length} saved{' '}
                            {trendConversations.length === 1 ? 'conversation' : 'conversations'} on
                            this trend.
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowHistoryView(true)}
                            className="font-mono text-[11px] text-white underline underline-offset-2 hover:text-zinc-300 shrink-0"
                          >
                            Resume
                          </button>
                        </div>
                      )}

                      {isSimulatedMode && (
                        <p className="text-xs text-zinc-400 leading-relaxed font-sans pt-1.5 border-t border-zinc-900">
                          You are exploring a development sample trend (DEV_FALLBACK). Conversations
                          persist locally in your browser without touching live data.
                        </p>
                      )}

                      {contextSummary &&
                        contextSummary.sourceEvidence.evidenceWarnings.length > 0 &&
                        !isSimulatedMode && (
                          <div className="pt-2 border-t border-zinc-900 space-y-1">
                            <p className="font-mono text-[11px] text-zinc-400">
                              Source evidence notes:
                            </p>
                            <ul className="list-disc pl-4 space-y-0.5 text-xs text-zinc-400 font-sans">
                              {contextSummary.sourceEvidence.evidenceWarnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>

                    {/* Contextual Suggested Questions */}
                    <div className="space-y-2">
                      <p className="font-mono text-[11px] text-zinc-400 uppercase tracking-wider">
                        Suggested questions for this trend
                      </p>
                      <div className="space-y-2">
                        {suggestedQuestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            disabled={isSending}
                            onClick={() => void sendQuestion(suggestion.prompt)}
                            className="w-full text-left p-3 bg-black border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-950 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-white group"
                          >
                            <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-1 group-hover:text-zinc-300">
                              {suggestion.label}
                            </span>
                            <span className="block text-sm text-zinc-200 group-hover:text-white leading-snug font-sans">
                              {suggestion.prompt}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Conversation Message History */}
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[88%] bg-zinc-900 border border-zinc-700 px-3.5 py-2.5 text-sm text-white leading-relaxed font-sans whitespace-pre-wrap break-words">
                        <span className="block font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
                          You
                        </span>
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <AssistantMessageCard
                      key={msg.id}
                      currentTrendId={trend.id}
                      msg={msg}
                      fallbackAdditionalSources={contextSummary?.sourceEvidence.additionalSources}
                      onOpenRelatedTrend={onNavigateToTrendConversation}
                    />
                  )
                )}

                {/* Phase 07.5: Dynamic Contextual Follow-Up Suggestions */}
                {!isSending &&
                  !isTrendBlocked &&
                  !isAuthBlocked &&
                  messages.length > 0 &&
                  messages[messages.length - 1]?.role === 'assistant' &&
                  followUpSuggestions.length > 0 && (
                    <div className="space-y-1.5 pt-1" aria-label="Suggested follow-up questions">
                      <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                        Suggested follow-ups
                      </p>
                      <div className="space-y-1.5">
                        {followUpSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            disabled={isSending}
                            onClick={() => void sendQuestion(s.prompt)}
                            className="w-full text-left px-3 py-2 bg-[#09090b] border border-zinc-800 hover:border-zinc-500 hover:bg-black transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-white group"
                          >
                            <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5 group-hover:text-zinc-300">
                              {s.label}
                            </span>
                            <span className="block text-xs text-zinc-200 group-hover:text-white leading-snug font-sans">
                              {s.prompt}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Response Generation Indicator */}
                {isSending && (
                  <div
                    className="bg-black border border-zinc-800 p-4 space-y-2.5"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                      <span
                        className="w-3.5 h-3.5 border border-zinc-600 border-t-white rounded-full animate-spin shrink-0"
                        aria-hidden="true"
                      />
                      <span>Reviewing trend source evidence and drafting response...</span>
                    </div>
                    <div className="space-y-2 pt-1" aria-hidden="true">
                      <div className="h-3 w-11/12 bg-zinc-900 animate-pulse" />
                      <div className="h-3 w-4/5 bg-zinc-900 animate-pulse" />
                      <div className="h-3 w-2/3 bg-zinc-900 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Inline Error & Retry Banner */}
                {errorState && !isTrendBlocked && !isAuthBlocked && (
                  <div
                    className="bg-black border border-zinc-700 p-3.5 space-y-2.5"
                    role="alert"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangleIcon className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-mono text-xs font-semibold text-white">
                          {errorState.isRateLimited
                            ? 'Rate limit reached'
                            : 'Unable to complete request'}
                        </p>
                        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                          {errorState.message}
                        </p>
                        {errorState.userMessagePersisted && (
                          <p className="text-[11px] font-mono text-zinc-400">
                            Your question was saved — retrying will not create a duplicate message.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {errorState.retryable && (
                        <button
                          type="button"
                          disabled={isSending || isPreparingContext}
                          onClick={handleRetryError}
                          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-white text-black font-mono text-xs font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                        >
                          <RegenerateIcon className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setErrorState(null)}
                        className="min-h-[36px] px-3 py-1.5 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 font-mono text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}

        {/* Jump to Latest Button (appears only when user manually scrolls up in chat view) */}
        {!showHistoryView && showJumpToLatest && messages.length > 0 && (
          <div className="px-4 sm:px-5 pb-2 bg-[#0c0c0e] flex justify-center">
            <button
              type="button"
              onClick={() => scrollToLatest('smooth')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 hover:text-white hover:border-zinc-500 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
            >
              <ChevronDownIcon className="w-3.5 h-3.5" />
              <span>Jump to latest</span>
            </button>
          </div>
        )}

        {/* Composer Footer (hidden while browsing history list) */}
        {!showHistoryView && (
          <footer className="shrink-0 px-4 sm:px-5 py-3 border-t border-zinc-800 bg-[#09090b] space-y-2">
            {messages.length > 0 && !isTrendBlocked && !isAuthBlocked && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSuggestionsInChat((prev) => !prev)}
                  className="font-mono text-[11px] text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                >
                  {showSuggestionsInChat ? 'Hide suggested prompts' : 'Show suggested prompts'}
                </button>
                {showSuggestionsInChat && (
                  <div className="mt-2 grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                    {(followUpSuggestions.length > 0 ? followUpSuggestions : suggestedQuestions).map(
                      (s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={isSending}
                          onClick={() => {
                            setShowSuggestionsInChat(false);
                            void sendQuestion(s.prompt);
                          }}
                          className="text-left px-2.5 py-2 bg-black border border-zinc-800 hover:border-zinc-600 text-xs text-zinc-200 hover:text-white leading-snug font-sans disabled:opacity-50 transition-colors"
                        >
                          <span className="block font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                            {s.label}
                          </span>
                          <span>{s.prompt}</span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-1.5">
              <div className="flex items-end gap-2 bg-black border border-zinc-700 focus-within:border-zinc-400 p-2 transition-colors">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={isSending || isLoadingConversation || isTrendBlocked || isAuthBlocked}
                  placeholder={
                    isTrendBlocked
                      ? 'This trend is unavailable.'
                      : isAuthBlocked
                        ? 'Sign in to ask about this trend...'
                        : 'Ask a follow-up question about this trend...'
                  }
                  aria-label="Ask a question about this trend"
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none focus:outline-none leading-relaxed max-h-[140px] min-h-[36px] py-1.5 px-1.5 font-sans disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!canSubmit}
                  aria-label="Send question"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white shrink-0"
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
                <span>Enter to send · Shift+Enter for new line</span>
                {input.length > 0 && (
                  <span
                    className={
                      input.trim().length > TREND_AI_CLIENT_MAX_QUESTION_CHARS
                        ? 'text-red-400'
                        : 'text-zinc-500'
                    }
                  >
                    {input.trim().length}/{TREND_AI_CLIENT_MAX_QUESTION_CHARS}
                  </span>
                )}
              </div>
            </form>
          </footer>
        )}
      </aside>
    </div>
  );
};

export default TrendzContextualAiPanel;
