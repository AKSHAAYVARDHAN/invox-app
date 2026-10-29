import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    subscribeUserMemberships, 
    leaveCommunity, 
    seedInitialCommunitiesIfEmpty 
} from '../../services/communityService';
import type { CommunityMembership } from '../../types';
import { CreateCommunityModal } from './CreateCommunityModal';
import { 
    UsersIcon, 
    PlusIcon, 
    ShieldCheckIcon, 
    ArrowLeftIcon,
    GlobeAltIcon,
    LockClosedIcon,
    SparklesIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

export const MyCommunitiesManager: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    const [memberships, setMemberships] = useState<CommunityMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'owned' | 'joined'>('all');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser?.uid) {
            setMemberships([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeUserMemberships(
            currentUser.uid,
            (userMemberships) => {
                setMemberships(userMemberships);
                setLoading(false);
            },
            (err) => {
                console.error('[SUBSCRIBE_MEMBERSHIPS_ERROR]', err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

    const ownedMemberships = memberships.filter(m => m.role === 'owner');
    const joinedMemberships = memberships.filter(m => m.role !== 'owner');

    const displayedMemberships = activeFilter === 'owned'
        ? ownedMemberships
        : activeFilter === 'joined'
        ? joinedMemberships
        : memberships;

    const handleLeave = async (m: CommunityMembership) => {
        if (!currentUser?.uid) return;
        if (m.role === 'owner') {
            alert("As the collective owner, you cannot leave your own community. Please transfer ownership or manage settings in the collective profile.");
            return;
        }

        const confirmLeave = window.confirm(`Leave ${m.communityName}?`);
        if (!confirmLeave) return;

        try {
            setActionLoadingId(m.id);
            await leaveCommunity(m.communityId, currentUser.uid);
        } catch (err) {
            console.error('[LEAVE_COMMUNITY_ERROR]', err);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleSeedBaseline = async () => {
        if (!currentUser) return;
        try {
            setActionLoadingId('seeding');
            await seedInitialCommunitiesIfEmpty(userProfile || currentUser);
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="space-y-6 font-mono text-xs">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0c0c0e] border border-zinc-800 p-4">
                <div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 block">
                        // COLLECTIVES_GOVERNANCE
                    </span>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mt-0.5">
                        MY COMMUNITIES & ROLES
                    </h2>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                        Manage your living collectives, leadership responsibilities, and memberships.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors shadow-sm"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>Establish Community</span>
                    </button>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-1.5">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-3 py-1 uppercase text-xs transition-colors ${
                            activeFilter === 'all'
                                ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        All Collectives ({memberships.length})
                    </button>
                    <button
                        onClick={() => setActiveFilter('owned')}
                        className={`px-3 py-1 uppercase text-xs transition-colors ${
                            activeFilter === 'owned'
                                ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        Founder / Owner ({ownedMemberships.length})
                    </button>
                    <button
                        onClick={() => setActiveFilter('joined')}
                        className={`px-3 py-1 uppercase text-xs transition-colors ${
                            activeFilter === 'joined'
                                ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        Member ({joinedMemberships.length})
                    </button>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase">
                    AUTHORIZATION_TIER: {ownedMemberships.length > 0 ? 'CREATOR/OWNER' : 'CONTRIBUTOR'}
                </span>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-[#0c0c0e] border border-zinc-800 p-4 animate-pulse h-20" />
                    ))}
                </div>
            ) : displayedMemberships.length === 0 ? (
                <div className="text-center py-16 px-4 bg-[#0c0c0e] border border-dashed border-zinc-800 space-y-4">
                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                        <UsersIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white uppercase text-xs">
                            {activeFilter === 'owned' ? 'NO OWNED COLLECTIVES' : 'NO COMMUNITY MEMBERSHIPS RECORDED'}
                        </h3>
                        <p className="text-zinc-400 text-xs mt-1 max-w-md mx-auto">
                            {activeFilter === 'owned'
                                ? 'You have not founded any living collectives yet. Establish one around a shared purpose or technical domain.'
                                : 'You have not joined any collectives yet. Browse the index to find collectives aligned with your domain.'}
                        </p>
                    </div>
                    <div className="flex justify-center gap-3 pt-2">
                        <button
                            onClick={() => navigate('/communities')}
                            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-white uppercase hover:bg-zinc-800 transition-colors"
                        >
                            Discover Collectives →
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors"
                        >
                            Establish Community
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedMemberships.map((membership) => (
                        <div
                            key={membership.id}
                            className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-4 flex flex-col justify-between transition-colors"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-3">
                                        {membership.communityAvatarUrl ? (
                                            <img
                                                src={membership.communityAvatarUrl}
                                                onError={handleImageError}
                                                alt={membership.communityName}
                                                className="w-10 h-10 border border-zinc-800 object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500">
                                                <UsersIcon className="w-5 h-5" />
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-bold text-white text-sm">
                                                {membership.communityName}
                                            </h4>
                                            <p className="text-[10px] text-zinc-500">
                                                {membership.communityCategory || 'Domain Collective'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                            membership.role === 'owner'
                                                ? 'bg-amber-950/40 text-amber-300 border-amber-800'
                                                : membership.role === 'organizer'
                                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                                                : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                                        }`}>
                                            {membership.role}
                                        </span>
                                        {membership.status === 'pending' && (
                                            <span className="text-[9px] text-amber-400 bg-amber-950/30 px-1.5 border border-amber-800/60 uppercase">
                                                PENDING_APPROVAL
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-zinc-850 my-2.5 pt-2 text-[11px] text-zinc-500 flex justify-between">
                                    <span>Joined: {membership.joinedAt ? new Date(membership.joinedAt).toLocaleDateString() : 'Active'}</span>
                                    <span>Status: <strong className="text-zinc-300 uppercase">{membership.status}</strong></span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
                                <button
                                    onClick={() => navigate(`/communities/${membership.communityId}`)}
                                    className="px-4 py-1.5 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors flex-1"
                                >
                                    Open Collective →
                                </button>
                                {membership.role !== 'owner' && (
                                    <button
                                        onClick={() => handleLeave(membership)}
                                        disabled={actionLoadingId === membership.id}
                                        className="px-3 py-1.5 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-900 uppercase transition-colors"
                                    >
                                        {actionLoadingId === membership.id ? 'Leaving...' : 'Leave'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateCommunityModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};
