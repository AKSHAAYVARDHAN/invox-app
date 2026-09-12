import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToCreatorCollabApplications,
    subscribeToUserCollabApplications,
} from '../../services/collabApplicationService';
import { subscribeToUserPosts } from '../../services/postService';
import type { CollabApplication, Post } from '../../types';

export interface CollabDashboardData {
    loading: boolean;
    creatorApplications: CollabApplication[];
    myApplications: CollabApplication[];
    userCollabs: Post[];
    incomingCount: number;
    pendingIncomingCount: number;
    myAppsCount: number;
    pendingMyAppsCount: number;
    activeCollabsCount: number;
    publishedCount: number;
    acceptedCreatorApps: CollabApplication[];
    acceptedMyApps: CollabApplication[];
}

export function useCollabDashboardData(): CollabDashboardData {
    const { currentUser } = useAuth();
    const [creatorApplications, setCreatorApplications] = useState<CollabApplication[]>([]);
    const [myApplications, setMyApplications] = useState<CollabApplication[]>([]);
    const [userCollabs, setUserCollabs] = useState<Post[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!currentUser?.uid) {
            setCreatorApplications([]);
            setMyApplications([]);
            setUserCollabs([]);
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

        return () => {
            unsubCreator();
            unsubMyApps();
            unsubPosts();
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

    return {
        loading,
        creatorApplications,
        myApplications,
        userCollabs,
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
