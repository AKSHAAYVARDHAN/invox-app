/**
 * INVOX — Community Health | Phase 01: Foundation & Architecture
 *
 * Defines the canonical domain types, measurement specifications,
 * confidence classification, privacy guarantees, and indicator catalog
 * for the 05. COMMUNITY HEALTH pillar.
 *
 * Design principles:
 * - Zero fabricated metrics or synthetic percentages.
 * - Explicit distinction between actual measurements, estimates, and unavailable/insufficient data.
 * - Privacy-by-design: no individual member rankings, PII, or member-shaming lists exposed.
 * - Strictly scoped to Community Owners / Creators and Authorized Administrators.
 */

export type HealthPeriodKey = '7d' | '30d' | '90d';

export type HealthDimensionKey =
    | 'participation'
    | 'engagement'
    | 'belonging'
    | 'sustainability'
    | 'insights';

/**
 * Explicit reliability & availability status for every computed indicator:
 * - actual: Directly measured from verified Firestore activity records in the window.
 * - estimated: Derived from aggregate counters or partial records where exact event timestamps are absent.
 * - insufficient_data: Zero denominator or inadequate historical baseline (e.g. 0 posts, 0 new joins, 0 prior period data).
 * - unavailable: Required telemetry or historical event logs are not captured by current Firestore models.
 */
export type MeasurementConfidence =
    | 'actual'
    | 'estimated'
    | 'insufficient_data'
    | 'unavailable';

export interface HealthIndicatorDefinition {
    id: string;
    dimension: HealthDimensionKey;
    label: string;
    whatItMeasures: string;
    sourceCollections: string[];
    sourceFields: string[];
    calculationMethodology: string;
    defaultPeriod: HealthPeriodKey;
    missingDataHandling: string;
    privacyGuarantee: string;
}

export interface HealthIndicatorResult {
    definitionId: string;
    dimension: HealthDimensionKey;
    label: string;
    value: number | null;
    formattedValue: string;
    unit: 'percent' | 'count' | 'ratio' | 'index' | 'score';
    status: MeasurementConfidence;
    confidenceNote: string;
    numerator?: number;
    denominator?: number;
    previousValue?: number | null;
    deltaPercent?: number | null;
    periodKey: HealthPeriodKey;
    computedAt: string; // ISO timestamp
}

export type DistributionTierKey =
    | '0_actions'
    | '1_action'
    | '2_to_3_actions'
    | '4_plus_actions';

/**
 * Anonymized cohort distribution bucket — contains aggregate counts only,
 * never member UIDs, display names, or per-member rankings.
 */
export interface ContributionDistributionBucket {
    tier: DistributionTierKey;
    label: string;
    memberCount: number;
    shareOfMembersPercent: number | null;
}

export type InsightSeverity = 'healthy' | 'attention' | 'gap' | 'data_limit';

export interface CommunityInsight {
    id: string;
    dimension: HealthDimensionKey;
    severity: InsightSeverity;
    title: string;
    observation: string;
    recommendation: string;
    supportingIndicatorIds: string[];
    basedOnConfidence: MeasurementConfidence;
}

export interface MissingDataRequirement {
    id: string;
    dimension: HealthDimensionKey;
    missingSignal: string;
    impactedIndicators: string[];
    currentWorkaroundOrHandling: string;
    recommendedFutureCollectionOrField: string;
}

export interface HealthDataCoverage {
    isLiveFirestoreCommunity: boolean;
    collectionsQueried: string[];
    recordsObserved: {
        activeMemberships: number;
        pendingMemberships: number;
        postsInCommunity: number;
        commentsResolved: number;
        conclaveEvents: number;
        conclaveRegistrations: number;
        conclaveAttendanceRecords: number;
        collectiveMemories: number;
    };
    mockDataExcluded: boolean;
    warnings: string[];
    missingRequirements: MissingDataRequirement[];
}

export interface ParticipationDimensionReport {
    activeContributorRate: HealthIndicatorResult;
    totalContributions: HealthIndicatorResult;
    conclaveParticipationRate: HealthIndicatorResult;
    conclaveAttendanceRate: HealthIndicatorResult;
    discussionAndMemoryContributions: HealthIndicatorResult;
    pillarBreakdown: {
        voicePosts: number;
        comments: number;
        pollVotes: number;
        consultationResponses: number;
        conclaveRegistrations: number;
        memoriesCreated: number;
    };
}

export interface EngagementDimensionReport {
    postInteractionDepth: HealthIndicatorResult;
    pollVoterTurnout: HealthIndicatorResult;
    proposalGovernanceMomentum: HealthIndicatorResult;
    activityTrendVsPriorPeriod: HealthIndicatorResult;
    breakdown: {
        totalPostsInPeriod: number;
        totalPollsInPeriod: number;
        totalProposalsInPeriod: number;
        totalConsultationsInPeriod: number;
        totalCommentsInPeriod: number;
        totalLikesOnPeriodPosts: number;
        totalViewsOnPeriodPosts: number;
    };
}

export interface BelongingDimensionReport {
    newMemberActivationRate: HealthIndicatorResult;
    contributionConcentrationIndex: HealthIndicatorResult;
    zeroContributionMemberRate: HealthIndicatorResult;
    distributionBuckets: ContributionDistributionBucket[];
}

export interface SustainabilityDimensionReport {
    observedActiveToInactiveRatio: HealthIndicatorResult;
    returningContributorRetention: HealthIndicatorResult;
    multiPillarParticipationRate: HealthIndicatorResult;
    grossNewMemberAdditions: HealthIndicatorResult;
    membershipChurnRate: HealthIndicatorResult;
}

export interface CommunityHealthReport {
    communityId: string;
    communityName: string;
    periodKey: HealthPeriodKey;
    periodDays: number;
    periodStart: string; // ISO timestamp
    periodEnd: string;   // ISO timestamp
    generatedAt: string; // ISO timestamp
    dataCoverage: HealthDataCoverage;
    dimensions: {
        participation: ParticipationDimensionReport;
        engagement: EngagementDimensionReport;
        belonging: BelongingDimensionReport;
        sustainability: SustainabilityDimensionReport;
        insights: CommunityInsight[];
    };
}

/**
 * Compact anonymized aggregate snapshot eligible for optional persistence
 * under `communities/{communityId}/healthSnapshots/{periodKey}` (strictly owner/admin gated).
 * Intentionally omits all member UIDs, emails, and user-level lists.
 */
export interface CommunityHealthSnapshotDocument {
    id: HealthPeriodKey;
    communityId: string;
    periodKey: HealthPeriodKey;
    generatedBy: string;
    generatedAt: string;
    activeMembersCount: number;
    activeContributorRate: number | null;
    totalContributions: number;
    pollVoterTurnout: number | null;
    newMemberActivationRate: number | null;
    contributionConcentrationIndex: number | null;
    returningContributorRetention: number | null;
    multiPillarParticipationRate: number | null;
    insightsCount: number;
    updatedAt?: unknown;
}

/**
 * Canonical specification catalog for all Community Health indicators.
 * Serves as the single source of truth for measurement semantics, Firestore sources,
 * calculation methodology, period boundaries, and missing-data handling.
 */
export const COMMUNITY_HEALTH_INDICATOR_CATALOG: Record<string, HealthIndicatorDefinition> = {
    active_contributor_rate: {
        id: 'active_contributor_rate',
        dimension: 'participation',
        label: 'Active Contributor Rate',
        whatItMeasures:
            'Percentage of active community members who performed at least one observable contribution (post, comment, poll vote, consultation submission, Conclave registration/attendance, or memory record) during the measurement window.',
        sourceCollections: [
            'communityMemberships',
            'posts',
            'comments',
            'conclaveRegistrations',
            'conclaveAttendance',
            'collectiveMemories',
        ],
        sourceFields: [
            'communityMemberships.userId',
            'communityMemberships.status',
            'posts.authorId',
            'posts.pollMeta.voterUids',
            'posts.pollMeta.votesByOption',
            'posts.consultationMeta.responses[].userId',
            'comments.authorId',
            'conclaveRegistrations.userId',
            'conclaveAttendance.userId',
            'collectiveMemories.creatorUid',
        ],
        calculationMethodology:
            '(Count of distinct active member UIDs with >= 1 contribution in [periodStart, periodEnd] / Total active communityMemberships) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data if active membership count is 0. Explicitly notes that passive reading/views are not captured because membership records lack lastActiveAt timestamps.',
        privacyGuarantee:
            'Contributor UIDs are deduplicated in memory solely to compute the aggregate count and are never returned or displayed.',
    },
    total_contributions: {
        id: 'total_contributions',
        dimension: 'participation',
        label: 'Observable Contributions',
        whatItMeasures:
            'Total count of distinct participation actions recorded across Discussions/Voice posts, comments, poll votes, consultation submissions, Conclave registrations, and Collective Memories.',
        sourceCollections: [
            'posts',
            'comments',
            'conclaveRegistrations',
            'collectiveMemories',
        ],
        sourceFields: [
            'posts.createdAt',
            'posts.pollMeta.voterUids',
            'posts.consultationMeta.responses[].submittedAt',
            'comments.createdAt',
            'conclaveRegistrations.registeredAt',
            'collectiveMemories.createdAt',
        ],
        calculationMethodology:
            'Sum of Firestore community actions created within [periodStart, periodEnd] across Collective Voice, Conclave, and Collective Memory.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Poll votes stored only as `voterUids` without per-vote timestamps are attributed only to polls active or created in the window (marked estimated if poll spans multiple periods).',
        privacyGuarantee:
            'Reported strictly as aggregate counts by pillar.',
    },
    conclave_participation_rate: {
        id: 'conclave_participation_rate',
        dimension: 'participation',
        label: 'Conclave Capacity Fill Rate',
        whatItMeasures:
            'Proportion of available Conclave gathering seats filled by confirmed member registrations during the period.',
        sourceCollections: ['conclaveEvents', 'conclaveRegistrations'],
        sourceFields: [
            'conclaveEvents.capacity',
            'conclaveEvents.registeredCount',
            'conclaveEvents.eventStatus',
            'conclaveRegistrations.status',
            'conclaveRegistrations.registeredAt',
        ],
        calculationMethodology:
            '(Confirmed registrations on non-draft, non-cancelled capped Conclave events in period / Sum of event capacities) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data if no capped Conclave events occurred or were scheduled in the window.',
        privacyGuarantee:
            'Aggregated across events; individual registrant lists are not included.',
    },
    conclave_attendance_rate: {
        id: 'conclave_attendance_rate',
        dimension: 'participation',
        label: 'Verified Conclave Attendance Rate',
        whatItMeasures:
            'Share of marked Conclave attendees recorded as ATTENDED versus NO_SHOW on completed or ongoing gatherings.',
        sourceCollections: ['conclaveAttendance'],
        sourceFields: [
            'conclaveAttendance.attendanceStatus',
            'conclaveAttendance.markedAt',
        ],
        calculationMethodology:
            '(Count of ATTENDED records / Count of ATTENDED + NO_SHOW records in period) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns unavailable if organizers have not recorded explicit attendance verification in `conclaveAttendance`.',
        privacyGuarantee:
            'Aggregated verification ratio only; individual attendance statuses are omitted.',
    },
    post_interaction_depth: {
        id: 'post_interaction_depth',
        dimension: 'engagement',
        label: 'Interaction Depth per Post',
        whatItMeasures:
            'Average combined reactions (likes) and comments generated per community post published in the measurement window.',
        sourceCollections: ['posts', 'comments'],
        sourceFields: [
            'posts.likeCount',
            'posts.commentCount',
            'posts.stats.likes',
            'posts.stats.comments',
            'posts.createdAt',
            'comments.targetId',
            'comments.createdAt',
        ],
        calculationMethodology:
            '(Sum of likes + comments on community posts authored in [periodStart, periodEnd]) / Count of posts authored in [periodStart, periodEnd].',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when 0 posts were published in the period. Marked estimated because `posts.likeCount` is cumulative without per-like timestamps.',
        privacyGuarantee:
            'Aggregated across posts; individual likers or commenters are not exposed.',
    },
    poll_voter_turnout: {
        id: 'poll_voter_turnout',
        dimension: 'engagement',
        label: 'Poll Voter Turnout',
        whatItMeasures:
            'Share of active community members who voted in at least one Collective Voice poll during the period.',
        sourceCollections: ['posts', 'communityMemberships'],
        sourceFields: [
            'posts.voiceType',
            'posts.pollMeta.voterUids',
            'posts.pollMeta.votesByOption',
            'communityMemberships.userId',
            'communityMemberships.status',
        ],
        calculationMethodology:
            '(Unique member UIDs present in pollMeta.voterUids/votesByOption for period polls / Total active communityMemberships) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data if 0 polls were active/created in the period or 0 active members exist.',
        privacyGuarantee:
            'Only unique turnout percentage and numerator/denominator counts are returned.',
    },
    proposal_governance_momentum: {
        id: 'proposal_governance_momentum',
        dimension: 'engagement',
        label: 'Proposal Progression Rate',
        whatItMeasures:
            'Percentage of Collective Voice proposals that moved beyond initial open/draft stages into active review, approval, or implementation.',
        sourceCollections: ['posts'],
        sourceFields: [
            'posts.voiceType',
            'posts.proposalMeta.status',
            'posts.decisionMeta.isRecorded',
        ],
        calculationMethodology:
            '(Proposals with status in [under_review, approved, implemented] or decisionMeta.isRecorded == true / Total non-withdrawn proposals in period) * 100.',
        defaultPeriod: '90d',
        missingDataHandling:
            'Returns insufficient_data if no proposals exist in the community for the period.',
        privacyGuarantee:
            'Governance workflow metrics only.',
    },
    activity_trend_vs_prior: {
        id: 'activity_trend_vs_prior',
        dimension: 'engagement',
        label: 'Activity Trend vs Prior Period',
        whatItMeasures:
            'Percentage change in observable community contributions compared against the immediately preceding contiguous window of equal duration.',
        sourceCollections: ['posts', 'comments', 'conclaveRegistrations', 'collectiveMemories'],
        sourceFields: ['createdAt', 'registeredAt', 'submittedAt'],
        calculationMethodology:
            '((Current period contributions - Prior period contributions) / Prior period contributions) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when the prior contiguous period has 0 recorded contributions (avoids divide-by-zero fabricated growth percentages).',
        privacyGuarantee:
            'Aggregate volume comparison only.',
    },
    new_member_activation_rate: {
        id: 'new_member_activation_rate',
        dimension: 'belonging',
        label: 'New-Member Activation Rate',
        whatItMeasures:
            'Percentage of newly joined active members (whose `joinedAt` falls within the current window) who made at least one observable contribution.',
        sourceCollections: ['communityMemberships', 'posts', 'comments', 'conclaveRegistrations', 'collectiveMemories'],
        sourceFields: ['communityMemberships.joinedAt', 'communityMemberships.userId'],
        calculationMethodology:
            '(New active members in [periodStart, periodEnd] with >= 1 contribution / Total active members with joinedAt in [periodStart, periodEnd]) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when 0 new members joined during the measurement window.',
        privacyGuarantee:
            'Evaluated in memory and emitted strictly as aggregate rate and anonymized counts.',
    },
    contribution_concentration_gini: {
        id: 'contribution_concentration_gini',
        dimension: 'belonging',
        label: 'Contribution Concentration (Gini)',
        whatItMeasures:
            'Statistical inequality (0.00 = equal participation across contributors, 1.00 = single-member concentration) indicating whether community voice is broadly shared or bottlenecked.',
        sourceCollections: ['posts', 'comments', 'conclaveRegistrations', 'collectiveMemories'],
        sourceFields: ['authorId', 'creatorUid', 'userId'],
        calculationMethodology:
            'Standard Gini coefficient calculated over the sorted array of per-contributor action counts for members with >= 1 action.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when fewer than 3 distinct contributors have recorded activity in the window.',
        privacyGuarantee:
            'Strictly anonymous mathematical distribution — no top-contributor names, UIDs, or leaderboards are surfaced.',
    },
    zero_contribution_member_rate: {
        id: 'zero_contribution_member_rate',
        dimension: 'belonging',
        label: 'Silent / Non-Contributing Gap',
        whatItMeasures:
            'Share of active members with zero observable contributions in the window, highlighting potential onboarding or inclusion gaps.',
        sourceCollections: ['communityMemberships', 'posts', 'comments', 'conclaveRegistrations', 'collectiveMemories'],
        sourceFields: ['communityMemberships.userId'],
        calculationMethodology:
            '100 - Active Contributor Rate (Active members with 0 recorded contributions / Total active members * 100).',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when active membership count is 0. Note clarifies that passive readers are counted here because view logs are not tracked per member.',
        privacyGuarantee:
            'Aggregate percentage and anonymized distribution bucket only; non-contributing members are never identified.',
    },
    returning_contributor_retention: {
        id: 'returning_contributor_retention',
        dimension: 'sustainability',
        label: 'Returning Contributor Retention',
        whatItMeasures:
            'Percentage of contributors active in the previous period who also contributed in the current period.',
        sourceCollections: ['posts', 'comments', 'conclaveRegistrations', 'collectiveMemories'],
        sourceFields: ['createdAt', 'registeredAt', 'submittedAt', 'authorId', 'userId'],
        calculationMethodology:
            '(|Contributors(priorWindow) ∩ Contributors(currentWindow)| / |Contributors(priorWindow)|) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when the community had 0 contributors in the immediately preceding window.',
        privacyGuarantee:
            'Set intersection performed transiently in memory; only percentage and counts are returned.',
    },
    multi_pillar_participation_rate: {
        id: 'multi_pillar_participation_rate',
        dimension: 'sustainability',
        label: 'Cross-Pillar Participation Rate',
        whatItMeasures:
            'Percentage of active contributors who participated across two or more distinct community pillars (Collective Voice, Conclave Gatherings, Collective Memory).',
        sourceCollections: ['posts', 'comments', 'conclaveRegistrations', 'collectiveMemories'],
        sourceFields: ['authorId', 'userId', 'creatorUid'],
        calculationMethodology:
            '(Contributors active in >= 2 pillars during period / Total unique contributors in period) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns insufficient_data when 0 unique contributors were active in the period.',
        privacyGuarantee:
            'Aggregated ratio only.',
    },
    membership_churn_rate: {
        id: 'membership_churn_rate',
        dimension: 'sustainability',
        label: 'Membership Departure / Churn Rate',
        whatItMeasures:
            'Rate at which members depart the community over the measurement window based on retained soft-departure records.',
        sourceCollections: ['communityMemberships'],
        sourceFields: ['status', 'leftAt', 'updatedAt'],
        calculationMethodology:
            '(Count of communityMemberships with status == "left" and leftAt in [periodStart, periodEnd] / (Active members + Departed in period)) * 100.',
        defaultPeriod: '30d',
        missingDataHandling:
            'Returns actual rate whenever soft-departure records (`status: "left"`, `leftAt`) are observed. Returns unavailable (`value: null`) if no departure history records exist yet.',
        privacyGuarantee:
            'Aggregated departure rate only; departed member identities are never exposed.',
    },
};

export const COMMUNITY_HEALTH_MISSING_DATA_REQUIREMENTS: MissingDataRequirement[] = [
    {
        id: 'missing_member_last_active',
        dimension: 'participation',
        missingSignal: 'Passive member session / `lastActiveAt` timestamp',
        impactedIndicators: ['active_contributor_rate', 'zero_contribution_member_rate', 'observedActiveToInactiveRatio'],
        currentWorkaroundOrHandling:
            'Indicators explicitly measure *observable contributors* (members who posted, commented, voted, submitted consultation feedback, registered for Conclave, or archived a memory) rather than claiming passive visit counts.',
        recommendedFutureCollectionOrField:
            'Optional throttled `lastActiveAt` timestamp on `communityMemberships/{userId}_{communityId}` (updated at most once per 24h on community visit).',
    },
    {
        id: 'missing_membership_departure_log',
        dimension: 'sustainability',
        missingSignal: 'Pre-update membership departures prior to soft-leave retention',
        impactedIndicators: ['membership_churn_rate'],
        currentWorkaroundOrHandling:
            '`leaveCommunity()` now preserves `status: "left"` with an anonymized `leftAt` timestamp. Communities with zero retained `left` records continue to show `unavailable` until departure events occur.',
        recommendedFutureCollectionOrField:
            'Maintained automatically via `communityMemberships.status = "left"` and `leftAt: serverTimestamp()`.',
    },
    {
        id: 'missing_comment_like_community_index',
        dimension: 'engagement',
        missingSignal: 'Direct `communityId` field on `comments` & `likes` + timestamped view logs',
        impactedIndicators: ['post_interaction_depth', 'activity_trend_vs_prior'],
        currentWorkaroundOrHandling:
            'Comments are resolved via bounded `targetId in [...]` queries over community posts (up to 90 recent posts). Like/view counters on posts are flagged `estimated` because `likes` and `viewCount` lack community-scoped time-series.',
        recommendedFutureCollectionOrField:
            'Include optional `communityId` on `comments` created inside communities and `createdAt` on `likes` when `post.communityId` is present.',
    },
    {
        id: 'missing_per_vote_timestamps',
        dimension: 'engagement',
        missingSignal: 'Timestamp on individual Collective Voice poll votes (`votesByOption`)',
        impactedIndicators: ['poll_voter_turnout', 'active_contributor_rate'],
        currentWorkaroundOrHandling:
            'Poll votes are attributed to the poll’s `createdAt` / `updatedAt` window when `voterUids` is populated.',
        recommendedFutureCollectionOrField:
            'Optional `voteTimestamps: Record<string, string>` inside `pollMeta` or a `votes` subcollection.',
    },
];
