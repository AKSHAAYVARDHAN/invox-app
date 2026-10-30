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
    getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import type { Community, CommunityRole, CommunityMembership, ConclaveGathering, CommunityCoreValue, CommunityGuideline } from '../types';
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
                    role: data.role || 'member',
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
 * Subscribes in real-time to communities created / owned by the given user UID.
 * Ownership is determined strictly by matching community.ownerId or community.creatorId.
 */
export const subscribeUserOwnedCommunities = (
    userId: string | undefined | null,
    onUpdate: (communities: Community[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    if (!userId) {
        onUpdate([]);
        return () => {};
    }

    const q = query(
        collection(db, 'communities'),
        where('ownerId', '==', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: Community[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));
            onUpdate(list);
        },
        (err) => {
            handleFirestoreError(err, OperationType.LIST, 'communities');
            onError?.(err);
        }
    );
};

/**
 * Subscribes in real-time to communities where the given user UID is explicitly assigned
 * as a community administrator in adminIds.
 */
export const subscribeUserAdministeredCommunities = (
    userId: string | undefined | null,
    onUpdate: (communities: Community[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    if (!userId) {
        onUpdate([]);
        return () => {};
    }

    const q = query(
        collection(db, 'communities'),
        where('adminIds', 'array-contains', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: Community[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));
            onUpdate(list);
        },
        (err) => {
            handleFirestoreError(err, OperationType.LIST, 'communities');
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
                    const success = await leaveCommunity(community.id, user.uid);
                    if (!success) {
                        throw new Error('Failed to leave community');
                    }
                } else {
                    const result = await joinCommunity({ community, user });
                    if (!result.success) {
                        throw new Error('Failed to join community');
                    }
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

    const leave = useCallback(
        async (communityId: string) => {
            if (!user?.uid || !communityId) {
                return false;
            }

            setActionLoadingId(communityId);

            // Optimistic update
            setJoinedIds(prev => {
                const next = new Set(prev);
                next.delete(communityId);
                return next;
            });

            try {
                const success = await leaveCommunity(communityId, user.uid);
                if (!success) {
                    throw new Error('Failed to leave community');
                }
                return true;
            } catch (err) {
                // Rollback optimistic update on error
                setJoinedIds(prev => {
                    const next = new Set(prev);
                    next.add(communityId);
                    return next;
                });
                return false;
            } finally {
                setActionLoadingId(null);
            }
        },
        [user]
    );

    return {
        memberships,
        joinedIds,
        loading,
        actionLoadingId,
        isMember: (communityId: string) => joinedIds.has(communityId),
        toggleMembership,
        leaveCommunity: leave,
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
 * Normalizes core values into { id, title, description } format.
 * Gracefully adapts legacy string arrays without mutating existing mock data.
 */
export const normalizeCoreValues = (values?: (string | CommunityCoreValue)[]): CommunityCoreValue[] => {
    if (!values || !Array.isArray(values)) return [];
    return values
        .map((v, idx) => {
            if (typeof v === 'string') {
                const trimmed = v.trim();
                if (!trimmed) return null;
                return {
                    id: `val_${idx}_${trimmed.slice(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                    title: trimmed,
                    description: '',
                };
            }
            if (v && typeof v === 'object' && v.title && v.title.trim()) {
                return {
                    id: v.id || `val_${idx}`,
                    title: v.title.trim(),
                    description: v.description?.trim() || '',
                };
            }
            return null;
        })
        .filter((v): v is CommunityCoreValue => v !== null);
};

/**
 * Normalizes community guidelines into { id, title, description } format.
 * Gracefully adapts legacy string arrays without mutating existing mock data.
 */
export const normalizeGuidelines = (guidelines?: (string | CommunityGuideline)[]): CommunityGuideline[] => {
    if (!guidelines || !Array.isArray(guidelines)) return [];
    return guidelines
        .map((g, idx) => {
            if (typeof g === 'string') {
                const trimmed = g.trim();
                if (!trimmed) return null;
                return {
                    id: `guide_${idx}`,
                    title: `Guideline ${(idx + 1).toString().padStart(2, '0')}`,
                    description: trimmed,
                };
            }
            if (g && typeof g === 'object' && (g.title?.trim() || g.description?.trim())) {
                return {
                    id: g.id || `guide_${idx}`,
                    title: g.title?.trim() || `Guideline ${(idx + 1).toString().padStart(2, '0')}`,
                    description: g.description?.trim() || '',
                };
            }
            return null;
        })
        .filter((g): g is CommunityGuideline => g !== null);
};

export interface CollectiveIdentityPayload {
    purpose?: string;
    mission?: string;
    description?: string;
    foundingStory?: string;
    values?: CommunityCoreValue[];
    guidelines?: CommunityGuideline[];
}

/**
 * Validates collective identity inputs.
 * - Prevents empty or duplicate values (case-insensitive title uniqueness).
 * - Validates guidelines (cannot have empty titles).
 * - Sanitizes safe length boundaries.
 */
export const validateCollectiveIdentity = (
    data: CollectiveIdentityPayload
): { valid: boolean; error?: string; sanitizedData: CollectiveIdentityPayload } => {
    const sanitized: CollectiveIdentityPayload = {};

    if (data.purpose !== undefined) {
        sanitized.purpose = data.purpose.trim().slice(0, 2000);
    }
    if (data.mission !== undefined) {
        sanitized.mission = data.mission.trim().slice(0, 2000);
    }
    if (data.description !== undefined) {
        sanitized.description = data.description.trim().slice(0, 3000);
    }
    if (data.foundingStory !== undefined) {
        sanitized.foundingStory = data.foundingStory.trim().slice(0, 5000);
    }

    if (data.values !== undefined) {
        const seenTitles = new Set<string>();
        const sanitizedVals: CommunityCoreValue[] = [];
        for (const val of data.values) {
            const title = val.title?.trim();
            if (!title) {
                return { valid: false, error: 'Every core value must have a title.', sanitizedData: sanitized };
            }
            const normalizedKey = title.toLowerCase();
            if (seenTitles.has(normalizedKey)) {
                return { valid: false, error: `Duplicate core value title detected: "${title}"`, sanitizedData: sanitized };
            }
            seenTitles.add(normalizedKey);
            sanitizedVals.push({
                id: val.id || `val_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: title.slice(0, 100),
                description: val.description?.trim().slice(0, 500) || '',
            });
        }
        sanitized.values = sanitizedVals;
    }

    if (data.guidelines !== undefined) {
        const sanitizedGuides: CommunityGuideline[] = [];
        for (const guide of data.guidelines) {
            const title = guide.title?.trim();
            const desc = guide.description?.trim();
            if (!title && !desc) {
                return { valid: false, error: 'Guidelines cannot be completely empty.', sanitizedData: sanitized };
            }
            sanitizedGuides.push({
                id: guide.id || `guide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: (title || 'Guideline').slice(0, 150),
                description: (desc || '').slice(0, 1500),
            });
        }
        sanitized.guidelines = sanitizedGuides;
    }

    return { valid: true, sanitizedData: sanitized };
};

/**
 * Checks whether the authenticated user UID is the verified creator or owner of a community.
 * Evaluates strictly against community.ownerId or community.creatorId.
 * Does NOT infer ownership from membership records or platform administrator status.
 */
export const isCommunityOwner = (
    community: Community | null | undefined,
    uid: string | null | undefined
): boolean => {
    if (!uid || !community) return false;
    return Boolean(
        (community.ownerId && community.ownerId === uid) ||
        (community.creatorId && community.creatorId === uid)
    );
};

/**
 * Checks whether the authenticated user UID is an explicitly assigned administrator of a community.
 * Evaluates strictly against community.adminIds array.
 * Does NOT treat global platform administrators as community-specific administrators.
 */
export const isCommunityAdmin = (
    community: Community | null | undefined,
    uid: string | null | undefined
): boolean => {
    if (!uid || !community) return false;
    return Boolean(Array.isArray(community.adminIds) && community.adminIds.includes(uid));
};

/**
 * Checks whether a user has administrative or ownership authority over a community.
 * True ONLY if the user is the Community Owner or an explicit Community Administrator.
 */
export const isCommunityManager = (
    community: Community | null | undefined,
    uid: string | null | undefined
): boolean => {
    return isCommunityOwner(community, uid) || isCommunityAdmin(community, uid);
};

/**
 * Resolves the specific community role for a given user.
 * Distinguishes cleanly between:
 * - 'owner': Community Creator / Owner
 * - 'admin': Explicit Community Administrator
 * - 'member': Community Member
 * - null: Not associated
 */
export const getUserCommunityRole = (
    community: Community | null | undefined,
    uid: string | null | undefined,
    membership?: CommunityMembership | null
): CommunityRole | null => {
    if (!uid || !community) return null;
    if (isCommunityOwner(community, uid)) return 'owner';
    if (isCommunityAdmin(community, uid)) return 'admin';
    if (membership && membership.status === 'active') return 'member';
    return null;
};

/**
 * Checks if a user has permission to manage collective identity and settings for a given community.
 * Strictly limited to Community Creator/Owner or explicitly assigned Community Administrator.
 * 
 * In accordance with INVOX architecture:
 * - Platform admins/moderators do NOT automatically inherit community management rights.
 * - Membership role does NOT grant ownership or community administration.
 */
export const canUserManageCommunity = (
    community: Community | null | undefined,
    user: { uid: string; email?: string | null } | null | undefined,
    _userRole?: string,
    _memberships?: CommunityMembership[]
): boolean => {
    if (!user?.uid || !community) return false;
    return isCommunityManager(community, user.uid);
};

/**
 * Updates a community's collective identity information in Firestore.
 */
export const updateCommunityIdentity = async (
    communityId: string,
    data: CollectiveIdentityPayload & Partial<Community>
): Promise<{ success: boolean; error?: string }> => {
    if (!communityId) return { success: false, error: 'Missing community identifier' };

    const valResult = validateCollectiveIdentity(data);
    if (!valResult.valid) {
        return { success: false, error: valResult.error };
    }

    try {
        const ref = doc(db, 'communities', communityId);
        await setDoc(
            ref,
            sanitizeForFirestore({
                ...valResult.sanitizedData,
                updatedAt: serverTimestamp(),
            }),
            { merge: true }
        );
        return { success: true };
    } catch (error: any) {
        handleFirestoreError(error, OperationType.WRITE, `communities/${communityId}`);
        return { success: false, error: error?.message || 'Failed to update community identity' };
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

export const checkHandleAvailability = async (
    handle: string,
    excludeCommunityId?: string
): Promise<{ available: boolean; reason?: string }> => {
    const clean = sanitizeHandle(handle);
    if (!clean || clean.length < 3) {
        return { available: false, reason: 'Handle must be at least 3 characters (letters, numbers, underscores)' };
    }
    // Check against mock communities
    const mockMatch = MOCK_COMMUNITIES.find(c => c.handle?.toLowerCase() === clean && c.id !== excludeCommunityId);
    if (mockMatch) {
        return { available: false, reason: 'Handle already registered by an established collective' };
    }
    // Check Firestore
    try {
        const q = query(collection(db, 'communities'), where('handle', '==', clean));
        const snap = await getDocs(q);
        const exists = snap.docs.some(d => d.id !== excludeCommunityId);
        if (exists) {
            return { available: false, reason: 'Handle already claimed by another collective' };
        }
    } catch (err) {
        console.warn('[CHECK_HANDLE_WARN]', err);
    }
    return { available: true };
};

export interface CreateCommunityInput {
    name: string;
    handle: string;
    description: string;
    purpose?: string;
    mission?: string;
    category: string;
    topics?: string[];
    avatarUrl?: string;
    bannerUrl?: string;
    foundingStory?: string;
    values?: (string | CommunityCoreValue)[];
    guidelines?: (string | CommunityGuideline)[];
    visibility?: 'public' | 'private';
    joinPolicy?: 'open' | 'approval_required';
    governanceModel?: string;
    postPermission?: 'all' | 'admins_only';
    gatheringPermission?: 'all' | 'admins_only';
    adminIds?: string[];
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
        handle: payload.handle,
        description: payload.description,
        category: payload.category,
        topics: payload.topics || [],
        avatarUrl: payload.avatarUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=200&h=200&auto=format&fit=crop',
        members: 1,
        rating: 5.0,
        isVerified: false,
        ownerId: user.uid,
        creatorId: user.uid,
        ownerName: user.displayName || 'Owner',
        ownerAvatar: user.photoURL || undefined,
        adminIds: payload.adminIds || [],
        purpose: payload.purpose,
        mission: payload.mission,
        foundingStory: payload.foundingStory,
        values: payload.values,
        guidelines: payload.guidelines,
        bannerUrl: payload.bannerUrl,
        visibility: payload.visibility || 'public',
        joinPolicy: payload.joinPolicy || 'open',
        governanceModel: payload.governanceModel || 'Sovereign Founder',
        postPermission: payload.postPermission || 'all',
        gatheringPermission: payload.gatheringPermission || 'all',
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
        throw err;
    }

    return newComm;
};

export interface UpdateCommunityInput {
    name?: string;
    handle?: string;
    description?: string;
    purpose?: string;
    mission?: string;
    category?: string;
    topics?: string[];
    avatarUrl?: string;
    bannerUrl?: string;
    foundingStory?: string;
    values?: (string | CommunityCoreValue)[];
    guidelines?: (string | CommunityGuideline)[];
    visibility?: 'public' | 'private';
    joinPolicy?: 'open' | 'approval_required';
    governanceModel?: string;
    postPermission?: 'all' | 'admins_only';
    gatheringPermission?: 'all' | 'admins_only';
    adminIds?: string[];
}

/**
 * Updates an existing community in Firestore.
 * Strictly limited to Community Creator/Owner or explicitly assigned Community Administrator.
 */
export const updateCommunity = async (
    communityId: string,
    payload: UpdateCommunityInput,
    user: { uid: string; displayName?: string | null }
): Promise<{ success: boolean; community?: Community; error?: string }> => {
    if (!communityId) return { success: false, error: 'Missing community identifier' };
    if (!user?.uid) return { success: false, error: 'Unauthorized: Authentication required.' };

    try {
        const commRef = doc(db, 'communities', communityId);
        const snap = await getDoc(commRef);
        let existingData: any = {};
        if (snap.exists()) {
            existingData = snap.data();
        } else {
            const mockComm = MOCK_COMMUNITIES.find(c => c.id === communityId);
            if (mockComm) {
                existingData = { ...mockComm };
            } else {
                return { success: false, error: 'Community collective not found.' };
            }
        }

        // Authorization check: User must be community owner or explicit administrator
        const isOwner = existingData.ownerId === user.uid || existingData.creatorId === user.uid;
        const isAdmin = Array.isArray(existingData.adminIds) && existingData.adminIds.includes(user.uid);
        if (!isOwner && !isAdmin) {
            return {
                success: false,
                error: 'Unauthorized: You do not possess sovereign ownership or administrative authorization for this collective.'
            };
        }

        // Prepare sanitized update fields without clobbering existing metadata
        const updateData: Partial<Community> = {
            ...payload,
            updatedAt: serverTimestamp(),
        };

        const sanitized = sanitizeForFirestore(updateData);
        await setDoc(commRef, sanitized, { merge: true });

        const updatedCommunity: Community = {
            ...existingData,
            ...updateData,
            id: communityId,
        };

        return { success: true, community: updatedCommunity };
    } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `communities/${communityId}`);
        return { success: false, error: err?.message || 'Failed to update community' };
    }
};

/**
 * Deletes a community from Firestore.
 * Allowed strictly for the verified community creator/owner.
 */
export const deleteCommunity = async (
    communityId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!communityId || !userId) {
        return { success: false, error: 'Missing community or user identifier' };
    }

    try {
        const commRef = doc(db, 'communities', communityId);
        const snap = await getDoc(commRef);
        if (!snap.exists()) {
            return { success: false, error: 'Community not found' };
        }
        const data = snap.data();
        if (data.ownerId !== userId && data.creatorId !== userId) {
            return { success: false, error: 'Unauthorized: only the verified community owner can delete this collective.' };
        }

        await deleteDoc(commRef);
        return { success: true };
    } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `communities/${communityId}`);
        return { success: false, error: err?.message || 'Failed to delete community' };
    }
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


