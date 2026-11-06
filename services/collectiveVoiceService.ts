import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import { normalizeFirestorePost, createPost, CreatePostInput } from './postService';
import type { 
    Post, 
    CollectiveVoiceType, 
    ProposalStatus, 
    ProposalMeta, 
    PollMeta, 
    PollOption, 
    ConsultationMeta, 
    ConsultationResponse, 
    DecisionMeta 
} from '../types';
import { PostType } from '../types';

const NOW = Date.now();
const ONE_HOUR = 3600 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

/**
 * Rich initial sample posts for Collective Voice demonstrating the 4 core formats:
 * Standard Discussion, Proposal, Poll, and Consultation.
 */
export const getSampleVoicePosts = (communityId: string, communityName = 'The Collective'): Post[] => [
    {
        id: `voice-prop-${communityId}-1`,
        communityId,
        communityName,
        authorId: 'usr-gov-lead',
        author: {
            name: 'Elena Rostova',
            username: 'elena_arch',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'CIP-18: Establish Community Open-Source Grant Treasury for Member Projects',
        aiSummary: 'Formal proposal allocating 15% of annual collective sponsorship funds to member-authored open source libraries and developer tooling.',
        oneLine: 'Formal proposal allocating 15% of annual collective sponsorship funds to member-authored developer tooling.',
        content: `### Executive Summary
This proposal establishes an autonomous Grant Treasury dedicated to providing micro-grants ($1,000 to $5,000) for high-impact tools, research papers, and technical libraries built by active members of our collective.

### Motivation & Scope
Many of our members develop open-source frameworks, security utilities, and benchmarking suites that directly benefit our community. Currently, we lack a formal channel to sponsor hosting, domain costs, and initial security audits for these projects.

### Proposed Governance Rules
1. Any member with at least 30 days active membership can submit a grant application.
2. Council reviews applications bi-weekly with public voting rounds.
3. Milestones are released in 50% tranches upon peer validation in Conclave.

### Funding Allocation
- Initial seed pool: $25,000 from current community reserves.
- Recurring allocation: 15% of all quarterly sponsorship proceeds.`,
        tags: ['Governance', 'Treasury', 'Grants', 'OpenSource'],
        category: 'Treasury',
        domain: 'Treasury',
        visibility: 'public',
        createdAt: new Date(NOW - 3 * ONE_DAY),
        stats: { likes: 64, views: 1420, comments: 23 },
        likeCount: 64,
        viewCount: 1420,
        commentCount: 23,
        type: PostType.Feed,
        voiceType: 'proposal',
        proposalMeta: {
            status: 'under_review',
            category: 'Treasury & Grants',
            summary: 'Allocate $25,000 initial seed pool + 15% recurring quarterly sponsorships to open-source developer grants.',
            discussionClosingDate: new Date(NOW + 4 * ONE_DAY).toISOString(),
            reviewNotes: 'Under evaluation by Community Financial Council. Preliminary quorum reached.',
            statusHistory: [
                {
                    status: 'open',
                    changedBy: 'usr-gov-lead',
                    changedByName: 'Elena Rostova',
                    changedAt: new Date(NOW - 3 * ONE_DAY).toISOString(),
                    note: 'Proposal published for member deliberation.',
                },
                {
                    status: 'under_review',
                    changedBy: 'admin-lead',
                    changedByName: 'Council Moderator',
                    changedAt: new Date(NOW - 1 * ONE_DAY).toISOString(),
                    note: 'Moved to Council review after reaching 50+ supporting signals.',
                }
            ]
        }
    },
    {
        id: `voice-dec-${communityId}-2`,
        communityId,
        communityName,
        authorId: 'usr-lead-eng',
        author: {
            name: 'Kaelen Thorne',
            username: 'kaelen_t',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'CIP-12: Mandatory Cryptographic Verification for Production Releases',
        aiSummary: 'Formal ratified decision mandating multi-signature cryptographic provenance for all shared code repositories in the collective.',
        oneLine: 'Ratified decision mandating multi-signature cryptographic provenance for collective code repositories.',
        content: `### Collective Resolution
Following the unanimous consensus achieved in the February Conclave, all official software releases and shared dependencies published under our collective domain must now undergo dual-signatory verification.

### Enforcement Strategy
- Automated CI pipeline checks GPG signatures against the community key directory.
- Audit reports are archived in the Collective Memory.
- Dedicated security working group appointed to maintain verification tooling.`,
        tags: ['Security', 'Cryptography', 'Standard', 'Ratified'],
        category: 'Governance',
        domain: 'Governance',
        visibility: 'public',
        createdAt: new Date(NOW - 12 * ONE_DAY),
        stats: { likes: 98, views: 2890, comments: 34 },
        likeCount: 98,
        viewCount: 2890,
        commentCount: 34,
        type: PostType.Feed,
        voiceType: 'proposal',
        proposalMeta: {
            status: 'approved',
            category: 'Security & Protocol',
            summary: 'Mandatory cryptographic signatures for all shared repositories.',
            statusHistory: [
                {
                    status: 'open',
                    changedBy: 'usr-lead-eng',
                    changedByName: 'Kaelen Thorne',
                    changedAt: new Date(NOW - 15 * ONE_DAY).toISOString(),
                },
                {
                    status: 'under_review',
                    changedBy: 'admin-lead',
                    changedByName: 'Security Council',
                    changedAt: new Date(NOW - 13 * ONE_DAY).toISOString(),
                },
                {
                    status: 'approved',
                    changedBy: 'admin-lead',
                    changedByName: 'Security Council',
                    changedAt: new Date(NOW - 12 * ONE_DAY).toISOString(),
                    note: 'Approved with 92% member consensus in Conclave Session #14.',
                }
            ]
        },
        decisionMeta: {
            isRecorded: true,
            outcome: 'Dual-signatory GPG verification enacted for all official software releases with automated CI enforcement.',
            responsibleAuthority: 'Security & Governance Working Group',
            decisionDate: new Date(NOW - 12 * ONE_DAY).toISOString(),
            implementationProgress: 85,
            notes: 'Tooling implemented. Final key directory synchronization underway.'
        }
    },
    {
        id: `voice-poll-${communityId}-3`,
        communityId,
        communityName,
        authorId: 'usr-dev-adv',
        author: {
            name: 'Aria Chen',
            username: 'ariachen',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'POLL: Which primary programming ecosystem should our upcoming Hackathon emphasize?',
        aiSummary: 'Community vote to select the focal track for the Q3 Invitational Hackathon. Cast your vote to shape the prize pools.',
        oneLine: 'Vote to select the focal track for the Q3 Invitational Hackathon.',
        content: `As we prepare for the 48-Hour Invitational Hackathon next month, we want to align our main challenge track and sponsor bounties with the core interests of our collective.

Cast your vote below. One vote per member; voting closes in 5 days. Live results are updated immediately.`,
        tags: ['Hackathon', 'CommunityPoll', 'Ecosystem', 'Vote'],
        category: 'Poll',
        domain: 'Poll',
        visibility: 'public',
        createdAt: new Date(NOW - 18 * ONE_HOUR),
        stats: { likes: 52, views: 890, comments: 19 },
        likeCount: 52,
        viewCount: 890,
        commentCount: 19,
        type: PostType.Feed,
        voiceType: 'poll',
        pollMeta: {
            options: [
                { id: 'opt-rust-wasm', text: 'Rust & WebAssembly Native Tooling', votes: 47 },
                { id: 'opt-distributed-ai', text: 'Distributed Local AI & Edge Inferencing', votes: 72 },
                { id: 'opt-crypto-zero', text: 'Zero-Knowledge Proofs & Identity Systems', votes: 31 },
                { id: 'opt-realtime-proto', text: 'High-Performance Real-Time P2P Protocols', votes: 24 }
            ],
            totalVotes: 174,
            expiresAt: new Date(NOW + 5 * ONE_DAY).toISOString(),
            hideResultsUntilVoted: false,
            voterUids: ['mock-voter-1', 'mock-voter-2']
        }
    },
    {
        id: `voice-consult-${communityId}-4`,
        communityId,
        communityName,
        authorId: 'usr-council-chair',
        author: {
            name: 'Marcus Vance',
            username: 'marcusv',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'CONSULTATION: INVOX Sovereign Architecture & Node Verification Standards',
        aiSummary: 'Structured consultation by community leadership gathering technical feedback on decentralized node hosting requirements.',
        oneLine: 'Structured consultation on decentralized node hosting requirements and criteria.',
        content: `### Objective
We are standardizing our community's decentralized node requirements for the upcoming sovereign data mesh. Before codifying these requirements into formal bylaws, the leadership invites all technical members to submit direct responses to our three core architecture questions.

Please answer the prompts below. The consultation will close on the specified deadline, after which a public Consensus Synthesis Report will be compiled.`,
        tags: ['Consultation', 'Architecture', 'Decentralized', 'Feedback'],
        category: 'Consultation',
        domain: 'Consultation',
        visibility: 'public',
        createdAt: new Date(NOW - 2 * ONE_DAY),
        stats: { likes: 38, views: 760, comments: 14 },
        likeCount: 38,
        viewCount: 760,
        commentCount: 14,
        type: PostType.Feed,
        voiceType: 'consultation',
        consultationMeta: {
            prompts: [
                'What is the minimum uptime threshold (e.g., 99.5% vs 99.9%) realistic for community-hosted nodes?',
                'Should hardware specifications mandate NVMe storage and dedicated hardware security modules (HSM)?',
                'What automated penalty or graceful failover mechanism should trigger if a node falls out of consensus?'
            ],
            deadline: new Date(NOW + 6 * ONE_DAY).toISOString(),
            isClosed: false,
            responseCount: 16,
            responses: [
                {
                    id: 'resp-1',
                    userId: 'usr-lead-eng',
                    userName: 'Kaelen Thorne',
                    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
                    submittedAt: new Date(NOW - 1 * ONE_DAY).toISOString(),
                    answers: [
                        { promptIndex: 0, promptText: 'Minimum uptime threshold', answerText: '99.7% with a 3-hour grace window during scheduled kernel migrations.' },
                        { promptIndex: 1, promptText: 'Hardware specifications', answerText: 'NVMe is essential for state database I/O, but software HSM (TPM 2.0) should be permitted for home lab nodes.' },
                        { promptIndex: 2, promptText: 'Automated penalty mechanism', answerText: 'Gradual weight degradation over 24 hours rather than instant slashing.' }
                    ]
                }
            ]
        }
    },
    {
        id: `voice-disc-${communityId}-5`,
        communityId,
        communityName,
        authorId: 'usr-researcher',
        author: {
            name: 'Dr. Tariq Al-Mansoor',
            username: 'tariq_research',
            avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: false,
        },
        title: 'Open Discussion: Pragmatic trade-offs in distributed lock managers vs optimistic state concurrency',
        aiSummary: 'Technical deep-dive on latency spikes encountered when scaling distributed Raft clusters past 15 geographical nodes.',
        oneLine: 'Technical deep-dive on latency spikes encountered when scaling distributed Raft clusters.',
        content: `In our recent load tests across multi-region edge clusters, we noticed that strict distributed locking degraded P99 latencies by up to 340ms whenever cross-Atlantic network jitter spiked.

Switching our telemetry buffer to conflict-free replicated data types (CRDTs) with optimistic state resolution reduced tail latency by 85%, though it required reworking our reconciliation guarantees.

What strategies has your team used to balance consensus strictness against edge responsiveness? Looking forward to member experiences.`,
        tags: ['DistributedSystems', 'CRDT', 'Concurrency', 'Discussion'],
        category: 'Engineering',
        domain: 'Engineering',
        visibility: 'public',
        createdAt: new Date(NOW - 4 * ONE_HOUR),
        stats: { likes: 45, views: 680, comments: 12 },
        likeCount: 45,
        viewCount: 680,
        commentCount: 12,
        type: PostType.Feed,
        voiceType: 'discussion'
    }
];

// In-memory cache for optimistic updates across the session
const localVoicePostsCache = new Map<string, Post[]>();

/**
 * Subscribes to Collective Voice posts for a community.
 * Integrates directly with the existing Firestore `posts` collection,
 * returning both real Firestore posts and rich fallback samples if the collection is empty.
 */
export const subscribeCommunityVoicePosts = (
    communityId: string,
    communityName = 'The Collective',
    onUpdate: (posts: Post[]) => void
): (() => void) => {
    // If cached in-memory, broadcast immediately
    if (localVoicePostsCache.has(communityId)) {
        onUpdate(localVoicePostsCache.get(communityId)!);
    } else {
        const samples = getSampleVoicePosts(communityId, communityName);
        localVoicePostsCache.set(communityId, samples);
        onUpdate(samples);
    }

    try {
        const postsRef = collection(db, COLLECTIONS.posts);
        const q = query(
            postsRef,
            where('communityId', '==', communityId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                if (snapshot.empty) {
                    const fallback = localVoicePostsCache.get(communityId) || getSampleVoicePosts(communityId, communityName);
                    localVoicePostsCache.set(communityId, fallback);
                    onUpdate(fallback);
                    return;
                }

                const firestorePosts = snapshot.docs.map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()));
                
                // Merge real posts with existing sample records that aren't yet in Firestore
                const currentCache = localVoicePostsCache.get(communityId) || [];
                const mergedMap = new Map<string, Post>();

                // Real posts take priority
                firestorePosts.forEach(p => mergedMap.set(p.id, p));

                // Retain sample posts if desired so the demo remains rich
                currentCache.forEach(sample => {
                    if (!mergedMap.has(sample.id)) {
                        mergedMap.set(sample.id, sample);
                    }
                });

                const sorted = Array.from(mergedMap.values()).sort((a, b) => {
                    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
                    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
                    return bTime - aTime;
                });

                localVoicePostsCache.set(communityId, sorted);
                onUpdate(sorted);
            },
            (error) => {
                console.warn('[COLLECTIVE_VOICE_QUERY_WARN] Falling back to local cache:', error);
                const cached = localVoicePostsCache.get(communityId) || getSampleVoicePosts(communityId, communityName);
                onUpdate(cached);
            }
        );

        return unsubscribe;
    } catch (e) {
        console.warn('[COLLECTIVE_VOICE_SUB_ERR]', e);
        const cached = localVoicePostsCache.get(communityId) || getSampleVoicePosts(communityId, communityName);
        onUpdate(cached);
        return () => {};
    }
};

/**
 * Casts a vote on a community poll.
 * Idempotent: checks user UID to prevent duplicate voting, or updates vote if changing selection.
 */
export const castPollVote = async (
    communityId: string,
    postId: string,
    optionId: string,
    currentUser: { uid: string; displayName?: string | null }
): Promise<Post> => {
    const cachedPosts = localVoicePostsCache.get(communityId) || [];
    const postIndex = cachedPosts.findIndex(p => p.id === postId);
    const existingPost = postIndex !== -1 ? cachedPosts[postIndex] : null;

    if (!existingPost || !existingPost.pollMeta) {
        throw new Error('Poll record not found.');
    }

    const poll = existingPost.pollMeta;
    const voterUids = Array.isArray(poll.voterUids) ? [...poll.voterUids] : [];
    const votesByOption = poll.votesByOption ? { ...poll.votesByOption } : {};

    // Determine if user has already voted
    let previousOptionId: string | undefined = poll.userVotedOptionId;
    if (!previousOptionId) {
        for (const [optId, uids] of Object.entries(votesByOption)) {
            if (uids.includes(currentUser.uid)) {
                previousOptionId = optId;
                break;
            }
        }
    }

    if (previousOptionId === optionId) {
        // Already voted for this option
        return existingPost;
    }

    // Update options vote counts
    const updatedOptions = poll.options.map(opt => {
        let newVotes = opt.votes;
        if (opt.id === previousOptionId && newVotes > 0) {
            newVotes -= 1;
        }
        if (opt.id === optionId) {
            newVotes += 1;
        }
        return { ...opt, votes: newVotes };
    });

    // Update votesByOption
    if (previousOptionId && votesByOption[previousOptionId]) {
        votesByOption[previousOptionId] = votesByOption[previousOptionId].filter(uid => uid !== currentUser.uid);
    }
    votesByOption[optionId] = [...(votesByOption[optionId] || []), currentUser.uid];

    if (!voterUids.includes(currentUser.uid)) {
        voterUids.push(currentUser.uid);
    }

    const updatedPollMeta: PollMeta = {
        ...poll,
        options: updatedOptions,
        totalVotes: updatedOptions.reduce((acc, curr) => acc + curr.votes, 0),
        voterUids,
        votesByOption,
        userVotedOptionId: optionId,
    };

    const updatedPost: Post = {
        ...existingPost,
        pollMeta: updatedPollMeta,
        updatedAt: new Date(),
    };

    if (postIndex !== -1) {
        cachedPosts[postIndex] = updatedPost;
        localVoicePostsCache.set(communityId, [...cachedPosts]);
    }

    // Attempt Firestore persistence if document exists
    if (!postId.startsWith('voice-')) {
        try {
            const postRef = doc(db, COLLECTIONS.posts, postId);
            await updateDoc(postRef, {
                pollMeta: updatedPollMeta,
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('[CAST_VOTE_FIRESTORE_WARN] Updated in-memory, Firestore update notice:', e);
        }
    }

    return updatedPost;
};

/**
 * Transitions a proposal's lifecycle status.
 * Restricted to community owners/admins (or author if withdrawing/opening from draft).
 */
export const updateProposalStatus = async (
    communityId: string,
    postId: string,
    newStatus: ProposalStatus,
    adminUser: { uid: string; displayName?: string | null },
    options?: {
        note?: string;
        decisionOutcome?: string;
        responsibleAuthority?: string;
        implementationProgress?: number;
    }
): Promise<Post> => {
    const cachedPosts = localVoicePostsCache.get(communityId) || [];
    const postIndex = cachedPosts.findIndex(p => p.id === postId);
    const existingPost = postIndex !== -1 ? cachedPosts[postIndex] : null;

    if (!existingPost || !existingPost.proposalMeta) {
        throw new Error('Proposal record not found.');
    }

    const currentMeta = existingPost.proposalMeta;
    const history = Array.isArray(currentMeta.statusHistory) ? [...currentMeta.statusHistory] : [];
    
    history.push({
        status: newStatus,
        changedBy: adminUser.uid,
        changedByName: adminUser.displayName || 'Authorized Administrator',
        changedAt: new Date().toISOString(),
        note: options?.note,
    });

    const updatedProposalMeta: ProposalMeta = {
        ...currentMeta,
        status: newStatus,
        reviewNotes: options?.note || currentMeta.reviewNotes,
        statusHistory: history,
    };

    let updatedDecisionMeta: DecisionMeta | undefined = existingPost.decisionMeta;
    if (options?.decisionOutcome || newStatus === 'approved' || newStatus === 'implemented') {
        updatedDecisionMeta = {
            isRecorded: true,
            outcome: options?.decisionOutcome || updatedDecisionMeta?.outcome || currentMeta.summary || existingPost.title || 'Proposal ratified by collective consensus.',
            responsibleAuthority: options?.responsibleAuthority || updatedDecisionMeta?.responsibleAuthority || adminUser.displayName || 'Community Council',
            decisionDate: updatedDecisionMeta?.decisionDate || new Date().toISOString(),
            implementationProgress: options?.implementationProgress !== undefined ? options.implementationProgress : (newStatus === 'implemented' ? 100 : updatedDecisionMeta?.implementationProgress || 0),
            notes: options?.note,
        };
    }

    const updatedPost: Post = {
        ...existingPost,
        proposalMeta: updatedProposalMeta,
        decisionMeta: updatedDecisionMeta,
        updatedAt: new Date(),
    };

    if (postIndex !== -1) {
        cachedPosts[postIndex] = updatedPost;
        localVoicePostsCache.set(communityId, [...cachedPosts]);
    }

    if (!postId.startsWith('voice-')) {
        try {
            const postRef = doc(db, COLLECTIONS.posts, postId);
            const payload: Record<string, any> = {
                proposalMeta: updatedProposalMeta,
                updatedAt: serverTimestamp(),
            };
            if (updatedDecisionMeta) {
                payload.decisionMeta = updatedDecisionMeta;
            }
            await updateDoc(postRef, payload);
        } catch (e) {
            console.warn('[PROPOSAL_STATUS_FIRESTORE_WARN] Updated in-memory, Firestore update notice:', e);
        }
    }

    return updatedPost;
};

/**
 * Submits member response to a consultation.
 */
export const submitConsultationResponse = async (
    communityId: string,
    postId: string,
    answers: { promptIndex: number; promptText: string; answerText: string }[],
    currentUser: { uid: string; displayName?: string | null; photoURL?: string | null }
): Promise<Post> => {
    const cachedPosts = localVoicePostsCache.get(communityId) || [];
    const postIndex = cachedPosts.findIndex(p => p.id === postId);
    const existingPost = postIndex !== -1 ? cachedPosts[postIndex] : null;

    if (!existingPost || !existingPost.consultationMeta) {
        throw new Error('Consultation record not found.');
    }

    const currentMeta = existingPost.consultationMeta;
    const existingResponses = Array.isArray(currentMeta.responses) ? [...currentMeta.responses] : [];
    
    // Check if user already submitted a response; update if so, else append
    const userRespIndex = existingResponses.findIndex(r => r.userId === currentUser.uid);
    const newResponse: ConsultationResponse = {
        id: userRespIndex !== -1 ? existingResponses[userRespIndex].id : `resp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Community Member',
        userAvatar: currentUser.photoURL || undefined,
        submittedAt: new Date().toISOString(),
        answers,
    };

    if (userRespIndex !== -1) {
        existingResponses[userRespIndex] = newResponse;
    } else {
        existingResponses.unshift(newResponse);
    }

    const updatedConsultationMeta: ConsultationMeta = {
        ...currentMeta,
        responseCount: existingResponses.length,
        responses: existingResponses,
    };

    const updatedPost: Post = {
        ...existingPost,
        consultationMeta: updatedConsultationMeta,
        updatedAt: new Date(),
    };

    if (postIndex !== -1) {
        cachedPosts[postIndex] = updatedPost;
        localVoicePostsCache.set(communityId, [...cachedPosts]);
    }

    if (!postId.startsWith('voice-')) {
        try {
            const postRef = doc(db, COLLECTIONS.posts, postId);
            await updateDoc(postRef, {
                consultationMeta: updatedConsultationMeta,
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('[CONSULTATION_SUBMIT_FIRESTORE_WARN] Updated in-memory, Firestore update notice:', e);
        }
    }

    return updatedPost;
};

/**
 * Concludes a consultation and registers a synthesis report.
 */
export const concludeConsultation = async (
    communityId: string,
    postId: string,
    summaryOutcome: string,
    adminUser: { uid: string; displayName?: string | null }
): Promise<Post> => {
    const cachedPosts = localVoicePostsCache.get(communityId) || [];
    const postIndex = cachedPosts.findIndex(p => p.id === postId);
    const existingPost = postIndex !== -1 ? cachedPosts[postIndex] : null;

    if (!existingPost || !existingPost.consultationMeta) {
        throw new Error('Consultation record not found.');
    }

    const updatedConsultationMeta: ConsultationMeta = {
        ...existingPost.consultationMeta,
        isClosed: true,
        summaryOutcome,
        closedAt: new Date().toISOString(),
        closedBy: adminUser.displayName || 'Community Administrator',
    };

    const updatedPost: Post = {
        ...existingPost,
        consultationMeta: updatedConsultationMeta,
        updatedAt: new Date(),
    };

    if (postIndex !== -1) {
        cachedPosts[postIndex] = updatedPost;
        localVoicePostsCache.set(communityId, [...cachedPosts]);
    }

    if (!postId.startsWith('voice-')) {
        try {
            const postRef = doc(db, COLLECTIONS.posts, postId);
            await updateDoc(postRef, {
                consultationMeta: updatedConsultationMeta,
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('[CONCLUDE_CONSULTATION_FIRESTORE_WARN]', e);
        }
    }

    return updatedPost;
};

/**
 * Direct helper to record/update formal community decision on a post.
 */
export const recordDecisionOnPost = async (
    communityId: string,
    postId: string,
    decision: {
        outcome: string;
        responsibleAuthority: string;
        implementationProgress?: number;
        notes?: string;
    }
): Promise<Post> => {
    const cachedPosts = localVoicePostsCache.get(communityId) || [];
    const postIndex = cachedPosts.findIndex(p => p.id === postId);
    const existingPost = postIndex !== -1 ? cachedPosts[postIndex] : null;

    if (!existingPost) {
        throw new Error('Post record not found.');
    }

    const decisionMeta: DecisionMeta = {
        isRecorded: true,
        outcome: decision.outcome,
        responsibleAuthority: decision.responsibleAuthority,
        decisionDate: new Date().toISOString(),
        implementationProgress: decision.implementationProgress ?? 0,
        notes: decision.notes,
    };

    const updatedPost: Post = {
        ...existingPost,
        decisionMeta,
        updatedAt: new Date(),
    };

    if (postIndex !== -1) {
        cachedPosts[postIndex] = updatedPost;
        localVoicePostsCache.set(communityId, [...cachedPosts]);
    }

    if (!postId.startsWith('voice-')) {
        try {
            const postRef = doc(db, COLLECTIONS.posts, postId);
            await updateDoc(postRef, {
                decisionMeta,
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('[RECORD_DECISION_FIRESTORE_WARN]', e);
        }
    }

    return updatedPost;
};
