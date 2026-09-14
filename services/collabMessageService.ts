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
 * Sends a message in a conversation and updates the conversation header stats.
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

    // Update parent conversation summary
    const convRef = doc(db, COLLECTIONS.messages, conversationId);
    await updateDoc(convRef, sanitizeForFirestore({
        lastMessage: cleanText,
        lastSenderId: senderId,
        lastMessageTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }));

    // Optional notification for recipient
    if (recipientId && recipientId !== senderId) {
        try {
            await addDoc(collection(db, COLLECTIONS.notifications), sanitizeForFirestore({
                recipientId,
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
