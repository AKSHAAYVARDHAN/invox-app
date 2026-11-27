import React, { useState } from 'react';
import { ArrowUpRightIcon, PlayIcon } from '../ui/Icons';
import {
    formatEditorialDate,
    type RelatedTrendMatch,
    type TrendViewModel,
} from '../../services/trendzService';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';

interface RelatedTrendsSectionProps {
    matches: RelatedTrendMatch[];
    loading: boolean;
    error: string | null;
    isFallbackMode?: boolean;
    onSelectTrend: (trend: TrendViewModel) => void;
    onRetry?: () => void;
}

const RelatedTrendCard: React.FC<{
    match: RelatedTrendMatch;
    onSelect: (trend: TrendViewModel) => void;
}> = ({ match, onSelect }) => {
    const { trend, primaryReason } = match;
    const [thumbFailed, setThumbFailed] = useState(false);

    const safeTitle = trend.title || 'Untitled Trend';
    const safeSummary = (trend.summary || trend.fullContent || '').trim();
    const safeDomainName = trend.domain?.name || 'General';
    const categoryLabel =
        trend.category &&
        trend.category.trim().toLowerCase() !== safeDomainName.trim().toLowerCase()
            ? trend.category.trim()
            : null;
    const safePublisher = (trend.details?.publishedBy || '').trim();
    const editorialDate = trend.publishedAtMs
        ? formatEditorialDate(trend.publishedAtMs)
        : trend.details?.publishedOn || 'RECENT';

    const rawThumbnail =
        trend.thumbnailUrl ||
        trend.sourceThumbnailUrl ||
        (trend.mediaType === 'image' ? trend.mediaUrl : '');
    const safeThumbnailUrl = !thumbFailed ? sanitizeExternalUrl(rawThumbnail) : null;
    const DomainIcon = trend.domain?.icon;

    return (
        <article className="group bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 transition-colors flex flex-col">
            <button
                type="button"
                onClick={() => onSelect(trend)}
                aria-label={`Open related trend: ${safeTitle}`}
                className="text-left flex flex-col h-full w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
            >
                {safeThumbnailUrl && (
                    <div className="relative w-full aspect-video bg-black border-b border-zinc-800 overflow-hidden shrink-0">
                        <img
                            src={safeThumbnailUrl}
                            alt={safeTitle}
                            loading="lazy"
                            onError={() => setThumbFailed(true)}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-200"
                        />
                        {trend.mediaType === 'video' && (
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/85 border border-zinc-700 font-mono text-[10px] text-white uppercase tracking-wider">
                                <PlayIcon className="w-3 h-3" />
                                <span>VIDEO</span>
                            </span>
                        )}
                    </div>
                )}

                <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                    <div className="space-y-2.5">
                        {/* Domain / Category & Relevance Cue */}
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-white">
                                    {DomainIcon && (
                                        <DomainIcon className="w-3 h-3 text-zinc-300 shrink-0" />
                                    )}
                                    <span className="truncate">{safeDomainName}</span>
                                </span>
                                {categoryLabel && (
                                    <span className="px-1.5 py-0.5 bg-black border border-zinc-800 text-zinc-400 truncate max-w-[140px]">
                                        {categoryLabel}
                                    </span>
                                )}
                            </div>

                            {primaryReason && (
                                <span className="text-zinc-500 truncate max-w-[150px]">
                                    {primaryReason}
                                </span>
                            )}
                        </div>

                        {/* Headline */}
                        <h4 className="font-mono text-sm font-bold text-white leading-snug tracking-tight line-clamp-2 group-hover:text-zinc-200 transition-colors">
                            {safeTitle}
                        </h4>

                        {/* Short Summary */}
                        {safeSummary && (
                            <p className="font-sans text-xs text-zinc-400 leading-relaxed line-clamp-2">
                                {safeSummary}
                            </p>
                        )}
                    </div>

                    {/* Footer: Publisher, Publication Date & Open Indicator */}
                    <div className="pt-3 border-t border-zinc-900 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                            {safePublisher && (
                                <>
                                    <span className="text-zinc-300 font-semibold truncate">
                                        {safePublisher}
                                    </span>
                                    <span className="text-zinc-700" aria-hidden="true">
                                        /
                                    </span>
                                </>
                            )}
                            <time
                                dateTime={
                                    trend.publishedAtMs
                                        ? new Date(trend.publishedAtMs).toISOString()
                                        : undefined
                                }
                                className="shrink-0"
                            >
                                {editorialDate}
                            </time>
                            {trend.isFallback && (
                                <>
                                    <span className="text-zinc-700" aria-hidden="true">
                                        /
                                    </span>
                                    <span className="text-zinc-500 shrink-0">SAMPLE</span>
                                </>
                            )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-zinc-400 group-hover:text-white transition-colors shrink-0">
                            <span>READ</span>
                            <ArrowUpRightIcon className="w-3 h-3" />
                        </span>
                    </div>
                </div>
            </button>
        </article>
    );
};

const RelatedTrendsSkeleton: React.FC = () => (
    <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        aria-busy="true"
        aria-label="Loading related trends"
    >
        {[0, 1].map((idx) => (
            <div
                key={idx}
                className="bg-[#0c0c0e] border border-zinc-800 animate-pulse flex flex-col"
            >
                <div className="w-full aspect-video bg-zinc-900 border-b border-zinc-800" />
                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="h-4 w-24 bg-zinc-900" />
                        <div className="h-3 w-16 bg-zinc-900" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-4 w-full bg-zinc-900" />
                        <div className="h-4 w-3/4 bg-zinc-900" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-3 w-full bg-zinc-900/80" />
                        <div className="h-3 w-5/6 bg-zinc-900/80" />
                    </div>
                    <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
                        <div className="h-3 w-28 bg-zinc-900" />
                        <div className="h-3 w-10 bg-zinc-900" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const RelatedTrendsSection: React.FC<RelatedTrendsSectionProps> = ({
    matches,
    loading,
    error,
    isFallbackMode = false,
    onSelectTrend,
    onRetry,
}) => {
    return (
        <section
            aria-labelledby="related-trends-heading"
            className="mt-8 border-t border-zinc-800/80 pt-6"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-white" aria-hidden="true" />
                    <h3
                        id="related-trends-heading"
                        className="font-mono text-xs font-bold text-white uppercase tracking-wider"
                    >
                        // RELATED_TRENDS
                    </h3>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                    {isFallbackMode && <span>SAMPLE_DATASET</span>}
                    {!loading && !error && matches.length > 0 && (
                        <span>
                            [{matches.length} {matches.length === 1 ? 'MATCH' : 'MATCHES'}]
                        </span>
                    )}
                </div>
            </div>

            {loading ? (
                <RelatedTrendsSkeleton />
            ) : error ? (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                    <p className="text-zinc-400">// ERROR: {error}</p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="px-3 py-1.5 bg-white text-black font-bold text-[10px] uppercase tracking-wider hover:bg-zinc-200 transition-colors shrink-0"
                        >
                            RETRY
                        </button>
                    )}
                </div>
            ) : matches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {matches.map((match) => (
                        <RelatedTrendCard
                            key={match.trend.id}
                            match={match}
                            onSelect={onSelectTrend}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-5 font-mono space-y-1.5">
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        // NO_CLOSELY_RELATED_TRENDS
                    </p>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        No other published briefings currently share strong topical overlap with this trend.
                    </p>
                </div>
            )}
        </section>
    );
};

export default RelatedTrendsSection;
