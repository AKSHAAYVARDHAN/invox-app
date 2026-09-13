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
import { subscribeToUserPosts, deletePost } from '../../services/postService';
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
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

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
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    const effectiveInitialTab = useMemo<'applications' | 'my_applications' | 'active' | 'published'>(() => {
        if (viewMode === 'spotlight') {
            return (initialTab === 'active') ? 'active' : 'applications';
        }
        if (viewMode === 'myspace') {
            return (initialTab === 'my_applications') ? 'my_applications' : 'published';
        }
        return initialTab;
    }, [viewMode, initialTab]);

    const [subTab, setSubTab] = useState<'applications' | 'my_applications' | 'active' | 'published'>(effectiveInitialTab);
    const [internalUserCollabs, setInternalUserCollabs] = useState<Post[]>([]);
    const [creatorApplications, setCreatorApplications] = useState<CollabApplication[]>([]);
    const [myApplications, setMyApplications] = useState<CollabApplication[]>([]);
    const [loadingCreatorApps, setLoadingCreatorApps] = useState(true);
    const [loadingMyApps, setLoadingMyApps] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMenuCollabId, setActiveMenuCollabId] = useState<string | null>(null);
    const [expandedCollabIds, setExpandedCollabIds] = useState<Set<string>>(new Set());
    const [filterCollabId, setFilterCollabId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');
    const [internalDeletingId, setInternalDeletingId] = useState<string | null>(null);
    const [deleteConfirmCollab, setDeleteConfirmCollab] = useState<{ id: string; title: string } | null>(null);

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

    useEffect(() => {
        setSubTab(effectiveInitialTab);
    }, [effectiveInitialTab]);

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

    // Counts
    const pendingCreatorAppsCount = useMemo(() => {
        return creatorApplications.filter(a => a.status === 'PENDING').length;
    }, [creatorApplications]);

    const pendingMyAppsCount = useMemo(() => {
        return myApplications.filter(a => a.status === 'PENDING').length;
    }, [myApplications]);

    const activeCollaborations = useMemo(() => {
        // Combinations: user accepted as applicant + applicants accepted on user's collabs
        const asApplicant = myApplications.filter(a => a.status === 'ACCEPTED');
        const asCreator = creatorApplications.filter(a => a.status === 'ACCEPTED');
        return { asApplicant, asCreator, total: asApplicant.length + asCreator.length };
    }, [myApplications, creatorApplications]);

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

    // Unique list of creator's published Collabs (merging userCollabs and any collabs referenced in creatorApplications)
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

    // Matching published Collabs based on search query and project filter
    const matchingCollabs = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return creatorPublishedCollabs.filter(collab => {
            if (filterCollabId !== 'all' && collab.id !== filterCollabId) return false;
            if (!q) return true;
            const title = (collab.aiSummary || collab.oneLine || '').toLowerCase();
            const hook = (collab.oneLine || collab.content || '').toLowerCase();
            const domain = (collab.domain || collab.category || '').toLowerCase();
            return title.includes(q) || hook.includes(q) || domain.includes(q);
        });
    }, [creatorPublishedCollabs, filterCollabId, searchQuery]);

    // Helper to get applications for a specific collab matching status filter
    const getCollabApplications = (collabId: string) => {
        return creatorApplications.filter(app => {
            if (app.collabId !== collabId) return false;
            if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
            return true;
        });
    };

    // Filtered applications count across all matching collabs
    const totalFilteredAppsCount = useMemo(() => {
        return matchingCollabs.reduce((acc, collab) => {
            return acc + getCollabApplications(collab.id).length;
        }, 0);
    }, [matchingCollabs, creatorApplications, statusFilter]);

    // Grouping of collabs with their applications for display
    const displayGroups = useMemo(() => {
        return matchingCollabs
            .map(collab => ({
                collab,
                apps: getCollabApplications(collab.id),
            }))
            .filter(group => {
                if (filterCollabId !== 'all') return true;
                return group.apps.length > 0;
            });
    }, [matchingCollabs, filterCollabId, statusFilter, creatorApplications]);

    const formatDate = (date: any) => {
        if (!date) return 'RECENT';
        try {
            const d = date?.toDate ? date.toDate() : new Date(date);
            return isNaN(d.getTime()) ? 'RECENT' : d.toLocaleDateString();
        } catch {
            return 'RECENT';
        }
    };

    const formatCollabDetails = (collab: Partial<Post>) => {
        const types = (collab.collabDetails?.collabTypes && collab.collabDetails.collabTypes.length > 0)
            ? collab.collabDetails.collabTypes.join(' / ').toUpperCase()
            : 'OPEN COLLABORATION';
        const avail = collab.collabDetails?.availability?.toUpperCase() || 'FLEXIBLE / TO BE DISCUSSED';
        const loc = (collab.collabDetails?.location || 'REMOTE').toUpperCase();
        return `${types} • ${avail} • ${loc}`;
    };

    // Filtered incoming applications for creator
    const filteredCreatorApps = useMemo(() => {
        return creatorApplications.filter(app => {
            if (filterCollabId !== 'all' && app.collabId !== filterCollabId) return false;
            if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
            return true;
        });
    }, [creatorApplications, filterCollabId, statusFilter]);

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
                            // INCOMING COLLABS
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
                                    value={filterCollabId}
                                    onChange={(e) => setFilterCollabId(e.target.value)}
                                    className="bg-black border border-zinc-750 text-xs text-white px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer max-w-[200px] truncate"
                                >
                                    <option value="all">ALL PROJECTS ({creatorApplications.length})</option>
                                    {creatorPublishedCollabs.map(collab => {
                                        const count = creatorApplications.filter(a => a.collabId === collab.id).length;
                                        return (
                                            <option key={collab.id} value={collab.id}>
                                                {collab.aiSummary || collab.oneLine || 'Collab'} ({count})
                                            </option>
                                        );
                                    })}
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
                            Showing <span className="text-white font-bold">{totalFilteredAppsCount}</span> applications
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
                    ) : matchingCollabs.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2 font-mono">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">// NO COLLABS FOUND</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                No published collabs match "{searchQuery}".
                            </p>
                        </div>
                    ) : displayGroups.length === 0 || totalFilteredAppsCount === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2 font-mono">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">// NO APPLICATIONS MATCHING FILTER</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                No applications match the active status filter ({statusFilter}).
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {displayGroups.map(group => (
                                <div key={group.collab.id} className="space-y-3 font-mono">
                                    {/* Project Header */}
                                    <div className="p-4 bg-[#0c0c0e] border border-zinc-800 space-y-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-850">
                                            <div>
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// PROJECT</span>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mt-0.5">
                                                    "{group.collab.aiSummary || group.collab.oneLine || 'Untitled Collab'}"
                                                </h3>
                                            </div>
                                            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1">
                                                {group.apps.length} {group.apps.length === 1 ? 'application' : 'applications'}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
                                            <div>
                                                <span className="text-zinc-500">DOMAIN: </span>
                                                <span className="text-zinc-200 uppercase font-bold">
                                                    {(group.collab.domain || group.collab.category || 'DESIGN').toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500">STATUS: </span>
                                                <span className="text-zinc-200 uppercase font-bold">
                                                    {(group.collab.collabDetails?.projectStatus || 'EARLY CONCEPT').toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500">COLLABORATION: </span>
                                                <span className="text-zinc-200 uppercase">
                                                    {formatCollabDetails(group.collab)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Applicant Cards */}
                                    {group.apps.length === 0 ? (
                                        <div className="p-4 bg-[#0a0a0c] border border-zinc-850 text-center text-xs text-zinc-500">
                                            // NO {statusFilter} APPLICATIONS FOR THIS PROJECT
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {group.apps.map(app => {
                                                const rawRoles = group.collab?.collabDetails?.roles || [];
                                                const role = rawRoles.find(r => r.id === app.roleId);
                                                const roleCapacity = role ? getRoleCapacity(role, creatorApplications) : null;
                                                const isFilled = Boolean(roleCapacity?.isFilled);
                                                const isActionLoading = actionLoadingId === app.id;

                                                return (
                                                    <div
                                                        key={app.id}
                                                        className="p-4 bg-[#0a0a0c] border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                                                    >
                                                        {/* APPLICANT */}
                                                        <div>
                                                            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">
                                                                    APPLICANT
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/profile/${app.applicantId || app.applicant?.uid}`)}
                                                                    className="px-2.5 py-1 bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                                                    title={`View ${app.applicant?.displayName || 'Applicant'}'s INVOX profile`}
                                                                >
                                                                    // VIEW PROFILE
                                                                </button>
                                                            </div>

                                                            <div className="pt-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => navigate(`/profile/${app.applicantId || app.applicant?.uid}`)}
                                                                        className="w-11 h-11 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                                                                    >
                                                                        {app.applicant?.photoURL ? (
                                                                            <img
                                                                                src={app.applicant.photoURL}
                                                                                alt={app.applicant.displayName}
                                                                                className="w-full h-full object-cover"
                                                                                onError={handleImageError}
                                                                            />
                                                                        ) : (
                                                                            <span className="font-bold text-white text-sm">
                                                                                {(app.applicant?.displayName || 'A').charAt(0).toUpperCase()}
                                                                            </span>
                                                                        )}
                                                                    </button>

                                                                    <div className="space-y-1 min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-baseline gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => navigate(`/profile/${app.applicantId || app.applicant?.uid}`)}
                                                                                className="font-bold text-white text-sm hover:underline text-left cursor-pointer"
                                                                            >
                                                                                {app.applicant?.displayName || 'Applicant'}
                                                                            </button>
                                                                            <span className="text-zinc-500 text-xs">
                                                                                @{app.applicant?.username || 'user'}
                                                                            </span>
                                                                        </div>

                                                                        {(app.applicant?.headline || app.applicant?.bio) && (
                                                                            <p className="text-xs text-zinc-400 line-clamp-1">
                                                                                {app.applicant.headline || app.applicant.bio}
                                                                            </p>
                                                                        )}

                                                                        {/* ROLE & AVAILABILITY */}
                                                                        <div className="pt-1 flex flex-wrap items-center gap-2">
                                                                            <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-xs text-white font-bold">
                                                                                ROLE: {app.roleTitle}
                                                                            </span>
                                                                            {roleCapacity ? (
                                                                                <span className={`text-[10px] px-1.5 py-0.5 border ${
                                                                                    isFilled
                                                                                        ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                                                                        : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/80'
                                                                                }`}>
                                                                                    {isFilled ? '// FILLED' : `// ${roleCapacity.remaining} OF ${roleCapacity.total} OPEN`}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[10px] px-1.5 py-0.5 border bg-zinc-900 text-zinc-400 border-zinc-800">
                                                                                    // 1 POSITION
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Skills */}
                                                                        {app.applicant?.skills && app.applicant.skills.length > 0 && (
                                                                            <div className="pt-1.5 flex flex-wrap gap-1">
                                                                                {app.applicant.skills.map((sk, idx) => (
                                                                                    <span key={idx} className="text-[10px] bg-black border border-zinc-800 text-zinc-300 px-1.5 py-0.5">
                                                                                        {sk}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* WHY YOU? (Application Message) */}
                                                        <div className="p-3 bg-black border border-zinc-850 text-xs space-y-1">
                                                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">
                                                                // WHY YOU?
                                                            </span>
                                                            {app.message?.trim() ? (
                                                                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{app.message}</p>
                                                            ) : (
                                                                <p className="text-zinc-600 italic">// NO MESSAGE PROVIDED</p>
                                                            )}

                                                            {app.supportingDocument?.url && (
                                                                <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2 flex-wrap">
                                                                    <span className="text-[10px] text-zinc-400 truncate max-w-xs">
                                                                        DOCUMENT: {app.supportingDocument.name}
                                                                    </span>
                                                                    <a
                                                                        href={app.supportingDocument.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[10px] text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-2 py-0.5 uppercase tracking-wider transition-colors"
                                                                    >
                                                                        // VIEW DOCUMENT
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* APPLIED DATE + STATUS & ACTIONS */}
                                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-850">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-zinc-500">
                                                                    APPLIED: {formatDate(app.createdAt)}
                                                                </span>
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                                                    app.status === 'ACCEPTED'
                                                                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                                                                        : app.status === 'PENDING'
                                                                        ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                                                                        : app.status === 'DECLINED'
                                                                        ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                                                        : 'bg-zinc-950 text-zinc-600 border-zinc-850'
                                                                }`}>
                                                                    // {app.status}
                                                                </span>
                                                            </div>

                                                            {app.status === 'PENDING' && (
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAccept(app)}
                                                                        disabled={isActionLoading || isFilled}
                                                                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-emerald-800 hover:border-emerald-600 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                                        title={isFilled ? 'Role is already filled' : 'Accept Applicant'}
                                                                    >
                                                                        {isActionLoading ? '...' : '// ACCEPT'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDecline(app)}
                                                                        disabled={isActionLoading}
                                                                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer"
                                                                        title="Decline Applicant"
                                                                    >
                                                                        {isActionLoading ? '...' : '// DECLINE'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: MY APPLICATIONS (Applicant Side) */}
            {subTab === 'my_applications' && (
                <div className="space-y-4">
                    {loadingMyApps ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING MY APPLICATIONS...</p>
                        </div>
                    ) : myApplications.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// MY APPLICATIONS</span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Active Collab Applications</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                You haven't applied for any collaboration roles yet. Explore published Collabs in Spotlight to discover teams and apply for roles.
                            </p>
                            <div className="pt-3">
                                <ReactRouterDOM.Link
                                    to="/spotlight?tab=Collabs"
                                    className="inline-block bg-white text-black hover:bg-zinc-200 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    // EXPLORE COLLABS
                                </ReactRouterDOM.Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myApplications.map((app) => {
                                const isActionLoading = actionLoadingId === app.id;

                                return (
                                    <div
                                        key={app.id}
                                        className="p-4 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-850">
                                            <div>
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// TARGET PROJECT</span>
                                                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                                    "{app.collabTitle}"
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500">
                                                    SUBMITTED: {new Date(app.createdAt).toLocaleDateString()}
                                                </span>
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                                    app.status === 'ACCEPTED'
                                                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                                                        : app.status === 'PENDING'
                                                        ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                                                        : app.status === 'DECLINED'
                                                        ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                                        : 'bg-zinc-950 text-zinc-600 border-zinc-850'
                                                }`}>
                                                    // {app.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-zinc-500 text-xs">APPLIED ROLE:</span>
                                                    <span className="text-white font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5">
                                                        {app.roleTitle}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                                                    <span className="text-zinc-500">CREATOR:</span>
                                                    <span>{app.collabCreatorName || 'Collab Creator'}</span>
                                                    {app.collabDomain && (
                                                        <>
                                                            <span className="text-zinc-600">•</span>
                                                            <span className="text-zinc-500">{app.collabDomain}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {app.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleWithdraw(app)}
                                                        disabled={isActionLoading}
                                                        className="px-3 py-1.5 bg-black hover:bg-red-950/30 border border-zinc-800 hover:border-red-800/80 text-zinc-400 hover:text-red-400 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                                                    >
                                                        {isActionLoading ? '...' : '// WITHDRAW'}
                                                    </button>
                                                )}
                                                <ReactRouterDOM.Link
                                                    to="/spotlight?tab=Collabs"
                                                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs uppercase tracking-wider transition-colors inline-block text-center"
                                                >
                                                    // VIEW IN SPOTLIGHT
                                                </ReactRouterDOM.Link>
                                            </div>
                                        </div>

                                        {app.message && (
                                            <div className="p-2.5 bg-black border border-zinc-850 text-xs text-zinc-400">
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// YOUR MESSAGE</span>
                                                <p className="leading-relaxed">{app.message}</p>
                                            </div>
                                        )}

                                        {/* Attached Document */}
                                        {app.supportingDocument?.url && (
                                            <div className="p-2.5 bg-black border border-zinc-850 text-xs text-zinc-400">
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// ATTACHED DOCUMENT</span>
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2 font-mono text-zinc-200">
                                                        <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        <span className="truncate max-w-xs">{app.supportingDocument.name}</span>
                                                    </div>
                                                    <a
                                                        href={app.supportingDocument.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] font-mono text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-2 py-0.5 uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                                                    >
                                                        // VIEW DOCUMENT
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: ACTIVE COLLABS */}
            {subTab === 'active' && (
                <div className="space-y-4">
                    <div className="p-3 bg-[#0c0c0e] border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                        <span>// ACTIVE COLLABORATIONS ROSTER</span>
                        <span className="text-[11px] text-zinc-500">Confirmed & accepted project partnerships</span>
                    </div>

                    {activeCollaborations.total === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// ACTIVE COLLABS</span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Active Collaborations Yet</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                When you accept an applicant for your Collab or a creator accepts your application, the confirmed collaboration will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Collaborations on My Projects */}
                            {activeCollaborations.asCreator.length > 0 && (
                                <div className="space-y-2.5">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// COLLABORATORS ON YOUR PROJECTS</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeCollaborations.asCreator.map(app => (
                                            <div key={app.id} className="p-3.5 bg-[#0c0c0e] border border-emerald-900/60 space-y-2.5">
                                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">// ACTIVE COLLABORATOR</span>
                                                    <span className="text-[10px] text-zinc-500">SINCE {new Date(app.updatedAt || app.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/profile/${app.applicantId}`)}
                                                        className="w-9 h-9 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                                                        title={`View ${app.applicant?.displayName || 'collaborator'}'s Profile`}
                                                    >
                                                        {app.applicant?.photoURL ? (
                                                            <img src={app.applicant.photoURL} alt={app.applicant.displayName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="font-bold text-white text-xs">{(app.applicant?.displayName || 'C').charAt(0)}</span>
                                                        )}
                                                    </button>
                                                    <div className="min-w-0 flex-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/profile/${app.applicantId}`)}
                                                            className="font-bold text-white text-xs truncate hover:underline text-left block"
                                                        >
                                                            {app.applicant?.displayName}
                                                        </button>
                                                        <p className="text-[11px] text-zinc-400">@{app.applicant?.username}</p>
                                                        <span className="inline-block mt-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] px-2 py-0.5 font-bold">
                                                            ROLE: {app.roleTitle}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="pt-1 text-[11px] text-zinc-400">
                                                    <span className="text-zinc-500 font-bold">PROJECT:</span> "{app.collabTitle}"
                                                </div>
                                                <div className="flex justify-end pt-1 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/profile/${app.applicantId}`)}
                                                        className="text-[10px] text-zinc-300 hover:text-white underline font-bold uppercase tracking-wider"
                                                    >
                                                        // VIEW PROFILE
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedApplicant(app)}
                                                        className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-wider"
                                                    >
                                                        // DOSSIER
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Projects Where User is Collaborating */}
                            {activeCollaborations.asApplicant.length > 0 && (
                                <div className="space-y-2.5">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// PROJECTS YOU ARE COLLABORATING ON</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeCollaborations.asApplicant.map(app => (
                                            <div key={app.id} className="p-3.5 bg-[#0c0c0e] border border-emerald-900/60 space-y-2.5">
                                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">// CONFIRMED ROLE</span>
                                                    <span className="text-[10px] text-zinc-500">SINCE {new Date(app.updatedAt || app.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm uppercase tracking-wider truncate">
                                                        "{app.collabTitle}"
                                                    </h4>
                                                    <p className="text-[11px] text-zinc-400 mt-0.5">
                                                        CREATOR: {app.collabCreatorName || 'Project Lead'} • {app.collabDomain || 'Tech'}
                                                    </p>
                                                    <div className="mt-2">
                                                        <span className="bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs px-2 py-0.5 font-bold">
                                                            YOUR ROLE: {app.roleTitle}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-1">
                                                    <ReactRouterDOM.Link
                                                        to="/spotlight?tab=Collabs"
                                                        className="text-[10px] text-zinc-300 hover:text-white underline font-bold uppercase tracking-wider"
                                                    >
                                                        // VIEW COLLAB IN SPOTLIGHT
                                                    </ReactRouterDOM.Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
        </div>
    );
};
