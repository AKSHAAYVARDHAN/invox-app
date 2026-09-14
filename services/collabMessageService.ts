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
}

export interface CollabChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string | null;
    text: string;
    createdAt: any;
}

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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(convRef, sanitizeForFirestore(newConversation));
    return conversationId;
};

/**
 * Subscribes to all conversations where the user is a participant.
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

    const msgsRef = collection(db, COLLECTIONS.messages, conversationId, 'messages');
    await addDoc(msgsRef, sanitizeForFirestore({
        conversationId,
        senderId,
        senderName,
        senderAvatar: senderAvatar || null,
        text: cleanText,
        createdAt: serverTimestamp(),
    }));

    // Resolve recipientId if missing
    let targetRecipientId = recipientId;
    const convRef = doc(db, COLLECTIONS.messages, conversationId);
    if (!targetRecipientId) {
        try {
            const cSnap = await getDoc(convRef);
            if (cSnap.exists()) {
                const cData = cSnap.data();
                const parts: string[] = cData.participants || [];
                targetRecipientId = parts.find(p => p !== senderId);
            }
        } catch {
            // fallback
        }
    }

    // Update parent conversation summary and unread counts
    try {
        const updatePayload: Record<string, any> = {
            lastMessage: cleanText,
            lastSenderId: senderId,
            lastMessageTimestamp: serverTimestamp(),
            updatedAt: serverTimestamp(),
            [`unreadCounts.${senderId}`]: 0,
        };

        if (targetRecipientId) {
            updatePayload[`unreadCounts.${targetRecipientId}`] = increment(1);
            updatePayload.unreadBy = arrayUnion(targetRecipientId);
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
            };
            if (targetRecipientId) {
                fallbackPayload.unreadCounts = {
                    [targetRecipientId]: 1,
                    [senderId]: 0,
                };
                fallbackPayload.unreadBy = [targetRecipientId];
                fallbackPayload.unreadCount = 1;
            }
            await setDoc(convRef, fallbackPayload, { merge: true });
        } catch (setErr) {
            console.error('[CONVERSATION_UPDATE_ERROR]', setErr);
        }
    }

    // Optional notification for recipient
    if (targetRecipientId && targetRecipientId !== senderId) {
        try {
            await addDoc(collection(db, COLLECTIONS.notifications), sanitizeForFirestore({
                recipientId: targetRecipientId,
                senderId,
                type: 'collab_message',
                title: 'New Message',
                message: `${senderName}: ${cleanText.slice(0, 100)}`,
                conversationId,
                read: false,
                createdAt: serverTimestamp(),
            }));
        } catch (e) {
            console.warn('[MESSAGE_NOTIF_ERROR]', e);
        }
    }
};

/**
 * Marks a conversation as read for a specific user.
 * Resets the user's unread counter and removes them from unreadBy.
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

    // 2. Fallback: check unreadBy array
    if (Array.isArray(convo.unreadBy) && convo.unreadBy.includes(userId)) {
        return convo.unreadCount && convo.unreadCount > 0 ? convo.unreadCount : 1;
    }

    // 3. Fallback: if last sender is someone else and unreadCount > 0
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
        // Exclude team conversations from inbox count
        if (c.isTeam || c.type === 'team') continue;

        // If the user is currently viewing this conversation, exclude it
        if (activeConversationId && c.id === activeConversationId) continue;

        total += getConversationUnreadCount(c, userId);
    }

    return total;
};
