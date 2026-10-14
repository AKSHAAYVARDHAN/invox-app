import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
    orderBy,
    limit,
    deleteDoc,
    writeBatch,
    setDoc,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import type { InvoxNotification, NotificationType } from '../types';

export interface CreateNotificationInput {
    id?: string;
    recipientId: string;
    actorId?: string;
    actorName?: string;
    actorAvatar?: string | null;
    actorUsername?: string;
    type: NotificationType | string;
    title: string;
    body: string;
    targetType?: 'message' | 'team' | 'collab' | 'profile' | 'application' | 'post' | 'url';
    targetId?: string;
    metadata?: Record<string, any>;
}

export interface SubscribeNotificationsOptions {
    filter?: 'all' | 'unread';
    limitCount?: number;
}

/**
 * Normalizes a Firestore notification document into an InvoxNotification model.
 */
export const normalizeNotification = (id: string, data: any): InvoxNotification => {
    return {
        id,
        recipientId: data.recipientId || '',
        actorId: data.actorId || data.senderId || undefined,
        senderId: data.senderId || data.actorId || undefined,
        actorName: data.actorName || data.senderName || undefined,
        actorAvatar: data.actorAvatar || data.senderAvatar || null,
        actorUsername: data.actorUsername || undefined,
        type: data.type || 'system',
        title: data.title || 'Notification',
        body: data.body || data.message || '',
        message: data.message || data.body || '',
        read: Boolean(data.read),
        readAt: data.readAt || null,
        createdAt: data.createdAt || new Date(),
        targetType: data.targetType || (data.conversationId ? 'message' : data.collabId ? 'collab' : undefined),
        targetId: data.targetId || data.conversationId || data.collabId || undefined,
        metadata: data.metadata || {
            conversationId: data.conversationId,
            teamId: data.teamId,
            applicationId: data.applicationId,
            collabId: data.collabId,
            roleId: data.roleId,
        },
    };
};

/**
 * Creates and persists a new notification document.
 * Enforces security invariants:
 * - Prevents users from notifying themselves (recipientId === actorId)
 * - Uses server timestamps
 * - Uses optional stable IDs to prevent duplicate notification events
 */
export const sendNotification = async (input: CreateNotificationInput): Promise<string | null> => {
    const {
        id,
        recipientId,
        actorId,
        actorName,
        actorAvatar,
        actorUsername,
        type,
        title,
        body,
        targetType,
        targetId,
        metadata,
    } = input;

    if (!recipientId) {
        console.warn('[NOTIF_SEND_WARN] Missing recipientId');
        return null;
    }

    // Never notify the user about actions they performed themselves
    if (actorId && actorId === recipientId) {
        return null;
    }

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
        return null;
    }

    const notificationId = id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const notifRef = doc(db, COLLECTIONS.notifications, notificationId);

    const notificationData = sanitizeForFirestore({
        recipientId,
        actorId: actorId || null,
        senderId: actorId || null,
        actorName: actorName || null,
        actorAvatar: actorAvatar || null,
        actorUsername: actorUsername || null,
        type,
        title: cleanTitle,
        body: cleanBody,
        message: cleanBody,
        read: false,
        readAt: null,
        targetType: targetType || null,
        targetId: targetId || null,
        metadata: metadata || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    try {
        await setDoc(notifRef, notificationData, { merge: true });
        return notificationId;
    } catch (err) {
        console.error('[NOTIF_SEND_ERROR] Failed to write notification:', err);
        return null;
    }
};

/**
 * Real-time subscription to unread notification count for the authenticated user.
 */
export const subscribeToUnreadNotificationCount = (
    userId: string,
    onCountChange: (count: number) => void,
    onError?: (err: any) => void
): (() => void) => {
    if (!userId) {
        onCountChange(0);
        return () => {};
    }

    const q = query(
        collection(db, COLLECTIONS.notifications),
        where('recipientId', '==', userId),
        where('read', '==', false)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            onCountChange(snapshot.docs.length);
        },
        (err) => {
            console.warn('[NOTIF_UNREAD_COUNT_WARN]', err);
            onError?.(err);
        }
    );
};

/**
 * Real-time subscription to user notifications with filtering and limit support.
 */
export const subscribeToUserNotifications = (
    userId: string,
    options: SubscribeNotificationsOptions = {},
    onUpdate: (notifications: InvoxNotification[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    if (!userId) {
        onUpdate([]);
        return () => {};
    }

    const limitCount = options.limitCount || 50;
    const filter = options.filter || 'all';

    let q;
    if (filter === 'unread') {
        q = query(
            collection(db, COLLECTIONS.notifications),
            where('recipientId', '==', userId),
            where('read', '==', false),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
    } else {
        q = query(
            collection(db, COLLECTIONS.notifications),
            where('recipientId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
    }

    return onSnapshot(
        q,
        (snapshot) => {
            const list: InvoxNotification[] = snapshot.docs.map((d) =>
                normalizeNotification(d.id, d.data())
            );
            onUpdate(list);
        },
        (err) => {
            console.warn('[SUBSCRIBE_NOTIFICATIONS_FALLBACK]', err);
            // Fallback in case composite index is not yet built
            const fallbackQuery = query(
                collection(db, COLLECTIONS.notifications),
                where('recipientId', '==', userId),
                limit(limitCount)
            );

            return onSnapshot(
                fallbackQuery,
                (fbSnap) => {
                    let list: InvoxNotification[] = fbSnap.docs.map((d) =>
                        normalizeNotification(d.id, d.data())
                    );
                    if (filter === 'unread') {
                        list = list.filter((n) => !n.read);
                    }
                    list.sort((a, b) => {
                        const getT = (val: any) => {
                            if (!val) return 0;
                            if (typeof val.toDate === 'function') return val.toDate().getTime();
                            if (val instanceof Date) return val.getTime();
                            return new Date(val).getTime() || 0;
                        };
                        return getT(b.createdAt) - getT(a.createdAt);
                    });
                    onUpdate(list);
                },
                (fbErr) => {
                    console.error('[NOTIFICATIONS_SUBSCRIPTION_ERROR]', fbErr);
                    onError?.(fbErr);
                }
            );
        }
    );
};

/**
 * Fetches a paginated slice of notifications.
 */
export const fetchNotificationsHistory = async (
    userId: string,
    filter: 'all' | 'unread' = 'all',
    pageSize = 20,
    lastDocSnapshot?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{
    notifications: InvoxNotification[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
}> => {
    if (!userId) {
        return { notifications: [], lastDoc: null, hasMore: false };
    }

    const constraints: any[] = [
        where('recipientId', '==', userId),
    ];

    if (filter === 'unread') {
        constraints.push(where('read', '==', false));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    if (lastDocSnapshot) {
        constraints.push(startAfter(lastDocSnapshot));
    }

    constraints.push(limit(pageSize + 1));

    try {
        const q = query(collection(db, COLLECTIONS.notifications), ...constraints);
        const snap = await getDocs(q);

        const hasMore = snap.docs.length > pageSize;
        const validDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
        const notifications = validDocs.map((d) => normalizeNotification(d.id, d.data()));
        const lastDoc = validDocs.length > 0 ? validDocs[validDocs.length - 1] : null;

        return { notifications, lastDoc, hasMore };
    } catch (e) {
        console.warn('[FETCH_NOTIFICATIONS_HISTORY_FALLBACK]', e);
        // Fallback simple query
        const simpleQ = query(
            collection(db, COLLECTIONS.notifications),
            where('recipientId', '==', userId),
            limit(pageSize)
        );
        const fallbackSnap = await getDocs(simpleQ);
        let notifications = fallbackSnap.docs.map((d) => normalizeNotification(d.id, d.data()));
        if (filter === 'unread') {
            notifications = notifications.filter((n) => !n.read);
        }
        notifications.sort((a, b) => {
            const getT = (val: any) => {
                if (!val) return 0;
                if (typeof val.toDate === 'function') return val.toDate().getTime();
                if (val instanceof Date) return val.getTime();
                return new Date(val).getTime() || 0;
            };
            return getT(b.createdAt) - getT(a.createdAt);
        });

        return {
            notifications,
            lastDoc: null,
            hasMore: false,
        };
    }
};

/**
 * Marks a single notification as read in persistent Firestore storage.
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    if (!notificationId) return;
    try {
        const notifRef = doc(db, COLLECTIONS.notifications, notificationId);
        await updateDoc(notifRef, {
            read: true,
            readAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    } catch (err) {
        console.error('[MARK_NOTIF_READ_ERROR]', err);
        throw err;
    }
};

/**
 * Marks all unread notifications for a user as read.
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<number> => {
    if (!userId) return 0;

    try {
        const q = query(
            collection(db, COLLECTIONS.notifications),
            where('recipientId', '==', userId),
            where('read', '==', false)
        );
        const snap = await getDocs(q);
        if (snap.empty) return 0;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
            batch.update(d.ref, {
                read: true,
                readAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });

        await batch.commit();
        return snap.docs.length;
    } catch (err) {
        console.error('[MARK_ALL_NOTIFS_READ_ERROR]', err);
        throw err;
    }
};

/**
 * Deletes a notification from Firestore.
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
    if (!notificationId) return;
    try {
        const notifRef = doc(db, COLLECTIONS.notifications, notificationId);
        await deleteDoc(notifRef);
    } catch (err) {
        console.error('[DELETE_NOTIF_ERROR]', err);
        throw err;
    }
};

/**
 * Deletes all read notifications for a user.
 */
export const clearReadNotifications = async (userId: string): Promise<number> => {
    if (!userId) return 0;

    try {
        const q = query(
            collection(db, COLLECTIONS.notifications),
            where('recipientId', '==', userId),
            where('read', '==', true)
        );
        const snap = await getDocs(q);
        if (snap.empty) return 0;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
            batch.delete(d.ref);
        });

        await batch.commit();
        return snap.docs.length;
    } catch (err) {
        console.error('[CLEAR_READ_NOTIFS_ERROR]', err);
        throw err;
    }
};
