import type { Community, CommunityMembership, Post } from '../types';
import { PostType } from '../types';
import type { CollectiveMemory } from './collectiveMemoryTypes';
import type {
    ConclaveAttendanceRecord,
    ConclaveEvent,
    ConclaveRegistration,
} from './conclaveTypes';

export const EVAL_HEALTH_ID_PREFIX = 'eval-health-';
export const EVAL_HEALTH_TAG = 'invox_health_eval_v1';
export const EVAL_HEALTH_VERSION = 'v2';
export const EVAL_MEMBER_UID_PREFIX = 'eval-member-';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface EvaluationMemberProfile {
    uid: string;
    displayName: string;
    username: string;
    joinedDaysAgo: number;
    role: 'admin' | 'member';
}

export interface EvaluationDepartedProfile {
    uid: string;
    displayName: string;
    joinedDaysAgo: number;
    leftDaysAgo: number;
}

/**
 * 10 anonymized active evaluation member cohorts with staggered join dates across 150 days
 * and varied participation profiles (core, steady, light, silent) to test all 4 buckets
 * and Gini distribution without exposing real member identities.
 * (`eval-member-04` and `eval-member-09` intentionally remain 0-action silent members.)
 */
export const EVALUATION_MEMBER_COHORTS: EvaluationMemberProfile[] = [
    { uid: 'eval-member-01', displayName: 'Cohort Member 01', username: 'cohort_01', joinedDaysAgo: 145, role: 'admin' },
    { uid: 'eval-member-02', displayName: 'Cohort Member 02', username: 'cohort_02', joinedDaysAgo: 132, role: 'member' },
    { uid: 'eval-member-03', displayName: 'Cohort Member 03', username: 'cohort_03', joinedDaysAgo: 118, role: 'member' },
    { uid: 'eval-member-04', displayName: 'Cohort Member 04', username: 'cohort_04', joinedDaysAgo: 48, role: 'member' },
    { uid: 'eval-member-05', displayName: 'Cohort Member 05', username: 'cohort_05', joinedDaysAgo: 26, role: 'member' },
    { uid: 'eval-member-06', displayName: 'Cohort Member 06', username: 'cohort_06', joinedDaysAgo: 19, role: 'member' },
    { uid: 'eval-member-07', displayName: 'Cohort Member 07', username: 'cohort_07', joinedDaysAgo: 11, role: 'member' },
    { uid: 'eval-member-08', displayName: 'Cohort Member 08', username: 'cohort_08', joinedDaysAgo: 5, role: 'member' },
    { uid: 'eval-member-09', displayName: 'Cohort Member 09', username: 'cohort_09', joinedDaysAgo: 3, role: 'member' },
    { uid: 'eval-member-10', displayName: 'Cohort Member 10', username: 'cohort_10', joinedDaysAgo: 2, role: 'member' },
];

/**
 * 4 anonymized soft-departed member records (`status: 'left'`, `leftAt`) distributed across
 * 7d, 30d, 90d, and prior-90d windows to validate real membership churn calculations.
 */
export const EVALUATION_DEPARTED_COHORTS: EvaluationDepartedProfile[] = [
    { uid: 'eval-member-left-01', displayName: 'Departed Cohort 01', joinedDaysAgo: 42, leftDaysAgo: 5 },
    { uid: 'eval-member-left-02', displayName: 'Departed Cohort 02', joinedDaysAgo: 68, leftDaysAgo: 18 },
    { uid: 'eval-member-left-03', displayName: 'Departed Cohort 03', joinedDaysAgo: 88, leftDaysAgo: 52 },
    { uid: 'eval-member-left-04', displayName: 'Departed Cohort 04', joinedDaysAgo: 152, leftDaysAgo: 108 },
];

export const makeEvalId = (communityId: string, category: string, slug: string): string =>
    `${EVAL_HEALTH_ID_PREFIX}${communityId}-${category}-${slug}`;

export const isEvaluationRecordId = (id: string | undefined | null): boolean =>
    Boolean(id && id.startsWith(EVAL_HEALTH_ID_PREFIX));

export interface EvaluationDatasetBundle {
    memberships: CommunityMembership[];
    departedMemberships: CommunityMembership[];
    posts: Post[];
    comments: Array<{
        id: string;
        postId: string;
        targetId: string;
        targetType: string;
        type: 'comment';
        communityId: string;
        authorId: string;
        authorName: string;
        authorAvatar: string;
        authorUsername: string;
        text: string;
        createdAt: Date;
        testDataTag: string;
        testDataVersion: string;
    }>;
    events: ConclaveEvent[];
    registrations: ConclaveRegistration[];
    attendanceRecords: ConclaveAttendanceRecord[];
    memories: CollectiveMemory[];
    /**
     * Author attribution map for eval-health posts/comments when evaluating multi-member
     * distributions in memory (necessary because Firestore security rules require
     * client-created posts/comments to have authorId == currentUser.uid).
     */
    cohortPostAuthorMap: Record<string, string>;
    cohortCommentAuthorMap: Record<string, string>;
}

/**
 * Generates a realistic, schema-accurate 180-day evaluation dataset tailored to the target community
 * (covering 7d, 30d, 90d, and the prior 90d baseline `[90d..180d]` for trend & retention calculations).
 * Contains ONLY source records — zero precomputed health metrics.
 */
export const buildEvaluationDatasetBundle = (
    community: Community,
    ownerUid: string,
    ownerDisplayName = 'Community Lead',
    nowMs = Date.now()
): EvaluationDatasetBundle => {
    const cid = community.id;
    const cname = community.name;
    const dateAt = (daysAgo: number): Date => new Date(nowMs - daysAgo * ONE_DAY_MS);
    const isoDateOnly = (daysAgo: number): string => dateAt(daysAgo).toISOString().split('T')[0];

    // 1. Staggered Active & Soft-Departed Memberships
    const memberships: CommunityMembership[] = EVALUATION_MEMBER_COHORTS.map((m) => ({
        id: makeEvalId(cid, 'memship', m.uid),
        userId: m.uid,
        communityId: cid,
        communityName: cname,
        communityAvatarUrl: community.avatarUrl,
        communityCategory: community.category,
        status: 'active',
        role: m.role,
        joinedAt: dateAt(m.joinedDaysAgo),
        updatedAt: dateAt(m.joinedDaysAgo),
    }));

    const departedMemberships: CommunityMembership[] = EVALUATION_DEPARTED_COHORTS.map((m) => ({
        id: makeEvalId(cid, 'memship', m.uid),
        userId: m.uid,
        communityId: cid,
        communityName: cname,
        communityAvatarUrl: community.avatarUrl,
        communityCategory: community.category,
        status: 'left',
        role: 'member',
        joinedAt: dateAt(m.joinedDaysAgo),
        leftAt: dateAt(m.leftDaysAgo),
        updatedAt: dateAt(m.leftDaysAgo),
    }));

    // 2. Collective Voice Posts (18 records across 7d, 30d, 90d, and prior-90d baseline)
    // Discussions (6)
    const pDisc1 = makeEvalId(cid, 'post', 'disc-1'); // 2d
    const pDisc2 = makeEvalId(cid, 'post', 'disc-2'); // 6d
    const pDisc3 = makeEvalId(cid, 'post', 'disc-3'); // 14d
    const pDisc4 = makeEvalId(cid, 'post', 'disc-4'); // 26d
    const pDisc5 = makeEvalId(cid, 'post', 'disc-5'); // 74d
    const pDisc6Prior90 = makeEvalId(cid, 'post', 'disc-6'); // 118d

    // Proposals (6: draft, under_review, open, approved+decision, implemented+decision, prior-90d implemented)
    const pPropDraft = makeEvalId(cid, 'post', 'prop-1'); // 6d (draft)
    const pPropReview = makeEvalId(cid, 'post', 'prop-2'); // 3d (under_review)
    const pPropOpen = makeEvalId(cid, 'post', 'prop-3'); // 16d (open)
    const pPropApproved = makeEvalId(cid, 'post', 'prop-4'); // 36d (approved + decision)
    const pPropImpl = makeEvalId(cid, 'post', 'prop-5'); // 66d (implemented + decision)
    const pPropPrior90 = makeEvalId(cid, 'post', 'prop-6'); // 122d (prior-90d implemented + decision)

    // Polls (4: active 3d, closed 18d, closed 56d, prior-90d 112d)
    const pPoll1 = makeEvalId(cid, 'post', 'poll-1'); // 3d
    const pPoll2 = makeEvalId(cid, 'post', 'poll-2'); // 18d
    const pPoll3 = makeEvalId(cid, 'post', 'poll-3'); // 56d
    const pPoll4Prior90 = makeEvalId(cid, 'post', 'poll-4'); // 112d

    // Consultations (2: open 5d w/ 4 responses, closed 52d w/ 3 responses)
    const pCons1 = makeEvalId(cid, 'post', 'cons-1'); // 5d
    const pCons2 = makeEvalId(cid, 'post', 'cons-2'); // 52d

    const cohortPostAuthorMap: Record<string, string> = {
        [pDisc1]: 'eval-member-01',
        [pDisc2]: 'eval-member-08',
        [pDisc3]: 'eval-member-02',
        [pDisc4]: 'eval-member-05',
        [pDisc5]: 'eval-member-03',
        [pDisc6Prior90]: 'eval-member-01',
        [pPropDraft]: 'eval-member-07',
        [pPropReview]: 'eval-member-01',
        [pPropOpen]: 'eval-member-05',
        [pPropApproved]: ownerUid,
        [pPropImpl]: 'eval-member-02',
        [pPropPrior90]: 'eval-member-03',
        [pPoll1]: ownerUid,
        [pPoll2]: 'eval-member-01',
        [pPoll3]: 'eval-member-02',
        [pPoll4Prior90]: 'eval-member-01',
        [pCons1]: ownerUid,
        [pCons2]: 'eval-member-01',
    };

    const posts: Post[] = [
        // ─── DISCUSSIONS (6) ───
        {
            id: pDisc1,
            communityId: cid,
            communityName: cname,
            communityAvatarUrl: community.avatarUrl,
            communityHandle: community.handle,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `${cname}: Weekly Architecture & Tooling Benchmarks`,
            oneLine: 'Sharing reproducible latency and throughput benchmarks from our latest build sprint.',
            aiSummary: 'Summary of recent architecture experiments and contributor tooling improvements.',
            content: `### Overview\nReviewing build reliability, profiling bottlenecks, and benchmark baselines contributed by members over the past week.\n\n- Reduced cold-start overhead by 22%\n- Shared reusable test fixtures for contributors`,
            tags: ['Discussion', 'Engineering', 'Benchmarks'],
            category: 'Discussion',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'discussion',
            createdAt: dateAt(2),
            updatedAt: dateAt(2),
            stats: { likes: 11, views: 94, comments: 3 },
            likeCount: 11,
            viewCount: 94,
            commentCount: 3,
        },
        {
            id: pDisc2,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Debugging Distributed State Sync Patterns`,
            oneLine: 'Comparing optimistic vs transactional state reconciliation in collaborative feeds.',
            aiSummary: 'Technical exchange on optimistic client caches and deterministic reconciliation.',
            content: `### Discussion Notes\nHow are teams handling offline conflict resolution while maintaining clean audit trails? Share benchmark findings below.`,
            tags: ['Discussion', 'Architecture'],
            category: 'Discussion',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'discussion',
            createdAt: dateAt(6),
            updatedAt: dateAt(6),
            stats: { likes: 8, views: 71, comments: 2 },
            likeCount: 8,
            viewCount: 71,
            commentCount: 2,
        },
        {
            id: pDisc3,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Onboarding Guide: First-Time Contributor Checklist`,
            oneLine: 'Walkthrough for new members joining discussions, polls, and working groups.',
            aiSummary: 'Practical onboarding checklist to lower friction for new community joiners.',
            content: `### Getting Started\nNew members can start by reviewing active proposals, introducing their current focus area, and joining our bi-weekly virtual Conclave.`,
            tags: ['Discussion', 'Onboarding'],
            category: 'Discussion',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'discussion',
            createdAt: dateAt(14),
            updatedAt: dateAt(14),
            stats: { likes: 13, views: 126, comments: 2 },
            likeCount: 13,
            viewCount: 126,
            commentCount: 2,
        },
        {
            id: pDisc4,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Tooling Spotlight: Automated Telemetry Auditing`,
            oneLine: 'Lightweight static checks for validating community event schemas before release.',
            aiSummary: 'Member showcase detailing schema validation helpers across community workflows.',
            content: `### Highlights\nShared our type-safe validation script and CI checks to keep analytics and event payloads clean.`,
            tags: ['Discussion', 'Tooling'],
            category: 'Discussion',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'discussion',
            createdAt: dateAt(26),
            updatedAt: dateAt(26),
            stats: { likes: 9, views: 88, comments: 1 },
            likeCount: 9,
            viewCount: 88,
            commentCount: 1,
        },
        {
            id: pDisc5,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Retrospective: Q1 Knowledge Exchange Formats`,
            oneLine: 'Evaluating workshop formats and peer review cadences from earlier this quarter.',
            aiSummary: 'Community retrospective examining gathering formats and follow-up documentation.',
            content: `### Key Takeaways\nSmall-group critique sessions produced higher follow-through than broad open-floor calls. Let us keep pairing live Conclaves with written Collective Memory recaps.`,
            tags: ['Discussion', 'Retrospective'],
            category: 'Discussion',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'discussion',
            createdAt: dateAt(74),
            updatedAt: dateAt(74),
            stats: { likes: 16, views: 174, comments: 2 },
            likeCount: 16,
            viewCount: 174,
            commentCount: 2,
        },
        {
            id: pDisc6Prior90,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Foundational Norms: Peer Review & Constructive Critique`,
            oneLine: 'Establishing baseline expectations for technical feedback across threads.',
            aiSummary: 'Early quarterly thread defining peer review etiquette and citation standards.',
            content: `### Core Principles\nAlways share reproducible steps when critiquing benchmarks and highlight trade-offs constructively.`,
            tags: ['Discussion', 'Charter'],
            category: 'Discussion',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'discussion',
            createdAt: dateAt(118),
            updatedAt: dateAt(118),
            stats: { likes: 18, views: 210, comments: 2 },
            likeCount: 18,
            viewCount: 210,
            commentCount: 2,
        },

        // ─── PROPOSALS (6: draft, under_review, open, approved+decision, implemented+decision, prior-90d implemented) ───
        {
            id: pPropDraft,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Draft Proposal: Mentorship Pairing Sprint Pilot`,
            oneLine: 'Early-stage draft outlining a 4-week newcomer-to-mentor pairing pilot.',
            aiSummary: 'Draft proposal gathering initial scope suggestions before formal open deliberation.',
            content: `### Draft Outline\nExploring an opt-in 4-week pairing track matching recently joined builders with veteran contributors.`,
            tags: ['Proposal', 'Mentorship', 'Draft'],
            category: 'Proposal',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'proposal',
            createdAt: dateAt(6),
            updatedAt: dateAt(6),
            stats: { likes: 5, views: 44, comments: 1 },
            likeCount: 5,
            viewCount: 44,
            commentCount: 1,
            proposalMeta: {
                status: 'draft',
                category: 'Mentorship',
                summary: 'Pilot 4-week opt-in mentorship pairing for newly joined community members.',
                statusHistory: [
                    {
                        status: 'draft',
                        changedBy: 'eval-member-07',
                        changedByName: 'Cohort Member 07',
                        changedAt: dateAt(6).toISOString(),
                        note: 'Initial draft posted for early feedback.',
                    },
                ],
            },
        },
        {
            id: pPropReview,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Proposal: Shared Benchmark Dataset & Reproducibility Spec`,
            oneLine: 'Standardize how members publish reproducible evaluation artifacts.',
            aiSummary: 'Proposal under administrator review defining lightweight artifact templates.',
            content: `### Specification\nRequires version-pinned dependencies, deterministic seeds, and a concise summary card archived alongside project posts.`,
            tags: ['Proposal', 'Standards'],
            category: 'Proposal',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'proposal',
            createdAt: dateAt(3),
            updatedAt: dateAt(2),
            stats: { likes: 12, views: 102, comments: 1 },
            likeCount: 12,
            viewCount: 102,
            commentCount: 1,
            proposalMeta: {
                status: 'under_review',
                category: 'Standards',
                summary: 'Adopt shared reproducibility template for technical showcases.',
                reviewNotes: 'Under governance council review.',
                statusHistory: [
                    {
                        status: 'open',
                        changedBy: 'eval-member-01',
                        changedByName: 'Cohort Member 01',
                        changedAt: dateAt(3).toISOString(),
                    },
                    {
                        status: 'under_review',
                        changedBy: ownerUid,
                        changedByName: ownerDisplayName,
                        changedAt: dateAt(2).toISOString(),
                        note: 'Advanced to council review following member feedback.',
                    },
                ],
            },
        },
        {
            id: pPropOpen,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Proposal: Bi-Weekly Peer Code & Design Clinic`,
            oneLine: 'Structured 45-minute live clinic where members request focused critique on active work.',
            aiSummary: 'Open proposal establishing a recurring peer review clinic.',
            content: `### Proposal Scope\nRun an alternating Wednesday peer clinic capped at 15 participants per session so every presenter gets actionable feedback.`,
            tags: ['Proposal', 'Conclave', 'PeerReview'],
            category: 'Proposal',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'proposal',
            createdAt: dateAt(16),
            updatedAt: dateAt(15),
            stats: { likes: 9, views: 79, comments: 2 },
            likeCount: 9,
            viewCount: 79,
            commentCount: 2,
            proposalMeta: {
                status: 'open',
                category: 'Programs',
                summary: 'Launch bi-weekly 45-minute peer critique clinics.',
                discussionClosingDate: dateAt(-7).toISOString(),
                statusHistory: [
                    {
                        status: 'open',
                        changedBy: 'eval-member-05',
                        changedByName: 'Cohort Member 05',
                        changedAt: dateAt(16).toISOString(),
                        note: 'Opened for initial community deliberation.',
                    },
                ],
            },
        },
        {
            id: pPropApproved,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Decision: Monthly Collective Memory Archive Curation`,
            oneLine: 'Ratified commitment to archive every Conclave outcome and milestone monthly.',
            aiSummary: 'Ratified decision assigning rotating archive curators after each Conclave.',
            content: `### Ratified Resolution\nEach completed Conclave will receive a structured Collective Memory entry within 7 days of completion.`,
            tags: ['Proposal', 'Decision', 'Memory'],
            category: 'Proposal',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'proposal',
            createdAt: dateAt(36),
            updatedAt: dateAt(32),
            stats: { likes: 15, views: 148, comments: 2 },
            likeCount: 15,
            viewCount: 148,
            commentCount: 2,
            proposalMeta: {
                status: 'approved',
                category: 'Governance',
                summary: 'Establish monthly Collective Memory curation after each Conclave.',
                statusHistory: [
                    {
                        status: 'open',
                        changedBy: ownerUid,
                        changedByName: ownerDisplayName,
                        changedAt: dateAt(36).toISOString(),
                    },
                    {
                        status: 'approved',
                        changedBy: ownerUid,
                        changedByName: ownerDisplayName,
                        changedAt: dateAt(32).toISOString(),
                        note: 'Approved by community consensus.',
                    },
                ],
            },
            decisionMeta: {
                isRecorded: true,
                outcome: 'Every completed Conclave is documented in Collective Memory within 7 days.',
                responsibleAuthority: 'Community Moderators & Rotating Curators',
                decisionDate: dateAt(32).toISOString(),
                implementationProgress: 80,
            },
        },
        {
            id: pPropImpl,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Decision: Transparent Moderation & Onboarding Charter`,
            oneLine: 'Enacted clear moderation guidelines and newcomer welcome workflows.',
            aiSummary: 'Implemented charter clarifying community participation standards.',
            content: `### Implemented Outcome\nPublished updated conduct standards and newcomer onboarding guide inside Collective Overview.`,
            tags: ['Proposal', 'Decision', 'Charter'],
            category: 'Proposal',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'proposal',
            createdAt: dateAt(66),
            updatedAt: dateAt(58),
            stats: { likes: 21, views: 196, comments: 1 },
            likeCount: 21,
            viewCount: 196,
            commentCount: 1,
            proposalMeta: {
                status: 'implemented',
                category: 'Charter',
                summary: 'Publish transparent moderation and onboarding charter.',
                statusHistory: [
                    {
                        status: 'open',
                        changedBy: 'eval-member-02',
                        changedByName: 'Cohort Member 02',
                        changedAt: dateAt(66).toISOString(),
                    },
                    {
                        status: 'implemented',
                        changedBy: ownerUid,
                        changedByName: ownerDisplayName,
                        changedAt: dateAt(58).toISOString(),
                    },
                ],
            },
            decisionMeta: {
                isRecorded: true,
                outcome: 'Onboarding and conduct guidelines enacted and published.',
                responsibleAuthority: 'Community Council',
                decisionDate: dateAt(58).toISOString(),
                implementationProgress: 100,
            },
        },
        {
            id: pPropPrior90,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Decision: Open-Source Benchmark Licensing Standard`,
            oneLine: 'Ratified Apache-2.0 / MIT licensing baseline for shared collective templates.',
            aiSummary: 'Implemented baseline open-source license policy from the prior quarter.',
            content: `### Implemented Standard\nAll shared evaluation harnesses contributed to the community repository default to Apache-2.0 or MIT.`,
            tags: ['Proposal', 'Decision', 'Licensing'],
            category: 'Proposal',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'proposal',
            createdAt: dateAt(122),
            updatedAt: dateAt(110),
            stats: { likes: 24, views: 230, comments: 1 },
            likeCount: 24,
            viewCount: 230,
            commentCount: 1,
            proposalMeta: {
                status: 'implemented',
                category: 'Standards',
                summary: 'Adopt permissive open-source licensing for collective benchmark scripts.',
                statusHistory: [
                    {
                        status: 'open',
                        changedBy: 'eval-member-03',
                        changedByName: 'Cohort Member 03',
                        changedAt: dateAt(122).toISOString(),
                    },
                    {
                        status: 'implemented',
                        changedBy: ownerUid,
                        changedByName: ownerDisplayName,
                        changedAt: dateAt(110).toISOString(),
                    },
                ],
            },
            decisionMeta: {
                isRecorded: true,
                outcome: 'Permissive open-source licensing ratified for all shared tooling.',
                responsibleAuthority: 'Stewards Council',
                decisionDate: dateAt(110).toISOString(),
                implementationProgress: 100,
            },
        },

        // ─── POLLS (4: 7d active, 30d closed, 90d closed, prior-90d closed) ───
        {
            id: pPoll1,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Poll: Focus Theme for Next Month's Virtual Conclave`,
            oneLine: 'Select the primary deep-dive topic for our upcoming gathering.',
            aiSummary: 'Active community poll prioritizing next Conclave theme.',
            content: `Vote for the technical track you would most like featured in our upcoming virtual Conclave session.`,
            tags: ['Poll', 'Conclave'],
            category: 'Poll',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Poll,
            voiceType: 'poll',
            createdAt: dateAt(3),
            updatedAt: dateAt(1),
            stats: { likes: 7, views: 84, comments: 1 },
            likeCount: 7,
            viewCount: 84,
            commentCount: 1,
            pollMeta: {
                options: [
                    { id: 'opt_1', text: 'Production Reliability & Observability', votes: 3, voteCount: 3 },
                    { id: 'opt_2', text: 'Applied AI Systems & Evaluations', votes: 2, voteCount: 2 },
                    { id: 'opt_3', text: 'Architecture Live Critiques', votes: 1, voteCount: 1 },
                ],
                totalVotes: 6,
                expiresAt: dateAt(-6).toISOString(),
                voterUids: [
                    ownerUid,
                    'eval-member-01',
                    'eval-member-02',
                    'eval-member-03',
                    'eval-member-05',
                    'eval-member-08',
                ],
                votesByOption: {
                    opt_1: [ownerUid, 'eval-member-01', 'eval-member-05'],
                    opt_2: ['eval-member-02', 'eval-member-08'],
                    opt_3: ['eval-member-03'],
                },
            },
        },
        {
            id: pPoll2,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Poll: Preferred Cadence for Working Group Demos`,
            oneLine: 'Determining ideal recurring schedule for community show-and-tell sessions.',
            aiSummary: 'Completed poll selecting bi-weekly demo cadence.',
            content: `Closed community poll evaluating preferred demo schedule across timezones.`,
            tags: ['Poll', 'Schedule'],
            category: 'Poll',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Poll,
            voiceType: 'poll',
            createdAt: dateAt(18),
            updatedAt: dateAt(12),
            stats: { likes: 9, views: 108, comments: 0 },
            likeCount: 9,
            viewCount: 108,
            commentCount: 0,
            pollMeta: {
                options: [
                    { id: 'opt_a', text: 'Bi-weekly (60 min)', votes: 4, voteCount: 4 },
                    { id: 'opt_b', text: 'Monthly Summit (90 min)', votes: 2, voteCount: 2 },
                    { id: 'opt_c', text: 'Async Video Threads Only', votes: 1, voteCount: 1 },
                ],
                totalVotes: 7,
                expiresAt: dateAt(10).toISOString(),
                voterUids: [
                    ownerUid,
                    'eval-member-01',
                    'eval-member-02',
                    'eval-member-03',
                    'eval-member-05',
                    'eval-member-06',
                    'eval-member-07',
                ],
                votesByOption: {
                    opt_a: [ownerUid, 'eval-member-01', 'eval-member-02', 'eval-member-06'],
                    opt_b: ['eval-member-03', 'eval-member-07'],
                    opt_c: ['eval-member-05'],
                },
            },
        },
        {
            id: pPoll3,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Poll: Documentation & Benchmark Template Format`,
            oneLine: 'Choosing preferred artifact format for Collective Memory & technical recaps.',
            aiSummary: 'Completed poll adopting concise Markdown RFC cards for archive summaries.',
            content: `Members voted on the default structure for archiving session outcomes and technical notes.`,
            tags: ['Poll', 'Documentation'],
            category: 'Poll',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Poll,
            voiceType: 'poll',
            createdAt: dateAt(56),
            updatedAt: dateAt(46),
            stats: { likes: 10, views: 115, comments: 1 },
            likeCount: 10,
            viewCount: 115,
            commentCount: 1,
            pollMeta: {
                options: [
                    { id: 'opt_fmt_1', text: 'Concise Markdown RFC Cards', votes: 3, voteCount: 3 },
                    { id: 'opt_fmt_2', text: 'Recorded Video + Key Takeaways', votes: 2, voteCount: 2 },
                ],
                totalVotes: 5,
                expiresAt: dateAt(42).toISOString(),
                voterUids: [
                    ownerUid,
                    'eval-member-01',
                    'eval-member-02',
                    'eval-member-03',
                    'eval-member-05',
                ],
                votesByOption: {
                    opt_fmt_1: [ownerUid, 'eval-member-01', 'eval-member-03'],
                    opt_fmt_2: ['eval-member-02', 'eval-member-05'],
                },
            },
        },
        {
            id: pPoll4Prior90,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Poll: Q1 Kickoff Timezone Rotation`,
            oneLine: 'Closed prior-quarter poll selecting rotating UTC session slots.',
            aiSummary: 'Closed poll establishing alternating morning/evening UTC slots.',
            content: `Historical quarterly poll optimizing Conclave accessibility across global member timezones.`,
            tags: ['Poll', 'Timezone'],
            category: 'Poll',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Poll,
            voiceType: 'poll',
            createdAt: dateAt(112),
            updatedAt: dateAt(105),
            stats: { likes: 11, views: 130, comments: 0 },
            likeCount: 11,
            viewCount: 130,
            commentCount: 0,
            pollMeta: {
                options: [
                    { id: 'opt_tz_1', text: 'Rotate Americas / EMEA / APAC', votes: 3, voteCount: 3 },
                    { id: 'opt_tz_2', text: 'Fixed 16:00 UTC', votes: 1, voteCount: 1 },
                ],
                totalVotes: 4,
                expiresAt: dateAt(98).toISOString(),
                voterUids: [
                    ownerUid,
                    'eval-member-01',
                    'eval-member-02',
                    'eval-member-03',
                ],
                votesByOption: {
                    opt_tz_1: [ownerUid, 'eval-member-01', 'eval-member-02'],
                    opt_tz_2: ['eval-member-03'],
                },
            },
        },

        // ─── CONSULTATIONS (2) ───
        {
            id: pCons1,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Consultation: Improving First-Week Member Onboarding`,
            oneLine: 'Gathering member perspectives on how to make newcomers feel welcomed quickly.',
            aiSummary: 'Active stakeholder consultation collecting actionable onboarding improvements.',
            content: `### Purpose\nWe want every new member joining ${cname} to discover relevant conversations within their first 48 hours.`,
            tags: ['Consultation', 'Inclusion'],
            category: 'Consultation',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'consultation',
            createdAt: dateAt(5),
            updatedAt: dateAt(1),
            stats: { likes: 8, views: 74, comments: 0 },
            likeCount: 8,
            viewCount: 74,
            commentCount: 0,
            consultationMeta: {
                prompts: [
                    'What helped you most during your first week in this community?',
                    'What recurring ritual or starter prompt would lower hesitation to post?',
                ],
                deadline: dateAt(-7).toISOString(),
                isClosed: false,
                responseCount: 4,
                responses: [
                    {
                        id: makeEvalId(cid, 'cresp', '1'),
                        userId: 'eval-member-01',
                        userName: 'Cohort Member 01',
                        submittedAt: dateAt(4).toISOString(),
                        answers: [
                            { promptIndex: 0, promptText: 'First week', answerText: 'Attending a small virtual Conclave made names familiar quickly.' },
                            { promptIndex: 1, promptText: 'Starter prompt', answerText: 'Weekly quick-vote polls give newcomers a low-friction first action.' },
                        ],
                    },
                    {
                        id: makeEvalId(cid, 'cresp', '2'),
                        userId: 'eval-member-05',
                        userName: 'Cohort Member 05',
                        submittedAt: dateAt(3).toISOString(),
                        answers: [
                            { promptIndex: 0, promptText: 'First week', answerText: 'Reading pinned Collective Memory milestones provided immediate context.' },
                            { promptIndex: 1, promptText: 'Starter prompt', answerText: 'A dedicated newcomer question thread.' },
                        ],
                    },
                    {
                        id: makeEvalId(cid, 'cresp', '3'),
                        userId: 'eval-member-08',
                        userName: 'Cohort Member 08',
                        submittedAt: dateAt(2).toISOString(),
                        answers: [
                            { promptIndex: 0, promptText: 'First week', answerText: 'Clear project tags helped me find peers in my domain.' },
                            { promptIndex: 1, promptText: 'Starter prompt', answerText: 'Bi-weekly intro spotlights.' },
                        ],
                    },
                    {
                        id: makeEvalId(cid, 'cresp', '4'),
                        userId: 'eval-member-10',
                        userName: 'Cohort Member 10',
                        submittedAt: dateAt(1).toISOString(),
                        answers: [
                            { promptIndex: 0, promptText: 'First week', answerText: 'The guidelines overview was crisp and approachable.' },
                            { promptIndex: 1, promptText: 'Starter prompt', answerText: 'Short async Q&A threads.' },
                        ],
                    },
                ],
            },
        },
        {
            id: pCons2,
            communityId: cid,
            communityName: cname,
            authorId: ownerUid,
            author: { name: ownerDisplayName, avatarUrl: '', username: 'lead', isVerified: true },
            title: `Consultation: Q1 Working Group Charter Review`,
            oneLine: 'Concluded consultation capturing member priorities for quarterly initiatives.',
            aiSummary: 'Concluded consultation informing Q1 community priorities.',
            content: `### Summary\nMember feedback highlighted hands-on technical workshops and concise written recaps as top priorities.`,
            tags: ['Consultation', 'Governance'],
            category: 'Consultation',
            domain: community.category || 'Technology',
            visibility: 'public',
            type: PostType.Thread,
            voiceType: 'consultation',
            createdAt: dateAt(52),
            updatedAt: dateAt(40),
            stats: { likes: 12, views: 122, comments: 0 },
            likeCount: 12,
            viewCount: 122,
            commentCount: 0,
            consultationMeta: {
                prompts: ['Which collective initiative deserves priority focus next quarter?'],
                deadline: dateAt(40).toISOString(),
                isClosed: true,
                summaryOutcome: 'Members prioritized live architecture clinics and documented Collective Memory recaps.',
                closedAt: dateAt(40).toISOString(),
                closedBy: ownerUid,
                responseCount: 3,
                responses: [
                    {
                        id: makeEvalId(cid, 'cresp', '5'),
                        userId: 'eval-member-02',
                        userName: 'Cohort Member 02',
                        submittedAt: dateAt(49).toISOString(),
                        answers: [{ promptIndex: 0, promptText: 'Priority', answerText: 'Live architecture reviews.' }],
                    },
                    {
                        id: makeEvalId(cid, 'cresp', '6'),
                        userId: 'eval-member-03',
                        userName: 'Cohort Member 03',
                        submittedAt: dateAt(47).toISOString(),
                        answers: [{ promptIndex: 0, promptText: 'Priority', answerText: 'Shared testing templates.' }],
                    },
                    {
                        id: makeEvalId(cid, 'cresp', '7'),
                        userId: ownerUid,
                        userName: ownerDisplayName,
                        submittedAt: dateAt(45).toISOString(),
                        answers: [{ promptIndex: 0, promptText: 'Priority', answerText: 'Consistent post-event memory archiving.' }],
                    },
                ],
            },
        },
    ];

    // 3. Comments (20 records across 7d, 30d, 90d, and prior-90d baseline)
    const commentSpecs: Array<{ slug: string; postId: string; authorCohortUid: string; daysAgo: number; text: string }> = [
        { slug: 'c1', postId: pDisc1, authorCohortUid: 'eval-member-02', daysAgo: 2, text: 'The cold-start reduction matches what we observed after trimming duplicate listeners.' },
        { slug: 'c2', postId: pDisc1, authorCohortUid: 'eval-member-06', daysAgo: 1, text: 'Helpful benchmark breakdown — I will test this fixture against our staging pipeline.' },
        { slug: 'c3', postId: pDisc1, authorCohortUid: ownerUid, daysAgo: 1, text: 'Added reproducible baseline numbers to the thread notes.' },
        { slug: 'c4', postId: pDisc2, authorCohortUid: 'eval-member-05', daysAgo: 5, text: 'Optimistic UI paired with deterministic merge keys has eliminated flicker on our end.' },
        { slug: 'c5', postId: pDisc2, authorCohortUid: 'eval-member-07', daysAgo: 4, text: 'Would love a quick live walkthrough of the conflict test harness next Conclave.' },
        { slug: 'c6', postId: pPropDraft, authorCohortUid: 'eval-member-01', daysAgo: 5, text: 'Great pilot concept — keeping cohorts to 4 weeks makes commitment realistic.' },
        { slug: 'c7', postId: pPropReview, authorCohortUid: 'eval-member-02', daysAgo: 2, text: 'Reproducibility checklist is concise enough that members will actually complete it.' },
        { slug: 'c8', postId: pPoll1, authorCohortUid: 'eval-member-07', daysAgo: 2, text: 'Observability & reliability clinics would pair well with our recent benchmarks.' },
        { slug: 'c9', postId: pDisc3, authorCohortUid: 'eval-member-01', daysAgo: 12, text: 'Updated the starter links so new joiners can find active polls immediately.' },
        { slug: 'c10', postId: pDisc3, authorCohortUid: 'eval-member-05', daysAgo: 10, text: 'This checklist would have saved me 20 minutes on day one — glad to see it documented.' },
        { slug: 'c11', postId: pPropOpen, authorCohortUid: 'eval-member-01', daysAgo: 15, text: 'Strong support for a 45-minute cap so sessions stay focused.' },
        { slug: 'c12', postId: pPropOpen, authorCohortUid: 'eval-member-03', daysAgo: 14, text: 'Rotating moderators bi-weekly will keep facilitation sustainable.' },
        { slug: 'c13', postId: pDisc4, authorCohortUid: 'eval-member-06', daysAgo: 23, text: 'Integrated the schema verifier into pre-push checks cleanly.' },
        { slug: 'c14', postId: pPropApproved, authorCohortUid: 'eval-member-01', daysAgo: 35, text: 'Confirmed rotating curator schedule for upcoming Conclaves.' },
        { slug: 'c15', postId: pPropApproved, authorCohortUid: 'eval-member-03', daysAgo: 33, text: 'Archiving summaries within 7 days keeps momentum high.' },
        { slug: 'c16', postId: pPoll3, authorCohortUid: 'eval-member-02', daysAgo: 50, text: 'Markdown RFC cards remain easy to scan months later.' },
        { slug: 'c17', postId: pPropImpl, authorCohortUid: ownerUid, daysAgo: 60, text: 'Charter guidelines are now live on Overview & Identity.' },
        { slug: 'c18', postId: pDisc5, authorCohortUid: 'eval-member-02', daysAgo: 70, text: 'Breakout sessions clearly drove deeper technical follow-up.' },
        { slug: 'c19', postId: pDisc6Prior90, authorCohortUid: 'eval-member-01', daysAgo: 115, text: 'Logged these peer review norms as our baseline standard.' },
        { slug: 'c20', postId: pPropPrior90, authorCohortUid: 'eval-member-02', daysAgo: 112, text: 'Standardizing permissive licensing removed ambiguity for contributors.' },
    ];

    const cohortCommentAuthorMap: Record<string, string> = {};
    const comments = commentSpecs.map((spec) => {
        const id = makeEvalId(cid, 'cmt', spec.slug);
        cohortCommentAuthorMap[id] = spec.authorCohortUid;
        return {
            id,
            postId: spec.postId,
            targetId: spec.postId,
            targetType: 'Thread',
            type: 'comment' as const,
            communityId: cid,
            authorId: ownerUid,
            authorName: ownerDisplayName,
            authorAvatar: '',
            authorUsername: 'lead',
            text: spec.text,
            createdAt: dateAt(spec.daysAgo),
            testDataTag: EVAL_HEALTH_TAG,
            testDataVersion: EVAL_HEALTH_VERSION,
        };
    });

    // 4. Conclave Events (4 completed across 7d/30d/90d/prior-90d + 1 upcoming published gathering)
    const evRecentId = makeEvalId(cid, 'conclave', '1');
    const evMidId = makeEvalId(cid, 'conclave', '2');
    const evQuarterId = makeEvalId(cid, 'conclave', '3');
    const evPrior90Id = makeEvalId(cid, 'conclave', '4');
    const evUpcomingId = makeEvalId(cid, 'conclave', '5');

    const events: ConclaveEvent[] = [
        {
            id: evRecentId,
            communityId: cid,
            communityName: cname,
            communityAvatarUrl: community.avatarUrl,
            title: `${cname} Live Architecture Roundtable`,
            description: 'Focused working session reviewing recent member prototypes and reliability patterns.',
            category: community.category || 'Engineering',
            eventType: 'VIRTUAL',
            organizerUid: ownerUid,
            organizerInfo: { uid: ownerUid, displayName: ownerDisplayName, role: 'Organizer' },
            startDate: isoDateOnly(4),
            startTime: '17:00',
            startTimestamp: dateAt(4).getTime(),
            endDate: isoDateOnly(4),
            endTime: '18:15',
            endTimestamp: dateAt(4).getTime() + 75 * 60 * 1000,
            timezone: 'UTC',
            capacity: 20,
            registeredCount: 8,
            eventStatus: 'COMPLETED',
            registrationStatus: 'CLOSED',
            accessPolicy: 'ALL_MEMBERS',
            virtual: {
                platform: 'Google Meet',
                meetingUrl: 'https://meet.google.com',
                accessInstructions: 'Evaluation sample Conclave session.',
            },
            createdAt: dateAt(12),
            updatedAt: dateAt(4),
        },
        {
            id: evMidId,
            communityId: cid,
            communityName: cname,
            communityAvatarUrl: community.avatarUrl,
            title: `${cname} Monthly Peer Demo Conclave`,
            description: 'Member show-and-tell featuring live technical demos and peer feedback.',
            category: community.category || 'Engineering',
            eventType: 'ONSITE',
            organizerUid: ownerUid,
            organizerInfo: { uid: ownerUid, displayName: ownerDisplayName, role: 'Organizer' },
            startDate: isoDateOnly(19),
            startTime: '18:00',
            startTimestamp: dateAt(19).getTime(),
            endDate: isoDateOnly(19),
            endTime: '20:00',
            endTimestamp: dateAt(19).getTime() + 120 * 60 * 1000,
            timezone: 'UTC',
            capacity: 25,
            registeredCount: 7,
            eventStatus: 'COMPLETED',
            registrationStatus: 'CLOSED',
            accessPolicy: 'ALL_MEMBERS',
            onSite: {
                venueName: 'Collective Guild Hall',
                address: 'Innovation District',
                city: 'Bengaluru',
            },
            createdAt: dateAt(28),
            updatedAt: dateAt(19),
        },
        {
            id: evQuarterId,
            communityId: cid,
            communityName: cname,
            communityAvatarUrl: community.avatarUrl,
            title: `${cname} Quarterly Kickoff & Governance Summit`,
            description: 'Quarterly alignment summit setting technical priorities and mentorship circles.',
            category: community.category || 'Governance',
            eventType: 'VIRTUAL',
            organizerUid: ownerUid,
            organizerInfo: { uid: ownerUid, displayName: ownerDisplayName, role: 'Organizer' },
            startDate: isoDateOnly(48),
            startTime: '16:00',
            startTimestamp: dateAt(48).getTime(),
            endDate: isoDateOnly(48),
            endTime: '17:30',
            endTimestamp: dateAt(48).getTime() + 90 * 60 * 1000,
            timezone: 'UTC',
            capacity: 30,
            registeredCount: 7,
            eventStatus: 'COMPLETED',
            registrationStatus: 'CLOSED',
            accessPolicy: 'ALL_MEMBERS',
            virtual: {
                platform: 'Zoom',
                meetingUrl: 'https://zoom.us',
                accessInstructions: 'Quarterly kickoff Conclave sample.',
            },
            createdAt: dateAt(60),
            updatedAt: dateAt(48),
        },
        {
            id: evPrior90Id,
            communityId: cid,
            communityName: cname,
            communityAvatarUrl: community.avatarUrl,
            title: `${cname} Founding Systems Workshop`,
            description: 'Prior-quarter workshop aligning engineering benchmarks and contributor workflows.',
            category: community.category || 'Engineering',
            eventType: 'VIRTUAL',
            organizerUid: ownerUid,
            organizerInfo: { uid: ownerUid, displayName: ownerDisplayName, role: 'Organizer' },
            startDate: isoDateOnly(115),
            startTime: '16:30',
            startTimestamp: dateAt(115).getTime(),
            endDate: isoDateOnly(115),
            endTime: '18:00',
            endTimestamp: dateAt(115).getTime() + 90 * 60 * 1000,
            timezone: 'UTC',
            capacity: 25,
            registeredCount: 6,
            eventStatus: 'COMPLETED',
            registrationStatus: 'CLOSED',
            accessPolicy: 'ALL_MEMBERS',
            virtual: {
                platform: 'Google Meet',
                meetingUrl: 'https://meet.google.com',
                accessInstructions: 'Prior-quarter baseline Conclave.',
            },
            createdAt: dateAt(126),
            updatedAt: dateAt(115),
        },
        {
            id: evUpcomingId,
            communityId: cid,
            communityName: cname,
            communityAvatarUrl: community.avatarUrl,
            title: `${cname} Upcoming Observability & Reliability Clinic`,
            description: 'Upcoming interactive Conclave reviewing telemetry instrumentation and live reliability diagnostics.',
            category: community.category || 'Engineering',
            eventType: 'VIRTUAL',
            organizerUid: ownerUid,
            organizerInfo: { uid: ownerUid, displayName: ownerDisplayName, role: 'Organizer' },
            startDate: isoDateOnly(-6),
            startTime: '17:00',
            startTimestamp: dateAt(-6).getTime(),
            endDate: isoDateOnly(-6),
            endTime: '18:30',
            endTimestamp: dateAt(-6).getTime() + 90 * 60 * 1000,
            timezone: 'UTC',
            capacity: 25,
            registeredCount: 4,
            eventStatus: 'PUBLISHED',
            registrationStatus: 'OPEN',
            accessPolicy: 'ALL_MEMBERS',
            virtual: {
                platform: 'Google Meet',
                meetingUrl: 'https://meet.google.com',
                accessInstructions: 'Upcoming Conclave session open for registration.',
            },
            createdAt: dateAt(3),
            updatedAt: dateAt(1),
        },
    ];

    // 5. Registrations & Verified Attendance
    const regSpecs: Array<{
        eventId: string;
        uid: string;
        daysAgo: number;
        attendance: 'ATTENDED' | 'NO_SHOW' | 'REGISTERED';
        markedDaysAgo?: number;
    }> = [
        // Recent Conclave (4d ago): 8 registered -> 6 attended, 2 no-show (75% attendance)
        { eventId: evRecentId, uid: ownerUid, daysAgo: 6, attendance: 'ATTENDED', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-01', daysAgo: 6, attendance: 'ATTENDED', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-02', daysAgo: 6, attendance: 'ATTENDED', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-03', daysAgo: 5, attendance: 'ATTENDED', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-05', daysAgo: 5, attendance: 'ATTENDED', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-06', daysAgo: 5, attendance: 'NO_SHOW', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-08', daysAgo: 5, attendance: 'ATTENDED', markedDaysAgo: 4 },
        { eventId: evRecentId, uid: 'eval-member-10', daysAgo: 4, attendance: 'NO_SHOW', markedDaysAgo: 4 },

        // Mid Conclave (19d ago): 7 registered -> 6 attended, 1 no-show
        { eventId: evMidId, uid: ownerUid, daysAgo: 23, attendance: 'ATTENDED', markedDaysAgo: 19 },
        { eventId: evMidId, uid: 'eval-member-01', daysAgo: 22, attendance: 'ATTENDED', markedDaysAgo: 19 },
        { eventId: evMidId, uid: 'eval-member-02', daysAgo: 22, attendance: 'ATTENDED', markedDaysAgo: 19 },
        { eventId: evMidId, uid: 'eval-member-03', daysAgo: 21, attendance: 'ATTENDED', markedDaysAgo: 19 },
        { eventId: evMidId, uid: 'eval-member-05', daysAgo: 21, attendance: 'NO_SHOW', markedDaysAgo: 19 },
        { eventId: evMidId, uid: 'eval-member-06', daysAgo: 20, attendance: 'ATTENDED', markedDaysAgo: 19 },
        { eventId: evMidId, uid: 'eval-member-07', daysAgo: 20, attendance: 'ATTENDED', markedDaysAgo: 19 },

        // Quarterly Conclave (48d ago): 7 registered -> 5 attended, 2 no-show
        { eventId: evQuarterId, uid: ownerUid, daysAgo: 55, attendance: 'ATTENDED', markedDaysAgo: 48 },
        { eventId: evQuarterId, uid: 'eval-member-01', daysAgo: 54, attendance: 'ATTENDED', markedDaysAgo: 48 },
        { eventId: evQuarterId, uid: 'eval-member-02', daysAgo: 53, attendance: 'ATTENDED', markedDaysAgo: 48 },
        { eventId: evQuarterId, uid: 'eval-member-03', daysAgo: 52, attendance: 'NO_SHOW', markedDaysAgo: 48 },
        { eventId: evQuarterId, uid: 'eval-member-05', daysAgo: 50, attendance: 'ATTENDED', markedDaysAgo: 48 },
        { eventId: evQuarterId, uid: 'eval-member-06', daysAgo: 49, attendance: 'NO_SHOW', markedDaysAgo: 48 },
        { eventId: evQuarterId, uid: 'eval-member-07', daysAgo: 49, attendance: 'ATTENDED', markedDaysAgo: 48 },

        // Prior-90d Conclave (115d ago): 6 registered -> 5 attended, 1 no-show
        { eventId: evPrior90Id, uid: ownerUid, daysAgo: 120, attendance: 'ATTENDED', markedDaysAgo: 115 },
        { eventId: evPrior90Id, uid: 'eval-member-01', daysAgo: 119, attendance: 'ATTENDED', markedDaysAgo: 115 },
        { eventId: evPrior90Id, uid: 'eval-member-02', daysAgo: 118, attendance: 'ATTENDED', markedDaysAgo: 115 },
        { eventId: evPrior90Id, uid: 'eval-member-03', daysAgo: 117, attendance: 'ATTENDED', markedDaysAgo: 115 },
        { eventId: evPrior90Id, uid: 'eval-member-left-04', daysAgo: 117, attendance: 'NO_SHOW', markedDaysAgo: 115 },
        { eventId: evPrior90Id, uid: 'eval-member-01', daysAgo: 116, attendance: 'ATTENDED', markedDaysAgo: 115 },

        // Upcoming Published Conclave (+6d): 4 advance registrations (not yet attended)
        { eventId: evUpcomingId, uid: ownerUid, daysAgo: 2, attendance: 'REGISTERED' },
        { eventId: evUpcomingId, uid: 'eval-member-01', daysAgo: 2, attendance: 'REGISTERED' },
        { eventId: evUpcomingId, uid: 'eval-member-05', daysAgo: 1, attendance: 'REGISTERED' },
        { eventId: evUpcomingId, uid: 'eval-member-08', daysAgo: 1, attendance: 'REGISTERED' },
    ];

    // Deduplicate (eventId, uid) cleanly just in case
    const seenEventUser = new Set<string>();
    const dedupedRegSpecs = regSpecs.filter((spec) => {
        const key = `${spec.eventId}::${spec.uid}`;
        if (seenEventUser.has(key)) return false;
        seenEventUser.add(key);
        return true;
    });

    const registrations: ConclaveRegistration[] = dedupedRegSpecs.map((spec, idx) => ({
        id: makeEvalId(cid, 'reg', `${idx + 1}`),
        eventId: spec.eventId,
        communityId: cid,
        userId: spec.uid,
        userInfo: {
            uid: spec.uid,
            displayName: spec.uid === ownerUid ? ownerDisplayName : 'Cohort Participant',
        },
        status: 'CONFIRMED',
        attendanceStatus: spec.attendance,
        registeredAt: dateAt(spec.daysAgo),
    }));

    const attendanceRecords: ConclaveAttendanceRecord[] = dedupedRegSpecs
        .filter((spec) => spec.attendance === 'ATTENDED' || spec.attendance === 'NO_SHOW')
        .map((spec, idx) => ({
            id: makeEvalId(cid, 'att', `${idx + 1}`),
            eventId: spec.eventId,
            communityId: cid,
            userId: spec.uid,
            attendanceStatus: spec.attendance,
            markedByUid: ownerUid,
            markedAt: dateAt(spec.markedDaysAgo ?? spec.daysAgo),
        }));

    // 6. Collective Memories (7 published memories across all 6 categories & 180 days; none pinned/featured)
    const memorySpecs: Array<{
        slug: string;
        title: string;
        description: string;
        category: CollectiveMemory['category'];
        significance: CollectiveMemory['significance'];
        daysAgo: number;
        creatorUid: string;
        relatedConclaveId?: string;
    }> = [
        {
            slug: 'm1',
            title: 'Architecture Roundtable Synthesis Published',
            description: 'Captured key latency trade-offs and shared benchmarking setups from our virtual roundtable.',
            category: 'gatherings',
            significance: 'standard',
            daysAgo: 3,
            creatorUid: 'eval-member-01',
            relatedConclaveId: evRecentId,
        },
        {
            slug: 'm2',
            title: 'Member Open-Source Utility Reaches 1.0 Release',
            description: 'Recognized collective contributors who shipped our shared telemetry validation toolkit.',
            category: 'achievements',
            significance: 'major',
            daysAgo: 12,
            creatorUid: 'eval-member-02',
        },
        {
            slug: 'm3',
            title: 'Monthly Memory Curation Protocol Enacted',
            description: 'Archived the formal resolution ensuring every Conclave concludes with a permanent community record.',
            category: 'decisions',
            significance: 'major',
            daysAgo: 29,
            creatorUid: ownerUid,
        },
        {
            slug: 'm4',
            title: 'Bi-Weekly Peer Demo Tradition Established',
            description: 'Documented our ongoing demo-and-critique ritual adopted across the engineering working groups.',
            category: 'traditions',
            significance: 'standard',
            daysAgo: 45,
            creatorUid: 'eval-member-03',
            relatedConclaveId: evMidId,
        },
        {
            slug: 'm5',
            title: 'Quarterly Alignment Summit Completed',
            description: 'Summary of Q1 roadmap commitments and cross-group mentorship pairings from the summit.',
            category: 'milestones',
            significance: 'pivotal',
            daysAgo: 48,
            creatorUid: 'eval-member-01',
            relatedConclaveId: evQuarterId,
        },
        {
            slug: 'm6',
            title: 'Newcomer Onboarding Playbook Contributed',
            description: 'Archived the member-written onboarding playbook used to orient first-week collective joiners.',
            category: 'contributions',
            significance: 'standard',
            daysAgo: 72,
            creatorUid: 'eval-member-02',
        },
        {
            slug: 'm7',
            title: 'Founding Benchmark Repository Established',
            description: 'Archived the inaugural benchmark charter and shared testing harness from the prior quarter.',
            category: 'milestones',
            significance: 'major',
            daysAgo: 125,
            creatorUid: 'eval-member-03',
            relatedConclaveId: evPrior90Id,
        },
    ];

    const memories: CollectiveMemory[] = memorySpecs.map((spec) => {
        const d = dateAt(spec.daysAgo);
        return {
            id: makeEvalId(cid, 'mem', spec.slug),
            communityId: cid,
            communityName: cname,
            title: spec.title,
            description: spec.description,
            category: spec.category,
            date: isoDateOnly(spec.daysAgo),
            year: d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            significance: spec.significance,
            status: 'published',
            isFeatured: false,
            relatedConclaveId: spec.relatedConclaveId,
            creatorUid: spec.creatorUid,
            creatorInfo: {
                uid: spec.creatorUid,
                displayName: spec.creatorUid === ownerUid ? ownerDisplayName : 'Cohort Contributor',
                role: spec.creatorUid === ownerUid ? 'Owner' : 'Member',
            },
            createdAt: d,
            updatedAt: d,
        };
    });

    return {
        memberships,
        departedMemberships,
        posts,
        comments,
        events,
        registrations,
        attendanceRecords,
        memories,
        cohortPostAuthorMap,
        cohortCommentAuthorMap,
    };
};
