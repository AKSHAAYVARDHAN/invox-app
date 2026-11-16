import type {
    CommunityHealthReport,
    HealthDimensionKey,
    HealthIndicatorResult,
    HealthPeriodKey,
    MeasurementConfidence,
} from '../../../services/communityHealthTypes';

export type QualitativeHealthLevel =
    | 'healthy'
    | 'moderate'
    | 'attention'
    | 'limited_data'
    | 'unavailable';

export interface DimensionQualitativeStatus {
    dimension: HealthDimensionKey;
    label: string;
    level: QualitativeHealthLevel;
    statusText: string;
    summary: string;
    primaryReadout: string;
}

export const PERIOD_OPTIONS: Array<{ key: HealthPeriodKey; label: string; shortLabel: string }> = [
    { key: '7d', label: 'Last 7 Days', shortLabel: '7 Days' },
    { key: '30d', label: 'Last 30 Days', shortLabel: '30 Days' },
    { key: '90d', label: 'Last 90 Days', shortLabel: '90 Days' },
];

export const CONFIDENCE_META: Record<
    MeasurementConfidence,
    {
        label: string;
        textClass: string;
        dotClass: string;
        borderClass: string;
        description: string;
    }
> = {
    actual: {
        label: 'ACTUAL',
        textClass: 'text-emerald-400',
        dotClass: 'bg-emerald-400',
        borderClass: 'border-emerald-900/70',
        description: 'Directly measured from verified Firestore activity records within this window.',
    },
    estimated: {
        label: 'ESTIMATED',
        textClass: 'text-amber-300',
        dotClass: 'bg-amber-400',
        borderClass: 'border-amber-900/70',
        description: 'Derived from aggregate counters or partial timestamps where exact per-event logs do not exist.',
    },
    insufficient_data: {
        label: 'INSUFFICIENT DATA',
        textClass: 'text-zinc-400',
        dotClass: 'bg-zinc-500',
        borderClass: 'border-zinc-800',
        description: 'Zero denominator or no recorded baseline events in this period.',
    },
    unavailable: {
        label: 'UNAVAILABLE',
        textClass: 'text-rose-400',
        dotClass: 'bg-rose-400',
        borderClass: 'border-rose-900/70',
        description: 'Required telemetry or historical log is not currently captured by Firestore data models.',
    },
};

export const QUALITATIVE_LEVEL_META: Record<
    QualitativeHealthLevel,
    {
        badgeText: string;
        textClass: string;
        borderClass: string;
        bgClass: string;
    }
> = {
    healthy: {
        badgeText: 'Healthy',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-900/80',
        bgClass: 'bg-emerald-950/20',
    },
    moderate: {
        badgeText: 'Steady Baseline',
        textClass: 'text-sky-300',
        borderClass: 'border-sky-900/80',
        bgClass: 'bg-sky-950/20',
    },
    attention: {
        badgeText: 'Needs Attention',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-900/80',
        bgClass: 'bg-amber-950/20',
    },
    limited_data: {
        badgeText: 'Limited Data',
        textClass: 'text-zinc-400',
        borderClass: 'border-zinc-800',
        bgClass: 'bg-zinc-950',
    },
    unavailable: {
        badgeText: 'Unavailable',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-900/80',
        bgClass: 'bg-rose-950/20',
    },
};

export const formatHealthTimestamp = (isoOrDate: unknown): string => {
    if (!isoOrDate) return 'Not available';
    let d: Date | null = null;
    if (isoOrDate instanceof Date) {
        d = isoOrDate;
    } else if (typeof isoOrDate === 'string' || typeof isoOrDate === 'number') {
        d = new Date(isoOrDate);
    } else if (typeof (isoOrDate as any)?.toDate === 'function') {
        d = (isoOrDate as any).toDate();
    } else if (typeof (isoOrDate as any)?.seconds === 'number') {
        d = new Date((isoOrDate as any).seconds * 1000);
    }
    if (!d || isNaN(d.getTime())) return 'Not available';
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatDateWindowRange = (startIso: string, endIso: string): string => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, {
        ...opts,
        year: 'numeric',
    })}`;
};

/**
 * Derives qualitative, evidence-backed status summaries per dimension directly
 * from computed report indicators—never fabricating an overall numerical score.
 */
export const deriveDimensionStatuses = (report: CommunityHealthReport): DimensionQualitativeStatus[] => {
    const { participation, engagement, belonging, sustainability } = report.dimensions;
    const { recordsObserved } = report.dataCoverage;

    // 1. Participation status
    const activeRate = participation.activeContributorRate;
    const totalContrib = participation.totalContributions.value ?? 0;
    let partStatus: DimensionQualitativeStatus;
    if (activeRate.status === 'insufficient_data') {
        partStatus = {
            dimension: 'participation',
            label: 'Participation',
            level: 'limited_data',
            statusText: 'Limited Data',
            primaryReadout: totalContrib > 0 ? `${totalContrib} actions` : 'No membership baseline',
            summary:
                totalContrib > 0
                    ? `${totalContrib} contribution(s) recorded, but active member baseline is empty.`
                    : 'No active community memberships or observable contributions found in this window.',
        };
    } else if ((activeRate.value ?? 0) >= 35 && totalContrib > 0) {
        partStatus = {
            dimension: 'participation',
            label: 'Participation',
            level: 'healthy',
            statusText: 'Healthy',
            primaryReadout: `${activeRate.formattedValue} contributors`,
            summary: `${activeRate.numerator ?? 0} of ${activeRate.denominator ?? 0} active members contributed (${totalContrib} actions).`,
        };
    } else if (totalContrib > 0) {
        partStatus = {
            dimension: 'participation',
            label: 'Participation',
            level: (activeRate.value ?? 0) < 15 ? 'attention' : 'moderate',
            statusText: (activeRate.value ?? 0) < 15 ? 'Needs Attention' : 'Steady Baseline',
            primaryReadout: `${activeRate.formattedValue} contributors`,
            summary: `${activeRate.numerator ?? 0} of ${activeRate.denominator ?? 0} active members recorded observable activity.`,
        };
    } else {
        partStatus = {
            dimension: 'participation',
            label: 'Participation',
            level: 'attention',
            statusText: 'Needs Attention',
            primaryReadout: '0 contributions',
            summary: `${recordsObserved.activeMemberships} active member(s) recorded, with 0 contributions during this window.`,
        };
    }

    // 2. Engagement status
    const depth = engagement.postInteractionDepth;
    const turnout = engagement.pollVoterTurnout;
    const momentum = engagement.proposalGovernanceMomentum;
    const trend = engagement.activityTrendVsPriorPeriod;
    let engStatus: DimensionQualitativeStatus;
    if (
        depth.status === 'insufficient_data' &&
        turnout.status === 'insufficient_data' &&
        momentum.status === 'insufficient_data'
    ) {
        engStatus = {
            dimension: 'engagement',
            label: 'Engagement',
            level: 'limited_data',
            statusText: 'Limited Data',
            primaryReadout: 'Insufficient signals',
            summary: 'No posts, active polls, or proposals occurred in this window to evaluate interaction depth.',
        };
    } else if (
        (trend.value !== null && trend.value < -25) ||
        (momentum.value !== null && momentum.value < 35 && engagement.breakdown.totalProposalsInPeriod > 0)
    ) {
        engStatus = {
            dimension: 'engagement',
            label: 'Engagement',
            level: 'attention',
            statusText: 'Needs Attention',
            primaryReadout:
                trend.value !== null
                    ? `${trend.formattedValue} vs prior`
                    : depth.value !== null
                    ? `${depth.formattedValue} / post`
                    : turnout.formattedValue,
            summary:
                trend.value !== null && trend.value < -25
                    ? `Observable activity shifted ${trend.formattedValue} compared with the prior ${report.periodDays}-day period.`
                    : `Proposal progression stands at ${momentum.formattedValue} across ${engagement.breakdown.totalProposalsInPeriod} proposal(s).`,
        };
    } else if ((depth.value ?? 0) >= 2 || (turnout.value ?? 0) >= 30 || (trend.value ?? 0) > 0) {
        engStatus = {
            dimension: 'engagement',
            label: 'Engagement',
            level: 'healthy',
            statusText: 'Healthy',
            primaryReadout:
                depth.value !== null
                    ? `${depth.formattedValue} / post (est.)`
                    : `${turnout.formattedValue} poll turnout`,
            summary: `Active dialogue and governance signals across ${engagement.breakdown.totalPostsInPeriod} post(s) and ${engagement.breakdown.totalCommentsInPeriod} comment(s).`,
        };
    } else {
        engStatus = {
            dimension: 'engagement',
            label: 'Engagement',
            level: 'moderate',
            statusText: 'Steady Baseline',
            primaryReadout: depth.value !== null ? `${depth.formattedValue} / post` : turnout.formattedValue,
            summary: 'Baseline interactions recorded; poll and proposal participation remain light.',
        };
    }

    // 3. Belonging & Inclusion status
    const gini = belonging.contributionConcentrationIndex;
    const newActivation = belonging.newMemberActivationRate;
    let belStatus: DimensionQualitativeStatus;
    if (gini.status === 'insufficient_data' && newActivation.status === 'insufficient_data') {
        belStatus = {
            dimension: 'belonging',
            label: 'Belonging & Inclusion',
            level: 'limited_data',
            statusText: 'Limited Data',
            primaryReadout:
                belonging.zeroContributionMemberRate.value !== null
                    ? `${belonging.zeroContributionMemberRate.formattedValue} silent`
                    : 'Insufficient sample',
            summary: 'Requires at least 3 distinct contributors or recent joins to evaluate inclusion balance.',
        };
    } else if ((gini.value !== null && gini.value >= 0.55) || (newActivation.value !== null && newActivation.value < 25)) {
        belStatus = {
            dimension: 'belonging',
            label: 'Belonging & Inclusion',
            level: 'attention',
            statusText: 'Needs Attention',
            primaryReadout:
                gini.value !== null
                    ? `${gini.formattedValue} Gini`
                    : `${newActivation.formattedValue} new active`,
            summary:
                gini.value !== null && gini.value >= 0.55
                    ? `Contributions are concentrated (${gini.formattedValue} Gini); widening participation could improve inclusion.`
                    : `Only ${newActivation.formattedValue} of newly joined members recorded a first contribution.`,
        };
    } else {
        belStatus = {
            dimension: 'belonging',
            label: 'Belonging & Inclusion',
            level: 'healthy',
            statusText: 'Healthy',
            primaryReadout:
                gini.value !== null ? `${gini.formattedValue} Gini` : `${newActivation.formattedValue} activated`,
            summary: 'Activity is distributed across multiple contributors without severe concentration bottlenecks.',
        };
    }

    // 4. Sustainability status
    const retention = sustainability.returningContributorRetention;
    const crossPillar = sustainability.multiPillarParticipationRate;
    let susStatus: DimensionQualitativeStatus;
    if (retention.status === 'insufficient_data' && crossPillar.status === 'insufficient_data') {
        susStatus = {
            dimension: 'sustainability',
            label: 'Sustainability',
            level: 'limited_data',
            statusText: 'Limited Data',
            primaryReadout: 'Churn unavailable',
            summary: 'Insufficient multi-period contributor history; departure churn tracking is not yet retained.',
        };
    } else if (retention.value !== null && retention.value < 40) {
        susStatus = {
            dimension: 'sustainability',
            label: 'Sustainability',
            level: 'attention',
            statusText: 'Needs Attention',
            primaryReadout: `${retention.formattedValue} retained`,
            summary: `${retention.formattedValue} of prior-window contributors remained active; cross-pillar rate is ${crossPillar.formattedValue}.`,
        };
    } else if ((retention.value ?? 0) >= 40 || (crossPillar.value ?? 0) >= 25) {
        susStatus = {
            dimension: 'sustainability',
            label: 'Sustainability',
            level: 'healthy',
            statusText: 'Healthy',
            primaryReadout:
                retention.value !== null
                    ? `${retention.formattedValue} retained`
                    : `${crossPillar.formattedValue} cross-pillar`,
            summary: `Contributors show continuity across windows and engage across multiple community pillars.`,
        };
    } else {
        susStatus = {
            dimension: 'sustainability',
            label: 'Sustainability',
            level: 'moderate',
            statusText: 'Steady Baseline',
            primaryReadout:
                crossPillar.value !== null ? `${crossPillar.formattedValue} cross-pillar` : 'Early baseline',
            summary: 'Contributors are active in single pillars; prior-window retention baseline is still forming.',
        };
    }

    return [partStatus, engStatus, belStatus, susStatus];
};

/**
 * Generates an evidence-backed overall narrative without inventing an aggregate score.
 */
export const buildOverallHealthSummary = (
    report: CommunityHealthReport,
    dimensionStatuses: DimensionQualitativeStatus[]
): { headline: string; narrative: string; reliabilityCounts: Record<MeasurementConfidence, number> } => {
    const indicators: HealthIndicatorResult[] = [
        report.dimensions.participation.activeContributorRate,
        report.dimensions.participation.totalContributions,
        report.dimensions.participation.conclaveParticipationRate,
        report.dimensions.participation.conclaveAttendanceRate,
        report.dimensions.engagement.postInteractionDepth,
        report.dimensions.engagement.pollVoterTurnout,
        report.dimensions.engagement.proposalGovernanceMomentum,
        report.dimensions.engagement.activityTrendVsPriorPeriod,
        report.dimensions.belonging.newMemberActivationRate,
        report.dimensions.belonging.contributionConcentrationIndex,
        report.dimensions.belonging.zeroContributionMemberRate,
        report.dimensions.sustainability.returningContributorRetention,
        report.dimensions.sustainability.multiPillarParticipationRate,
        report.dimensions.sustainability.grossNewMemberAdditions,
        report.dimensions.sustainability.membershipChurnRate,
    ];

    const reliabilityCounts: Record<MeasurementConfidence, number> = {
        actual: 0,
        estimated: 0,
        insufficient_data: 0,
        unavailable: 0,
    };

    for (const ind of indicators) {
        reliabilityCounts[ind.status] += 1;
    }

    const { recordsObserved, isLiveFirestoreCommunity } = report.dataCoverage;
    const totalActions = report.dimensions.participation.totalContributions.value ?? 0;

    if (!isLiveFirestoreCommunity && recordsObserved.activeMemberships === 0 && totalActions === 0) {
        return {
            headline: 'Baseline Telemetry Pending',
            narrative: `${report.communityName} does not yet have recorded Firestore activity or membership documents for the ${report.periodDays}-day window.`,
            reliabilityCounts,
        };
    }

    const attentionCount = dimensionStatuses.filter((d) => d.level === 'attention').length;
    const healthyCount = dimensionStatuses.filter((d) => d.level === 'healthy').length;
    const limitedCount = dimensionStatuses.filter((d) => d.level === 'limited_data').length;

    let headline = 'Steady Collective Activity';
    if (healthyCount >= 3 && attentionCount === 0) {
        headline = 'Broadly Healthy Collective Signals';
    } else if (attentionCount >= 2) {
        headline = 'Targeted Attention Recommended';
    } else if (limitedCount >= 3) {
        headline = 'Early Measurement Baseline';
    } else if (attentionCount === 1) {
        headline = 'Active Core With Focused Growth Gaps';
    }

    const attentionNames = dimensionStatuses
        .filter((d) => d.level === 'attention')
        .map((d) => d.label.toLowerCase());

    const narrative =
        attentionNames.length > 0
            ? `Across ${recordsObserved.activeMemberships} active membership(s) and ${totalActions} verified contribution(s) in the last ${report.periodDays} days, ${attentionNames.join(' and ')} surfaced key signals requiring administrator review.`
            : `Based on ${recordsObserved.activeMemberships} active membership(s) and ${totalActions} verified contribution(s) in the last ${report.periodDays} days across Voice, Conclaves, and Memories.`;

    return {
        headline,
        narrative,
        reliabilityCounts,
    };
};
