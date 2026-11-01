import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot, 
    getDocs, 
    DocumentSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import { normalizeFirestorePost, createPost, CreatePostInput } from './postService';
import type { Post, Community } from '../types';
import { PostType } from '../types';

export type CommunityFeedSortOption = 'LATEST' | 'POPULAR';

/**
 * Calculates a genuine popularity score based on verified user engagement metrics.
 */
export const calculatePopularityScore = (post: Post): number => {
    const likes = post.stats?.likes ?? post.likeCount ?? 0;
    const comments = post.stats?.comments ?? post.commentCount ?? 0;
    const views = post.stats?.views ?? post.viewCount ?? 0;
    const saves = post.saveCount ?? 0;
    return (likes * 3) + (comments * 4) + (saves * 5) + Math.min(200, Math.floor(views / 50));
};

const NOW = Date.now();
const ONE_HOUR = 3600 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

/**
 * Realistic in-memory sample posts for joined communities.
 * Used exclusively for UI testing and evaluation when no real posts exist in Firestore.
 * NEVER written to production Firestore collections.
 */
export const SAMPLE_COMMUNITY_POSTS: Post[] = [
    {
        id: 'cp-startup-1',
        communityId: 'startup-1',
        communityName: 'Startup Grind',
        communityAvatarUrl: 'https://picsum.photos/seed/startup-grind/200',
        communityHandle: 'startupgrind',
        authorId: 'usr-sg-1',
        author: {
            name: 'Marcus Vance',
            username: 'marcusv',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Scaling B2B SaaS from zero to first $100k ARR: The 3 metrics that actually matter',
        aiSummary: 'Practical lessons on CAC payback velocity, net revenue retention, and qualitative discovery calls during early-stage scaling.',
        oneLine: 'Practical lessons on CAC payback velocity, net revenue retention, and qualitative discovery calls during early-stage scaling.',
        content: `After interviewing 45 B2B founders across our collective, here are the three non-negotiables we observed:

1. CAC Payback under 6 months on first 20 accounts.
2. Zero-touch onboarding vs white-glove balance: Founders who spent 30 minutes live with every user had 3.4x lower churn at day 90.
3. Pricing by value unit rather than user seats.

What has been your biggest surprise during enterprise pilot conversions this quarter?`,
        mediaUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        tags: ['Startups', 'SaaS', 'Revenue', 'Founders'],
        stats: { likes: 142, views: 3200, comments: 28 },
        likeCount: 142,
        viewCount: 3200,
        commentCount: 28,
        saveCount: 45,
        type: PostType.Feed,
        category: 'Startup',
        domain: 'Startup',
        visibility: 'public',
        createdAt: new Date(NOW - 2 * ONE_HOUR),
    },
    {
        id: 'cp-coding-4',
        communityId: 'coding-4',
        communityName: 'Pythonic Geeks',
        communityAvatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200',
        communityHandle: 'pythonicgeeks',
        authorId: 'usr-py-1',
        author: {
            name: 'Priya Sharma',
            username: 'priyacodes',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Python 3.14 Free-Threaded Performance Benchmarks in Distributed Ingestion',
        aiSummary: 'Empirical comparison of nogil execution times across heavy numeric serialization pipelines vs multiprocessing workers.',
        oneLine: 'Empirical comparison of nogil execution times across heavy numeric serialization pipelines vs multiprocessing workers.',
        content: `We tested Python 3.14t (free-threading mode) on an 80-core streaming pipeline handling 50k JSON payloads/sec.

Key observations:
- Memory footprint dropped by 62% compared to standard multiprocessing pools.
- Thread startup latency is virtually zero compared to fork/spawn overhead.
- Watch out for third-party C-extensions that still hold internal locks.

Benchmark graphs and reproducible scripts attached below.`,
        mediaUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        tags: ['Python', 'Concurrency', 'Performance', 'Backend'],
        stats: { likes: 215, views: 4890, comments: 42 },
        likeCount: 215,
        viewCount: 4890,
        commentCount: 42,
        saveCount: 68,
        type: PostType.Feed,
        category: 'Coding',
        domain: 'Coding',
        visibility: 'public',
        createdAt: new Date(NOW - 5 * ONE_HOUR),
    },
    {
        id: 'cp-coding-3',
        communityId: 'coding-3',
        communityName: 'JS Junkies',
        communityAvatarUrl: 'https://picsum.photos/seed/js-junkies/200',
        communityHandle: 'jsjunkies',
        authorId: 'usr-js-1',
        author: {
            name: 'Alexandre Dubois',
            username: 'adubois_js',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: false,
        },
        title: 'Streaming React Server Components over WebSockets: Real-time telemetry lessons',
        aiSummary: 'Deep architectural dive into multiplexing RSC wire-format chunks alongside bidirectional binary websocket frames.',
        oneLine: 'Deep architectural dive into multiplexing RSC wire-format chunks alongside bidirectional binary websocket frames.',
        content: `Standard HTTP polling for dashboard charts adds unnecessary latency spikes. We implemented an experimental transport that pushes serialized RSC flight streams directly over existing authenticated WS connections.

Results:
- P99 updates delivered in <18ms across transatlantic links.
- Client memory remains constant due to differential fiber tree reconciliation.
- Code demo available in the community repo.`,
        tags: ['JavaScript', 'React', 'WebSockets', 'Frontend'],
        stats: { likes: 189, views: 3750, comments: 34 },
        likeCount: 189,
        viewCount: 3750,
        commentCount: 34,
        saveCount: 52,
        type: PostType.Feed,
        category: 'Coding',
        domain: 'Coding',
        visibility: 'public',
        createdAt: new Date(NOW - 9 * ONE_HOUR),
    },
    {
        id: 'cp-design-1',
        communityId: 'design-1',
        communityName: 'UI/UX Guild',
        communityAvatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200',
        communityHandle: 'uiuxguild',
        authorId: 'usr-des-1',
        author: {
            name: 'Elena Rostova',
            username: 'elena_design',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Spatial UI Tokens and High-Density Typography for Technical Dashboards',
        aiSummary: 'Designing dark-mode, monospaced data interfaces without visual fatigue: hierarchy rules and restrained color tokens.',
        oneLine: 'Designing dark-mode, monospaced data interfaces without visual fatigue: hierarchy rules and restrained color tokens.',
        content: `When engineers monitor telemetry 8 hours a day, traditional rounded pastel cards fail. 

Our collective token system emphasizes:
- Sharp 0px corners with 1px border separation to maximize readable viewport area.
- Restrained emerald & cyan accents reserved solely for affirmative signals.
- Monospace sub-headers paired with clean human-readable font stacks.

Feedback welcome from fellow interface architects!`,
        mediaUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        tags: ['Design', 'UI', 'DesignSystems', 'Typography'],
        stats: { likes: 312, views: 6100, comments: 56 },
        likeCount: 312,
        viewCount: 6100,
        commentCount: 56,
        saveCount: 94,
        type: PostType.Feed,
        category: 'Design',
        domain: 'Design',
        visibility: 'public',
        createdAt: new Date(NOW - 14 * ONE_HOUR),
    },
    {
        id: 'cp-ai-1',
        communityId: 'ai-1',
        communityName: 'AI ClubTech',
        communityAvatarUrl: 'https://picsum.photos/seed/ai-clubtech/200',
        communityHandle: 'aiclubtech',
        authorId: 'usr-ai-1',
        author: {
            name: 'Dr. Hiroshi Tanaka',
            username: 'htanaka_ai',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Structured Output Validation with Grounded Neural Search: Eliminating Hallucinations',
        aiSummary: 'Benchmarking deterministic schema coercion techniques across Gemini 2.5 Flash and specialized tool calling runtimes.',
        oneLine: 'Benchmarking deterministic schema coercion techniques across Gemini 2.5 Flash and specialized tool calling runtimes.',
        content: `We tested 1,200 complex multi-entity extraction queries with schema enforcement vs unconstrained generation.

Results:
- Zero syntax violations when utilizing native JSON schema coercion.
- Latency increased by only 4.2% while downstream pipeline parsing errors dropped from 11.4% to 0.0%.

Check out the full paper breakdown in this week's collective review session.`,
        tags: ['Artificial Intelligence', 'LLM', 'MachineLearning', 'Evaluation'],
        stats: { likes: 278, views: 5400, comments: 48 },
        likeCount: 278,
        viewCount: 5400,
        commentCount: 48,
        saveCount: 82,
        type: PostType.Feed,
        category: 'Artificial Intelligence',
        domain: 'Artificial Intelligence',
        visibility: 'public',
        createdAt: new Date(NOW - 22 * ONE_HOUR),
    },
    {
        id: 'cp-mock-tech',
        communityId: 'mock-comm-tech-enthusiasts',
        communityName: 'Tech Enthusiasts',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=200&h=200&auto=format&fit=crop',
        communityHandle: 'techenthusiasts',
        authorId: 'usr-te-1',
        author: {
            name: 'Alex Mercer',
            username: 'alexmercer',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Decentralized Edge Telemetry: 500 Node Distributed Consensus Review',
        aiSummary: 'Empirical review of peer gossip latency across residential fiber connections without central coordinators.',
        oneLine: 'Empirical review of peer gossip latency across residential fiber connections without central coordinators.',
        content: `Over the past weekend, 500 members of our collective ran our telemetry daemon across 22 countries.

- Mean peer discovery: 142ms
- Network partition recovery: 1.2s
- Bandwidth overhead: <4KB/min per active peer

The future of un-censorable developer telemetry is happening right here.`,
        mediaUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        tags: ['DistributedSystems', 'P2P', 'Networks', 'Edge'],
        stats: { likes: 389, views: 7200, comments: 64 },
        likeCount: 389,
        viewCount: 7200,
        commentCount: 64,
        saveCount: 110,
        type: PostType.Feed,
        category: 'Technology & AI',
        domain: 'tech-ai',
        visibility: 'public',
        createdAt: new Date(NOW - 1 * ONE_DAY),
    },
    {
        id: 'cp-mock-rust',
        communityId: 'mock-comm-rust-systems',
        communityName: 'Rust & Systems Guild',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&h=200&auto=format&fit=crop',
        communityHandle: 'rustsystems',
        authorId: 'usr-rs-1',
        author: {
            name: 'Kaelen Chen',
            username: 'kaelen_rust',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Zero-Allocation WebSocket Parser in 400 lines of unsafe-free Rust',
        aiSummary: 'Achieving 12M frames/sec throughput by utilizing SIMD vector masking and zero-copy slicing.',
        oneLine: 'Achieving 12M frames/sec throughput by utilizing SIMD vector masking and zero-copy slicing.',
        content: `Most websocket libraries in the ecosystem allocate small heap buffers on every incoming mask validation. By leveraging portable SIMD and stack array buffers, we eliminated all heap touching on the hot path.

Run 'cargo bench' on the repo to verify locally. Clean pull requests open for AVX-512 optimizations.`,
        tags: ['Rust', 'SIMD', 'HighPerformance', 'WebAssembly'],
        stats: { likes: 450, views: 8900, comments: 78 },
        likeCount: 450,
        viewCount: 8900,
        commentCount: 78,
        saveCount: 135,
        type: PostType.Feed,
        category: 'Software Development',
        domain: 'software-dev',
        visibility: 'public',
        createdAt: new Date(NOW - 1.5 * ONE_DAY),
    },
    {
        id: 'cp-echoworld-1',
        communityId: 'echoworld',
        communityName: 'EchoWorld',
        communityAvatarUrl: 'https://picsum.photos/seed/echoworld/200',
        communityHandle: 'echoworld',
        authorId: 'usr-echo-1',
        author: {
            name: 'Soren Vance',
            username: 'sorenv',
            avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        title: 'Sonic Architecture: Ambient synthesis protocols for spatial soundscapes',
        aiSummary: 'Integrating generative procedural acoustics with browser audio graph worklets.',
        oneLine: 'Integrating generative procedural acoustics with browser audio graph worklets.',
        content: `Sound plays a critical role in spatial navigation. EchoWorld is compiling open algorithmic audio worklets for binaural rendering in WebGL scenes.

Hear the sample track in the player below!`,
        tags: ['Audio', 'Acoustics', 'SpatialSound', 'Generative'],
        stats: { likes: 98, views: 2100, comments: 19 },
        likeCount: 98,
        viewCount: 2100,
        commentCount: 19,
        saveCount: 31,
        type: PostType.Feed,
        category: 'Design & Creativity',
        domain: 'Design',
        visibility: 'public',
        createdAt: new Date(NOW - 3 * ONE_DAY),
    },
    {
        id: 'cp-madmax-1',
        communityId: 'madmax-wizards',
        communityName: 'MadMax Wizards',
        communityAvatarUrl: 'https://picsum.photos/seed/madmax/200',
        communityHandle: 'madmaxwizards',
        authorId: 'usr-mm-1',
        author: {
            name: 'Jaxson Reed',
            username: 'jaxson_mm',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: false,
        },
        title: 'Building Resilience in Extreme Low-Bandwidth Satellite Environments',
        aiSummary: 'High-compression telemetry serialization for field robotics operating at 9600 baud.',
        oneLine: 'High-compression telemetry serialization for field robotics operating at 9600 baud.',
        content: `When your telemetry link is limited to intermittent satellite bursts, every byte is precious. We implemented a delta-compressed bit-packed packet protocol that achieves 94% compression over raw JSON.

Field tests conducted in the Mojave desert show zero lost packets over 72 continuous hours.`,
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        tags: ['Robotics', 'Hardware', 'Satellite', 'Telemetry'],
        stats: { likes: 165, views: 3400, comments: 27 },
        likeCount: 165,
        viewCount: 3400,
        commentCount: 27,
        saveCount: 48,
        type: PostType.Feed,
        category: 'Technology',
        domain: 'Technology',
        visibility: 'public',
        createdAt: new Date(NOW - 4 * ONE_DAY),
    }
];

/**
 * Filter and sort posts dynamically according to user joined communities,
 * active community selector, sort mode, and visibility rules.
 */
export const filterAndSortCommunityPosts = (
    allPosts: Post[],
    joinedCommunityIds: Set<string>,
    selectedCommunityId: string | 'ALL',
    sortOption: CommunityFeedSortOption = 'LATEST',
    currentUserId?: string | null
): Post[] => {
    // 1. Filter: Post must belong to one of the user's joined communities
    let eligible = allPosts.filter(post => {
        if (!post.communityId) return false;
        
        // Exclude if user does not belong to this community (or author)
        const isJoined = joinedCommunityIds.has(post.communityId);
        const isAuthor = currentUserId && post.authorId === currentUserId;
        if (!isJoined && !isAuthor) {
            return false;
        }

        // 2. Specific community filter
        if (selectedCommunityId !== 'ALL' && post.communityId !== selectedCommunityId) {
            return false;
        }

        // 3. Visibility rule: private posts only visible to members/authors
        if (post.visibility === 'private' || post.visibility === 'member-only') {
            if (!isJoined && !isAuthor) {
                return false;
            }
        }

        return true;
    });

    // 2. Deduplicate by post ID
    const seen = new Set<string>();
    eligible = eligible.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
    });

    // 3. Sort
    eligible.sort((a, b) => {
        if (sortOption === 'POPULAR') {
            const scoreA = calculatePopularityScore(a);
            const scoreB = calculatePopularityScore(b);
            if (scoreB !== scoreA) return scoreB - scoreA;
        }
        // Default LATEST: newest first
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
    });

    return eligible;
};

/**
 * Subscribes to real-time community posts from Firestore.
 */
export const subscribeToCommunityPosts = (
    onPosts: (posts: Post[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    try {
        const q = query(
            collection(db, COLLECTIONS.posts),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        return onSnapshot(
            q,
            (snapshot) => {
                const posts = snapshot.docs
                    .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
                    .filter(p => Boolean(p.communityId)); // Only community-affiliated posts
                onPosts(posts);
            },
            (err) => {
                console.warn('[COMMUNITY_POSTS_SNAPSHOT_WARN]', err);
                onError?.(err);
            }
        );
    } catch (err) {
        console.warn('[COMMUNITY_POSTS_SUB_ERR]', err);
        onError?.(err);
        return () => {};
    }
};

/**
 * Creates a public or private post targeted to a specific joined community.
 */
export const publishCommunityPost = async (params: {
    community: Pick<Community, 'id' | 'name'> & { avatarUrl?: string; handle?: string };
    title: string;
    content: string;
    visibility: 'public' | 'private';
    tags?: string[];
    mediaFile?: File | null;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video';
    authorProfile?: {
        displayName?: string;
        username?: string;
        photoURL?: string;
        role?: string;
    };
    onUploadProgress?: (progress: number) => void;
}): Promise<Post> => {
    const { community, title, content, visibility, tags, mediaFile, mediaUrl, mediaType, authorProfile, onUploadProgress } = params;

    const input: CreatePostInput = {
        communityId: community.id,
        communityName: community.name,
        communityAvatarUrl: community.avatarUrl,
        communityHandle: community.handle || community.name.toLowerCase().replace(/\s+/g, ''),
        title: title.trim(),
        oneLine: title.trim(),
        content: content.trim(),
        visibility: visibility,
        type: 'Feed',
        category: 'Community',
        domain: 'Community',
        tags: tags || [],
        mediaFile: mediaFile || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType,
        authorProfile: authorProfile,
    };

    return await createPost(input, onUploadProgress);
};
