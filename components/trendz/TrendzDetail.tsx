import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Trend } from '../../types';
import {
    ArrowLeftIcon,
    ArrowUpRightIcon,
    PlayIcon,
    BookmarkIcon,
    ArrowUpIcon,
    TrendingUpIcon,
    EqualsInCircleIcon,
    SoundWaveIcon,
    ForwardIcon,
    PauseIcon,
    VolumeUpIcon,
    VolumeOffIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ShieldCheckIcon,
    SparklesIcon,
    CheckIcon,
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';
import { normalizeTrendzDomainSlug, type TrendzDomainSlug } from '../../utils/trendzDomains';
import { useTrendzEngagement } from '../../contexts/TrendzEngagementContext';
import {
    canonicalizeExternalUrlClient,
    deriveInitialSourceVerification,
    formatEditorialDate,
    formatVerificationTimestamp,
    shareTrendItem,
    verifyTrendSourceUrl,
    type SourceExcerptCompleteness,
    type SourceVerificationResult,
    type SourceVerificationStatus,
    type TrendViewModel,
} from '../../services/trendzService';
import { generateTrendSuggestedQuestions } from '../../utils/trendzSuggestedQuestions';
import TrendzContextualAiPanel from './TrendzContextualAiPanel';

interface TrendzDetailProps {
    trend: Trend | TrendViewModel;
    onBack: () => void;
    backLabel?: string;
    onSelectDomain?: (domainSlug: TrendzDomainSlug) => void;
}

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num;
};

const CREDIBILITY_TIER_LABELS: Record<'primary' | 'reputable' | 'trade', string> = {
    primary: 'PRIMARY_SOURCE',
    reputable: 'REPUTABLE_OUTLET',
    trade: 'TRADE_PUBLICATION',
};

const VERIFICATION_STATUS_META: Record<
    SourceVerificationStatus,
    { badge: string; label: string; badgeClass: string; description: string }
> = {
    verified: {
        badge: 'URL_VERIFIED',
        label: 'VERIFIED (LINK REACHABLE)',
        badgeClass: 'bg-black border-zinc-600 text-white',
        description: 'Source URL responded successfully at the last verification check.',
    },
    unavailable: {
        badge: 'URL_UNAVAILABLE',
        label: 'UNAVAILABLE',
        badgeClass: 'bg-black border-zinc-700 text-zinc-400',
        description: 'Source URL could not be reached during the last check.',
    },
    unverified: {
        badge: 'URL_UNVERIFIED',
        label: 'UNVERIFIED',
        badgeClass: 'bg-black border-zinc-800 text-zinc-500',
        description: 'No successful URL verification check is recorded for this source.',
    },
    pending: {
        badge: 'CHECKING_URL...',
        label: 'CHECKING SOURCE...',
        badgeClass: 'bg-black border-zinc-800 text-zinc-400',
        description: 'Checking publisher URL reachability and canonical metadata.',
    },
};

const TrendzDetail: React.FC<TrendzDetailProps> = ({
    trend,
    onBack,
    backLabel = '// BACK_TO_TRENDZ',
    onSelectDomain,
}) => {
    const {
        authLoading,
        isDomainFollowed,
        isDomainPending,
        toggleFollowDomain,
        isTrendBookmarked,
        isBookmarkPending,
        toggleBookmark,
        isTrendUpvoted,
        isUpvotePending,
        toggleUpvote,
        trackTrendView,
        getDisplayStats,
        actionError,
        clearActionError,
    } = useTrendzEngagement();

    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const isVideo = trend.mediaType === 'video';

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const playbackRates = [0.75, 1, 1.25, 1.5];
    const { isFullscreen, toggleFullscreen } = useFullscreen(videoContainerRef);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'shared' | 'error'>('idle');
    const shareTimerRef = useRef<number | null>(null);
    const [liveVerification, setLiveVerification] = useState<SourceVerificationResult | null>(null);
    const [verificationStatus, setVerificationStatus] =
        useState<SourceVerificationStatus>('unverified');
    const [verificationReason, setVerificationReason] = useState<string | null>(null);
    const [isRecheckingSource, setIsRecheckingSource] = useState(false);
    const [sourceThumbFailed, setSourceThumbFailed] = useState(false);
    const location = ReactRouterDOM.useLocation();
    const navigate = ReactRouterDOM.useNavigate();
    const [isContextualAiOpen, setIsContextualAiOpen] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('ai') === '1';
    });
    const [queuedAiPrompt, setQueuedAiPrompt] = useState<{ id: number; text: string } | null>(null);
    const promptNonceRef = useRef(0);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('ai') === '1') {
            setIsContextualAiOpen(true);
            params.delete('ai');
            const nextSearch = params.toString();
            navigate(
                { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
                { replace: true }
            );
        }
    }, [location.pathname, location.search, navigate]);

    const safeTitle = trend.title || 'Untitled Trend';
    const safeSummary = (trend.summary || '').trim();
    const safeFullContent = (trend.fullContent || trend.summary || '').trim();
    const safePublisher = trend.details?.publishedBy || 'INVOX Desk';
    const safePublishedOn = trend.details?.publishedOn || 'RECENT';
    const safeDomainName = trend.domain?.name || 'General';
    const resolvedDomainSlug =
        ('domainSlug' in trend ? trend.domainSlug : null) ||
        normalizeTrendzDomainSlug(safeDomainName) ||
        'technology';

    const viewModelTrend: TrendViewModel =
        'domainSlug' in trend
            ? trend
            : {
                  ...trend,
                  domainSlug: resolvedDomainSlug,
                  category: safeDomainName,
                  tags: [],
                  searchKeywords: [],
                  momentumScore: 0,
                  relatedTrendIds: [],
                  keyTakeaways: [],
                  status: 'published',
                  publishedAtMs: Date.now(),
              };

    const editorialDate = viewModelTrend.publishedAtMs
        ? formatEditorialDate(viewModelTrend.publishedAtMs)
        : safePublishedOn;

    const categoryLabel =
        viewModelTrend.category &&
        viewModelTrend.category.trim().toLowerCase() !== safeDomainName.trim().toLowerCase()
            ? viewModelTrend.category.trim()
            : null;

    const hasDistinctSummary =
        Boolean(safeSummary) &&
        Boolean(safeFullContent) &&
        safeSummary.toLowerCase() !== safeFullContent.toLowerCase();

    const briefingParagraphs = safeFullContent
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    const safeSourceUrl = sanitizeExternalUrl(trend.details?.link);
    const effectiveCanonicalUrl =
        sanitizeExternalUrl(liveVerification?.canonicalUrl) ||
        sanitizeExternalUrl(viewModelTrend.canonicalUrl) ||
        canonicalizeExternalUrlClient(safeSourceUrl) ||
        null;
    const effectiveAuthor = viewModelTrend.sourceAuthor || liveVerification?.author;
    const effectiveSourceSiteName =
        liveVerification?.publisherName &&
        liveVerification.publisherName.trim().toLowerCase() !== safePublisher.trim().toLowerCase()
            ? liveVerification.publisherName.trim()
            : null;
    const effectiveSourceThumbnailUrl = !sourceThumbFailed
        ? sanitizeExternalUrl(liveVerification?.sourceThumbnailUrl) ||
          sanitizeExternalUrl(viewModelTrend.sourceThumbnailUrl) ||
          null
        : null;
    const formattedDiscoveredAt = formatVerificationTimestamp(viewModelTrend.discoveredAtMs);
    const formattedLastVerifiedAt = formatVerificationTimestamp(
        liveVerification?.checkedAtIso ?? viewModelTrend.sourceRetrievedAtMs
    );
    const effectiveExcerpt = (
        liveVerification?.excerpt ||
        viewModelTrend.sourceExcerpt ||
        ''
    ).trim();
    const effectiveExcerptCompleteness: SourceExcerptCompleteness = liveVerification?.excerpt
        ? liveVerification.excerptCompleteness
        : effectiveExcerpt
          ? viewModelTrend.sourceExcerptCompleteness ||
            (viewModelTrend.sourceExcerptTruncated ? 'truncated' : 'full_excerpt')
          : liveVerification?.excerptCompleteness ||
            viewModelTrend.sourceExcerptCompleteness ||
            'unavailable';
    const aiBriefingTag = viewModelTrend.aiModel
        ? `AI_SYNTHESIS · ${viewModelTrend.aiModel}`
        : 'AI_SYNTHESIS';
    const verificationMeta = VERIFICATION_STATUS_META[verificationStatus];

    const sanitizedAdditionalSources = (viewModelTrend.additionalSources || []).filter(
        (src) => Boolean(src?.name) && Boolean(sanitizeExternalUrl(src?.url))
    );

    const hasMedia = Boolean(trend.mediaUrl && trend.mediaUrl.trim());
    const DomainIcon = trend.domain?.icon;

    const displayStats = getDisplayStats(viewModelTrend);
    const safeLikes = displayStats.likes;
    const safeViews = displayStats.views;
    const safeComments = displayStats.comments;
    const safeSaves = displayStats.saves;

    const domainFollowed = isDomainFollowed(resolvedDomainSlug);
    const domainPending = isDomainPending(resolvedDomainSlug);
    const bookmarked = isTrendBookmarked(trend.id, Boolean(viewModelTrend.isFallback));
    const bookmarkPending = isBookmarkPending(trend.id, Boolean(viewModelTrend.isFallback));
    const upvoted = isTrendUpvoted(trend.id, Boolean(viewModelTrend.isFallback));
    const upvotePending = isUpvotePending(trend.id, Boolean(viewModelTrend.isFallback));

    const togglePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
            } else {
                videoRef.current.pause();
            }
        }
    };

    const contextualAiMode = viewModelTrend.isFallback ? 'dev_fallback' : 'live';

    const previewSuggestedQuestions = useMemo(
        () =>
            generateTrendSuggestedQuestions({
                id: viewModelTrend.id,
                title: safeTitle,
                domainName: safeDomainName,
                domainSlug: resolvedDomainSlug,
                category: categoryLabel,
                publisherName: safePublisher,
                summary: safeSummary,
                whyItMatters: viewModelTrend.whyItMatters,
                keyTakeaways: viewModelTrend.keyTakeaways,
                tags: viewModelTrend.tags,
                excerptCompleteness: effectiveExcerptCompleteness,
                groundingStatus: viewModelTrend.groundingStatus,
                isFallback: Boolean(viewModelTrend.isFallback),
                hasRelatedTrends: Boolean(
                    viewModelTrend.relatedTrendIds && viewModelTrend.relatedTrendIds.length > 0
                ),
            }).slice(0, 3),
        [
            viewModelTrend.id,
            safeTitle,
            safeDomainName,
            resolvedDomainSlug,
            categoryLabel,
            safePublisher,
            safeSummary,
            viewModelTrend.whyItMatters,
            viewModelTrend.keyTakeaways,
            viewModelTrend.tags,
            effectiveExcerptCompleteness,
            viewModelTrend.groundingStatus,
            viewModelTrend.isFallback,
            viewModelTrend.relatedTrendIds,
        ]
    );

    useEffect(() => {
        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
        setZoomedImageUrl(null);
        setShareFeedback('idle');
        setSourceThumbFailed(false);
        setIsContextualAiOpen(false);
        setQueuedAiPrompt(null);
    }, [trend.id, contextualAiMode]);

    useEffect(() => {
        return () => {
            if (shareTimerRef.current !== null && typeof window !== 'undefined') {
                window.clearTimeout(shareTimerRef.current);
            }
        };
    }, []);

    // Derive initial source verification state from persisted metadata and run cached live check when needed
    useEffect(() => {
        let cancelled = false;
        const initial = deriveInitialSourceVerification({
            details: trend.details,
            sourceRetrievedAtMs: viewModelTrend.sourceRetrievedAtMs,
            isSimulatedSource: viewModelTrend.isSimulatedSource,
        });

        setLiveVerification(null);
        setIsRecheckingSource(false);

        if (!initial.needsLiveCheck || !safeSourceUrl) {
            setVerificationStatus(initial.status);
            setVerificationReason(initial.reason);
            return () => {
                cancelled = true;
            };
        }

        setVerificationStatus('pending');
        setVerificationReason(initial.reason);

        void verifyTrendSourceUrl(safeSourceUrl).then((result) => {
            if (cancelled) return;
            setLiveVerification(result);
            setVerificationStatus(result.status);
            setVerificationReason(result.failureReason || null);
        });

        return () => {
            cancelled = true;
        };
    }, [
        trend.id,
        safeSourceUrl,
        viewModelTrend.sourceRetrievedAtMs,
        viewModelTrend.isSimulatedSource,
    ]);

    const handleRecheckSource = async () => {
        if (!safeSourceUrl || viewModelTrend.isSimulatedSource || isRecheckingSource) {
            return;
        }
        setIsRecheckingSource(true);
        setVerificationStatus('pending');
        setVerificationReason('Running fresh URL reachability check...');
        try {
            const result = await verifyTrendSourceUrl(safeSourceUrl, { forceRefresh: true });
            setLiveVerification(result);
            setVerificationStatus(result.status);
            setVerificationReason(result.failureReason || null);
            setSourceThumbFailed(false);
        } finally {
            setIsRecheckingSource(false);
        }
    };

    // Record deduplicated per-user/session view after auth resolves (supports live, anonymous, and DEV_FALLBACK)
    useEffect(() => {
        if (authLoading) return;
        void trackTrendView(viewModelTrend);
    }, [authLoading, viewModelTrend.id, viewModelTrend.isFallback, trackTrendView]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
        }
    };

    const handleProgressPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (videoRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const videoDuration = videoRef.current.duration;
            if (videoDuration > 0) {
                const seekTime = (clickX / width) * videoDuration;
                videoRef.current.currentTime = seekTime;
                setProgress(seekTime);
            }
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value);
        if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume === 0) {
                setIsMuted(true);
            }
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            const newMutedState = !videoRef.current.muted;
            videoRef.current.muted = newMutedState;
            if (!newMutedState && volume === 0) {
                setVolume(1);
                videoRef.current.volume = 1;
            }
        }
    };

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const toggleFullScreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFullscreen();
    };

    const cyclePlaybackRate = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentIndex = playbackRates.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % playbackRates.length;
        setPlaybackRate(playbackRates[nextIndex]);
    };

    const handleOpenContextualAi = useCallback((initialPrompt?: string) => {
        if (initialPrompt && initialPrompt.trim()) {
            promptNonceRef.current += 1;
            setQueuedAiPrompt({
                id: promptNonceRef.current,
                text: initialPrompt.trim(),
            });
        }
        setIsContextualAiOpen(true);
    }, []);

    const handleConsumeQueuedPrompt = useCallback(() => {
        setQueuedAiPrompt(null);
    }, []);

    const handleShareTrend = async () => {
        const result = await shareTrendItem(viewModelTrend);
        if (result.status === 'cancelled') {
            return;
        }
        setShareFeedback(result.status);
        if (typeof window !== 'undefined') {
            if (shareTimerRef.current !== null) {
                window.clearTimeout(shareTimerRef.current);
            }
            shareTimerRef.current = window.setTimeout(() => {
                setShareFeedback('idle');
                shareTimerRef.current = null;
            }, 2200);
        }
    };

    return (
        <>
            <article className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-6">
                {/* Top Navigation & Classification Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4 mb-5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span>{backLabel}</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                        {onSelectDomain ? (
                            <button
                                type="button"
                                onClick={() => onSelectDomain(resolvedDomainSlug)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-white hover:border-zinc-500 transition-colors"
                                title={`Filter feed by ${safeDomainName}`}
                            >
                                {DomainIcon && <DomainIcon className="w-3.5 h-3.5 text-zinc-300" />}
                                <span>{safeDomainName}</span>
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-white">
                                {DomainIcon && <DomainIcon className="w-3.5 h-3.5 text-zinc-300" />}
                                <span>{safeDomainName}</span>
                            </span>
                        )}

                        {categoryLabel && (
                            <span className="px-2.5 py-1 bg-black border border-zinc-800 text-zinc-400">
                                // {categoryLabel}
                            </span>
                        )}

                        <span
                            data-verification-status={verificationStatus}
                            title={`${verificationMeta.description} (Checks URL reachability only; does not independently fact-check claims.)`}
                            className={`inline-flex items-center gap-1 px-2 py-1 border ${verificationMeta.badgeClass}`}
                        >
                            {verificationStatus === 'verified' && (
                                <ShieldCheckIcon className="w-3.5 h-3.5" />
                            )}
                            <span>{verificationMeta.badge}</span>
                        </span>

                        {viewModelTrend.groundingStatus && (
                            <span
                                title={
                                    viewModelTrend.groundingStatus === 'verified'
                                        ? 'Editorial briefing passed source-grounding check during pipeline review (separate from live URL reachability).'
                                        : 'Editorial grounding flagged for review.'
                                }
                                className="px-2 py-1 bg-black border border-zinc-800 text-zinc-400"
                            >
                                {viewModelTrend.groundingStatus === 'verified'
                                    ? 'GROUNDING: SOURCE_ALIGNED'
                                    : 'GROUNDING: NEEDS_REVIEW'}
                            </span>
                        )}

                        {viewModelTrend.isFallback && (
                            <span className="px-2 py-1 bg-black border border-zinc-800 text-zinc-500">
                                DEV_FALLBACK
                            </span>
                        )}
                    </div>
                </div>

                {/* Editorial Header */}
                <header className="mb-5">
                    <h1 className="text-xl sm:text-2xl lg:text-[26px] font-bold font-mono text-white leading-snug tracking-tight mb-3.5">
                        {safeTitle}
                    </h1>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-zinc-400">
                            <span className="text-white font-semibold uppercase tracking-wider">
                                {safePublisher}
                            </span>
                            {effectiveAuthor && (
                                <>
                                    <span className="text-zinc-700" aria-hidden="true">/</span>
                                    <span className="text-zinc-400">BY {effectiveAuthor}</span>
                                </>
                            )}
                            <span className="text-zinc-700" aria-hidden="true">/</span>
                            <time
                                dateTime={
                                    viewModelTrend.publishedAtMs
                                        ? new Date(viewModelTrend.publishedAtMs).toISOString()
                                        : undefined
                                }
                                className="text-zinc-400 uppercase"
                            >
                                {editorialDate}
                            </time>
                            {viewModelTrend.region && (
                                <>
                                    <span className="text-zinc-700" aria-hidden="true">/</span>
                                    <span className="text-zinc-500 uppercase">{viewModelTrend.region}</span>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => void toggleFollowDomain(resolvedDomainSlug)}
                            disabled={domainPending}
                            aria-pressed={domainFollowed}
                            aria-label={domainFollowed ? `Unfollow ${safeDomainName}` : `Follow ${safeDomainName}`}
                            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors disabled:opacity-50 shrink-0 ${
                                domainFollowed
                                    ? 'bg-zinc-900 text-white border-zinc-600 font-bold hover:border-zinc-500'
                                    : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white'
                            }`}
                        >
                            {domainPending ? '...' : domainFollowed ? 'FOLLOWING DOMAIN' : `+ FOLLOW ${safeDomainName}`}
                        </button>
                    </div>
                </header>

                {/* Primary Media Block */}
                {hasMedia && (
                    <figure className="mb-5">
                        <AspectRatioBox
                            ref={videoContainerRef}
                            ratio="video"
                            className={`bg-black border border-zinc-800 group ${isVideo ? 'cursor-pointer' : 'cursor-zoom-in'}`}
                            onMouseEnter={() => setIsControlsVisible(true)}
                            onMouseLeave={() => setIsControlsVisible(false)}
                            onClick={
                                isVideo
                                    ? togglePlayPause
                                    : () => trend.mediaUrl && setZoomedImageUrl(trend.mediaUrl)
                            }
                        >
                            {isVideo ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        src={trend.mediaUrl}
                                        poster={trend.thumbnailUrl}
                                        onTimeUpdate={handleTimeUpdate}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        muted={isMuted}
                                        playsInline
                                        title={safeTitle}
                                        className="w-full h-full object-cover"
                                    />

                                    <div
                                        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/40 pointer-events-none`}
                                    >
                                        <div className="w-14 h-14 bg-black/80 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                            <PlayIcon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>

                                    <div
                                        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 transition-opacity duration-200 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="w-full mb-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max={duration || 0}
                                                value={progress}
                                                onChange={handleSeek}
                                                onPointerDown={handleProgressPointerDown}
                                                aria-label="Video progress"
                                                className="w-full h-1 bg-zinc-700 appearance-none cursor-pointer accent-white"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-white">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={togglePlayPause}
                                                    className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors"
                                                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                                                >
                                                    {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                                </button>
                                                <div className="flex items-center gap-1 group/volume">
                                                    <button
                                                        type="button"
                                                        onClick={toggleMute}
                                                        className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors"
                                                        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                                                    >
                                                        {isMuted || volume === 0 ? (
                                                            <VolumeOffIcon className="w-4 h-4" />
                                                        ) : (
                                                            <VolumeUpIcon className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={isMuted ? 0 : volume}
                                                        onChange={handleVolumeChange}
                                                        aria-label="Volume control"
                                                        className="w-0 h-1 bg-zinc-700 appearance-none cursor-pointer accent-white transition-all duration-200 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-16"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 font-mono text-[11px]">
                                                <span className="text-zinc-300 tracking-wider">
                                                    [{formatTime(progress)} / {formatTime(duration)}]
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={cyclePlaybackRate}
                                                    className="px-1.5 py-0.5 border border-zinc-700 bg-black/60 hover:bg-zinc-800 text-[10px] font-bold"
                                                    aria-label="Change playback speed"
                                                >
                                                    {playbackRate.toFixed(2)}x
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={toggleFullScreen}
                                                    className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800"
                                                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                                >
                                                    {isFullscreen ? (
                                                        <ArrowsPointingInIcon className="w-4 h-4" />
                                                    ) : (
                                                        <ArrowsPointingOutIcon className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <img
                                    src={trend.mediaUrl}
                                    onError={handleImageError}
                                    alt={safeTitle}
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </AspectRatioBox>
                        {viewModelTrend.mediaAttribution && (
                            <figcaption className="mt-2 font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                                // MEDIA_ATTRIBUTION: {viewModelTrend.mediaAttribution}
                            </figcaption>
                        )}
                    </figure>
                )}

                {/* Engagement Error Feedback */}
                {actionError && (
                    <div className="mb-4 bg-black border border-zinc-700 px-3.5 py-2.5 flex items-center justify-between gap-3 font-mono text-xs">
                        <span className="text-zinc-300">// ERROR: {actionError}</span>
                        <button
                            type="button"
                            onClick={clearActionError}
                            className="text-zinc-400 hover:text-white uppercase text-[10px] shrink-0"
                        >
                            [DISMISS]
                        </button>
                    </div>
                )}

                {/* Engagement Action Bar */}
                <div className="border border-zinc-800 bg-zinc-900/30 px-3 sm:px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 mb-6 font-mono text-xs text-zinc-400">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button
                            type="button"
                            onClick={() => void toggleUpvote(viewModelTrend)}
                            disabled={upvotePending}
                            aria-pressed={upvoted}
                            aria-busy={upvotePending}
                            aria-label={upvoted ? 'Remove upvote' : 'Upvote trend'}
                            className={`flex items-center gap-1.5 px-2 py-1 border transition-colors disabled:opacity-50 ${
                                upvoted
                                    ? 'border-zinc-600 bg-zinc-900 text-white font-bold'
                                    : 'border-transparent hover:border-zinc-800 hover:text-white'
                            }`}
                        >
                            <ArrowUpIcon className="w-4 h-4" />
                            <span>{formatNumber(safeLikes)}</span>
                        </button>
                        <div
                            className="flex items-center gap-1.5 text-zinc-500"
                            role="status"
                            aria-label={`${formatNumber(safeViews)} views`}
                        >
                            <TrendingUpIcon className="w-4 h-4" />
                            <span>{formatNumber(safeViews)}</span>
                        </div>
                        <div
                            className="flex items-center gap-1.5 text-zinc-500"
                            aria-label={`${formatNumber(safeComments)} comments`}
                        >
                            <EqualsInCircleIcon className="w-4 h-4" />
                            <span>{formatNumber(safeComments)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => handleOpenContextualAi()}
                            aria-expanded={isContextualAiOpen}
                            aria-label="Ask AI about this trend"
                            title="Ask AI about this trend"
                            className={`flex items-center gap-1.5 px-2.5 py-1 border transition-colors ${
                                isContextualAiOpen
                                    ? 'border-white bg-white text-black font-bold'
                                    : 'border-zinc-700 bg-black text-zinc-200 hover:border-zinc-400 hover:text-white'
                            }`}
                        >
                            <SparklesIcon className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-wider">Ask AI</span>
                        </button>
                        <button
                            type="button"
                            className="p-1 border border-transparent hover:border-zinc-800 hover:text-white transition-colors"
                            aria-label="Listen"
                        >
                            <SoundWaveIcon className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleShareTrend()}
                            className="flex items-center gap-1 px-1.5 py-1 border border-transparent hover:border-zinc-800 hover:text-white transition-colors"
                            aria-label="Share trend"
                            title="Share or copy canonical link to this trend"
                        >
                            {shareFeedback === 'copied' || shareFeedback === 'shared' ? (
                                <>
                                    <CheckIcon className="w-4 h-4 text-white" />
                                    <span className="text-[10px] text-white uppercase">
                                        {shareFeedback === 'shared' ? 'SHARED' : 'COPIED'}
                                    </span>
                                </>
                            ) : shareFeedback === 'error' ? (
                                <span className="text-[10px] text-zinc-300 uppercase">COPY_FAILED</span>
                            ) : (
                                <ForwardIcon className="w-4 h-4" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => void toggleBookmark(viewModelTrend)}
                            disabled={bookmarkPending}
                            aria-pressed={bookmarked}
                            aria-busy={bookmarkPending}
                            aria-label={bookmarked ? 'Remove bookmark' : 'Save trend'}
                            title={bookmarked ? 'Saved — click to remove bookmark' : 'Save trend'}
                            className={`flex items-center gap-1.5 px-2 py-1 border transition-colors disabled:opacity-50 ${
                                bookmarked
                                    ? 'border-zinc-500 bg-zinc-900 text-white font-bold'
                                    : 'border-transparent hover:border-zinc-800 hover:text-white'
                            }`}
                        >
                            <BookmarkIcon className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
                            <span>{formatNumber(safeSaves)}</span>
                        </button>
                    </div>
                </div>

                {/* Executive Summary (AI-Synthesized Editorial Overview) */}
                {hasDistinctSummary && (
                    <section
                        aria-labelledby="trend-executive-summary-heading"
                        className="mb-6 bg-black border border-zinc-800 border-l-2 border-l-white p-4"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h2
                                id="trend-executive-summary-heading"
                                className="font-mono text-xs font-bold text-white uppercase tracking-wider"
                            >
                                // EXECUTIVE_SUMMARY
                            </h2>
                            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                                {aiBriefingTag}
                            </span>
                        </div>
                        <p className="text-zinc-200 text-sm sm:text-[15px] leading-relaxed font-sans">
                            {safeSummary}
                        </p>
                    </section>
                )}

                {/* Full Briefing & Detailed Explanation (AI-Generated Explanation) */}
                <section aria-labelledby="trend-full-briefing-heading" className="mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h2
                            id="trend-full-briefing-heading"
                            className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider"
                        >
                            // FULL_BRIEFING
                        </h2>
                        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                            AI_EXPLANATION
                        </span>
                    </div>
                    <div className="space-y-4 text-zinc-300 text-sm sm:text-[15px] leading-7 font-sans">
                        {briefingParagraphs.length > 0 ? (
                            briefingParagraphs.map((paragraph, index) => (
                                <p key={index} className="whitespace-pre-line">
                                    {paragraph}
                                </p>
                            ))
                        ) : (
                            <p className="text-zinc-500 font-mono text-xs">
                                // No extended briefing content is attached to this trend record.
                            </p>
                        )}
                    </div>
                </section>

                {/* Why It Matters & Key Takeaways (AI-Generated Analysis) */}
                {(viewModelTrend.whyItMatters || viewModelTrend.keyTakeaways.length > 0) && (
                    <section
                        aria-label="Analysis and takeaways"
                        className="mb-6 bg-black border border-zinc-800 p-4 sm:p-5 space-y-5"
                    >
                        {viewModelTrend.whyItMatters && (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                                        // WHY_IT_MATTERS
                                    </h2>
                                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                                        AI_ANALYSIS
                                    </span>
                                </div>
                                <p className="text-zinc-300 text-sm sm:text-[15px] leading-relaxed font-sans">
                                    {viewModelTrend.whyItMatters}
                                </p>
                            </div>
                        )}
                        {viewModelTrend.keyTakeaways.length > 0 && (
                            <div
                                className={
                                    viewModelTrend.whyItMatters ? 'pt-4 border-t border-zinc-900' : ''
                                }
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                    <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                                        // KEY_TAKEAWAYS
                                    </h2>
                                    {!viewModelTrend.whyItMatters && (
                                        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                                            AI_ANALYSIS
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2 text-sm text-zinc-300 font-sans">
                                    {viewModelTrend.keyTakeaways.map((point, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5">
                                            <span className="font-mono text-zinc-500 text-xs mt-0.5 shrink-0">
                                                [{String(idx + 1).padStart(2, '0')}]
                                            </span>
                                            <span className="leading-relaxed">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* Source-Reported Evidence (Distinct from AI Explanations Above) */}
                <section
                    aria-labelledby="trend-source-evidence-heading"
                    className="mb-6 bg-black border border-zinc-800 p-4 sm:p-5"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-900">
                        <h2
                            id="trend-source-evidence-heading"
                            className="font-mono text-xs font-bold text-white uppercase tracking-wider"
                        >
                            // SOURCE_EVIDENCE
                        </h2>
                        <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                            SOURCE_REPORTED · {safePublisher}
                        </span>
                    </div>

                    {effectiveExcerpt ? (
                        <div className="space-y-3">
                            <blockquote className="border-l-2 border-zinc-600 pl-3.5 py-0.5 text-zinc-300 text-sm leading-relaxed font-sans">
                                “{effectiveExcerpt}”
                            </blockquote>

                            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-zinc-400">
                                <span>
                                    ATTRIBUTED TO:{' '}
                                    <span className="text-zinc-200 font-semibold">
                                        {safePublisher}
                                    </span>
                                    {effectiveSourceSiteName && (
                                        <span className="text-zinc-500">
                                            {' '}
                                            ({effectiveSourceSiteName})
                                        </span>
                                    )}
                                </span>
                                {safeSourceUrl && (
                                    <a
                                        href={safeSourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-zinc-300 hover:text-white underline uppercase"
                                    >
                                        <span>VERIFY_IN_ORIGINAL_REPORT</span>
                                        <ArrowUpRightIcon className="w-3 h-3" />
                                    </a>
                                )}
                            </div>

                            {effectiveExcerptCompleteness === 'truncated' && (
                                <p className="font-mono text-[11px] text-zinc-500 border-t border-zinc-900 pt-2.5">
                                    // PARTIAL_EXCERPT: Extracted source text is truncated or reflects publisher summary metadata only. Open the original source for complete reporting.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="font-mono text-xs text-zinc-500 leading-relaxed">
                            // EXCERPT_UNAVAILABLE: No verified source excerpt could be extracted for this record. Consult the original publisher link below to review source reporting directly.
                        </p>
                    )}
                </section>

                {/* Relevant Tags */}
                {viewModelTrend.tags.length > 0 && (
                    <section aria-labelledby="trend-tags-heading" className="mb-6">
                        <h2
                            id="trend-tags-heading"
                            className="font-mono text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5"
                        >
                            // RELEVANT_TAGS
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {viewModelTrend.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2 py-1 bg-black border border-zinc-800 font-mono text-[11px] text-zinc-300 tracking-wide"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Original Source & Provenance */}
                <section
                    aria-labelledby="trend-source-provenance-heading"
                    className="bg-black border border-zinc-800 p-4 sm:p-5"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-900">
                        <h2
                            id="trend-source-provenance-heading"
                            className="font-mono text-xs font-bold text-white uppercase tracking-wider"
                        >
                            // SOURCE_PROVENANCE
                        </h2>

                        <div className="flex flex-wrap items-center gap-2">
                            {safeSourceUrl && !viewModelTrend.isSimulatedSource && (
                                <button
                                    type="button"
                                    onClick={() => void handleRecheckSource()}
                                    disabled={isRecheckingSource || verificationStatus === 'pending'}
                                    className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                                >
                                    {isRecheckingSource || verificationStatus === 'pending'
                                        ? 'CHECKING...'
                                        : 'RE-VERIFY_URL'}
                                </button>
                            )}

                            {safeSourceUrl ? (
                                <a
                                    href={safeSourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                >
                                    <span>READ ORIGINAL SOURCE</span>
                                    <ArrowUpRightIcon className="w-3.5 h-3.5" />
                                </a>
                            ) : (
                                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                                    SOURCE_LINK: UNAVAILABLE
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Verification Status Summary & Epistemic Scope Notice */}
                    <div className="mb-4 p-3 bg-zinc-950 border border-zinc-800/90 space-y-1.5 font-mono">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-zinc-500">VERIFICATION_STATUS:</span>
                                <span
                                    className={`font-bold uppercase ${
                                        verificationStatus === 'verified'
                                            ? 'text-white'
                                            : verificationStatus === 'unavailable'
                                              ? 'text-zinc-300'
                                              : 'text-zinc-400'
                                    }`}
                                >
                                    {verificationMeta.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 uppercase">
                                {typeof liveVerification?.httpStatus === 'number' && (
                                    <span className="px-1.5 py-0.5 bg-black border border-zinc-800">
                                        HTTP {liveVerification.httpStatus}
                                    </span>
                                )}
                                {liveVerification?.redirected && (
                                    <span className="px-1.5 py-0.5 bg-black border border-zinc-700 text-zinc-200">
                                        REDIRECTED
                                    </span>
                                )}
                                {liveVerification?.cached && (
                                    <span className="px-1.5 py-0.5 bg-black border border-zinc-800 text-zinc-500">
                                        CACHED
                                    </span>
                                )}
                            </div>
                        </div>

                        {verificationReason && (
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                // {verificationReason}
                            </p>
                        )}

                        <p className="text-[10px] text-zinc-500 leading-relaxed pt-1 border-t border-zinc-900">
                            // SCOPE: URL verification confirms only whether the publisher link was reachable at the recorded timestamp — it does not independently fact-check the article&apos;s claims.
                        </p>
                    </div>

                    {/* Optional Source Thumbnail / Publisher Preview */}
                    {effectiveSourceThumbnailUrl && (
                        <div className="mb-4 pb-3 border-b border-zinc-900 flex items-center gap-3">
                            <img
                                src={effectiveSourceThumbnailUrl}
                                alt={`${safePublisher} source preview`}
                                onError={() => setSourceThumbFailed(true)}
                                className="w-20 h-12 sm:w-24 sm:h-14 object-cover border border-zinc-800 bg-zinc-950 shrink-0"
                            />
                            <div className="min-w-0 font-mono">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                    // PUBLISHER_THUMBNAIL
                                </div>
                                <div className="text-xs text-zinc-200 truncate">
                                    {safePublisher}
                                </div>
                                {viewModelTrend.mediaAttribution && (
                                    <div className="text-[10px] text-zinc-500 truncate">
                                        {viewModelTrend.mediaAttribution}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <dl className="space-y-2.5 font-mono text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                            <dt className="text-zinc-500">PUBLISHER:</dt>
                            <dd className="text-white font-semibold text-right">
                                {safePublisher}
                                {effectiveSourceSiteName && (
                                    <span className="text-zinc-500 font-normal ml-1.5">
                                        ({effectiveSourceSiteName})
                                    </span>
                                )}
                            </dd>
                        </div>

                        {effectiveAuthor && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                                <dt className="text-zinc-500">AUTHOR:</dt>
                                <dd className="text-zinc-200 text-right">{effectiveAuthor}</dd>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                            <dt className="text-zinc-500">PUBLISHED_DATE:</dt>
                            <dd className="text-white font-semibold text-right">
                                {editorialDate}
                                {safePublishedOn && safePublishedOn !== editorialDate && (
                                    <span className="text-zinc-500 font-normal ml-2">({safePublishedOn})</span>
                                )}
                            </dd>
                        </div>

                        {formattedDiscoveredAt && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                                <dt className="text-zinc-500">DISCOVERED_DATE:</dt>
                                <dd className="text-zinc-300 text-right">{formattedDiscoveredAt}</dd>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                            <dt className="text-zinc-500">LAST_VERIFIED:</dt>
                            <dd className="text-zinc-300 text-right">
                                {formattedLastVerifiedAt || (
                                    <span className="text-zinc-500">NOT YET VERIFIED</span>
                                )}
                            </dd>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                            <dt className="text-zinc-500">DOMAIN / CATEGORY:</dt>
                            <dd className="text-white font-semibold uppercase text-right">
                                {safeDomainName}
                                {categoryLabel && (
                                    <span className="text-zinc-400 font-normal"> · {categoryLabel}</span>
                                )}
                            </dd>
                        </div>

                        {viewModelTrend.sourceCredibilityTier && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                                <dt className="text-zinc-500">SOURCE_CLASS:</dt>
                                <dd className="text-zinc-300 text-right">
                                    {CREDIBILITY_TIER_LABELS[viewModelTrend.sourceCredibilityTier]}
                                </dd>
                            </div>
                        )}

                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-900 pb-2">
                            <dt className="text-zinc-500 shrink-0">ORIGINAL_URL:</dt>
                            <dd className="min-w-0 max-w-full sm:max-w-md text-right">
                                {safeSourceUrl ? (
                                    <a
                                        href={safeSourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-zinc-300 underline hover:text-white break-all inline-block max-w-full"
                                        title={safeSourceUrl}
                                    >
                                        {safeSourceUrl}
                                    </a>
                                ) : (
                                    <span className="text-zinc-500">UNAVAILABLE</span>
                                )}
                            </dd>
                        </div>

                        {effectiveCanonicalUrl && (
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <dt className="text-zinc-500 shrink-0">CANONICAL_URL:</dt>
                                <dd className="min-w-0 max-w-full sm:max-w-md text-right">
                                    <a
                                        href={effectiveCanonicalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-zinc-300 underline hover:text-white break-all inline-block max-w-full"
                                        title={effectiveCanonicalUrl}
                                    >
                                        {effectiveCanonicalUrl}
                                    </a>
                                    {liveVerification?.redirected && (
                                        <span className="block text-[10px] text-zinc-500 mt-0.5 uppercase">
                                            RESOLVED AFTER {liveVerification.redirectCount || 1} REDIRECT
                                            {(liveVerification.redirectCount || 1) === 1 ? '' : 'S'}
                                        </span>
                                    )}
                                </dd>
                            </div>
                        )}
                    </dl>

                    {sanitizedAdditionalSources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-900">
                            <h3 className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                                // CORROBORATING_SOURCES
                            </h3>
                            <ul className="space-y-1.5 font-mono text-xs">
                                {sanitizedAdditionalSources.map((src, idx) => {
                                    const safeAdditionalUrl = sanitizeExternalUrl(src.url);
                                    if (!safeAdditionalUrl) return null;
                                    return (
                                        <li
                                            key={`${src.name}-${idx}`}
                                            className="flex flex-wrap items-center justify-between gap-2"
                                        >
                                            <a
                                                href={safeAdditionalUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white underline"
                                            >
                                                <span>{src.name}</span>
                                                <ArrowUpRightIcon className="w-3 h-3 shrink-0" />
                                            </a>
                                            {src.publishedOn && (
                                                <span className="text-[10px] text-zinc-500">
                                                    {src.publishedOn}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </section>
                {/* Contextual AI Entry Point (Scoped strictly to this trend) */}
                <section
                    aria-labelledby="trend-contextual-ai-entry-heading"
                    className="mt-6 bg-black border border-zinc-800 p-4 sm:p-5 space-y-4"
                >
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-900">
                        <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-white shrink-0" />
                                <h2
                                    id="trend-contextual-ai-entry-heading"
                                    className="font-mono text-xs font-bold text-white uppercase tracking-wider"
                                >
                                    Ask AI about this trend
                                </h2>
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
                                Explore this briefing with source-grounded answers that separate{' '}
                                <span className="text-zinc-200">{safePublisher}</span> reporting
                                from INVOX AI synthesis.
                                {viewModelTrend.isFallback &&
                                    ' Sample trend mode (DEV_FALLBACK) uses local sample evidence without live source verification.'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleOpenContextualAi()}
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap shrink-0"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" />
                            <span>Open Ask AI</span>
                        </button>
                    </div>

                    <div className="space-y-2">
                        <p className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider">
                            Start with a question tailored to this briefing
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {previewSuggestedQuestions.map((suggestion) => (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    onClick={() => handleOpenContextualAi(suggestion.prompt)}
                                    className="text-left p-3 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-950 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white group flex flex-col justify-between gap-2"
                                >
                                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300">
                                        {suggestion.label}
                                    </span>
                                    <span className="text-xs text-zinc-200 group-hover:text-white leading-snug font-sans line-clamp-3">
                                        {suggestion.prompt}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            </article>

            <TrendzContextualAiPanel
                key={`${viewModelTrend.id}:${contextualAiMode}`}
                trend={viewModelTrend}
                mode={contextualAiMode}
                isOpen={isContextualAiOpen}
                onClose={() => setIsContextualAiOpen(false)}
                onNavigateBackToFeed={onBack}
                onNavigateToTrendConversation={(targetTrendId) => {
                    const search =
                        contextualAiMode === 'dev_fallback' ? '?source=dev&ai=1' : '?ai=1';
                    navigate(`/trendz/${encodeURIComponent(targetTrendId)}${search}`);
                }}
                queuedPrompt={queuedAiPrompt}
                onConsumeQueuedPrompt={handleConsumeQueuedPrompt}
            />

            <ImageZoomModal
                isOpen={!!zoomedImageUrl}
                onClose={() => setZoomedImageUrl(null)}
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};

export default TrendzDetail;