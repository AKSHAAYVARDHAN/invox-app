import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    increment,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
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

// Known creator directory for seed/mock projects to ensure reliable profile rendering
export const KNOWN_CREATORS: Record<string, { displayName: string; username: string; photoURL: string }> = {
    'seed_abello': { displayName: 'Aisha Bello', username: 'abello', photoURL: 'https://picsum.photos/id/22/200/200' },
    'creator_aisha_bello': { displayName: 'Aisha Bello', username: 'abello', photoURL: 'https://picsum.photos/id/22/200/200' },
    'seed_ktanaka': { displayName: 'Kenji Tanaka', username: 'ktanaka', photoURL: 'https://picsum.photos/id/21/200/200' },
    'creator_kenji_tanaka': { displayName: 'Kenji Tanaka', username: 'ktanaka', photoURL: 'https://picsum.photos/id/21/200/200' },
    'seed_cadams': { displayName: 'Crash Adams', username: 'cadams', photoURL: 'https://picsum.photos/id/10/200/200' },
    'creator_crash_adams': { displayName: 'Crash Adams', username: 'cadams', photoURL: 'https://picsum.photos/id/10/200/200' },
    'seed_mrossi': { displayName: 'Marco Rossi', username: 'mrossi', photoURL: 'https://picsum.photos/id/12/200/200' },
    'creator_marco_rossi': { displayName: 'Marco Rossi', username: 'mrossi', photoURL: 'https://picsum.photos/id/12/200/200' },
    'seed_ereed': { displayName: 'Dr. Evelyn Reed', username: 'ereed', photoURL: 'https://picsum.photos/id/13/200/200' },
    'creator_dr_evelyn_reed': { displayName: 'Dr. Evelyn Reed', username: 'ereed', photoURL: 'https://picsum.photos/id/13/200/200' },
    'seed_chloeb': { displayName: 'Chloe Bennet', username: 'chloeb', photoURL: 'https://picsum.photos/id/15/200/200' },
    'creator_chloe_bennet': { displayName: 'Chloe Bennet', username: 'chloeb', photoURL: 'https://picsum.photos/id/15/200/200' },
    'seed_ljohnson': { displayName: 'Liam Johnson', username: 'ljohnson', photoURL: 'https://picsum.photos/id/16/200/200' },
    'creator_liam_johnson': { displayName: 'Liam Johnson', username: 'ljohnson', photoURL: 'https://picsum.photos/id/16/200/200' },
};

/**
 * Reliably extracts the unique creator / author identifier from any Showcase project object.
 * Checks authorId, uid, id, userId, and falls back to deterministic slug based on username or name.
 */
export const getProjectCreatorId = (p: any): string | undefined => {
    if (!p) return undefined;
    const author = p.author;

    const candidate = 
        p.authorId ||
        p.author_id ||
        p.creatorId ||
        p.creator_id ||
        p.userId ||
        p.user_id ||
        p.ownerId ||
        author?.uid ||
        author?.id ||
        author?.userId;

    if (candidate && typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
    }

    if (author?.username && typeof author.username === 'string' && author.username.trim()) {
        const u = author.username.trim().toLowerCase();
        return u.startsWith('seed_') ? u : `seed_${u}`;
    }

    if (author?.name && typeof author.name === 'string' && author.name.trim()) {
        const slug = author.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (slug) {
            return `creator_${slug}`;
        }
    }

    return undefined;
};

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
            followerUid: currentUserId,
            followingUid: targetUserId,
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

    // 4. Send notification to target user (non-blocking)
    try {
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
    } catch (notifErr) {
        console.warn('[CONNECT_NOTIFICATION_NONBLOCKING_WARN]', notifErr);
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

/**
 * Toggles follow state between the current user and a target creator.
 * Prevents self-following and enforces duplicate-safe deterministic follow IDs.
 */
export const toggleFollowCreator = async ({
    currentUser,
    currentUserProfile,
    targetCreatorId,
}: {
    currentUser: User;
    currentUserProfile?: InvoxUser | null;
    targetCreatorId: string;
}): Promise<{ following: boolean }> => {
    if (!currentUser?.uid || !targetCreatorId || currentUser.uid === targetCreatorId) {
        throw new Error('Cannot follow yourself or an invalid creator ID.');
    }

    const currentUserId = currentUser.uid;
    const followId = `${currentUserId}_${targetCreatorId}`;
    const followRef = doc(db, COLLECTIONS.follows, followId);

    const snap = await getDoc(followRef);
    if (snap.exists()) {
        const success = await disconnectFromUser(currentUserId, targetCreatorId);
        return { following: !success };
    } else {
        const success = await connectWithUser({
            currentUser,
            currentUserProfile,
            targetUserId: targetCreatorId,
        });
        return { following: success };
    }
};

/**
 * Fetches all user IDs that current user is following.
 */
export const getFollowedUserIds = async (currentUserId: string): Promise<Set<string>> => {
    if (!currentUserId) return new Set<string>();

    try {
        const q = query(
            collection(db, COLLECTIONS.follows),
            where('followerId', '==', currentUserId)
        );
        const snap = await getDocs(q);
        const ids = new Set<string>();
        snap.forEach(d => {
            const data = d.data();
            const targetId = data.followingId || data.followingUid || data.toUserId;
            if (targetId && targetId !== currentUserId) {
                ids.add(targetId);
            }
        });
        return ids;
    } catch (e) {
        console.warn('[GET_FOLLOWED_USER_IDS_WARN]', e);
        return new Set<string>();
    }
};

/**
 * Subscribes to the real-time set of user IDs that current user is following.
 */
export const subscribeFollowedUserIds = (
    currentUserId: string,
    onIds: (ids: Set<string>) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!currentUserId) {
        onIds(new Set<string>());
        return () => {};
    }

    const q = query(
        collection(db, COLLECTIONS.follows),
        where('followerId', '==', currentUserId)
    );

    return onSnapshot(
        q,
        (snap) => {
            const ids = new Set<string>();
            snap.forEach(d => {
                const data = d.data();
                const targetId = data.followingId || data.followingUid || data.toUserId;
                if (targetId && targetId !== currentUserId) {
                    ids.add(targetId);
                }
            });
            onIds(ids);
        },
        (err) => {
            console.error('[SUBSCRIBE_FOLLOWED_USER_IDS_ERROR]', err);
            onError?.(err);
        }
    );
};

/**
 * Loads full profile documents for a list of user IDs.
 */
export const getProfilesByIds = async (userIds: string[]): Promise<InvoxUser[]> => {
    if (!userIds || userIds.length === 0) return [];

    const profiles = await Promise.all(
        userIds.map(async (uid) => {
            try {
                const userRef = doc(db, COLLECTIONS.users, uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    return { uid, ...(userSnap.data() as any) } as InvoxUser;
                }
                const known = KNOWN_CREATORS[uid];
                return {
                    uid,
                    displayName: known?.displayName || `Creator ${uid.slice(0, 6)}`,
                    username: known?.username || `creator_${uid.slice(0, 6)}`,
                    photoURL: known?.photoURL || `https://picsum.photos/seed/${uid}/200`,
                } as unknown as InvoxUser;
            } catch {
                const known = KNOWN_CREATORS[uid];
                return {
                    uid,
                    displayName: known?.displayName || `Creator ${uid.slice(0, 6)}`,
                    username: known?.username || `creator_${uid.slice(0, 6)}`,
                    photoURL: known?.photoURL || `https://picsum.photos/seed/${uid}/200`,
                } as unknown as InvoxUser;
            }
        })
    );

    return profiles.filter(Boolean);
};

/**
 * Real-time subscription to the list of InvoxUser creator profiles followed by current user.
 */
export const subscribeFollowedProfiles = (
    currentUserId: string,
    onProfiles: (profiles: InvoxUser[]) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!currentUserId) {
        onProfiles([]);
        return () => {};
    }

    return subscribeFollowedUserIds(
        currentUserId,
        async (ids) => {
            if (ids.size === 0) {
                onProfiles([]);
                return;
            }
            try {
                const profiles = await getProfilesByIds(Array.from(ids));
                onProfiles(profiles);
            } catch (err: any) {
                console.error('[FETCH_FOLLOWED_PROFILES_ERROR]', err);
                onError?.(err);
            }
        },
        onError
    );
};

/**
 * Checks whether userA and userB have an accepted (mutual) connection in INVOX.
 * In INVOX, an accepted connection requires both follows/userA_userB AND follows/userB_userA to exist.
 */
export const isUserAcceptedConnection = async (
    userAId: string,
    userBId: string
): Promise<boolean> => {
    if (!userAId || !userBId || userAId === userBId) return false;
    try {
        const docAB = doc(db, COLLECTIONS.follows, `${userAId}_${userBId}`);
        const docBA = doc(db, COLLECTIONS.follows, `${userBId}_${userAId}`);
        const [snapAB, snapBA] = await Promise.all([
            getDoc(docAB),
            getDoc(docBA),
        ]);
        return snapAB.exists() && snapBA.exists();
    } catch (e) {
        console.warn('[IS_USER_ACCEPTED_CONNECTION_WARN]', e);
        return false;
    }
};

/**
 * Fetches the Set of user IDs with which the current user has an accepted (mutual) connection.
 */
export const getAcceptedConnectionUserIds = async (currentUserId: string): Promise<Set<string>> => {
    if (!currentUserId) return new Set<string>();

    try {
        const [followingSnap, followersSnap] = await Promise.all([
            getDocs(query(collection(db, COLLECTIONS.follows), where('followerId', '==', currentUserId))),
            getDocs(query(collection(db, COLLECTIONS.follows), where('followingId', '==', currentUserId))),
        ]);

        const followingSet = new Set<string>();
        followingSnap.forEach(d => {
            const data = d.data();
            const id = data.followingId || data.followingUid || data.toUserId;
            if (id && id !== currentUserId) followingSet.add(id);
        });

        const acceptedSet = new Set<string>();
        followersSnap.forEach(d => {
            const data = d.data();
            const id = data.followerId || data.followerUid || data.fromUserId;
            if (id && followingSet.has(id)) {
                acceptedSet.add(id);
            }
        });

        return acceptedSet;
    } catch (e) {
        console.warn('[GET_ACCEPTED_CONNECTIONS_WARN]', e);
        return new Set<string>();
    }
};

/**
 * Subscribes in real-time to the current user's accepted connection IDs.
 * Immediately invokes onIds whenever a connection request is accepted (mutual follow established)
 * or disconnected/removed (access revoked).
 */
export const subscribeAcceptedConnectionUserIds = (
    currentUserId: string,
    onIds: (ids: Set<string>) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!currentUserId) {
        onIds(new Set<string>());
        return () => {};
    }

    let followingIds = new Set<string>();
    let followerIds = new Set<string>();

    const recompute = () => {
        const accepted = new Set<string>();
        followingIds.forEach(id => {
            if (followerIds.has(id)) {
                accepted.add(id);
            }
        });
        onIds(accepted);
    };

    const qFollowing = query(collection(db, COLLECTIONS.follows), where('followerId', '==', currentUserId));
    const qFollowers = query(collection(db, COLLECTIONS.follows), where('followingId', '==', currentUserId));

    const unsubFollowing = onSnapshot(
        qFollowing,
        (snap) => {
            const ids = new Set<string>();
            snap.forEach(d => {
                const data = d.data();
                const id = data.followingId || data.followingUid || data.toUserId;
                if (id && id !== currentUserId) ids.add(id);
            });
            followingIds = ids;
            recompute();
        },
        (err) => {
            console.error('[SUBSCRIBE_FOLLOWING_ERROR]', err);
            onError?.(err);
        }
    );

    const unsubFollowers = onSnapshot(
        qFollowers,
        (snap) => {
            const ids = new Set<string>();
            snap.forEach(d => {
                const data = d.data();
                const id = data.followerId || data.followerUid || data.fromUserId;
                if (id && id !== currentUserId) ids.add(id);
            });
            followerIds = ids;
            recompute();
        },
        (err) => {
            console.error('[SUBSCRIBE_FOLLOWERS_ERROR]', err);
            onError?.(err);
        }
    );

    return () => {
        unsubFollowing();
        unsubFollowers();
    };
};

export interface UserRelationshipCounts {
    followingCount: number;
    followerCount: number;
    connectionCount: number;
    followingIds: Set<string>;
    followerIds: Set<string>;
    connectionIds: Set<string>;
}

/**
 * Subscribes in real-time to a user's relationships (Following, Followers, Connections).
 * Connections are strictly derived from reciprocal follow relationships:
 * User A follows User B AND User B follows User A.
 */
export const subscribeUserRelationships = (
    userId: string,
    onUpdate: (rel: UserRelationshipCounts) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!userId) {
        onUpdate({
            followingCount: 0,
            followerCount: 0,
            connectionCount: 0,
            followingIds: new Set<string>(),
            followerIds: new Set<string>(),
            connectionIds: new Set<string>(),
        });
        return () => {};
    }

    let followingIds = new Set<string>();
    let followerIds = new Set<string>();

    const recompute = () => {
        const connectionIds = new Set<string>();
        followingIds.forEach((id) => {
            if (followerIds.has(id)) {
                connectionIds.add(id);
            }
        });
        onUpdate({
            followingCount: followingIds.size,
            followerCount: followerIds.size,
            connectionCount: connectionIds.size,
            followingIds,
            followerIds,
            connectionIds,
        });
    };

    const qFollowing = query(collection(db, COLLECTIONS.follows), where('followerId', '==', userId));
    const qFollowers = query(collection(db, COLLECTIONS.follows), where('followingId', '==', userId));

    const unsubFollowing = onSnapshot(
        qFollowing,
        (snap) => {
            const ids = new Set<string>();
            snap.forEach((d) => {
                const data = d.data();
                const id = data.followingId || data.followingUid || data.toUserId;
                if (id && id !== userId) ids.add(id);
            });
            followingIds = ids;
            recompute();
        },
        (err) => {
            console.error('[SUBSCRIBE_USER_RELATIONSHIPS_FOLLOWING_ERROR]', err);
            onError?.(err);
        }
    );

    const unsubFollowers = onSnapshot(
        qFollowers,
        (snap) => {
            const ids = new Set<string>();
            snap.forEach((d) => {
                const data = d.data();
                const id = data.followerId || data.followerUid || data.fromUserId;
                if (id && id !== userId) ids.add(id);
            });
            followerIds = ids;
            recompute();
        },
        (err) => {
            console.error('[SUBSCRIBE_USER_RELATIONSHIPS_FOLLOWERS_ERROR]', err);
            onError?.(err);
        }
    );

    return () => {
        unsubFollowing();
        unsubFollowers();
    };
};

/**
 * Real-time subscription to the full InvoxUser profiles of a user's mutual Connections.
 */
export const subscribeUserConnections = (
    userId: string,
    onProfiles: (profiles: InvoxUser[]) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!userId) {
        onProfiles([]);
        return () => {};
    }

    let active = true;
    const unsub = subscribeUserRelationships(
        userId,
        async (rel) => {
            if (!active) return;
            if (rel.connectionIds.size === 0) {
                onProfiles([]);
                return;
            }
            try {
                const profiles = await getProfilesByIds(Array.from(rel.connectionIds));
                if (active) onProfiles(profiles);
            } catch (err: any) {
                console.error('[SUBSCRIBE_USER_CONNECTIONS_PROFILES_ERROR]', err);
                if (active) onError?.(err);
            }
        },
        onError
    );

    return () => {
        active = false;
        unsub();
    };
};

/**
 * Real-time subscription to the full InvoxUser profiles of a user's Followers.
 */
export const subscribeUserFollowers = (
    userId: string,
    onProfiles: (profiles: InvoxUser[]) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!userId) {
        onProfiles([]);
        return () => {};
    }

    let active = true;
    const unsub = subscribeUserRelationships(
        userId,
        async (rel) => {
            if (!active) return;
            if (rel.followerIds.size === 0) {
                onProfiles([]);
                return;
            }
            try {
                const profiles = await getProfilesByIds(Array.from(rel.followerIds));
                if (active) onProfiles(profiles);
            } catch (err: any) {
                console.error('[SUBSCRIBE_USER_FOLLOWERS_PROFILES_ERROR]', err);
                if (active) onError?.(err);
            }
        },
        onError
    );

    return () => {
        active = false;
        unsub();
    };
};

/**
 * Real-time subscription to the full InvoxUser profiles of a user's Following list.
 */
export const subscribeUserFollowing = (
    userId: string,
    onProfiles: (profiles: InvoxUser[]) => void,
    onError?: (err: Error) => void
): (() => void) => {
    if (!userId) {
        onProfiles([]);
        return () => {};
    }

    let active = true;
    const unsub = subscribeUserRelationships(
        userId,
        async (rel) => {
            if (!active) return;
            if (rel.followingIds.size === 0) {
                onProfiles([]);
                return;
            }
            try {
                const profiles = await getProfilesByIds(Array.from(rel.followingIds));
                if (active) onProfiles(profiles);
            } catch (err: any) {
                console.error('[SUBSCRIBE_USER_FOLLOWING_PROFILES_ERROR]', err);
                if (active) onError?.(err);
            }
        },
        onError
    );

    return () => {
        active = false;
        unsub();
    };
};

