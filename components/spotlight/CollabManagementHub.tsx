import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToCreatorCollabApplications,
    subscribeToUserCollabApplications,
    acceptCollabApplication,
    declineCollabApplication,
    withdrawCollabApplication,
    getRoleCapacity,
} from '../../services/collabApplicationService';
import { getOrCreateCollabConversation } from '../../services/collabMessageService';
import { subscribeToUserPosts, deletePost, getPostById } from '../../services/postService';
import type { CollabApplication, CollabRole, Post } from '../../types';
import {
    CheckIcon,
    CloseIcon,
    PencilSquareIcon,
    TrashIcon,
    PlusIcon,
    ProfileIcon,
    BriefcaseIcon,
    EllipsisVerticalIcon,
    MagnifyingGlassIcon,
    CheckBadgeIcon,
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { MyApplicationCard } from '../collab/MyApplicationCard';
import { IncomingApplicationCard } from '../collab/IncomingApplicationCard';
import { ActiveCollabCard } from '../collab/ActiveCollabCard';

interface CollabManagementHubProps {
    initialTab?: 'applications' | 'my_applications' | 'active' | 'published';
    viewMode?: 'spotlight' | 'myspace' | 'all';
    onClose?: () => void;
    onTabChange?: (tab: 'applications' | 'my_applications' | 'active' | 'published') => void;
    isModal?: boolean;
    userCollabs?: Post[];
    onEditCollab?: (collab: Post) => void;
    onDeleteCollab?: (collabId: string) => void;
    onCreateCollab?: () => void;
    deletingId?: string | null;
}

export const CollabManagementHub: React.FC<CollabManagementHubProps> = ({
    initialTab = 'applications',
    viewMode = 'all',
    onClose,
    onTabChange,
    isModal = false,
    userCollabs: propUserCollabs,
    onEditCollab,
    onDeleteCollab,
    onCreateCollab,
    deletingId: propDeletingId,
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    const effectiveInitialTab = useMemo<'applications' | 'my_applications' | 'active' | 'published'>(() => {
        if (viewMode === 'spotlight') {
            if (initialTab === 'my_applications') return 'my_applications';
            if (initialTab === 'active') return 'active';
            return 'applications';
        }
        if (viewMode === 'myspace') {
            return (initialTab === 'my_applications') ? 'my_applications' : 'published';
        }
        return initialTab;
    }, [viewMode, initialTab]);

    const [subTab, setSubTab] = useState<'applications' | 'my_applications' | 'active' | 'published'>(effectiveInitialTab);

    useEffect(() => {
        setSubTab(effectiveInitialTab);
    }, [effectiveInitialTab]);
    const [internalUserCollabs, setInternalUserCollabs] = useState<Post[]>([]);
    const [creatorApplications, setCreatorApplications] = useState<CollabApplication[]>([]);
    const [myApplications, setMyApplications] = useState<CollabApplication[]>([]);
    const [loadingCreatorApps, setLoadingCreatorApps] = useState(true);
    const [loadingMyApps, setLoadingMyApps] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [myAppsSearchQuery, setMyAppsSearchQuery] = useState('');
    const [myAppsProjectFilter, setMyAppsProjectFilter] = useState<string>('all');
    const [myAppsStatusFilter, setMyAppsStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');
    const [activeTabSearchQuery, setActiveTabSearchQuery] = useState('');
    const [activeTabRoleFilter, setActiveTabRoleFilter] = useState<'ALL' | 'MY_COLLABORATIONS' | 'MY_OFFERINGS'>('ALL');
    const [activeTabProjectFilter, setActiveTabProjectFilter] = useState<string>('all');
    const [activeMenuCollabId, setActiveMenuCollabId] = useState<string | null>(null);
    const [expandedCollabIds, setExpandedCollabIds] = useState<Set<string>>(new Set());
    const [filterCollabId, setFilterCollabId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');
    const [internalDeletingId, setInternalDeletingId] = useState<string | null>(null);
    const [deleteConfirmCollab, setDeleteConfirmCollab] = useState<{ id: string; title: string } | null>(null);
    const [resolvedCollabsMap, setResolvedCollabsMap] = useState<Record<string, Post>>({});
    const [overviewModalData, setOverviewModalData] = useState<{
        isOpen: boolean;
        collab: Post | null;
        application: CollabApplication | null;
        isLoading: boolean;
    }>({
        isOpen: false,
        collab: null,
        application: null,
        isLoading: false,
    });

    // Synchronize subTab with initialTab
    useEffect(() => {
        setSubTab(effectiveInitialTab);
    }, [effectiveInitialTab]);

    // 1. Data Subscriptions & Loading
    useEffect(() => {
        if (propUserCollabs) return;
        if (!currentUser?.uid) return;
        const unsub = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                const collabs = posts.filter(
                    (p) => p.category === 'collab' || p.type === 'collab' || Boolean(p.collabDetails)
                );
                setInternalUserCollabs(collabs);
            },
            (err) => console.error('[USER_COLLABS_SUB_ERROR]', err)
        );
        return () => unsub();
    }, [currentUser?.uid, propUserCollabs]);

    const userCollabs = propUserCollabs || internalUserCollabs;

    // Subscribe to applications on user's collabs (Creator Side)
    useEffect(() => {
        if (!currentUser?.uid) {
            setLoadingCreatorApps(false);
            return;
        }

        const unsubscribe = subscribeToCreatorCollabApplications(
            currentUser.uid,
            (apps) => {
                setCreatorApplications(apps);
                setLoadingCreatorApps(false);
            },
            (err) => {
                console.error('[CREATOR_APPS_SUB_ERROR]', err);
                setLoadingCreatorApps(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Subscribe to applications submitted by user (Applicant Side)
    useEffect(() => {
        if (!currentUser?.uid) {
            setLoadingMyApps(false);
            return;
        }

        const unsubscribe = subscribeToUserCollabApplications(
            currentUser.uid,
            (apps) => {
                setMyApplications(apps);
                setLoadingMyApps(false);
            },
            (err) => {
                console.error('[USER_APPS_SUB_ERROR]', err);
                setLoadingMyApps(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Resolve Canonical Collab posts for applications (both applicant & creator sides)
    useEffect(() => {
        const allApplications = [...myApplications, ...creatorApplications];
        if (allApplications.length === 0) return;

        const neededCollabIds = Array.from(
            new Set(allApplications.map(a => a.collabId).filter(Boolean))
        ).filter(id => !resolvedCollabsMap[id]);

        if (neededCollabIds.length === 0) return;

        let isMounted = true;
        const fetchTargetCollabs = async () => {
            const newlyFetched: Record<string, Post> = {};
            await Promise.all(
                neededCollabIds.map(async (id) => {
                    const fromPropCollabs = userCollabs.find(c => c.id === id);
                    if (fromPropCollabs) {
                        newlyFetched[id] = fromPropCollabs;
                        return;
                    }
                    try {
                        const post = await getPostById(id);
                        if (post) {
                            newlyFetched[id] = post;
                        }
                    } catch (e) {
                        console.warn(`[RESOLVE_TARGET_COLLAB_ERROR] ${id}:`, e);
                    }
                })
            );
            if (isMounted && Object.keys(newlyFetched).length > 0) {
                setResolvedCollabsMap(prev => ({ ...prev, ...newlyFetched }));
            }
        };

        fetchTargetCollabs();

        return () => {
            isMounted = false;
        };
    }, [myApplications, creatorApplications, userCollabs, resolvedCollabsMap]);

    // 2. Unique list of creator's published Collabs (merging userCollabs and any collabs referenced in creatorApplications)
    const creatorPublishedCollabs = useMemo(() => {
        const map = new Map<string, Post>();
        userCollabs.forEach(collab => {
            if (collab.id) map.set(collab.id, collab);
        });
        creatorApplications.forEach(app => {
            if (app.collabId && !map.has(app.collabId)) {
                map.set(app.collabId, {
                    id: app.collabId,
                    aiSummary: app.collabTitle || 'Collab Project',
                    oneLine: app.collabOverview || app.collabTitle || 'Collab Project',
                    content: app.collabOverview || '',
                    domain: app.collabDomain || 'Collab',
                    category: 'collab',
                    type: 'Collab' as any,
                    author: {
                        name: app.collabCreatorName || currentUser?.displayName || 'Creator',
                        avatarUrl: app.collabCreatorAvatar || currentUser?.photoURL || '',
                    },
                    stats: { likes: 0, views: 0, comments: 0 },
                    createdAt: new Date(),
                } as Post);
            }
        });
        return Array.from(map.values());
    }, [userCollabs, creatorApplications, currentUser]);

    // 3. Counts & Active Collaborations
    const pendingCreatorAppsCount = useMemo(() => {
        return creatorApplications.filter(a => a.status === 'PENDING').length;
    }, [creatorApplications]);

    const pendingMyAppsCount = useMemo(() => {
        return myApplications.filter(a => a.status === 'PENDING').length;
    }, [myApplications]);

    const activeCollaborations = useMemo(() => {
        // Combinations: user accepted as applicant + applicants accepted on user's collabs (deduplicated by ID)
        const seenApplicantIds = new Set<string>();
        const asApplicant: CollabApplication[] = [];
        myApplications.forEach(a => {
            const status = (a.status || '').toUpperCase();
            if (status === 'ACCEPTED' && a.id && !seenApplicantIds.has(a.id)) {
                seenApplicantIds.add(a.id);
                asApplicant.push(a);
            }
        });

        const seenCreatorIds = new Set<string>();
        const asCreator: CollabApplication[] = [];
        creatorApplications.forEach(a => {
            const status = (a.status || '').toUpperCase();
            if (status === 'ACCEPTED' && a.id && !seenCreatorIds.has(a.id)) {
                seenCreatorIds.add(a.id);
                asCreator.push(a);
            }
        });

        return { asApplicant, asCreator, total: asApplicant.length + asCreator.length };
    }, [myApplications, creatorApplications]);

    // 4. Filtered and Searched Active Collaborations
    const activeSearchAndRoleFiltered = useMemo(() => {
        type UnifiedActiveItem = {
            application: CollabApplication;
            variant: 'my_collaborations' | 'my_offerings';
            targetCollab: Post | null;
            otherAccepted: CollabApplication[];
        };

        const list: UnifiedActiveItem[] = [];
        const seenAppIds = new Set<string>();

        // Add user accepted as applicant (MY_COLLABORATIONS)
        if (activeTabRoleFilter === 'ALL' || activeTabRoleFilter === 'MY_COLLABORATIONS') {
            activeCollaborations.asApplicant.forEach(app => {
                if (seenAppIds.has(app.id)) return;
                seenAppIds.add(app.id);

                const targetCollab = resolvedCollabsMap[app.collabId] || userCollabs.find(c => c.id === app.collabId) || null;
                // Peers in this collab
                const otherAccepted = activeCollaborations.asApplicant.filter(other => other.collabId === app.collabId);
                list.push({
                    application: app,
                    variant: 'my_collaborations',
                    targetCollab,
                    otherAccepted,
                });
            });
        }

        // Add applicants accepted on user's collabs (MY_OFFERINGS)
        if (activeTabRoleFilter === 'ALL' || activeTabRoleFilter === 'MY_OFFERINGS') {
            activeCollaborations.asCreator.forEach(app => {
                if (seenAppIds.has(app.id)) return;
                seenAppIds.add(app.id);

                const targetCollab = resolvedCollabsMap[app.collabId] || creatorPublishedCollabs.find(c => c.id === app.collabId) || userCollabs.find(c => c.id === app.collabId) || null;
                // Other accepted applicants on this same collab post
                const otherAccepted = activeCollaborations.asCreator.filter(other => other.collabId === app.collabId);
                list.push({
                    application: app,
                    variant: 'my_offerings',
                    targetCollab,
                    otherAccepted,
                });
            });
        }

        const q = activeTabSearchQuery.toLowerCase().trim();
        if (!q) return list;

        return list.filter(({ application: app, targetCollab, variant }) => {
            const hook = (targetCollab?.aiSummary || targetCollab?.oneLine || app.collabTitle || '').toLowerCase();
            const overview = (targetCollab?.content || targetCollab?.description || app.collabOverview || '').toLowerCase();
            const domain = (targetCollab?.domain || targetCollab?.category || app.collabDomain || '').toLowerCase();
            const role = (app.roleTitle || '').toLowerCase();
            const creatorName = (targetCollab?.author?.name || app.collabCreatorName || (variant === 'my_offerings' ? currentUser?.displayName || '' : '')).toLowerCase();
            const creatorUsername = (targetCollab?.author?.username || '').toLowerCase();
            const collaboratorName = (app.applicant?.displayName || '').toLowerCase();
            const collaboratorUser = (app.applicant?.username || '').toLowerCase();
            const skills = Array.isArray(app.applicant?.skills) ? app.applicant.skills.join(' ').toLowerCase() : '';
            const message = (app.message || app.userNote || '').toLowerCase();
            const location = (targetCollab?.collabDetails?.location || '').toLowerCase();

            return (
                hook.includes(q) ||
                overview.includes(q) ||
                domain.includes(q) ||
                role.includes(q) ||
                creatorName.includes(q) ||
                creatorUsername.includes(q) ||
                collaboratorName.includes(q) ||
                collaboratorUser.includes(q) ||
                skills.includes(q) ||
                message.includes(q) ||
                location.includes(q)
            );
        });
    }, [
        activeCollaborations,
        activeTabRoleFilter,
        activeTabSearchQuery,
        resolvedCollabsMap,
        creatorPublishedCollabs,
        userCollabs,
        currentUser,
    ]);

    // Dynamic unique projects with ongoing collaborations under current role & search filters
    const activeProjects = useMemo(() => {
        const map = new Map<string, { id: string; title: string; count: number }>();
        activeSearchAndRoleFiltered.forEach(({ application: app, targetCollab }) => {
            const collabId = app.collabId || targetCollab?.id;
            if (!collabId) return;

            const existing = map.get(collabId);
            if (existing) {
                existing.count += 1;
            } else {
                const resolvedCollab = targetCollab || resolvedCollabsMap[collabId] || creatorPublishedCollabs.find(c => c.id === collabId) || userCollabs.find(c => c.id === collabId);
                const title = resolvedCollab?.aiSummary || resolvedCollab?.oneLine || app.collabTitle || 'Collab Project';
                map.set(collabId, {
                    id: collabId,
                    title,
                    count: 1,
                });
            }
        });
        return Array.from(map.values());
    }, [activeSearchAndRoleFiltered, resolvedCollabsMap, creatorPublishedCollabs, userCollabs]);

    // Effective Project Filter & Auto-Reset
    const effectiveActiveProjectFilter = activeProjects.some(p => p.id === activeTabProjectFilter)
        ? activeTabProjectFilter
        : 'all';

    useEffect(() => {
        if (activeTabProjectFilter !== 'all' && !activeProjects.some(p => p.id === activeTabProjectFilter)) {
            setActiveTabProjectFilter('all');
        }
    }, [activeProjects, activeTabProjectFilter]);

    // Final filtered active collaborations (applying Project filter)
    const filteredActiveCollaborations = useMemo(() => {
        if (effectiveActiveProjectFilter === 'all') {
            return activeSearchAndRoleFiltered;
        }
        return activeSearchAndRoleFiltered.filter(({ application: app, targetCollab }) => {
            const collabId = app.collabId || targetCollab?.id;
            return collabId === effectiveActiveProjectFilter;
        });
    }, [activeSearchAndRoleFiltered, effectiveActiveProjectFilter]);

    // 5. Formatters
    const formatDate = (date: any) => {
        if (!date) return 'RECENT';
        try {
            const d = date?.toDate ? date.toDate() : new Date(date);
            return isNaN(d.getTime()) ? 'RECENT' : d.toLocaleDateString('en-GB');
        } catch {
            return 'RECENT';
        }
    };

    const formatCollabDetails = (collab: Partial<Post>) => {
        const types = (collab.collabDetails?.collabTypes && collab.collabDetails.collabTypes.length > 0)
            ? collab.collabDetails.collabTypes.join(' · ').toUpperCase()
            : 'OPEN COLLABORATION';
        const avail = collab.collabDetails?.availability?.toUpperCase() || 'FLEXIBLE';
        const loc = (collab.collabDetails?.location || 'REMOTE').toUpperCase();
        return `${types} · ${avail} · ${loc}`;
    };

    // 6. Filtered incoming applications for creator with search, project, and status support
    // Step 1-3: Start with incoming applications for published collabs, apply search filtering, apply selected STATUS filter
    const incomingSearchAndStatusFiltered = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return creatorApplications.filter(app => {
            if (statusFilter !== 'ALL') {
                const currentStatus = (app.status || '').toUpperCase();
                if (currentStatus !== statusFilter) return false;
            }
            if (q) {
                const targetCollab = resolvedCollabsMap[app.collabId] || creatorPublishedCollabs.find(c => c.id === app.collabId) || userCollabs.find(c => c.id === app.collabId);
                const titleMatch = (app.collabTitle || targetCollab?.aiSummary || targetCollab?.oneLine || '').toLowerCase().includes(q);
                const roleMatch = (app.roleTitle || '').toLowerCase().includes(q);
                const applicantName = (app.applicant?.displayName || '').toLowerCase().includes(q);
                const applicantUser = (app.applicant?.username || '').toLowerCase().includes(q);
                const domainMatch = (targetCollab?.domain || targetCollab?.category || app.collabDomain || '').toLowerCase().includes(q);
                const messageMatch = (app.message || '').toLowerCase().includes(q);
                return titleMatch || roleMatch || applicantName || applicantUser || domainMatch || messageMatch;
            }
            return true;
        });
    }, [creatorApplications, searchQuery, statusFilter, resolvedCollabsMap, creatorPublishedCollabs, userCollabs]);

    // Step 4: Build the PROJECT dropdown options dynamically from this status-and-search filtered dataset
    const incomingProjects = useMemo(() => {
        const map = new Map<string, { id: string; title: string; count: number }>();
        incomingSearchAndStatusFiltered.forEach(app => {
            if (!app.collabId) return;
            const existing = map.get(app.collabId);
            if (existing) {
                existing.count += 1;
            } else {
                const targetCollab = resolvedCollabsMap[app.collabId] || creatorPublishedCollabs.find(c => c.id === app.collabId) || userCollabs.find(c => c.id === app.collabId);
                const title = targetCollab?.aiSummary || targetCollab?.oneLine || app.collabTitle || 'Collab Project';
                map.set(app.collabId, {
                    id: app.collabId,
                    title,
                    count: 1,
                });
            }
        });
        return Array.from(map.values());
    }, [incomingSearchAndStatusFiltered, resolvedCollabsMap, creatorPublishedCollabs, userCollabs]);

    // Auto-reset project filter if selected project is no longer present under current filter
    const effectiveIncomingProjectFilter = incomingProjects.some(p => p.id === filterCollabId)
        ? filterCollabId
        : 'all';

    useEffect(() => {
        if (filterCollabId !== 'all' && !incomingProjects.some(p => p.id === filterCollabId)) {
            setFilterCollabId('all');
        }
    }, [incomingProjects, filterCollabId]);

    // Step 5: Apply the selected PROJECT filter to produce the final displayed incoming applications
    const filteredCreatorApps = useMemo(() => {
        if (effectiveIncomingProjectFilter === 'all') {
            return incomingSearchAndStatusFiltered;
        }
        return incomingSearchAndStatusFiltered.filter(app => app.collabId === effectiveIncomingProjectFilter);
    }, [incomingSearchAndStatusFiltered, effectiveIncomingProjectFilter]);

    // 6b. Filtered applications submitted by user (Applicant Side) with search, project, and status support
    // Step 1-3: Start with user's applications, apply search filtering, apply selected STATUS filter
    const myAppsSearchAndStatusFiltered = useMemo(() => {
        const q = myAppsSearchQuery.toLowerCase().trim();
        return myApplications.filter(app => {
            if (myAppsStatusFilter !== 'ALL') {
                const currentStatus = (app.status || '').toUpperCase();
                if (currentStatus !== myAppsStatusFilter) {
                    return false;
                }
            }
            if (q) {
                const targetCollab = resolvedCollabsMap[app.collabId] || userCollabs.find(c => c.id === app.collabId);
                const hookTitle = (targetCollab?.aiSummary || targetCollab?.oneLine || app.collabTitle || '').toLowerCase();
                const overview = (targetCollab?.content || targetCollab?.description || app.collabOverview || '').toLowerCase();
                const creatorName = (targetCollab?.author?.name || app.collabCreatorName || '').toLowerCase();
                const creatorUsername = (targetCollab?.author?.username || '').toLowerCase();
                const appliedRole = (app.roleTitle || '').toLowerCase();
                const domain = (targetCollab?.domain || targetCollab?.category || app.collabDomain || '').toLowerCase();
                const note = (app.userNote || app.message || '').toLowerCase();

                return (
                    hookTitle.includes(q) ||
                    overview.includes(q) ||
                    creatorName.includes(q) ||
                    creatorUsername.includes(q) ||
                    appliedRole.includes(q) ||
                    domain.includes(q) ||
                    note.includes(q)
                );
            }
            return true;
        });
    }, [myApplications, myAppsSearchQuery, myAppsStatusFilter, resolvedCollabsMap, userCollabs]);

    // Step 4: Build the PROJECT dropdown options dynamically from this status-filtered result
    const myAppsProjects = useMemo(() => {
        const map = new Map<string, { id: string; title: string; count: number }>();
        myAppsSearchAndStatusFiltered.forEach(app => {
            if (!app.collabId) return;
            const existing = map.get(app.collabId);
            if (existing) {
                existing.count += 1;
            } else {
                const targetCollab = resolvedCollabsMap[app.collabId] || userCollabs.find(c => c.id === app.collabId);
                const title = targetCollab?.aiSummary || targetCollab?.oneLine || app.collabTitle || 'Collab Project';
                map.set(app.collabId, {
                    id: app.collabId,
                    title,
                    count: 1,
                });
            }
        });
        return Array.from(map.values());
    }, [myAppsSearchAndStatusFiltered, resolvedCollabsMap, userCollabs]);

    // Auto-reset project filter if selected project is no longer present in filtered projects
    const effectiveProjectFilter = myAppsProjects.some(p => p.id === myAppsProjectFilter)
        ? myAppsProjectFilter
        : 'all';

    useEffect(() => {
        if (myAppsProjectFilter !== 'all' && !myAppsProjects.some(p => p.id === myAppsProjectFilter)) {
            setMyAppsProjectFilter('all');
        }
    }, [myAppsProjects, myAppsProjectFilter]);

    // Step 5: Apply the selected PROJECT filter to produce the final displayed applications
    const filteredMyApps = useMemo(() => {
        if (effectiveProjectFilter === 'all') {
            return myAppsSearchAndStatusFiltered;
        }
        return myAppsSearchAndStatusFiltered.filter(app => app.collabId === effectiveProjectFilter);
    }, [myAppsSearchAndStatusFiltered, effectiveProjectFilter]);

    // 7. Actions & Handlers
    const effectiveDeletingId = propDeletingId || internalDeletingId;

    const handleDelete = async (postId: string) => {
        if (onDeleteCollab) {
            onDeleteCollab(postId);
            setDeleteConfirmCollab(null);
            return;
        }
        try {
            setInternalDeletingId(postId);
            await deletePost(postId);
            setActionSuccess('Collab signal deleted successfully.');
            setTimeout(() => setActionSuccess(null), 3000);
        } catch (err: any) {
            setActionError(err.message || 'Failed to delete collab.');
            setTimeout(() => setActionError(null), 3000);
        } finally {
            setInternalDeletingId(null);
            setDeleteConfirmCollab(null);
        }
    };

    const handleEditCollab = (item: Post) => {
        if (onEditCollab) {
            onEditCollab(item);
        } else {
            if (onClose) onClose();
            navigate(`/myspace/uploads?tab=Spotlight&subTab=Collabs&editPostId=${item.id}`);
        }
    };

    const handleViewCollab = (collabId: string) => {
        if (onClose) onClose();
        navigate(`/spotlight?tab=Collabs&collabId=${collabId}`);
    };

    const handleOpenCollabOverview = async (app: CollabApplication, resolvedCollab?: Post | null) => {
        if (resolvedCollab) {
            setOverviewModalData({
                isOpen: true,
                collab: resolvedCollab,
                application: app,
                isLoading: false,
            });
            return;
        }

        // Search in resolvedCollabsMap, creatorPublishedCollabs, or userCollabs
        const existing = resolvedCollabsMap[app.collabId] ||
            creatorPublishedCollabs.find(c => c.id === app.collabId) ||
            userCollabs.find(c => c.id === app.collabId);

        if (existing) {
            setOverviewModalData({
                isOpen: true,
                collab: existing,
                application: app,
                isLoading: false,
            });
            return;
        }

        // Fetch dynamically from Firestore
        setOverviewModalData({
            isOpen: true,
            collab: null,
            application: app,
            isLoading: true,
        });

        try {
            const fetched = await getPostById(app.collabId);
            setOverviewModalData({
                isOpen: true,
                collab: fetched,
                application: app,
                isLoading: false,
            });
        } catch (err) {
            console.warn('[COLLAB_OVERVIEW_FETCH_ERROR]', err);
            setOverviewModalData(prev => ({
                ...prev,
                isLoading: false,
            }));
        }
    };

    const handleCloseCollabOverview = () => {
        setOverviewModalData({
            isOpen: false,
            collab: null,
            application: null,
            isLoading: false,
        });
    };

    // Keyboard dismissal with Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (overviewModalData.isOpen) {
                    handleCloseCollabOverview();
                } else if (deleteConfirmCollab) {
                    setDeleteConfirmCollab(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [overviewModalData.isOpen, deleteConfirmCollab]);

    const toggleCollabDetails = (id: string) => {
        setExpandedCollabIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Handle Accept Application
    const handleAccept = async (app: CollabApplication) => {
        setActionError(null);
        setActionSuccess(null);
        setActionLoadingId(app.id);

        try {
            // Find total positions required for this role from the collab post
            const targetCollab = userCollabs.find(c => c.id === app.collabId);
            const rawRoles = targetCollab?.collabDetails?.roles || [];
            const role = rawRoles.find(r => r.id === app.roleId);
            const totalCount = Math.max(1, Number(role?.count) || 1);

            await acceptCollabApplication({
                application: app,
                maxPositions: totalCount,
            });

            setActionSuccess(`Application for "${app.roleTitle}" accepted successfully.`);
            setTimeout(() => setActionSuccess(null), 4000);
        } catch (err: any) {
            console.error('[ACCEPT_APPLICATION_ERROR]', err);
            setActionError(err.message || 'Failed to accept application.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Handle Decline Application
    const handleDecline = async (app: CollabApplication) => {
        setActionError(null);
        setActionSuccess(null);
        setActionLoadingId(app.id);

        try {
            await declineCollabApplication(app);
            setActionSuccess(`Application for "${app.roleTitle}" declined. Record preserved in history.`);
            setTimeout(() => setActionSuccess(null), 4000);
        } catch (err: any) {
            console.error('[DECLINE_APPLICATION_ERROR]', err);
            setActionError(err.message || 'Failed to decline application.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Handle Withdraw Application
    const handleWithdraw = async (app: CollabApplication) => {
        if (!currentUser) return;
        setActionError(null);
        setActionSuccess(null);
        setActionLoadingId(app.id);

        try {
            await withdrawCollabApplication(app.id, currentUser.uid);
            setActionSuccess(`Application for "${app.roleTitle}" withdrawn.`);
            setTimeout(() => setActionSuccess(null), 4000);
        } catch (err: any) {
            console.error('[WITHDRAW_APPLICATION_ERROR]', err);
            setActionError(err.message || 'Failed to withdraw application.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Handle Message Applicant (Opens/creates conversation and navigates to MESSAGE BOARD → INBOX)
    const handleMessageApplicant = async (app: CollabApplication, collab?: Post | null) => {
        if (!currentUser?.uid) return;
        setActionError(null);
        setActionLoadingId(app.id);

        try {
            const convId = await getOrCreateCollabConversation({
                application: app,
                targetCollab: collab,
                currentUser,
                userProfile,
            });

            // Navigate cleanly to MESSAGE BOARD → INBOX with the active conversation selected
            navigate(`?tab=Collabs&collabView=inbox&conversationId=${convId}`);
        } catch (err: any) {
            console.error('[MESSAGE_APPLICANT_ERROR]', err);
            setActionError(err.message || 'Failed to open conversation with applicant.');
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="space-y-4 font-mono text-zinc-300">
            {/* Action Feedback Banners */}
            {actionError && (
                <div className="p-3 bg-red-950/40 border border-red-800/80 text-red-300 text-xs flex items-center justify-between">
                    <span><span className="font-bold">// ERROR:</span> {actionError}</span>
                    <button onClick={() => setActionError(null)} className="text-zinc-500 hover:text-white">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
            {actionSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                        <span><span className="font-bold">// STATUS UPDATE:</span> {actionSuccess}</span>
                    </div>
                    <button onClick={() => setActionSuccess(null)} className="text-zinc-500 hover:text-white">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* My Space Header (when inside My Space workspace) */}
            {viewMode === 'myspace' && !isModal && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// MY COLLABS</span>
                        <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">COLLAB WORKSPACE</h2>
                    </div>
                    {onCreateCollab && (
                        <button
                            type="button"
                            onClick={onCreateCollab}
                            className="px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>// CREATE COLLAB</span>
                        </button>
                    )}
                </div>
            )}

            {/* Sub-Tabs Navigation (Hidden in Spotlight view because Right Sidebar is the only navigation mechanism) */}
            {viewMode !== 'spotlight' && (
                <div className="border border-zinc-800 bg-[#0c0c0e] p-1 flex flex-wrap items-center justify-between gap-1">
                    <div className="flex flex-wrap gap-1">
                        {/* Spotlight View Mode shows INCOMING and ACTIVE */}
                        {(viewMode === 'spotlight' || viewMode === 'all') && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSubTab('applications');
                                        onTabChange?.('applications');
                                    }}
                                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                                        subTab === 'applications'
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <span>// INCOMING COLLABS</span>
                                    {pendingCreatorAppsCount > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-bold ${
                                            subTab === 'applications' ? 'bg-black text-amber-400' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                        }`}>
                                            {pendingCreatorAppsCount}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSubTab('active');
                                        onTabChange?.('active');
                                    }}
                                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                                        subTab === 'active'
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <span>// ACTIVE COLLABS</span>
                                    {activeCollaborations.total > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-bold ${
                                            subTab === 'active' ? 'bg-black text-emerald-400' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                        }`}>
                                            {activeCollaborations.total}
                                        </span>
                                    )}
                                </button>
                            </>
                        )}

                        {/* My Space View Mode shows PUBLISHED and MY APPLICATIONS */}
                        {(viewMode === 'myspace' || viewMode === 'all') && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setSubTab('published')}
                                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                                        subTab === 'published'
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <span>// PUBLISHED COLLABS</span>
                                    <span className="text-[10px] text-zinc-500">({userCollabs.length})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSubTab('my_applications')}
                                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                                        subTab === 'my_applications'
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <span>// MY APPLICATIONS</span>
                                    {pendingMyAppsCount > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-bold ${
                                            subTab === 'my_applications' ? 'bg-black text-amber-400' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                        }`}>
                                            {pendingMyAppsCount}
                                        </span>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    {viewMode === 'myspace' && isModal && onCreateCollab && (
                        <button
                            type="button"
                            onClick={onCreateCollab}
                            className="px-2.5 py-1 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>// CREATE COLLAB</span>
                        </button>
                    )}

                    {onClose && !isModal && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-2.5 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
                        >
                            <span>←</span>
                            <span>// BACK TO COLLABS</span>
                        </button>
                    )}
                </div>
            )}

            {/* TAB 1: INCOMING COLLABS (Creator Side) */}
            {subTab === 'applications' && (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="pb-4 border-b border-zinc-800 space-y-1 font-mono">
                        <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                            // INCOMING APPLICATIONS
                        </h1>
                        <p className="text-xs text-zinc-400">
                            Review applications received for your published collaborations.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative font-mono">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                            <MagnifyingGlassIcon className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="// SEARCH COLLABS..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 pl-9 pr-8 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-white cursor-pointer"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Project & Status Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0c0c0e] border border-zinc-800 font-mono text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Project Dropdown */}
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">// PROJECT:</span>
                                <select
                                    value={effectiveIncomingProjectFilter}
                                    onChange={(e) => setFilterCollabId(e.target.value)}
                                    className="bg-black border border-zinc-750 text-xs text-white px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer max-w-[200px] truncate"
                                >
                                    <option value="all">ALL PROJECTS ({incomingSearchAndStatusFiltered.length})</option>
                                    {incomingProjects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.title} ({project.count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">// STATUS:</span>
                                <div className="flex items-center gap-1">
                                    {(['ALL', 'PENDING', 'ACCEPTED', 'DECLINED'] as const).map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setStatusFilter(st)}
                                            className={`px-2 py-0.5 text-[10px] uppercase border transition-all cursor-pointer ${
                                                statusFilter === st
                                                    ? 'bg-white text-black border-white font-bold'
                                                    : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-zinc-400 self-end sm:self-auto">
                            Showing <span className="text-white font-bold">{filteredCreatorApps.length}</span> applications
                        </div>
                    </div>

                    {/* Applications List */}
                    {loadingCreatorApps ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING APPLICATIONS...</p>
                        </div>
                    ) : creatorApplications.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2 font-mono">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">// NO INCOMING COLLABS</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                No applications are waiting for your review.
                            </p>
                        </div>
                    ) : filteredCreatorApps.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2 font-mono">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                {searchQuery.trim() ? '// NO COLLABS FOUND' : '// NO APPLICATIONS MATCHING FILTER'}
                            </h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                {searchQuery.trim()
                                    ? `No applications match "${searchQuery}".`
                                    : `No applications match the active status filter (${statusFilter}).`}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredCreatorApps.map(app => {
                                const targetCollab = resolvedCollabsMap[app.collabId] || creatorPublishedCollabs.find(c => c.id === app.collabId) || userCollabs.find(c => c.id === app.collabId);

                                return (
                                    <IncomingApplicationCard
                                        key={app.id}
                                        application={app}
                                        targetCollab={targetCollab}
                                        allApplications={creatorApplications}
                                        onOpenOverview={handleOpenCollabOverview}
                                        onAccept={handleAccept}
                                        onDecline={handleDecline}
                                        onMessage={handleMessageApplicant}
                                        isActionLoading={actionLoadingId === app.id}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: MY APPLICATIONS (Applicant Side) */}
            {subTab === 'my_applications' && (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="pb-4 border-b border-zinc-800 space-y-1 font-mono">
                        <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                            // MY APPLICATIONS
                        </h1>
                        <p className="text-xs text-zinc-400">
                            Track the status of collaboration roles and projects you applied to.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative font-mono">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                            <MagnifyingGlassIcon className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={myAppsSearchQuery}
                            onChange={(e) => setMyAppsSearchQuery(e.target.value)}
                            placeholder="// SEARCH APPLICATIONS..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 pl-9 pr-8 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition-colors"
                        />
                        {myAppsSearchQuery && (
                            <button
                                type="button"
                                onClick={() => setMyAppsSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-white cursor-pointer"
                                title="Clear search"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Project & Status Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0c0c0e] border border-zinc-800 font-mono text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Project Dropdown */}
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">// PROJECT:</span>
                                <select
                                    value={effectiveProjectFilter}
                                    onChange={(e) => setMyAppsProjectFilter(e.target.value)}
                                    className="bg-black border border-zinc-750 text-xs text-white px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer max-w-[200px] truncate"
                                >
                                    <option value="all">ALL PROJECTS ({myAppsSearchAndStatusFiltered.length})</option>
                                    {myAppsProjects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.title} ({project.count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">// STATUS:</span>
                                <div className="flex items-center gap-1">
                                    {(['ALL', 'PENDING', 'ACCEPTED', 'DECLINED'] as const).map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setMyAppsStatusFilter(st)}
                                            className={`px-2 py-0.5 text-[10px] uppercase border transition-all cursor-pointer ${
                                                myAppsStatusFilter === st
                                                    ? 'bg-white text-black border-white font-bold'
                                                    : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-zinc-400 self-end sm:self-auto">
                            Showing <span className="text-white font-bold">{filteredMyApps.length}</span> {filteredMyApps.length === 1 ? 'application' : 'applications'}
                        </div>
                    </div>

                    {loadingMyApps ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING MY APPLICATIONS...</p>
                        </div>
                    ) : myApplications.length === 0 ? (
                        <div className="p-10 sm:p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-3 font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                // NO APPLICATIONS YET
                            </span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                You haven't applied to any collaboration projects yet.
                            </h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                Explore published Collabs in Spotlight to discover teams, evaluate roles, and apply directly.
                            </p>
                            <div className="pt-2">
                                <ReactRouterDOM.Link
                                    to="/spotlight?tab=Collabs"
                                    className="inline-block bg-white text-black hover:bg-zinc-200 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    // EXPLORE COLLABS
                                </ReactRouterDOM.Link>
                            </div>
                        </div>
                    ) : filteredMyApps.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2 font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                // NO APPLICATIONS FOUND
                            </span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                No applications match your current search or filter.
                            </h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                Try adjusting your search terms or status filter to find what you're looking for.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setMyAppsProjectFilter('all');
                                    setMyAppsStatusFilter('ALL');
                                    setMyAppsSearchQuery('');
                                }}
                                className="mt-3 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-xs text-zinc-300 hover:text-white uppercase tracking-wider transition-colors inline-block cursor-pointer font-mono"
                            >
                                // RESET FILTERS
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredMyApps.map((app) => {
                                const targetCollab = resolvedCollabsMap[app.collabId] || userCollabs.find(c => c.id === app.collabId);
                                return (
                                    <MyApplicationCard
                                        key={app.id}
                                        application={app}
                                        targetCollab={targetCollab}
                                        onViewDetails={handleOpenCollabOverview}
                                        onWithdraw={handleWithdraw}
                                        isActionLoading={actionLoadingId === app.id}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: ACTIVE COLLABS */}
            {subTab === 'active' && (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="pb-4 border-b border-zinc-800 space-y-1 font-mono">
                        <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                            // ACTIVE COLLABS
                        </h1>
                        <p className="text-xs text-zinc-400">
                            Confirmed collaborations and partnerships you are currently participating in.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative font-mono">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                            <MagnifyingGlassIcon className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={activeTabSearchQuery}
                            onChange={(e) => setActiveTabSearchQuery(e.target.value)}
                            placeholder="// SEARCH COLLABS..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 pl-9 pr-8 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition-colors"
                        />
                        {activeTabSearchQuery && (
                            <button
                                type="button"
                                onClick={() => setActiveTabSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-white cursor-pointer"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0c0c0e] border border-zinc-800 font-mono text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Project Dropdown */}
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">// PROJECT:</span>
                                <select
                                    value={effectiveActiveProjectFilter}
                                    onChange={(e) => setActiveTabProjectFilter(e.target.value)}
                                    className="bg-black border border-zinc-750 text-xs text-white px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer max-w-[200px] truncate"
                                >
                                    <option value="all">ALL PROJECTS ({activeSearchAndRoleFiltered.length})</option>
                                    {activeProjects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.title} ({project.count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Role / Collaboration Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">// FILTER:</span>
                                <div className="flex items-center gap-1">
                                    {([
                                        { id: 'ALL', label: 'ALL' },
                                        { id: 'MY_COLLABORATIONS', label: 'MY COLLABORATIONS' },
                                        { id: 'MY_OFFERINGS', label: 'MY OFFERINGS' },
                                    ] as const).map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTabRoleFilter(tab.id)}
                                            className={`px-2 py-0.5 text-[10px] uppercase border transition-all cursor-pointer ${
                                                activeTabRoleFilter === tab.id
                                                    ? 'bg-white text-black border-white font-bold'
                                                    : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-zinc-400 self-end sm:self-auto">
                            Showing <span className="text-white font-bold">{filteredActiveCollaborations.length}</span> active collaborations
                        </div>
                    </div>

                    {/* Active Collaborations Content */}
                    {loadingMyApps || loadingCreatorApps ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING COLLABORATIONS...</p>
                        </div>
                    ) : activeCollaborations.total === 0 ? (
                        <div className="p-10 sm:p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-3 font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                // NO ACTIVE COLLABS
                            </span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                No active collaborations confirmed yet.
                            </h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                When a creator accepts your role application, or when you accept an applicant for your published Collab, your confirmed partnership and project workspace will appear here.
                            </p>
                            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                                <ReactRouterDOM.Link
                                    to="/spotlight?tab=Collabs"
                                    className="inline-block bg-white text-black hover:bg-zinc-200 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    // EXPLORE COLLABS
                                </ReactRouterDOM.Link>
                                {onCreateCollab && (
                                    <button
                                        type="button"
                                        onClick={onCreateCollab}
                                        className="inline-block bg-zinc-900 border border-zinc-700 text-white hover:border-zinc-500 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        + CREATE COLLAB
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : filteredActiveCollaborations.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2 font-mono">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                {activeTabSearchQuery.trim() ? '// NO ACTIVE COLLABS FOUND' : '// NO COLLABORATIONS MATCHING FILTER'}
                            </h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                {activeTabSearchQuery.trim()
                                    ? `No active collaborations match "${activeTabSearchQuery}".`
                                    : `No collaborations found under the current filter selection.`}
                            </p>
                            {activeTabSearchQuery.trim() && (
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTabSearchQuery('')}
                                        className="text-xs text-emerald-400 hover:underline uppercase tracking-wider font-bold cursor-pointer"
                                    >
                                        // CLEAR SEARCH
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredActiveCollaborations.map(({ application, variant, targetCollab, otherAccepted }) => (
                                <ActiveCollabCard
                                    key={`${variant}-${application.id}`}
                                    application={application}
                                    targetCollab={targetCollab}
                                    variant={variant}
                                    otherAcceptedApplications={otherAccepted}
                                    onViewDetails={(app, collab) => handleOpenCollabOverview(app, collab)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: PUBLISHED COLLABS (Existing creator collabs with EDIT & DELETE) */}
            {subTab === 'published' && (
                <div className="space-y-4">
                    {userCollabs.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// PUBLISHED COLLABS</span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Published Collabs</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                You haven't published any Collab projects. Publish your project to recruit talent, assemble teams, and build together.
                            </p>
                            <div className="pt-3">
                                <button
                                    onClick={onCreateCollab}
                                    className="bg-white text-black hover:bg-zinc-200 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    // CREATE COLLAB
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {userCollabs.map((item) => {
                                const uniqueSkills = Array.from(new Set((item.collabDetails?.roles || []).flatMap(r => r.skills || [])));
                                const isExpanded = expandedCollabIds.has(item.id);
                                const incomingApps = creatorApplications.filter(a => a.collabId === item.id);
                                const pendingCount = incomingApps.filter(a => a.status === 'PENDING').length;

                                return (
                                    <div key={`published-collab-${item.id}`} className="bg-[#0c0c0e] border border-zinc-800 flex flex-col group hover:border-zinc-700 transition-all relative font-mono">
                                        {/* Header */}
                                        <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-zinc-700 px-1.5 py-0.5 bg-zinc-900/50">
                                                    {item.domain || item.category || 'Technology'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">// COLLAB SIGNAL</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuCollabId(activeMenuCollabId === item.id ? null : item.id);
                                                        }}
                                                        className="text-zinc-500 hover:text-white p-1 transition-colors border border-transparent hover:border-zinc-800"
                                                        title="Options"
                                                    >
                                                        <EllipsisVerticalIcon className="w-4 h-4" />
                                                    </button>
                                                    {activeMenuCollabId === item.id && (
                                                        <div 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            className="absolute right-0 mt-1 w-44 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuCollabId(null);
                                                                    handleViewCollab(item.id);
                                                                }}
                                                                className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-zinc-900 uppercase tracking-wider flex items-center gap-2"
                                                            >
                                                                <span>// VIEW COLLAB</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuCollabId(null);
                                                                    handleEditCollab(item);
                                                                }}
                                                                className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-zinc-900 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-850"
                                                            >
                                                                <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                                <span>// EDIT IN MY SPACE</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuCollabId(null);
                                                                    setDeleteConfirmCollab({
                                                                        id: item.id,
                                                                        title: item.aiSummary || item.oneLine || 'Collab Signal',
                                                                    });
                                                                }}
                                                                disabled={effectiveDeletingId === item.id}
                                                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30 hover:text-red-300 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 mt-1"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                                <span>// DELETE</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Media Preview (if attached) */}
                                        {item.mediaUrl && (
                                            <div className="aspect-video bg-black overflow-hidden relative border-b border-zinc-800">
                                                {item.mediaType === 'video' ? (
                                                    <video src={item.mediaUrl} className="w-full h-full object-cover" controls />
                                                ) : (
                                                    <img src={item.mediaUrl} className="w-full h-full object-cover" onError={handleImageError} alt="Media" />
                                                )}
                                            </div>
                                        )}

                                        {/* Body */}
                                        <div className="p-4 flex-grow space-y-3">
                                            {/* Hook */}
                                            <div>
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// THE HOOK</span>
                                                <h4 className="text-sm font-bold text-white leading-snug uppercase tracking-wider">
                                                    "{item.aiSummary || item.oneLine}"
                                                </h4>
                                            </div>

                                            {/* Project Overview */}
                                            <div>
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// PROJECT OVERVIEW</span>
                                                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{item.content}</p>
                                            </div>

                                            {/* Roles Breakdown with live counts */}
                                            {item.collabDetails && (
                                                <div className="p-3 bg-black/60 border border-zinc-800/80 space-y-2.5 text-xs">
                                                    {item.collabDetails.roles && item.collabDetails.roles.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// ROLES OFFERED</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {item.collabDetails.roles.map((r, rIdx) => {
                                                                    const cap = getRoleCapacity(r, creatorApplications);
                                                                    return (
                                                                        <span key={rIdx} className="text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-200 px-2 py-0.5 font-medium flex items-center gap-1.5">
                                                                            <span>{r.title}</span>
                                                                            <span className="text-zinc-400 font-bold">×{r.count}</span>
                                                                            {cap.isFilled ? (
                                                                                <span className="text-[9px] text-zinc-500 font-bold">// FILLED</span>
                                                                            ) : (
                                                                                <span className="text-[9px] text-emerald-400 font-bold">({cap.remaining} open)</span>
                                                                            )}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Skills */}
                                                    {uniqueSkills.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// SKILLS</span>
                                                            <div className="flex flex-wrap gap-1 text-[10px] text-zinc-400">
                                                                {uniqueSkills.map((s, sIdx) => (
                                                                    <span key={sIdx} className="bg-zinc-900/80 border border-zinc-800 px-1.5 py-0.5 text-zinc-300">
                                                                        {s}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Status & Collaboration */}
                                                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-zinc-800/60 text-[11px]">
                                                        {item.collabDetails.projectStatus && (
                                                            <div>
                                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// PROJECT STATUS</span>
                                                                <span className="text-zinc-200 font-bold bg-zinc-900 px-1.5 py-0.5 border border-zinc-800 inline-block">
                                                                    {item.collabDetails.projectStatus}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {(item.collabDetails.collabTypes || item.collabDetails.location) && (
                                                            <div>
                                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// COLLABORATION</span>
                                                                <span className="text-zinc-300 truncate block">
                                                                    {[...(item.collabDetails.collabTypes || []), item.collabDetails.location === 'Specific Location' ? item.collabDetails.specificLocation : item.collabDetails.location].filter(Boolean).join(' • ')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Expanded Details */}
                                                    {isExpanded && (
                                                        <div className="pt-2 border-t border-zinc-800/60 space-y-2 text-[11px]">
                                                            {item.collabDetails.roles.map((r, rIdx) => r.responsibilities ? (
                                                                <div key={rIdx} className="p-2 bg-zinc-950 border border-zinc-800/60">
                                                                    <span className="text-white font-bold block">{r.title} Responsibilities:</span>
                                                                    <p className="text-zinc-400 mt-0.5 leading-relaxed">{r.responsibilities}</p>
                                                                </div>
                                                            ) : null)}

                                                            {(item.collabDetails.experience || item.collabDetails.background || item.collabDetails.availability) && (
                                                                <div className="p-2 bg-zinc-950 border border-zinc-800/60 flex flex-wrap gap-2 text-[10px] text-zinc-400">
                                                                    {item.collabDetails.experience && <div><span className="text-zinc-500 font-bold">EXP:</span> {item.collabDetails.experience}</div>}
                                                                    {item.collabDetails.background && <div><span className="text-zinc-500 font-bold">BG:</span> {item.collabDetails.background}</div>}
                                                                    {item.collabDetails.availability && <div><span className="text-zinc-500 font-bold">AVAIL:</span> {item.collabDetails.availability}</div>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="pt-1 flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCollabDetails(item.id)}
                                                            className="text-[10px] text-white hover:text-zinc-300 underline font-bold uppercase tracking-wider"
                                                        >
                                                            {isExpanded ? '// HIDE DETAILS' : '// VIEW DETAILS'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Applications and Action Buttons */}
                                            <div className="pt-2 space-y-2">
                                                <button
                                                    onClick={() => {
                                                        setFilterCollabId(item.id);
                                                        setSubTab('applications');
                                                    }}
                                                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white text-xs font-bold py-2 px-3 uppercase tracking-wider flex items-center justify-between transition-colors"
                                                >
                                                    <span>// MANAGE APPLICATIONS</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 ${
                                                        pendingCount > 0 ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-black text-zinc-400'
                                                    }`}>
                                                        {incomingApps.length} TOTAL ({pendingCount} PENDING)
                                                    </span>
                                                </button>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewCollab(item.id)}
                                                        className="w-full bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[10px] font-bold py-1.5 px-2 uppercase tracking-wider transition-colors text-center"
                                                    >
                                                        // VIEW COLLAB
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditCollab(item)}
                                                        className="w-full bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[10px] font-bold py-1.5 px-2 uppercase tracking-wider transition-colors text-center"
                                                    >
                                                        // EDIT IN MY SPACE
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmCollab && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
                    <div 
                        className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-md p-5 font-mono text-zinc-300 shadow-2xl space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">// CONFIRM DELETION</span>
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmCollab(null)}
                                className="text-zinc-500 hover:text-white p-1"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2 text-xs">
                            <p className="text-zinc-300">
                                Are you sure you want to delete this published Collab signal?
                            </p>
                            <p className="p-2.5 bg-black border border-zinc-850 text-white font-bold">
                                "{deleteConfirmCollab.title}"
                            </p>
                            <p className="text-zinc-500 text-[11px]">
                                This will remove the listing from Spotlight and close open role applications.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmCollab(null)}
                                className="px-3 py-1.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs uppercase tracking-wider"
                            >
                                CANCEL
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(deleteConfirmCollab.id)}
                                disabled={effectiveDeletingId === deleteConfirmCollab.id}
                                className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                                <span>{effectiveDeletingId === deleteConfirmCollab.id ? 'DELETING...' : '// DELETE COLLAB'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Collab Overview Modal */}
            {overviewModalData.isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fadeIn"
                    onClick={handleCloseCollabOverview}
                >
                    <div
                        className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col font-mono text-zinc-300 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#0c0c0e] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">// COLLAB OVERVIEW</span>
                                {overviewModalData.collab?.id && (
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        [{overviewModalData.collab.id.slice(0, 8)}]
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseCollabOverview}
                                className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                                title="Close overview"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="p-5 overflow-y-auto space-y-5 text-xs">
                            {overviewModalData.isLoading ? (
                                <div className="py-16 text-center space-y-3">
                                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">// LOADING COLLAB POST DATA...</p>
                                </div>
                            ) : (() => {
                                const c = overviewModalData.collab;
                                const a = overviewModalData.application;
                                const creatorName = c?.author?.name || a?.collabCreatorName || currentUser?.displayName || 'Project Lead';
                                const creatorAvatar = c?.author?.avatarUrl || a?.collabCreatorAvatar || currentUser?.photoURL || `https://picsum.photos/seed/${c?.id || a?.collabId}/200`;
                                const creatorUsername = c?.author?.username || (c?.authorId === currentUser?.uid ? (currentUser as any)?.username : undefined);
                                const isVerified = Boolean(c?.author?.isVerified);

                                const title = c?.aiSummary || c?.oneLine || a?.collabTitle || 'Untitled Collab Post';
                                const overview = c?.content || c?.oneLine || a?.collabOverview || 'No description provided for this collaboration signal.';
                                const domain = (c?.domain || c?.category || a?.collabDomain || 'TECHNOLOGY').toUpperCase();
                                const projectStatus = (c?.collabDetails?.projectStatus || 'MVP').toUpperCase();

                                const rawRoles: CollabRole[] = c?.collabDetails?.roles || [];
                                const allSkills = Array.from(new Set([
                                    ...rawRoles.flatMap((r: any) => Array.isArray(r?.skills) ? r.skills : (typeof r?.skills === 'string' ? [r.skills] : [])),
                                    ...(c?.tags || [])
                                ])).filter(Boolean);

                                const collabTypes = c?.collabDetails?.collabTypes && c.collabDetails.collabTypes.length > 0
                                    ? c.collabDetails.collabTypes.join(' · ').toUpperCase()
                                    : 'OPEN COLLABORATION';

                                const commitment = c?.collabDetails?.availability?.toUpperCase() || 'FLEXIBLE';

                                const locationInfo = c?.collabDetails?.location === 'Specific Location' && c?.collabDetails?.specificLocation
                                    ? `SPECIFIC LOCATION (${c.collabDetails.specificLocation.toUpperCase()})`
                                    : (c?.collabDetails?.location || 'REMOTE').toUpperCase();

                                return (
                                    <div className="space-y-4">
                                        {/* // CREATOR & DOMAIN */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-850">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// CREATOR</span>
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={creatorAvatar}
                                                        onError={handleImageError}
                                                        alt={creatorName}
                                                        className="w-10 h-10 border border-zinc-700 object-cover bg-zinc-900 flex-shrink-0"
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-white text-sm">
                                                                {creatorName}
                                                            </span>
                                                            {isVerified && <CheckBadgeIcon className="w-4 h-4 text-zinc-400" />}
                                                        </div>
                                                        {creatorUsername && (
                                                            <span className="text-[11px] text-zinc-500 block">
                                                                @{creatorUsername}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Domain Pill */}
                                            <div className="text-right">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// DOMAIN</span>
                                                <span className="text-[11px] uppercase font-mono px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-200 inline-block">
                                                    {domain}
                                                </span>
                                            </div>
                                        </div>

                                        {/* // TITLE */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// TITLE</span>
                                            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                                                "{title}"
                                            </h3>
                                        </div>

                                        {/* // OVERVIEW */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// OVERVIEW</span>
                                            <div className="p-3.5 bg-black/60 border border-zinc-850 text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
                                                {overview}
                                            </div>
                                        </div>

                                        {/* KEY SPECIFICATIONS GRID: PROJECT STATUS, COLLABORATION, COMMITMENT, LOCATION */}
                                        <div className="p-3.5 bg-black/60 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                                            {/* PROJECT STATUS */}
                                            <div>
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// PROJECT STATUS</span>
                                                <span className="text-xs text-white font-bold bg-zinc-900 border border-zinc-700 px-2 py-0.5 inline-block">
                                                    {projectStatus}
                                                </span>
                                            </div>

                                            {/* COLLABORATION */}
                                            <div>
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// COLLABORATION</span>
                                                <span className="text-xs text-zinc-200">
                                                    {collabTypes}
                                                </span>
                                            </div>

                                            {/* COMMITMENT */}
                                            <div>
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// COMMITMENT</span>
                                                <span className="text-xs text-zinc-200">
                                                    {commitment}
                                                </span>
                                            </div>

                                            {/* LOCATION */}
                                            <div>
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// LOCATION</span>
                                                <span className="text-xs text-zinc-200">
                                                    {locationInfo}
                                                </span>
                                            </div>
                                        </div>

                                        {/* // LOOKING FOR (ROLES & REMAINING POSITIONS) */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// LOOKING FOR</span>
                                            {rawRoles.length > 0 ? (
                                                <div className="space-y-2">
                                                    {rawRoles.map((r, idx) => {
                                                        const cap = getRoleCapacity(r, creatorApplications);
                                                        const isThisRole = a?.roleId === r.id;
                                                        return (
                                                            <div
                                                                key={r.id || idx}
                                                                className={`p-3 border transition-colors ${
                                                                    isThisRole
                                                                        ? 'bg-zinc-900/90 border-emerald-800/80'
                                                                        : 'bg-black/60 border-zinc-800/80'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-white text-xs">{r.title}</span>
                                                                        <span className="text-[10px] text-zinc-400 font-bold">×{r.count || 1}</span>
                                                                        {isThisRole && (
                                                                            <span className="text-[9px] uppercase px-1.5 py-0.2 bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                                                                                // APPLIED ROLE
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        {cap.isFilled ? (
                                                                            <span className="text-[10px] text-zinc-500 font-bold">// FILLED</span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-emerald-400 font-bold">
                                                                                // {cap.remaining} OF {r.count} OPEN
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Responsibilities if provided */}
                                                                {r.responsibilities && (
                                                                    <p className="text-zinc-400 text-[11px] leading-relaxed mt-2 pt-2 border-t border-zinc-850">
                                                                        <span className="text-zinc-500 font-bold mr-1">// SCOPE:</span>
                                                                        {r.responsibilities}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-black/60 border border-zinc-800 text-zinc-300">
                                                    {a?.roleTitle ? (
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-white">{a.roleTitle}</span>
                                                            <span className="text-[10px] text-zinc-500">// ROLE APPLIED</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-500 italic">No role details specified</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* // REQUIRED SKILLS */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// REQUIRED SKILLS</span>
                                            {allSkills.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {allSkills.map((s, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300"
                                                        >
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-zinc-500 italic">
                                                    No specific skills listed
                                                </span>
                                            )}
                                        </div>

                                        {/* EXTENDED DETAILS (Experience, Background if available) */}
                                        {(c?.collabDetails?.experience || c?.collabDetails?.background) && (
                                            <div className="space-y-1.5 pt-2 border-t border-zinc-850">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// COLLABORATOR PREFERENCES</span>
                                                <div className="p-3 bg-black/60 border border-zinc-850 space-y-2 text-[11px]">
                                                    {c?.collabDetails?.experience && (
                                                        <div>
                                                            <span className="text-zinc-500 font-bold mr-1.5">EXPERIENCE:</span>
                                                            <span className="text-zinc-300">{c.collabDetails.experience}</span>
                                                        </div>
                                                    )}
                                                    {c?.collabDetails?.background && (
                                                        <div>
                                                            <span className="text-zinc-500 font-bold mr-1.5">BACKGROUND:</span>
                                                            <span className="text-zinc-300">{c.collabDetails.background}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* // YOUR SUBMITTED APPLICATION DETAILS (when viewing from application context) */}
                                        {a && (
                                            <div className="space-y-2 pt-2.5 border-t border-zinc-850">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                                    // YOUR SUBMITTED APPLICATION
                                                </span>
                                                <div className="p-3 bg-black/70 border border-zinc-850 space-y-2.5 text-xs">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-900 text-[11px]">
                                                        <div>
                                                            <span className="text-zinc-500 font-bold mr-1">// APPLIED FOR:</span>
                                                            <span className="text-white font-bold">{a.roleTitle}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-zinc-400">
                                                                <span className="text-zinc-500 font-bold mr-1">// APPLIED:</span>
                                                                {a.createdAt
                                                                    ? (typeof a.createdAt?.toDate === 'function'
                                                                        ? a.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                                                        : new Date(a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
                                                                    : 'Recently'}
                                                            </span>
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                                                a.status === 'ACCEPTED'
                                                                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                                                                    : a.status === 'PENDING'
                                                                    ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                                                                    : 'bg-zinc-900 text-zinc-400 border-zinc-750'
                                                            }`}>
                                                                // {a.status}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                                            // YOUR MESSAGE
                                                        </span>
                                                        {a.message?.trim() ? (
                                                            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-2.5 border border-zinc-900 whitespace-pre-wrap">
                                                                {a.message}
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs text-zinc-500 italic bg-zinc-950 p-2 border border-zinc-900">
                                                                No custom message attached.
                                                            </p>
                                                        )}
                                                    </div>

                                                    {a.supportingDocument?.url && (
                                                        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-3 text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                <span className="truncate text-zinc-200">{a.supportingDocument.name}</span>
                                                            </div>
                                                            <a
                                                                href={a.supportingDocument.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] text-white uppercase tracking-wider transition-colors inline-flex items-center gap-1 flex-shrink-0"
                                                            >
                                                                // VIEW DOCUMENT
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-800 bg-[#0c0c0e] flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleCloseCollabOverview}
                                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                // CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
