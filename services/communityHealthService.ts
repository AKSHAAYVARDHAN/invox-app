import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Community, CommunityMembership, Post } from '../types';
import type { CollectiveMemory } from './collectiveMemoryTypes';
import { canUserManageCommunity, OperationType } from './communityService';
import { CONCLAVE_COLLECTIONS } from './conclaveService';
import type {
    ConclaveAttendanceRecord,
    ConclaveEvent,
    ConclaveRegistration,
} from './conclaveTypes';
import {
    COMMUNITY_HEALTH_INDICATOR_CATALOG,
    COMMUNITY_HEALTH_MISSING_DATA_REQUIREMENTS,
    type BelongingDimensionReport,
    type CommunityHealthReport,
    type CommunityHealthSnapshotDocument,
    type CommunityInsight,
    type ContributionDistributionBucket,
    type EngagementDimensionReport,
    type HealthDataCoverage,
    type HealthDimensionKey,
    type HealthIndicatorResult,
    type HealthPeriodKey,
    type MeasurementConfidence,
    type ParticipationDimensionReport,
    type SustainabilityDimensionReport,
} from './communityHealthTypes';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import { normalizeFirestorePost } from './postService';
import {
    buildEvaluationDatasetBundle,
    isEvaluationRecordId,
} from './communityHealthEvalDataset';

export const COMMUNITY_HEALTH_SUBCOLLECTION = 'healthSnapshots';

export interface CommunityHealthSourceRecords {
    memberships: CommunityMembership[];
    posts: Post[];
    comments: Array<{ id: string; targetId: string; authorId: string; createdAtMs: number | null }>;
    events: ConclaveEvent[];
    registrations: ConclaveRegistration[];
    attendanceRecords: ConclaveAttendanceRecord[];
    memories: CollectiveMemory[];
    collectionsQueried: string[];
    warnings: string[];
}

export interface CommunityHealthComputeOptions {
    nowMs?: number;
}

const PERIOD_DAYS_MAP: Record<HealthPeriodKey, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Structured Firestore error reporter following INVOX security diagnostic contract.
 */
const logAndThrowFirestoreError = (
    error: unknown,
    operationType: OperationType,
    path: string | null
): never => {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        operationType,
        path,
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo:
                auth.currentUser?.providerData?.map((p) => ({
                    providerId: p.providerId,
                    email: p.email,
                })) || [],
        },
    };
    console.error('Firestore Community Health Error:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
};

/**
 * Permission gate:
 * Strictly limited to Community Owners / Creators and explicitly appointed Community Administrators.
 * Regular members, non-members, and unauthenticated visitors are denied.
 */
export const canUserAccessCommunityHealth = (
    community: Community | null | undefined,
    currentUser: { uid: string; email?: string | null } | null | undefined
): boolean => {
    return canUserManageCommunity(community, currentUser);
};

/**
 * Normalizes Firestore Timestamp / Date / string / number to epoch milliseconds.
 */
const toTimestampMs = (raw: unknown): number | null => {
    if (!raw) return null;
    if (raw instanceof Date) {
        const ms = raw.getTime();
        return isNaN(ms) ? null : ms;
    }
    if (typeof raw === 'number') {
        return isNaN(raw) ? null : raw;
    }
    if (typeof raw === 'string') {
        const ms = new Date(raw).getTime();
        return isNaN(ms) ? null : ms;
    }
    if (typeof (raw as any)?.toDate === 'function') {
        const d = (raw as any).toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
    }
    if (typeof (raw as any)?.seconds === 'number') {
        return (raw as any).seconds * 1000;
    }
    return null;
};

const isPlaceholderMockId = (id: string | undefined | null): boolean => {
    if (!id) return true;
    return (
        id.startsWith('voice-') ||
        id.startsWith('mem-gen-') ||
        id.startsWith('mock-') ||
        id.startsWith('demo-')
    );
};

const roundTo = (num: number, decimals = 1): number => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
};

/**
 * Computes statistical Gini coefficient (0 = perfect equality, 1 = complete concentration)
 * over an array of non-negative contribution counts. Never exposes member identifiers.
 */
export const computeGiniCoefficient = (counts: number[]): number | null => {
    const valid = counts.filter((c) => typeof c === 'number' && !isNaN(c) && c > 0).sort((a, b) => a - b);
    const n = valid.length;
    if (n < 3) return null;
    const sum = valid.reduce((acc, val) => acc + val, 0);
    if (sum <= 0) return null;

    let weightedSum = 0;
    for (let i = 0; i < n; i++) {
        weightedSum += (2 * (i + 1) - n - 1) * valid[i];
    }
    const gini = weightedSum / (n * sum);
    return roundTo(Math.min(1, Math.max(0, gini)), 2);
};

const buildIndicator = (
    definitionId: string,
    periodKey: HealthPeriodKey,
    computedAt: string,
    params: {
        value: number | null;
        formattedValue: string;
        unit: HealthIndicatorResult['unit'];
        status: MeasurementConfidence;
        confidenceNote: string;
        numerator?: number;
        denominator?: number;
        previousValue?: number | null;
        deltaPercent?: number | null;
    }
): HealthIndicatorResult => {
    const def = COMMUNITY_HEALTH_INDICATOR_CATALOG[definitionId];
    return {
        definitionId,
        dimension: def?.dimension || 'participation',
        label: def?.label || definitionId,
        value: params.value,
        formattedValue: params.formattedValue,
        unit: params.unit,
        status: params.status,
        confidenceNote: params.confidenceNote,
        numerator: params.numerator,
        denominator: params.denominator,
        previousValue: params.previousValue,
        deltaPercent: params.deltaPercent,
        periodKey,
        computedAt,
    };
};

interface InternalActivityRecord {
    uid: string;
    pillar: 'voice' | 'conclave' | 'memory';
    timestampMs: number;
}

/**
 * Queries Firestore collections for the community and resolves bounded comments for community posts.
 * Includes all existing Firestore documents belonging to the community (excluding only client-side static UI fallback IDs).
 */
export const fetchCommunitySourceRecords = async (
    communityId: string
): Promise<CommunityHealthSourceRecords> => {
    const warnings: string[] = [];
    const collectionsQueried: string[] = [
        COLLECTIONS.communityMemberships,
        COLLECTIONS.posts,
        CONCLAVE_COLLECTIONS.events,
        CONCLAVE_COLLECTIONS.registrations,
        CONCLAVE_COLLECTIONS.attendance,
        COLLECTIONS.collectiveMemories,
    ];

    const [
        membershipsSnap,
        postsSnap,
        eventsSnap,
        registrationsSnap,
        attendanceSnap,
        memoriesSnap,
    ] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.communityMemberships), where('communityId', '==', communityId))),
        getDocs(query(collection(db, COLLECTIONS.posts), where('communityId', '==', communityId))),
        getDocs(query(collection(db, CONCLAVE_COLLECTIONS.events), where('communityId', '==', communityId))),
        getDocs(query(collection(db, CONCLAVE_COLLECTIONS.registrations), where('communityId', '==', communityId))),
        getDocs(query(collection(db, CONCLAVE_COLLECTIONS.attendance), where('communityId', '==', communityId))),
        getDocs(query(collection(db, COLLECTIONS.collectiveMemories), where('communityId', '==', communityId))),
    ]);

    const memberships: CommunityMembership[] = membershipsSnap.docs
        .filter((d) => !isPlaceholderMockId(d.id))
        .map((d) => ({ id: d.id, ...d.data() } as CommunityMembership));

    const posts: Post[] = postsSnap.docs
        .filter((d) => !isPlaceholderMockId(d.id))
        .map((d) => normalizeFirestorePost(d.id, d.data()));

    const events: ConclaveEvent[] = eventsSnap.docs
        .filter((d) => !isPlaceholderMockId(d.id))
        .map((d) => ({ id: d.id, ...d.data() } as ConclaveEvent));

    const registrations: ConclaveRegistration[] = registrationsSnap.docs
        .filter((d) => !isPlaceholderMockId(d.id))
        .map((d) => ({ id: d.id, ...d.data() } as ConclaveRegistration));

    const attendanceRecords: ConclaveAttendanceRecord[] = attendanceSnap.docs
        .filter((d) => !isPlaceholderMockId(d.id))
        .map((d) => ({ id: d.id, ...d.data() } as ConclaveAttendanceRecord));

    const memories: CollectiveMemory[] = memoriesSnap.docs
        .filter((d) => !isPlaceholderMockId(d.id))
        .map((d) => ({ id: d.id, ...d.data() } as CollectiveMemory));

    // Resolve comments for community posts (bounded to 90 most recent posts in chunks of 30)
    const commentRecords: Array<{ id: string; targetId: string; authorId: string; createdAtMs: number | null }> = [];
    if (posts.length > 0) {
        collectionsQueried.push(COLLECTIONS.comments);
        const sortedPostIds = [...posts]
            .sort((a, b) => (toTimestampMs(b.createdAt) || 0) - (toTimestampMs(a.createdAt) || 0))
            .slice(0, 90)
            .map((p) => p.id);

        if (posts.length > 90) {
            warnings.push(
                `Comment resolution sampled across the 90 most recent community posts out of ${posts.length} total posts (comments collection lacks a direct communityId index).`
            );
        }

        const chunks: string[][] = [];
        for (let i = 0; i < sortedPostIds.length; i += 30) {
            chunks.push(sortedPostIds.slice(i, i + 30));
        }

        try {
            const commentSnaps = await Promise.all(
                chunks.map((chunk) =>
                    getDocs(query(collection(db, COLLECTIONS.comments), where('targetId', 'in', chunk)))
                )
            );
            for (const snap of commentSnaps) {
                for (const d of snap.docs) {
                    const data = d.data();
                    if (!isPlaceholderMockId(d.id) && data.authorId) {
                        commentRecords.push({
                            id: d.id,
                            targetId: data.targetId || data.postId,
                            authorId: String(data.authorId),
                            createdAtMs: toTimestampMs(data.createdAt),
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('[HEALTH_COMMENTS_QUERY_WARN]', err);
            warnings.push('Individual comment records could not be resolved; aggregate post.commentCount counters remain available.');
        }
    }

    return {
        memberships,
        posts,
        comments: commentRecords,
        events,
        registrations,
        attendanceRecords,
        memories,
        collectionsQueried,
        warnings,
    };
};

/**
 * When seeded community records (`eval-health-*`) already exist in Firestore for a community,
 * resolves their associated anonymized member cohorts, registrations, and author attributions
 * without overwriting or duplicating real user records.
 */
const resolveSeededCommunityCohorts = (
    community: Community,
    raw: CommunityHealthSourceRecords,
    ownerUid: string,
    nowMs: number
): CommunityHealthSourceRecords => {
    const hasSeededRecords =
        raw.posts.some((p) => isEvaluationRecordId(p.id)) ||
        raw.comments.some((c) => isEvaluationRecordId(c.id)) ||
        raw.events.some((e) => isEvaluationRecordId(e.id)) ||
        raw.attendanceRecords.some((a) => isEvaluationRecordId(a.id)) ||
        raw.memories.some((m) => isEvaluationRecordId(m.id));

    if (!hasSeededRecords) {
        return raw;
    }

    const bundle = buildEvaluationDatasetBundle(
        community,
        ownerUid,
        community.ownerName || 'Community Lead',
        nowMs
    );

    // 1. Merge active & soft-departed cohort memberships without overwriting real user memberships
    const existingMemberUids = new Set(raw.memberships.map((m) => m.userId));
    const mergedMemberships = [
        ...raw.memberships,
        ...bundle.memberships.filter((m) => !existingMemberUids.has(m.userId)),
        ...bundle.departedMemberships.filter((m) => !existingMemberUids.has(m.userId)),
    ];

    // 2. Attribute seeded posts/comments to their designated member cohort UIDs
    const remappedPosts = raw.posts.map((post) => {
        const cohortAuthor = bundle.cohortPostAuthorMap[post.id];
        if (cohortAuthor && isEvaluationRecordId(post.id)) {
            return { ...post, authorId: cohortAuthor };
        }
        return post;
    });

    const remappedComments = raw.comments.map((comment) => {
        const cohortAuthor = bundle.cohortCommentAuthorMap[comment.id];
        if (cohortAuthor && isEvaluationRecordId(comment.id)) {
            return { ...comment, authorId: cohortAuthor };
        }
        return comment;
    });

    // 3. Merge companion Conclave registrations for seeded Conclave events present in Firestore
    const presentSeededEventIds = new Set(
        raw.events.filter((e) => isEvaluationRecordId(e.id)).map((e) => e.id)
    );
    const existingRegKeys = new Set(
        raw.registrations.map((r) => `${r.eventId}::${r.userId}`)
    );
    const companionRegs = bundle.registrations.filter(
        (r) =>
            presentSeededEventIds.has(r.eventId) &&
            !existingRegKeys.has(`${r.eventId}::${r.userId}`)
    );

    return {
        ...raw,
        memberships: mergedMemberships,
        posts: remappedPosts,
        comments: remappedComments,
        registrations: [...raw.registrations, ...companionRegs],
    };
};

/**
 * Generates deterministic, evidence-backed administrative insights and actionable suggestions.
 * Every observation directly references verified measurement statuses and avoids fabricated claims.
 */
const generateCommunityInsights = (params: {
    communityName: string;
    activeMembersCount: number;
    participation: ParticipationDimensionReport;
    engagement: EngagementDimensionReport;
    belonging: BelongingDimensionReport;
    sustainability: SustainabilityDimensionReport;
    coverage: HealthDataCoverage;
}): CommunityInsight[] => {
    const insights: CommunityInsight[] = [];
    const {
        communityName,
        activeMembersCount,
        participation,
        engagement,
        belonging,
        sustainability,
        coverage,
    } = params;

    if (!coverage.isLiveFirestoreCommunity && activeMembersCount === 0 && coverage.recordsObserved.postsInCommunity === 0) {
        insights.push({
            id: 'insight_insufficient_live_telemetry',
            dimension: 'insights',
            severity: 'data_limit',
            title: 'No Community Activity Recorded Yet',
            observation: `${communityName} currently has zero recorded Firestore membership or activity documents.`,
            recommendation:
                'Once members join and publish discussions, polls, Conclave registrations, or memories, indicators will populate from community activity.',
            supportingIndicatorIds: ['active_contributor_rate', 'total_contributions'],
            basedOnConfidence: 'insufficient_data',
        });
        return insights;
    }

    // 1. Concentration / Belonging check
    const gini = belonging.contributionConcentrationIndex.value;
    if (gini !== null) {
        if (gini >= 0.55) {
            insights.push({
                id: 'insight_high_concentration',
                dimension: 'belonging',
                severity: 'attention',
                title: 'Contributions Are Concentrated Among Few Members',
                observation: `Contribution concentration index is ${gini.toFixed(2)}, indicating that a small subset of active contributors accounts for most recorded activity.`,
                recommendation:
                    'Lower the barrier to first participation using lightweight Collective Voice polls, open discussion prompts, or member-led Conclave formats.',
                supportingIndicatorIds: ['contribution_concentration_gini', 'zero_contribution_member_rate'],
                basedOnConfidence: 'actual',
            });
        } else {
            insights.push({
                id: 'insight_balanced_contribution',
                dimension: 'belonging',
                severity: 'healthy',
                title: 'Balanced Contribution Distribution',
                observation: `Contribution concentration index is ${gini.toFixed(2)}, showing healthy distribution across active contributors.`,
                recommendation:
                    'Maintain diverse contribution channels across Collective Voice, Conclaves, and Collective Memory.',
                supportingIndicatorIds: ['contribution_concentration_gini'],
                basedOnConfidence: 'actual',
            });
        }
    }

    // 2. New member activation gap
    const activation = belonging.newMemberActivationRate.value;
    if (activation !== null) {
        if (activation < 25) {
            insights.push({
                id: 'insight_low_new_member_activation',
                dimension: 'belonging',
                severity: 'gap',
                title: 'New-Member Activation Opportunity',
                observation: `Only ${activation}% of members who joined during this window have recorded a post, comment, poll vote, or Conclave registration.`,
                recommendation:
                    'Introduce an onboarding welcome discussion or active starter poll so new members have an immediate, low-friction way to contribute.',
                supportingIndicatorIds: ['new_member_activation_rate'],
                basedOnConfidence: 'actual',
            });
        } else if (activation >= 50) {
            insights.push({
                id: 'insight_strong_new_member_activation',
                dimension: 'belonging',
                severity: 'healthy',
                title: 'Strong New-Member Onboarding Activation',
                observation: `${activation}% of recently joined members recorded an observable contribution within the measurement window.`,
                recommendation:
                    'Continue welcoming new joiners into open discussions and upcoming Conclave sessions.',
                supportingIndicatorIds: ['new_member_activation_rate'],
                basedOnConfidence: 'actual',
            });
        }
    }

    // 3. Conclave verified attendance tracking check
    if (
        participation.conclaveAttendanceRate.status === 'unavailable' &&
        coverage.recordsObserved.conclaveEvents > 0
    ) {
        insights.push({
            id: 'insight_attendance_tracking_gap',
            dimension: 'participation',
            severity: 'data_limit',
            title: 'Conclave Attendance Verification Not Yet Recorded',
            observation: `${coverage.recordsObserved.conclaveEvents} Conclave gathering(s) exist, but organizers have not recorded verified attendance in conclaveAttendance.`,
            recommendation:
                'Mark participant attendance on completed Conclaves so actual turnout vs registration no-shows can be measured accurately.',
            supportingIndicatorIds: ['conclave_attendance_rate', 'conclave_participation_rate'],
            basedOnConfidence: 'unavailable',
        });
    }

    // 4. Proposal governance momentum
    const proposalMomentum = engagement.proposalGovernanceMomentum.value;
    if (proposalMomentum !== null && proposalMomentum < 35 && engagement.breakdown.totalProposalsInPeriod > 0) {
        insights.push({
            id: 'insight_proposal_backlog',
            dimension: 'engagement',
            severity: 'attention',
            title: 'Open Proposals Awaiting Governance Review',
            observation: `Only ${proposalMomentum}% of proposals have progressed into council review, approval, or ratification.`,
            recommendation:
                'Schedule a periodic proposal review cycle in Collective Voice to transition open initiatives and document formal outcomes.',
            supportingIndicatorIds: ['proposal_governance_momentum'],
            basedOnConfidence: 'actual',
        });
    }

    // 5. Returning contributor sustainability check
    const retention = sustainability.returningContributorRetention.value;
    if (retention !== null && retention < 40) {
        insights.push({
            id: 'insight_returning_contributor_drop',
            dimension: 'sustainability',
            severity: 'attention',
            title: 'Returning Contributor Continuity Needs Attention',
            observation: `${retention}% of contributors active in the previous period remained active in the current window.`,
            recommendation:
                'Review recurring gathering cadence and publish Collective Memory recaps to keep prior contributors connected across cycles.',
            supportingIndicatorIds: ['returning_contributor_retention', 'multi_pillar_participation_rate'],
            basedOnConfidence: 'actual',
        });
    }

    // 6. Churn visibility notice
    if (sustainability.membershipChurnRate.status === 'unavailable') {
        insights.push({
            id: 'insight_churn_telemetry_unavailable',
            dimension: 'sustainability',
            severity: 'data_limit',
            title: 'No Retained Departure History Recorded Yet',
            observation:
                'Soft-departure tracking (`status: "left"`, `leftAt`) is enabled on leaveCommunity(), but no retained departure records exist yet in this community (pre-update deletions were not archived).',
            recommendation:
                'As members leave going forward, anonymized departure timestamps are preserved automatically to unlock live churn reporting.',
            supportingIndicatorIds: ['membership_churn_rate'],
            basedOnConfidence: 'unavailable',
        });
    }

    return insights;
};

/**
 * Main Phase 01 Calculation Engine:
 * Computes a complete, privacy-preserving CommunityHealthReport from Firestore records.
 * Enforces owner/administrator access at the service boundary before querying sensitive data.
 */
export const computeCommunityHealthReport = async (
    community: Community,
    currentUser: { uid: string; email?: string | null } | null | undefined,
    periodKey: HealthPeriodKey = '30d',
    options: CommunityHealthComputeOptions = {}
): Promise<CommunityHealthReport> => {
    if (!canUserAccessCommunityHealth(community, currentUser)) {
        throw new Error(
            'UNAUTHORIZED_COMMUNITY_HEALTH_ACCESS: Only the community owner or authorized administrators may view Community Health analytics.'
        );
    }

    const nowMs = options.nowMs ?? Date.now();
    let raw = await fetchCommunitySourceRecords(community.id);
    const ownerRefUid = community.ownerId || community.creatorId || currentUser?.uid || '';
    if (ownerRefUid) {
        raw = resolveSeededCommunityCohorts(community, raw, ownerRefUid, nowMs);
    }

    return computeCommunityHealthReportFromRecords(community, raw, periodKey, nowMs);
};

/**
 * Pure, deterministic calculation engine operating on pre-resolved CommunityHealthSourceRecords.
 */
export const computeCommunityHealthReportFromRecords = (
    community: Community,
    raw: CommunityHealthSourceRecords,
    periodKey: HealthPeriodKey = '30d',
    nowMs: number = Date.now()
): CommunityHealthReport => {
    const periodDays = PERIOD_DAYS_MAP[periodKey] || 30;
    const periodEndMs = nowMs;
    const periodStartMs = nowMs - periodDays * ONE_DAY_MS;
    const priorStartMs = periodStartMs - periodDays * ONE_DAY_MS;
    const computedAt = new Date(nowMs).toISOString();

    const activeMemberships = raw.memberships.filter((m) => m.status === 'active');
    const pendingMemberships = raw.memberships.filter((m) => m.status === 'pending');

    // Include community owner in authoritative active member UID set if not explicitly duplicated in communityMemberships
    const activeMemberUids = new Set<string>(activeMemberships.map((m) => m.userId));
    if (community.ownerId) activeMemberUids.add(community.ownerId);
    if (community.creatorId) activeMemberUids.add(community.creatorId);

    const activeMembersCount = activeMemberUids.size;
    const isLiveFirestoreCommunity = Boolean(
        community.ownerId ||
        community.creatorId ||
        community.id.startsWith('comm_') ||
        raw.memberships.length > 0 ||
        raw.posts.length > 0 ||
        raw.events.length > 0 ||
        raw.memories.length > 0
    );

    const inCurrent = (ms: number | null): boolean =>
        ms !== null && ms >= periodStartMs && ms <= periodEndMs;
    const inPrior = (ms: number | null): boolean =>
        ms !== null && ms >= priorStartMs && ms < periodStartMs;

    // Collect normalized activity events strictly for current & prior windows
    const currentActivities: InternalActivityRecord[] = [];
    const priorActivities: InternalActivityRecord[] = [];

    // Voice & standard posts
    let voicePostsCount = 0;
    let totalPollsInPeriod = 0;
    let totalProposalsInPeriod = 0;
    let progressedProposalsInPeriod = 0;
    let totalConsultationsInPeriod = 0;
    let consultationResponsesCount = 0;
    let pollVotesInPeriodCount = 0;
    let totalLikesOnPeriodPosts = 0;
    let totalViewsOnPeriodPosts = 0;
    const currentPollVoterUids = new Set<string>();

    for (const post of raw.posts) {
        const createdMs = toTimestampMs(post.createdAt);
        const updatedMs = toTimestampMs(post.updatedAt) ?? createdMs;

        if (inCurrent(createdMs)) {
            voicePostsCount += 1;
            if (post.authorId && createdMs !== null) {
                currentActivities.push({ uid: post.authorId, pillar: 'voice', timestampMs: createdMs });
            }
            totalLikesOnPeriodPosts += Number(post.likeCount ?? post.stats?.likes ?? 0);
            totalViewsOnPeriodPosts += Number(post.viewCount ?? post.stats?.views ?? 0);

            if (post.voiceType === 'proposal' || post.proposalMeta) {
                if (post.proposalMeta?.status !== 'withdrawn') {
                    totalProposalsInPeriod += 1;
                    const st = post.proposalMeta?.status;
                    if (st === 'under_review' || st === 'approved' || st === 'implemented' || post.decisionMeta?.isRecorded) {
                        progressedProposalsInPeriod += 1;
                    }
                }
            }
        } else if (inPrior(createdMs) && post.authorId && createdMs !== null) {
            priorActivities.push({ uid: post.authorId, pillar: 'voice', timestampMs: createdMs });
        }

        // Poll voters (attributed to current period if poll created/updated/active in window, or prior window if historical)
        if ((post.voiceType === 'poll' || post.pollMeta) && post.pollMeta) {
            const pollExpiresMs = post.pollMeta.expiresAt ? toTimestampMs(post.pollMeta.expiresAt) : null;
            const pollActiveInPeriod =
                inCurrent(createdMs) ||
                inCurrent(updatedMs) ||
                (pollExpiresMs !== null && pollExpiresMs >= periodStartMs);

            const voterSet = new Set<string>(
                Array.isArray(post.pollMeta.voterUids) ? post.pollMeta.voterUids : []
            );
            if (post.pollMeta.votesByOption) {
                for (const uids of Object.values(post.pollMeta.votesByOption)) {
                    if (Array.isArray(uids)) {
                        uids.forEach((uid) => voterSet.add(uid));
                    }
                }
            }

            if (pollActiveInPeriod) {
                totalPollsInPeriod += 1;
                voterSet.forEach((uid) => {
                    if (!uid.startsWith('mock-') && !uid.startsWith('guest_')) {
                        currentPollVoterUids.add(uid);
                        pollVotesInPeriodCount += 1;
                        currentActivities.push({
                            uid,
                            pillar: 'voice',
                            timestampMs: updatedMs || createdMs || nowMs,
                        });
                    }
                });
            } else {
                const pollPriorRefMs = updatedMs || createdMs;
                if (inPrior(pollPriorRefMs) && pollPriorRefMs !== null) {
                    voterSet.forEach((uid) => {
                        if (!uid.startsWith('mock-') && !uid.startsWith('guest_')) {
                            priorActivities.push({
                                uid,
                                pillar: 'voice',
                                timestampMs: pollPriorRefMs,
                            });
                        }
                    });
                }
            }
        }

        // Consultation responses (have individual `submittedAt` timestamps)
        if ((post.voiceType === 'consultation' || post.consultationMeta) && post.consultationMeta) {
            if (inCurrent(createdMs)) {
                totalConsultationsInPeriod += 1;
            }
            const responses = Array.isArray(post.consultationMeta.responses) ? post.consultationMeta.responses : [];
            for (const resp of responses) {
                const respMs = toTimestampMs(resp.submittedAt);
                if (inCurrent(respMs) && resp.userId && respMs !== null) {
                    consultationResponsesCount += 1;
                    currentActivities.push({ uid: resp.userId, pillar: 'voice', timestampMs: respMs });
                } else if (inPrior(respMs) && resp.userId && respMs !== null) {
                    priorActivities.push({ uid: resp.userId, pillar: 'voice', timestampMs: respMs });
                }
            }
        }
    }

    // Comments resolved from community posts
    let commentsInPeriodCount = 0;
    for (const c of raw.comments) {
        if (inCurrent(c.createdAtMs) && c.createdAtMs !== null) {
            commentsInPeriodCount += 1;
            currentActivities.push({ uid: c.authorId, pillar: 'voice', timestampMs: c.createdAtMs });
        } else if (inPrior(c.createdAtMs) && c.createdAtMs !== null) {
            priorActivities.push({ uid: c.authorId, pillar: 'voice', timestampMs: c.createdAtMs });
        }
    }

    // Conclave registrations
    let conclaveRegsInPeriodCount = 0;
    for (const reg of raw.registrations) {
        if (reg.status === 'CANCELLED') continue;
        const regMs = toTimestampMs(reg.registeredAt);
        if (inCurrent(regMs) && reg.userId && regMs !== null) {
            conclaveRegsInPeriodCount += 1;
            currentActivities.push({ uid: reg.userId, pillar: 'conclave', timestampMs: regMs });
        } else if (inPrior(regMs) && reg.userId && regMs !== null) {
            priorActivities.push({ uid: reg.userId, pillar: 'conclave', timestampMs: regMs });
        }
    }

    // Conclave capacity fill & verified attendance
    const eligiblePeriodEvents = raw.events.filter((ev) => {
        if (ev.eventStatus === 'DRAFT' || ev.eventStatus === 'CANCELLED') return false;
        const startMs = toTimestampMs(ev.startTimestamp) ?? toTimestampMs(ev.createdAt);
        return inCurrent(startMs);
    });
    const cappedEvents = eligiblePeriodEvents.filter((ev) => Number(ev.capacity) > 0);
    const totalEventCapacity = cappedEvents.reduce((acc, ev) => acc + Number(ev.capacity || 0), 0);
    const totalEventRegistrations = cappedEvents.reduce(
        (acc, ev) => acc + Number(ev.registeredCount ?? ev.attendeeCount ?? 0),
        0
    );

    const periodAttendance = raw.attendanceRecords.filter((rec) => {
        const ms = toTimestampMs(rec.markedAt);
        return inCurrent(ms) && (rec.attendanceStatus === 'ATTENDED' || rec.attendanceStatus === 'NO_SHOW');
    });
    const attendedCount = periodAttendance.filter((r) => r.attendanceStatus === 'ATTENDED').length;

    // Collective Memories
    let memoriesCreatedInPeriodCount = 0;
    for (const mem of raw.memories) {
        if (mem.status === 'archived') continue;
        const memMs = toTimestampMs(mem.createdAt) ?? toTimestampMs(mem.date);
        if (inCurrent(memMs) && mem.creatorUid && memMs !== null) {
            memoriesCreatedInPeriodCount += 1;
            currentActivities.push({ uid: mem.creatorUid, pillar: 'memory', timestampMs: memMs });
        } else if (inPrior(memMs) && mem.creatorUid && memMs !== null) {
            priorActivities.push({ uid: mem.creatorUid, pillar: 'memory', timestampMs: memMs });
        }
    }

    // Aggregate per-member action counts & pillar diversity in memory (never exposed individually)
    const contributorCounts = new Map<string, number>();
    const contributorPillars = new Map<string, Set<'voice' | 'conclave' | 'memory'>>();
    for (const act of currentActivities) {
        contributorCounts.set(act.uid, (contributorCounts.get(act.uid) || 0) + 1);
        if (!contributorPillars.has(act.uid)) {
            contributorPillars.set(act.uid, new Set());
        }
        contributorPillars.get(act.uid)!.add(act.pillar);
    }

    const priorContributorUids = new Set<string>(priorActivities.map((a) => a.uid));
    const currentContributorUids = new Set<string>(contributorCounts.keys());

    // Active members who contributed at least once
    let activeContributorsAmongMembers = 0;
    const memberActionDistribution: Record<ContributionDistributionBucket['tier'], number> = {
        '0_actions': 0,
        '1_action': 0,
        '2_to_3_actions': 0,
        '4_plus_actions': 0,
    };

    for (const uid of Array.from(activeMemberUids)) {
        const count = contributorCounts.get(uid) || 0;
        if (count > 0) {
            activeContributorsAmongMembers += 1;
        }
        if (count === 0) memberActionDistribution['0_actions'] += 1;
        else if (count === 1) memberActionDistribution['1_action'] += 1;
        else if (count <= 3) memberActionDistribution['2_to_3_actions'] += 1;
        else memberActionDistribution['4_plus_actions'] += 1;
    }

    const totalContributionsCount = currentActivities.length;
    const priorContributionsCount = priorActivities.length;

    // ─── A. PARTICIPATION ──────────────────────────────────────────────────────
    const activeContributorRateVal =
        activeMembersCount > 0 ? roundTo((activeContributorsAmongMembers / activeMembersCount) * 100, 1) : null;

    const participation: ParticipationDimensionReport = {
        activeContributorRate: buildIndicator('active_contributor_rate', periodKey, computedAt, {
            value: activeContributorRateVal,
            formattedValue: activeContributorRateVal !== null ? `${activeContributorRateVal}%` : 'Insufficient data',
            unit: 'percent',
            status: activeMembersCount > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                activeMembersCount > 0
                    ? 'Measures active members with at least one observable contribution (passive reads/visits are not tracked).'
                    : 'No active community memberships recorded yet.',
            numerator: activeContributorsAmongMembers,
            denominator: activeMembersCount,
        }),
        totalContributions: buildIndicator('total_contributions', periodKey, computedAt, {
            value: totalContributionsCount,
            formattedValue: totalContributionsCount.toLocaleString(),
            unit: 'count',
            status: 'actual',
            confidenceNote:
                'Sum of verified Firestore posts, comments, poll votes, consultation responses, Conclave registrations, and memories.',
        }),
        conclaveParticipationRate: buildIndicator('conclave_participation_rate', periodKey, computedAt, {
            value:
                totalEventCapacity > 0
                    ? roundTo(Math.min(100, (totalEventRegistrations / totalEventCapacity) * 100), 1)
                    : null,
            formattedValue:
                totalEventCapacity > 0
                    ? `${roundTo(Math.min(100, (totalEventRegistrations / totalEventCapacity) * 100), 1)}%`
                    : 'Insufficient data',
            unit: 'percent',
            status: totalEventCapacity > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                totalEventCapacity > 0
                    ? `Measured across ${cappedEvents.length} capped Conclave event(s) in the period.`
                    : 'No capacity-bounded Conclave gatherings found in this window.',
            numerator: totalEventRegistrations,
            denominator: totalEventCapacity,
        }),
        conclaveAttendanceRate: buildIndicator('conclave_attendance_rate', periodKey, computedAt, {
            value:
                periodAttendance.length > 0
                    ? roundTo((attendedCount / periodAttendance.length) * 100, 1)
                    : null,
            formattedValue:
                periodAttendance.length > 0
                    ? `${roundTo((attendedCount / periodAttendance.length) * 100, 1)}%`
                    : 'Unavailable',
            unit: 'percent',
            status: periodAttendance.length > 0 ? 'actual' : 'unavailable',
            confidenceNote:
                periodAttendance.length > 0
                    ? `Verified from ${periodAttendance.length} conclaveAttendance check-in records.`
                    : 'No organizer check-in records found in conclaveAttendance for this period.',
            numerator: attendedCount,
            denominator: periodAttendance.length,
        }),
        discussionAndMemoryContributions: buildIndicator('total_contributions', periodKey, computedAt, {
            value: voicePostsCount + commentsInPeriodCount + memoriesCreatedInPeriodCount,
            formattedValue: (voicePostsCount + commentsInPeriodCount + memoriesCreatedInPeriodCount).toLocaleString(),
            unit: 'count',
            status: 'actual',
            confidenceNote: 'Combined posts, comments, and published Collective Memories authored in this window.',
        }),
        pillarBreakdown: {
            voicePosts: voicePostsCount,
            comments: commentsInPeriodCount,
            pollVotes: pollVotesInPeriodCount,
            consultationResponses: consultationResponsesCount,
            conclaveRegistrations: conclaveRegsInPeriodCount,
            memoriesCreated: memoriesCreatedInPeriodCount,
        },
    };

    // ─── B. ENGAGEMENT ─────────────────────────────────────────────────────────
    const interactionSum = totalLikesOnPeriodPosts + commentsInPeriodCount;
    const interactionDepthVal = voicePostsCount > 0 ? roundTo(interactionSum / voicePostsCount, 1) : null;

    const pollTurnoutVal =
        totalPollsInPeriod > 0 && activeMembersCount > 0
            ? roundTo(Math.min(100, (currentPollVoterUids.size / activeMembersCount) * 100), 1)
            : null;

    const proposalMomentumVal =
        totalProposalsInPeriod > 0
            ? roundTo((progressedProposalsInPeriod / totalProposalsInPeriod) * 100, 1)
            : null;

    const activityDeltaVal =
        priorContributionsCount > 0
            ? roundTo(((totalContributionsCount - priorContributionsCount) / priorContributionsCount) * 100, 1)
            : null;

    const engagement: EngagementDimensionReport = {
        postInteractionDepth: buildIndicator('post_interaction_depth', periodKey, computedAt, {
            value: interactionDepthVal,
            formattedValue: interactionDepthVal !== null ? `${interactionDepthVal}` : 'Insufficient data',
            unit: 'ratio',
            status: voicePostsCount > 0 ? 'estimated' : 'insufficient_data',
            confidenceNote:
                voicePostsCount > 0
                    ? 'Estimated using cumulative like counts on period posts plus period comments (individual likes lack community-scoped time-series).'
                    : 'No community posts published during this measurement window.',
            numerator: interactionSum,
            denominator: voicePostsCount,
        }),
        pollVoterTurnout: buildIndicator('poll_voter_turnout', periodKey, computedAt, {
            value: pollTurnoutVal,
            formattedValue: pollTurnoutVal !== null ? `${pollTurnoutVal}%` : 'Insufficient data',
            unit: 'percent',
            status: totalPollsInPeriod > 0 && activeMembersCount > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                totalPollsInPeriod > 0 && activeMembersCount > 0
                    ? `Unique member voters across ${totalPollsInPeriod} poll(s) active during the period.`
                    : 'Requires at least 1 active poll and 1 active member.',
            numerator: currentPollVoterUids.size,
            denominator: activeMembersCount,
        }),
        proposalGovernanceMomentum: buildIndicator('proposal_governance_momentum', periodKey, computedAt, {
            value: proposalMomentumVal,
            formattedValue: proposalMomentumVal !== null ? `${proposalMomentumVal}%` : 'Insufficient data',
            unit: 'percent',
            status: totalProposalsInPeriod > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                totalProposalsInPeriod > 0
                    ? `${progressedProposalsInPeriod} of ${totalProposalsInPeriod} proposals reached review, approval, or ratification.`
                    : 'No Collective Voice proposals submitted in this period.',
            numerator: progressedProposalsInPeriod,
            denominator: totalProposalsInPeriod,
        }),
        activityTrendVsPriorPeriod: buildIndicator('activity_trend_vs_prior', periodKey, computedAt, {
            value: activityDeltaVal,
            formattedValue:
                activityDeltaVal !== null
                    ? `${activityDeltaVal > 0 ? '+' : ''}${activityDeltaVal}%`
                    : 'Insufficient data',
            unit: 'percent',
            status: priorContributionsCount > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                priorContributionsCount > 0
                    ? `Compared ${totalContributionsCount} current actions against ${priorContributionsCount} actions in the preceding ${periodDays}-day window.`
                    : `Preceding ${periodDays}-day baseline had 0 recorded contributions; growth percentage cannot be calculated reliably.`,
            numerator: totalContributionsCount,
            denominator: priorContributionsCount,
            previousValue: priorContributionsCount,
            deltaPercent: activityDeltaVal,
        }),
        breakdown: {
            totalPostsInPeriod: voicePostsCount,
            totalPollsInPeriod,
            totalProposalsInPeriod,
            totalConsultationsInPeriod,
            totalCommentsInPeriod: commentsInPeriodCount,
            totalLikesOnPeriodPosts,
            totalViewsOnPeriodPosts,
        },
    };

    // ─── C. BELONGING & INCLUSION (ANONYMIZED) ─────────────────────────────────
    const newActiveMembers = activeMemberships.filter((m) => inCurrent(toTimestampMs(m.joinedAt)));
    const activatedNewMembersCount = newActiveMembers.filter((m) => (contributorCounts.get(m.userId) || 0) > 0).length;
    const newMemberActivationVal =
        newActiveMembers.length > 0
            ? roundTo((activatedNewMembersCount / newActiveMembers.length) * 100, 1)
            : null;

    const giniIndex = computeGiniCoefficient(Array.from(contributorCounts.values()));
    const zeroContributionRateVal =
        activeMembersCount > 0
            ? roundTo((memberActionDistribution['0_actions'] / activeMembersCount) * 100, 1)
            : null;

    const distributionBuckets: ContributionDistributionBucket[] = [
        {
            tier: '0_actions',
            label: '0 Recorded Contributions',
            memberCount: memberActionDistribution['0_actions'],
            shareOfMembersPercent:
                activeMembersCount > 0
                    ? roundTo((memberActionDistribution['0_actions'] / activeMembersCount) * 100, 1)
                    : null,
        },
        {
            tier: '1_action',
            label: '1 Contribution',
            memberCount: memberActionDistribution['1_action'],
            shareOfMembersPercent:
                activeMembersCount > 0
                    ? roundTo((memberActionDistribution['1_action'] / activeMembersCount) * 100, 1)
                    : null,
        },
        {
            tier: '2_to_3_actions',
            label: '2–3 Contributions',
            memberCount: memberActionDistribution['2_to_3_actions'],
            shareOfMembersPercent:
                activeMembersCount > 0
                    ? roundTo((memberActionDistribution['2_to_3_actions'] / activeMembersCount) * 100, 1)
                    : null,
        },
        {
            tier: '4_plus_actions',
            label: '4+ Contributions',
            memberCount: memberActionDistribution['4_plus_actions'],
            shareOfMembersPercent:
                activeMembersCount > 0
                    ? roundTo((memberActionDistribution['4_plus_actions'] / activeMembersCount) * 100, 1)
                    : null,
        },
    ];

    const belonging: BelongingDimensionReport = {
        newMemberActivationRate: buildIndicator('new_member_activation_rate', periodKey, computedAt, {
            value: newMemberActivationVal,
            formattedValue: newMemberActivationVal !== null ? `${newMemberActivationVal}%` : 'Insufficient data',
            unit: 'percent',
            status: newActiveMembers.length > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                newActiveMembers.length > 0
                    ? `${activatedNewMembersCount} of ${newActiveMembers.length} newly joined member(s) recorded at least 1 contribution.`
                    : `No new member joins recorded in the last ${periodDays} days.`,
            numerator: activatedNewMembersCount,
            denominator: newActiveMembers.length,
        }),
        contributionConcentrationIndex: buildIndicator('contribution_concentration_gini', periodKey, computedAt, {
            value: giniIndex,
            formattedValue: giniIndex !== null ? giniIndex.toFixed(2) : 'Insufficient data',
            unit: 'index',
            status: giniIndex !== null ? 'actual' : 'insufficient_data',
            confidenceNote:
                giniIndex !== null
                    ? 'Anonymized Gini coefficient (0.00 = equal participation, 1.00 = concentrated). Individual members are never ranked or exposed.'
                    : 'Requires at least 3 distinct contributors in the window to compute distribution inequality.',
        }),
        zeroContributionMemberRate: buildIndicator('zero_contribution_member_rate', periodKey, computedAt, {
            value: zeroContributionRateVal,
            formattedValue: zeroContributionRateVal !== null ? `${zeroContributionRateVal}%` : 'Insufficient data',
            unit: 'percent',
            status: activeMembersCount > 0 ? 'estimated' : 'insufficient_data',
            confidenceNote:
                activeMembersCount > 0
                    ? 'Includes silent readers because passive community visits are not logged on membership records.'
                    : 'No active community memberships recorded yet.',
            numerator: memberActionDistribution['0_actions'],
            denominator: activeMembersCount,
        }),
        distributionBuckets,
    };

    // ─── D. COMMUNITY SUSTAINABILITY ───────────────────────────────────────────
    const returningCount = Array.from(priorContributorUids).filter((uid) => currentContributorUids.has(uid)).length;
    const returningRetentionVal =
        priorContributorUids.size > 0
            ? roundTo((returningCount / priorContributorUids.size) * 100, 1)
            : null;

    const multiPillarCount = Array.from(contributorPillars.values()).filter((set) => set.size >= 2).length;
    const multiPillarRateVal =
        currentContributorUids.size > 0
            ? roundTo((multiPillarCount / currentContributorUids.size) * 100, 1)
            : null;

    const priorNewJoinsCount = activeMemberships.filter((m) => inPrior(toTimestampMs(m.joinedAt))).length;
    const observedActiveRatio =
        memberActionDistribution['0_actions'] > 0
            ? roundTo(activeContributorsAmongMembers / memberActionDistribution['0_actions'], 2)
            : null;

    const sustainability: SustainabilityDimensionReport = {
        observedActiveToInactiveRatio: buildIndicator('active_contributor_rate', periodKey, computedAt, {
            value: observedActiveRatio,
            formattedValue:
                observedActiveRatio !== null
                    ? `${observedActiveRatio}:1`
                    : activeMembersCount > 0 && activeContributorsAmongMembers > 0
                    ? `${activeContributorsAmongMembers}:0`
                    : 'Insufficient data',
            unit: 'ratio',
            status: activeMembersCount > 0 ? 'estimated' : 'insufficient_data',
            confidenceNote:
                'Ratio of members with >=1 recorded contribution to members with 0 recorded contributions (passive readers unlogged).',
            numerator: activeContributorsAmongMembers,
            denominator: memberActionDistribution['0_actions'],
        }),
        returningContributorRetention: buildIndicator('returning_contributor_retention', periodKey, computedAt, {
            value: returningRetentionVal,
            formattedValue: returningRetentionVal !== null ? `${returningRetentionVal}%` : 'Insufficient data',
            unit: 'percent',
            status: priorContributorUids.size > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                priorContributorUids.size > 0
                    ? `${returningCount} of ${priorContributorUids.size} contributor(s) from the prior ${periodDays}-day window remained active.`
                    : `No contributors observed in the preceding ${periodDays}-day window to measure retention.`,
            numerator: returningCount,
            denominator: priorContributorUids.size,
        }),
        multiPillarParticipationRate: buildIndicator('multi_pillar_participation_rate', periodKey, computedAt, {
            value: multiPillarRateVal,
            formattedValue: multiPillarRateVal !== null ? `${multiPillarRateVal}%` : 'Insufficient data',
            unit: 'percent',
            status: currentContributorUids.size > 0 ? 'actual' : 'insufficient_data',
            confidenceNote:
                currentContributorUids.size > 0
                    ? `${multiPillarCount} of ${currentContributorUids.size} contributor(s) engaged across 2+ pillars (Voice, Conclave, Memory).`
                    : 'No active contributors recorded during this window.',
            numerator: multiPillarCount,
            denominator: currentContributorUids.size,
        }),
        grossNewMemberAdditions: buildIndicator('new_member_activation_rate', periodKey, computedAt, {
            value: newActiveMembers.length,
            formattedValue: newActiveMembers.length.toLocaleString(),
            unit: 'count',
            status: 'actual',
            confidenceNote:
                'Gross new active joins recorded in communityMemberships during the measurement window.',
            previousValue: priorNewJoinsCount,
            deltaPercent:
                priorNewJoinsCount > 0
                    ? roundTo(((newActiveMembers.length - priorNewJoinsCount) / priorNewJoinsCount) * 100, 1)
                    : null,
        }),
        membershipChurnRate: (() => {
            const leftMemberships = raw.memberships.filter((m) => m.status === 'left');
            const getLeftMs = (m: CommunityMembership): number | null =>
                toTimestampMs((m as any).leftAt) ?? toTimestampMs(m.updatedAt);
            const departedInPeriod = leftMemberships.filter((m) => inCurrent(getLeftMs(m))).length;
            const priorDepartedCount = leftMemberships.filter((m) => inPrior(getLeftMs(m))).length;

            if (leftMemberships.length === 0) {
                return buildIndicator('membership_churn_rate', periodKey, computedAt, {
                    value: null,
                    formattedValue: 'Unavailable',
                    unit: 'percent',
                    status: 'unavailable',
                    confidenceNote:
                        'Soft-departure timestamps (`status: "left"`, `leftAt`) are enabled on leaveCommunity(), but no departure records exist in this community yet.',
                });
            }

            const churnDenominator = activeMembersCount + departedInPeriod;
            const churnVal =
                churnDenominator > 0 ? roundTo((departedInPeriod / churnDenominator) * 100, 1) : 0;

            return buildIndicator('membership_churn_rate', periodKey, computedAt, {
                value: churnVal,
                formattedValue: `${churnVal}%`,
                unit: 'percent',
                status: 'actual',
                confidenceNote: `${departedInPeriod} anonymized soft-departure(s) recorded out of ${churnDenominator} active + departed members in this window.`,
                numerator: departedInPeriod,
                denominator: churnDenominator,
                previousValue: priorDepartedCount,
                deltaPercent:
                    priorDepartedCount > 0
                        ? roundTo(((departedInPeriod - priorDepartedCount) / priorDepartedCount) * 100, 1)
                        : null,
            });
        })(),
    };

    const dataCoverage: HealthDataCoverage = {
        isLiveFirestoreCommunity,
        collectionsQueried: raw.collectionsQueried,
        recordsObserved: {
            activeMemberships: activeMemberships.length,
            pendingMemberships: pendingMemberships.length,
            postsInCommunity: raw.posts.length,
            commentsResolved: raw.comments.length,
            conclaveEvents: raw.events.length,
            conclaveRegistrations: raw.registrations.length,
            conclaveAttendanceRecords: raw.attendanceRecords.length,
            collectiveMemories: raw.memories.length,
        },
        mockDataExcluded: false,
        warnings: raw.warnings,
        missingRequirements: COMMUNITY_HEALTH_MISSING_DATA_REQUIREMENTS,
    };

    // ─── E. COMMUNITY INSIGHTS ─────────────────────────────────────────────────
    const insights = generateCommunityInsights({
        communityName: community.name,
        activeMembersCount,
        participation,
        engagement,
        belonging,
        sustainability,
        coverage: dataCoverage,
    });

    return {
        communityId: community.id,
        communityName: community.name,
        periodKey,
        periodDays,
        periodStart: new Date(periodStartMs).toISOString(),
        periodEnd: new Date(periodEndMs).toISOString(),
        generatedAt: computedAt,
        dataCoverage,
        dimensions: {
            participation,
            engagement,
            belonging,
            sustainability,
            insights,
        },
    };
};

/**
 * Saves an anonymized aggregate snapshot under `communities/{communityId}/healthSnapshots/{periodKey}`.
 * Strictly restricted to Community Owners and Authorized Administrators (enforced both here and in firestore.rules).
 */
export const saveCommunityHealthSnapshot = async (
    community: Community,
    currentUser: { uid: string; email?: string | null } | null | undefined,
    report: CommunityHealthReport
): Promise<CommunityHealthSnapshotDocument> => {
    if (!canUserAccessCommunityHealth(community, currentUser) || !currentUser?.uid) {
        throw new Error('UNAUTHORIZED_COMMUNITY_HEALTH_WRITE');
    }

    const path = `${COLLECTIONS.communities}/${community.id}/${COMMUNITY_HEALTH_SUBCOLLECTION}/${report.periodKey}`;
    const docData: CommunityHealthSnapshotDocument = {
        id: report.periodKey,
        communityId: community.id,
        periodKey: report.periodKey,
        generatedBy: currentUser.uid,
        generatedAt: report.generatedAt,
        activeMembersCount: report.dataCoverage.recordsObserved.activeMemberships,
        activeContributorRate: report.dimensions.participation.activeContributorRate.value,
        totalContributions: report.dimensions.participation.totalContributions.value ?? 0,
        pollVoterTurnout: report.dimensions.engagement.pollVoterTurnout.value,
        newMemberActivationRate: report.dimensions.belonging.newMemberActivationRate.value,
        contributionConcentrationIndex: report.dimensions.belonging.contributionConcentrationIndex.value,
        returningContributorRetention: report.dimensions.sustainability.returningContributorRetention.value,
        multiPillarParticipationRate: report.dimensions.sustainability.multiPillarParticipationRate.value,
        insightsCount: report.dimensions.insights.length,
        updatedAt: serverTimestamp(),
    };

    try {
        await setDoc(doc(db, path), sanitizeForFirestore(docData));
        return docData;
    } catch (err) {
        return logAndThrowFirestoreError(err, OperationType.WRITE, path);
    }
};

/**
 * Retrieves the latest stored anonymized health snapshot for a community & period.
 * Strictly restricted to Community Owners and Authorized Administrators.
 */
export const getLatestCommunityHealthSnapshot = async (
    community: Community,
    currentUser: { uid: string; email?: string | null } | null | undefined,
    periodKey: HealthPeriodKey = '30d'
): Promise<CommunityHealthSnapshotDocument | null> => {
    if (!canUserAccessCommunityHealth(community, currentUser)) {
        throw new Error('UNAUTHORIZED_COMMUNITY_HEALTH_READ');
    }

    const path = `${COLLECTIONS.communities}/${community.id}/${COMMUNITY_HEALTH_SUBCOLLECTION}/${periodKey}`;
    try {
        const snap = await getDoc(doc(db, path));
        if (!snap.exists()) return null;
        return snap.data() as CommunityHealthSnapshotDocument;
    } catch (err) {
        return logAndThrowFirestoreError(err, OperationType.GET, path);
    }
};
