import {
    QueryConstraint,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    deleteDoc,
    updateDoc,
    increment,
    where,
    startAfter,
    DocumentSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, createDocument, deleteDocument, FirestoreRecord, getDocument, listDocuments, updateDocument } from './firestoreService';
import { uploadFile, getStoragePath } from './storageService';
import { incrementChannelPostCount, decrementChannelPostCount, getChannelById } from './channelService';
import { Post, PostType } from '../types';

export interface CreatePostInput {
    channelId?: string;
    channelName?: string;
    channelAvatarUrl?: string;
    oneLine: string;
    content: string;
    mediaFile?: File | null;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video';
    thumbnailUrl?: string;
    type?: string;
    category?: string;
    tags?: string[];
    visibility?: 'public' | 'unlisted' | 'private';
    authorProfile?: {
        displayName?: string;
        username?: string;
        photoURL?: string;
        role?: string;
    };
}

export interface PostDocumentData {
    channelId?: string;
    channelName?: string;
    channelAvatarUrl?: string;
    authorId: string;
    author: {
        name: string;
        avatarUrl: string;
        username?: string;
        isVerified?: boolean;
    };
    aiSummary: string;
    oneLine?: string;
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    thumbnailUrl?: string;
    stats: {
        likes: number;
        views: number;
        comments: number;
    };
    likeCount?: number;
    viewCount?: number;
    commentCount?: number;
    saveCount?: number;
    type: PostType;
    postType?: string;
    category: string;
    tags?: string[];
    visibility?: 'public' | 'unlisted' | 'private';
    createdAt?: unknown;
    updatedAt?: unknown;
}

export interface FeedQueryOptions {
    category?: string;
    postType?: PostType | string;
    activeTab?: 'Feeds' | 'Discover' | string;
    discoverFilter?: 'All' | 'Threads' | 'Queries' | string;
    pageSize?: number;
    lastDoc?: DocumentSnapshot | null;
}

/**
 * Normalizes a raw Firestore post document into the application Post interface.
 */
export const normalizeFirestorePost = (id: string, data: Record<string, any>): Post => {
    let createdAtDate = new Date();
    if (data.createdAt) {
        if (typeof data.createdAt?.toDate === 'function') {
            createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
            createdAtDate = data.createdAt;
        } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
            createdAtDate = new Date(data.createdAt);
        }
    }

    let postType = PostType.Feed;
    const rawType = data.type || data.postType;
    if (rawType === 'Thread' || rawType === PostType.Thread) {
        postType = PostType.Thread;
    } else if (rawType === 'Query' || rawType === PostType.Query) {
        postType = PostType.Query;
    } else if (rawType === 'Poll' || rawType === PostType.Poll) {
        postType = PostType.Poll;
    } else {
        postType = PostType.Feed;
    }

    return {
        id,
        channelId: data.channelId || undefined,
        channelName: data.channelName || undefined,
        channelAvatarUrl: data.channelAvatarUrl || undefined,
        authorId: data.authorId || undefined,
        author: {
            name: data.author?.name || 'Invox Member',
            avatarUrl: data.author?.avatarUrl || `https://picsum.photos/seed/${data.authorId || id}/200`,
            username: data.author?.username || undefined,
            isVerified: Boolean(data.author?.isVerified),
        },
        aiSummary: data.aiSummary || data.oneLine || '',
        oneLine: data.oneLine || data.aiSummary || '',
        content: data.content || '',
        mediaUrl: data.mediaUrl || undefined,
        mediaType: data.mediaType || (data.mediaUrl?.includes('.mp4') ? 'video' : data.mediaUrl ? 'image' : undefined),
        thumbnailUrl: data.thumbnailUrl || undefined,
        stats: {
            likes: Number(data.stats?.likes ?? data.likeCount ?? 0),
            views: Number(data.stats?.views ?? data.viewCount ?? 0),
            comments: Number(data.stats?.comments ?? data.commentCount ?? 0),
        },
        likeCount: Number(data.likeCount ?? data.stats?.likes ?? 0),
        viewCount: Number(data.viewCount ?? data.stats?.views ?? 0),
        commentCount: Number(data.commentCount ?? data.stats?.comments ?? 0),
        saveCount: Number(data.saveCount ?? 0),
        type: postType,
        postType: data.postType || postType,
        category: data.category || 'General',
        tags: data.tags || [],
        visibility: data.visibility || 'public',
        createdAt: createdAtDate,
    };
};

/**
 * Creates a new Post in Firestore, uploading any attached media file to Firebase Storage.
 */
export const createPost = async (input: CreatePostInput, onUploadProgress?: (progress: number) => void): Promise<Post> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be authenticated to create a post.');
    }

    let uploadedMediaUrl: string | undefined = input.mediaUrl || undefined;
    let detectedMediaType: 'image' | 'video' | undefined = input.mediaType;

    // Handle media file upload if provided
    if (input.mediaFile) {
        const file = input.mediaFile;
        const storagePath = getStoragePath('postMedia', currentUser.uid, file.name);
        const uploaded = await uploadFile(storagePath, file, {
            onProgress: (progress) => onUploadProgress?.(progress),
        });
        uploadedMediaUrl = uploaded.url;
        detectedMediaType = file.type.startsWith('video') ? 'video' : 'image';
    }

    let resolvedPostType = PostType.Feed;
    const inputType = input.type?.toLowerCase();
    if (inputType === 'thread' || inputType === 'discover') {
        resolvedPostType = PostType.Thread;
    } else if (inputType === 'query' || inputType === 'knack') {
        resolvedPostType = PostType.Query;
    } else {
        resolvedPostType = PostType.Feed;
    }

    // Enforce channel requirement for Feed posts
    if (resolvedPostType === PostType.Feed && !input.channelId) {
        throw new Error('A Channel is required before publishing a Feed broadcast. Please select or create a channel.');
    }

    let finalChannelName = input.channelName || null;
    let finalChannelAvatar = input.channelAvatarUrl || null;

    if (input.channelId && (!finalChannelName || !finalChannelAvatar)) {
        try {
            const ch = await getChannelById(input.channelId);
            if (ch) {
                finalChannelName = finalChannelName || ch.name;
                finalChannelAvatar = finalChannelAvatar || ch.avatarUrl || null;
            }
        } catch (e) {
            console.warn('[CHANNEL_LOOKUP_WARN]', e);
        }
    }

    const postPayload = {
        channelId: input.channelId || null,
        channelName: finalChannelName,
        channelAvatarUrl: finalChannelAvatar,
        authorId: currentUser.uid,
        author: {
            name: input.authorProfile?.displayName || currentUser.displayName || 'Invox Member',
            avatarUrl: input.authorProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
            username: input.authorProfile?.username || '',
            isVerified: input.authorProfile?.role === 'admin' || input.authorProfile?.role === 'moderator' || false,
        },
        aiSummary: input.oneLine.trim(),
        oneLine: input.oneLine.trim(),
        content: input.content.trim(),
        mediaUrl: uploadedMediaUrl || null,
        mediaType: detectedMediaType || null,
        thumbnailUrl: input.thumbnailUrl || (detectedMediaType === 'video' ? uploadedMediaUrl : null),
        stats: {
            likes: 0,
            views: 0,
            comments: 0,
        },
        likeCount: 0,
        viewCount: 0,
        commentCount: 0,
        saveCount: 0,
        type: resolvedPostType,
        postType: input.type || resolvedPostType,
        category: input.category || input.type || 'General',
        tags: input.tags || [],
        visibility: input.visibility || 'public',
    };

    const newDocId = await createDocument(COLLECTIONS.posts, postPayload);
    console.log(`[POST_CREATED] Successfully created post ${newDocId}`);

    // If channelId is present, increment channel post count
    if (input.channelId) {
        incrementChannelPostCount(input.channelId).catch(console.warn);
    }

    return normalizeFirestorePost(newDocId, {
        ...postPayload,
        createdAt: new Date(),
    });
};

/**
 * Updates an existing post in Firestore.
 */
export const updatePost = async (postId: string, updates: Partial<CreatePostInput>): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const updatePayload: Record<string, any> = {};
    if (updates.oneLine !== undefined) {
        updatePayload.oneLine = updates.oneLine.trim();
        updatePayload.aiSummary = updates.oneLine.trim();
    }
    if (updates.content !== undefined) {
        updatePayload.content = updates.content.trim();
    }
    if (updates.category !== undefined) {
        updatePayload.category = updates.category;
    }
    if (updates.channelId !== undefined) {
        updatePayload.channelId = updates.channelId;
    }
    if (updates.channelName !== undefined) {
        updatePayload.channelName = updates.channelName;
    }

    await updateDocument(COLLECTIONS.posts, postId, updatePayload);
    console.log(`[POST_UPDATED] Post ${postId} updated`);
};

/**
 * Helper to classify and format Firestore error codes into human-readable diagnostics.
 */
export const formatFirestoreError = (err: any): string => {
    if (!err) return 'An unknown error occurred during the Firestore operation.';
    const code = err.code || '';
    switch (code) {
        case 'permission-denied':
            return 'Permission denied: Firestore security rules prevented this action. You may only delete feeds that you created.';
        case 'not-found':
            return 'Document not found: The feed document does not exist in Firestore or was already deleted.';
        case 'unauthenticated':
            return 'Unauthenticated: You must be logged in to delete this broadcast.';
        case 'unavailable':
            return 'Network unavailable: Cannot reach Firestore backend. Check your internet connection.';
        case 'invalid-argument':
            return 'Invalid document reference provided for deletion.';
        default:
            return err.message || `Firestore operation failed with code: ${code}`;
    }
};

/**
 * Deletes a post created by the current user.
 * Performs complete ownership verification against authorId and Firestore Security Rules.
 */
export const deletePost = async (postId: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Unauthenticated: You must be logged in to delete a post.');
    }

    const postPath = `${COLLECTIONS.posts}/${postId}`;
    console.log(`[FIRESTORE_DELETE] Initiating deletion targeting document at path: ${postPath}`);

    // Retrieve post first to verify existence, channelId, and ownership
    const postRef = doc(db, COLLECTIONS.posts, postId);
    let postDoc;
    try {
        postDoc = await getDoc(postRef);
    } catch (readErr: any) {
        console.error(`[FIRESTORE_READ_ERROR] Failed to fetch post prior to deletion:`, readErr);
        throw new Error(formatFirestoreError(readErr));
    }

    if (!postDoc.exists()) {
        console.warn(`[FIRESTORE_DELETE] Post not found at path: ${postPath}`);
        throw new Error(`Post not found: No document exists at ${postPath}`);
    }

    const data = postDoc.data();
    const docAuthorId = data?.authorId;

    // Verify ownership: authorId must match currentUser.uid
    if (!docAuthorId) {
        // Check legacy fields (userId or author.id)
        const legacyUid = data?.userId || data?.author?.id;
        if (legacyUid && legacyUid === currentUser.uid) {
            console.log(`[FIRESTORE_DELETE] Ownership confirmed via legacy user field (${legacyUid})`);
        } else {
            console.error(`[FIRESTORE_DELETE_DENIED] Missing authorId on document: ${postId}`, data);
            throw new Error(`Cannot verify ownership: This legacy document at ${postPath} does not have an authorId field.`);
        }
    } else if (docAuthorId !== currentUser.uid) {
        console.error(`[FIRESTORE_DELETE_DENIED] Ownership mismatch: document authorId (${docAuthorId}) !== currentUser.uid (${currentUser.uid})`);
        throw new Error('Permission denied: You can only delete feed broadcasts that you created.');
    }

    // Decrement channel post count if affiliated with a channel
    if (data?.channelId) {
        try {
            await decrementChannelPostCount(data.channelId);
        } catch (e) {
            console.warn(`[CHANNEL_COUNT_WARN] Failed to decrement channel post count for ${data.channelId}:`, e);
        }
    }

    // Perform actual Firestore document deletion
    try {
        await deleteDocument(COLLECTIONS.posts, postId);
        console.log(`[POST_DELETED] Successfully deleted document at ${postPath}`);
    } catch (err: any) {
        const errorMsg = formatFirestoreError(err);
        console.error(`[FIRESTORE_DELETE_ERROR] Failed to delete ${postPath}:`, {
            code: err?.code,
            message: err?.message,
            diagnostic: errorMsg,
        });
        throw new Error(errorMsg);
    }
};

/**
 * Lists posts for Explore / Feed with optional constraints.
 */
export const getFeedPosts = async (options: FeedQueryOptions = {}): Promise<{ posts: Post[]; lastDoc: DocumentSnapshot | null }> => {
    const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
    ];

    if (options.pageSize) {
        constraints.push(limit(options.pageSize));
    } else {
        constraints.push(limit(30));
    }

    if (options.lastDoc) {
        constraints.push(startAfter(options.lastDoc));
    }

    console.log('[POST_SERVICE] Fetching feed posts from Firestore...');
    const snapshot = await getDocs(query(collection(db, COLLECTIONS.posts), ...constraints));
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    const posts = snapshot.docs.map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()));
    return { posts, lastDoc };
};

/**
 * Subscribes to real-time updates for Feed posts.
 */
export const subscribeToFeed = (
    options: FeedQueryOptions,
    onPosts: (posts: Post[]) => void,
    onError?: (error: Error) => void
) => {
    const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        limit(options.pageSize || 50),
    ];

    const q = query(collection(db, COLLECTIONS.posts), ...constraints);
    return onSnapshot(
        q,
        (snapshot) => {
            const posts = snapshot.docs.map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()));
            onPosts(posts);
        },
        (err) => {
            console.error('[POST_SUBSCRIBE_ERROR]', err);
            onError?.(err);
        }
    );
};

/**
 * Subscribes to real-time posts created by a specific user (for My Space / Uploads).
 */
export const subscribeToUserPosts = (
    userId: string,
    onPosts: (posts: Post[]) => void,
    onError?: (error: Error) => void
) => {
    const constraints: QueryConstraint[] = [
        where('authorId', '==', userId),
        limit(100),
    ];

    const q = query(collection(db, COLLECTIONS.posts), ...constraints);
    return onSnapshot(
        q,
        (snapshot) => {
            const posts = snapshot.docs
                .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onPosts(posts);
        },
        (err) => {
            console.error('[USER_POSTS_SUBSCRIBE_ERROR]', err);
            onError?.(err);
        }
    );
};

/**
 * Fetches posts created by a specific user.
 */
export const getUserPosts = async (userId: string): Promise<Post[]> => {
    const constraints: QueryConstraint[] = [
        where('authorId', '==', userId),
        limit(100),
    ];

    const snapshot = await getDocs(query(collection(db, COLLECTIONS.posts), ...constraints));
    return snapshot.docs
        .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

/**
 * Toggles like on a post.
 * Uses deterministic document ID `${userId}_${postId}` in the 'likes' collection.
 */
export const toggleLikePost = async (postId: string): Promise<{ liked: boolean; newCount: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be signed in to like posts');

    const likeId = `${currentUser.uid}_${postId}`;
    const likeRef = doc(db, COLLECTIONS.likes, likeId);
    const postRef = doc(db, COLLECTIONS.posts, postId);

    const likeSnap = await getDoc(likeRef);
    if (likeSnap.exists()) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(postRef, {
            'stats.likes': increment(-1),
            likeCount: increment(-1),
        }).catch(err => console.warn('Failed to decrement post like count:', err));
        return { liked: false, newCount: -1 };
    } else {
        // Like
        await setDoc(likeRef, {
            userId: currentUser.uid,
            postId,
            createdAt: serverTimestamp(),
        });
        await updateDoc(postRef, {
            'stats.likes': increment(1),
            likeCount: increment(1),
        }).catch(err => console.warn('Failed to increment post like count:', err));
        return { liked: true, newCount: 1 };
    }
};

/**
 * Toggles bookmark / save on a post.
 * Uses deterministic document ID `${userId}_${postId}` in the 'bookmarks' collection.
 */
export const toggleBookmarkPost = async (postId: string): Promise<{ saved: boolean }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be signed in to bookmark posts');

    const bookmarkId = `${currentUser.uid}_${postId}`;
    const bookmarkRef = doc(db, COLLECTIONS.bookmarks, bookmarkId);
    const postRef = doc(db, COLLECTIONS.posts, postId);

    const bookmarkSnap = await getDoc(bookmarkRef);
    if (bookmarkSnap.exists()) {
        await deleteDoc(bookmarkRef);
        await updateDoc(postRef, {
            saveCount: increment(-1),
        }).catch(err => console.warn('Failed to decrement post save count:', err));
        return { saved: false };
    } else {
        await setDoc(bookmarkRef, {
            userId: currentUser.uid,
            postId,
            createdAt: serverTimestamp(),
        });
        await updateDoc(postRef, {
            saveCount: increment(1),
        }).catch(err => console.warn('Failed to increment post save count:', err));
        return { saved: true };
    }
};

/**
 * Fetches all liked post IDs for the current user.
 */
export const getUserLikedPostIds = async (userId: string): Promise<Set<string>> => {
    try {
        const q = query(collection(db, COLLECTIONS.likes), where('userId', '==', userId));
        const snap = await getDocs(q);
        const ids = new Set<string>();
        snap.forEach(d => {
            const data = d.data();
            if (data.postId) ids.add(data.postId);
        });
        return ids;
    } catch (e) {
        console.warn('Failed to fetch user likes:', e);
        return new Set<string>();
    }
};

/**
 * Fetches all saved / bookmarked post IDs for the current user.
 */
export const getUserSavedPostIds = async (userId: string): Promise<Set<string>> => {
    try {
        const q = query(collection(db, COLLECTIONS.bookmarks), where('userId', '==', userId));
        const snap = await getDocs(q);
        const ids = new Set<string>();
        snap.forEach(d => {
            const data = d.data();
            if (data.postId) ids.add(data.postId);
        });
        return ids;
    } catch (e) {
        console.warn('Failed to fetch user bookmarks:', e);
        return new Set<string>();
    }
};

/**
 * Increments view count for a post.
 */
export const incrementPostView = async (postId: string): Promise<void> => {
    try {
        const postRef = doc(db, COLLECTIONS.posts, postId);
        await updateDoc(postRef, {
            'stats.views': increment(1),
            viewCount: increment(1),
        });
    } catch (e) {
        // Non-critical, ignore silent error
    }
};
