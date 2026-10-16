import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SparklesIcon, CloseIcon, ArrowUpRightIcon, ClockIcon, CheckIcon } from '../ui/Icons';
import { generateChatSummary } from '../../services/geminiService';
import {
    type SummaryPreset,
    calculatePresetDates,
    toLocalDatetimeString,
    formatDisplayDate,
    formatPeriodDisplayString,
    validateDateRange,
    fetchAuthorizedMessagesForRange,
} from '../../services/conversationSummaryService';

export interface SummaryMessageItem {
    id: string;
    senderId?: string;
    senderName?: string;
    text: string;
    createdAt?: any;
}

interface ConversationSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: string;
    conversationTitle: string;
    conversationType: 'inbox' | 'team';
    messages: SummaryMessageItem[];
    currentUser?: { uid: string; displayName?: string | null } | null;
}

// In-memory cache mapping cacheKey -> generated summary string
const summaryCache = new Map<string, { summary: string; generatedAt: number; count: number }>();

/**
 * Format markdown for INVOX dark monospace UI
 */
const renderSummaryContent = (text: string): React.ReactNode => {
    if (!text) return null;

    const parseInline = (line: string): React.ReactNode => {
        // Parse bold **text** and URLs
        const parts = line.split(/(\*\*.*?\*\*|https?:\/\/[^\s<>"']+)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={idx} className="text-white font-bold">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            if (/^https?:\/\//i.test(part)) {
                return (
                    <a
                        key={idx}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-0.5 break-all"
                    >
                        <span>{part}</span>
                        <ArrowUpRightIcon className="w-3 h-3 inline-block" />
                    </a>
                );
            }
            return part;
        });
    };

    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let currentBulletList: React.ReactNode[] = [];

    const flushBulletList = () => {
        if (currentBulletList.length > 0) {
            nodes.push(
                <ul
                    key={`list-${nodes.length}`}
                    className="list-none space-y-1.5 my-2.5 text-zinc-300 text-xs font-mono"
                >
                    {currentBulletList}
                </ul>
            );
            currentBulletList = [];
        }
    };

    lines.forEach((rawLine, idx) => {
        const line = rawLine.trim();

        // Section header (e.g., ### OVERVIEW, ### KEY POINTS, ### DECISIONS, ### ACTION ITEMS, ### OPEN QUESTIONS)
        if (line.startsWith('###') || line.startsWith('##') || /^([A-Z\s&]{3,30}):$/i.test(line)) {
            flushBulletList();
            const cleanTitle = line.replace(/^#{2,4}\s*/, '').replace(/:$/, '').trim();
            const isAction = cleanTitle.toUpperCase().includes('ACTION');
            const isDecision = cleanTitle.toUpperCase().includes('DECISION');
            const isOpenQ = cleanTitle.toUpperCase().includes('QUESTION');

            const accentColor = isAction
                ? 'text-amber-400'
                : isDecision
                ? 'text-cyan-400'
                : isOpenQ
                ? 'text-purple-400'
                : 'text-emerald-400';

            nodes.push(
                <div key={`header-${idx}`} className="pt-3 pb-1.5 border-b border-zinc-800/80 mb-2">
                    <span className={`text-[10px] font-mono font-bold tracking-widest ${accentColor} uppercase`}>
                        // {cleanTitle}
                    </span>
                </div>
            );
            return;
        }

        // Bullet point
        if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
            const bulletContent = line.replace(/^(\*|-|•)\s+/, '');
            currentBulletList.push(
                <li key={`item-${idx}`} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-400 font-bold select-none mt-0.5">•</span>
                    <span className="flex-1">{parseInline(bulletContent)}</span>
                </li>
            );
            return;
        }

        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
            currentBulletList.push(
                <li key={`item-${idx}`} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-zinc-500 font-bold font-mono text-[11px] select-none mt-0.5">
                        [{numMatch[1]}]
                    </span>
                    <span className="flex-1">{parseInline(numMatch[2])}</span>
                </li>
            );
            return;
        }

        flushBulletList();

        if (line) {
            nodes.push(
                <p key={`p-${idx}`} className="leading-relaxed text-zinc-300 text-xs font-mono">
                    {parseInline(line)}
                </p>
            );
        }
    });

    flushBulletList();

    return <div className="space-y-2">{nodes}</div>;
};

export const ConversationSummaryModal: React.FC<ConversationSummaryModalProps> = ({
    isOpen,
    onClose,
    conversationId,
    conversationTitle,
    conversationType,
    messages,
    currentUser,
}) => {
    // Range selection state
    const [preset, setPreset] = useState<SummaryPreset>('LAST_24_HOURS');
    const [startDateTime, setStartDateTime] = useState<string>('');
    const [endDateTime, setEndDateTime] = useState<string>('');
    const [isPeriodSelectorOpen, setIsPeriodSelectorOpen] = useState<boolean>(true);

    // Summary output state
    const [summary, setSummary] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [emptyPeriodNotice, setEmptyPeriodNotice] = useState<string | null>(null);
    const [appliedPeriodLabel, setAppliedPeriodLabel] = useState<string>('');
    const [analyzedCount, setAnalyzedCount] = useState<number>(0);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<number | null>(null);
    const [copied, setCopied] = useState<boolean>(false);

    // Track active conversation to reset state when conversation changes
    const prevConvIdRef = useRef<string>(conversationId);

    // Initialize or recalculate dates when preset changes
    const applyPreset = (newPreset: SummaryPreset) => {
        setPreset(newPreset);
        const { startDate, endDate } = calculatePresetDates(newPreset);
        setStartDateTime(toLocalDatetimeString(startDate));
        setEndDateTime(toLocalDatetimeString(endDate));
    };

    // When modal opens or conversation changes, initialize preset
    useEffect(() => {
        if (!isOpen) return;

        if (prevConvIdRef.current !== conversationId) {
            prevConvIdRef.current = conversationId;
            setSummary('');
            setError(null);
            setEmptyPeriodNotice(null);
            setAppliedPeriodLabel('');
            setAnalyzedCount(0);
            setIsPeriodSelectorOpen(true);
            applyPreset('LAST_24_HOURS');
        } else if (!startDateTime || !endDateTime) {
            applyPreset('LAST_24_HOURS');
        }
    }, [isOpen, conversationId]);

    // Validation
    const validation = useMemo(() => {
        return validateDateRange(preset, startDateTime, endDateTime);
    }, [preset, startDateTime, endDateTime]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Format transcript safely using only authorized messages
    const buildTranscript = (msgList: SummaryMessageItem[]): string => {
        return msgList
            .map((msg) => {
                const isMe = msg.senderId && currentUser?.uid && msg.senderId === currentUser.uid;
                const senderName = isMe
                    ? 'You'
                    : msg.senderName?.trim() || (conversationType === 'team' ? 'Team Member' : conversationTitle);

                let timeStr = '';
                if (msg.createdAt) {
                    try {
                        const d = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                        if (!isNaN(d.getTime())) {
                            const hours = String(d.getHours()).padStart(2, '0');
                            const mins = String(d.getMinutes()).padStart(2, '0');
                            timeStr = `[${hours}:${mins}] `;
                        }
                    } catch (_) {}
                }

                return `${timeStr}${senderName}: ${msg.text.trim()}`;
            })
            .join('\n');
    };

    // Execute summary generation for the selected period
    const executeSummary = async (forceRefresh = false) => {
        if (!validation.isValid || !validation.startDate || !validation.endDate) {
            return;
        }

        // Prevent duplicate concurrent requests
        if (loading) return;

        const periodLabel = formatPeriodDisplayString(preset, validation.startDate, validation.endDate);
        const cacheKey = `${conversationId}_${preset}_${validation.startDate.getTime()}_${validation.endDate.getTime()}`;

        // Check cache if not forcing refresh
        if (!forceRefresh) {
            const cached = summaryCache.get(cacheKey);
            if (cached) {
                setSummary(cached.summary);
                setAnalyzedCount(cached.count);
                setAppliedPeriodLabel(periodLabel);
                setLastGeneratedAt(cached.generatedAt);
                setIsPeriodSelectorOpen(false);
                setError(null);
                setEmptyPeriodNotice(null);
                return;
            }
        }

        setLoading(true);
        setError(null);
        setEmptyPeriodNotice(null);

        try {
            // 1. Fetch authorized messages within the exact selected date/time window
            const { messages: periodMessages, totalInConversation } = await fetchAuthorizedMessagesForRange({
                conversationId,
                conversationType,
                userId: currentUser?.uid,
                preset,
                startDate: validation.startDate,
                endDate: validation.endDate,
                fallbackMessages: messages,
            });

            // Handle period where no messages exist
            if (periodMessages.length === 0) {
                setSummary('');
                setAnalyzedCount(0);
                setAppliedPeriodLabel(periodLabel);
                setEmptyPeriodNotice(
                    totalInConversation === 0
                        ? 'There are no messages in this conversation yet.'
                        : `No messages were found for the period ${formatDisplayDate(validation.startDate)} — ${formatDisplayDate(validation.endDate)}. Try selecting a wider time range or ALL MESSAGES.`
                );
                setIsPeriodSelectorOpen(true);
                setLoading(false);
                return;
            }

            // 2. Build chronological transcript
            const transcript = buildTranscript(periodMessages);

            // 3. Call AI summarization service with structured instructions
            const result = await generateChatSummary(transcript, {
                title: conversationTitle,
                conversationType,
                periodLabel,
            });

            if (!result || !result.trim()) {
                throw new Error('No summary could be synthesized for this transcript.');
            }

            setSummary(result);
            setAnalyzedCount(periodMessages.length);
            setAppliedPeriodLabel(periodLabel);
            const now = Date.now();
            setLastGeneratedAt(now);
            summaryCache.set(cacheKey, { summary: result, generatedAt: now, count: periodMessages.length });
            setIsPeriodSelectorOpen(false);
        } catch (err: any) {
            console.warn('[CONVERSATION_SUMMARY_STATUS]', err?.message || err);
            setError(
                err?.message?.includes('Unauthorized')
                    ? err.message
                    : err?.message?.includes('experiencing high demand') || err?.message?.includes('503')
                    ? 'AI summary service is experiencing temporary peak demand. Please retry in a few moments.'
                    : err?.message || 'Unable to generate conversation summary at this time. Please retry.'
            );
        } finally {
            setLoading(false);
        }
    };

    // Copy summary to clipboard
    const handleCopy = () => {
        if (!summary) return;
        const textToCopy = `// INVOX AI SUMMARY: ${conversationTitle}\n// PERIOD: ${appliedPeriodLabel}\n\n${summary}`;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    const hasSummaryResult = Boolean(summary && !loading);

    return (
        <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[120] p-3 sm:p-4 font-mono select-none"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-modal-title"
        >
            <div
                className="bg-[#0c0c0e] border border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Top Header */}
                <div className="h-14 px-4 sm:px-5 border-b border-zinc-800 bg-[#0e0e11] flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-zinc-900 border border-zinc-750 flex items-center justify-center flex-shrink-0 text-emerald-400">
                            <SparklesIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                    // AI SUMMARY
                                </span>
                                <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 border uppercase ${
                                        conversationType === 'team'
                                            ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
                                            : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                    }`}
                                >
                                    {conversationType === 'team' ? 'TEAM SQUAD' : 'DIRECT CHAT'}
                                </span>
                            </div>
                            <h3
                                id="summary-modal-title"
                                className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate"
                            >
                                {conversationTitle}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {hasSummaryResult && !isPeriodSelectorOpen && (
                            <button
                                type="button"
                                onClick={() => setIsPeriodSelectorOpen(true)}
                                className="h-8 px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 hover:bg-zinc-850 text-zinc-300 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Change summary date range"
                            >
                                <ClockIcon className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="hidden sm:inline text-[10px] font-bold">// ADJUST RANGE</span>
                            </button>
                        )}

                        {hasSummaryResult && (
                            <button
                                type="button"
                                onClick={() => executeSummary(true)}
                                disabled={loading}
                                className="h-8 px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 hover:bg-zinc-850 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                                title="Regenerate fresh summary"
                            >
                                <span className={loading ? 'animate-spin' : ''}>↻</span>
                                <span className="hidden sm:inline text-[10px] font-bold">// REFRESH</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            aria-label="Close summary modal"
                            title="Close"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Subheader: Active Scope & Applied Range Indicator */}
                <div className="px-4 sm:px-5 py-2 border-b border-zinc-850 bg-black/40 flex items-center justify-between text-[10px] text-zinc-500 flex-shrink-0">
                    <span className="truncate">
                        {appliedPeriodLabel ? (
                            <span className="text-zinc-400 font-bold">
                                // PERIOD: <span className="text-emerald-400">{appliedPeriodLabel}</span>
                            </span>
                        ) : (
                            '// SCOPE: ONLY AUTHORIZED MESSAGES FROM ACTIVE THREAD'
                        )}
                    </span>
                    <span className="flex-shrink-0 text-zinc-600 hidden sm:inline">
                        AI-GENERATED • CHRONOLOGICALLY GROUNDED
                    </span>
                </div>

                {/* Modal Body Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 select-text space-y-4">
                    {/* Period Selection Section */}
                    {isPeriodSelectorOpen && (
                        <div className="bg-[#111115] border border-zinc-800 p-3.5 sm:p-4 space-y-3.5 transition-all">
                            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                                        // SELECT SUMMARY PERIOD
                                    </span>
                                </div>
                                {hasSummaryResult && (
                                    <button
                                        type="button"
                                        onClick={() => setIsPeriodSelectorOpen(false)}
                                        className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase cursor-pointer"
                                    >
                                        [ HIDE SELECTOR ]
                                    </button>
                                )}
                            </div>

                            {/* Preset Buttons */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                                    QUICK SELECT PRESETS:
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {(
                                        [
                                            { id: 'LAST_HOUR', label: 'LAST HOUR' },
                                            { id: 'LAST_24_HOURS', label: 'LAST 24 HOURS' },
                                            { id: 'LAST_7_DAYS', label: 'LAST 7 DAYS' },
                                            { id: 'LAST_30_DAYS', label: 'LAST 30 DAYS' },
                                            { id: 'ALL_MESSAGES', label: 'ALL MESSAGES' },
                                            { id: 'CUSTOM_RANGE', label: 'CUSTOM RANGE' },
                                        ] as { id: SummaryPreset; label: string }[]
                                    ).map((opt) => {
                                        const isActive = preset === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => applyPreset(opt.id)}
                                                className={`px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider text-left border transition-colors flex items-center justify-between cursor-pointer ${
                                                    isActive
                                                        ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-400 font-bold'
                                                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {isActive && <span className="text-[9px]">●</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Date & Time Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {/* FROM input */}
                                <div className="space-y-1">
                                    <label
                                        htmlFor="summary-from-input"
                                        className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between"
                                    >
                                        <span>FROM (START DATE & TIME)</span>
                                        {preset === 'ALL_MESSAGES' && (
                                            <span className="text-zinc-600 text-[9px]">[START OF THREAD]</span>
                                        )}
                                    </label>
                                    <input
                                        id="summary-from-input"
                                        type="datetime-local"
                                        value={startDateTime}
                                        disabled={preset === 'ALL_MESSAGES'}
                                        onChange={(e) => {
                                            setStartDateTime(e.target.value);
                                            setPreset('CUSTOM_RANGE');
                                        }}
                                        className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500/80 text-zinc-100 font-mono text-xs px-3 py-2 outline-none disabled:opacity-40 disabled:cursor-not-allowed [color-scheme:dark]"
                                    />
                                </div>

                                {/* TO input */}
                                <div className="space-y-1">
                                    <label
                                        htmlFor="summary-to-input"
                                        className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between"
                                    >
                                        <span>TO (END DATE & TIME)</span>
                                        {preset === 'ALL_MESSAGES' && (
                                            <span className="text-zinc-600 text-[9px]">[CURRENT TIME]</span>
                                        )}
                                    </label>
                                    <input
                                        id="summary-to-input"
                                        type="datetime-local"
                                        value={endDateTime}
                                        disabled={preset === 'ALL_MESSAGES'}
                                        onChange={(e) => {
                                            setEndDateTime(e.target.value);
                                            setPreset('CUSTOM_RANGE');
                                        }}
                                        className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500/80 text-zinc-100 font-mono text-xs px-3 py-2 outline-none disabled:opacity-40 disabled:cursor-not-allowed [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {/* Inline Validation Banner */}
                            {!validation.isValid && validation.error && (
                                <div className="p-2.5 bg-red-950/30 border border-red-900/60 text-red-400 text-xs flex items-center gap-2">
                                    <span className="font-bold select-none">⚠</span>
                                    <span>{validation.error}</span>
                                </div>
                            )}

                            {/* Selector Action Controls */}
                            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-zinc-800/80">
                                <div className="text-[10px] text-zinc-500 truncate">
                                    Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'}
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => executeSummary(false)}
                                        disabled={!validation.isValid || loading}
                                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-bold uppercase tracking-wider text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                <span>GENERATING...</span>
                                            </>
                                        ) : (
                                            <>
                                                <SparklesIcon className="w-3.5 h-3.5" />
                                                <span>GENERATE SUMMARY</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="py-16 text-center space-y-3 bg-[#0a0a0d] border border-zinc-850 p-6">
                            <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin mx-auto" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                    // SYNTHESIZING CONVERSATION PERIOD...
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                    Filtering and analyzing authorized messages within your selected timeframe.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {!loading && error && (
                        <div className="p-6 border border-red-900/60 bg-red-950/20 text-center space-y-3">
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block">
                                // SYNTHESIS FAILED
                            </span>
                            <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                                {error}
                            </p>
                            <div className="pt-2 flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPeriodSelectorOpen(true)}
                                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-750 hover:border-zinc-600 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    // ADJUST RANGE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => executeSummary(true)}
                                    className="px-4 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    // RETRY SYNTHESIS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty Period Notice (No messages found in selected range) */}
                    {!loading && emptyPeriodNotice && (
                        <div className="py-12 text-center space-y-3 border border-dashed border-zinc-800 bg-[#09090c] p-6">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                // NO MESSAGES IN SELECTED PERIOD
                            </span>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                NO CONVERSATION ACTIVITY FOUND
                            </h4>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                {emptyPeriodNotice}
                            </p>
                            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => {
                                        applyPreset('ALL_MESSAGES');
                                        // Trigger generation with ALL_MESSAGES
                                        setTimeout(() => {
                                            executeSummary(false);
                                        }, 50);
                                    }}
                                    className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/80 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    // SUMMARIZE ALL MESSAGES
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPeriodSelectorOpen(true)}
                                    className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-750 hover:border-zinc-600 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    // ADJUST RANGE
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Summary Result Content */}
                    {!loading && hasSummaryResult && (
                        <div className="space-y-4">
                            {/* Summary Period Heading Header */}
                            <div className="bg-[#121217] border border-zinc-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">
                                        SUMMARY PERIOD:
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                                        {appliedPeriodLabel}
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                                    <span>{analyzedCount} message{analyzedCount === 1 ? '' : 's'} included</span>
                                </div>
                            </div>

                            {/* Structured Render of AI Summary */}
                            <div className="p-2 sm:p-3 bg-[#0a0a0d] border border-zinc-850">
                                {renderSummaryContent(summary)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="h-12 px-4 sm:px-5 border-t border-zinc-800 bg-[#0a0a0d] flex items-center justify-between text-[11px] text-zinc-500 flex-shrink-0">
                    <span className="truncate">
                        {analyzedCount > 0 ? (
                            <span>
                                {analyzedCount} message{analyzedCount === 1 ? '' : 's'} analyzed
                                {lastGeneratedAt ? ' • Synced' : ''}
                            </span>
                        ) : (
                            <span>Select a period to synthesize conversation</span>
                        )}
                    </span>

                    <div className="flex items-center gap-2">
                        {hasSummaryResult && (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                                title="Copy summary to clipboard"
                            >
                                {copied ? (
                                    <>
                                        <CheckIcon className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400">COPIED</span>
                                    </>
                                ) : (
                                    <span>// COPY</span>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-600 text-white text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            // CLOSE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
