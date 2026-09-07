import {
    collection,
    doc,
    getDocs,
    increment,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { COLLECTIONS, createDocument } from './firestoreService';
import type { PostComment, PostType } from '../types';

// Seed comments for baseline demo items so threads and queries feel active out-of-the-box
const SEED_COMMENTS: Record<string, PostComment[]> = {
    'mock-2': [
        {
            id: 'seed-c-201',
            postId: 'mock-2',
            targetId: 'mock-2',
            type: 'comment',
            authorId: 'usr-seed-1',
            authorName: 'Dr. Elena Vance',
            authorAvatar: 'https://picsum.photos/id/101/200/200',
            authorUsername: 'evance',
            text: 'Canopy biodiversity indices across the upper basin remain largely unmapped. Real-time satellite thermal imaging shows significant micro-climate micro-variations.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        },
        {
            id: 'seed-c-202',
            postId: 'mock-2',
            targetId: 'mock-2',
            type: 'comment',
            authorId: 'usr-seed-2',
            authorName: 'Marcus Thorne',
            authorAvatar: 'https://picsum.photos/id/102/200/200',
            authorUsername: 'mthorne',
            text: 'Vital point on indigenous territorial protections. Lands under autonomous indigenous governance consistently maintain up to 80% lower deforestation rates.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28),
        },
    ],
    'mock-6': [
        {
            id: 'seed-c-601',
            postId: 'mock-6',
            targetId: 'mock-6',
            type: 'comment',
            authorId: 'usr-seed-3',
            authorName: 'Sarah Lin',
            authorAvatar: 'https://picsum.photos/id/103/200/200',
            authorUsername: 'slin_tech',
            text: 'Distribution velocity beats pure product perfection early on. Focus strictly on finding the 10 people who cannot survive without your solution.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
        },
    ],
    'mock-3': [
        {
            id: 'seed-i-301',
            postId: 'mock-3',
            targetId: 'mock-3',
            type: 'insight',
            authorId: 'usr-seed-4',
            authorName: 'Arjun Mehta',
            authorAvatar: 'https://picsum.photos/id/104/200/200',
            authorUsername: 'arjun_synbio',
            text: 'Synthetic biology compilers for cellular engineering. The transition from precision chemical synthesis to bioreactor-grown high-entropy materials will redefine global manufacturing supply chains.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14),
        },
        {
            id: 'seed-i-302',
            postId: 'mock-3',
            targetId: 'mock-3',
            type: 'insight',
            authorId: 'usr-seed-5',
            authorName: 'Claire Zhang',
            authorAvatar: 'https://picsum.photos/id/105/200/200',
            authorUsername: 'claire_optics',
            text: 'Sub-cranial non-invasive neural telemetry. Wavefront-shaping adaptive optics will soon bypass skull scattering without requiring implant surgery.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
        },
    ],
};

const LOCAL_STORAGE_COMMENT_PREFIX = 'invox_comments_';
const LOCAL_STORAGE_COMMENTED_POSTS = 'invox_commented_posts_';
const LOCAL_STORAGE_INSIGHT_POSTS = 'invox_insight_posts_';

/**
 * Normalizes a raw Firestore comment document into a standard PostComment object.
 */
function normalizeComment(id: string, data: any): PostComment {
    let createdAt = new Date();
    if (data.createdAt) {
        if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
        } else if (typeof data.createdAt === 'number') {
            createdAt = new Date(data.createdAt);
        } else if (typeof data.createdAt === 'string') {
            createdAt = new Date(data.createdAt);
        }
    }

    return {
        id,
        postId: data.postId || data.targetId || '',
        targetId: data.targetId || data.postId || '',
        targetType: data.targetType || data.postType || 'post',
        type: data.type || (data.targetType === 'Query' ? 'insight' : 'comment'),
        authorId: data.authorId || '',
        authorName: data.authorName || 'Invox Member',
        authorAvatar: data.authorAvatar || `https://picsum.photos/seed/${data.authorId || 'anon'}/200`,
        authorUsername: data.authorUsername || '',
        text: data.text || '',
        createdAt,
        updatedAt: data.updatedAt ? new Date() : undefined,
    };
}

/**
 * Gets cached comments from localStorage for a post.
 */
function getLocalComments(postId: string): PostComment[] {
    try {
        if (typeof window === 'undefined') return [];
        const raw = localStorage.getItem(`${LOCAL_STORAGE_COMMENT_PREFIX}${postId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
        }));
    } catch {
        return [];
    }
}

/**
 * Stores newly added comment into localStorage cache.
 */
function saveLocalComment(comment: PostComment) {
    try {
        if (typeof window === 'undefined') return;
        const current = getLocalComments(comment.postId);
        const updated = [comment, ...current.filter(c => c.id !== comment.id)];
        localStorage.setItem(`${LOCAL_STORAGE_COMMENT_PREFIX}${comment.postId}`, JSON.stringify(updated));
    } catch (e) {
        console.warn('[COMMENT_CACHE_WARN]', e);
    }
}

/**
 * Subscribes in real-time to comments or insights for a given post.
 * Seamlessly combines Firestore real-time updates with local cache and baseline seed items.
 */
export function subscribeToPostComments(
    postId: string,
    onComments: (comments: PostComment[]) => void,
    onError?: (err: any) => void
): () => void {
    const seed = SEED_COMMENTS[postId] || [];
    const local = getLocalComments(postId);
    const initialCombined = [...local, ...seed].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    onComments(initialCombined);

    // Try listening to Firestore collection
    let unsubscribeFirestore = () => {};

    try {
        const q = query(
            collection(db, COLLECTIONS.comments),
            where('targetId', '==', postId)
        );

        unsubscribeFirestore = onSnapshot(
            q,
            (snapshot) => {
                const firestoreComments = snapshot.docs.map(d => normalizeComment(d.id, d.data()));
                const firestoreIds = new Set(firestoreComments.map(c => c.id));

                // Merge local cache and seed comments that aren't duplicates
                const mergedLocal = local.filter(c => !firestoreIds.has(c.id));
                const mergedSeed = seed.filter(c => !firestoreIds.has(c.id));

                const all = [...firestoreComments, ...mergedLocal, ...mergedSeed].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                onComments(all);
            },
            (err) => {
                // Non-fatal fallback (e.g. unauthenticated guest or offline network)
                console.warn('[COMMENT_SUBSCRIBE_FALLBACK]', err.message);
                onError?.(err);
                // Return current local + seed
                onComments(initialCombined);
            }
        );
    } catch (err: any) {
        console.warn('[COMMENT_QUERY_INIT_WARN]', err);
    }

    return () => {
        unsubscribeFirestore();
    };
}

/**
 * Creates and persists a new comment (or insight) to Firestore.
 * Updates post statistics and local interaction sets.
 */
export async function createPostComment(params: {
    postId: string;
    postType: PostType | string;
    type: 'comment' | 'insight';
    text: string;
    author: {
        id: string;
        name: string;
        avatarUrl: string;
        username?: string;
    };
}): Promise<PostComment> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to contribute to this discussion.');
    }

    const trimmedText = params.text.trim();
    if (!trimmedText) {
        throw new Error('Cannot submit an empty response.');
    }

    const commentData = {
        postId: params.postId,
        targetId: params.postId,
        targetType: params.postType || 'post',
        type: params.type,
        authorId: currentUser.uid,
        authorName: params.author.name || currentUser.displayName || 'Invox Member',
        authorAvatar: params.author.avatarUrl || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
        authorUsername: params.author.username || '',
        text: trimmedText,
    };

    let newDocId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
        newDocId = await createDocument(COLLECTIONS.comments, commentData);
        console.log(`[COMMENT_CREATED] Document ${newDocId} saved to ${COLLECTIONS.comments}`);
    } catch (err: any) {
        console.error('[FIRESTORE_COMMENT_ERROR]', err);
        // If Firestore fails due to network, still record locally
    }

    const createdComment: PostComment = {
        id: newDocId,
        postId: params.postId,
        targetId: params.postId,
        targetType: String(params.postType),
        type: params.type,
        authorId: currentUser.uid,
        authorName: commentData.authorName,
        authorAvatar: commentData.authorAvatar,
        authorUsername: commentData.authorUsername,
        text: trimmedText,
        createdAt: new Date(),
    };

    // Save to local cache
    saveLocalComment(createdComment);

    // Record user activity locally for instantaneous Explore filter tracking
    markUserInteraction(currentUser.uid, params.postId, params.type);

    // Increment comment count on the post in Firestore (if post exists)
    try {
        const postRef = doc(db, COLLECTIONS.posts, params.postId);
        await updateDoc(postRef, {
            'stats.comments': increment(1),
            commentCount: increment(1),
        });
    } catch {
        // Non-critical, ignored if post is local mock or user doesn't have edit permission
    }

    return createdComment;
}

/**
 * Tracks whether the user has commented or shared an insight on a specific post.
 */
function markUserInteraction(userId: string, postId: string, type: 'comment' | 'insight') {
    try {
        if (typeof window === 'undefined') return;
        const key = type === 'comment'
            ? `${LOCAL_STORAGE_COMMENTED_POSTS}${userId}`
            : `${LOCAL_STORAGE_INSIGHT_POSTS}${userId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        if (!existing.includes(postId)) {
            existing.push(postId);
            localStorage.setItem(key, JSON.stringify(existing));
        }
    } catch {
        // ignore
    }
}

/**
 * Retrieves all post IDs the user has commented on.
 */
export async function getUserCommentedPostIds(userId: string): Promise<Set<string>> {
    const postIds = new Set<string>();

    // Check local storage first
    try {
        if (typeof window !== 'undefined') {
            const cached = JSON.parse(localStorage.getItem(`${LOCAL_STORAGE_COMMENTED_POSTS}${userId}`) || '[]');
            cached.forEach((id: string) => postIds.add(id));
        }
    } catch {}

    // Query Firestore comments authored by this user
    try {
        const q = query(
            collection(db, COLLECTIONS.comments),
            where('authorId', '==', userId),
            where('type', '==', 'comment')
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(d => {
            const data = d.data();
            const pid = data.postId || data.targetId;
            if (pid) postIds.add(pid);
        });
    } catch (e) {
        console.warn('[USER_COMMENTS_FETCH_WARN]', e);
    }

    return postIds;
}

/**
 * Retrieves all query IDs the user has shared insights on.
 */
export async function getUserInsightPostIds(userId: string): Promise<Set<string>> {
    const postIds = new Set<string>();

    // Check local storage first
    try {
        if (typeof window !== 'undefined') {
            const cached = JSON.parse(localStorage.getItem(`${LOCAL_STORAGE_INSIGHT_POSTS}${userId}`) || '[]');
            cached.forEach((id: string) => postIds.add(id));
        }
    } catch {}

    // Query Firestore insights authored by this user
    try {
        const q = query(
            collection(db, COLLECTIONS.comments),
            where('authorId', '==', userId),
            where('type', '==', 'insight')
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(d => {
            const data = d.data();
            const pid = data.postId || data.targetId;
            if (pid) postIds.add(pid);
        });
    } catch (e) {
        console.warn('[USER_INSIGHTS_FETCH_WARN]', e);
    }

    return postIds;
}
