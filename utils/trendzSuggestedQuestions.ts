import type {
  TrendAiCitationRecord,
  TrendAiEvidenceAssessment,
  TrendContextualAiContextSummary,
  TrendContextualAiMode,
} from '../services/trendzContextualAiService';

export interface SuggestedQuestionTrendInput {
  id: string;
  title: string;
  domainName?: string;
  domainSlug?: string;
  category?: string | null;
  publisherName?: string | null;
  summary?: string | null;
  whyItMatters?: string | null;
  keyTakeaways?: string[];
  tags?: string[];
  excerptCompleteness?: 'full_excerpt' | 'truncated' | 'unavailable';
  groundingStatus?: 'verified' | 'needs_review' | 'unknown';
  isFallback?: boolean;
  hasRelatedTrends?: boolean;
}

export type TrendSuggestedQuestionIntent =
  | 'facts'
  | 'impact'
  | 'explain'
  | 'risks'
  | 'context'
  | 'compare'
  | 'synthesis'
  | 'scenarios'
  | 'evidence';

export interface TrendSuggestedQuestion {
  id: string;
  label: string;
  prompt: string;
  intent: TrendSuggestedQuestionIntent;
}

export interface ConversationTurnSummary {
  role: 'user' | 'assistant';
  text: string;
  citations?: TrendAiCitationRecord[];
  evidenceAssessment?: TrendAiEvidenceAssessment;
}

/**
 * Builds a strict isolation key scoping contextual AI state to a single user,
 * data mode (live vs. dev_fallback), and trend ID.
 */
export function buildTrendConversationScopeKey(params: {
  userId: string | null | undefined;
  mode: TrendContextualAiMode;
  trendId: string;
}): string {
  const uid = (params.userId || 'anonymous').trim();
  const mode = params.mode === 'dev_fallback' ? 'dev_fallback' : 'live';
  const trendId = params.trendId.trim();
  return `${uid}::${mode}::${trendId}`;
}

/**
 * Extracts a concise, human-readable subject phrase from a trend headline so
 * suggested questions reference the actual story rather than generic boilerplate.
 */
export function extractTrendSubjectPhrase(
  headline: string,
  fallbackCategory?: string | null,
  fallbackDomain?: string | null
): string {
  const cleaned = headline
    .replace(/\s+/g, ' ')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();

  if (!cleaned) {
    return fallbackCategory?.trim() || fallbackDomain?.trim() || 'this development';
  }

  // Prefer the leading clause before ":" or "—" when it's meaningful
  const colonSplit = cleaned.split(/\s*[:—–]\s*/);
  const candidate =
    colonSplit[0] && colonSplit[0].length >= 14 && colonSplit[0].length <= 54
      ? colonSplit[0].trim()
      : cleaned;

  if (candidate.length <= 54) {
    return candidate;
  }

  const words = candidate.split(' ');
  const out: string[] = [];
  for (const word of words) {
    const next = [...out, word].join(' ');
    if (next.length > 50 && out.length >= 3) break;
    out.push(word);
  }
  return out.join(' ').replace(/[,;:\-–—]+$/, '').trim() || candidate.slice(0, 50).trim();
}

function pickPrimaryTag(
  tags: string[] | undefined,
  domainName: string,
  category: string | null,
  excludeLower?: Set<string>
): string | null {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const domainLower = domainName.trim().toLowerCase();
  const categoryLower = (category || '').trim().toLowerCase();

  for (const rawTag of tags) {
    const clean = rawTag.replace(/^#+/, '').trim();
    if (!clean || clean.length < 2 || clean.length > 36) continue;
    const lower = clean.toLowerCase();
    if (excludeLower?.has(lower)) continue;
    if (lower !== domainLower && lower !== categoryLower) {
      return clean;
    }
  }
  const fallback = tags[0]?.replace(/^#+/, '').trim();
  if (!fallback || fallback.length > 36) return null;
  if (excludeLower?.has(fallback.toLowerCase())) return null;
  return fallback;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'what',
  'which',
  'when',
  'where',
  'while',
  'into',
  'about',
  'their',
  'there',
  'these',
  'those',
  'would',
  'could',
  'should',
  'does',
  'have',
  'been',
  'being',
  'more',
  'most',
  'over',
  'than',
  'then',
  'them',
  'they',
  'will',
  'your',
  'how',
  'why',
  'are',
  'who',
  'can',
]);

function tokenizeForDedupe(text: string): Set<string> {
  const matches = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return new Set(matches);
}

function computeTokenOverlapRatio(candidateText: string, existingText: string): number {
  const a = tokenizeForDedupe(candidateText);
  const b = tokenizeForDedupe(existingText);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
}

function detectCoveredDimensions(userMessages: string[]): Set<string> {
  const covered = new Set<string>();
  const joined = userMessages.join(' \n ').toLowerCase();

  if (/\b(compare|comparison|versus|\bvs\.?\b|related trend|other trend|connect|across)\b/.test(joined)) {
    covered.add('compare');
  }
  if (/\b(synthesi[sz]e|broader pattern|bigger picture|overall trend|common theme)\b/.test(joined)) {
    covered.add('synthesis');
  }
  if (/\b(short[- ]?term|long[- ]?term|next year|horizon|timeline|over time)\b/.test(joined)) {
    covered.add('timeline');
  }
  if (/\b(risk|risks|limitation|limitations|challenge|challenges|downside|bottleneck|caveat)\b/.test(joined)) {
    covered.add('risks');
  }
  if (/\b(opportunit|application|applications|use case|use cases|benefit|upside|practical)\b/.test(joined)) {
    covered.add('opportunities');
  }
  if (/\b(stakeholder|who is affected|winner|loser|industry impact|who benefits|impact)\b/.test(joined)) {
    covered.add('stakeholders');
  }
  if (/\b(scenario|scenarios|future|what happens next|outlook|forecast|could happen)\b/.test(joined)) {
    covered.add('scenarios');
  }
  if (/\b(explain|how does|technical|plain|non-technical|mechanism|architecture|work)\b/.test(joined)) {
    covered.add('explain');
  }
  if (/\b(evidence|source|verified|unverified|missing|gap|conflict|contradict|report)\b/.test(joined)) {
    covered.add('evidence');
  }

  return covered;
}

/**
 * Generates 4–5 trend-specific suggested questions adapted to the selected trend's
 * headline, publisher, domain/category, tags, evidence completeness, and related context.
 */
export function generateTrendSuggestedQuestions(
  trend: SuggestedQuestionTrendInput,
  backendContext?: TrendContextualAiContextSummary | null
): TrendSuggestedQuestion[] {
  const headline = (backendContext?.trendIdentity.headline || trend.title || '').trim();
  const domainName = (
    backendContext?.trendIdentity.domainName ||
    trend.domainName ||
    'this sector'
  ).trim();
  const category = (backendContext?.trendIdentity.category ?? trend.category ?? null)?.trim() || null;
  const publisher = (
    backendContext?.sourceEvidence.publisherName ||
    trend.publisherName ||
    ''
  ).trim();
  const tags =
    backendContext?.trendIdentity.tags && backendContext.trendIdentity.tags.length > 0
      ? backendContext.trendIdentity.tags
      : trend.tags || [];
  const keyTakeawaysCount =
    backendContext?.editorialBriefing.keyTakeaways.length ?? trend.keyTakeaways?.length ?? 0;
  const hasWhyItMatters = Boolean(
    backendContext?.editorialBriefing.whyItMatters || trend.whyItMatters
  );
  const excerptCompleteness =
    backendContext?.sourceEvidence.excerptCompleteness ?? trend.excerptCompleteness ?? 'truncated';
  const groundingStatus =
    backendContext?.editorialBriefing.groundingStatus ?? trend.groundingStatus ?? 'unknown';
  const isSimulated = Boolean(backendContext?.sourceEvidence.isSimulated || trend.isFallback);
  const relatedTrends = backendContext?.relatedTrends || [];
  const topRelated = relatedTrends[0] ?? null;
  const hasRelated = Boolean(topRelated || trend.hasRelatedTrends);

  const subject = extractTrendSubjectPhrase(headline, category, domainName);
  const primaryTag = pickPrimaryTag(tags, domainName, category);
  const validPublisher =
    publisher &&
    publisher.toLowerCase() !== 'invox desk' &&
    publisher.toLowerCase() !== 'unknown publisher'
      ? publisher
      : null;

  const questions: TrendSuggestedQuestion[] = [];

  // 1. Source-anchored factual breakdown ("What happened?")
  questions.push({
    id: `${trend.id}-facts`,
    intent: 'facts',
    label: 'Core facts',
    prompt: validPublisher
      ? `What exactly did ${validPublisher} report about ${subject}, and what comes from the source excerpt versus the AI summary?`
      : `What are the concrete facts reported about ${subject}, distinguishing source evidence from AI analysis?`,
  });

  // 2. Strategic importance / implications adapted to domain & category
  const areaLabel =
    category && category.toLowerCase() !== domainName.toLowerCase()
      ? `${category} in ${domainName}`
      : domainName;
  questions.push({
    id: `${trend.id}-impact`,
    intent: 'impact',
    label: 'Key implications',
    prompt: hasWhyItMatters
      ? `Why is this development significant for ${areaLabel}, and who is affected most directly?`
      : `What are the practical implications of ${subject} for teams working in ${areaLabel}?`,
  });

  // 3. Accessible explanation anchored to a real tag or category
  questions.push({
    id: `${trend.id}-explain`,
    intent: 'explain',
    label: 'Simpler breakdown',
    prompt: primaryTag
      ? `Explain ${primaryTag} and how it fits into this briefing in plain, non-technical terms.`
      : `Explain ${subject} in simpler terms without losing the key factual details.`,
  });

  // 4. Honest limitations, risks, or evidence gaps
  const hasEvidenceGaps =
    excerptCompleteness === 'unavailable' ||
    groundingStatus === 'needs_review' ||
    isSimulated;

  questions.push({
    id: `${trend.id}-risks`,
    intent: 'risks',
    label: hasEvidenceGaps ? 'Evidence & gaps' : 'Risks & limits',
    prompt: hasEvidenceGaps
      ? `What claims in this briefing are backed by available source details, and what key evidence is still missing or unverified?`
      : `What limitations, risks, or open questions remain around ${subject} based on the available evidence?`,
  });

  // 5. Cross-trend comparison (when a real related trend exists) or key takeaway deep dive
  if (topRelated) {
    const relatedSubject = extractTrendSubjectPhrase(
      topRelated.headline,
      topRelated.category,
      topRelated.domainName
    );
    questions.push({
      id: `${trend.id}-compare-${topRelated.id}`,
      intent: 'compare',
      label: 'Compare related trend',
      prompt: `How does ${subject} compare with "${relatedSubject}", and what shared shift connects the two?`,
    });
  } else if (hasRelated) {
    questions.push({
      id: `${trend.id}-context`,
      intent: 'context',
      label: 'Related context',
      prompt: `How does ${subject} connect to the related ${domainName} trends linked to this briefing?`,
    });
  } else if (keyTakeawaysCount > 0) {
    questions.push({
      id: `${trend.id}-context`,
      intent: 'context',
      label: 'Actionable takeaway',
      prompt: `Which of the key takeaways from this ${category || domainName} briefing matters most right now, and why?`,
    });
  }

  return questions.slice(0, 5);
}

/**
 * Phase 07.5: Generates dynamic, non-repetitive contextual follow-up questions
 * driven by the selected trend, prior conversation turns, relevant published
 * related trends, and available source evidence (deterministic — zero extra LLM calls).
 */
export function generateContextualFollowUpQuestions(params: {
  trend: SuggestedQuestionTrendInput;
  backendContext?: TrendContextualAiContextSummary | null;
  messages: ConversationTurnSummary[];
  maxCount?: number;
}): TrendSuggestedQuestion[] {
  const maxCount = Math.max(1, Math.min(5, params.maxCount ?? 3));
  const { trend, backendContext, messages } = params;

  const userMessages = messages
    .filter((m) => m.role === 'user' && m.text.trim())
    .map((m) => m.text.trim());

  if (userMessages.length === 0) {
    return generateTrendSuggestedQuestions(trend, backendContext).slice(0, maxCount);
  }

  const latestAssistant = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');

  const headline = (backendContext?.trendIdentity.headline || trend.title || '').trim();
  const domainName = (
    backendContext?.trendIdentity.domainName ||
    trend.domainName ||
    'this sector'
  ).trim();
  const category = (backendContext?.trendIdentity.category ?? trend.category ?? null)?.trim() || null;
  const areaLabel =
    category && category.toLowerCase() !== domainName.toLowerCase()
      ? `${category} in ${domainName}`
      : domainName;
  const subject = extractTrendSubjectPhrase(headline, category, domainName);

  const tags =
    backendContext?.trendIdentity.tags && backendContext.trendIdentity.tags.length > 0
      ? backendContext.trendIdentity.tags
      : trend.tags || [];
  const relatedTrends = backendContext?.relatedTrends || [];
  const covered = detectCoveredDimensions(userMessages);

  const userTextLower = userMessages.join(' ').toLowerCase();
  const mentionedTags = new Set<string>();
  for (const tag of tags) {
    const clean = tag.replace(/^#+/, '').trim().toLowerCase();
    if (clean && userTextLower.includes(clean)) {
      mentionedTags.add(clean);
    }
  }
  const unexploredTag = pickPrimaryTag(tags, domainName, category, mentionedTags);

  // Pick a related trend not yet explicitly discussed by headline tokens
  const unmentionedRelated = relatedTrends.find((rel) => {
    const relTokens = tokenizeForDedupe(rel.headline);
    if (relTokens.size === 0) return false;
    let hits = 0;
    for (const token of relTokens) {
      if (userTextLower.includes(token)) hits += 1;
    }
    return hits / relTokens.size < 0.45;
  });

  const latestAssessment = latestAssistant?.evidenceAssessment;
  const latestCitations = latestAssistant?.citations || [];
  const hasRelatedCitationInLast = latestCitations.some(
    (c) => c.sourceType === 'related_trend_source' && c.citedInText
  );
  const hasLimitedEvidence =
    latestAssessment?.groundingBasis === 'limited_evidence' ||
    backendContext?.sourceEvidence.evidenceSufficiency === 'limited' ||
    backendContext?.sourceEvidence.excerptCompleteness !== 'full_excerpt';

  const candidates: TrendSuggestedQuestion[] = [];

  // 1. Cross-trend comparison or multi-trend synthesis when published related trends exist
  if (unmentionedRelated && !covered.has('compare')) {
    const relSubject = extractTrendSubjectPhrase(
      unmentionedRelated.headline,
      unmentionedRelated.category,
      unmentionedRelated.domainName
    );
    candidates.push({
      id: `${trend.id}-fu-compare-${unmentionedRelated.id}`,
      intent: 'compare',
      label: 'Cross-trend comparison',
      prompt: `Compare this development with "${relSubject}" — where do the reported facts align or diverge?`,
    });
  } else if (relatedTrends.length >= 2 && !covered.has('synthesis')) {
    candidates.push({
      id: `${trend.id}-fu-synthesis`,
      intent: 'synthesis',
      label: 'Broader synthesis',
      prompt: `Synthesizing this trend alongside the ${relatedTrends.length} related ${domainName} trends, what larger shift is emerging, and what evidence is still missing?`,
    });
  } else if (hasRelatedCitationInLast && !covered.has('synthesis')) {
    candidates.push({
      id: `${trend.id}-fu-synthesis-diff`,
      intent: 'synthesis',
      label: 'Compare evidence',
      prompt: `Between the primary trend and the related trend you cited, which claims are directly reported versus analytical synthesis?`,
    });
  }

  // 2. Evidence verification / gap check if evidence is partial or not yet audited
  if (hasLimitedEvidence && !covered.has('evidence')) {
    candidates.push({
      id: `${trend.id}-fu-evidence`,
      intent: 'evidence',
      label: 'Check evidence gaps',
      prompt: `Which claims so far are directly backed by the publisher excerpt versus INVOX editorial synthesis, and what details remain unverified?`,
    });
  }

  // 3. Short-term vs. long-term implications & stakeholders
  if (!covered.has('timeline')) {
    candidates.push({
      id: `${trend.id}-fu-timeline`,
      intent: 'impact',
      label: 'Short vs. long term',
      prompt: `Separating reported facts from analysis, what are the immediate short-term effects versus longer-term implications of ${subject} for ${areaLabel}?`,
    });
  }

  // 4. Concrete opportunities & practical applications
  if (!covered.has('opportunities')) {
    candidates.push({
      id: `${trend.id}-fu-opportunities`,
      intent: 'impact',
      label: 'Opportunities & uses',
      prompt: `What practical opportunities or real-world applications could emerge from ${subject} for practitioners in ${areaLabel}?`,
    });
  }

  // 5. Risks, bottlenecks & limitations
  if (!covered.has('risks')) {
    candidates.push({
      id: `${trend.id}-fu-risks`,
      intent: 'risks',
      label: 'Risks & trade-offs',
      prompt: `What are the main technical, operational, or adoption risks that could slow or limit ${subject}?`,
    });
  }

  // 6. Stakeholder breakdown
  if (!covered.has('stakeholders')) {
    candidates.push({
      id: `${trend.id}-fu-stakeholders`,
      intent: 'impact',
      label: 'Stakeholder impact',
      prompt: `Which stakeholders or industries stand to benefit most from this development, and who faces the steepest adjustment?`,
    });
  }

  // 7. Unexplored concept / technical deep dive
  if (unexploredTag && !covered.has('explain')) {
    candidates.push({
      id: `${trend.id}-fu-explain-${unexploredTag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      intent: 'explain',
      label: 'Technical deep dive',
      prompt: `Break down how ${unexploredTag} works in the context of this development and why it matters technically.`,
    });
  }

  // 8. Conditional future scenarios (explicitly labeled as analytical scenarios, not predictions)
  if (!covered.has('scenarios')) {
    candidates.push({
      id: `${trend.id}-fu-scenarios`,
      intent: 'scenarios',
      label: 'Possible scenarios',
      prompt: `Based strictly on the reported evidence, what are two plausible future scenarios for ${subject} — and what signals would indicate each?`,
    });
  }

  // 9. Fallback secondary related trend comparison if user already compared the first one
  if (relatedTrends.length >= 2 && covered.has('compare')) {
    const secondRelated = relatedTrends[1];
    const relSubject = extractTrendSubjectPhrase(
      secondRelated.headline,
      secondRelated.category,
      secondRelated.domainName
    );
    candidates.push({
      id: `${trend.id}-fu-compare-${secondRelated.id}`,
      intent: 'compare',
      label: 'Another related trend',
      prompt: `How does "${relSubject}" add context or contrast to what we just discussed?`,
    });
  }

  // Strictly deduplicate against already-asked user messages AND against earlier candidates
  const selected: TrendSuggestedQuestion[] = [];
  for (const candidate of candidates) {
    if (selected.length >= maxCount) break;
    const isRepeatOfUser = userMessages.some(
      (asked) =>
        asked.toLowerCase() === candidate.prompt.toLowerCase() ||
        computeTokenOverlapRatio(candidate.prompt, asked) >= 0.55
    );
    if (isRepeatOfUser) continue;

    const isNearDuplicateCandidate = selected.some(
      (existing) => computeTokenOverlapRatio(candidate.prompt, existing.prompt) >= 0.6
    );
    if (isNearDuplicateCandidate) continue;

    selected.push(candidate);
  }

  // Backfill from initial trend questions only if fewer than maxCount remained after filtering
  if (selected.length < maxCount) {
    const base = generateTrendSuggestedQuestions(trend, backendContext);
    for (const item of base) {
      if (selected.length >= maxCount) break;
      const isRepeat =
        userMessages.some(
          (asked) =>
            asked.toLowerCase() === item.prompt.toLowerCase() ||
            computeTokenOverlapRatio(item.prompt, asked) >= 0.55
        ) ||
        selected.some(
          (existing) => computeTokenOverlapRatio(item.prompt, existing.prompt) >= 0.55
        );
      if (!isRepeat) {
        selected.push(item);
      }
    }
  }

  return selected.slice(0, maxCount);
}

