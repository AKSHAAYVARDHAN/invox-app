import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToCreatorCollabApplications,
    subscribeToUserCollabApplications,
} from '../../services/collabApplicationService';
import { subscribeToUserPosts } from '../../services/postService';
import {
    subscribeToUserConversations,
    calculateTotalInboxUnread,
    CollabConversation,
} from '../../services/collabMessageService';
import type { CollabApplication, Post } from '../../types';

export interface CollabDashboardData {
    loading: boolean;
    creatorApplications: CollabApplication[];
    myApplications: CollabApplication[];
    userCollabs: Post[];
    conversations: CollabConversation[];
    inboxUnreadCount: number;
    incomingCount: number;
    pendingIncomingCount: number;
    myAppsCount: number;
    pendingMyAppsCount: number;
    activeCollabsCount: number;
    publishedCount: number;
    acceptedCreatorApps: CollabApplication[];
    acceptedMyApps: CollabApplication[];
}

export function useCollabDashboardData(activeConversationId?: string | null): CollabDashboardData {
    const { currentUser } = useAuth();
    const [creatorApplications, setCreatorApplications] = useState<CollabApplication[]>([]);
    const [myApplications, setMyApplications] = useState<CollabApplication[]>([]);
    const [userCollabs, setUserCollabs] = useState<Post[]>([]);
    const [conversations, setConversations] = useState<CollabConversation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!currentUser?.uid) {
            setCreatorApplications([]);
            setMyApplications([]);
            setUserCollabs([]);
            setConversations([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubCreator = subscribeToCreatorCollabApplications(
            currentUser.uid,
            (apps) => {
                setCreatorApplications(apps);
                setLoading(false);
            },
            (err) => {
                console.error('[COLLAB_DASHBOARD_CREATOR_APPS_ERROR]', err);
                setLoading(false);
            }
        );

        const unsubMyApps = subscribeToUserCollabApplications(
            currentUser.uid,
            (apps) => {
                setMyApplications(apps);
                setLoading(false);
            },
            (err) => {
                console.error('[COLLAB_DASHBOARD_MY_APPS_ERROR]', err);
                setLoading(false);
            }
        );

        const unsubPosts = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                const collabs = posts.filter(
                    (p) => p.category === 'collab' || p.type === 'collab' || Boolean(p.collabDetails)
                );
                setUserCollabs(collabs);
                setLoading(false);
            },
            (err) => {
                console.error('[COLLAB_DASHBOARD_USER_POSTS_ERROR]', err);
                setLoading(false);
            }
        );

        const unsubConversations = subscribeToUserConversations(
            currentUser.uid,
            (convList) => {
                setConversations(convList);
                setLoading(false);
            },
            (err) => {
                console.error('[COLLAB_DASHBOARD_CONVERSATIONS_ERROR]', err);
                setLoading(false);
            }
        );

        return () => {
            unsubCreator();
            unsubMyApps();
            unsubPosts();
            unsubConversations();
        };
    }, [currentUser?.uid]);

    const incomingCount = creatorApplications.length;
    const pendingIncomingCount = creatorApplications.filter((a) => a.status === 'PENDING').length;
    const myAppsCount = myApplications.length;
    const pendingMyAppsCount = myApplications.filter((a) => a.status === 'PENDING').length;

    const acceptedCreatorApps = creatorApplications.filter((a) => a.status === 'ACCEPTED');
    const acceptedMyApps = myApplications.filter((a) => a.status === 'ACCEPTED');
    const activeCollabsCount = acceptedCreatorApps.length + acceptedMyApps.length;

    const publishedCount = userCollabs.length;

    const inboxUnreadCount = calculateTotalInboxUnread(
        conversations,
        currentUser?.uid,
        activeConversationId
    );

    return {
        loading,
        creatorApplications,
        myApplications,
        userCollabs,
        conversations,
        inboxUnreadCount,
        incomingCount,
        pendingIncomingCount,
        myAppsCount,
        pendingMyAppsCount,
        activeCollabsCount,
        publishedCount,
        acceptedCreatorApps,
        acceptedMyApps,
    };
}
