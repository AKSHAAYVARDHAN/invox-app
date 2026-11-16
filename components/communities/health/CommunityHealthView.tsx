import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    canUserAccessCommunityHealth,
    computeCommunityHealthReport,
    getLatestCommunityHealthSnapshot,
    saveCommunityHealthSnapshot,
} from '../../../services/communityHealthService';
import type {
    CommunityHealthReport,
    CommunityHealthSnapshotDocument,
    CommunityInsight,
    HealthPeriodKey,
    InsightSeverity,
} from '../../../services/communityHealthTypes';
import type { Community } from '../../../types';
import {
    AlertTriangleIcon,
    CheckCircleIcon,
    ClockIcon,
    InformationCircleIcon,
    LockClosedIcon,
    RegenerateIcon,
    ShieldCheckIcon,
} from '../../ui/Icons';
import { PillarContributionChart, ParticipationTiersChart } from './HealthDimensionCharts';
import { HealthIndicatorCard } from './HealthIndicatorCard';
import {
    buildOverallHealthSummary,
    CONFIDENCE_META,
    deriveDimensionStatuses,
    formatDateWindowRange,
    formatHealthTimestamp,
    PERIOD_OPTIONS,
    QUALITATIVE_LEVEL_META,
} from './healthStatusUtils';

interface CommunityHealthViewProps {
    community: Community;
    canManage: boolean;
    onReturnToOverview?: () => void;
}

const INSIGHT_SEVERITY_META: Record<
    InsightSeverity,
    { label: string; textClass: string; borderClass: string }
> = {
    healthy: {
        label: 'Healthy Signal',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-900/70',
    },
    attention: {
        label: 'Needs Attention',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-900/70',
    },
    gap: {
        label: 'Opportunity Gap',
        textClass: 'text-sky-300',
        borderClass: 'border-sky-900/70',
    },
    data_limit: {
        label: 'Telemetry Notice',
        textClass: 'text-zinc-400',
        borderClass: 'border-zinc-800',
    },
};

const DIMENSION_NAV_ITEMS = [
    { id: 'health-dim-participation', label: 'Participation' },
    { id: 'health-dim-engagement', label: 'Engagement' },
    { id: 'health-dim-belonging', label: 'Belonging & Inclusion' },
    { id: 'health-dim-sustainability', label: 'Sustainability' },
    { id: 'health-dim-insights', label: 'Community Insights & Telemetry Gaps' },
] as const;

type DimensionNavId = (typeof DIMENSION_NAV_ITEMS)[number]['id'];

const getScrollContainer = (el: HTMLElement | null): HTMLElement | null => {
    let curr = el?.parentElement ?? null;
    while (curr) {
        const style = window.getComputedStyle(curr);
        if (/(auto|scroll|overlay)/.test(style.overflowY)) {
            return curr;
        }
        curr = curr.parentElement;
    }
    return null;
};

export const CommunityHealthView: React.FC<CommunityHealthViewProps> = ({
    community,
    canManage,
    onReturnToOverview,
}) => {
    const { currentUser } = useAuth();
    const [periodKey, setPeriodKey] = useState<HealthPeriodKey>('30d');
    const [report, setReport] = useState<CommunityHealthReport | null>(null);
    const [savedSnapshot, setSavedSnapshot] = useState<CommunityHealthSnapshotDocument | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [savingSnapshot, setSavingSnapshot] = useState<boolean>(false);
    const [snapshotMessage, setSnapshotMessage] = useState<{
        type: 'success' | 'info' | 'error';
        text: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showTelemetryGaps, setShowTelemetryGaps] = useState<boolean>(false);
    const [activeSectionId, setActiveSectionId] = useState<DimensionNavId>('health-dim-participation');

    const requestSeqRef = useRef(0);
    const navRef = useRef<HTMLElement | null>(null);
    const navScrollRef = useRef<HTMLDivElement | null>(null);
    const navButtonRefs = useRef<Partial<Record<DimensionNavId, HTMLButtonElement | null>>>({});
    const clickLockUntilRef = useRef<number>(0);
    const clickLockTimerRef = useRef<number | null>(null);

    const hasHealthAccess = useMemo(() => {
        return canManage && canUserAccessCommunityHealth(community, currentUser);
    }, [canManage, community, currentUser]);

    const loadHealthReport = useCallback(
        async (
            targetPeriod: HealthPeriodKey,
            isManualRefresh = false
        ) => {
            if (!hasHealthAccess || !currentUser) {
                setReport(null);
                setSavedSnapshot(null);
                setError(null);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const seq = ++requestSeqRef.current;
            if (isManualRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);
            setSnapshotMessage(null);

            try {
                const computedReport = await computeCommunityHealthReport(
                    community,
                    currentUser,
                    targetPeriod
                );
                if (seq !== requestSeqRef.current) return;
                setReport(computedReport);

                // Non-blocking read of latest persisted aggregate snapshot for this period
                try {
                    const existingSnap = await getLatestCommunityHealthSnapshot(
                        community,
                        currentUser,
                        targetPeriod
                    );
                    if (seq === requestSeqRef.current) {
                        setSavedSnapshot(existingSnap);
                    }
                } catch {
                    // Snapshot subcollection may not yet have rules deployed or no snapshot exists; keep live report intact
                    if (seq === requestSeqRef.current) {
                        setSavedSnapshot(null);
                    }
                }
            } catch (err: any) {
                if (seq !== requestSeqRef.current) return;
                console.error('[COMMUNITY_HEALTH_LOAD_ERROR]', err);
                setError(
                    err?.message?.includes('UNAUTHORIZED')
                        ? 'You do not have administrator permissions to view Community Health analytics.'
                        : err?.message || 'Unable to compute community health indicators at this time.'
                );
            } finally {
                if (seq === requestSeqRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [community, currentUser, hasHealthAccess]
    );

    useEffect(() => {
        loadHealthReport(periodKey, false);
    }, [loadHealthReport, periodKey]);

    const handleSaveSnapshot = async () => {
        if (!hasHealthAccess || !currentUser || !report || savingSnapshot) return;
        setSavingSnapshot(true);
        setSnapshotMessage(null);
        try {
            const saved = await saveCommunityHealthSnapshot(community, currentUser, report);
            setSavedSnapshot(saved);
            setSnapshotMessage({
                type: 'success',
                text: `Saved anonymized ${report.periodKey} snapshot to community records.`,
            });
        } catch (err: any) {
            console.warn('[COMMUNITY_HEALTH_SNAPSHOT_SAVE_WARN]', err);
            setSnapshotMessage({
                type: 'error',
                text: 'Snapshot write declined by Firestore rules or network. Live analytics remain current.',
            });
        } finally {
            setSavingSnapshot(false);
        }
    };

    const dimensionStatuses = useMemo(() => {
        if (!report) return [];
        return deriveDimensionStatuses(report);
    }, [report]);

    const overallSummary = useMemo(() => {
        if (!report) return null;
        return buildOverallHealthSummary(report, dimensionStatuses);
    }, [report, dimensionStatuses]);

    const hasRenderedReport = Boolean(report && overallSummary && !error);

    // Keep the active navigation button horizontally visible without disturbing vertical page scroll
    useEffect(() => {
        const scroller = navScrollRef.current;
        const btn = navButtonRefs.current[activeSectionId];
        if (!scroller || !btn) return;

        const btnLeft = btn.offsetLeft;
        const btnRight = btnLeft + btn.offsetWidth;
        const viewLeft = scroller.scrollLeft;
        const viewRight = viewLeft + scroller.clientWidth;

        if (btnLeft < viewLeft + 8) {
            scroller.scrollTo({ left: Math.max(0, btnLeft - 8), behavior: 'smooth' });
        } else if (btnRight > viewRight - 8) {
            scroller.scrollTo({ left: btnRight - scroller.clientWidth + 8, behavior: 'smooth' });
        }
    }, [activeSectionId]);

    // Observe the five dimension sections to highlight the currently visible section on scroll
    useEffect(() => {
        if (!hasRenderedReport || typeof window === 'undefined') return;

        const sectionEls = DIMENSION_NAV_ITEMS
            .map((item) => document.getElementById(item.id))
            .filter((el): el is HTMLElement => Boolean(el));

        if (sectionEls.length === 0) return;

        const scrollRoot = getScrollContainer(navRef.current || sectionEls[0]);
        const entryMap = new Map<string, IntersectionObserverEntry>();

        const clearLockOnManualInput = () => {
            clickLockUntilRef.current = 0;
            if (clickLockTimerRef.current !== null) {
                window.clearTimeout(clickLockTimerRef.current);
                clickLockTimerRef.current = null;
            }
        };

        const targetEventRoot: EventTarget = scrollRoot || window;
        targetEventRoot.addEventListener('wheel', clearLockOnManualInput, { passive: true });
        targetEventRoot.addEventListener('touchmove', clearLockOnManualInput, { passive: true });

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    entryMap.set(entry.target.id, entry);
                }

                if (Date.now() < clickLockUntilRef.current) return;

                const rootRect = scrollRoot ? scrollRoot.getBoundingClientRect() : null;
                const rootTop = rootRect ? rootRect.top : 0;
                const navHeight = navRef.current?.getBoundingClientRect().height ?? 44;
                const triggerThreshold = rootTop + navHeight + 96;

                const atBottom = scrollRoot
                    ? scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 12
                    : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 12;

                if (atBottom) {
                    const lastIntersecting = [...DIMENSION_NAV_ITEMS]
                        .reverse()
                        .find((item) => entryMap.get(item.id)?.isIntersecting);
                    if (lastIntersecting) {
                        setActiveSectionId((prev) =>
                            prev === lastIntersecting.id ? prev : lastIntersecting.id
                        );
                        return;
                    }
                }

                const intersectingItems = DIMENSION_NAV_ITEMS.filter(
                    (item) => entryMap.get(item.id)?.isIntersecting
                );
                if (intersectingItems.length === 0) return;

                let chosenId: DimensionNavId = intersectingItems[0].id;
                for (const item of intersectingItems) {
                    const entry = entryMap.get(item.id);
                    if (entry && entry.boundingClientRect.top <= triggerThreshold) {
                        chosenId = item.id;
                    }
                }

                setActiveSectionId((prev) => (prev === chosenId ? prev : chosenId));
            },
            {
                root: scrollRoot,
                rootMargin: '-56px 0px -30% 0px',
                threshold: [0, 0.1, 0.25, 0.5],
            }
        );

        for (const el of sectionEls) {
            observer.observe(el);
        }

        return () => {
            observer.disconnect();
            targetEventRoot.removeEventListener('wheel', clearLockOnManualInput);
            targetEventRoot.removeEventListener('touchmove', clearLockOnManualInput);
            if (clickLockTimerRef.current !== null) {
                window.clearTimeout(clickLockTimerRef.current);
                clickLockTimerRef.current = null;
            }
        };
    }, [hasRenderedReport]);

    const handleNavigateToDimension = useCallback((sectionId: DimensionNavId) => {
        setActiveSectionId(sectionId);
        const targetEl = document.getElementById(sectionId);
        if (!targetEl) return;

        if (clickLockTimerRef.current !== null) {
            window.clearTimeout(clickLockTimerRef.current);
        }
        clickLockUntilRef.current = Date.now() + 700;
        clickLockTimerRef.current = window.setTimeout(() => {
            clickLockUntilRef.current = 0;
            clickLockTimerRef.current = null;
        }, 700);

        const scrollRoot = getScrollContainer(navRef.current || targetEl);
        const navHeight = navRef.current?.getBoundingClientRect().height ?? 44;
        const offset = navHeight + 16;

        if (scrollRoot) {
            const rootRect = scrollRoot.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const nextTop = scrollRoot.scrollTop + (targetRect.top - rootRect.top) - offset;
            scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        } else {
            const targetTop = targetEl.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }
    }, []);

    // Strictly restrict access to Community Owners / Creators and Authorized Administrators
    if (!hasHealthAccess) {
        return (
            <section
                aria-label="Community Health Access Restricted"
                className="bg-[#0c0c0e] border border-zinc-800 p-6 sm:p-10 space-y-4 w-full min-w-0"
            >
                <div className="max-w-lg mx-auto text-center space-y-4">
                    <div className="w-11 h-11 mx-auto bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400">
                        <LockClosedIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">
                            05. Community Health · Administrator Only
                        </span>
                        <h3 className="text-lg font-semibold text-white font-sans">
                            Management Analytics Restricted
                        </h3>
                        <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
                            Community Health analytics are restricted strictly to the community owner and authorized administrators of{' '}
                            <span className="text-zinc-200 font-medium">{community.name}</span>. Aggregate insights never expose individual member activity or rankings.
                        </p>
                    </div>
                    {onReturnToOverview && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onReturnToOverview}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-200 hover:text-white text-xs font-mono uppercase font-semibold transition-colors cursor-pointer"
                            >
                                Return to Overview
                            </button>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section
            aria-label="05. Community Health Dashboard"
            className="space-y-6 w-full min-w-0 max-w-full"
        >
            {/* =========================================================================
                1. DASHBOARD HEADER
               ========================================================================= */}
            <header className="bg-[#0c0c0e] border border-zinc-800 p-5 sm:p-6 space-y-5 min-w-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-6 xl:gap-8 min-w-0">
                    {/* Left Section — Information */}
                    <div className="flex-1 space-y-2 min-w-0 max-w-2xl">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] font-mono text-zinc-400">
                            <span className="font-semibold text-emerald-400 uppercase tracking-wider">
                                05. COMMUNITY HEALTH
                            </span>
                            <span aria-hidden="true" className="text-zinc-600">·</span>
                            <span className="text-zinc-500">Owner &amp; Administrator Diagnostics</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans text-balance">
                            Community Health &amp; Sustainability
                        </h2>
                        <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
                            Evaluate observable participation, dialogue depth, belonging balance, and contributor continuity across {community.name} without tracking individual member rankings.
                        </p>
                    </div>

                    {/* Right Section — Controls (Row 1: Period Selector, Row 2: Actions) */}
                    <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-2.5">
                        {/* Row 1: Cohesive Segmented Period Selector */}
                        <div
                            role="group"
                            aria-label="Measurement period"
                            className="grid grid-cols-3 bg-black border border-zinc-800 p-1 gap-1 w-full"
                        >
                            {PERIOD_OPTIONS.map((opt) => {
                                const isActive = periodKey === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setPeriodKey(opt.key)}
                                        disabled={loading || refreshing}
                                        aria-pressed={isActive}
                                        className={`h-8 px-2.5 inline-flex items-center justify-center text-xs font-mono transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                                            isActive
                                                ? 'bg-white text-black font-semibold'
                                                : 'text-zinc-400 font-medium hover:text-white hover:bg-zinc-900'
                                        }`}
                                    >
                                        {opt.shortLabel}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Row 2: Action Buttons (Equal Height & Evenly Sized) */}
                        <div className="grid grid-cols-2 gap-2.5 w-full">
                            <button
                                type="button"
                                onClick={() => loadHealthReport(periodKey, true)}
                                disabled={loading || refreshing}
                                className="h-9 px-3 inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono font-medium text-zinc-200 hover:text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                            >
                                <RegenerateIcon
                                    className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`}
                                />
                                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveSnapshot}
                                disabled={loading || refreshing || savingSnapshot || !report}
                                className="h-9 px-3 inline-flex items-center justify-center gap-2 bg-emerald-950/25 hover:bg-emerald-950/45 border border-emerald-800/70 hover:border-emerald-600/80 text-xs font-mono font-medium text-emerald-200 hover:text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                            >
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{savingSnapshot ? 'Saving...' : 'Save Snapshot'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metadata Footer Strip: Last Updated, Window Range, Live Indicator */}
                <div className="pt-3.5 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1">
                        <span>
                            Updated:{' '}
                            <strong className="text-zinc-300 font-medium tabular-nums">
                                {report ? formatHealthTimestamp(report.generatedAt) : loading ? 'Computing...' : '—'}
                            </strong>
                        </span>
                        {report && (
                            <>
                                <span aria-hidden="true" className="text-zinc-700">·</span>
                                <span className="tabular-nums">
                                    Window: {formatDateWindowRange(report.periodStart, report.periodEnd)}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums sm:justify-end">
                        {savedSnapshot && (
                            <>
                                <span className="text-zinc-400">
                                    Snapshot archived: {formatHealthTimestamp(savedSnapshot.generatedAt)}
                                </span>
                                <span aria-hidden="true" className="text-zinc-700">·</span>
                            </>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                            <span className="w-1.5 h-1.5 bg-emerald-400 shrink-0" aria-hidden="true" />
                            <span>Live Firestore computation</span>
                        </span>
                    </div>
                </div>

                {snapshotMessage && (
                    <div
                        className={`p-3 border text-xs font-sans flex items-center justify-between gap-3 ${
                            snapshotMessage.type === 'success'
                                ? 'bg-emerald-950/20 border-emerald-900/70 text-emerald-300'
                                : snapshotMessage.type === 'error'
                                ? 'bg-amber-950/20 border-amber-900/70 text-amber-300'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        }`}
                    >
                        <span>{snapshotMessage.text}</span>
                        <button
                            type="button"
                            onClick={() => setSnapshotMessage(null)}
                            className="text-[11px] font-mono underline shrink-0 cursor-pointer"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
            </header>

            {/* =========================================================================
                LOADING STATE
               ========================================================================= */}
            {loading && !report && (
                <div className="space-y-5" aria-busy="true" aria-label="Loading community health analytics">
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-4">
                        <div className="h-4 w-48 bg-zinc-900 animate-pulse" />
                        <div className="h-3 w-full max-w-xl bg-zinc-900 animate-pulse" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                            {[0, 1, 2, 3].map((idx) => (
                                <div key={idx} className="h-24 bg-zinc-950 border border-zinc-850 animate-pulse" />
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[0, 1, 2, 3].map((idx) => (
                            <div key={idx} className="h-44 bg-[#0c0c0e] border border-zinc-800 animate-pulse" />
                        ))}
                    </div>
                </div>
            )}

            {/* =========================================================================
                ERROR STATE
               ========================================================================= */}
            {error && !loading && (
                <div
                    role="alert"
                    className="bg-[#0c0c0e] border border-rose-900/70 p-6 text-center space-y-3"
                >
                    <AlertTriangleIcon className="w-6 h-6 text-rose-400 mx-auto" />
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-white font-sans">
                            Unable to Load Community Health Indicators
                        </h3>
                        <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto">
                            {error}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadHealthReport(periodKey, true)}
                        className="px-4 py-2 bg-white text-black text-xs font-mono uppercase font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
                    >
                        Retry Calculation
                    </button>
                </div>
            )}

            {/* =========================================================================
                MAIN POPULATED / EMPTY-BASELINE REPORT VIEW
               ========================================================================= */}
            {report && overallSummary && !error && (
                <>
                    {/* Empty Telemetry Banner when community has zero Firestore activity */}
                    {!report.dataCoverage.isLiveFirestoreCommunity &&
                        report.dataCoverage.recordsObserved.activeMemberships === 0 &&
                        (report.dimensions.participation.totalContributions.value ?? 0) === 0 && (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-white font-sans">
                                        No Community Records Observed Yet
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                                        {community.name} does not yet have recorded Firestore membership or activity documents. Indicators will populate automatically as members join and participate.
                                    </p>
                                </div>
                                <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap shrink-0">
                                    Awaiting activity
                                </span>
                            </div>
                        )}

                    {/* =================================================================
                        2. OVERALL COMMUNITY HEALTH OVERVIEW (NO ARBITRARY SCORE)
                       ================================================================= */}
                    <section
                        aria-labelledby="health-overview-heading"
                        className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-6 space-y-5 min-w-0"
                    >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-zinc-850">
                            <div className="space-y-1.5 max-w-2xl">
                                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                                    Overall Health Overview · Qualitative Summary
                                </span>
                                <h3
                                    id="health-overview-heading"
                                    className="text-lg font-bold text-white font-sans tracking-tight"
                                >
                                    {overallSummary.headline}
                                </h3>
                                <p className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed">
                                    {overallSummary.narrative}
                                </p>
                            </div>

                            {/* Reliability Mix Summary */}
                            <div className="bg-black border border-zinc-850 p-3 sm:p-3.5 space-y-2 shrink-0 md:min-w-[230px]">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                                    Indicator Reliability Mix
                                </span>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono tabular-nums">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={CONFIDENCE_META.actual.textClass}>Actual</span>
                                        <strong className="text-white">{overallSummary.reliabilityCounts.actual}</strong>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={CONFIDENCE_META.estimated.textClass}>Estimated</span>
                                        <strong className="text-white">{overallSummary.reliabilityCounts.estimated}</strong>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={CONFIDENCE_META.insufficient_data.textClass}>Insufficient</span>
                                        <strong className="text-white">{overallSummary.reliabilityCounts.insufficient_data}</strong>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={CONFIDENCE_META.unavailable.textClass}>Unavailable</span>
                                        <strong className="text-white">{overallSummary.reliabilityCounts.unavailable}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Four Dimension Qualitative Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {dimensionStatuses.map((dim) => {
                                const levelMeta = QUALITATIVE_LEVEL_META[dim.level];
                                return (
                                    <div
                                        key={dim.dimension}
                                        className="bg-black border border-zinc-850 p-3.5 flex flex-col justify-between gap-2.5 min-w-0"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-white font-sans">
                                                    {dim.label}
                                                </span>
                                                <span
                                                    className={`text-[10px] font-mono font-semibold uppercase whitespace-nowrap ${levelMeta.textClass}`}
                                                >
                                                    {dim.statusText}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
                                                {dim.primaryReadout}
                                            </p>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                                            {dim.summary}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Data Coverage & Sample Scope Footer */}
                        <div className="pt-3 border-t border-zinc-850 flex flex-col gap-2 text-[11px] font-mono text-zinc-400">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                                <span className="text-zinc-500 uppercase">Observed Records:</span>
                                <span>{report.dataCoverage.recordsObserved.activeMemberships} memberships</span>
                                <span aria-hidden="true">·</span>
                                <span>{report.dataCoverage.recordsObserved.postsInCommunity} voice posts</span>
                                <span aria-hidden="true">·</span>
                                <span>{report.dataCoverage.recordsObserved.commentsResolved} comments</span>
                                <span aria-hidden="true">·</span>
                                <span>{report.dataCoverage.recordsObserved.conclaveEvents} conclaves</span>
                                <span aria-hidden="true">·</span>
                                <span>{report.dataCoverage.recordsObserved.conclaveAttendanceRecords} check-ins</span>
                                <span aria-hidden="true">·</span>
                                <span>{report.dataCoverage.recordsObserved.collectiveMemories} memories</span>
                            </div>
                            {report.dataCoverage.warnings.length > 0 && (
                                <div className="text-amber-300/90 font-sans text-xs space-y-1">
                                    {report.dataCoverage.warnings.map((w, idx) => (
                                        <p key={idx}>Note: {w}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* =================================================================
                        STICKY DIMENSION NAVIGATION BAR
                       ================================================================= */}
                    <nav
                        ref={navRef}
                        aria-label="Community Health dimension navigation"
                        className="sticky top-0 z-20 bg-[#09090b]/95 backdrop-blur-md border border-zinc-800 shadow-[0_8px_24px_rgba(0,0,0,0.65)] w-full min-w-0 max-w-full"
                    >
                        <div
                            ref={navScrollRef}
                            className="flex items-center overflow-x-auto no-scrollbar w-full min-w-0 divide-x divide-zinc-900"
                        >
                            {DIMENSION_NAV_ITEMS.map((item) => {
                                const isActive = activeSectionId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        ref={(el) => {
                                            navButtonRefs.current[item.id] = el;
                                        }}
                                        type="button"
                                        onClick={() => handleNavigateToDimension(item.id)}
                                        aria-current={isActive ? 'location' : undefined}
                                        className={`relative px-3 sm:px-3.5 py-2.5 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 focus:outline-none focus-visible:bg-zinc-900 ${
                                            isActive
                                                ? 'border-white text-white bg-zinc-900/60 font-semibold'
                                                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30 font-medium'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>

                    {/* =================================================================
                        3A. DIMENSION A — PARTICIPATION
                       ================================================================= */}
                    <section id="health-dim-participation" aria-labelledby="dim-participation-heading" className="space-y-4 scroll-mt-16">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div>
                                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider block">
                                    Dimension A
                                </span>
                                <h3
                                    id="dim-participation-heading"
                                    className="text-base sm:text-lg font-bold text-white font-sans"
                                >
                                    Participation
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-400 font-sans">
                                Active contributor reach, total activity volume, and Conclave turnout.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <HealthIndicatorCard indicator={report.dimensions.participation.activeContributorRate} />
                            <HealthIndicatorCard indicator={report.dimensions.participation.totalContributions} />
                            <HealthIndicatorCard
                                indicator={report.dimensions.participation.discussionAndMemoryContributions}
                                titleOverride="Discussion & Memory Contributions"
                                descriptionOverride="Combined posts, discussion comments, and published Collective Memories authored during this window."
                            />
                            <HealthIndicatorCard indicator={report.dimensions.participation.conclaveParticipationRate} />
                            <HealthIndicatorCard indicator={report.dimensions.participation.conclaveAttendanceRate} />
                        </div>

                        <PillarContributionChart
                            breakdown={report.dimensions.participation.pillarBreakdown}
                            periodDays={report.periodDays}
                        />
                    </section>

                    {/* =================================================================
                        3B. DIMENSION B — ENGAGEMENT
                       ================================================================= */}
                    <section id="health-dim-engagement" aria-labelledby="dim-engagement-heading" className="space-y-4 scroll-mt-16">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div>
                                <span className="text-[11px] font-mono text-sky-400 uppercase tracking-wider block">
                                    Dimension B
                                </span>
                                <h3
                                    id="dim-engagement-heading"
                                    className="text-base sm:text-lg font-bold text-white font-sans"
                                >
                                    Engagement
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-400 font-sans">
                                Interaction depth, poll turnout, governance movement, and period-over-period change.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <HealthIndicatorCard indicator={report.dimensions.engagement.postInteractionDepth} />
                            <HealthIndicatorCard indicator={report.dimensions.engagement.pollVoterTurnout} />
                            <HealthIndicatorCard indicator={report.dimensions.engagement.proposalGovernanceMomentum} />
                            <HealthIndicatorCard
                                indicator={report.dimensions.engagement.activityTrendVsPriorPeriod}
                                secondaryContext={
                                    report.dimensions.engagement.activityTrendVsPriorPeriod.previousValue !== null &&
                                    report.dimensions.engagement.activityTrendVsPriorPeriod.previousValue !== undefined
                                        ? `Prior window: ${report.dimensions.engagement.activityTrendVsPriorPeriod.previousValue.toLocaleString()}`
                                        : undefined
                                }
                            />
                        </div>

                        {/* Compact Context Row */}
                        <div className="bg-[#0c0c0e] border border-zinc-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-zinc-850">
                            {[
                                { label: 'Posts', val: report.dimensions.engagement.breakdown.totalPostsInPeriod },
                                { label: 'Polls', val: report.dimensions.engagement.breakdown.totalPollsInPeriod },
                                { label: 'Proposals', val: report.dimensions.engagement.breakdown.totalProposalsInPeriod },
                                { label: 'Consultations', val: report.dimensions.engagement.breakdown.totalConsultationsInPeriod },
                                { label: 'Comments', val: report.dimensions.engagement.breakdown.totalCommentsInPeriod },
                                { label: 'Cumulative Likes', val: report.dimensions.engagement.breakdown.totalLikesOnPeriodPosts },
                            ].map((item) => (
                                <div key={item.label} className="p-3 sm:px-4">
                                    <span className="text-[10px] font-mono uppercase text-zinc-500 block truncate">
                                        {item.label}
                                    </span>
                                    <span className="text-sm font-bold text-white font-mono tabular-nums mt-0.5 block">
                                        {item.val.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* =================================================================
                        3C. DIMENSION C — BELONGING & INCLUSION
                       ================================================================= */}
                    <section id="health-dim-belonging" aria-labelledby="dim-belonging-heading" className="space-y-4 scroll-mt-16">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div>
                                <span className="text-[11px] font-mono text-amber-300 uppercase tracking-wider block">
                                    Dimension C
                                </span>
                                <h3
                                    id="dim-belonging-heading"
                                    className="text-base sm:text-lg font-bold text-white font-sans"
                                >
                                    Belonging & Inclusion
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-400 font-sans">
                                New-member onboarding activation and anonymized participation spread.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <HealthIndicatorCard indicator={report.dimensions.belonging.newMemberActivationRate} />
                            <HealthIndicatorCard indicator={report.dimensions.belonging.contributionConcentrationIndex} />
                            <HealthIndicatorCard indicator={report.dimensions.belonging.zeroContributionMemberRate} />
                        </div>

                        <ParticipationTiersChart
                            buckets={report.dimensions.belonging.distributionBuckets}
                            activeMembersCount={report.dimensions.belonging.zeroContributionMemberRate.denominator ?? report.dataCoverage.recordsObserved.activeMemberships}
                        />
                    </section>

                    {/* =================================================================
                        3D. DIMENSION D — SUSTAINABILITY
                       ================================================================= */}
                    <section id="health-dim-sustainability" aria-labelledby="dim-sustainability-heading" className="space-y-4 scroll-mt-16">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div>
                                <span className="text-[11px] font-mono text-violet-300 uppercase tracking-wider block">
                                    Dimension D
                                </span>
                                <h3
                                    id="dim-sustainability-heading"
                                    className="text-base sm:text-lg font-bold text-white font-sans"
                                >
                                    Sustainability
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-400 font-sans">
                                Returning contributor continuity, cross-pillar breadth, and membership retention telemetry.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <HealthIndicatorCard indicator={report.dimensions.sustainability.returningContributorRetention} />
                            <HealthIndicatorCard indicator={report.dimensions.sustainability.multiPillarParticipationRate} />
                            <HealthIndicatorCard
                                indicator={report.dimensions.sustainability.grossNewMemberAdditions}
                                titleOverride="Gross New Membership Additions"
                                descriptionOverride="Count of active community memberships joined during the current measurement window."
                                secondaryContext={
                                    report.dimensions.sustainability.grossNewMemberAdditions.previousValue !== null &&
                                    report.dimensions.sustainability.grossNewMemberAdditions.previousValue !== undefined
                                        ? `Prior joins: ${report.dimensions.sustainability.grossNewMemberAdditions.previousValue.toLocaleString()}`
                                        : undefined
                                }
                            />
                            <HealthIndicatorCard
                                indicator={report.dimensions.sustainability.observedActiveToInactiveRatio}
                                titleOverride="Observed Active-to-Silent Ratio"
                                descriptionOverride="Ratio of active members with >=1 recorded contribution versus active members with 0 recorded contributions."
                            />
                            {report.dimensions.sustainability.membershipChurnRate.status !== 'unavailable' && (
                                <HealthIndicatorCard indicator={report.dimensions.sustainability.membershipChurnRate} />
                            )}
                        </div>

                        {/* Transparent unavailable notice when churn logs are not retained */}
                        {report.dimensions.sustainability.membershipChurnRate.status === 'unavailable' && (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
                                        <span className="font-semibold text-white">Membership Churn Rate</span>
                                        <span aria-hidden="true" className="text-zinc-600">·</span>
                                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                                            <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span>UNAVAILABLE</span>
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                                        {report.dimensions.sustainability.membershipChurnRate.confidenceNote}
                                    </p>
                                </div>
                                <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap shrink-0">
                                    Requires departure history
                                </span>
                            </div>
                        )}
                    </section>

                    {/* =================================================================
                        3E. DIMENSION E — COMMUNITY INSIGHTS & MISSING TELEMETRY
                       ================================================================= */}
                    <section id="health-dim-insights" aria-labelledby="dim-insights-heading" className="space-y-4 scroll-mt-16">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div>
                                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                                    Dimension E
                                </span>
                                <h3
                                    id="dim-insights-heading"
                                    className="text-base sm:text-lg font-bold text-white font-sans"
                                >
                                    Community Insights & Telemetry Gaps
                                </h3>
                            </div>
                            <p className="text-xs text-zinc-400 font-sans">
                                Deterministic, evidence-backed observations and platform data limitations.
                            </p>
                        </div>

                        {report.dimensions.insights.length === 0 ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-6 text-center space-y-1.5">
                                <p className="text-sm font-semibold text-white font-sans">
                                    No Exceptional Signals Flagged
                                </p>
                                <p className="text-xs text-zinc-400 font-sans">
                                    Indicators are within standard operating ranges for the selected {report.periodDays}-day period.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {report.dimensions.insights.map((insight: CommunityInsight) => {
                                    const sevMeta = INSIGHT_SEVERITY_META[insight.severity];
                                    const confMeta = CONFIDENCE_META[insight.basedOnConfidence];
                                    return (
                                        <article
                                            key={insight.id}
                                            className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-0"
                                        >
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                                                    <span className={`inline-flex items-center gap-1.5 font-semibold uppercase ${sevMeta.textClass}`}>
                                                        {insight.severity === 'healthy' ? (
                                                            <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" />
                                                        ) : insight.severity === 'attention' ? (
                                                            <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                                                        ) : insight.severity === 'gap' ? (
                                                            <InformationCircleIcon className="w-3.5 h-3.5 shrink-0" />
                                                        ) : (
                                                            <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                                                        )}
                                                        <span>{sevMeta.label}</span>
                                                    </span>
                                                    <span className={`${confMeta.textClass} text-[10px] uppercase`}>
                                                        {confMeta.label}
                                                    </span>
                                                </div>

                                                <h4 className="text-sm font-semibold text-white font-sans leading-snug">
                                                    {insight.title}
                                                </h4>
                                                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                                                    {insight.observation}
                                                </p>
                                            </div>

                                            <div className="pt-3 border-t border-zinc-850 space-y-1">
                                                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                                                    Recommended Action
                                                </span>
                                                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                                                    {insight.recommendation}
                                                </p>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {/* Missing Data Requirements Reference Toggle */}
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <h4 className="text-xs sm:text-sm font-semibold text-white font-sans">
                                        Known Data Telemetry Limitations ({report.dataCoverage.missingRequirements.length})
                                    </h4>
                                    <p className="text-xs text-zinc-400 font-sans">
                                        Transparent documentation of signals currently uncollected in Firestore so metrics are never overstated.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowTelemetryGaps((prev) => !prev)}
                                    aria-expanded={showTelemetryGaps}
                                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-xs font-mono text-zinc-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
                                >
                                    {showTelemetryGaps ? 'Hide Telemetry Specs' : 'Inspect Telemetry Specs'}
                                </button>
                            </div>

                            {showTelemetryGaps && (
                                <div className="pt-3 border-t border-zinc-850 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {report.dataCoverage.missingRequirements.map((req) => (
                                        <div key={req.id} className="bg-black border border-zinc-850 p-3.5 space-y-2">
                                            <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase text-zinc-500">
                                                <span>{req.dimension}</span>
                                                <span>{req.impactedIndicators.length} impacted indicator(s)</span>
                                            </div>
                                            <h5 className="text-xs font-semibold text-white font-sans">
                                                {req.missingSignal}
                                            </h5>
                                            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                                                {req.currentWorkaroundOrHandling}
                                            </p>
                                            <p className="text-[10px] font-mono text-zinc-500 leading-relaxed break-words">
                                                Future schema: {req.recommendedFutureCollectionOrField}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}
        </section>
    );
};
