import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
    subscribeToUnreadNotificationCount,
    subscribeToUserNotifications,
    fetchNotificationsHistory,
    markNotificationAsRead as apiMarkAsRead,
    markAllNotificationsAsRead as apiMarkAllAsRead,
    deleteNotification as apiDeleteNotification,
    clearReadNotifications as apiClearReadNotifications,
} from '../services/notificationService';
import type { InvoxNotification } from '../types';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface NotificationContextType {
    unreadCount: number;
    notifications: InvoxNotification[];
    loading: boolean;
    error: string | null;
    filter: 'all' | 'unread';
    setFilter: (filter: 'all' | 'unread') => void;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
    clearAllRead: () => Promise<void>;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
    hasMore: boolean;
    loadingMore: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const userId = currentUser?.uid;

    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<InvoxNotification[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // 1. Real-time subscription to unread count for sidebar / header
    useEffect(() => {
        if (!userId) {
            setUnreadCount(0);
            return;
        }

        const unsubscribe = subscribeToUnreadNotificationCount(
            userId,
            (count) => {
                setUnreadCount(count);
            },
            (err) => {
                console.warn('[NOTIF_CONTEXT_COUNT_ERROR]', err);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [userId]);

    // 2. Real-time subscription to notification items
    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribe = subscribeToUserNotifications(
            userId,
            { filter, limitCount: 40 },
            (items) => {
                setNotifications(items);
                setLoading(false);
                setError(null);
                setHasMore(items.length >= 40);
            },
            (err) => {
                console.error('[NOTIF_CONTEXT_SUB_ERROR]', err);
                setError('Failed to load real-time notifications. Click retry to reconnect.');
                setLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [userId, filter]);

    // Mark single notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        if (!notificationId) return;

        // Optimistic UI update
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === notificationId
                    ? { ...n, read: true, readAt: new Date() }
                    : n
            )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            await apiMarkAsRead(notificationId);
        } catch (err) {
            console.error('[NOTIF_MARK_READ_FAILED]', err);
        }
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        if (!userId) return;

        // Optimistic UI update
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
        );
        setUnreadCount(0);

        try {
            await apiMarkAllAsRead(userId);
        } catch (err) {
            console.error('[NOTIF_MARK_ALL_FAILED]', err);
        }
    }, [userId]);

    // Delete single notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        if (!notificationId) return;

        const target = notifications.find((n) => n.id === notificationId);
        if (target && !target.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        // Optimistic removal
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

        try {
            await apiDeleteNotification(notificationId);
        } catch (err) {
            console.error('[NOTIF_DELETE_FAILED]', err);
        }
    }, [notifications]);

    // Clear all read notifications
    const clearAllRead = useCallback(async () => {
        if (!userId) return;

        setNotifications((prev) => prev.filter((n) => !n.read));

        try {
            await apiClearReadNotifications(userId);
        } catch (err) {
            console.error('[NOTIF_CLEAR_READ_FAILED]', err);
        }
    }, [userId]);

    // Manual refresh
    const refresh = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchNotificationsHistory(userId, filter, 30, null);
            setNotifications(res.notifications);
            setLastDoc(res.lastDoc);
            setHasMore(res.hasMore);
        } catch (err: any) {
            setError(err?.message || 'Failed to refresh notifications');
        } finally {
            setLoading(false);
        }
    }, [userId, filter]);

    // Load more history
    const loadMore = useCallback(async () => {
        if (!userId || loadingMore || !hasMore) return;
        setLoadingMore(true);

        try {
            const res = await fetchNotificationsHistory(userId, filter, 20, lastDoc);
            if (res.notifications.length > 0) {
                setNotifications((prev) => {
                    const existingIds = new Set(prev.map((n) => n.id));
                    const newItems = res.notifications.filter((n) => !existingIds.has(n.id));
                    return [...prev, ...newItems];
                });
                setLastDoc(res.lastDoc);
                setHasMore(res.hasMore);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('[LOAD_MORE_NOTIFS_ERROR]', err);
        } finally {
            setLoadingMore(false);
        }
    }, [userId, filter, hasMore, lastDoc, loadingMore]);

    const value = useMemo<NotificationContextType>(() => ({
        unreadCount,
        notifications,
        loading,
        error,
        filter,
        setFilter,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllRead,
        refresh,
        loadMore,
        hasMore,
        loadingMore,
    }), [
        unreadCount,
        notifications,
        loading,
        error,
        filter,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllRead,
        refresh,
        loadMore,
        hasMore,
        loadingMore,
    ]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
