import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
    subscribeUserOwnedCommunities,
    deleteCommunity 
} from '../../services/communityService';
import type { Community } from '../../types';
import { CreateCommunityModal } from './CreateCommunityModal';
import { EditCollectiveIdentityModal } from './EditCollectiveIdentityModal';
import { 
    UsersIcon, 
    PlusIcon, 
    PencilSquareIcon,
    TrashIcon,
    ShieldCheckIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

export const MyCommunitiesManager: React.FC = () => {
    const { currentUser } = useAuth();

    const [ownedCommunities, setOwnedCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
    const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Reliable stats computed directly from verified owned communities
    const totalMembers = useMemo(() => {
        return ownedCommunities.reduce((acc, curr) => {
            return acc + (curr.members || (curr as any).memberCount || 1);
        }, 0);
    }, [ownedCommunities]);

    // Listen exclusively to communities owned by the authenticated user
    useEffect(() => {
        if (!currentUser?.uid) {
            setOwnedCommunities([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeUserOwnedCommunities(
            currentUser.uid,
            (communities) => {
                setOwnedCommunities(communities);
                setLoading(false);
            },
            (err) => {
                console.error('[SUBSCRIBE_OWNED_COMMUNITIES_ERROR]', err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    const handleOpenIdentityEditor = async (community: Community) => {
        try {
            setActionLoadingId(community.id);
            const ref = doc(db, 'communities', community.id);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setEditingCommunity({ id: snap.id, ...(snap.data() as any) });
            } else {
                setEditingCommunity(community);
            }
            setIsIdentityModalOpen(true);
        } catch (e) {
            console.warn('[LOAD_COMMUNITY_FOR_IDENTITY_EDIT_WARN]', e);
            setEditingCommunity(community);
            setIsIdentityModalOpen(true);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteCommunity = async (community: Community) => {
        if (!currentUser?.uid) return;

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete "${community.name}"?\n\nThis action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            setActionLoadingId(community.id);
            const result = await deleteCommunity(community.id, currentUser.uid);
            if (result.success) {
                setFeedbackMessage({ text: `Community "${community.name}" was successfully deleted.`, type: 'success' });
            } else {
                setFeedbackMessage({ text: result.error || 'Failed to delete community', type: 'error' });
            }
        } catch (err: any) {
            setFeedbackMessage({ text: err?.message || 'Error deleting community', type: 'error' });
        } finally {
            setActionLoadingId(null);
            setTimeout(() => setFeedbackMessage(null), 5000);
        }
    };

    return (
        <div className="space-y-6 font-mono text-xs">
            {/* Workspace Overview Header */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
                                // WORKSPACE
                            </span>
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight mt-1">
                            COMMUNITY MANAGER
                        </h1>
                        <p className="text-zinc-400 text-xs mt-1">
                            Create, own and manage your communities.
                        </p>
                    </div>

                    <div className="flex items-center">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold uppercase transition-colors text-xs font-mono tracking-wider shadow-sm cursor-pointer"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>ESTABLISH COMMUNITY</span>
                        </button>
                    </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-850">
                    <div className="bg-black/60 border border-zinc-850 p-3">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                            OWNED COMMUNITIES
                        </span>
                        <span className="text-xl font-bold text-white font-mono mt-0.5 block">
                            {ownedCommunities.length}
                        </span>
                    </div>
                    <div className="bg-black/60 border border-zinc-850 p-3">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                            TOTAL NETWORK MEMBERS
                        </span>
                        <span className="text-xl font-bold text-white font-mono mt-0.5 block">
                            {totalMembers}
                        </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 bg-black/60 border border-zinc-850 p-3">
                        <span className="block text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                            GOVERNANCE STATUS
                        </span>
                        <span className="text-xs font-bold text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                            SOVEREIGN / VERIFIED
                        </span>
                    </div>
                </div>
            </div>

            {/* Notification Banner */}
            {feedbackMessage && (
                <div className={`p-3 border text-xs flex items-center justify-between ${
                    feedbackMessage.type === 'success' 
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}>
                    <span>{feedbackMessage.text}</span>
                    <button 
                        onClick={() => setFeedbackMessage(null)}
                        className="text-zinc-400 hover:text-white uppercase text-[10px] ml-4 font-bold"
                    >
                        [CLOSE]
                    </button>
                </div>
            )}

            {/* Content Section: Owned Communities Grid */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-[#0c0c0e] border border-zinc-800 p-6 animate-pulse h-32" />
                    ))}
                </div>
            ) : ownedCommunities.length === 0 ? (
                /* Compact Empty State */
                <div className="text-center py-10 px-6 bg-[#0c0c0e] border border-dashed border-zinc-800 space-y-3.5">
                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                        <UsersIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-bold text-white uppercase text-xs tracking-wider">
                            NO OWNED COMMUNITIES FOUND
                        </h3>
                        <p className="text-zinc-400 text-xs max-w-md mx-auto leading-relaxed">
                            You have not established any communities yet. Create and govern your own collective around a shared purpose, technical domain, or creative discipline.
                        </p>
                    </div>
                    <div className="pt-1">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors text-xs font-mono shadow-sm cursor-pointer"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>ESTABLISH COMMUNITY</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* Owned Communities List */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {ownedCommunities.map((community) => (
                        <div
                            key={community.id}
                            className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-4 flex flex-col justify-between transition-colors space-y-4"
                        >
                            <div className="space-y-3">
                                {/* Community Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {community.avatarUrl ? (
                                            <img
                                                src={community.avatarUrl}
                                                onError={handleImageError}
                                                alt={community.name}
                                                className="w-11 h-11 border border-zinc-800 object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-11 h-11 bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                                                <UsersIcon className="w-6 h-6" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-white text-sm truncate">
                                                {community.name}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                                                {community.handle && <span>@{community.handle}</span>}
                                                <span>•</span>
                                                <span className="text-zinc-400 uppercase font-medium">{community.category || 'General'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ownership Badge */}
                                    <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border bg-amber-950/40 text-amber-300 border-amber-800 flex-shrink-0 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                        VERIFIED OWNER
                                    </span>
                                </div>

                                {/* Community Description */}
                                <p className="text-zinc-300 text-xs line-clamp-2 leading-relaxed">
                                    {community.description || 'No description provided.'}
                                </p>

                                {/* Collective Identity Sneak Peek */}
                                {(community.purpose || community.mission) && (
                                    <div className="bg-zinc-950/80 border border-zinc-850 p-2.5 text-[11px] space-y-1">
                                        {community.purpose && (
                                            <div className="text-zinc-400 truncate">
                                                <strong className="text-zinc-300 uppercase">Purpose:</strong> {community.purpose}
                                            </div>
                                        )}
                                        {community.mission && (
                                            <div className="text-zinc-400 truncate">
                                                <strong className="text-zinc-300 uppercase">Mission:</strong> {community.mission}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Telemetry & Governance Metrics */}
                                <div className="border-t border-zinc-850 pt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-zinc-500">
                                    <div>
                                        <span className="block uppercase text-[9px] text-zinc-600">MEMBERS</span>
                                        <strong className="text-zinc-200">{community.members || community.memberCount || 1}</strong>
                                    </div>
                                    <div>
                                        <span className="block uppercase text-[9px] text-zinc-600">RATING</span>
                                        <strong className="text-zinc-200">{(community.rating || 5.0).toFixed(1)}</strong>
                                    </div>
                                    <div>
                                        <span className="block uppercase text-[9px] text-zinc-600">VISIBILITY</span>
                                        <strong className="text-zinc-200 uppercase">{community.visibility || 'public'}</strong>
                                    </div>
                                    <div>
                                        <span className="block uppercase text-[9px] text-zinc-600">ADMINISTRATORS</span>
                                        <strong className="text-zinc-200">{community.adminIds?.length || 0}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Management Actions Toolbar */}
                            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                <button
                                    onClick={() => handleOpenIdentityEditor(community)}
                                    disabled={actionLoadingId === community.id}
                                    className="px-3.5 py-2 border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold uppercase transition-colors text-xs flex items-center justify-center gap-1.5 flex-1 whitespace-nowrap shadow-sm"
                                    title="Manage Collective Identity (Purpose, Values, Story, Guidelines)"
                                >
                                    <PencilSquareIcon className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Manage Identity</span>
                                </button>

                                <button
                                    onClick={() => handleDeleteCommunity(community)}
                                    disabled={actionLoadingId === community.id}
                                    className="px-3 py-2 border border-zinc-850 bg-black hover:border-rose-900 hover:bg-rose-950/30 text-zinc-400 hover:text-rose-400 uppercase transition-colors text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                                    title="Delete Community"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                    <span>{actionLoadingId === community.id ? 'Deleting...' : 'Delete'}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Establish Community Modal */}
            <CreateCommunityModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            {/* Edit Collective Modal (Unified 6-Step Workflow in Edit Mode) */}
            {editingCommunity && (
                <CreateCommunityModal
                    isOpen={isIdentityModalOpen}
                    onClose={() => {
                        setIsIdentityModalOpen(false);
                        setEditingCommunity(null);
                    }}
                    community={editingCommunity}
                    mode="edit"
                    onUpdated={(updated) => {
                        setOwnedCommunities(prev => prev.map(c => c.id === updated.id ? updated : c));
                        setFeedbackMessage({
                            text: `Collective "${updated.name}" configuration updated successfully.`,
                            type: 'success',
                        });
                    }}
                />
            )}
        </div>
    );
};
