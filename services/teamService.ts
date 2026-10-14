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
    arrayRemove,
    deleteDoc,
    limit,
    runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import { sendNotification } from './notificationService';
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
 * Fetches a single team's details by ID.
 */
export const getTeam = async (teamId: string): Promise<Team | null> => {
    if (!teamId) return null;

    if (teamId === 'team_demo_phoenix') {
        let storedMembers: string[] = ['owner_phoenix'];
        if (typeof window !== 'undefined') {
            try {
                const parsed = JSON.parse(sessionStorage.getItem('invox_demo_phoenix_members') || '["owner_phoenix"]');
                if (Array.isArray(parsed)) storedMembers = parsed;
            } catch {
                // ignore
            }
        }
        return {
            id: 'team_demo_phoenix',
            name: 'Phoenix Core',
            description: 'Core decentralized infrastructure squad',
            projectId: 'proj-phoenix',
            projectTitle: 'Phoenix Decentralized Network',
            projectDomain: 'Cybersecurity',
            ownerId: 'owner_phoenix',
            ownerName: 'Phoenix Lead',
            ownerAvatar: 'https://picsum.photos/seed/phoenix/200',
            memberCount: storedMembers.length + 2,
            memberIds: storedMembers,
        };
    }

    try {
        const teamRef = doc(db, COLLECTIONS.teams, teamId);
        const snap = await getDoc(teamRef);
        if (snap.exists()) {
            return {
                id: snap.id,
                ...(snap.data() as any),
            };
        }
        return null;
    } catch (e) {
        console.error('[GET_TEAM_ERROR]', e);
        return null;
    }
};

/**
 * Checks if a specific user is an active member or owner of a team.
 */
export const checkTeamMembership = async (teamId: string, userId: string): Promise<boolean> => {
    if (!teamId || !userId) return false;

    try {
        const team = await getTeam(teamId);
        if (!team) return false;
        if (team.ownerId === userId) return true;
        if (Array.isArray(team.memberIds) && team.memberIds.includes(userId)) return true;

        const memberRef = doc(db, COLLECTIONS.teams, teamId, 'members', userId);
        const memberSnap = await getDoc(memberRef);
        return memberSnap.exists();
    } catch (err) {
        console.warn('[CHECK_TEAM_MEMBERSHIP_WARN]', err);
        return false;
    }
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

    // 4. Notify all other team members in real-time
    try {
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
            const teamData = teamSnap.data() as Team;
            const memberIds = Array.isArray(teamData.memberIds) ? teamData.memberIds : [];
            const otherMembers = memberIds.filter((mId) => mId && mId !== senderId);

            for (const mId of otherMembers) {
                sendNotification({
                    recipientId: mId,
                    actorId: senderId,
                    actorName: senderName,
                    actorAvatar: senderAvatar || null,
                    type: 'message_team',
                    title: `Team Message • ${teamData.name || 'Team Workspace'}`,
                    body: `${senderName}: ${cleanText.slice(0, 100)}`,
                    targetType: 'team',
                    targetId: teamId,
                    metadata: {
                        teamId,
                        projectId: teamData.projectId,
                    },
                }).catch(() => {});
            }
        }
    } catch (notifErr) {
        console.warn('[TEAM_MESSAGE_NOTIF_WARN]', notifErr);
    }
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
 * Deletes a message from a team conversation.
 * Permissions enforced:
 * - Message author can delete their own message.
 * - Team owner/lead can moderate and delete any message in their team.
 * - Non-authors/unauthorized members are rejected.
 * - Updates the team document's lastMessage preview in real time if the deleted message was latest.
 */
export const deleteTeamMessage = async ({
    teamId,
    messageId,
    userId,
}: {
    teamId: string;
    messageId: string;
    userId: string;
}): Promise<void> => {
    if (!teamId || !messageId || !userId) {
        throw new Error('Invalid arguments: teamId, messageId, and userId are required.');
    }

    // Demo team handling
    if (teamId === 'team_demo_phoenix') {
        return;
    }

    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        throw new Error('Team workspace not found.');
    }
    const teamData = teamSnap.data() as Team;

    const messageRef = doc(db, COLLECTIONS.teams, teamId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    if (!messageSnap.exists()) {
        // Already deleted or does not exist
        return;
    }
    const messageData = messageSnap.data();

    // Permissions check: message sender OR team owner
    const isSender = messageData.senderId === userId;
    const isOwner = teamData.ownerId === userId;

    if (!isSender && !isOwner) {
        throw new Error('Unauthorized: You can only delete your own messages or moderate as team owner.');
    }

    // Delete message doc in Firestore
    await deleteDoc(messageRef);

    // Recalculate team's lastMessage metadata if needed
    try {
        const msgsRef = collection(db, COLLECTIONS.teams, teamId, 'messages');
        const q = query(msgsRef, orderBy('createdAt', 'desc'), limit(1));
        const latestSnap = await getDocs(q);

        if (!latestSnap.empty) {
            const latestData = latestSnap.docs[0].data();
            await updateDoc(teamRef, {
                lastMessage: (latestData.text || '').slice(0, 120),
                lastMessageSenderId: latestData.senderId || null,
                lastMessageSenderName: latestData.senderName || 'Team Member',
                lastMessageTimestamp: latestData.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
            }).catch((err) => console.warn('[UPDATE_LAST_MESSAGE_AFTER_DELETE_WARN]', err));
        } else {
            // No messages remain in team
            await updateDoc(teamRef, {
                lastMessage: null,
                lastMessageSenderId: null,
                lastMessageSenderName: null,
                lastMessageTimestamp: null,
                updatedAt: serverTimestamp(),
            }).catch((err) => console.warn('[CLEAR_LAST_MESSAGE_AFTER_DELETE_WARN]', err));
        }
    } catch (recalcErr) {
        console.warn('[RECALCULATE_LAST_MESSAGE_WARN]', recalcErr);
    }
};

/**
 * Allows a team member to voluntarily leave a team.
 * Edge cases:
 * - If current user is the team owner and other members exist:
 *   Throws an error prompting ownership transfer or disbanding.
 * - If current user is the team owner and sole member:
 *   Disbands/deletes the team workspace safely.
 * - If ordinary member:
 *   Removes membership doc, decrements memberCount, removes user from memberIds,
 *   and notifies the team owner.
 */
export const leaveTeam = async ({
    teamId,
    userId,
    userName,
}: {
    teamId: string;
    userId: string;
    userName?: string;
}): Promise<{ status: 'left' | 'deleted' }> => {
    if (!teamId || !userId) {
        throw new Error('Invalid arguments: teamId and userId are required.');
    }

    // Handle demo team
    if (teamId === 'team_demo_phoenix') {
        if (typeof window !== 'undefined') {
            try {
                let storedMembers: string[] = ['owner_phoenix'];
                const parsed = JSON.parse(sessionStorage.getItem('invox_demo_phoenix_members') || '["owner_phoenix"]');
                if (Array.isArray(parsed)) storedMembers = parsed;
                storedMembers = storedMembers.filter((m) => m !== userId);
                sessionStorage.setItem('invox_demo_phoenix_members', JSON.stringify(storedMembers));
            } catch {
                // ignore
            }
        }
        return { status: 'left' };
    }

    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        throw new Error('Team does not exist.');
    }
    const teamData = teamSnap.data() as Team;

    const isOwner = teamData.ownerId === userId;
    const memberIds = Array.isArray(teamData.memberIds) ? teamData.memberIds : [];
    const otherMembers = memberIds.filter((m) => m !== userId);

    if (isOwner) {
        if (otherMembers.length > 0) {
            throw new Error(
                'Team Lead Restriction: As the team lead, you cannot leave while other collaborators are assigned to the squad. Transfer leadership or disband the squad first.'
            );
        } else {
            // Sole member and owner: delete the team workspace
            await deleteDoc(teamRef);
            return { status: 'deleted' };
        }
    }

    // 1. Delete member document in subcollection
    const memberRef = doc(db, COLLECTIONS.teams, teamId, 'members', userId);
    await deleteDoc(memberRef).catch((e) => console.warn('[DELETE_MEMBER_DOC_WARN]', e));

    // 2. Atomically update team document: remove from memberIds, decrement memberCount
    await updateDoc(teamRef, {
        memberIds: arrayRemove(userId),
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
    });

    // 3. Notify team owner that a member left
    if (teamData.ownerId && teamData.ownerId !== userId) {
        sendNotification({
            recipientId: teamData.ownerId,
            actorId: userId,
            actorName: userName || 'Team Member',
            type: 'team_member_left',
            title: 'Team Member Departed',
            body: `${userName || 'A member'} has voluntarily left the team "${teamData.name}".`,
            targetType: 'team',
            targetId: teamId,
            metadata: {
                teamId,
                projectId: teamData.projectId,
                memberId: userId,
            },
        }).catch((err) => console.warn('[LEAVE_TEAM_NOTIF_WARN]', err));
    }

    return { status: 'left' };
};

/**
 * Removes a member from a team. Only team owners can execute this.
 */
export const removeTeamMember = async ({
    teamId,
    memberUserId,
    requesterUserId,
    memberName,
}: {
    teamId: string;
    memberUserId: string;
    requesterUserId: string;
    memberName?: string;
}): Promise<void> => {
    if (!teamId || !memberUserId || !requesterUserId) {
        throw new Error('Invalid arguments: teamId, memberUserId, and requesterUserId are required.');
    }

    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) {
        throw new Error('Team workspace not found.');
    }
    const teamData = teamSnap.data() as Team;

    if (teamData.ownerId !== requesterUserId) {
        throw new Error('Unauthorized: Only the team owner can remove collaborators.');
    }

    if (memberUserId === teamData.ownerId) {
        throw new Error('Cannot remove the team lead.');
    }

    // Delete subcollection doc
    const memberRef = doc(db, COLLECTIONS.teams, teamId, 'members', memberUserId);
    await deleteDoc(memberRef).catch((e) => console.warn('[REMOVE_MEMBER_DOC_WARN]', e));

    // Update team document
    await updateDoc(teamRef, {
        memberIds: arrayRemove(memberUserId),
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
    });

    // Notify the removed member
    sendNotification({
        recipientId: memberUserId,
        actorId: requesterUserId,
        actorName: teamData.ownerName || 'Team Lead',
        type: 'team_member_removed',
        title: 'Team Membership Update',
        body: `You were removed from the team "${teamData.name}".`,
        targetType: 'team',
        targetId: teamId,
        metadata: {
            teamId,
            projectId: teamData.projectId,
        },
    }).catch((err) => console.warn('[REMOVE_MEMBER_NOTIF_WARN]', err));
};

/**
 * Atomically transfers team ownership from the current owner to an eligible active member.
 *
 * Enforces:
 * - Only the current verified team owner can execute this action.
 * - The new owner must be an active team member and present in memberIds.
 * - The owner cannot transfer ownership to themselves, a non-member, or removed member.
 * - Previous owner remains an active team member with role 'member'.
 * - New owner gets role 'owner'.
 * - Team document ownerId, ownerName, and ownerAvatar are updated atomically in a Firestore transaction.
 * - Real-time listeners automatically sync the changes across all active sessions.
 */
export const transferTeamOwnership = async ({
    teamId,
    currentOwnerId,
    newOwnerId,
}: {
    teamId: string;
    currentOwnerId: string;
    newOwnerId: string;
}): Promise<{ success: boolean; newOwnerName: string }> => {
    if (!teamId || !currentOwnerId || !newOwnerId) {
        throw new Error('Invalid arguments: teamId, currentOwnerId, and newOwnerId are required.');
    }

    if (currentOwnerId === newOwnerId) {
        throw new Error('Cannot transfer ownership to yourself. Select another active squad member.');
    }

    // Demo team handling
    if (teamId === 'team_demo_phoenix') {
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem('invox_demo_phoenix_owner', newOwnerId);
            } catch {
                // ignore
            }
        }
        return { success: true, newOwnerName: 'Collaborator' };
    }

    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    const oldOwnerMemberRef = doc(db, COLLECTIONS.teams, teamId, 'members', currentOwnerId);
    const newOwnerMemberRef = doc(db, COLLECTIONS.teams, teamId, 'members', newOwnerId);

    let newOwnerDisplayName = 'Squad Member';
    let teamName = 'Team';
    let projectId = '';

    await runTransaction(db, async (transaction) => {
        const teamSnap = await transaction.get(teamRef);
        if (!teamSnap.exists()) {
            throw new Error('Team workspace does not exist.');
        }
        const teamData = teamSnap.data() as Team;

        if (teamData.ownerId !== currentOwnerId) {
            throw new Error('Unauthorized: Only the current team owner can transfer ownership.');
        }

        const memberIds = Array.isArray(teamData.memberIds) ? teamData.memberIds : [];
        if (!memberIds.includes(newOwnerId)) {
            throw new Error('The selected user is not an active collaborator in this squad.');
        }

        const newOwnerSnap = await transaction.get(newOwnerMemberRef);
        if (!newOwnerSnap.exists()) {
            throw new Error('Selected member record could not be found. They may have left the team.');
        }
        const newOwnerData = newOwnerSnap.data() as TeamMember;

        const oldOwnerSnap = await transaction.get(oldOwnerMemberRef);

        teamName = teamData.name || 'Team';
        projectId = teamData.projectId || '';
        newOwnerDisplayName = newOwnerData.displayName || newOwnerData.username || 'Collaborator';

        // 1. Demote old owner to member in subcollection
        if (oldOwnerSnap.exists()) {
            transaction.update(oldOwnerMemberRef, {
                role: 'member',
            });
        } else {
            transaction.set(oldOwnerMemberRef, {
                id: currentOwnerId,
                teamId,
                userId: currentOwnerId,
                displayName: teamData.ownerName || 'Previous Lead',
                role: 'member',
                joinedAt: serverTimestamp(),
            });
        }

        // 2. Promote new owner in subcollection
        transaction.update(newOwnerMemberRef, {
            role: 'owner',
        });

        // 3. Atomically update authoritative team owner fields
        transaction.update(teamRef, {
            ownerId: newOwnerId,
            ownerName: newOwnerDisplayName,
            ownerAvatar: newOwnerData.photoURL || null,
            updatedAt: serverTimestamp(),
        });
    });

    // 4. Send notification to the new owner
    sendNotification({
        recipientId: newOwnerId,
        actorId: currentOwnerId,
        actorName: 'Previous Squad Lead',
        type: 'team_ownership_transferred',
        title: 'Team Ownership Transferred',
        body: `You are now the team owner of "${teamName}".`,
        targetType: 'team',
        targetId: teamId,
        metadata: {
            teamId,
            projectId,
        },
    }).catch((err) => console.warn('[TRANSFER_OWNERSHIP_NOTIF_WARN]', err));

    return { success: true, newOwnerName: newOwnerDisplayName };
};

/**
 * Disbands and permanently deletes a team workspace.
 * Only the team owner can disband a team.
 */
export const deleteTeam = async (teamId: string, userId: string): Promise<void> => {
    if (!teamId || !userId) {
        throw new Error('Invalid arguments: teamId and userId are required.');
    }

    if (teamId === 'team_demo_phoenix') {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('invox_demo_phoenix_members');
        }
        return;
    }

    const teamRef = doc(db, COLLECTIONS.teams, teamId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) return;

    const teamData = teamSnap.data() as Team;
    if (teamData.ownerId !== userId) {
        throw new Error('Unauthorized: Only the team owner can disband this team.');
    }

    // Delete team doc
    await deleteDoc(teamRef);
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

    // Built-in demo invitations for realistic onboarding and chat tests
    if (token === 'demo_phoenix_invite' || token === 'demo_invite_phoenix' || token === 'demo_team_invite') {
        return {
            id: token,
            token,
            teamId: 'team_demo_phoenix',
            teamName: 'Phoenix Core',
            projectId: 'proj-phoenix',
            projectTitle: 'Phoenix Decentralized Network',
            ownerId: 'owner_phoenix',
            ownerName: 'Phoenix Lead',
            createdBy: 'owner_phoenix',
            createdAt: new Date(),
            status: 'active',
            usedCount: 0,
            usedBy: [],
        };
    }

    if (token === 'demo_expired_invite') {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return {
            id: token,
            token,
            teamId: 'team_demo_phoenix',
            teamName: 'Phoenix Core (Archived)',
            projectId: 'proj-phoenix',
            projectTitle: 'Phoenix Decentralized Network',
            ownerId: 'owner_phoenix',
            ownerName: 'Phoenix Lead',
            createdBy: 'owner_phoenix',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            expiresAt: yesterday,
            status: 'active',
            usedCount: 0,
            usedBy: [],
        };
    }

    if (token === 'demo_revoked_invite') {
        return {
            id: token,
            token,
            teamId: 'team_demo_phoenix',
            teamName: 'Phoenix Core',
            projectId: 'proj-phoenix',
            projectTitle: 'Phoenix Decentralized Network',
            ownerId: 'owner_phoenix',
            ownerName: 'Phoenix Lead',
            createdBy: 'owner_phoenix',
            createdAt: new Date(),
            status: 'revoked',
            usedCount: 0,
            usedBy: [],
        };
    }

    if (token === 'demo_limit_invite') {
        return {
            id: token,
            token,
            teamId: 'team_demo_phoenix',
            teamName: 'Phoenix Core',
            projectId: 'proj-phoenix',
            projectTitle: 'Phoenix Decentralized Network',
            ownerId: 'owner_phoenix',
            ownerName: 'Phoenix Lead',
            createdBy: 'owner_phoenix',
            createdAt: new Date(),
            status: 'active',
            maxUses: 1,
            usedCount: 1,
            usedBy: ['user_prior'],
        };
    }

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
    if (invitation.teamId === 'team_demo_phoenix') {
        let storedMembers: string[] = ['owner_phoenix'];
        if (typeof window !== 'undefined') {
            try {
                const parsed = JSON.parse(sessionStorage.getItem('invox_demo_phoenix_members') || '["owner_phoenix"]');
                if (Array.isArray(parsed)) storedMembers = parsed;
            } catch {
                // ignore
            }
        }
        const wasAlreadyMember = storedMembers.includes(user.uid);
        if (!wasAlreadyMember) {
            storedMembers.push(user.uid);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('invox_demo_phoenix_members', JSON.stringify(storedMembers));
            }
        }
        const demoTeam: Team = {
            id: 'team_demo_phoenix',
            name: 'Phoenix Core',
            description: 'Core decentralized infrastructure squad',
            projectId: 'proj-phoenix',
            projectTitle: 'Phoenix Decentralized Network',
            projectDomain: 'Cybersecurity',
            ownerId: 'owner_phoenix',
            ownerName: 'Phoenix Lead',
            ownerAvatar: 'https://picsum.photos/seed/phoenix/200',
            memberCount: storedMembers.length + 2,
            memberIds: storedMembers,
        };
        return { status: wasAlreadyMember ? 'already_member' : 'joined', team: demoTeam };
    }

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

    // Notify team owner that a member joined via invitation
    if (team.ownerId && team.ownerId !== user.uid) {
        sendNotification({
            recipientId: team.ownerId,
            actorId: user.uid,
            actorName: memberName,
            actorAvatar: memberAvatar,
            type: 'team_invite_accepted',
            title: 'Team Member Joined',
            body: `${memberName} accepted your invitation and joined team "${team.name}".`,
            targetType: 'team',
            targetId: team.id,
            metadata: {
                teamId: team.id,
                projectId: team.projectId,
                memberId: user.uid,
            },
        }).catch((err) => console.warn('[JOIN_TEAM_NOTIF_WARN]', err));
    }

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
