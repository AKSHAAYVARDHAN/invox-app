import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    increment,
    updateDoc,
    setDoc,
    addDoc,
    deleteDoc,
    QueryConstraint
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, createDocument, updateDocument } from './firestoreService';
import type { Channel } from '../types';

export interface CreateChannelInput {
    name: string;
    description: string;
    handle?: string;
    category?: string;
    domain?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    authorProfile?: {
        displayName?: string;
        username?: string;
        photoURL?: string;
    };
}

/**
 * Normalizes Firestore document data into a typed Channel.
 */
export const normalizeFirestoreChannel = (id: string, data: any): Channel => {
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
    const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date());

    return {
        id,
        name: data.name || 'Untitled Channel',
        description: data.description || '',
        handle: data.handle || (data.name ? `@${data.name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : ''),
        domain: data.domain || data.category || 'General',
        category: data.category || data.domain || 'General',
        avatarUrl: data.avatarUrl || `https://picsum.photos/seed/${id}/200`,
        bannerUrl: data.bannerUrl || null,
        ownerId: data.ownerId || data.authorId || '',
        authorId: data.authorId || data.ownerId || '',
        authorName: data.authorName || 'Invox Member',
        authorAvatarUrl: data.authorAvatarUrl || `https://picsum.photos/seed/${data.ownerId || id}/200`,
        subscriberCount: data.subscriberCount || data.followersCount || 0,
        followersCount: data.followersCount || data.subscriberCount || 0,
        postCount: data.postCount || 0,
        createdAt,
        updatedAt,
    };
};

/**
 * Creates a new channel document in Firestore.
 */
export const createChannel = async (input: CreateChannelInput): Promise<Channel> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to create a channel.');
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
        throw new Error('Channel name is required.');
    }

    const channelPayload = {
        name: trimmedName,
        description: (input.description || '').trim(),
        handle: input.handle?.trim() || `@${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        category: input.category || input.domain || 'General',
        domain: input.domain || input.category || 'General',
        avatarUrl: input.avatarUrl || input.authorProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
        bannerUrl: input.bannerUrl || null,
        ownerId: currentUser.uid,
        authorId: currentUser.uid,
        authorName: input.authorProfile?.displayName || currentUser.displayName || 'Invox Member',
        authorAvatarUrl: input.authorProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
        subscriberCount: 0,
        followersCount: 0,
        postCount: 0,
    };

    const newChannelId = await createDocument(COLLECTIONS.channels, channelPayload);
    console.log(`[CHANNEL_CREATED] Successfully created channel: ${newChannelId} ("${trimmedName}")`);

    return normalizeFirestoreChannel(newChannelId, {
        ...channelPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
};

/**
 * Gets all channels owned by a specific user.
 */
export const getUserChannels = async (userId: string): Promise<Channel[]> => {
    try {
        const q = query(
            collection(db, COLLECTIONS.channels),
            where('ownerId', '==', userId),
            limit(50)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(docSnap => normalizeFirestoreChannel(docSnap.id, docSnap.data()))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
        console.error('[GET_USER_CHANNELS_ERROR]', err);
        return [];
    }
};

/**
 * Subscribes to real-time updates for channels owned by a user.
 */
export const subscribeToUserChannels = (
    userId: string,
    onChannels: (channels: Channel[]) => void,
    onError?: (error: Error) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.channels),
        where('ownerId', '==', userId),
        limit(50)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const channels = snapshot.docs
                .map(docSnap => normalizeFirestoreChannel(docSnap.id, docSnap.data()))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onChannels(channels);
        },
        (err) => {
            console.error('[SUBSCRIBE_USER_CHANNELS_ERROR]', err);
            onError?.(err);
        }
    );
};

/**
 * Gets a channel by its ID.
 */
export const getChannelById = async (channelId: string): Promise<Channel | null> => {
    try {
        const docRef = doc(db, COLLECTIONS.channels, channelId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return normalizeFirestoreChannel(docSnap.id, docSnap.data());
    } catch (err) {
        console.error(`[GET_CHANNEL_BY_ID_ERROR] ${channelId}`, err);
        return null;
    }
};

/**
 * Gets all channels with optional limit.
 */
export const getAllChannels = async (maxLimit = 30): Promise<Channel[]> => {
    try {
        const q = query(
            collection(db, COLLECTIONS.channels),
            orderBy('createdAt', 'desc'),
            limit(maxLimit)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => normalizeFirestoreChannel(docSnap.id, docSnap.data()));
    } catch (err) {
        console.warn('[GET_ALL_CHANNELS_WARN]', err);
        return [];
    }
};

/**
 * Increments post count on a channel.
 */
export const incrementChannelPostCount = async (channelId: string): Promise<void> => {
    if (!channelId) return;
    try {
        const channelRef = doc(db, COLLECTIONS.channels, channelId);
        await updateDoc(channelRef, {
            postCount: increment(1),
            updatedAt: serverTimestamp(),
        });
    } catch (err) {
        console.warn(`[INCREMENT_CHANNEL_POST_COUNT_WARN] channelId: ${channelId}`, err);
    }
};

/**
 * Decrements post count on a channel.
 */
export const decrementChannelPostCount = async (channelId: string): Promise<void> => {
    if (!channelId) return;
    try {
        const channelRef = doc(db, COLLECTIONS.channels, channelId);
        await updateDoc(channelRef, {
            postCount: increment(-1),
            updatedAt: serverTimestamp(),
        });
    } catch (err) {
        console.warn(`[DECREMENT_CHANNEL_POST_COUNT_WARN] channelId: ${channelId}`, err);
    }
};
