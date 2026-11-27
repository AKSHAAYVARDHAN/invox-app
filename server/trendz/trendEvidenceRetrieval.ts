import { sanitizeExternalUrl } from '../../utils/urlSanitizer';
import type {
  TrendContextExcerptCompleteness,
  TrendContextPayload,
  TrendContextVerificationStatus,
} from './trendContextBuilder';

export type TrendCitationSourceType =
  | 'primary_source'
  | 'additional_source'
  | 'editorial_briefing'
  | 'related_trend_source';

export type TrendEvidenceGroundingBasis =
  | 'source_cited'
  | 'editorial_cited'
  | 'source_available_uncited'
  | 'limited_evidence';

export type TrendAnalyticalDimension =
  | 'technical'
  | 'implications'
  | 'opportunities'
  | 'risks'
  | 'timeline'
  | 'stakeholders'
  | 'scenarios'
  | 'comparison'
  | 'synthesis';

export interface ConversationQueryIntent {
  isFollowUpReference: boolean;
  isCrossTrendQuery: boolean;
  isSynthesisQuery: boolean;
  analyticalDimensions: TrendAnalyticalDimension[];
  resolvedQueryText: string;
}

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
  verificationStatus: TrendContextVerificationStatus;
  excerptCompleteness: TrendContextExcerptCompleteness;
}

export interface TrendAiEvidenceAssessment {
  groundingBasis: TrendEvidenceGroundingBasis;
  citedSourceCount: number;
  citedEditorialCount: number;
  retrievedEvidenceCount: number;
  hasDirectSourceExcerpts: boolean;
}

export interface RetrievedEvidenceItem {
  id: string;
  trendId: string;
  sourceType: TrendCitationSourceType;
  publisher: string;
  sourceTitle: string;
  url: string | null;
  publishedAt: string | null;
  excerpt: string;
  relevanceScore: number;
  isSimulated: boolean;
  verificationStatus: TrendContextVerificationStatus;
  excerptCompleteness: TrendContextExcerptCompleteness;
  relationReasons?: string[];
}

export interface RetrievedEvidenceBundle {
  trendId: string;
  mode: TrendContextPayload['mode'];
  items: RetrievedEvidenceItem[];
  sourceEvidenceCount: number;
  editorialEvidenceCount: number;
  relatedEvidenceCount: number;
  hasDirectSourceExcerpts: boolean;
  isEvidenceLimited: boolean;
  totalEvidenceChars: number;
  queryIntent: ConversationQueryIntent;
  serializedForModel: string;
}

export const EVIDENCE_RETRIEVAL_LIMITS = {
  maxSourceItems: 4,
  maxEditorialItems: 2,
  maxRelatedItems: 3,
  maxTotalItems: 8,
  maxPassageChars: 420,
  maxTotalEvidenceChars: 4_800,
  maxPersistedCitations: 8,
} as const;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'what', 'when', 'where',
  'which', 'who', 'whom', 'whose', 'why', 'how', 'about', 'into', 'over', 'after',
  'before', 'under', 'between', 'through', 'during', 'above', 'below', 'does',
  'did', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will',
  'would', 'could', 'should', 'can', 'may', 'might', 'must', 'their', 'there',
  'these', 'those', 'they', 'them', 'then', 'than', 'also', 'just', 'only',
  'more', 'most', 'some', 'such', 'very', 'much', 'many', 'tell', 'explain',
  'give', 'show', 'summary', 'summarize', 'trend', 'article', 'source',
]);

function clampExcerpt(text: string, maxChars: number): string {
  const clean = String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\/?(?:retrieved_evidence_for_question|untrusted_trend_context|source_reported_evidence|ai_editorial_briefing|system|instruction)[^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars - 3);
  const lastSpace = cut.lastIndexOf(' ');
  const prefix = lastSpace > Math.floor(maxChars * 0.6) ? cut.slice(0, lastSpace) : cut;
  return `${prefix.trimEnd()}...`;
}

function tokenizeQuery(text: string): string[] {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9%.\-\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return Array.from(new Set(raw));
}

function extractBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Splits a source excerpt or editorial briefing into coherent, bounded passages
 * aligned to paragraph and sentence boundaries so citations quote clean units of evidence.
 */
export function splitTextIntoPassages(
  rawText: string | null | undefined,
  maxPassageChars = EVIDENCE_RETRIEVAL_LIMITS.maxPassageChars
): string[] {
  const normalized = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 16);

  const passages: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxPassageChars) {
      passages.push(clampExcerpt(para, maxPassageChars));
      continue;
    }

    // Split longer paragraphs on sentence boundaries
    const sentences = para
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
      .map((s) => s.trim())
      .filter(Boolean);

    let current = '';
    for (const sentence of sentences) {
      if (!current) {
        current = sentence;
      } else if (current.length + 1 + sentence.length <= maxPassageChars) {
        current = `${current} ${sentence}`;
      } else {
        passages.push(clampExcerpt(current, maxPassageChars));
        current = sentence;
      }
    }
    if (current) {
      passages.push(clampExcerpt(current, maxPassageChars));
    }
  }

  return passages;
}

function scorePassageRelevance(params: {
  passageText: string;
  queryTokens: string[];
  queryBigrams: string[];
  sourceType: TrendCitationSourceType;
  positionIndex: number;
}): number {
  const lower = params.passageText.toLowerCase();
  let score = 0;

  // Source-reported evidence always receives structural priority over editorial synthesis
  if (params.sourceType === 'primary_source') {
    score += 3.0;
  } else if (params.sourceType === 'additional_source') {
    score += 1.6;
  } else if (params.sourceType === 'related_trend_source') {
    score += 1.8;
  } else {
    score += 0.6;
  }

  // Slight lead-passage preference (journalistic inverted pyramid)
  score += Math.max(0, 0.4 - params.positionIndex * 0.08);

  if (params.queryTokens.length === 0) {
    return score;
  }

  let matchedTokens = 0;
  for (const token of params.queryTokens) {
    if (lower.includes(token)) {
      matchedTokens++;
      // Boost numeric figures, percentages, and technical terms
      const isNumericOrSpecific = /\d/.test(token) || token.length >= 7;
      score += isNumericOrSpecific ? 2.4 : 1.5;
    } else if (token.length >= 5) {
      // Simple stem prefix fallback
      const stem = token.slice(0, Math.max(4, token.length - 2));
      if (lower.includes(stem)) {
        matchedTokens++;
        score += 0.8;
      }
    }
  }

  for (const bigram of params.queryBigrams) {
    if (lower.includes(bigram)) {
      score += 2.2;
    }
  }

  // Coverage ratio bonus
  score += (matchedTokens / params.queryTokens.length) * 2.5;
  return Number(score.toFixed(3));
}

function getPreferredSourceUrl(context: TrendContextPayload): string | null {
  return (
    sanitizeExternalUrl(context.sourceEvidence.originalUrl) ||
    sanitizeExternalUrl(context.sourceEvidence.canonicalUrl) ||
    null
  );
}

function getPreferredPublishedAt(context: TrendContextPayload): string | null {
  return context.trendIdentity.publishedAtIso || context.trendIdentity.publishedOn || null;
}

const FOLLOW_UP_REFERENCE_PATTERN =
  /\b(?:this development|the previous one|previous development|the earlier one|the other one|the second one|compare them|both of them|between them|those two|these two|that risk|that point|that claim|those findings|what about it|how about them|go deeper|elaborate|expand on|follow up|more detail|earlier you mentioned)\b/i;

const CROSS_TREND_INTENT_PATTERN =
  /\b(?:compare|comparison|contrast|differ|difference|previous development|previous trend|other trend|other development|related trend|related development|connected|connection|common pattern|shared pattern|patterns across|broader pattern|influence one another|influence each other|interact|together|alongside|changed between|evolution|versus|\bvs\.?\b)\b/i;

const SYNTHESIS_INTENT_PATTERN =
  /\b(?:synthesize|synthesis|combine|across sources|multiple sources|multiple trends|conflicting|disagree|contradict|consensus|overall picture|big picture|broader landscape|common thread)\b/i;

/**
 * Analyzes the user's question and recent conversation turns to resolve anaphoric
 * follow-up references, detect cross-trend comparison or multi-source synthesis intent,
 * and identify deep analytical dimensions (without making any external LLM call).
 */
export function analyzeConversationQueryIntent(params: {
  question: string;
  recentUserContext?: string;
  recentConversationTurns?: Array<{ role: 'user' | 'assistant'; text: string }>;
  context?: TrendContextPayload;
}): ConversationQueryIntent {
  const q = String(params.question || '').trim();
  const lower = q.toLowerCase();

  const analyticalDimensions: TrendAnalyticalDimension[] = [];
  if (/\b(?:technical|how does|mechanisms?|architectures?|work under the hood|explain|concepts?|methodolog(?:y|ies))\b/i.test(lower)) {
    analyticalDimensions.push('technical');
  }
  if (/\b(?:implications?|impacts?|effects?|consequences?|real[- ]world|mean for|significance)\b/i.test(lower)) {
    analyticalDimensions.push('implications');
  }
  if (/\b(?:opportunit(?:y|ies)|applications?|use cases?|benefits?|advantages?|potential|unlock)\b/i.test(lower)) {
    analyticalDimensions.push('opportunities');
  }
  if (/\b(?:risks?|limitations?|challenges?|bottlenecks?|drawbacks?|downsides?|concerns?|obstacles?|gaps?|conflicts?)\b/i.test(lower)) {
    analyticalDimensions.push('risks');
  }
  if (/\b(?:short[- ]term|long[- ]term|timelines?|near[- ]term|next \d+ years|horizons?|over time)\b/i.test(lower)) {
    analyticalDimensions.push('timeline');
  }
  if (/\b(?:stakeholders?|industr(?:y|ies)|regulators?|consumers?|enterprises?|developers?|investors?|competitors?|who is affected)\b/i.test(lower)) {
    analyticalDimensions.push('stakeholders');
  }
  if (/\b(?:scenarios?|future|what if|could happen|outlooks?|forecasts?|trajector(?:y|ies)|next steps?)\b/i.test(lower)) {
    analyticalDimensions.push('scenarios');
  }

  const hasPriorTurns =
    Boolean(params.recentUserContext?.trim()) ||
    Boolean(params.recentConversationTurns && params.recentConversationTurns.length > 0);
  const isShortFollowUp = hasPriorTurns && q.length < 48 && /\b(?:it|them|this|that|those|both|more|why|how|compare)\b/i.test(lower);
  const isFollowUpReference = hasPriorTurns && (FOLLOW_UP_REFERENCE_PATTERN.test(lower) || isShortFollowUp);

  let isCrossTrendQuery = CROSS_TREND_INTENT_PATTERN.test(lower);
  const isSynthesisQuery = SYNTHESIS_INTENT_PATTERN.test(lower);
  if (isSynthesisQuery) {
    isCrossTrendQuery = true;
    analyticalDimensions.push('synthesis');
  }
  if (isCrossTrendQuery) {
    analyticalDimensions.push('comparison');
  }

  // Check if the question directly mentions distinctive words from a related trend's headline or tags
  if (!isCrossTrendQuery && params.context && params.context.relatedTrends.length > 0) {
    const qTokens = new Set(tokenizeQuery(q));
    for (const rel of params.context.relatedTrends) {
      const relTokens = tokenizeQuery(`${rel.headline} ${rel.tags.join(' ')}`);
      const primaryTokens = new Set(tokenizeQuery(params.context.trendIdentity.headline));
      const uniqueRelHits = relTokens.filter((t) => qTokens.has(t) && !primaryTokens.has(t));
      if (uniqueRelHits.length >= 2) {
        isCrossTrendQuery = true;
        if (!analyticalDimensions.includes('comparison')) {
          analyticalDimensions.push('comparison');
        }
        break;
      }
    }
  }

  // Build resolved retrieval query text by folding compact context from immediately preceding turns on follow-ups
  let resolvedQueryText = q;
  if (isFollowUpReference || q.length < 36) {
    const recentSnippets: string[] = [];
    if (Array.isArray(params.recentConversationTurns) && params.recentConversationTurns.length > 0) {
      for (const turn of params.recentConversationTurns.slice(-3)) {
        const clean = String(turn.text || '').replace(/\s+/g, ' ').trim();
        if (clean) {
          recentSnippets.push(clean.slice(0, 220));
        }
      }
    } else if (params.recentUserContext) {
      recentSnippets.push(params.recentUserContext.slice(0, 220));
    }
    if (recentSnippets.length > 0) {
      resolvedQueryText = `${q} ${recentSnippets.join(' ')}`.trim();
      // If the prior turn was discussing related trends and the user says "compare them" / "what about the other one"
      if (!isCrossTrendQuery && CROSS_TREND_INTENT_PATTERN.test(recentSnippets.join(' '))) {
        isCrossTrendQuery = true;
      }
    }
  }

  return {
    isFollowUpReference,
    isCrossTrendQuery,
    isSynthesisQuery,
    analyticalDimensions: Array.from(new Set(analyticalDimensions)),
    resolvedQueryText,
  };
}

/**
 * Retrieves question-relevant evidence passages strictly from the selected trend's
 * verified TrendContextPayload and (when relevant) its verified related published trends,
 * preserving separate publisher attribution, original URLs, publication dates, and strict
 * token/character budgets.
 *
 * Never fetches external sources unnecessarily and never fabricates missing evidence.
 */
export function retrieveRelevantEvidenceForQuestion(params: {
  context: TrendContextPayload;
  question: string;
  recentUserContext?: string;
  recentConversationTurns?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): RetrievedEvidenceBundle {
  const { context } = params;
  const queryIntent = analyzeConversationQueryIntent({
    question: params.question,
    recentUserContext: params.recentUserContext,
    recentConversationTurns: params.recentConversationTurns,
    context,
  });

  const queryTokens = tokenizeQuery(queryIntent.resolvedQueryText);
  const queryBigrams = extractBigrams(queryTokens);

  const primaryUrl = getPreferredSourceUrl(context);
  const primaryPublishedAt = getPreferredPublishedAt(context);
  const primaryPublisher = context.sourceEvidence.publisherName;
  const primaryTitle = context.trendIdentity.headline;

  interface CandidateItem {
    trendId: string;
    sourceType: TrendCitationSourceType;
    publisher: string;
    sourceTitle: string;
    url: string | null;
    publishedAt: string | null;
    excerpt: string;
    relevanceScore: number;
    isSimulated: boolean;
    verificationStatus: TrendContextVerificationStatus;
    excerptCompleteness: TrendContextExcerptCompleteness;
    isDirectSourceExcerpt: boolean;
    relationReasons?: string[];
  }

  const sourceCandidates: CandidateItem[] = [];
  const editorialCandidates: CandidateItem[] = [];
  const relatedCandidates: CandidateItem[] = [];

  // 1. Primary source extracted passages (highest factual authority)
  const excerptPassages = splitTextIntoPassages(context.sourceEvidence.excerpt);
  if (excerptPassages.length > 0) {
    excerptPassages.forEach((passage, idx) => {
      sourceCandidates.push({
        trendId: context.trendId,
        sourceType: 'primary_source',
        publisher: primaryPublisher,
        sourceTitle: primaryTitle,
        url: primaryUrl,
        publishedAt: primaryPublishedAt,
        excerpt: passage,
        relevanceScore: scorePassageRelevance({
          passageText: `${primaryTitle} ${passage}`,
          queryTokens,
          queryBigrams,
          sourceType: 'primary_source',
          positionIndex: idx,
        }),
        isSimulated: context.sourceEvidence.isSimulated,
        verificationStatus: context.sourceEvidence.verificationStatus,
        excerptCompleteness: context.sourceEvidence.excerptCompleteness,
        isDirectSourceExcerpt: true,
      });
    });
  } else if (primaryUrl || primaryPublisher) {
    // No extracted excerpt available — record honest provenance-only reference without inventing text
    sourceCandidates.push({
      trendId: context.trendId,
      sourceType: 'primary_source',
      publisher: primaryPublisher,
      sourceTitle: primaryTitle,
      url: primaryUrl,
      publishedAt: primaryPublishedAt,
      excerpt:
        'No extracted source article excerpt is available on this record; only publisher attribution and source link metadata are stored.',
      relevanceScore: 1.5,
      isSimulated: context.sourceEvidence.isSimulated,
      verificationStatus: context.sourceEvidence.verificationStatus,
      excerptCompleteness: 'unavailable',
      isDirectSourceExcerpt: false,
    });
  }

  // 2. Corroborating additional sources stored on the trend record
  for (let i = 0; i < context.sourceEvidence.additionalSources.length; i++) {
    const extra = context.sourceEvidence.additionalSources[i];
    const safeExtraUrl = sanitizeExternalUrl(extra.url);
    if (!safeExtraUrl) continue;
    const extraExcerpt = `Corroborating source listed on this Trendz record by ${extra.name} (external article body not extracted).`;
    sourceCandidates.push({
      trendId: context.trendId,
      sourceType: 'additional_source',
      publisher: extra.name,
      sourceTitle: `${primaryTitle} — ${extra.name}`,
      url: safeExtraUrl,
      publishedAt: extra.publishedOn || null,
      excerpt: clampExcerpt(extraExcerpt, EVIDENCE_RETRIEVAL_LIMITS.maxPassageChars),
      relevanceScore: scorePassageRelevance({
        passageText: `${extra.name} ${primaryTitle}`,
        queryTokens,
        queryBigrams,
        sourceType: 'additional_source',
        positionIndex: i,
      }),
      isSimulated: context.sourceEvidence.isSimulated,
      verificationStatus: 'unverified',
      excerptCompleteness: 'unavailable',
      isDirectSourceExcerpt: false,
    });
  }

  // 3. INVOX AI Editorial Briefing passages (explicitly typed as editorial_briefing, never primary publisher facts)
  const editorialSegments: Array<{ label: string; text: string }> = [];
  if (context.editorialBriefing.summary) {
    editorialSegments.push({
      label: 'INVOX Editorial Summary',
      text: context.editorialBriefing.summary,
    });
  }
  for (const passage of splitTextIntoPassages(context.editorialBriefing.detailedBriefing)) {
    // Avoid duplicating identical summary text
    if (
      context.editorialBriefing.summary &&
      passage.toLowerCase() === context.editorialBriefing.summary.trim().toLowerCase()
    ) {
      continue;
    }
    editorialSegments.push({
      label: 'INVOX Detailed Briefing',
      text: passage,
    });
  }
  if (context.editorialBriefing.whyItMatters) {
    editorialSegments.push({
      label: 'INVOX Why It Matters Analysis',
      text: context.editorialBriefing.whyItMatters,
    });
  }
  if (context.editorialBriefing.keyTakeaways.length > 0) {
    editorialSegments.push({
      label: 'INVOX Key Takeaways',
      text: clampExcerpt(
        context.editorialBriefing.keyTakeaways.join(' • '),
        EVIDENCE_RETRIEVAL_LIMITS.maxPassageChars
      ),
    });
  }

  editorialSegments.forEach((seg, idx) => {
    editorialCandidates.push({
      trendId: context.trendId,
      sourceType: 'editorial_briefing',
      publisher: 'INVOX AI Editorial Briefing',
      sourceTitle: `${seg.label}: ${primaryTitle}`,
      url: primaryUrl,
      publishedAt: primaryPublishedAt,
      excerpt: clampExcerpt(seg.text, EVIDENCE_RETRIEVAL_LIMITS.maxPassageChars),
      relevanceScore: scorePassageRelevance({
        passageText: `${seg.label} ${seg.text}`,
        queryTokens,
        queryBigrams,
        sourceType: 'editorial_briefing',
        positionIndex: idx,
      }),
      isSimulated: context.sourceEvidence.isSimulated,
      verificationStatus: context.sourceEvidence.verificationStatus,
      excerptCompleteness: context.sourceEvidence.excerptCompleteness,
      isDirectSourceExcerpt: false,
    });
  });

  // 4. Isolated Related Published Trend Evidence ([R1], [R2], [R3]) — strictly separate per trend
  context.relatedTrends.forEach((rel, idx) => {
    const relPassages = splitTextIntoPassages(rel.excerpt, EVIDENCE_RETRIEVAL_LIMITS.maxPassageChars);
    const bestRelExcerpt =
      relPassages.length > 0
        ? relPassages
            .map((p, pIdx) => ({
              p,
              score: scorePassageRelevance({
                passageText: `${rel.headline} ${p}`,
                queryTokens,
                queryBigrams,
                sourceType: 'related_trend_source',
                positionIndex: pIdx,
              }),
            }))
            .sort((a, b) => b.score - a.score)[0].p
        : rel.summary
          ? clampExcerpt(
              `Editorial summary (source excerpt unavailable): ${rel.summary}`,
              EVIDENCE_RETRIEVAL_LIMITS.maxPassageChars
            )
          : 'Related published Trendz record (no extracted source excerpt stored).';

    const relTextForScoring = [
      rel.headline,
      rel.category || '',
      rel.tags.join(' '),
      rel.summary || '',
      bestRelExcerpt,
    ].join(' ');

    const baseScore = scorePassageRelevance({
      passageText: relTextForScoring,
      queryTokens,
      queryBigrams,
      sourceType: 'related_trend_source',
      positionIndex: idx,
    });
    const relDiscoveryBoost =
      typeof rel.relevanceScore === 'number' && rel.relevanceScore > 0
        ? Math.min(2.0, rel.relevanceScore / 35)
        : 0;
    const crossBoost = queryIntent.isCrossTrendQuery ? 2.5 : 0;

    relatedCandidates.push({
      trendId: rel.id,
      sourceType: 'related_trend_source',
      publisher: rel.publisherName || 'Related Trend Source',
      sourceTitle: rel.headline,
      url: sanitizeExternalUrl(rel.originalUrl) || null,
      publishedAt: rel.publishedAtIso || null,
      excerpt: bestRelExcerpt,
      relevanceScore: Number((baseScore + relDiscoveryBoost + crossBoost).toFixed(3)),
      isSimulated: rel.isSimulated || context.sourceEvidence.isSimulated,
      verificationStatus: rel.verificationStatus,
      excerptCompleteness: relPassages.length > 0 ? rel.excerptCompleteness : 'unavailable',
      isDirectSourceExcerpt: relPassages.length > 0 && rel.excerptCompleteness !== 'unavailable',
      relationReasons: rel.relationReasons,
    });
  });

  // Rank within each tier while preserving strict total budget and primary-trend priority
  sourceCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
  editorialCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
  relatedCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const selectedSources = sourceCandidates.slice(0, EVIDENCE_RETRIEVAL_LIMITS.maxSourceItems);
  const selectedEditorial = editorialCandidates.slice(
    0,
    queryIntent.isCrossTrendQuery ? 1 : EVIDENCE_RETRIEVAL_LIMITS.maxEditorialItems
  );
  // Include up to 3 related trends when cross-trend/synthesis is requested, or top 1 lightly for ready comparison context
  const maxRelatedToInclude = queryIntent.isCrossTrendQuery
    ? EVIDENCE_RETRIEVAL_LIMITS.maxRelatedItems
    : relatedCandidates.length > 0
      ? 1
      : 0;
  const selectedRelated = relatedCandidates.slice(0, maxRelatedToInclude);

  const items: RetrievedEvidenceItem[] = [];
  let totalEvidenceChars = 0;

  let sourceCounter = 1;
  for (const cand of selectedSources) {
    if (items.length >= EVIDENCE_RETRIEVAL_LIMITS.maxTotalItems) break;
    const cost = cand.excerpt.length + cand.publisher.length + cand.sourceTitle.length + 40;
    if (
      totalEvidenceChars + cost > EVIDENCE_RETRIEVAL_LIMITS.maxTotalEvidenceChars &&
      items.length > 0
    ) {
      break;
    }
    totalEvidenceChars += cost;
    items.push({
      id: `S${sourceCounter++}`,
      trendId: cand.trendId,
      sourceType: cand.sourceType,
      publisher: cand.publisher,
      sourceTitle: cand.sourceTitle,
      url: cand.url,
      publishedAt: cand.publishedAt,
      excerpt: cand.excerpt,
      relevanceScore: cand.relevanceScore,
      isSimulated: cand.isSimulated,
      verificationStatus: cand.verificationStatus,
      excerptCompleteness: cand.excerptCompleteness,
    });
  }

  let editorialCounter = 1;
  for (const cand of selectedEditorial) {
    if (items.length >= EVIDENCE_RETRIEVAL_LIMITS.maxTotalItems) break;
    const cost = cand.excerpt.length + cand.publisher.length + cand.sourceTitle.length + 40;
    if (
      totalEvidenceChars + cost > EVIDENCE_RETRIEVAL_LIMITS.maxTotalEvidenceChars &&
      items.length > 0
    ) {
      break;
    }
    totalEvidenceChars += cost;
    items.push({
      id: `E${editorialCounter++}`,
      trendId: cand.trendId,
      sourceType: 'editorial_briefing',
      publisher: cand.publisher,
      sourceTitle: cand.sourceTitle,
      url: cand.url,
      publishedAt: cand.publishedAt,
      excerpt: cand.excerpt,
      relevanceScore: cand.relevanceScore,
      isSimulated: cand.isSimulated,
      verificationStatus: cand.verificationStatus,
      excerptCompleteness: cand.excerptCompleteness,
    });
  }

  let relatedCounter = 1;
  for (const cand of selectedRelated) {
    if (items.length >= EVIDENCE_RETRIEVAL_LIMITS.maxTotalItems) break;
    const cost = cand.excerpt.length + cand.publisher.length + cand.sourceTitle.length + 60;
    if (
      totalEvidenceChars + cost > EVIDENCE_RETRIEVAL_LIMITS.maxTotalEvidenceChars &&
      items.length > 0
    ) {
      break;
    }
    totalEvidenceChars += cost;
    items.push({
      id: `R${relatedCounter++}`,
      trendId: cand.trendId,
      sourceType: 'related_trend_source',
      publisher: cand.publisher,
      sourceTitle: cand.sourceTitle,
      url: cand.url,
      publishedAt: cand.publishedAt,
      excerpt: cand.excerpt,
      relevanceScore: cand.relevanceScore,
      isSimulated: cand.isSimulated,
      verificationStatus: cand.verificationStatus,
      excerptCompleteness: cand.excerptCompleteness,
      relationReasons: cand.relationReasons,
    });
  }

  const sourceEvidenceCount = items.filter(
    (i) => i.sourceType === 'primary_source' || i.sourceType === 'additional_source'
  ).length;
  const editorialEvidenceCount = items.filter((i) => i.sourceType === 'editorial_briefing').length;
  const relatedEvidenceCount = items.filter((i) => i.sourceType === 'related_trend_source').length;
  const hasDirectSourceExcerpts =
    excerptPassages.length > 0 &&
    items.some(
      (i) => i.sourceType === 'primary_source' && i.excerptCompleteness !== 'unavailable'
    );
  const isEvidenceLimited =
    !hasDirectSourceExcerpts ||
    context.sourceEvidence.evidenceSufficiency === 'limited' ||
    context.sourceEvidence.isSimulated;

  const serializedForModel = serializeRetrievedEvidenceForModel({
    items,
    hasDirectSourceExcerpts,
    isSimulated: context.sourceEvidence.isSimulated,
    excerptCompleteness: context.sourceEvidence.excerptCompleteness,
    queryIntent,
  });

  return {
    trendId: context.trendId,
    mode: context.mode,
    items,
    sourceEvidenceCount,
    editorialEvidenceCount,
    relatedEvidenceCount,
    hasDirectSourceExcerpts,
    isEvidenceLimited,
    totalEvidenceChars,
    queryIntent,
    serializedForModel,
  };
}

function serializeRetrievedEvidenceForModel(params: {
  items: RetrievedEvidenceItem[];
  hasDirectSourceExcerpts: boolean;
  isSimulated: boolean;
  excerptCompleteness: TrendContextExcerptCompleteness;
  queryIntent: ConversationQueryIntent;
}): string {
  const lines: string[] = [
    '<retrieved_evidence_for_question>',
    'Use ONLY the exact citation IDs listed below (e.g., [S1], [S2], [E1], [R1]). NEVER invent new citation IDs.',
    '- [S#] = Primary trend publisher source evidence or corroborating source metadata.',
    '- [E#] = Primary trend INVOX AI editorial briefing synthesis (NOT direct publisher reporting).',
    '- [R#] = Separate related published Trendz record evidence (cite ONLY for claims about that specific related trend; never blend with primary trend facts).',
    '- Do NOT attach a citation marker to your own analytical inferences, future scenarios, or general explanations.',
    `Direct Primary Publisher Source Excerpts Available: ${params.hasDirectSourceExcerpts ? 'yes' : 'no'} (completeness: ${params.excerptCompleteness})`,
  ];

  if (params.isSimulated) {
    lines.push(
      'Mode Notice: DEV_FALLBACK sample trend — all evidence below is simulated development sample data, not live-verified external journalism.'
    );
  }

  if (params.queryIntent.analyticalDimensions.length > 0) {
    lines.push(
      `Detected Analytical Focus: ${params.queryIntent.analyticalDimensions.join(', ')} (clearly separate reported facts [S#]/[R#] from analytical interpretation or conditional scenarios).`
    );
  }

  const primaryAndEditorial = params.items.filter((i) => i.sourceType !== 'related_trend_source');
  const relatedItems = params.items.filter((i) => i.sourceType === 'related_trend_source');

  if (primaryAndEditorial.length === 0) {
    lines.push('Primary Trend Evidence Items: NONE AVAILABLE — state clearly that supporting source evidence is missing.');
  } else {
    lines.push('Primary Trend Evidence Items:');
    for (const item of primaryAndEditorial) {
      const typeLabel =
        item.sourceType === 'primary_source'
          ? 'PUBLISHER_SOURCE'
          : item.sourceType === 'additional_source'
            ? 'CORROBORATING_SOURCE'
            : 'INVOX_AI_EDITORIAL_BRIEFING';
      const metaParts = [
        `[${item.id}]`,
        `type=${typeLabel}`,
        `trendId=${item.trendId}`,
        `publisher="${item.publisher}"`,
        item.publishedAt ? `publishedAt="${item.publishedAt}"` : 'publishedAt=unavailable',
        item.url ? `url="${item.url}"` : 'url=unavailable',
      ];
      lines.push(`- ${metaParts.join(' | ')}`);
      lines.push(`  Passage: ${item.excerpt}`);
    }
  }

  if (relatedItems.length > 0) {
    lines.push('<related_trend_evidence note="Isolated evidence from separate published related Trendz records. Cite with [R#] and preserve separate publisher attribution.">');
    for (const item of relatedItems) {
      const metaParts = [
        `[${item.id}]`,
        `type=RELATED_TREND_SOURCE`,
        `trendId=${item.trendId}`,
        `headline="${item.sourceTitle}"`,
        `publisher="${item.publisher}"`,
        item.publishedAt ? `publishedAt="${item.publishedAt}"` : 'publishedAt=unavailable',
        `excerptCompleteness=${item.excerptCompleteness}`,
        item.url ? `url="${item.url}"` : 'url=unavailable',
      ];
      lines.push(`- ${metaParts.join(' | ')}`);
      if (item.relationReasons && item.relationReasons.length > 0) {
        lines.push(`  Why Related: ${item.relationReasons.join('; ')}`);
      }
      lines.push(`  Passage: ${item.excerpt}`);
    }
    lines.push('</related_trend_evidence>');
  } else if (params.queryIntent.isCrossTrendQuery) {
    lines.push(
      'Related Trend Evidence Items: NONE AVAILABLE — no sufficiently relevant published related trends exist for comparison; acknowledge this transparently without fabricating connections.'
    );
  }

  lines.push('</retrieved_evidence_for_question>');
  return lines.join('\n');
}

/**
 * Extracts, normalizes, and strictly validates inline citation markers from a model response
 * against the server-constructed RetrievedEvidenceBundle.
 *
 * Guarantees:
 * - Hallucinated or out-of-range citation IDs (e.g., [S9], [99]) are stripped from the text and rejected.
 * - Multi-citation brackets like `[S1, S2]` are normalized to `[S1][S2]`.
 * - Returned citations are deduplicated, strictly bound to real retrieved evidence, and URL-sanitized.
 * - Clearly computes an honest `TrendAiEvidenceAssessment`.
 */
export function extractAndValidateCitations(params: {
  rawAnswer: string;
  bundle: RetrievedEvidenceBundle;
}): {
  cleanedAnswer: string;
  citations: TrendAiCitationRecord[];
  evidenceAssessment: TrendAiEvidenceAssessment;
  strippedInvalidIds: string[];
} {
  const catalogById = new Map<string, RetrievedEvidenceItem>();
  for (const item of params.bundle.items) {
    catalogById.set(item.id.toUpperCase(), item);
  }

  const validCitedOrder: string[] = [];
  const validCitedSet = new Set<string>();
  const strippedInvalidIds: string[] = [];

  // Matches bracketed citation markers such as [S1], [E2], [R1], [S1, R1], [S1; E1]
  // Avoids touching Markdown links `[text](url)` by rejecting brackets immediately followed by `(`.
  const citationBracketRegex =
    /\[((?:[SER]\d+)(?:\s*[,;/]\s*[SER]\d+)*)\](?!\()/gi;

  const cleanedAnswer = params.rawAnswer
    .replace(citationBracketRegex, (_fullMatch, innerGroup: string) => {
      const tokens = innerGroup
        .split(/[,;/]/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);

      const keptTokens: string[] = [];
      for (const token of tokens) {
        if (catalogById.has(token)) {
          keptTokens.push(`[${token}]`);
          if (!validCitedSet.has(token)) {
            validCitedSet.add(token);
            validCitedOrder.push(token);
          }
        } else {
          strippedInvalidIds.push(token);
        }
      }
      return keptTokens.join('');
    })
    // Clean up any double spaces created if an invalid citation was removed
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim();

  const citations: TrendAiCitationRecord[] = [];
  const addedIds = new Set<string>();

  for (const citedId of validCitedOrder) {
    if (citations.length >= EVIDENCE_RETRIEVAL_LIMITS.maxPersistedCitations) break;
    const item = catalogById.get(citedId);
    if (!item || addedIds.has(item.id)) continue;
    addedIds.add(item.id);
    citations.push({
      id: item.id,
      trendId: item.trendId,
      sourceType: item.sourceType,
      publisher: item.publisher,
      sourceTitle: item.sourceTitle,
      url: sanitizeExternalUrl(item.url) || null,
      publishedAt: item.publishedAt,
      excerpt: item.excerpt,
      citedInText: true,
      isSimulated: item.isSimulated,
      verificationStatus: item.verificationStatus,
      excerptCompleteness: item.excerptCompleteness,
    });
  }

  // If the model did not emit explicit inline markers, attach the top retrieved primary source
  // strictly marked `citedInText: false` so users still have traceable source provenance without faking inline citations.
  if (citations.length === 0) {
    const primaryFallback = params.bundle.items.find(
      (i) => i.sourceType === 'primary_source' && (i.url || i.excerptCompleteness !== 'unavailable')
    );
    if (primaryFallback) {
      citations.push({
        id: primaryFallback.id,
        trendId: primaryFallback.trendId,
        sourceType: primaryFallback.sourceType,
        publisher: primaryFallback.publisher,
        sourceTitle: primaryFallback.sourceTitle,
        url: sanitizeExternalUrl(primaryFallback.url) || null,
        publishedAt: primaryFallback.publishedAt,
        excerpt: primaryFallback.excerpt,
        citedInText: false,
        isSimulated: primaryFallback.isSimulated,
        verificationStatus: primaryFallback.verificationStatus,
        excerptCompleteness: primaryFallback.excerptCompleteness,
      });
    }
  }

  const citedSourceCount = citations.filter(
    (c) => c.citedInText && c.sourceType !== 'editorial_briefing'
  ).length;
  const citedEditorialCount = citations.filter(
    (c) => c.citedInText && c.sourceType === 'editorial_briefing'
  ).length;
  const hasAnyDirectSourceEvidence =
    params.bundle.hasDirectSourceExcerpts ||
    citations.some(
      (c) =>
        c.citedInText &&
        c.sourceType === 'related_trend_source' &&
        c.excerptCompleteness !== 'unavailable'
    );

  let groundingBasis: TrendEvidenceGroundingBasis;
  if (citedSourceCount > 0 && hasAnyDirectSourceEvidence) {
    groundingBasis = 'source_cited';
  } else if (citedSourceCount > 0 || citedEditorialCount > 0) {
    groundingBasis =
      citedEditorialCount > 0 && citedSourceCount === 0
        ? 'editorial_cited'
        : hasAnyDirectSourceEvidence
          ? 'source_cited'
          : 'limited_evidence';
  } else if (params.bundle.hasDirectSourceExcerpts) {
    groundingBasis = 'source_available_uncited';
  } else {
    groundingBasis = 'limited_evidence';
  }

  return {
    cleanedAnswer,
    citations,
    evidenceAssessment: {
      groundingBasis,
      citedSourceCount,
      citedEditorialCount,
      retrievedEvidenceCount: params.bundle.items.length,
      hasDirectSourceExcerpts: params.bundle.hasDirectSourceExcerpts,
    },
    strippedInvalidIds,
  };
}
