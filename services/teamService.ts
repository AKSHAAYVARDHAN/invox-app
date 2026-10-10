import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    addDoc,
    orderBy,
    increment,
    arrayUnion,
    deleteDoc,
    limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import type { InvoxUser, Post, Project, User, CollabApplication } from '../types';

export interface Team {
    id: string;
    name: string;
    description?: string;
    projectId: string;
    projectTitle: string;
    projectDomain?: string;
    ownerId: string;
    ownerName: string;
    ownerAvatar?: string | null;
    memberCount: number;
    memberIds: string[];
    lastMessage?: string;
    lastMessageSenderId?: string;
    lastMessageSenderName?: string;
    lastMessageTimestamp?: any;
    createdAt?: any;
    updatedAt?: any;
}

export interface TeamMember {
    id: string; // userId
    teamId: string;
    userId: string;
    displayName: string;
    username?: string;
    photoURL?: string | null;
    role: 'owner' | 'member';
    projectRole?: string;
    joinedAt: any;
    lastReadAt?: any;
}

export interface TeamMessage {
    id: string;
    teamId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string | null;
    text: string;
    createdAt: any;
    readBy?: string[];
}

export interface TeamInvitation {
    id: string; // token
    token: string;
    teamId: string;
    teamName: string;
    projectId: string;
    projectTitle: string;
    ownerId: string;
    ownerName: string;
    createdBy: string;
    createdAt: any;
    expiresAt?: any | null;
    status: 'active' | 'revoked';
    maxUses?: number;
    usedCount: number;
    usedBy: string[];
}

/**
 * Generate a random URL-safe token for team invitations
 */
export const generateInviteToken = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const randomValues = new Uint8Array(20);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < 20; i++) {
            result += chars[randomValues[i] % chars.length];
        }
    } else {
        for (let i = 0; i < 20; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return result;
};

/**
 * Creates a new Team associated with a project.
 * Verifies project ownership / authorization and registers the creator as owner and member.
 */
export const createTeam = async ({
    name,
    description,
    project,
    user,
    userProfile,
}: {
    name: string;
    description?: string;
    project: Project | Post;
    user: User;
    userProfile?: InvoxUser | null;
}): Promise<{ team: Team; invitationToken: string }> => {
    if (!user?.uid) {
        throw new Error('Authentication required: You must be logged in to create a team.');
    }

    const cleanName = name.trim();
    if (!cleanName) {
        throw new Error('Team name is required.');
    }

    const projectAuthorId = project.authorId || (project as any).author?.uid || '';
    if (projectAuthorId && projectAuthorId !== user.uid) {
        throw new Error('Unauthorized: You can only create teams for projects you own or manage.');
    }

    const teamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const teamRef = doc(db, COLLECTIONS.teams, teamId);

    const projectTitle = (project as any).aiSummary || (project as any).oneLine || (project as any).title || 'Untitled Project';
    const projectDomain = (project as any).domain || (project as any).category || 'General';

    const ownerName = userProfile?.displayName || user.displayName || 'Project Owner';
    const ownerAvatar = userProfile?.photoURL || user.photoURL || null;

    const teamData: Omit<Team, 'id'> = {
        name: cleanName,
        description: description?.trim() || '',
        projectId: project.id,
        projectTitle,
        projectDomain,
        ownerId: user.uid,
        ownerName,
        ownerAvatar,
        memberCount: 1,
        memberIds: [user.uid],
        lastMessage: 'Team space created.',
        lastMessageSenderId: user.uid,
        lastMessageSenderName: ownerName,
        lastMessageTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(teamRef, sanitizeForFirestore(teamData));

    // Register creator as owner member in subcollection
    const memberRef = doc(db, COLLECTIONS.teams, teamId, 'members', user.uid);
    const memberData: Omit<TeamMember, 'id'> = {
        teamId,
        userId: user.uid,
        displayName: ownerName,
        username: userProfile?.username || user.email?.split('@')[0] || '',
        photoURL: ownerAvatar,
        role: 'owner',
        projectRole: 'Project Lead',
        joinedAt: serverTimestamp(),
        lastReadAt: serverTimestamp(),
    };
    await setDoc(memberRef, sanitizeForFirestore(memberData));

    // Automatically generate the initial active invitation link token
    const token = generateInviteToken();
    const inviteRef = doc(db, COLLECTIONS.teamInvitations, token);
    const inviteData: Omit<TeamInvitation, 'id'> = {
        token,
        teamId,
        teamName: cleanName,
        projectId: project.id,
        projectTitle,
        ownerId: user.uid,
        ownerName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: null,
        status: 'active',
        maxUses: 0, // unlimited
        usedCount: 0,
        usedBy: [],
    };
    await setDoc(inviteRef, sanitizeForFirestore(inviteData));

    return {
        team: {
            id: teamId,
            ...teamData,
        },
        invitationToken: token,
    };
};

/**
 * Subscribes to all Teams where the current user is a member.
 */
export const subscribeToUserTeams = (
    userId: string,
    onUpdate: (teams: Team[]) => void,
    onError?: (error: any) => void
): (() => void) => {
    if (!userId) {
        onUpdate([]);
        return () => {};
    }

    const q = query(
        collection(db, COLLECTIONS.teams),
        where('memberIds', 'array-contains', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: Team[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as any),
            }));

            // Sort by latest message or update timestamp
            list.sort((a, b) => {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime() || 0;
                };
                const timeA = getTime(a.lastMessageTimestamp || a.updatedAt || a.createdAt);
                const timeB = getTime(b.lastMessageTimestamp || b.updatedAt || b.createdAt);
                return timeB - timeA;
            });

            onUpdate(list);
        },
        (err) => {
            console.error('[SUBSCRIBE_USER_TEAMS_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Subscribes to a single team's details.
 */
export const subscribeToTeam = (
    teamId: string,
    onUpdate: (team: Team | null) => void,
    onError?: (error: any) => void
): (() => void) => {
    if (!teamId) {
        onUpdate(null);
        return () => {};
    }

    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    return onSnapshot(
        teamRef,
        (docSnap) => {
            if (docSnap.exists()) {
                onUpdate({
                    id: docSnap.id,
                    ...(docSnap.data() as any),
                });
            } else {
                onUpdate(null);
            }
        },
        (err) => {
            console.error('[SUBSCRIBE_TEAM_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Subscribes to all members of a specific team.
 */
export const subscribeToTeamMembers = (
    teamId: string,
    onUpdate: (members: TeamMember[]) => void,
    onError?: (error: any) => void
): (() => void) => {
    if (!teamId) {
        onUpdate([]);
        return () => {};
    }

    const membersRef = collection(db, COLLECTIONS.teams, teamId, 'members');
    return onSnapshot(
        membersRef,
        (snapshot) => {
            const list: TeamMember[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as any),
            }));

            // Sort owners first, then alphabetical
            list.sort((a, b) => {
                if (a.role === 'owner' && b.role !== 'owner') return -1;
                if (b.role === 'owner' && a.role !== 'owner') return 1;
                return (a.displayName || '').localeCompare(b.displayName || '');
            });

            onUpdate(list);
        },
        (err) => {
            console.error('[SUBSCRIBE_TEAM_MEMBERS_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Subscribes to real-time chronological messages inside a team.
 */
export const subscribeToTeamMessages = (
    teamId: string,
    onUpdate: (messages: TeamMessage[]) => void,
    onError?: (error: any) => void
): (() => void) => {
    if (!teamId) {
        onUpdate([]);
        return () => {};
    }

    const msgsRef = collection(db, COLLECTIONS.teams, teamId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const msgs: TeamMessage[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                teamId,
                ...(docSnap.data() as any),
            }));
            onUpdate(msgs);
        },
        (err) => {
            console.warn('[SUBSCRIBE_TEAM_MESSAGES_FALLBACK_ATTEMPT]', err);
            // Fallback in case index is building
            const fallbackUnsub = onSnapshot(
                msgsRef,
                (fallbackSnap) => {
                    const msgs: TeamMessage[] = fallbackSnap.docs.map((docSnap) => ({
                        id: docSnap.id,
                        teamId,
                        ...(docSnap.data() as any),
                    }));
                    msgs.sort((a, b) => {
                        const getT = (val: any) => {
                            if (!val) return 0;
                            if (typeof val.toDate === 'function') return val.toDate().getTime();
                            if (val instanceof Date) return val.getTime();
                            return new Date(val).getTime() || 0;
                        };
                        return getT(a.createdAt) - getT(b.createdAt);
                    });
                    onUpdate(msgs);
                },
                (fallbackErr) => {
                    console.error('[SUBSCRIBE_TEAM_MESSAGES_ERROR]', fallbackErr);
                    if (onError) onError(fallbackErr);
                }
            );
            return fallbackUnsub;
        }
    );
};

/**
 * Sends a message to a Team.
 */
export const sendTeamMessage = async ({
    teamId,
    senderId,
    senderName,
    senderAvatar,
    text,
}: {
    teamId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string | null;
    text: string;
}): Promise<void> => {
    const cleanText = text.trim();
    if (!cleanText) return;

    // 1. Add message doc
    const msgsRef = collection(db, COLLECTIONS.teams, teamId, 'messages');
    await addDoc(msgsRef, sanitizeForFirestore({
        teamId,
        senderId,
        senderName,
        senderAvatar: senderAvatar || null,
        text: cleanText,
        readBy: [senderId],
        createdAt: serverTimestamp(),
    }));

    // 2. Update parent team document with latest message info
    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    await updateDoc(teamRef, sanitizeForFirestore({
        lastMessage: cleanText,
        lastMessageSenderId: senderId,
        lastMessageSenderName: senderName,
        lastMessageTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
    })).catch((e) => console.warn('[UPDATE_TEAM_LAST_MESSAGE_WARN]', e));

    // 3. Update sender's lastReadAt
    const memberRef = doc(db, COLLECTIONS.teams, teamId, 'members', senderId);
    await updateDoc(memberRef, {
        lastReadAt: serverTimestamp(),
    }).catch(() => {});
};

/**
 * Marks all messages in a team as read for the current user.
 */
export const markTeamAsRead = async (teamId: string, userId: string): Promise<void> => {
    if (!teamId || !userId) return;

    try {
        const memberRef = doc(db, COLLECTIONS.teams, teamId, 'members', userId);
        await updateDoc(memberRef, {
            lastReadAt: serverTimestamp(),
        });
    } catch (e) {
        // Ignored if member doc update fails
    }

    try {
        const msgsRef = collection(db, COLLECTIONS.teams, teamId, 'messages');
        const snap = await getDocs(msgsRef);
        for (const mDoc of snap.docs) {
            const data = mDoc.data();
            if (data.senderId !== userId && (!data.readBy || !data.readBy.includes(userId))) {
                updateDoc(mDoc.ref, {
                    readBy: arrayUnion(userId),
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.warn('[MARK_TEAM_READ_MESSAGES_ERROR]', e);
    }
};

/**
 * Creates a new invitation token for a team.
 */
export const createTeamInvitation = async ({
    teamId,
    teamName,
    projectId,
    projectTitle,
    ownerId,
    ownerName,
    user,
    expiresInDays,
    maxUses,
}: {
    teamId: string;
    teamName: string;
    projectId: string;
    projectTitle: string;
    ownerId: string;
    ownerName: string;
    user: User;
    expiresInDays?: number | null;
    maxUses?: number;
}): Promise<TeamInvitation> => {
    if (!user?.uid || user.uid !== ownerId) {
        throw new Error('Unauthorized: Only team owners can generate invitations.');
    }

    const token = generateInviteToken();
    const inviteRef = doc(db, COLLECTIONS.teamInvitations, token);

    let expiresAt: any = null;
    if (expiresInDays && expiresInDays > 0) {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + expiresInDays);
        expiresAt = expDate;
    }

    const inviteData: Omit<TeamInvitation, 'id'> = {
        token,
        teamId,
        teamName,
        projectId,
        projectTitle,
        ownerId,
        ownerName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt,
        status: 'active',
        maxUses: maxUses || 0,
        usedCount: 0,
        usedBy: [],
    };

    await setDoc(inviteRef, sanitizeForFirestore(inviteData));

    return {
        id: token,
        ...inviteData,
    };
};

/**
 * Fetches an invitation by token.
 */
export const getTeamInvitation = async (token: string): Promise<TeamInvitation | null> => {
    if (!token) return null;
    try {
        const inviteRef = doc(db, COLLECTIONS.teamInvitations, token);
        const snap = await getDoc(inviteRef);
        if (snap.exists()) {
            return {
                id: snap.id,
                ...(snap.data() as any),
            };
        }
        return null;
    } catch (e) {
        console.error('[GET_TEAM_INVITATION_ERROR]', e);
        return null;
    }
};

/**
 * Subscribes to invitations created for a specific team.
 */
export const subscribeToTeamInvitations = (
    teamId: string,
    onUpdate: (invitations: TeamInvitation[]) => void,
    onError?: (error: any) => void
): (() => void) => {
    if (!teamId) {
        onUpdate([]);
        return () => {};
    }

    const q = query(
        collection(db, COLLECTIONS.teamInvitations),
        where('teamId', '==', teamId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: TeamInvitation[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));
            onUpdate(list);
        },
        (err) => {
            console.error('[SUBSCRIBE_TEAM_INVITATIONS_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Revokes a team invitation link.
 */
export const revokeTeamInvitation = async (token: string, userId: string): Promise<void> => {
    if (!token || !userId) return;

    const inviteRef = doc(db, COLLECTIONS.teamInvitations, token);
    const snap = await getDoc(inviteRef);
    if (!snap.exists()) {
        throw new Error('Invitation not found.');
    }

    const data = snap.data();
    if (data.createdBy !== userId && data.ownerId !== userId) {
        throw new Error('Unauthorized: Only the creator or team owner can revoke this invitation.');
    }

    await updateDoc(inviteRef, {
        status: 'revoked',
        updatedAt: serverTimestamp(),
    });
};

/**
 * Handles a user joining a Team via an invitation token.
 */
export const joinTeamViaInvitation = async ({
    token,
    user,
    userProfile,
    projectRole,
}: {
    token: string;
    user: User;
    userProfile?: InvoxUser | null;
    projectRole?: string;
}): Promise<{ status: 'joined' | 'already_member'; team: Team }> => {
    if (!user?.uid) {
        throw new Error('Authentication required: You must be signed in to join a team.');
    }

    const invitation = await getTeamInvitation(token);
    if (!invitation) {
        throw new Error('Invalid invitation: This invitation does not exist.');
    }

    if (invitation.status === 'revoked') {
        throw new Error('Invitation revoked: This invitation link has been revoked by the project owner.');
    }

    // Check expiration
    if (invitation.expiresAt) {
        const expTime = typeof invitation.expiresAt?.toDate === 'function'
            ? invitation.expiresAt.toDate().getTime()
            : new Date(invitation.expiresAt).getTime();
        if (expTime > 0 && Date.now() > expTime) {
            throw new Error('Invitation expired: This invitation link has expired.');
        }
    }

    // Check max uses
    if (invitation.maxUses && invitation.maxUses > 0 && invitation.usedCount >= invitation.maxUses) {
        throw new Error('Invitation limit reached: This invitation link has already reached its maximum number of uses.');
    }

    // Fetch team
    const teamRef = doc(db, COLLECTIONS.teams, invitation.teamId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        throw new Error('Team no longer exists.');
    }

    const teamData = teamSnap.data() as Team;
    const isAlreadyMember = Array.isArray(teamData.memberIds) && teamData.memberIds.includes(user.uid);

    const team: Team = {
        id: teamSnap.id,
        ...teamData,
    };

    if (isAlreadyMember) {
        return { status: 'already_member', team };
    }

    // Add user as member in subcollection
    const memberName = userProfile?.displayName || user.displayName || 'Team Member';
    const memberAvatar = userProfile?.photoURL || user.photoURL || null;

    const memberRef = doc(db, COLLECTIONS.teams, invitation.teamId, 'members', user.uid);
    const memberData: Omit<TeamMember, 'id'> = {
        teamId: invitation.teamId,
        userId: user.uid,
        displayName: memberName,
        username: userProfile?.username || user.email?.split('@')[0] || '',
        photoURL: memberAvatar,
        role: 'member',
        projectRole: projectRole || 'Team Collaborator',
        joinedAt: serverTimestamp(),
        lastReadAt: serverTimestamp(),
    };
    await setDoc(memberRef, sanitizeForFirestore(memberData));

    // Update team document memberIds and count
    await updateDoc(teamRef, {
        memberIds: arrayUnion(user.uid),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
    });

    // Update invitation usage
    const inviteRef = doc(db, COLLECTIONS.teamInvitations, token);
    await updateDoc(inviteRef, {
        usedCount: increment(1),
        usedBy: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
    }).catch(() => {});

    return {
        status: 'joined',
        team: {
            ...team,
            memberIds: [...(team.memberIds || []), user.uid],
            memberCount: (team.memberCount || 1) + 1,
        },
    };
};

/**
 * Real-time subscription to unread message counts across all teams for a user.
 * Guarantees reactive updates when messages arrive or are read, without page reloads.
 */
export const subscribeToUserTeamUnreadCounts = (
    userId: string,
    onUpdate: (result: { totalTeamsUnread: number; teamUnreadMap: Record<string, number> }) => void,
    activeTeamId?: string | null
): (() => void) => {
    if (!userId) {
        onUpdate({ totalTeamsUnread: 0, teamUnreadMap: {} });
        return () => {};
    }

    const messageListeners = new Map<string, () => void>();
    const teamUnreadMap: Record<string, number> = {};

    const recalculateAndNotify = () => {
        let total = 0;
        for (const [tId, count] of Object.entries(teamUnreadMap)) {
            if (activeTeamId && tId === activeTeamId) {
                continue; // User is actively viewing this team
            }
            total += count;
        }

        onUpdate({
            totalTeamsUnread: total,
            teamUnreadMap: { ...teamUnreadMap },
        });
    };

    const teamsQuery = query(
        collection(db, COLLECTIONS.teams),
        where('memberIds', 'array-contains', userId)
    );

    const unsubTeams = onSnapshot(
        teamsQuery,
        (teamsSnap) => {
            const currentTeamIds = new Set<string>();

            teamsSnap.docs.forEach((docSnap) => {
                const teamId = docSnap.id;
                currentTeamIds.add(teamId);

                if (!messageListeners.has(teamId)) {
                    const msgsRef = collection(db, COLLECTIONS.teams, teamId, 'messages');
                    const unsubMsgs = onSnapshot(
                        msgsRef,
                        (msgsSnap) => {
                            let unreadInTeam = 0;
                            msgsSnap.docs.forEach((mDoc) => {
                                const m = mDoc.data();
                                // Only count messages sent by others that haven't been read by this user
                                if (m.senderId !== userId) {
                                    const readBy = Array.isArray(m.readBy) ? m.readBy : [];
                                    if (!readBy.includes(userId)) {
                                        unreadInTeam += 1;
                                    }
                                }
                            });

                            teamUnreadMap[teamId] = unreadInTeam;
                            recalculateAndNotify();
                        },
                        (err) => {
                            console.warn(`[TEAM_UNREAD_LISTENER_WARN] ${teamId}:`, err);
                        }
                    );

                    messageListeners.set(teamId, unsubMsgs);
                }
            });

            // Clean up removed teams
            for (const [teamId, unsub] of messageListeners.entries()) {
                if (!currentTeamIds.has(teamId)) {
                    unsub();
                    messageListeners.delete(teamId);
                    delete teamUnreadMap[teamId];
                }
            }

            recalculateAndNotify();
        },
        (err) => {
            console.error('[USER_TEAMS_SUBSCRIPTION_ERROR]', err);
        }
    );

    return () => {
        unsubTeams();
        for (const unsub of messageListeners.values()) {
            unsub();
        }
        messageListeners.clear();
    };
};

/**
 * Fetches accepted collaborator applications for a project, so the project owner can easily
 * invite accepted collaborators to the team.
 */
export const getProjectAcceptedCollaborators = async (projectId: string): Promise<CollabApplication[]> => {
    if (!projectId) return [];
    try {
        const appsRef = collection(db, COLLECTIONS.applications);
        const q = query(
            appsRef,
            where('collabId', '==', projectId),
            where('status', '==', 'ACCEPTED')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
        }));
    } catch (e) {
        console.warn('[GET_ACCEPTED_COLLABORATORS_WARN]', e);
        return [];
    }
};
