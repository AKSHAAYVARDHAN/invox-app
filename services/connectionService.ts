import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    increment,
    updateDoc,
    serverTimestamp,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import { sendNotification } from './notificationService';
import type { InvoxUser, User } from '../types';

export interface ConnectionStatus {
    isConnected: boolean;
    isFollowedBy: boolean;
    isMutual: boolean;
    loading: boolean;
}

/**
 * Checks connection status between current user and target user.
 */
export const checkConnectionStatus = async (
    currentUserId: string,
    targetUserId: string
): Promise<{ isConnected: boolean; isFollowedBy: boolean }> => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        return { isConnected: false, isFollowedBy: false };
    }

    try {
        const myFollowRef = doc(db, COLLECTIONS.follows, `${currentUserId}_${targetUserId}`);
        const theirFollowRef = doc(db, COLLECTIONS.follows, `${targetUserId}_${currentUserId}`);

        const [mySnap, theirSnap] = await Promise.all([
            getDoc(myFollowRef),
            getDoc(theirFollowRef),
        ]);

        return {
            isConnected: mySnap.exists(),
            isFollowedBy: theirSnap.exists(),
        };
    } catch (e) {
        console.warn('[CHECK_CONNECTION_WARN]', e);
        return { isConnected: false, isFollowedBy: false };
    }
};

/**
 * Subscribes to real-time connection status between current user and target user.
 */
export const subscribeConnectionStatus = (
    currentUserId: string,
    targetUserId: string,
    onChange: (status: { isConnected: boolean; isFollowedBy: boolean }) => void
): (() => void) => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        onChange({ isConnected: false, isFollowedBy: false });
        return () => {};
    }

    let isConnected = false;
    let isFollowedBy = false;

    const myFollowRef = doc(db, COLLECTIONS.follows, `${currentUserId}_${targetUserId}`);
    const theirFollowRef = doc(db, COLLECTIONS.follows, `${targetUserId}_${currentUserId}`);

    const unsubMy = onSnapshot(myFollowRef, (snap) => {
        isConnected = snap.exists();
        onChange({ isConnected, isFollowedBy });
    });

    const unsubTheir = onSnapshot(theirFollowRef, (snap) => {
        isFollowedBy = snap.exists();
        onChange({ isConnected, isFollowedBy });
    });

    return () => {
        unsubMy();
        unsubTheir();
    };
};

/**
 * Connect with a user (creates a follow relationship and emits connection notification).
 */
export const connectWithUser = async ({
    currentUser,
    currentUserProfile,
    targetUserId,
}: {
    currentUser: User;
    currentUserProfile?: InvoxUser | null;
    targetUserId: string;
}): Promise<boolean> => {
    if (!currentUser?.uid || !targetUserId || currentUser.uid === targetUserId) {
        return false;
    }

    const currentUserId = currentUser.uid;
    const followId = `${currentUserId}_${targetUserId}`;
    const followRef = doc(db, COLLECTIONS.follows, followId);

    const senderName = currentUserProfile?.displayName || currentUser.displayName || 'Invox Member';
    const senderAvatar = currentUserProfile?.photoURL || currentUser.photoURL || null;
    const senderUsername = currentUserProfile?.username || currentUser.email?.split('@')[0] || '';

    // 1. Create follow doc
    await setDoc(
        followRef,
        sanitizeForFirestore({
            followerId: currentUserId,
            followingId: targetUserId,
            fromUserId: currentUserId,
            toUserId: targetUserId,
            createdAt: serverTimestamp(),
        })
    );

    // 2. Increment user counts safely
    try {
        const myUserRef = doc(db, COLLECTIONS.users, currentUserId);
        const theirUserRef = doc(db, COLLECTIONS.users, targetUserId);
        await Promise.all([
            updateDoc(myUserRef, { followingCount: increment(1) }).catch(() => {}),
            updateDoc(theirUserRef, { followerCount: increment(1) }).catch(() => {}),
        ]);
    } catch {
        // Non-blocking
    }

    // 3. Check if target was already following current user (making it mutual / accepted)
    const theirFollowRef = doc(db, COLLECTIONS.follows, `${targetUserId}_${currentUserId}`);
    let isMutual = false;
    try {
        const snap = await getDoc(theirFollowRef);
        isMutual = snap.exists();
    } catch {
        // ignore
    }

    // 4. Send notification to target user
    if (isMutual) {
        await sendNotification({
            recipientId: targetUserId,
            actorId: currentUserId,
            actorName: senderName,
            actorAvatar: senderAvatar,
            actorUsername: senderUsername,
            type: 'connection_accepted',
            title: 'Connection Accepted',
            body: `${senderName} connected back with you. You are now comrades!`,
            targetType: 'profile',
            targetId: currentUserId,
            metadata: { userId: currentUserId },
        });
    } else {
        await sendNotification({
            recipientId: targetUserId,
            actorId: currentUserId,
            actorName: senderName,
            actorAvatar: senderAvatar,
            actorUsername: senderUsername,
            type: 'connection_request',
            title: 'New Connection Request',
            body: `${senderName} connected with you on INVOX.`,
            targetType: 'profile',
            targetId: currentUserId,
            metadata: { userId: currentUserId },
        });
    }

    return true;
};

/**
 * Disconnect / unfollow a user.
 */
export const disconnectFromUser = async (
    currentUserId: string,
    targetUserId: string
): Promise<boolean> => {
    if (!currentUserId || !targetUserId) return false;

    const followId = `${currentUserId}_${targetUserId}`;
    const followRef = doc(db, COLLECTIONS.follows, followId);

    try {
        await deleteDoc(followRef);

        const myUserRef = doc(db, COLLECTIONS.users, currentUserId);
        const theirUserRef = doc(db, COLLECTIONS.users, targetUserId);
        await Promise.all([
            updateDoc(myUserRef, { followingCount: increment(-1) }).catch(() => {}),
            updateDoc(theirUserRef, { followerCount: increment(-1) }).catch(() => {}),
        ]);
        return true;
    } catch (e) {
        console.error('[DISCONNECT_USER_ERROR]', e);
        return false;
    }
};
