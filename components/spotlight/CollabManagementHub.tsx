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
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface CollabManagementHubProps {
    userCollabs: Post[];
    onEditCollab: (collab: Post) => void;
    onDeleteCollab: (collabId: string) => void;
    onCreateCollab: () => void;
    deletingId: string | null;
}

export const CollabManagementHub: React.FC<CollabManagementHubProps> = ({
    userCollabs,
    onEditCollab,
    onDeleteCollab,
    onCreateCollab,
    deletingId,
}) => {
    const { currentUser } = useAuth();
    const [subTab, setSubTab] = useState<'applications' | 'my_applications' | 'active' | 'published'>('applications');
    const [creatorApplications, setCreatorApplications] = useState<CollabApplication[]>([]);
    const [myApplications, setMyApplications] = useState<CollabApplication[]>([]);
    const [loadingCreatorApps, setLoadingCreatorApps] = useState(true);
    const [loadingMyApps, setLoadingMyApps] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [selectedApplicant, setSelectedApplicant] = useState<CollabApplication | null>(null);
    const [activeMenuCollabId, setActiveMenuCollabId] = useState<string | null>(null);
    const [expandedCollabIds, setExpandedCollabIds] = useState<Set<string>>(new Set());
    const [filterCollabId, setFilterCollabId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');

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
                        <span><span className="font-bold">// STATUS_UPDATE:</span> {actionSuccess}</span>
                    </div>
                    <button onClick={() => setActionSuccess(null)} className="text-zinc-500 hover:text-white">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Sub-Tabs Navigation */}
            <div className="border border-zinc-800 bg-[#0c0c0e] p-1 flex flex-wrap gap-1">
                <button
                    onClick={() => setSubTab('applications')}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                        subTab === 'applications'
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                    }`}
                >
                    <span>// COLLAB_APPLICATIONS</span>
                    {pendingCreatorAppsCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-bold ${
                            subTab === 'applications' ? 'bg-black text-amber-400' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}>
                            {pendingCreatorAppsCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setSubTab('my_applications')}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                        subTab === 'my_applications'
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                    }`}
                >
                    <span>// MY_APPLICATIONS</span>
                    {pendingMyAppsCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-bold ${
                            subTab === 'my_applications' ? 'bg-black text-amber-400' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}>
                            {pendingMyAppsCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setSubTab('active')}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                        subTab === 'active'
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                    }`}
                >
                    <span>// ACTIVE_COLLABORATIONS</span>
                    {activeCollaborations.total > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-bold ${
                            subTab === 'active' ? 'bg-black text-emerald-400' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}>
                            {activeCollaborations.total}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setSubTab('published')}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                        subTab === 'published'
                            ? 'bg-white text-black border-white font-bold'
                            : 'bg-black/50 text-zinc-400 border-zinc-850 hover:border-zinc-700 hover:text-white'
                    }`}
                >
                    <span>// PUBLISHED_COLLABS</span>
                    <span className="text-[10px] text-zinc-500">({userCollabs.length})</span>
                </button>
            </div>

            {/* TAB 1: COLLAB_APPLICATIONS (Creator Side) */}
            {subTab === 'applications' && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0c0c0e] border border-zinc-800 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-zinc-500 uppercase text-[10px] tracking-wider">// FILTER_COLLAB:</span>
                            <select
                                value={filterCollabId}
                                onChange={(e) => setFilterCollabId(e.target.value)}
                                className="bg-black border border-zinc-750 text-xs text-white px-2.5 py-1 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="all">All Projects ({creatorApplications.length})</option>
                                {userCollabs.map(collab => {
                                    const count = creatorApplications.filter(a => a.collabId === collab.id).length;
                                    return (
                                        <option key={collab.id} value={collab.id}>
                                            {collab.aiSummary || collab.oneLine || 'Collab'} ({count})
                                        </option>
                                    );
                                })}
                            </select>

                            <span className="text-zinc-500 uppercase text-[10px] tracking-wider ml-2">// STATUS:</span>
                            <div className="flex items-center gap-1">
                                {(['ALL', 'PENDING', 'ACCEPTED', 'DECLINED'] as const).map(st => (
                                    <button
                                        key={st}
                                        onClick={() => setStatusFilter(st)}
                                        className={`px-2 py-0.5 text-[10px] uppercase border transition-all ${
                                            statusFilter === st
                                                ? 'bg-white text-black border-white font-bold'
                                                : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        {st}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="text-[11px] text-zinc-400">
                            Showing <span className="text-white font-bold">{filteredCreatorApps.length}</span> applications
                        </div>
                    </div>

                    {/* Applications List */}
                    {loadingCreatorApps ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING_APPLICATIONS...</p>
                        </div>
                    ) : filteredCreatorApps.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// COLLAB_APPLICATIONS</span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Applications Found</h3>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                {userCollabs.length === 0
                                    ? "You haven't published any Collab projects yet. Create a Collab to invite talent and build together."
                                    : "No incoming applications match your active filter. Check back when community members apply for your roles."}
                            </p>
                            {userCollabs.length === 0 && (
                                <div className="pt-3">
                                    <button
                                        onClick={onCreateCollab}
                                        className="bg-white text-black hover:bg-zinc-200 px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all"
                                    >
                                        // CREATE COLLAB
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredCreatorApps.map((app) => {
                                const targetCollab = userCollabs.find(c => c.id === app.collabId);
                                const rawRoles = targetCollab?.collabDetails?.roles || [];
                                const role = rawRoles.find(r => r.id === app.roleId);
                                const roleCapacity = role ? getRoleCapacity(role, creatorApplications) : null;
                                const isFilled = Boolean(roleCapacity?.isFilled);
                                const isActionLoading = actionLoadingId === app.id;

                                return (
                                    <div
                                        key={app.id}
                                        className="p-4 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 relative"
                                    >
                                        {/* Collab Reference Banner */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-850">
                                            <div>
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// PROJECT_TARGET</span>
                                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                                    "{app.collabTitle}"
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500">
                                                    APPLIED: {new Date(app.createdAt).toLocaleDateString()}
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

                                        {/* Applicant Card & Role */}
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            {/* Left: Applicant details */}
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className="w-10 h-10 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                                                    {app.applicant?.photoURL ? (
                                                        <img
                                                            src={app.applicant.photoURL}
                                                            alt={app.applicant.displayName}
                                                            className="w-full h-full object-cover"
                                                            onError={handleImageError}
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-white text-xs">
                                                            {(app.applicant?.displayName || 'A').charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-bold text-white text-sm">
                                                            {app.applicant?.displayName}
                                                        </span>
                                                        <span className="text-zinc-500 text-xs">
                                                            @{app.applicant?.username}
                                                        </span>
                                                        {app.applicant?.location && (
                                                            <span className="text-[10px] text-zinc-500">
                                                                • {app.applicant.location}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {app.applicant?.headline && (
                                                        <p className="text-xs text-zinc-400 line-clamp-1">{app.applicant.headline}</p>
                                                    )}

                                                    {/* Target Role & Capacity Info */}
                                                    <div className="pt-1 flex flex-wrap items-center gap-2">
                                                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-xs text-white font-bold">
                                                            ROLE: {app.roleTitle}
                                                        </span>
                                                        {roleCapacity && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 border ${
                                                                isFilled 
                                                                    ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                                                    : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/80'
                                                            }`}>
                                                                {isFilled ? '// FILLED' : `${roleCapacity.remaining} of ${roleCapacity.total} open`}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Skills */}
                                                    {app.applicant?.skills && app.applicant.skills.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 pt-1.5">
                                                            {app.applicant.skills.map((sk, idx) => (
                                                                <span key={idx} className="text-[10px] bg-black border border-zinc-800 text-zinc-300 px-1.5 py-0.5">
                                                                    {sk}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex flex-row md:flex-col items-center md:items-end gap-2 flex-shrink-0 pt-2 md:pt-0">
                                                <button
                                                    onClick={() => setSelectedApplicant(app)}
                                                    className="px-3 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs uppercase tracking-wider transition-colors w-full md:w-auto text-center"
                                                >
                                                    // VIEW PROFILE
                                                </button>

                                                {app.status === 'PENDING' && (
                                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                                        <button
                                                            onClick={() => handleAccept(app)}
                                                            disabled={isActionLoading || isFilled}
                                                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-emerald-800 hover:border-emerald-600 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-1 md:flex-none"
                                                            title={isFilled ? 'Role is already filled' : 'Accept Applicant'}
                                                        >
                                                            {isActionLoading ? '...' : '// ACCEPT'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDecline(app)}
                                                            disabled={isActionLoading}
                                                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-40 flex-1 md:flex-none"
                                                            title="Decline Applicant"
                                                        >
                                                            {isActionLoading ? '...' : '// DECLINE'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Application Message */}
                                        {app.message && (
                                            <div className="p-3 bg-black border border-zinc-850 text-xs text-zinc-300 space-y-1">
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// WHY_YOU?</span>
                                                <p className="leading-relaxed whitespace-pre-wrap">{app.message}</p>
                                            </div>
                                        )}

                                        {/* Supporting Document */}
                                        {app.supportingDocument?.url && (
                                            <div className="p-3 bg-black border border-zinc-850 space-y-2">
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// SUPPORTING_DOCUMENT</span>
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-200">
                                                        <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        <span className="truncate max-w-xs">{app.supportingDocument.name}</span>
                                                    </div>
                                                    <a
                                                        href={app.supportingDocument.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[11px] font-mono text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-2.5 py-1 uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                                                    >
                                                        // VIEW_DOCUMENT
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

            {/* TAB 2: MY_APPLICATIONS (Applicant Side) */}
            {subTab === 'my_applications' && (
                <div className="space-y-4">
                    {loadingMyApps ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING_MY_APPLICATIONS...</p>
                        </div>
                    ) : myApplications.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// MY_APPLICATIONS</span>
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
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// TARGET_PROJECT</span>
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
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// YOUR_MESSAGE</span>
                                                <p className="leading-relaxed">{app.message}</p>
                                            </div>
                                        )}

                                        {/* Attached Document */}
                                        {app.supportingDocument?.url && (
                                            <div className="p-2.5 bg-black border border-zinc-850 text-xs text-zinc-400">
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// ATTACHED_DOCUMENT</span>
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
                                                        // VIEW_DOCUMENT
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

            {/* TAB 3: ACTIVE_COLLABORATIONS */}
            {subTab === 'active' && (
                <div className="space-y-4">
                    <div className="p-3 bg-[#0c0c0e] border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                        <span>// ACTIVE_COLLABORATIONS_ROSTER</span>
                        <span className="text-[11px] text-zinc-500">Confirmed & accepted project partnerships</span>
                    </div>

                    {activeCollaborations.total === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// ACTIVE_COLLABORATIONS</span>
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
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// COLLABORATORS_ON_YOUR_PROJECTS</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeCollaborations.asCreator.map(app => (
                                            <div key={app.id} className="p-3.5 bg-[#0c0c0e] border border-emerald-900/60 space-y-2.5">
                                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">// ACTIVE_COLLABORATOR</span>
                                                    <span className="text-[10px] text-zinc-500">SINCE {new Date(app.updatedAt || app.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                                                        {app.applicant?.photoURL ? (
                                                            <img src={app.applicant.photoURL} alt={app.applicant.displayName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="font-bold text-white text-xs">{(app.applicant?.displayName || 'C').charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-bold text-white text-xs truncate">{app.applicant?.displayName}</h4>
                                                        <p className="text-[11px] text-zinc-400">@{app.applicant?.username}</p>
                                                        <span className="inline-block mt-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] px-2 py-0.5 font-bold">
                                                            ROLE: {app.roleTitle}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="pt-1 text-[11px] text-zinc-400">
                                                    <span className="text-zinc-500 font-bold">PROJECT:</span> "{app.collabTitle}"
                                                </div>
                                                <div className="flex justify-end pt-1">
                                                    <button
                                                        onClick={() => setSelectedApplicant(app)}
                                                        className="text-[10px] text-zinc-300 hover:text-white underline font-bold uppercase tracking-wider"
                                                    >
                                                        // VIEW DETAILS
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
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// PROJECTS_YOU_ARE_COLLABORATING_ON</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeCollaborations.asApplicant.map(app => (
                                            <div key={app.id} className="p-3.5 bg-[#0c0c0e] border border-emerald-900/60 space-y-2.5">
                                                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">// CONFIRMED_ROLE</span>
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

            {/* TAB 4: PUBLISHED_COLLABS (Existing creator collabs with EDIT & DELETE) */}
            {subTab === 'published' && (
                <div className="space-y-4">
                    {userCollabs.length === 0 ? (
                        <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e] space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// PUBLISHED_COLLABS</span>
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
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">// COLLAB_SIGNAL</span>
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
                                                            className="absolute right-0 mt-1 w-36 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuCollabId(null);
                                                                    onEditCollab(item);
                                                                }}
                                                                className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-zinc-900 uppercase tracking-wider flex items-center gap-2"
                                                            >
                                                                <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                                <span>// EDIT</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setActiveMenuCollabId(null);
                                                                    onDeleteCollab(item.id);
                                                                }}
                                                                disabled={deletingId === item.id}
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
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// THE_HOOK</span>
                                                <h4 className="text-sm font-bold text-white leading-snug uppercase tracking-wider">
                                                    "{item.aiSummary || item.oneLine}"
                                                </h4>
                                            </div>

                                            {/* Project Overview */}
                                            <div>
                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// PROJECT_OVERVIEW</span>
                                                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{item.content}</p>
                                            </div>

                                            {/* Roles Breakdown with live counts */}
                                            {item.collabDetails && (
                                                <div className="p-3 bg-black/60 border border-zinc-800/80 space-y-2.5 text-xs">
                                                    {item.collabDetails.roles && item.collabDetails.roles.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// ROLES_OFFERED</span>
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
                                                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// PROJECT_STATUS</span>
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

                                            {/* Applications Shortcut Button */}
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => {
                                                        setFilterCollabId(item.id);
                                                        setSubTab('applications');
                                                    }}
                                                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white text-xs font-bold py-2 px-3 uppercase tracking-wider flex items-center justify-between transition-colors"
                                                >
                                                    <span>// VIEW APPLICATIONS</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 ${
                                                        pendingCount > 0 ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-black text-zinc-400'
                                                    }`}>
                                                        {incomingApps.length} TOTAL ({pendingCount} PENDING)
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Applicant Profile Detail Modal */}
            {selectedApplicant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
                    <div 
                        className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg max-h-[90vh] flex flex-col font-mono text-zinc-300 shadow-2xl animate-fadeIn my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block">// APPLICANT_DOSSIER</span>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mt-0.5">
                                    {selectedApplicant.applicant?.displayName}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedApplicant(null)}
                                className="text-zinc-500 hover:text-white p-1 transition-colors"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                            {/* Profile Snapshot */}
                            <div className="flex items-start gap-3 p-3 bg-black border border-zinc-850">
                                <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                                    {selectedApplicant.applicant?.photoURL ? (
                                        <img
                                            src={selectedApplicant.applicant.photoURL}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                            onError={handleImageError}
                                        />
                                    ) : (
                                        <span className="font-bold text-white text-sm">
                                            {(selectedApplicant.applicant?.displayName || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">
                                            {selectedApplicant.applicant?.displayName}
                                        </span>
                                        <span className="text-zinc-500 text-xs">
                                            @{selectedApplicant.applicant?.username}
                                        </span>
                                    </div>
                                    {selectedApplicant.applicant?.headline && (
                                        <p className="text-xs text-zinc-300">{selectedApplicant.applicant.headline}</p>
                                    )}
                                    {selectedApplicant.applicant?.location && (
                                        <p className="text-[11px] text-zinc-500">{selectedApplicant.applicant.location}</p>
                                    )}
                                </div>
                            </div>

                            {/* Applied Role & Status */}
                            <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-950 border border-zinc-850">
                                <div>
                                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// APPLIED_ROLE</span>
                                    <span className="font-bold text-white text-xs">{selectedApplicant.roleTitle}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// STATUS</span>
                                    <span className={`font-bold text-xs uppercase ${
                                        selectedApplicant.status === 'ACCEPTED' ? 'text-emerald-400' :
                                        selectedApplicant.status === 'PENDING' ? 'text-amber-400' : 'text-zinc-500'
                                    }`}>
                                        // {selectedApplicant.status}
                                    </span>
                                </div>
                            </div>

                            {/* Bio / Experience */}
                            {selectedApplicant.applicant?.bio && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// BIOGRAPHY</span>
                                    <p className="p-3 bg-black border border-zinc-850 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                        {selectedApplicant.applicant.bio}
                                    </p>
                                </div>
                            )}

                            {/* Skills */}
                            {selectedApplicant.applicant?.skills && selectedApplicant.applicant.skills.length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// VERIFIED_SKILLS</span>
                                    <div className="flex flex-wrap gap-1.5 p-3 bg-black border border-zinc-850">
                                        {selectedApplicant.applicant.skills.map((sk, idx) => (
                                            <span key={idx} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5">
                                                {sk}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Application Message */}
                            {selectedApplicant.message && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// WHY_YOU?_MESSAGE</span>
                                    <p className="p-3 bg-black border border-zinc-850 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                        {selectedApplicant.message}
                                    </p>
                                </div>
                            )}

                            {/* Portfolio / Links */}
                            {(selectedApplicant.applicant?.portfolioURL || selectedApplicant.applicant?.website) && (
                                <div className="p-3 bg-black border border-zinc-850 text-xs space-y-1">
                                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">// SHOWCASE_PORTFOLIO</span>
                                    <a
                                        href={selectedApplicant.applicant.portfolioURL || selectedApplicant.applicant.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white underline hover:text-zinc-300 break-all"
                                    >
                                        {selectedApplicant.applicant.portfolioURL || selectedApplicant.applicant.website}
                                    </a>
                                </div>
                            )}

                            {/* Supporting Document */}
                            {selectedApplicant.supportingDocument?.url && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// SUPPORTING_DOCUMENT</span>
                                    <div className="p-3 bg-black border border-zinc-850 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-200">
                                            <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="truncate max-w-xs">{selectedApplicant.supportingDocument.name}</span>
                                        </div>
                                        <a
                                            href={selectedApplicant.supportingDocument.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-mono text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-2.5 py-1 uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                                        >
                                            // VIEW_DOCUMENT
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-zinc-800 bg-black flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setSelectedApplicant(null)}
                                className="px-4 py-2 bg-transparent text-zinc-400 hover:text-white border border-zinc-800 text-xs uppercase"
                            >
                                CLOSE
                            </button>

                            {selectedApplicant.status === 'PENDING' && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleAccept(selectedApplicant);
                                            setSelectedApplicant(null);
                                        }}
                                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-800 text-xs font-bold uppercase"
                                    >
                                        // ACCEPT APPLICANT
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDecline(selectedApplicant);
                                            setSelectedApplicant(null);
                                        }}
                                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 text-xs uppercase"
                                    >
                                        // DECLINE
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
