import React from 'react';
import type {
    ContributionDistributionBucket,
    ParticipationDimensionReport,
} from '../../../services/communityHealthTypes';

interface PillarContributionChartProps {
    breakdown: ParticipationDimensionReport['pillarBreakdown'];
    periodDays: number;
}

const PILLAR_CHANNELS: Array<{
    key: keyof ParticipationDimensionReport['pillarBreakdown'];
    label: string;
    pillarName: string;
    barClass: string;
    dotClass: string;
}> = [
    {
        key: 'voicePosts',
        label: 'Voice Posts & Proposals',
        pillarName: 'Collective Voice',
        barClass: 'bg-amber-400',
        dotClass: 'bg-amber-400',
    },
    {
        key: 'comments',
        label: 'Discussion Comments',
        pillarName: 'Collective Voice',
        barClass: 'bg-sky-400',
        dotClass: 'bg-sky-400',
    },
    {
        key: 'pollVotes',
        label: 'Poll Votes',
        pillarName: 'Collective Voice',
        barClass: 'bg-indigo-400',
        dotClass: 'bg-indigo-400',
    },
    {
        key: 'consultationResponses',
        label: 'Consultation Feedback',
        pillarName: 'Collective Voice',
        barClass: 'bg-violet-400',
        dotClass: 'bg-violet-400',
    },
    {
        key: 'conclaveRegistrations',
        label: 'Conclave Registrations',
        pillarName: 'Conclave',
        barClass: 'bg-emerald-400',
        dotClass: 'bg-emerald-400',
    },
    {
        key: 'memoriesCreated',
        label: 'Published Memories',
        pillarName: 'Collective Memory',
        barClass: 'bg-zinc-300',
        dotClass: 'bg-zinc-300',
    },
];

export const PillarContributionChart: React.FC<PillarContributionChartProps> = ({
    breakdown,
    periodDays,
}) => {
    const total: number = PILLAR_CHANNELS.reduce(
        (sum, ch) => sum + Number(breakdown[ch.key] || 0),
        0
    );

    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-850">
                <div className="space-y-0.5 min-w-0">
                    <h4 className="text-sm font-semibold text-white font-sans">
                        Contribution Breakdown by Community Channel
                    </h4>
                    <p className="text-xs text-zinc-400 font-sans">
                        Observable activity across Collective Voice, Conclave, and Collective Memory in the last {periodDays} days.
                    </p>
                </div>
                <div className="text-xs font-mono tabular-nums text-zinc-300 whitespace-nowrap shrink-0">
                    {total.toLocaleString()} total actions
                </div>
            </div>

            {total === 0 ? (
                <div className="py-6 text-center space-y-1.5 border border-dashed border-zinc-850 bg-black/50">
                    <p className="text-xs font-mono text-zinc-400">
                        No observable channel actions recorded in this {periodDays}-day window.
                    </p>
                    <p className="text-[11px] font-sans text-zinc-500">
                        Distribution shares will render automatically once community activity is recorded.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Stacked proportional bar */}
                    <div
                        className="w-full h-2.5 bg-zinc-900 overflow-hidden flex"
                        role="img"
                        aria-label={`Proportional breakdown of ${total} community contributions across channels`}
                    >
                        {PILLAR_CHANNELS.map((channel) => {
                            const count = breakdown[channel.key] || 0;
                            if (count <= 0) return null;
                            const pct = (count / total) * 100;
                            return (
                                <div
                                    key={channel.key}
                                    style={{ width: `${pct}%` }}
                                    className={`${channel.barClass} h-full border-r border-[#0c0c0e] last:border-r-0`}
                                    title={`${channel.label}: ${count} (${pct.toFixed(1)}%)`}
                                />
                            );
                        })}
                    </div>

                    {/* Tabular row breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
                        {PILLAR_CHANNELS.map((channel) => {
                            const count = breakdown[channel.key] || 0;
                            const share = total > 0 ? (count / total) * 100 : 0;
                            return (
                                <div
                                    key={channel.key}
                                    className="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-900 min-w-0"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                            className={`w-2 h-2 shrink-0 ${channel.dotClass}`}
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0">
                                            <span className="text-xs text-zinc-200 font-sans block truncate">
                                                {channel.label}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-500 block">
                                                {channel.pillarName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2.5 font-mono tabular-nums text-xs shrink-0">
                                        <span className="font-semibold text-white">
                                            {count.toLocaleString()}
                                        </span>
                                        <span className="text-[11px] text-zinc-500 w-12 text-right">
                                            {share.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ParticipationTiersChartProps {
    buckets: ContributionDistributionBucket[];
    activeMembersCount: number;
}

const TIER_COLOR_MAP: Record<ContributionDistributionBucket['tier'], string> = {
    '0_actions': 'bg-zinc-600',
    '1_action': 'bg-sky-400',
    '2_to_3_actions': 'bg-emerald-400',
    '4_plus_actions': 'bg-amber-400',
};

export const ParticipationTiersChart: React.FC<ParticipationTiersChartProps> = ({
    buckets,
    activeMembersCount,
}) => {
    const maxMembers = Math.max(1, ...buckets.map((b) => b.memberCount));

    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-850">
                <div className="space-y-0.5 min-w-0">
                    <h4 className="text-sm font-semibold text-white font-sans">
                        Anonymized Member Participation Tiers
                    </h4>
                    <p className="text-xs text-zinc-400 font-sans">
                        Aggregate cohort distribution across {activeMembersCount.toLocaleString()} active member(s). Individual identities and rankings are never stored or exposed.
                    </p>
                </div>
                <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap shrink-0">
                    Cohort privacy enforced
                </span>
            </div>

            {activeMembersCount === 0 ? (
                <div className="py-6 text-center space-y-1.5 border border-dashed border-zinc-850 bg-black/50">
                    <p className="text-xs font-mono text-zinc-400">
                        Insufficient membership records to build participation cohorts.
                    </p>
                    <p className="text-[11px] font-sans text-zinc-500">
                        Cohort distribution appears once active community memberships are recorded.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {buckets.map((bucket) => {
                        const widthPct = Math.round((bucket.memberCount / maxMembers) * 100);
                        const shareDisplay =
                            bucket.shareOfMembersPercent !== null
                                ? `${bucket.shareOfMembersPercent.toFixed(1)}%`
                                : '—';
                        return (
                            <div key={bucket.tier} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-zinc-200 font-sans font-medium">
                                        {bucket.label}
                                    </span>
                                    <div className="flex items-baseline gap-2.5 font-mono tabular-nums shrink-0">
                                        <span className="text-white font-semibold">
                                            {bucket.memberCount.toLocaleString()} member{bucket.memberCount === 1 ? '' : 's'}
                                        </span>
                                        <span className="text-zinc-500 text-[11px] w-12 text-right">
                                            {shareDisplay}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-zinc-900 overflow-hidden">
                                    <div
                                        className={`h-full ${TIER_COLOR_MAP[bucket.tier]} transition-all duration-200`}
                                        style={{ width: `${bucket.memberCount > 0 ? Math.max(3, widthPct) : 0}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
