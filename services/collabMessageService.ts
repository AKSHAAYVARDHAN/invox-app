import {
    collection,
    doc,
    getDoc,
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
    getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import { sendNotification } from './notificationService';
import type { CollabApplication, InvoxUser, Post, User } from '../types';

export interface CollabConversationParticipant {
    uid: string;
    displayName: string;
    username?: string;
    photoURL?: string | null;
    headline?: string;
}

export interface CollabConversation {
    id: string;
    applicationId: string;
    collabId: string;
    roleId: string;
    roleTitle: string;
    collabTitle: string;
    collabHook?: string;
    ownerId: string;
    applicantId: string;
    participants: string[];
    applicantDetails: CollabConversationParticipant;
    ownerDetails: CollabConversationParticipant;
    lastMessage?: string;
    lastSenderId?: string;
    lastMessageTimestamp?: any;
    createdAt?: any;
    updatedAt?: any;
    unreadCount?: number;
    unreadBy?: string[];
    unreadCounts?: Record<string, number>;
    isTeam?: boolean;
    type?: 'collab_application' | 'direct' | 'team';
    environment?: 'spotlight' | 'hub';
    scope?: 'spotlight_inbox' | 'hub_comrades' | 'spotlight_teams' | 'hub_crews';
}

export interface CollabChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string | null;
    text: string;
    recipientId?: string | null;
    read?: boolean;
    readAt?: any;
    readBy?: string[];
    createdAt: any;
    environment?: 'spotlight' | 'hub';
    scope?: 'spotlight_inbox' | 'hub_comrades' | 'spotlight_teams' | 'hub_crews';
}

/**
 * Discriminator to check whether a conversation belongs to Spotlight Inbox.
 * Ensures Spotlight and Hub conversations never cross-contaminate.
 */
export const isSpotlightConversation = (c: CollabConversation | any): boolean => {
    if (!c) return false;
    // Explicit environment or scope check
    if (c.environment === 'spotlight' || c.scope === 'spotlight_inbox') return true;
    if (c.environment === 'hub' || c.scope === 'hub_comrades') return false;
    // Identifier check
    if (typeof c.id === 'string') {
        if (c.id.startsWith('hub_comrade_') || c.id.startsWith('direct_')) return false;
        if (c.id.startsWith('collab_app_') || c.id.startsWith('spotlight_')) return true;
    }
    // Metadata check
    if (c.type === 'collab_application') return true;
    if (c.applicationId || c.collabId) return true;
    if (c.type === 'direct' || c.roleTitle === 'Comrade') return false;
    return true; // Default legacy non-comrade to Spotlight
};

/**
 * Discriminator to check whether a conversation belongs to Hub Comrades (1:1 direct).
 * Ensures Hub Comrades conversations are strictly separated from Spotlight.
 */
export const isHubComradeConversation = (c: CollabConversation | any): boolean => {
    if (!c) return false;
    // Explicit environment or scope check
    if (c.environment === 'hub' || c.scope === 'hub_comrades') return true;
    if (c.environment === 'spotlight' || c.scope === 'spotlight_inbox') return false;
    // Identifier check
    if (typeof c.id === 'string') {
        if (c.id.startsWith('hub_comrade_') || c.id.startsWith('direct_')) return true;
        if (c.id.startsWith('collab_app_') || c.id.startsWith('spotlight_')) return false;
    }
    // Metadata check
    if (c.type === 'direct' || c.roleTitle === 'Comrade') {
        return !c.applicationId && !c.collabId;
    }
    return false;
};

/**
 * Gets an existing conversation for an application or creates one deterministically.
 * This guarantees no duplicate conversations exist for the same application.
 */
export const getOrCreateCollabConversation = async ({
    application,
    targetCollab,
    currentUser,
    userProfile,
}: {
    application: CollabApplication;
    targetCollab?: Post | null;
    currentUser: User;
    userProfile?: InvoxUser | null;
}): Promise<string> => {
    if (!currentUser?.uid) {
        throw new Error('User authentication required to message applicant');
    }

    const conversationId = `collab_app_${application.id}`;
    const convRef = doc(db, COLLECTIONS.messages, conversationId);

    const snapshot = await getDoc(convRef);
    if (snapshot.exists()) {
        return conversationId;
    }

    // Determine owner and applicant IDs
    const ownerId = application.ownerId || application.creatorId || targetCollab?.authorId || currentUser.uid;
    const applicantId = application.applicantId || application.applicant?.uid || '';

    if (!applicantId) {
        throw new Error('Applicant ID could not be identified');
    }

    // Ensure unique participants array
    const participants = Array.from(new Set([ownerId, applicantId]));

    const applicantDetails: CollabConversationParticipant = {
        uid: applicantId,
        displayName: application.applicant?.displayName || 'Applicant',
        username: application.applicant?.username || '',
        photoURL: application.applicant?.photoURL || null,
        headline: application.applicant?.headline || '',
    };

    const ownerDetails: CollabConversationParticipant = {
        uid: ownerId,
        displayName: userProfile?.displayName || currentUser.displayName || targetCollab?.author?.name || 'Project Owner',
        username: userProfile?.username || currentUser.email?.split('@')[0] || 'owner',
        photoURL: userProfile?.photoURL || currentUser.photoURL || targetCollab?.author?.avatarUrl || null,
    };

    const collabTitle = targetCollab?.aiSummary || targetCollab?.oneLine || application.collabTitle || 'Untitled Collab';
    const collabHook = targetCollab?.aiSummary || targetCollab?.oneLine || application.collabTitle || 'Untitled Collab';

    const newConversation: Omit<CollabConversation, 'id'> = {
        applicationId: application.id,
        collabId: application.collabId,
        roleId: application.roleId,
        roleTitle: application.roleTitle || 'Collaborator',
        collabTitle,
        collabHook,
        ownerId,
        applicantId,
        participants,
        applicantDetails,
        ownerDetails,
        lastMessage: '',
        lastSenderId: '',
        unreadCount: 0,
        unreadBy: [],
        unreadCounts: {
            [ownerId]: 0,
            [applicantId]: 0,
        },
        isTeam: false,
        type: 'collab_application',
        environment: 'spotlight',
        scope: 'spotlight_inbox',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(convRef, sanitizeForFirestore(newConversation));
    return conversationId;
};

/**
 * Gets or creates a deterministic direct 1-on-1 conversation between two users (comrades).
 * Uses ID format `hub_comrade_${min(uid1, uid2)}_${max(uid1, uid2)}`.
 * Preserves backward compatibility with any existing `direct_` records.
 */
export const getOrCreateDirectConversation = async ({
    currentUser,
    userProfile,
    targetUser,
}: {
    currentUser: User;
    userProfile?: InvoxUser | null;
    targetUser: {
        uid: string;
        displayName?: string;
        username?: string;
        photoURL?: string | null;
        headline?: string;
    };
}): Promise<string> => {
    if (!currentUser?.uid || !targetUser?.uid) {
        throw new Error('Both users must be valid to start a conversation');
    }
    if (currentUser.uid === targetUser.uid) {
        throw new Error('Cannot start a direct conversation with yourself');
    }

    const sortedIds = [currentUser.uid, targetUser.uid].sort();
    const primaryId = `hub_comrade_${sortedIds[0]}_${sortedIds[1]}`;
    const legacyId = `direct_${sortedIds[0]}_${sortedIds[1]}`;

    // 1. Check if new hub_comrade_ doc exists
    const primaryRef = doc(db, COLLECTIONS.messages, primaryId);
    const primarySnap = await getDoc(primaryRef);
    if (primarySnap.exists()) {
        return primaryId;
    }

    // 2. Backward compatibility: check if legacy direct_ doc exists
    const legacyRef = doc(db, COLLECTIONS.messages, legacyId);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
        // Tag legacy doc with hub environment
        await setDoc(legacyRef, { environment: 'hub', scope: 'hub_comrades' }, { merge: true }).catch(() => {});
        return legacyId;
    }

    const currentParticipant: CollabConversationParticipant = {
        uid: currentUser.uid,
        displayName: userProfile?.displayName || currentUser.displayName || 'Comrade',
        username: userProfile?.username || currentUser.email?.split('@')[0] || 'user',
        photoURL: userProfile?.photoURL || currentUser.photoURL || null,
        headline: userProfile?.headline || '',
    };

    const targetParticipant: CollabConversationParticipant = {
        uid: targetUser.uid,
        displayName: targetUser.displayName || 'Comrade',
        username: targetUser.username || '',
        photoURL: targetUser.photoURL || null,
        headline: targetUser.headline || '',
    };

    const newConversation: Omit<CollabConversation, 'id'> = {
        applicationId: '',
        collabId: '',
        roleId: '',
        roleTitle: 'Comrade',
        collabTitle: targetParticipant.displayName,
        collabHook: targetParticipant.username ? `@${targetParticipant.username}` : '',
        ownerId: currentUser.uid,
        applicantId: targetUser.uid,
        participants: [currentUser.uid, targetUser.uid],
        applicantDetails: targetParticipant,
        ownerDetails: currentParticipant,
        lastMessage: '',
        lastSenderId: '',
        unreadCount: 0,
        unreadBy: [],
        unreadCounts: {
            [currentUser.uid]: 0,
            [targetUser.uid]: 0,
        },
        isTeam: false,
        type: 'direct',
        environment: 'hub',
        scope: 'hub_comrades',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(primaryRef, sanitizeForFirestore(newConversation));
    return primaryId;
};

/**
 * Subscribes to Spotlight Inbox conversations only (project collaboration applications & direct messages).
 * Guarantees that Hub Comrade conversations are completely excluded.
 */
export const subscribeToSpotlightInboxConversations = (
    userId: string,
    onUpdate: (conversations: CollabConversation[]) => void,
    onError?: (error: any) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.messages),
        where('participants', 'array-contains', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: CollabConversation[] = [];
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const conv: CollabConversation = {
                    id: docSnap.id,
                    ...data,
                } as CollabConversation;

                if (isSpotlightConversation(conv)) {
                    list.push(conv);
                }
            });

            // Sort by most recent activity
            list.sort((a, b) => {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime() || 0;
                };
                const timeA = getTime(a.updatedAt || a.lastMessageTimestamp || a.createdAt);
                const timeB = getTime(b.updatedAt || b.lastMessageTimestamp || b.createdAt);
                return timeB - timeA;
            });

            onUpdate(list);
        },
        (err) => {
            console.error('[SUBSCRIBE_SPOTLIGHT_INBOX_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Subscribes to Hub Comrade conversations only (private 1:1 comrade converse).
 * Guarantees that Spotlight Inbox applications and collaboration chats are completely excluded.
 */
export const subscribeToHubComradeConversations = (
    userId: string,
    onUpdate: (conversations: CollabConversation[]) => void,
    onError?: (error: any) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.messages),
        where('participants', 'array-contains', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: CollabConversation[] = [];
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const conv: CollabConversation = {
                    id: docSnap.id,
                    ...data,
                } as CollabConversation;

                if (isHubComradeConversation(conv)) {
                    list.push(conv);
                }
            });

            // Sort by most recent activity
            list.sort((a, b) => {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime() || 0;
                };
                const timeA = getTime(a.updatedAt || a.lastMessageTimestamp || a.createdAt);
                const timeB = getTime(b.updatedAt || b.lastMessageTimestamp || b.createdAt);
                return timeB - timeA;
            });

            onUpdate(list);
        },
        (err) => {
            console.error('[SUBSCRIBE_HUB_COMRADE_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Subscribes to all conversations where the user is a participant.
 * Kept for generic/backward compatibility.
 */
export const subscribeToUserConversations = (
    userId: string,
    onUpdate: (conversations: CollabConversation[]) => void,
    onError?: (error: any) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.messages),
        where('participants', 'array-contains', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const list: CollabConversation[] = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                } as CollabConversation;
            });

            // Sort by most recent update
            list.sort((a, b) => {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (typeof val.toDate === 'function') return val.toDate().getTime();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime() || 0;
                };
                const timeA = getTime(a.updatedAt || a.lastMessageTimestamp || a.createdAt);
                const timeB = getTime(b.updatedAt || b.lastMessageTimestamp || b.createdAt);
                return timeB - timeA;
            });

            onUpdate(list);
        },
        (err) => {
            console.error('[SUBSCRIBE_CONVERSATIONS_ERROR]', err);
            if (onError) onError(err);
        }
    );
};

/**
 * Subscribes to real-time messages within a conversation chronologically.
 */
export const subscribeToConversationMessages = (
    conversationId: string,
    onUpdate: (messages: CollabChatMessage[]) => void,
    onError?: (error: any) => void
) => {
    const msgsRef = collection(db, COLLECTIONS.messages, conversationId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const msgs: CollabChatMessage[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                conversationId,
                ...(docSnap.data() as any),
            }));
            onUpdate(msgs);
        },
        (err) => {
            console.warn('[SUBSCRIBE_MESSAGES_FALLBACK_ATTEMPT]', err);
            // Fallback in case orderBy index is not yet built
            const fallbackUnsub = onSnapshot(
                msgsRef,
                (fallbackSnap) => {
                    const msgs: CollabChatMessage[] = fallbackSnap.docs.map((docSnap) => ({
                        id: docSnap.id,
                        conversationId,
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
                    console.error('[SUBSCRIBE_MESSAGES_ERROR]', fallbackErr);
                    if (onError) onError(fallbackErr);
                }
            );
            return fallbackUnsub;
        }
    );
};

/**
 * Sends a message in a conversation and updates the conversation header stats and unread counts.
 */
export const sendCollabMessage = async ({
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    text,
    recipientId,
}: {
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string | null;
    text: string;
    recipientId?: string;
}): Promise<void> => {
    const cleanText = text.trim();
    if (!cleanText) return;

    const convRef = doc(db, COLLECTIONS.messages, conversationId);
    let participants: string[] = [];
    let convData: any = null;
    try {
        const cSnap = await getDoc(convRef);
        if (cSnap.exists()) {
            convData = cSnap.data();
            participants = Array.isArray(convData.participants) ? [...convData.participants] : [];
        }
    } catch (e) {
        console.warn('[GET_CONVERSATION_DOC_ERROR]', e);
    }

    // Determine target recipient(s)
    let targetRecipientId = recipientId;
    if (!targetRecipientId || targetRecipientId === senderId) {
        if (convData) {
            const otherP =
                (convData.participants || []).find((p: string) => p && p !== senderId)
                || (convData.ownerId && convData.ownerId !== senderId ? convData.ownerId : null)
                || (convData.applicantId && convData.applicantId !== senderId ? convData.applicantId : null)
                || (convData.applicantDetails?.uid && convData.applicantDetails.uid !== senderId ? convData.applicantDetails.uid : null)
                || (convData.ownerDetails?.uid && convData.ownerDetails.uid !== senderId ? convData.ownerDetails.uid : null);
            targetRecipientId = otherP || null;
        } else {
            targetRecipientId = (participants || []).find(p => p && p !== senderId) || null;
        }
    }

    if (targetRecipientId && !participants.includes(targetRecipientId)) {
        participants.push(targetRecipientId);
    }
    if (!participants.includes(senderId)) {
        participants.push(senderId);
    }

    const recipientsToNotify = targetRecipientId
        ? [targetRecipientId]
        : participants.filter(p => p !== senderId);

    // Determine environment and scope
    const isHub = convData?.environment === 'hub'
        || convData?.scope === 'hub_comrades'
        || conversationId.startsWith('hub_comrade_')
        || conversationId.startsWith('direct_')
        || (convData?.type === 'direct' && !convData?.applicationId && !convData?.collabId);
    const environment: 'hub' | 'spotlight' = isHub ? 'hub' : 'spotlight';
    const scope: 'hub_comrades' | 'spotlight_inbox' = isHub ? 'hub_comrades' : 'spotlight_inbox';

    // 1. Add individual message with environment and scope
    const msgsRef = collection(db, COLLECTIONS.messages, conversationId, 'messages');
    await addDoc(msgsRef, sanitizeForFirestore({
        conversationId,
        senderId,
        senderName,
        senderAvatar: senderAvatar || null,
        text: cleanText,
        recipientId: targetRecipientId || (recipientsToNotify[0] || null),
        read: false,
        readBy: [senderId],
        environment,
        scope,
        createdAt: serverTimestamp(),
    }));

    // 2. Update parent conversation summary, unread counts, and environment/scope
    try {
        const updatePayload: Record<string, any> = {
            lastMessage: cleanText,
            lastSenderId: senderId,
            lastMessageTimestamp: serverTimestamp(),
            updatedAt: serverTimestamp(),
            participants: Array.from(new Set(participants)),
            environment,
            scope,
            [`unreadCounts.${senderId}`]: 0,
        };

        if (recipientsToNotify.length > 0) {
            for (const rId of recipientsToNotify) {
                updatePayload[`unreadCounts.${rId}`] = increment(1);
            }
            updatePayload.unreadBy = arrayUnion(...recipientsToNotify);
            updatePayload.unreadCount = increment(1);
        }

        await updateDoc(convRef, updatePayload);
    } catch (updateErr) {
        // Fallback with setDoc merge if map field does not exist yet
        try {
            const fallbackPayload: Record<string, any> = {
                lastMessage: cleanText,
                lastSenderId: senderId,
                lastMessageTimestamp: serverTimestamp(),
                updatedAt: serverTimestamp(),
                participants: Array.from(new Set(participants)),
                environment,
                scope,
            };
            const unreadCounts: Record<string, number> = {
                ...(convData?.unreadCounts || {}),
                [senderId]: 0,
            };
            if (recipientsToNotify.length > 0) {
                for (const rId of recipientsToNotify) {
                    unreadCounts[rId] = (unreadCounts[rId] || 0) + 1;
                }
                fallbackPayload.unreadCounts = unreadCounts;
                fallbackPayload.unreadBy = Array.from(new Set([...(convData?.unreadBy || []), ...recipientsToNotify]));
                fallbackPayload.unreadCount = (convData?.unreadCount || 0) + 1;
            }
            await setDoc(convRef, fallbackPayload, { merge: true });
        } catch (setErr) {
            console.error('[CONVERSATION_UPDATE_ERROR]', setErr);
        }
    }

    // Notification for recipients
    for (const rId of recipientsToNotify) {
        try {
            await sendNotification({
                recipientId: rId,
                actorId: senderId,
                actorName: senderName,
                actorAvatar: senderAvatar || null,
                type: 'message_direct',
                title: 'New Message',
                body: `${senderName}: ${cleanText.slice(0, 100)}`,
                targetType: 'message',
                targetId: conversationId,
                metadata: {
                    conversationId,
                },
            });
        } catch (e) {
            console.warn('[MESSAGE_NOTIF_ERROR]', e);
        }
    }
};

/**
 * Marks a conversation as read for a specific user.
 * Resets the user's unread counter, removes them from unreadBy, and marks messages as read.
 */
export const markConversationAsRead = async (
    conversationId: string,
    userId: string
): Promise<void> => {
    if (!conversationId || !userId) return;
    const convRef = doc(db, COLLECTIONS.messages, conversationId);

    try {
        await updateDoc(convRef, {
            [`unreadCounts.${userId}`]: 0,
            unreadBy: arrayRemove(userId),
        });
    } catch {
        try {
            await setDoc(convRef, {
                unreadCounts: {
                    [userId]: 0,
                },
                unreadBy: arrayRemove(userId),
            }, { merge: true });
        } catch (e) {
            console.warn('[MARK_AS_READ_ERROR]', e);
        }
    }

    // Mark individual messages in this conversation as read
    try {
        const msgsRef = collection(db, COLLECTIONS.messages, conversationId, 'messages');
        const msgsSnap = await getDocs(msgsRef);
        for (const msgDoc of msgsSnap.docs) {
            const data = msgDoc.data();
            if (data.senderId !== userId && (data.read === false || !data.readBy?.includes(userId))) {
                updateDoc(msgDoc.ref, {
                    read: true,
                    readAt: serverTimestamp(),
                    readBy: arrayUnion(userId),
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.warn('[MARK_MESSAGES_READ_ERROR]', e);
    }

    // Also mark any unread notifications for this conversation as read
    try {
        const notifsQuery = query(
            collection(db, COLLECTIONS.notifications),
            where('recipientId', '==', userId),
            where('conversationId', '==', conversationId),
            where('read', '==', false)
        );
        const notifsSnap = await getDocs(notifsQuery);
        for (const notifDoc of notifsSnap.docs) {
            updateDoc(notifDoc.ref, { read: true }).catch(() => {});
        }
    } catch {
        // notification update is non-blocking
    }
};

/**
 * Returns the unread message count in a conversation for the specified user.
 */
export const getConversationUnreadCount = (
    convo: CollabConversation,
    userId?: string | null
): number => {
    if (!userId || !convo) return 0;

    // 1. Check user-specific unreadCounts map
    if (convo.unreadCounts && typeof convo.unreadCounts[userId] === 'number') {
        return Math.max(0, convo.unreadCounts[userId]);
    }

    // 2. If the user was the last sender and has no explicit unread count, they have 0 unread
    if (convo.lastSenderId === userId) {
        return 0;
    }

    // 3. Fallback: check unreadBy array
    if (Array.isArray(convo.unreadBy) && convo.unreadBy.includes(userId)) {
        return convo.unreadCount && convo.unreadCount > 0 ? convo.unreadCount : 1;
    }

    // 4. Fallback: if last sender is someone else and unreadCount > 0
    if (convo.lastSenderId && convo.lastSenderId !== userId && (convo.unreadCount || 0) > 0) {
        return convo.unreadCount || 1;
    }

    return 0;
};

/**
 * Calculates the total unread message count across all inbox conversations for a user.
 * Optionally excludes an active conversation (e.g. one currently open on screen).
 */
export const calculateTotalInboxUnread = (
    conversations: CollabConversation[],
    userId?: string | null,
    activeConversationId?: string | null
): number => {
    if (!userId || !conversations || conversations.length === 0) return 0;

    let total = 0;
    for (const c of conversations) {
        // Exclude team conversations and exclude Hub comrades
        if (c.isTeam || c.type === 'team') continue;
        if (!isSpotlightConversation(c)) continue;

        // If the user is currently viewing this conversation, exclude it
        if (activeConversationId && c.id === activeConversationId) continue;

        total += getConversationUnreadCount(c, userId);
    }

    return total;
};

/**
 * Calculates the total unread message count across all Hub Comrades conversations for a user.
 */
export const calculateTotalComradesUnread = (
    conversations: CollabConversation[],
    userId?: string | null,
    activeConversationId?: string | null
): number => {
    if (!userId || !conversations || conversations.length === 0) return 0;

    let total = 0;
    for (const c of conversations) {
        if (!isHubComradeConversation(c)) continue;
        if (activeConversationId && c.id === activeConversationId) continue;
        total += getConversationUnreadCount(c, userId);
    }

    return total;
};

/**
 * Calculates the total unread message count across all team conversations for a user.
 * Optionally excludes an active conversation (e.g. one currently open on screen).
 */
export const calculateTotalTeamsUnread = (
    conversations: CollabConversation[],
    userId?: string | null,
    activeConversationId?: string | null
): number => {
    if (!userId || !conversations || conversations.length === 0) return 0;

    let total = 0;
    for (const c of conversations) {
        // Only include team conversations
        if (!c.isTeam && c.type !== 'team') continue;

        // If the user is currently viewing this conversation, exclude it
        if (activeConversationId && c.id === activeConversationId) continue;

        total += getConversationUnreadCount(c, userId);
    }

    return total;
};

export interface UserUnreadCountsResult {
    totalInboxUnread: number;
    totalTeamsUnread: number;
    convUnreadMap: Record<string, number>;
}

/**
 * Real-time subscription to unread message counts across all conversations for a user.
 * Directly listens to individual messages in the user's active conversations,
 * guaranteeing instant, reactive updates without page reloads or stale document caches.
 * When environment is specified ('spotlight' | 'hub'), restricts listeners strictly to that environment.
 */
export const subscribeToUserUnreadMessages = (
    userId: string,
    onUpdate: (data: UserUnreadCountsResult) => void,
    activeConversationId?: string | null,
    environment?: 'spotlight' | 'hub'
): (() => void) => {
    if (!userId) {
        onUpdate({ totalInboxUnread: 0, totalTeamsUnread: 0, convUnreadMap: {} });
        return () => {};
    }

    const messageListeners = new Map<string, () => void>();
    const convUnreadMap: Record<string, number> = {};
    const convTypeMap: Record<string, boolean> = {};

    const recalculateAndNotify = () => {
        let totalInbox = 0;
        let totalTeams = 0;

        for (const [cId, count] of Object.entries(convUnreadMap)) {
            if (activeConversationId && cId === activeConversationId) {
                continue; // User is actively viewing this conversation
            }
            if (convTypeMap[cId]) {
                totalTeams += count;
            } else {
                totalInbox += count;
            }
        }

        onUpdate({
            totalInboxUnread: totalInbox,
            totalTeamsUnread: totalTeams,
            convUnreadMap: { ...convUnreadMap },
        });
    };

    const convsQuery = query(
        collection(db, COLLECTIONS.messages),
        where('participants', 'array-contains', userId)
    );

    const unsubConvs = onSnapshot(
        convsQuery,
        (convsSnap) => {
            const currentConvIds = new Set<string>();

            convsSnap.docs.forEach((docSnap) => {
                const convId = docSnap.id;
                const data = docSnap.data();
                const convObj: CollabConversation = { id: convId, ...data } as CollabConversation;

                // Environment filtering:
                if (environment === 'spotlight' && !isSpotlightConversation(convObj)) {
                    return;
                }
                if (environment === 'hub' && !isHubComradeConversation(convObj)) {
                    return;
                }

                currentConvIds.add(convId);
                convTypeMap[convId] = Boolean(data.isTeam || data.type === 'team');

                if (!messageListeners.has(convId)) {
                    const msgsRef = collection(db, COLLECTIONS.messages, convId, 'messages');
                    const unsubMsgs = onSnapshot(
                        msgsRef,
                        (msgsSnap) => {
                            let unreadInThisConv = 0;
                            msgsSnap.docs.forEach((msgDoc) => {
                                const m = msgDoc.data();
                                // Only count incoming messages (never messages sent by current user)
                                if (m.senderId !== userId) {
                                    const isRead = m.read === true || (Array.isArray(m.readBy) && m.readBy.includes(userId));
                                    if (!isRead) {
                                        unreadInThisConv += 1;
                                    }
                                }
                            });

                            convUnreadMap[convId] = unreadInThisConv;
                            recalculateAndNotify();
                        },
                        (msgErr) => {
                            console.warn(`[UNREAD_MSGS_LISTENER_WARN] ${convId}:`, msgErr);
                        }
                    );

                    messageListeners.set(convId, unsubMsgs);
                }
            });

            // Clean up removed conversations
            for (const [convId, unsub] of messageListeners.entries()) {
                if (!currentConvIds.has(convId)) {
                    unsub();
                    messageListeners.delete(convId);
                    delete convUnreadMap[convId];
                    delete convTypeMap[convId];
                }
            }

            recalculateAndNotify();
        },
        (convErr) => {
            console.error('[UNREAD_CONVS_SUBSCRIPTION_ERROR]', convErr);
        }
    );

    return () => {
        unsubConvs();
        for (const unsub of messageListeners.values()) {
            unsub();
        }
        messageListeners.clear();
    };
};
