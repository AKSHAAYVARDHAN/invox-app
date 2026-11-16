import assert from 'node:assert/strict';
import {
    buildEvaluationDatasetBundle,
    EVAL_HEALTH_ID_PREFIX,
    EVAL_HEALTH_TAG,
    isEvaluationRecordId,
} from '../services/communityHealthEvalDataset';
import {
    computeCommunityHealthReportFromRecords,
    type CommunityHealthSourceRecords,
} from '../services/communityHealthService';
import type { Community } from '../types';

const nowMs = Date.UTC(2026, 3, 15, 12, 0, 0);

const madMaxCommunity: Community = {
    id: 'comm_madmax_wizards',
    name: 'MadMax Wizards',
    handle: 'madmax-wizards',
    description: 'Evaluation community for INVOX Collective & Community Health verification.',
    category: 'Technology',
    visibility: 'public',
    ownerId: 'owner_akshaay_eval',
    creatorId: 'owner_akshaay_eval',
    ownerName: 'Community Lead',
    adminIds: ['owner_akshaay_eval'],
    members: 1,
    rating: 5,
    memberCount: 1,
    createdAt: new Date(nowMs - 150 * 86400_000),
};

const bundle = buildEvaluationDatasetBundle(
    madMaxCommunity,
    'owner_akshaay_eval',
    'Community Lead',
    nowMs
);

// 1. Validate schema & uniqueness invariants for v2 dataset
assert.equal(bundle.memberships.length, 10);
assert.equal(bundle.departedMemberships.length, 4);
assert.equal(bundle.posts.length, 18); // 6 discussions, 6 proposals, 4 polls, 2 consultations
assert.equal(bundle.comments.length, 20);
assert.equal(bundle.events.length, 5); // 4 completed + 1 upcoming PUBLISHED
assert.ok(bundle.events.some((e) => e.eventStatus === 'PUBLISHED'));
assert.ok(bundle.events.some((e) => e.eventStatus === 'COMPLETED'));
assert.equal(bundle.registrations.length, 31);
assert.equal(bundle.attendanceRecords.length, 27);
assert.equal(bundle.memories.length, 7);

// Check proposal status diversity (draft, open, under_review, approved, implemented)
const proposalStatuses = new Set(
    bundle.posts.filter((p) => p.proposalMeta).map((p) => p.proposalMeta!.status)
);
for (const expected of ['draft', 'open', 'under_review', 'approved', 'implemented']) {
    assert.ok(proposalStatuses.has(expected as any), `Missing proposal status: ${expected}`);
}

// Check >= 2 ratified decisions
const ratifiedDecisions = bundle.posts.filter((p) => p.decisionMeta?.isRecorded);
assert.ok(ratifiedDecisions.length >= 2, 'Expected at least 2 ratified decisions');

// Confirm all IDs start with eval-health- and zero duplicate poll voter UIDs exist
for (const p of bundle.posts) {
    assert.ok(p.id.startsWith(EVAL_HEALTH_ID_PREFIX), `Post ${p.id} missing prefix`);
    if (p.pollMeta?.voterUids) {
        assert.equal(
            new Set(p.pollMeta.voterUids).size,
            p.pollMeta.voterUids.length,
            `Duplicate voterUids in ${p.id}`
        );
    }
}
for (const c of bundle.comments) {
    assert.ok(isEvaluationRecordId(c.id));
    assert.equal(c.testDataTag, EVAL_HEALTH_TAG);
}

// 2. Verify empty source baseline returns 0 / insufficient_data / unavailable without fabricating metrics
const emptyBaseline: CommunityHealthSourceRecords = {
    memberships: [],
    posts: [],
    comments: [],
    events: [],
    registrations: [],
    attendanceRecords: [],
    memories: [],
    collectionsQueried: [
        'communityMemberships',
        'posts',
        'conclaveEvents',
        'conclaveRegistrations',
        'conclaveAttendance',
        'collectiveMemories',
    ],
    warnings: [],
};

const emptyReport30d = computeCommunityHealthReportFromRecords(
    madMaxCommunity,
    emptyBaseline,
    '30d',
    nowMs
);
assert.equal(emptyReport30d.dataCoverage.mockDataExcluded, false);
assert.equal(emptyReport30d.dimensions.participation.totalContributions.value, 0);
assert.equal(emptyReport30d.dimensions.sustainability.membershipChurnRate.status, 'unavailable');
assert.equal(emptyReport30d.dimensions.engagement.pollVoterTurnout.status, 'insufficient_data');

// 3. Build MadMax Wizards source records (existing seeded records + cohort attribution, zero eval warnings)
const evalSourceRecords: CommunityHealthSourceRecords = {
    memberships: [...bundle.memberships, ...bundle.departedMemberships],
    posts: bundle.posts.map((p) => ({
        ...p,
        authorId: bundle.cohortPostAuthorMap[p.id] || p.authorId,
    })),
    comments: bundle.comments.map((c) => ({
        id: c.id,
        targetId: c.targetId,
        authorId: bundle.cohortCommentAuthorMap[c.id] || c.authorId,
        createdAtMs: c.createdAt.getTime(),
    })),
    events: bundle.events,
    registrations: bundle.registrations,
    attendanceRecords: bundle.attendanceRecords,
    memories: bundle.memories,
    collectionsQueried: [
        'communityMemberships',
        'posts',
        'comments',
        'conclaveEvents',
        'conclaveRegistrations',
        'conclaveAttendance',
        'collectiveMemories',
    ],
    warnings: [],
};

for (const period of ['7d', '30d', '90d'] as const) {
    const r = computeCommunityHealthReportFromRecords(
        madMaxCommunity,
        evalSourceRecords,
        period,
        nowMs
    );
    assert.equal(r.dataCoverage.warnings.length, 0, `${period}: expected zero evaluation warnings`);

    // Every single indicator across 7d, 30d, AND 90d must compute cleanly!
    assert.equal(r.dimensions.participation.activeContributorRate.status, 'actual');
    assert.equal(r.dimensions.participation.totalContributions.status, 'actual');
    assert.equal(r.dimensions.participation.conclaveParticipationRate.status, 'actual');
    assert.equal(r.dimensions.participation.conclaveAttendanceRate.status, 'actual');
    assert.equal(r.dimensions.engagement.postInteractionDepth.status, 'estimated');
    assert.equal(r.dimensions.engagement.pollVoterTurnout.status, 'actual');
    assert.equal(r.dimensions.engagement.proposalGovernanceMomentum.status, 'actual');
    assert.equal(r.dimensions.engagement.activityTrendVsPriorPeriod.status, 'actual');
    assert.equal(r.dimensions.belonging.newMemberActivationRate.status, 'actual');
    assert.equal(r.dimensions.belonging.contributionConcentrationIndex.status, 'actual');
    assert.equal(r.dimensions.belonging.zeroContributionMemberRate.status, 'estimated');
    assert.equal(r.dimensions.sustainability.returningContributorRetention.status, 'actual');
    assert.equal(r.dimensions.sustainability.multiPillarParticipationRate.status, 'actual');
    assert.equal(r.dimensions.sustainability.membershipChurnRate.status, 'actual');

    // Confirm Engagement breakdown strip has non-zero counts in ALL 3 windows
    const eb = r.dimensions.engagement.breakdown;
    assert.ok(eb.totalPostsInPeriod > 0, `${period}: totalPostsInPeriod > 0`);
    assert.ok(eb.totalPollsInPeriod > 0, `${period}: totalPollsInPeriod > 0`);
    assert.ok(eb.totalProposalsInPeriod > 0, `${period}: totalProposalsInPeriod > 0`);
    assert.ok(eb.totalConsultationsInPeriod > 0, `${period}: totalConsultationsInPeriod > 0`);
    assert.ok(eb.totalCommentsInPeriod > 0, `${period}: totalCommentsInPeriod > 0`);
    assert.ok(eb.totalLikesOnPeriodPosts > 0, `${period}: totalLikesOnPeriodPosts > 0`);

    console.log(
        JSON.stringify(
            {
                period,
                activeMemberships: r.dataCoverage.recordsObserved.activeMemberships,
                activeContributorRate: r.dimensions.participation.activeContributorRate.formattedValue,
                totalContributions: r.dimensions.participation.totalContributions.formattedValue,
                conclaveCapacityFill: r.dimensions.participation.conclaveParticipationRate.formattedValue,
                conclaveAttendance: r.dimensions.participation.conclaveAttendanceRate.formattedValue,
                engagementStrip: eb,
                postInteractionDepth: r.dimensions.engagement.postInteractionDepth.formattedValue,
                pollVoterTurnout: r.dimensions.engagement.pollVoterTurnout.formattedValue,
                proposalMomentum: r.dimensions.engagement.proposalGovernanceMomentum.formattedValue,
                activityTrend: r.dimensions.engagement.activityTrendVsPriorPeriod.formattedValue,
                newMemberActivation: r.dimensions.belonging.newMemberActivationRate.formattedValue,
                gini: r.dimensions.belonging.contributionConcentrationIndex.formattedValue,
                silentGap: r.dimensions.belonging.zeroContributionMemberRate.formattedValue,
                returningRetention: r.dimensions.sustainability.returningContributorRetention.formattedValue,
                multiPillarRate: r.dimensions.sustainability.multiPillarParticipationRate.formattedValue,
                churnRate: r.dimensions.sustainability.membershipChurnRate.formattedValue,
                insightsCount: r.dimensions.insights.length,
            },
            null,
            2
        )
    );
}

console.log('VERIFICATION_PASSED_ALL_ASSERTIONS');
