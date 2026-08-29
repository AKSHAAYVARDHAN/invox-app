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
import { incrementChannelPostCount, decrementChannelPostCount } from './channelService';
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

    const postPayload = {
        channelId: input.channelId || null,
        channelName: input.channelName || null,
        channelAvatarUrl: input.channelAvatarUrl || null,
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
 * Deletes a post created by the current user.
 */
export const deletePost = async (postId: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    // Retrieve post first to check channelId
    try {
        const postDoc = await getDoc(doc(db, COLLECTIONS.posts, postId));
        if (postDoc.exists()) {
            const data = postDoc.data();
            if (data?.channelId) {
                decrementChannelPostCount(data.channelId).catch(console.warn);
            }
        }
    } catch (e) {
        console.warn('Error fetching post prior to delete:', e);
    }

    await deleteDocument(COLLECTIONS.posts, postId);
    console.log(`[POST_DELETED] Post ${postId} deleted`);
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
