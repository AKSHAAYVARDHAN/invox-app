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
import { Post, PostType, CollabDetails, Project, StreamMoment } from '../types';
import { generateSummary } from './geminiService';
import { isMomentsDemoModeEnabled, getFilteredMockMoments } from './momentsDemoData';

export interface CreatePostInput {
    channelId?: string;
    channelName?: string;
    channelAvatarUrl?: string;
    title?: string;
    oneLine: string;
    content: string;
    mediaFile?: File | null;
    mediaFiles?: File[] | null;
    mediaUrl?: string | null;
    mediaUrls?: string[];
    mediaType?: 'image' | 'video';
    thumbnailUrl?: string;
    demoUrl?: string;
    githubUrl?: string;
    repoUrl?: string;
    articleUrl?: string;
    status?: 'published' | 'draft';
    isPublished?: boolean;
    type?: string;
    momentType?: 'Stills' | 'Tapes' | 'Knacks';
    category?: string;
    domain?: string;
    tags?: string[];
    visibility?: 'public' | 'unlisted' | 'private';
    collabDetails?: CollabDetails;
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
    title?: string;
    aiSummary: string;
    oneLine?: string;
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    thumbnailUrl?: string;
    demoUrl?: string | null;
    githubUrl?: string | null;
    repoUrl?: string | null;
    articleUrl?: string | null;
    status?: 'published' | 'draft';
    isPublished?: boolean;
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
    momentType?: 'Stills' | 'Tapes' | 'Knacks';
    mediaUrls?: string[];
    category: string;
    domain?: string;
    tags?: string[];
    visibility?: 'public' | 'unlisted' | 'private';
    collabDetails?: CollabDetails | null;
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
    const rawType = (data.type || data.postType || '').toString().toLowerCase();
    const rawCat = (data.category || '').toString().toLowerCase();
    const rawDom = (data.domain || '').toString().toLowerCase();

    let momentType: 'Stills' | 'Tapes' | 'Knacks' | undefined = data.momentType;
    if (!momentType) {
        if (rawCat === 'stills' || rawCat === 'still' || rawType === 'still') {
            momentType = 'Stills';
        } else if (rawCat === 'tapes' || rawCat === 'tape' || rawType === 'tape') {
            momentType = 'Tapes';
        } else if (rawCat === 'knacks' || rawCat === 'knack' || rawType === 'knack') {
            momentType = 'Knacks';
        }
    }

    if (rawType === 'moment' || rawType === 'still' || rawType === 'tape' || rawType === 'knack' || rawCat === 'stills' || rawCat === 'tapes' || rawCat === 'knacks' || Boolean(data.momentType)) {
        postType = PostType.Moment;
        if (!momentType) {
            momentType = (data.mediaType === 'video' || data.mediaUrl?.includes('.mp4')) ? 'Tapes' : 'Stills';
        }
    } else if (rawType === 'showcase' || rawCat === 'showcase' || rawDom === 'showcase' || Boolean(data.isProject)) {
        postType = PostType.Showcase;
    } else if (rawType === 'thread') {
        postType = PostType.Thread;
    } else if (rawType === 'query') {
        postType = PostType.Query;
    } else if (rawType === 'poll') {
        postType = PostType.Poll;
    } else if (rawType === 'collab' || rawCat === 'collab' || rawDom === 'collab' || Boolean(data.collabDetails)) {
        postType = PostType.Collab;
    } else {
        postType = PostType.Feed;
    }

    const mediaUrls = Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0
        ? data.mediaUrls
        : (data.mediaUrl ? [data.mediaUrl] : []);

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
            id: data.author?.id || data.authorId || undefined,
            uid: data.author?.uid || data.authorId || undefined,
        },
        title: data.title || data.oneLine || data.aiSummary || '',
        aiSummary: data.aiSummary || data.oneLine || data.title || '',
        oneLine: data.oneLine || data.aiSummary || data.title || '',
        hook: data.hook || data.oneLine || data.aiSummary || '',
        content: data.content || data.description || '',
        mediaUrl: data.mediaUrl || (mediaUrls.length > 0 ? mediaUrls[0] : undefined),
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        mediaType: data.mediaType || (data.mediaUrl?.includes('.mp4') ? 'video' : data.mediaUrl ? 'image' : undefined),
        thumbnailUrl: data.thumbnailUrl || undefined,
        demoUrl: data.demoUrl || undefined,
        githubUrl: data.githubUrl || data.repoUrl || undefined,
        repoUrl: data.repoUrl || data.githubUrl || undefined,
        articleUrl: data.articleUrl || undefined,
        status: data.status || 'published',
        isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : (data.status !== 'draft'),
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
        momentType,
        category: data.category || (momentType || (data.domain || 'General')),
        domain: data.domain || data.category || 'General',
        tags: Array.isArray(data.tags) ? data.tags : [],
        visibility: data.visibility || 'public',
        createdAt: createdAtDate,
        updatedAt: data.updatedAt ? (typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate() : new Date(data.updatedAt)) : undefined,
        collabDetails: data.collabDetails || undefined,
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

    const uploadedUrls: string[] = Array.isArray(input.mediaUrls) ? [...input.mediaUrls] : [];
    let uploadedMediaUrl: string | undefined = input.mediaUrl || undefined;
    let detectedMediaType: 'image' | 'video' | undefined = input.mediaType;

    // Handle single media file upload if provided
    if (input.mediaFile) {
        try {
            const file = input.mediaFile;
            const storagePath = getStoragePath('postMedia', currentUser.uid, `${Date.now()}_${file.name}`);
            const uploaded = await uploadFile(storagePath, file, {
                onProgress: (progress) => onUploadProgress?.(progress),
            });
            uploadedMediaUrl = uploaded.url;
            if (!uploadedUrls.includes(uploaded.url)) {
                uploadedUrls.push(uploaded.url);
            }
            detectedMediaType = file.type.startsWith('video') ? 'video' : 'image';
        } catch (uploadErr) {
            console.warn('[POST_MEDIA_UPLOAD_WARN] Storage upload failed, falling back to preview URL if available:', uploadErr);
            if (!uploadedMediaUrl && input.mediaUrl) {
                uploadedMediaUrl = input.mediaUrl;
            }
        }
    }

    // Handle multiple media files upload if provided
    if (Array.isArray(input.mediaFiles) && input.mediaFiles.length > 0) {
        const totalFiles = input.mediaFiles.length;
        let completed = 0;
        for (const file of input.mediaFiles) {
            try {
                const storagePath = getStoragePath('postMedia', currentUser.uid, `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${file.name}`);
                const uploaded = await uploadFile(storagePath, file, {
                    onProgress: (fileProgress) => {
                        const overall = Math.round(((completed + (fileProgress / 100)) / totalFiles) * 100);
                        onUploadProgress?.(overall);
                    }
                });
                if (!uploadedUrls.includes(uploaded.url)) {
                    uploadedUrls.push(uploaded.url);
                }
                if (!uploadedMediaUrl) {
                    uploadedMediaUrl = uploaded.url;
                }
                if (!detectedMediaType) {
                    detectedMediaType = file.type.startsWith('video') ? 'video' : 'image';
                }
            } catch (err) {
                console.warn('[MULTI_MEDIA_UPLOAD_WARN] Failed to upload media file:', file.name, err);
            }
            completed++;
        }
    }

    if (uploadedMediaUrl && !uploadedUrls.includes(uploadedMediaUrl)) {
        uploadedUrls.unshift(uploadedMediaUrl);
    }
    if (!uploadedMediaUrl && uploadedUrls.length > 0) {
        uploadedMediaUrl = uploadedUrls[0];
    }

    let resolvedPostType = PostType.Feed;
    const inputType = input.type?.toLowerCase();
    const isMomentInput = (
        inputType === 'moment' ||
        inputType === 'stills' ||
        inputType === 'tapes' ||
        inputType === 'knacks' ||
        Boolean(input.momentType)
    );

    if (isMomentInput) {
        resolvedPostType = PostType.Moment;
    } else if (inputType === 'showcase' || inputType === 'project') {
        resolvedPostType = PostType.Showcase;
    } else if (inputType === 'thread' || inputType === 'discover') {
        resolvedPostType = PostType.Thread;
    } else if (inputType === 'query') {
        resolvedPostType = PostType.Query;
    } else if (inputType === 'collab' || Boolean(input.collabDetails)) {
        resolvedPostType = PostType.Collab;
    } else {
        resolvedPostType = PostType.Feed;
    }

    // Resolve moment category if applicable
    let resolvedMomentType: 'Stills' | 'Tapes' | 'Knacks' | undefined = input.momentType;
    if (resolvedPostType === PostType.Moment && !resolvedMomentType) {
        if (inputType === 'tapes' || detectedMediaType === 'video') {
            resolvedMomentType = 'Tapes';
        } else if (inputType === 'knacks') {
            resolvedMomentType = 'Knacks';
        } else {
            resolvedMomentType = 'Stills';
        }
    }

    // Enforce channel requirement ONLY for actual Feed posts
    if (resolvedPostType === PostType.Feed && inputType === 'feed' && !input.channelId) {
        throw new Error('A Channel is required before publishing a Feed broadcast. Please select or create a channel.');
    }

    // Moments, Collabs & Showcases never require channel affiliations
    const isCollab = resolvedPostType === PostType.Collab;
    const isShowcase = resolvedPostType === PostType.Showcase;
    const isMoment = resolvedPostType === PostType.Moment;
    let finalChannelId = (isCollab || isShowcase || isMoment) ? null : (input.channelId || null);
    let finalChannelName = (isCollab || isShowcase || isMoment) ? null : (input.channelName || null);
    let finalChannelAvatar = (isCollab || isShowcase || isMoment) ? null : (input.channelAvatarUrl || null);

    if (!isCollab && !isShowcase && !isMoment && input.channelId && (!finalChannelName || !finalChannelAvatar)) {
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

    let cleanCollabDetails: Record<string, any> | null = null;
    if (input.collabDetails) {
        cleanCollabDetails = {
            roles: Array.isArray(input.collabDetails.roles)
                ? input.collabDetails.roles.map(r => {
                    const roleObj: any = {
                        id: r.id || `role-${Math.random().toString(36).substring(2, 9)}`,
                        title: r.title?.trim() || 'Collaborator',
                        count: Number(r.count) || 1,
                        skills: Array.isArray(r.skills) ? r.skills : [],
                    };
                    if (r.responsibilities && r.responsibilities.trim()) {
                        roleObj.responsibilities = r.responsibilities.trim();
                    }
                    return roleObj;
                })
                : [],
        };
        if (input.collabDetails.experience?.trim()) cleanCollabDetails.experience = input.collabDetails.experience.trim();
        if (input.collabDetails.background?.trim()) cleanCollabDetails.background = input.collabDetails.background.trim();
        if (input.collabDetails.availability?.trim()) cleanCollabDetails.availability = input.collabDetails.availability.trim();
        if (input.collabDetails.location?.trim()) cleanCollabDetails.location = input.collabDetails.location.trim();
        if (input.collabDetails.specificLocation?.trim()) cleanCollabDetails.specificLocation = input.collabDetails.specificLocation.trim();
        if (input.collabDetails.collabTypes && input.collabDetails.collabTypes.length > 0) cleanCollabDetails.collabTypes = input.collabDetails.collabTypes;
        if (input.collabDetails.projectStatus?.trim()) cleanCollabDetails.projectStatus = input.collabDetails.projectStatus.trim();
    }

    // Generate real AI summary if there is descriptive content and no explicit summary yet
    let aiSummaryText = (input.oneLine || '').trim();
    if (!aiSummaryText && input.content && input.content.trim().length > 40) {
        try {
            const generated = await generateSummary(input.content.trim());
            if (generated && generated.trim().length > 0) {
                aiSummaryText = generated.trim();
            }
        } catch (summaryErr) {
            console.warn('[AI_SUMMARY_GEN_WARN]', summaryErr);
        }
    }

    const postPayload = {
        channelId: finalChannelId,
        channelName: finalChannelName,
        channelAvatarUrl: finalChannelAvatar,
        authorId: currentUser.uid,
        author: {
            name: input.authorProfile?.displayName || currentUser.displayName || 'Invox Member',
            avatarUrl: input.authorProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
            username: input.authorProfile?.username || '',
            isVerified: input.authorProfile?.role === 'admin' || input.authorProfile?.role === 'moderator' || false,
        },
        title: input.title?.trim() || aiSummaryText || (input.content ? input.content.slice(0, 40) : 'Moment'),
        aiSummary: aiSummaryText || null,
        oneLine: aiSummaryText || null,
        content: (input.content || '').trim(),
        mediaUrl: uploadedMediaUrl || null,
        mediaUrls: uploadedUrls.length > 0 ? uploadedUrls : (uploadedMediaUrl ? [uploadedMediaUrl] : []),
        mediaType: detectedMediaType || null,
        thumbnailUrl: input.thumbnailUrl || (detectedMediaType === 'video' ? uploadedMediaUrl : null),
        demoUrl: input.demoUrl?.trim() || null,
        githubUrl: (input.githubUrl || input.repoUrl)?.trim() || null,
        repoUrl: (input.repoUrl || input.githubUrl)?.trim() || null,
        articleUrl: input.articleUrl?.trim() || null,
        status: input.status || 'published',
        isPublished: input.status !== 'draft',
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
        postType: resolvedPostType,
        momentType: resolvedMomentType || null,
        category: resolvedMomentType || input.domain || input.category || (isCollab ? 'Collab' : isShowcase ? 'Showcase' : isMoment ? 'Stills' : 'General'),
        domain: input.domain || input.category || resolvedMomentType || (isCollab ? 'Collab' : isShowcase ? 'Showcase' : isMoment ? 'Stills' : 'General'),
        tags: Array.isArray(input.tags) ? input.tags : [],
        visibility: input.visibility || 'public',
        collabDetails: cleanCollabDetails,
    };

    const newDocId = await createDocument(COLLECTIONS.posts, postPayload);
    console.log(`[POST_CREATED] Successfully created post ${newDocId} (type=${resolvedPostType}, momentType=${resolvedMomentType})`);

    // If channelId is present, increment channel post count
    if (finalChannelId) {
        incrementChannelPostCount(finalChannelId).catch(console.warn);
    }

    return normalizeFirestorePost(newDocId, {
        ...postPayload,
        createdAt: new Date(),
    });
};

/**
 * Updates an existing post in Firestore.
 * Preserves stats, likes, comments, author credentials, and existing engagement.
 */
export const updatePost = async (
    postId: string, 
    updates: Partial<CreatePostInput> & { domain?: string },
    onUploadProgress?: (progress: number) => void
): Promise<Post> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Unauthenticated: You must be signed in to edit a post.');

    const postRef = doc(db, COLLECTIONS.posts, postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) {
        throw new Error('Post does not exist.');
    }

    const existingData = postSnap.data();
    if (existingData.authorId && existingData.authorId !== currentUser.uid && existingData.author?.id !== currentUser.uid) {
        throw new Error('Permission denied: You may only edit posts that you authored.');
    }

    let uploadedMediaUrl: string | undefined = updates.mediaUrl !== undefined ? (updates.mediaUrl || undefined) : existingData.mediaUrl;
    let detectedMediaType: 'image' | 'video' | undefined = updates.mediaType !== undefined ? updates.mediaType : existingData.mediaType;

    // Handle new media file upload if provided
    if (updates.mediaFile) {
        try {
            const file = updates.mediaFile;
            const storagePath = getStoragePath('postMedia', currentUser.uid, file.name);
            const uploaded = await uploadFile(storagePath, file, {
                onProgress: (progress) => onUploadProgress?.(progress),
            });
            uploadedMediaUrl = uploaded.url;
            detectedMediaType = file.type.startsWith('video') ? 'video' : 'image';
        } catch (uploadErr) {
            console.warn('[POST_MEDIA_UPLOAD_WARN] Storage upload failed during edit, falling back:', uploadErr);
            if (updates.mediaUrl) {
                uploadedMediaUrl = updates.mediaUrl;
            }
        }
    }

    const updatePayload: Record<string, any> = {
        updatedAt: serverTimestamp(),
    };

    if (updates.title !== undefined) {
        updatePayload.title = updates.title.trim();
    }
    if (updates.oneLine !== undefined) {
        updatePayload.oneLine = updates.oneLine.trim();
        updatePayload.aiSummary = updates.oneLine.trim();
        if (updates.title === undefined && !existingData.title) {
            updatePayload.title = updates.oneLine.trim();
        }
    }
    if (updates.content !== undefined) {
        updatePayload.content = updates.content.trim();
    }
    if (updates.category !== undefined) {
        updatePayload.category = updates.category.trim();
        updatePayload.domain = updates.domain ? updates.domain.trim() : updates.category.trim();
    } else if (updates.domain !== undefined) {
        updatePayload.domain = updates.domain.trim();
        updatePayload.category = updates.domain.trim();
    }

    if (updates.tags !== undefined) {
        updatePayload.tags = Array.isArray(updates.tags) ? updates.tags : [];
    }

    if (updates.demoUrl !== undefined) {
        updatePayload.demoUrl = updates.demoUrl ? updates.demoUrl.trim() : null;
    }
    if (updates.githubUrl !== undefined || updates.repoUrl !== undefined) {
        const link = (updates.githubUrl || updates.repoUrl)?.trim() || null;
        updatePayload.githubUrl = link;
        updatePayload.repoUrl = link;
    }
    if (updates.articleUrl !== undefined) {
        updatePayload.articleUrl = updates.articleUrl ? updates.articleUrl.trim() : null;
    }
    if (updates.status !== undefined) {
        updatePayload.status = updates.status;
        updatePayload.isPublished = updates.status !== 'draft';
    }

    // Media update handling
    if (updates.mediaFile || updates.mediaUrl !== undefined) {
        updatePayload.mediaUrl = uploadedMediaUrl || null;
        updatePayload.mediaType = detectedMediaType || null;
    }

    if (updates.thumbnailUrl !== undefined) {
        updatePayload.thumbnailUrl = updates.thumbnailUrl || null;
    }

    // Channel update handling (for Feeds)
    if (updates.channelId !== undefined) {
        const oldChannelId = existingData.channelId;
        const newChannelId = updates.channelId || null;

        updatePayload.channelId = newChannelId;
        updatePayload.channelName = updates.channelName || null;
        updatePayload.channelAvatarUrl = updates.channelAvatarUrl || null;

        if (newChannelId && (!updatePayload.channelName || !updatePayload.channelAvatarUrl)) {
            try {
                const ch = await getChannelById(newChannelId);
                if (ch) {
                    updatePayload.channelName = updatePayload.channelName || ch.name;
                    updatePayload.channelAvatarUrl = updatePayload.channelAvatarUrl || ch.avatarUrl || null;
                }
            } catch (e) {
                console.warn('[CHANNEL_LOOKUP_WARN]', e);
            }
        }

        // Adjust post counts if channel changed
        if (oldChannelId !== newChannelId) {
            if (oldChannelId) decrementChannelPostCount(oldChannelId).catch(console.warn);
            if (newChannelId) incrementChannelPostCount(newChannelId).catch(console.warn);
        }
    }

    // Collab details update handling
    if (updates.collabDetails !== undefined) {
        if (updates.collabDetails === null) {
            updatePayload.collabDetails = null;
        } else {
            const cleanCollabDetails: Record<string, any> = {
                roles: Array.isArray(updates.collabDetails.roles)
                    ? updates.collabDetails.roles.map(r => {
                        const roleObj: any = {
                            id: r.id || `role-${Math.random().toString(36).substring(2, 9)}`,
                            title: r.title?.trim() || 'Collaborator',
                            count: Number(r.count) || 1,
                            skills: Array.isArray(r.skills) ? r.skills : [],
                        };
                        if (r.responsibilities && r.responsibilities.trim()) {
                            roleObj.responsibilities = r.responsibilities.trim();
                        }
                        return roleObj;
                    })
                    : [],
            };
            if (updates.collabDetails.experience?.trim()) cleanCollabDetails.experience = updates.collabDetails.experience.trim();
            if (updates.collabDetails.background?.trim()) cleanCollabDetails.background = updates.collabDetails.background.trim();
            if (updates.collabDetails.availability?.trim()) cleanCollabDetails.availability = updates.collabDetails.availability.trim();
            if (updates.collabDetails.location?.trim()) cleanCollabDetails.location = updates.collabDetails.location.trim();
            if (updates.collabDetails.specificLocation?.trim()) cleanCollabDetails.specificLocation = updates.collabDetails.specificLocation.trim();
            if (Array.isArray(updates.collabDetails.collabTypes)) cleanCollabDetails.collabTypes = updates.collabDetails.collabTypes;
            if (updates.collabDetails.projectStatus?.trim()) cleanCollabDetails.projectStatus = updates.collabDetails.projectStatus.trim();

            updatePayload.collabDetails = cleanCollabDetails;
        }
    }

    await updateDoc(postRef, updatePayload);
    console.log(`[POST_UPDATED] Successfully updated post document: ${postId}`);

    const updatedMerged = {
        ...existingData,
        ...updatePayload,
        updatedAt: new Date(),
    };

    return normalizeFirestorePost(postId, updatedMerged);
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
 * Fetches a single post by ID.
 */
export const getPostById = async (postId: string): Promise<Post | null> => {
    try {
        const postRef = doc(db, COLLECTIONS.posts, postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return null;
        return normalizeFirestorePost(postSnap.id, postSnap.data());
    } catch (err) {
        console.warn(`[GET_POST_BY_ID_ERROR] Could not fetch post ${postId}:`, err);
        return null;
    }
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

// ==========================================
// Demo Data Session State Helpers
// ==========================================
const getDemoLikes = (userId?: string): Set<string> => {
    try {
        const raw = sessionStorage.getItem(`invox_demo_likes_${userId || 'anon'}`);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
};

const saveDemoLikes = (set: Set<string>, userId?: string) => {
    try {
        sessionStorage.setItem(`invox_demo_likes_${userId || 'anon'}`, JSON.stringify(Array.from(set)));
    } catch {}
};

const getDemoBookmarks = (userId?: string): Set<string> => {
    try {
        const raw = sessionStorage.getItem(`invox_demo_bookmarks_${userId || 'anon'}`);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
};

const saveDemoBookmarks = (set: Set<string>, userId?: string) => {
    try {
        sessionStorage.setItem(`invox_demo_bookmarks_${userId || 'anon'}`, JSON.stringify(Array.from(set)));
    } catch {}
};

/**
 * Toggles like on a post.
 * Uses deterministic document ID `${userId}_${postId}` in the 'likes' collection.
 * Purely isolates mock/demo posts from touching Firestore.
 */
export const toggleLikePost = async (postId: string): Promise<{ liked: boolean; newCount: number }> => {
    if (postId.startsWith('demo-')) {
        const userId = auth.currentUser?.uid || 'anon';
        const demoLikes = getDemoLikes(userId);
        let liked = false;
        let newCount = 0;
        if (demoLikes.has(postId)) {
            demoLikes.delete(postId);
            liked = false;
            newCount = -1;
        } else {
            demoLikes.add(postId);
            liked = true;
            newCount = 1;
        }
        saveDemoLikes(demoLikes, userId);
        return { liked, newCount };
    }

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
 * Purely isolates mock/demo posts from touching Firestore.
 */
export const toggleBookmarkPost = async (postId: string): Promise<{ saved: boolean }> => {
    if (postId.startsWith('demo-')) {
        const userId = auth.currentUser?.uid || 'anon';
        const demoBookmarks = getDemoBookmarks(userId);
        let saved = false;
        if (demoBookmarks.has(postId)) {
            demoBookmarks.delete(postId);
            saved = false;
        } else {
            demoBookmarks.add(postId);
            saved = true;
        }
        saveDemoBookmarks(demoBookmarks, userId);
        window.dispatchEvent(new CustomEvent('invox_demo_bookmark_changed'));
        return { saved };
    }

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
 * Fetches all liked post IDs for the current user (including isolated demo likes).
 */
export const getUserLikedPostIds = async (userId: string): Promise<Set<string>> => {
    const ids = new Set<string>();
    const demoLikes = getDemoLikes(userId);
    demoLikes.forEach(id => ids.add(id));

    if (!userId) return ids;

    try {
        const q = query(collection(db, COLLECTIONS.likes), where('userId', '==', userId));
        const snap = await getDocs(q);
        snap.forEach(d => {
            const data = d.data();
            if (data.postId) ids.add(data.postId);
        });
        return ids;
    } catch (e) {
        console.warn('Failed to fetch user likes:', e);
        return ids;
    }
};

/**
 * Fetches all saved / bookmarked post IDs for the current user (including isolated demo bookmarks).
 */
export const getUserSavedPostIds = async (userId: string): Promise<Set<string>> => {
    const ids = new Set<string>();
    const demoBookmarks = getDemoBookmarks(userId);
    demoBookmarks.forEach(id => ids.add(id));

    if (!userId) return ids;

    try {
        const q = query(collection(db, COLLECTIONS.bookmarks), where('userId', '==', userId));
        const snap = await getDocs(q);
        snap.forEach(d => {
            const data = d.data();
            if (data.postId) ids.add(data.postId);
        });
        return ids;
    } catch (e) {
        console.warn('Failed to fetch user bookmarks:', e);
        return ids;
    }
};

/**
 * Real-time subscription to user saved / bookmarked post IDs.
 * Ensures synchronized saved state across all Spotlight views and sessions,
 * while safely supporting demo bookmarks without writing mock IDs to Firestore.
 */
export const subscribeToUserSavedPostIds = (
    userId: string,
    onIds: (ids: Set<string>) => void,
    onError?: (err: Error) => void
) => {
    let firestoreIds = new Set<string>();

    const emitSaved = () => {
        const combined = new Set<string>(firestoreIds);
        const demoBookmarks = getDemoBookmarks(userId);
        demoBookmarks.forEach(id => combined.add(id));
        onIds(combined);
    };

    const handleDemoBookmark = () => {
        emitSaved();
    };
    window.addEventListener('invox_demo_bookmark_changed', handleDemoBookmark);

    // Initial emission
    emitSaved();

    if (!userId) {
        return () => {
            window.removeEventListener('invox_demo_bookmark_changed', handleDemoBookmark);
        };
    }

    const q = query(
        collection(db, COLLECTIONS.bookmarks),
        where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
        q,
        (snap) => {
            firestoreIds = new Set<string>();
            snap.forEach(d => {
                const data = d.data();
                if (data.postId) firestoreIds.add(data.postId);
            });
            emitSaved();
        },
        (err) => {
            console.error('[SUBSCRIBE_USER_SAVED_POSTS_ERROR]', err);
            onError?.(err);
        }
    );

    return () => {
        window.removeEventListener('invox_demo_bookmark_changed', handleDemoBookmark);
        unsubscribe();
    };
};

/**
 * Retrieves a single Showcase Project by ID directly from Firestore.
 */
export const getShowcaseProjectById = async (postId: string): Promise<Project | null> => {
    if (!postId) return null;
    try {
        const postRef = doc(db, COLLECTIONS.posts, postId);
        const snap = await getDoc(postRef);
        if (snap.exists()) {
            const data = snap.data();
            const normalized = normalizeFirestorePost(snap.id, data);
            return postToShowcaseProject(normalized);
        }
    } catch (e) {
        console.warn(`[GET_PROJECT_BY_ID_WARN] Failed to fetch project ${postId}:`, e);
    }
    return null;
};

// ==========================================
// Robust Post View Deduplication Policy
// ==========================================
const sessionViewedPostIds = new Set<string>();
const VIEW_STORAGE_KEY = 'invox_viewed_posts_v1';
const VIEW_WINDOW_MS = 12 * 60 * 60 * 1000; // 12-hour session deduplication window

/**
 * Checks whether the post has already been counted as viewed by this client/session.
 */
export const isPostViewRecorded = (postId: string): boolean => {
    if (!postId) return true;
    if (sessionViewedPostIds.has(postId)) return true;

    try {
        const raw = sessionStorage.getItem(VIEW_STORAGE_KEY) || localStorage.getItem(VIEW_STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            const timestamp = data[postId];
            if (timestamp && Date.now() - timestamp < VIEW_WINDOW_MS) {
                sessionViewedPostIds.add(postId);
                return true;
            }
        }
    } catch {
        // Storage unreadable/disabled, rely on memory set
    }
    return false;
};

/**
 * Persists the view marker in memory and storage to ensure idempotency.
 */
export const markPostViewRecorded = (postId: string): void => {
    if (!postId) return;
    sessionViewedPostIds.add(postId);
    try {
        const raw = localStorage.getItem(VIEW_STORAGE_KEY);
        const data: Record<string, number> = raw ? JSON.parse(raw) : {};
        data[postId] = Date.now();
        
        // Cap items in storage to avoid unbounded growth
        const entries = Object.entries(data);
        if (entries.length > 500) {
            const trimmed = Object.fromEntries(entries.slice(entries.length - 400));
            const serialized = JSON.stringify(trimmed);
            localStorage.setItem(VIEW_STORAGE_KEY, serialized);
            sessionStorage.setItem(VIEW_STORAGE_KEY, serialized);
        } else {
            const serialized = JSON.stringify(data);
            localStorage.setItem(VIEW_STORAGE_KEY, serialized);
            sessionStorage.setItem(VIEW_STORAGE_KEY, serialized);
        }
    } catch {
        // Storage quota / private mode fallback
    }
};

/**
 * Increments view count for a post with strict deduplication.
 * Returns true if a view was legitimately counted and recorded, or false if already counted.
 */
export const incrementPostView = async (postId: string): Promise<boolean> => {
    if (!postId) return false;

    // 1. Concurrency-safe deduplication check
    if (isPostViewRecorded(postId)) {
        return false;
    }

    // 2. Mark as recorded synchronously BEFORE async Firestore call to eliminate race conditions
    markPostViewRecorded(postId);

    // 3. Demo / Mock posts are isolated from Firestore
    if (postId.startsWith('demo-')) {
        return true;
    }

    // 4. Atomically update Firestore for real posts
    try {
        const postRef = doc(db, COLLECTIONS.posts, postId);
        await updateDoc(postRef, {
            'stats.views': increment(1),
            viewCount: increment(1),
        });
        return true;
    } catch (e) {
        // If Firestore write fails (e.g. offline, security rules), don't throw
        return false;
    }
};

/**
 * Transforms a Post into a Project format for Spotlight Showcase and Collabs.
 */
export const postToProject = (post: Post): Project => {
    const rawRoles = post.collabDetails?.roles;
    const cleanRoles = Array.isArray(rawRoles)
        ? rawRoles
        : (rawRoles && typeof rawRoles === 'object' ? Object.values(rawRoles) : []);

    const safeCollabDetails = post.collabDetails ? {
        ...post.collabDetails,
        roles: cleanRoles,
    } : undefined;

    return {
        id: post.id,
        authorId: post.authorId,
        author: {
            name: post.author?.name || 'Invox Member',
            avatarUrl: post.author?.avatarUrl || `https://picsum.photos/seed/${post.authorId || post.id}/200`,
            username: post.author?.username || undefined,
            isVerified: Boolean(post.author?.isVerified),
            id: post.author?.id || post.authorId,
            uid: post.author?.uid || post.authorId,
        },
        title: post.title || (post as any).collabTitle || (post as any).projectTitle || post.oneLine || post.aiSummary || 'Untitled Collab',
        name: post.title || (post as any).collabTitle || (post as any).projectTitle || post.oneLine || post.aiSummary || 'Untitled Collab',
        aiSummary: post.aiSummary || post.oneLine || 'Collaboration Signal',
        oneLine: post.oneLine || post.hook || post.aiSummary || '',
        hook: post.hook || post.oneLine || post.aiSummary || '',
        description: post.content || '',
        mediaUrl: post.mediaUrl || undefined,
        mediaType: post.mediaType || (post.mediaUrl ? (post.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image') : undefined),
        thumbnailUrl: post.thumbnailUrl || undefined,
        stats: {
            likes: Number(post.stats?.likes ?? post.likeCount ?? 0),
            views: Number(post.stats?.views ?? post.viewCount ?? 0),
            comments: Number(post.stats?.comments ?? post.commentCount ?? 0),
        },
        category: post.domain || post.category || 'Technology',
        domain: post.domain || post.category || 'Technology',
        createdAt: post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt || Date.now()),
        collabDetails: safeCollabDetails,
    };
};

/**
 * Checks if a normalized post or raw Firestore post data represents a Collab signal.
 */
export const isCollabSignal = (post: Post, rawData?: any): boolean => {
    const typeStr = (post.type || post.postType || rawData?.type || rawData?.postType || '').toString().toLowerCase();
    const catStr = (post.category || rawData?.category || '').toString().toLowerCase();
    const domStr = (post.domain || rawData?.domain || '').toString().toLowerCase();
    return (
        typeStr === 'collab' ||
        catStr === 'collab' ||
        domStr === 'collab' ||
        Boolean(post.collabDetails) ||
        Boolean(rawData?.collabDetails)
    );
};

/**
 * Fetches Collab posts across the network (for initial Spotlight -> Collabs load).
 */
export const getCollabPosts = async (): Promise<Post[]> => {
    try {
        const q = query(
            collection(db, COLLECTIONS.posts),
            limit(100)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .filter(docSnap => {
                const data = docSnap.data();
                return isCollabSignal(normalizeFirestorePost(docSnap.id, data), data);
            })
            .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
            .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });
    } catch (err) {
        console.warn('[GET_COLLAB_POSTS_WARN]', err);
        return [];
    }
};

/**
 * Subscribes to real-time Collab posts across the network (for Spotlight -> Collabs).
 */
export const subscribeToCollabPosts = (
    onPosts: (posts: Post[]) => void,
    onError?: (error: Error) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.posts),
        limit(100)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const posts = snapshot.docs
                .filter(docSnap => {
                    const data = docSnap.data();
                    return isCollabSignal(normalizeFirestorePost(docSnap.id, data), data);
                })
                .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
                .sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                    return dateB - dateA;
                });
            console.log(`[SPOTLIGHT_COLLABS] Live Collabs update: found ${posts.length} collabs`);
            onPosts(posts);
        },
        (err) => {
            console.error('[COLLAB_POSTS_SUBSCRIBE_ERROR]', err);
            onError?.(err);
        }
    );
};

/**
 * Checks if a normalized post or raw Firestore post data represents a Showcase project.
 */
export const isShowcasePost = (post: Post, rawData?: any): boolean => {
    const typeStr = (post.type || post.postType || rawData?.type || rawData?.postType || '').toString().toLowerCase();
    const catStr = (post.category || rawData?.category || '').toString().toLowerCase();
    const domStr = (post.domain || rawData?.domain || '').toString().toLowerCase();
    return (
        typeStr === 'showcase' ||
        catStr === 'showcase' ||
        domStr === 'showcase' ||
        Boolean(post.demoUrl) ||
        Boolean(post.githubUrl) ||
        Boolean(rawData?.demoUrl) ||
        Boolean(rawData?.githubUrl) ||
        Boolean(rawData?.isProject)
    );
};

/**
 * Transforms a Post into a Project format for Spotlight Showcase.
 */
export const postToShowcaseProject = (post: Post): Project => {
    return {
        id: post.id,
        authorId: post.authorId,
        author: {
            name: post.author?.name || 'Invox Member',
            avatarUrl: post.author?.avatarUrl || `https://picsum.photos/seed/${post.authorId || post.id}/200`,
            username: post.author?.username || undefined,
            isVerified: Boolean(post.author?.isVerified),
            id: post.author?.id || post.authorId,
            uid: post.author?.uid || post.authorId,
        },
        title: post.title || post.oneLine || post.aiSummary || 'Untitled Project',
        name: post.title || post.oneLine || post.aiSummary || 'Untitled Project',
        aiSummary: post.oneLine || post.aiSummary || '',
        oneLine: post.oneLine || post.hook || post.aiSummary || '',
        hook: post.hook || post.oneLine || post.aiSummary || '',
        description: post.content || '',
        mediaUrl: post.mediaUrl || undefined,
        mediaType: post.mediaType || (post.mediaUrl ? (post.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image') : undefined),
        thumbnailUrl: post.thumbnailUrl || undefined,
        demoUrl: post.demoUrl || undefined,
        githubUrl: post.githubUrl || post.repoUrl || undefined,
        repoUrl: post.repoUrl || post.githubUrl || undefined,
        articleUrl: post.articleUrl || undefined,
        status: post.status || 'published',
        isPublished: post.isPublished !== undefined ? post.isPublished : (post.status !== 'draft'),
        tags: Array.isArray(post.tags) ? post.tags : [],
        stats: {
            likes: Number(post.stats?.likes ?? post.likeCount ?? 0),
            views: Number(post.stats?.views ?? post.viewCount ?? 0),
            comments: Number(post.stats?.comments ?? post.commentCount ?? 0),
        },
        likeCount: Number(post.likeCount ?? post.stats?.likes ?? 0),
        viewCount: Number(post.viewCount ?? post.stats?.views ?? 0),
        commentCount: Number(post.commentCount ?? post.stats?.comments ?? 0),
        saveCount: Number(post.saveCount ?? 0),
        category: post.domain || post.category || 'Technology',
        domain: post.domain || post.category || 'Technology',
        createdAt: post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt || Date.now()),
        updatedAt: post.updatedAt instanceof Date ? post.updatedAt : post.updatedAt ? new Date(post.updatedAt) : undefined,
        collabDetails: post.collabDetails,
    };
};

/**
 * Transforms a Project back into a Post format for comments, modals, and updates.
 */
export const projectToPost = (proj: Project): Post => {
    return {
        id: proj.id,
        authorId: proj.authorId || proj.author?.id || proj.author?.uid,
        author: {
            name: proj.author.name,
            avatarUrl: proj.author.avatarUrl,
            username: proj.author.username,
            isVerified: proj.author.isVerified,
            id: proj.author.id || proj.authorId,
            uid: proj.author.uid || proj.authorId,
        },
        title: proj.title || proj.name || proj.aiSummary || 'Untitled Project',
        aiSummary: proj.aiSummary || proj.oneLine || '',
        oneLine: proj.oneLine || proj.aiSummary || '',
        content: proj.description || '',
        mediaUrl: proj.mediaUrl,
        mediaType: proj.mediaType,
        thumbnailUrl: proj.thumbnailUrl,
        demoUrl: proj.demoUrl,
        githubUrl: proj.githubUrl || proj.repoUrl,
        repoUrl: proj.repoUrl || proj.githubUrl,
        articleUrl: proj.articleUrl,
        status: proj.status || 'published',
        isPublished: proj.isPublished !== undefined ? proj.isPublished : (proj.status !== 'draft'),
        stats: {
            likes: Number(proj.stats?.likes ?? proj.likeCount ?? 0),
            views: Number(proj.stats?.views ?? proj.viewCount ?? 0),
            comments: Number(proj.stats?.comments ?? proj.commentCount ?? 0),
        },
        likeCount: Number(proj.likeCount ?? proj.stats?.likes ?? 0),
        viewCount: Number(proj.viewCount ?? proj.stats?.views ?? 0),
        commentCount: Number(proj.commentCount ?? proj.stats?.comments ?? 0),
        saveCount: Number(proj.saveCount ?? 0),
        type: PostType.Showcase,
        postType: PostType.Showcase,
        category: proj.category || 'Technology',
        domain: proj.domain || proj.category || 'Technology',
        tags: proj.tags || [],
        visibility: 'public',
        createdAt: proj.createdAt instanceof Date ? proj.createdAt : new Date(proj.createdAt || Date.now()),
        updatedAt: proj.updatedAt,
        collabDetails: proj.collabDetails,
        userLiked: proj.userLiked,
        userSaved: proj.userSaved,
    };
};

/**
 * Fetches Showcase posts from Firestore.
 */
export const getShowcasePosts = async (category?: string): Promise<Post[]> => {
    try {
        const q = query(
            collection(db, COLLECTIONS.posts),
            limit(100)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .filter(docSnap => {
                const data = docSnap.data();
                const norm = normalizeFirestorePost(docSnap.id, data);
                if (!isShowcasePost(norm, data)) return false;
                if (norm.status === 'draft') {
                    // Only show draft if author is current user
                    const currentUid = auth.currentUser?.uid;
                    if (!currentUid || norm.authorId !== currentUid) return false;
                }
                if (category && category !== 'All') {
                    const catLower = category.toLowerCase();
                    const postCat = (norm.category || norm.domain || '').toLowerCase();
                    const postDom = (norm.domain || '').toLowerCase();
                    return postCat.includes(catLower) || postDom.includes(catLower);
                }
                return true;
            })
            .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
            .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });
    } catch (err) {
        console.warn('[GET_SHOWCASE_POSTS_WARN]', err);
        return [];
    }
};

/**
 * Subscribes to real-time Showcase posts across the network for Spotlight Showcase.
 */
export const subscribeToShowcasePosts = (
    onPosts: (posts: Post[]) => void,
    onError?: (error: Error) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.posts),
        limit(100)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const currentUid = auth.currentUser?.uid;
            const posts = snapshot.docs
                .filter(docSnap => {
                    const data = docSnap.data();
                    const norm = normalizeFirestorePost(docSnap.id, data);
                    if (!isShowcasePost(norm, data)) return false;
                    if (norm.status === 'draft') {
                        // Drafts only visible to author
                        if (!currentUid || norm.authorId !== currentUid) return false;
                    }
                    return true;
                })
                .map(docSnap => normalizeFirestorePost(docSnap.id, docSnap.data()))
                .sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                    return dateB - dateA;
                });
            console.log(`[SPOTLIGHT_SHOWCASE] Live Showcase update: found ${posts.length} posts`);
            onPosts(posts);
        },
        (err) => {
            console.error('[SHOWCASE_POSTS_SUBSCRIBE_ERROR]', err);
            onError?.(err);
        }
    );
};

// Initial seed data to populate Firestore with real persistent projects if the collection is empty
const INITIAL_SHOWCASE_SEEDS = [
    {
        title: 'Deepfake Sentinel Toolkit',
        oneLine: 'Open-source toolkit for detecting deepfakes across audio and video.',
        content: 'A powerful, accessible library for developers and researchers to detect and analyze manipulated media. Leveraging state-of-the-art vision transformers and spectrogram residual models, the toolkit provides high-accuracy anomaly scores for synthetic media detection in real-time pipelines.',
        category: 'Cybersecurity',
        domain: 'Cybersecurity',
        tags: ['Cybersecurity', 'AI', 'DeepLearning', 'Python', 'OpenSource'],
        mediaUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image' as const,
        demoUrl: 'https://sentinel-deepfake.dev',
        githubUrl: 'https://github.com/invox-network/deepfake-sentinel',
        repoUrl: 'https://github.com/invox-network/deepfake-sentinel',
        articleUrl: 'https://arxiv.org/abs/2401.09123',
        author: {
            name: 'Aisha Bello',
            username: 'abello',
            avatarUrl: 'https://picsum.photos/id/22/200/200',
            isVerified: true,
        },
        stats: { likes: 132, views: 2450, comments: 24 },
    },
    {
        title: 'NeuroLingua VR: Immersive Spatial Language Lab',
        oneLine: 'Gamified language learning app using WebXR and reactive AI agents.',
        content: 'An immersive virtual reality environment that makes mastering new languages feel like exploration. Users converse with conversational AI personas with speech phoneme evaluation, contextual visual cues, and spatial audio feedback.',
        category: 'App Development',
        domain: 'App Development',
        tags: ['WebXR', 'React', 'Three.js', 'EdTech', 'LanguageAI'],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        mediaType: 'video' as const,
        thumbnailUrl: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?q=80&w=1280&h=720&auto=format&fit=crop',
        demoUrl: 'https://neurolingua.io',
        githubUrl: 'https://github.com/invox-network/neurolingua-vr',
        repoUrl: 'https://github.com/invox-network/neurolingua-vr',
        author: {
            name: 'Kenji Tanaka',
            username: 'ktanaka',
            avatarUrl: 'https://picsum.photos/id/21/200/200',
            isVerified: true,
        },
        stats: { likes: 115, views: 3200, comments: 19 },
    },
    {
        title: 'Aetheria Protocol: Decentralized Network with Ethical AI',
        oneLine: 'A decentralized social substrate powered by transparent, verifiable AI.',
        content: 'A novel protocol combining zero-knowledge identity proofs, decentralized storage, and client-side verifiable inference for content moderation. Users retain complete sovereignty over their data graphs while enjoying robust anti-sybil protections.',
        category: 'Machine Learning',
        domain: 'Machine Learning',
        tags: ['Web3', 'EthicalAI', 'ZeroKnowledge', 'Decentralized', 'Cryptography'],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        mediaType: 'video' as const,
        thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/maxresdefault.jpg',
        demoUrl: 'https://aetheria-network.eth.limo',
        githubUrl: 'https://github.com/invox-network/aetheria-protocol',
        repoUrl: 'https://github.com/invox-network/aetheria-protocol',
        articleUrl: 'https://mirror.xyz/aetheria/whitepaper-v1',
        author: {
            name: 'Crash Adams',
            username: 'cadams',
            avatarUrl: 'https://picsum.photos/id/10/200/200',
            isVerified: true,
        },
        stats: { likes: 87, views: 1890, comments: 11 },
    },
    {
        title: 'Chronos Reactive Engine',
        oneLine: 'Ultra-low overhead cross-platform reactive framework with sub-millisecond dispatch.',
        content: 'Engineered from scratch in TypeScript with zero runtime dependencies. Features fine-grained reactivity, observable dependency trees, and ahead-of-time DOM graph compilation that outpaces standard virtual DOM approaches.',
        category: 'App Development',
        domain: 'App Development',
        tags: ['TypeScript', 'Compiler', 'Reactive', 'Framework', 'Frontend'],
        mediaUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image' as const,
        demoUrl: 'https://chronos-engine.dev',
        githubUrl: 'https://github.com/invox-network/chronos-reactive',
        repoUrl: 'https://github.com/invox-network/chronos-reactive',
        author: {
            name: 'Marco Rossi',
            username: 'mrossi',
            avatarUrl: 'https://picsum.photos/id/12/200/200',
            isVerified: false,
        },
        stats: { likes: 72, views: 1420, comments: 8 },
    },
    {
        title: 'Prism UI: Accessible Design Tokens & Micro-Interactions Engine',
        oneLine: 'A resilient, WCAG AAA compliant design system for multi-tenant applications.',
        content: 'An enterprise design system and token management library designed for rapid theming and high-density information interfaces. Includes audited keyboard navigation, contrast adaptors, and high-performance SVG animations.',
        category: 'Design',
        domain: 'Design',
        tags: ['DesignSystem', 'UI/UX', 'Accessibility', 'Tokens', 'React'],
        mediaUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image' as const,
        demoUrl: 'https://prism-design.system',
        githubUrl: 'https://github.com/invox-network/prism-ui',
        repoUrl: 'https://github.com/invox-network/prism-ui',
        author: {
            name: 'Chloe Bennet',
            username: 'chloeb',
            avatarUrl: 'https://picsum.photos/id/15/200/200',
            isVerified: true,
        },
        stats: { likes: 89, views: 2100, comments: 16 },
    },
    {
        title: 'Music Haze Streaming Experience',
        oneLine: 'A visually stunning and modern UI for next-gen music streaming.',
        content: 'An immersive sonic streaming interface focusing on high-contrast neon visualizers, dynamic typography palettes, and gesture-driven acoustic filtering.',
        category: 'UI & UX Design',
        domain: 'UI & UX Design',
        tags: ['UI/UX', 'Figma', 'DesignSystem', 'Music', 'Streaming'],
        mediaUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image' as const,
        demoUrl: 'https://musichaze.invox.dev',
        githubUrl: 'https://github.com/invox-network/music-haze-ui',
        repoUrl: 'https://github.com/invox-network/music-haze-ui',
        author: {
            name: 'Music Haze',
            username: 'musichaze',
            avatarUrl: 'https://picsum.photos/seed/musichaze/200',
            isVerified: true,
        },
        stats: { likes: 152, views: 3400, comments: 28 },
    },
    {
        title: 'Fintech Velocity Dashboard',
        oneLine: 'Sleek and professional dashboard for a global fintech platform.',
        content: 'High-density algorithmic analytics interface crafted for treasury operations, global FX settlements, and real-time yield monitoring.',
        category: 'UI & UX Design',
        domain: 'UI & UX Design',
        tags: ['Fintech', 'Dashboard', 'Analytics', 'Enterprise', 'UI/UX'],
        mediaUrl: 'https://images.unsplash.com/photo-1642139425433-e38000413346?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image' as const,
        demoUrl: 'https://velocity-fintech.dev',
        author: {
            name: 'Fintech Solutions',
            username: 'fintechsolutions',
            avatarUrl: 'https://picsum.photos/seed/fintechsolutions/200',
            isVerified: false,
        },
        stats: { likes: 125, views: 2890, comments: 14 },
    },
    {
        title: 'Elegant Mind Surreal Art Series',
        oneLine: 'A surreal and elegant artwork exploring geometric perception.',
        content: 'A series of surreal digital illustrations combining brutalist architecture with organic floral textures, examining cognitive synthesis.',
        category: 'Graphic Design',
        domain: 'Graphic Design',
        tags: ['GraphicDesign', 'Surrealism', 'Branding', 'Typography'],
        mediaUrl: 'https://images.unsplash.com/photo-1535378620166-273708d44e4c?q=80&w=1964&auto=format&fit=crop',
        mediaType: 'image' as const,
        author: {
            name: 'Elegant Mind',
            username: 'elegantmind',
            avatarUrl: 'https://picsum.photos/seed/elegantmind/200',
            isVerified: true,
        },
        stats: { likes: 210, views: 4200, comments: 35 },
    },
    {
        title: 'Cyber Visions: 3D Android Explorer',
        oneLine: 'A photorealistic 3D sci-fi character rendered with custom shaders.',
        content: 'Constructed in Blender and rendered in real-time WebGL using subsurface scattering and metallic anisotropy. Designed for interactive spatial environments.',
        category: '3D Art',
        domain: '3D Art',
        tags: ['3D', 'Blender', 'CGI', 'WebGL', 'CharacterDesign'],
        mediaUrl: 'https://images.unsplash.com/photo-1690575317136-234288b8e0a2?q=80&w=1964&auto=format&fit=crop',
        mediaType: 'image' as const,
        demoUrl: 'https://cybervisions-3d.dev',
        author: {
            name: 'Cyber Visions',
            username: 'cybervisions',
            avatarUrl: 'https://picsum.photos/seed/cybervisions/200',
            isVerified: true,
        },
        stats: { likes: 256, views: 5100, comments: 42 },
    }
];

let hasSeededShowcase = false;

/**
 * Seeds initial showcase projects into Firestore if none exist yet.
 * Ensures the platform always has real, persistent, interactable showcase projects.
 */
export const seedInitialShowcasePostsIfEmpty = async (): Promise<void> => {
    if (hasSeededShowcase) return;
    hasSeededShowcase = true;

    try {
        const q = query(
            collection(db, COLLECTIONS.posts),
            limit(10)
        );
        const snap = await getDocs(q);
        const existingShowcase = snap.docs.some(d => {
            const data = d.data();
            const norm = normalizeFirestorePost(d.id, data);
            return isShowcasePost(norm, data);
        });

        if (existingShowcase) {
            console.log('[SHOWCASE_SEED] Firestore already contains showcase projects.');
            return;
        }

        console.log('[SHOWCASE_SEED] Seeding initial Showcase projects to Firestore...');
        for (const item of INITIAL_SHOWCASE_SEEDS) {
            const payload = {
                title: item.title,
                aiSummary: item.oneLine,
                oneLine: item.oneLine,
                content: item.content,
                category: item.category,
                domain: item.domain,
                tags: item.tags,
                mediaUrl: item.mediaUrl,
                mediaType: item.mediaType,
                thumbnailUrl: (item as any).thumbnailUrl || null,
                demoUrl: item.demoUrl,
                githubUrl: item.githubUrl,
                repoUrl: item.repoUrl,
                articleUrl: (item as any).articleUrl || null,
                status: 'published',
                isPublished: true,
                type: PostType.Showcase,
                postType: PostType.Showcase,
                isProject: true,
                authorId: `seed_${item.author.username}`,
                author: item.author,
                stats: item.stats,
                likeCount: item.stats.likes,
                viewCount: item.stats.views,
                commentCount: item.stats.comments,
                saveCount: 5,
                createdAt: serverTimestamp(),
            };
            await createDocument(COLLECTIONS.posts, payload);
        }
        console.log('[SHOWCASE_SEED] Successfully seeded initial Showcase projects.');
    } catch (seedErr) {
        console.warn('[SHOWCASE_SEED_WARN] Could not seed showcase posts:', seedErr);
    }
};

// ==========================================
// Moments (Hub -> Stream -> Moments)
// ==========================================

/**
 * Checks if a normalized post or raw Firestore post data represents a Moment.
 */
export const isMomentPost = (post: Post, rawData?: any): boolean => {
    const typeStr = (post.type || post.postType || rawData?.type || rawData?.postType || '').toString().toLowerCase();
    const catStr = (post.category || rawData?.category || '').toString().toLowerCase();
    const momentTypeStr = (post.momentType || rawData?.momentType || '').toString().toLowerCase();
    return (
        typeStr === 'moment' ||
        typeStr === 'still' ||
        typeStr === 'tape' ||
        typeStr === 'knack' ||
        catStr === 'stills' ||
        catStr === 'tapes' ||
        catStr === 'knacks' ||
        Boolean(post.momentType) ||
        Boolean(rawData?.momentType) ||
        momentTypeStr === 'stills' ||
        momentTypeStr === 'tapes' ||
        momentTypeStr === 'knacks'
    );
};

/**
 * Transforms a Post into a StreamMoment format for the Moments feed.
 */
export const postToMoment = (post: Post): StreamMoment => {
    const mediaList = (post.mediaUrls && post.mediaUrls.length > 0)
        ? post.mediaUrls
        : (post.mediaUrl ? [post.mediaUrl] : []);

    // Determine category: Stills, Tapes, Knacks
    let category: 'Stills' | 'Tapes' | 'Knacks' = 'Stills';
    const rawCat = (post.momentType || post.category || post.domain || '').toString().toLowerCase();
    if (rawCat.includes('tape') || post.mediaType === 'video' || (mediaList[0] && mediaList[0].match(/\.(mp4|webm|mov)$/i))) {
        category = 'Tapes';
    } else if (rawCat.includes('knack')) {
        category = 'Knacks';
    } else {
        category = 'Stills';
    }

    return {
        id: post.id,
        authorId: post.authorId || post.author?.id || post.author?.uid,
        author: {
            name: post.author?.name || 'Invox Member',
            avatar: post.author?.avatarUrl || `https://picsum.photos/seed/${post.authorId || post.id}/200`,
            handle: post.author?.username ? `@${post.author.username.replace(/^@/, '')}` : (post.author?.name ? `@${post.author.name.toLowerCase().replace(/\s+/g, '')}` : '@member'),
            username: post.author?.username || undefined,
            isVerified: Boolean(post.author?.isVerified),
            uid: post.author?.uid || post.authorId,
        },
        category,
        domain: post.domain || post.category || category,
        aiSummary: post.aiSummary || undefined,
        mediaUrl: post.mediaUrl || (mediaList.length > 0 ? mediaList[0] : ''),
        mediaUrls: mediaList,
        caption: post.content || post.description || post.title || '',
        likes: Number(post.stats?.likes ?? post.likeCount ?? 0),
        views: Number(post.stats?.views ?? post.viewCount ?? 0),
        comments: Number(post.stats?.comments ?? post.commentCount ?? 0),
        userLiked: Boolean(post.userLiked),
        userSaved: Boolean(post.userSaved),
        createdAt: post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt || Date.now()),
        type: post.mediaType || (category === 'Tapes' ? 'video' : 'image'),
    };
};

/**
 * Fetches Moments posts from Firestore.
 */
export const getMomentsPosts = async (categoryFilter?: string): Promise<StreamMoment[]> => {
    try {
        const q = query(
            collection(db, COLLECTIONS.posts),
            limit(100)
        );
        const snapshot = await getDocs(q);
        const currentUid = auth.currentUser?.uid;

        const realMoments = snapshot.docs
            .filter(docSnap => {
                const data = docSnap.data();
                const norm = normalizeFirestorePost(docSnap.id, data);
                if (!isMomentPost(norm, data)) return false;
                // Only published moments are public; drafts visible only to author
                if (norm.status === 'draft') {
                    if (!currentUid || norm.authorId !== currentUid) return false;
                }
                const moment = postToMoment(norm);
                if (categoryFilter && categoryFilter.toLowerCase() !== 'all') {
                    return moment.category.toLowerCase() === categoryFilter.toLowerCase();
                }
                return true;
            })
            .map(docSnap => postToMoment(normalizeFirestorePost(docSnap.id, docSnap.data())))
            .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });

        if (isMomentsDemoModeEnabled()) {
            const mockMoments = getFilteredMockMoments(categoryFilter);
            const realIds = new Set(realMoments.map(m => m.id));
            const nonDuplicateMocks = mockMoments.filter(m => !realIds.has(m.id));
            return [...realMoments, ...nonDuplicateMocks];
        }
        return realMoments;
    } catch (err) {
        console.warn('[GET_MOMENTS_POSTS_WARN]', err);
        if (isMomentsDemoModeEnabled()) {
            return getFilteredMockMoments(categoryFilter);
        }
        return [];
    }
};

/**
 * Real-time subscription to Moments posts across the network for Hub -> Stream -> Moments.
 * Respects demo mode: when demo mode is enabled, delivers high-fidelity mock Moments merged
 * with real user broadcasts. When disabled, displays purely real broadcasts from Firestore.
 */
export const subscribeToMomentsPosts = (
    onMoments: (moments: StreamMoment[]) => void,
    categoryFilter?: string,
    onError?: (error: Error) => void
) => {
    let latestRealMoments: StreamMoment[] = [];

    const emitMoments = () => {
        if (isMomentsDemoModeEnabled()) {
            const mockMoments = getFilteredMockMoments(categoryFilter);
            const realIds = new Set(latestRealMoments.map(m => m.id));
            const nonDuplicateMocks = mockMoments.filter(m => !realIds.has(m.id));
            onMoments([...latestRealMoments, ...nonDuplicateMocks]);
        } else {
            onMoments([...latestRealMoments]);
        }
    };

    // Listen for demo mode toggles
    const handleDemoChange = () => {
        emitMoments();
    };
    window.addEventListener('invox_moments_demo_changed', handleDemoChange);

    // Initial instant emission for smooth responsiveness
    emitMoments();

    const q = query(
        collection(db, COLLECTIONS.posts),
        limit(100)
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const currentUid = auth.currentUser?.uid;
            latestRealMoments = snapshot.docs
                .filter(docSnap => {
                    const data = docSnap.data();
                    const norm = normalizeFirestorePost(docSnap.id, data);
                    if (!isMomentPost(norm, data)) return false;
                    // Drafts only visible to author
                    if (norm.status === 'draft') {
                        if (!currentUid || norm.authorId !== currentUid) return false;
                    }
                    const moment = postToMoment(norm);
                    if (categoryFilter && categoryFilter.toLowerCase() !== 'all') {
                        return moment.category.toLowerCase() === categoryFilter.toLowerCase();
                    }
                    return true;
                })
                .map(docSnap => postToMoment(normalizeFirestorePost(docSnap.id, docSnap.data())))
                .sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
                    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
                    return dateB - dateA;
                });

            console.log(`[HUB_STREAM_MOMENTS] Live Moments update: found ${latestRealMoments.length} real moments`);
            emitMoments();
        },
        (err) => {
            console.warn('[MOMENTS_POSTS_SUBSCRIBE_WARN]', err);
            if (isMomentsDemoModeEnabled()) {
                emitMoments();
            } else {
                onError?.(err);
            }
        }
    );

    return () => {
        window.removeEventListener('invox_moments_demo_changed', handleDemoChange);
        unsubscribe();
    };
};


