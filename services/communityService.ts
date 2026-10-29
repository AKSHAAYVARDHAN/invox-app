import { useState, useEffect, useCallback } from 'react';
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    collection,
    query,
    where,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import type { Community, CommunityMembership } from '../types';

export enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
        userId?: string | null;
        email?: string | null;
        emailVerified?: boolean | null;
        isAnonymous?: boolean | null;
        tenantId?: string | null;
        providerInfo?: {
            providerId?: string | null;
            email?: string | null;
        }[];
    };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData?.map(provider => ({
                providerId: provider.providerId,
                email: provider.email,
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Community Membership Error: ', JSON.stringify(errInfo));
    return errInfo;
}

export interface JoinCommunityInput {
    community: Pick<Community, 'id' | 'name' | 'category'> & { avatarUrl?: string };
    user: { uid: string; displayName?: string | null; email?: string | null };
}

/**
 * Join a community idempotently.
 * Creates a membership document at communityMemberships/{userId}_{communityId}.
 */
export const joinCommunity = async ({ community, user }: JoinCommunityInput): Promise<boolean> => {
    if (!user?.uid || !community?.id) {
        return false;
    }

    const membershipId = `${user.uid}_${community.id}`;
    const docPath = `${COLLECTIONS.communityMemberships}/${membershipId}`;

    try {
        const membershipRef = doc(db, COLLECTIONS.communityMemberships, membershipId);
        await setDoc(
            membershipRef,
            sanitizeForFirestore({
                id: membershipId,
                userId: user.uid,
                communityId: community.id,
                communityName: community.name,
                communityAvatarUrl: community.avatarUrl || null,
                communityCategory: community.category || 'General',
                status: 'active',
                joinedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }),
            { merge: true }
        );
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
        return false;
    }
};

/**
 * Leave a community.
 * Deletes the user's membership document at communityMemberships/{userId}_{communityId}.
 */
export const leaveCommunity = async (communityId: string, userId: string): Promise<boolean> => {
    if (!userId || !communityId) {
        return false;
    }

    const membershipId = `${userId}_${communityId}`;
    const docPath = `${COLLECTIONS.communityMemberships}/${membershipId}`;

    try {
        const membershipRef = doc(db, COLLECTIONS.communityMemberships, membershipId);
        await deleteDoc(membershipRef);
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
        return false;
    }
};

/**
 * Check if the user is a member of the given community.
 */
export const checkCommunityMembership = async (communityId: string, userId: string): Promise<boolean> => {
    if (!userId || !communityId) {
        return false;
    }

    const membershipId = `${userId}_${communityId}`;
    const docPath = `${COLLECTIONS.communityMemberships}/${membershipId}`;

    try {
        const membershipRef = doc(db, COLLECTIONS.communityMemberships, membershipId);
        const snap = await getDoc(membershipRef);
        return snap.exists();
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, docPath);
        return false;
    }
};

/**
 * Subscribes to real-time changes to the user's community memberships.
 */
export const subscribeUserMemberships = (
    userId: string | undefined | null,
    onUpdate: (memberships: CommunityMembership[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    if (!userId) {
        onUpdate([]);
        return () => {};
    }

    const q = query(
        collection(db, COLLECTIONS.communityMemberships),
        where('userId', '==', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: CommunityMembership[] = snapshot.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    userId: data.userId,
                    communityId: data.communityId,
                    communityName: data.communityName || '',
                    communityAvatarUrl: data.communityAvatarUrl || null,
                    communityCategory: data.communityCategory || '',
                    status: data.status || 'active',
                    joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined,
                };
            });
            onUpdate(list);
        },
        (err) => {
            handleFirestoreError(err, OperationType.LIST, COLLECTIONS.communityMemberships);
            onError?.(err);
        }
    );
};

/**
 * Calculates displayed member count safely:
 * baseline + 1 if joined, otherwise baseline. Never negative.
 */
export const getAdjustedMemberCount = (baselineCount: number, isMember: boolean): number => {
    const base = typeof baselineCount === 'number' && !isNaN(baselineCount) ? baselineCount : 0;
    return Math.max(0, base + (isMember ? 1 : 0));
};

/**
 * Custom React hook for seamless reactive community memberships.
 */
export const useCommunityMemberships = (user?: { uid: string; displayName?: string | null; email?: string | null } | null) => {
    const [memberships, setMemberships] = useState<CommunityMembership[]>([]);
    const [loading, setLoading] = useState<boolean>(Boolean(user?.uid));
    const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.uid) {
            setMemberships([]);
            setJoinedIds(new Set());
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeUserMemberships(
            user.uid,
            (list) => {
                setMemberships(list);
                setJoinedIds(new Set(list.map((m) => m.communityId)));
                setLoading(false);
            },
            () => {
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.uid]);

    const toggleMembership = useCallback(
        async (community: Pick<Community, 'id' | 'name' | 'category'> & { avatarUrl?: string }) => {
            if (!user?.uid || !community?.id) {
                return false;
            }

            setActionLoadingId(community.id);
            const currentlyJoined = joinedIds.has(community.id);

            // Optimistic update
            setJoinedIds(prev => {
                const next = new Set(prev);
                if (currentlyJoined) {
                    next.delete(community.id);
                } else {
                    next.add(community.id);
                }
                return next;
            });

            try {
                if (currentlyJoined) {
                    await leaveCommunity(community.id, user.uid);
                } else {
                    await joinCommunity({ community, user });
                }
                return !currentlyJoined;
            } catch (err) {
                // Rollback optimistic update
                setJoinedIds(prev => {
                    const next = new Set(prev);
                    if (currentlyJoined) {
                        next.add(community.id);
                    } else {
                        next.delete(community.id);
                    }
                    return next;
                });
                return currentlyJoined;
            } finally {
                setActionLoadingId(null);
            }
        },
        [user, joinedIds]
    );

    return {
        memberships,
        joinedIds,
        loading,
        actionLoadingId,
        isMember: (communityId: string) => joinedIds.has(communityId),
        toggleMembership,
    };
};
