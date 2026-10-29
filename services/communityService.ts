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
import type { Community, CommunityMembership, ConclaveGathering } from '../types';
import { MOCK_COMMUNITIES, MOCK_COMMUNITY_EVENTS } from './communitiesDemoData';

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
export const joinCommunity = async (
    arg1: JoinCommunityInput | (Pick<Community, 'id' | 'name' | 'category'> & { avatarUrl?: string }),
    arg2?: { uid: string; displayName?: string | null; email?: string | null }
): Promise<{ success: boolean; status: string }> => {
    let community: Pick<Community, 'id' | 'name' | 'category'> & { avatarUrl?: string };
    let user: { uid: string; displayName?: string | null; email?: string | null };

    if (arg2) {
        community = arg1 as any;
        user = arg2;
    } else {
        const input = arg1 as JoinCommunityInput;
        community = input.community;
        user = input.user;
    }

    if (!user?.uid || !community?.id) {
        return { success: false, status: 'failed' };
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
                userName: user.displayName || 'Member',
                communityId: community.id,
                communityName: community.name,
                communityAvatarUrl: community.avatarUrl || null,
                communityCategory: community.category || 'General',
                status: 'active',
                role: 'member',
                joinedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }),
            { merge: true }
        );
        return { success: true, status: 'active' };
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
        return { success: false, status: 'error' };
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

/**
 * Subscribes to a single community record, falling back to mock datasets if not in Firestore.
 */
export const subscribeCommunity = (
    communityId: string,
    onUpdate: (community: Community | null) => void,
    onError?: (error: any) => void,
    fallbackCommunities?: Community[]
): (() => void) => {
    if (!communityId) {
        onUpdate(null);
        return () => {};
    }

    const mockFound =
        fallbackCommunities?.find((c) => c.id === communityId) ||
        MOCK_COMMUNITIES.find((c) => c.id === communityId) ||
        null;

    try {
        const communityRef = doc(db, 'communities', communityId);
        return onSnapshot(
            communityRef,
            (snap) => {
                if (snap.exists()) {
                    onUpdate({ id: snap.id, ...(snap.data() as any) });
                } else if (mockFound) {
                    onUpdate(mockFound);
                } else {
                    onUpdate(null);
                }
            },
            (error) => {
                console.warn('[COMMUNITY_PROFILE_SNAPSHOT_FALLBACK]', error);
                if (mockFound) {
                    onUpdate(mockFound);
                } else {
                    onError?.(error);
                }
            }
        );
    } catch (err) {
        if (mockFound) {
            onUpdate(mockFound);
        } else {
            onError?.(err);
        }
        return () => {};
    }
};

/**
 * Subscribes to the roster of members in a specific community.
 */
export const subscribeCommunityMembers = (
    communityId: string,
    onUpdate: (members: CommunityMembership[]) => void,
    onError?: (error: any) => void
): (() => void) => {
    if (!communityId) {
        onUpdate([]);
        return () => {};
    }

    try {
        const q = query(
            collection(db, COLLECTIONS.communityMemberships),
            where('communityId', '==', communityId)
        );
        return onSnapshot(
            q,
            (snap) => {
                const list: CommunityMembership[] = snap.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as any),
                }));
                onUpdate(list);
            },
            (err) => {
                console.warn('[COMMUNITY_MEMBERS_SNAPSHOT_ERROR]', err);
                onUpdate([]);
                onError?.(err);
            }
        );
    } catch (err) {
        onUpdate([]);
        onError?.(err);
        return () => {};
    }
};

/**
 * Subscribes to Conclave gatherings for a community.
 */
export const subscribeConclaveGatherings = (
    communityId: string,
    onUpdate: (gatherings: ConclaveGathering[]) => void,
    onError?: (error: any) => void
): (() => void) => {
    const mockGatherings = MOCK_COMMUNITY_EVENTS.filter((e) => e.communityId === communityId);

    try {
        const q = query(
            collection(db, 'conclaveGatherings'),
            where('communityId', '==', communityId)
        );
        return onSnapshot(
            q,
            (snap) => {
                if (snap.empty && mockGatherings.length > 0) {
                    onUpdate(mockGatherings);
                } else {
                    const list: ConclaveGathering[] = snap.docs.map((d) => ({
                        id: d.id,
                        ...(d.data() as any),
                    }));
                    onUpdate(list.length > 0 ? list : mockGatherings);
                }
            },
            (err) => {
                console.warn('[CONCLAVE_SNAPSHOT_FALLBACK]', err);
                onUpdate(mockGatherings);
                onError?.(err);
            }
        );
    } catch (err) {
        onUpdate(mockGatherings);
        return () => {};
    }
};

/**
 * Updates a community's profile information.
 */
export const updateCommunityIdentity = async (
    communityId: string,
    data: Partial<Community>
): Promise<boolean> => {
    if (!communityId) return false;
    try {
        const ref = doc(db, 'communities', communityId);
        await setDoc(ref, sanitizeForFirestore({ ...data, updatedAt: serverTimestamp() }), { merge: true });
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `communities/${communityId}`);
        return false;
    }
};

export interface ConclaveCreateInput {
    communityId: string;
    communityName: string;
    communityAvatarUrl?: string;
    title: string;
    description: string;
    format: string;
    date: string;
    time: string;
    timezone?: string;
    location?: string;
    virtualUrl?: string;
}

/**
 * Schedules a new Conclave gathering.
 */
export const createConclaveGathering = async (
    input: ConclaveCreateInput,
    user: { uid: string; displayName?: string | null }
): Promise<ConclaveGathering | null> => {
    try {
        const newId = `gathering_${Date.now()}`;
        const ref = doc(db, 'conclaveGatherings', newId);
        const item: ConclaveGathering = {
            id: newId,
            ...input,
            hostId: user.uid,
            hostName: user.displayName || 'Organizer',
            capacity: 100,
            attendeeCount: 1,
            attendeeIds: [user.uid],
            status: 'scheduled',
            createdAt: serverTimestamp(),
        };
        await setDoc(ref, sanitizeForFirestore(item));
        return item;
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'conclaveGatherings');
        return null;
    }
};

export const COMMUNITY_DOMAINS = [
    { name: 'Startup', slug: 'startup' },
    { name: 'Coding', slug: 'coding' },
    { name: 'Design', slug: 'design' },
    { name: 'Business', slug: 'business' },
    { name: 'Artificial Intelligence', slug: 'artificial-intelligence' },
];

export const sanitizeHandle = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 30);
};

export interface CreateCommunityInput {
    name: string;
    handle: string;
    description: string;
    purpose?: string;
    category: string;
    topics?: string[];
    avatarUrl?: string;
    bannerUrl?: string;
    foundingStory?: string;
    values?: string[];
    guidelines?: string[];
    visibility?: 'public' | 'private';
    joinPolicy?: 'open' | 'approval_required';
}

/**
 * Creates a new community in Firestore and joins the creator as an active member.
 */
export const createCommunity = async (
    payload: CreateCommunityInput,
    user: { uid: string; displayName?: string | null; photoURL?: string | null }
): Promise<Community> => {
    const newId = `comm_${Date.now()}`;
    const newComm: Community = {
        id: newId,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        avatarUrl: payload.avatarUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=200&h=200&auto=format&fit=crop',
        members: 1,
        rating: 5.0,
        isVerified: false,
        ownerId: user.uid,
        purpose: payload.purpose,
        foundingStory: payload.foundingStory,
        values: payload.values,
        guidelines: payload.guidelines,
        bannerUrl: payload.bannerUrl,
    };

    try {
        const commRef = doc(db, 'communities', newId);
        await setDoc(commRef, sanitizeForFirestore({ ...newComm, createdAt: serverTimestamp() }));

        await joinCommunity({
            community: newComm,
            user: {
                uid: user.uid,
                displayName: user.displayName,
            }
        });
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `communities/${newId}`);
    }

    return newComm;
};

/**
 * Seeds baseline community data into Firestore if desired.
 */
export const seedInitialCommunitiesIfEmpty = async (
    user?: { uid: string; displayName?: string | null } | null
): Promise<void> => {
    try {
        for (const comm of MOCK_COMMUNITIES.slice(0, 3)) {
            const commRef = doc(db, 'communities', comm.id);
            await setDoc(commRef, sanitizeForFirestore({ ...comm, createdAt: serverTimestamp() }), { merge: true });
        }
        if (user?.uid && MOCK_COMMUNITIES[0]) {
            await joinCommunity({
                community: MOCK_COMMUNITIES[0],
                user: { uid: user.uid, displayName: user.displayName }
            });
        }
    } catch (err) {
        console.warn('[SEED_COMMUNITIES_WARN]', err);
    }
};


