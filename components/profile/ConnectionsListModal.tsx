import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeUserRelationships,
    subscribeUserConnections,
    subscribeUserFollowers,
    subscribeUserFollowing,
    connectWithUser,
    disconnectFromUser,
    type UserRelationshipCounts,
} from '../../services/connectionService';
import type { InvoxUser } from '../../types';
import { CloseIcon, ProfileIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

export type RelationshipTab = 'connections' | 'following' | 'followers';

interface ConnectionsListModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUserId: string;
    targetUserName?: string;
    initialTab?: RelationshipTab;
}

export const ConnectionsListModal: React.FC<ConnectionsListModalProps> = ({
    isOpen,
    onClose,
    targetUserId,
    targetUserName = 'Member',
    initialTab = 'connections',
}) => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [activeTab, setActiveTab] = useState<RelationshipTab>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');

    const [counts, setCounts] = useState<UserRelationshipCounts>({
        followingCount: 0,
        followerCount: 0,
        connectionCount: 0,
        followingIds: new Set<string>(),
        followerIds: new Set<string>(),
        connectionIds: new Set<string>(),
    });

    const [connectionsList, setConnectionsList] = useState<InvoxUser[]>([]);
    const [followersList, setFollowersList] = useState<InvoxUser[]>([]);
    const [followingList, setFollowingList] = useState<InvoxUser[]>([]);

    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [togglingUid, setTogglingUid] = useState<string | null>(null);

    // Sync tab when opening or initialTab changes
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setSearchQuery('');
        }
    }, [isOpen, initialTab]);

    // Close on ESC key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Real-time listener for relationship counts
    useEffect(() => {
        if (!isOpen || !targetUserId) return;

        const unsubscribe = subscribeUserRelationships(
            targetUserId,
            (newCounts) => {
                setCounts(newCounts);
            },
            (err) => {
                console.error('[RELATIONSHIP_COUNTS_ERROR]', err);
            }
        );

        return () => unsubscribe();
    }, [isOpen, targetUserId]);

    // Real-time listener for active tab profiles
    useEffect(() => {
        if (!isOpen || !targetUserId) return;
        setLoadingProfiles(true);

        let unsubscribe: (() => void) | undefined;

        if (activeTab === 'connections') {
            unsubscribe = subscribeUserConnections(
                targetUserId,
                (profiles) => {
                    setConnectionsList(profiles);
                    setLoadingProfiles(false);
                },
                () => setLoadingProfiles(false)
            );
        } else if (activeTab === 'followers') {
            unsubscribe = subscribeUserFollowers(
                targetUserId,
                (profiles) => {
                    setFollowersList(profiles);
                    setLoadingProfiles(false);
                },
                () => setLoadingProfiles(false)
            );
        } else {
            unsubscribe = subscribeUserFollowing(
                targetUserId,
                (profiles) => {
                    setFollowingList(profiles);
                    setLoadingProfiles(false);
                },
                () => setLoadingProfiles(false)
            );
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isOpen, targetUserId, activeTab]);

    const activeList = useMemo(() => {
        if (activeTab === 'connections') return connectionsList;
        if (activeTab === 'followers') return followersList;
        return followingList;
    }, [activeTab, connectionsList, followersList, followingList]);

    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return activeList;
        return activeList.filter((u) => {
            const name = (u.displayName || '').toLowerCase();
            const username = (u.username || '').toLowerCase();
            const headline = (u.headline || '').toLowerCase();
            return name.includes(q) || username.includes(q) || headline.includes(q);
        });
    }, [activeList, searchQuery]);

    const handleProfileClick = (user: InvoxUser) => {
        onClose();
        const path = user.username ? `/profile/@${user.username}` : `/profile/${user.uid}`;
        navigate(path);
    };

    const handleToggleFollow = async (e: React.MouseEvent, user: InvoxUser) => {
        e.stopPropagation();
        if (!currentUser?.uid || user.uid === currentUser.uid || togglingUid === user.uid) return;

        setTogglingUid(user.uid);
        try {
            const currentlyFollowing = counts.followingIds.has(user.uid);
            if (currentlyFollowing) {
                await disconnectFromUser(currentUser.uid, user.uid);
            } else {
                await connectWithUser({
                    currentUser,
                    currentUserProfile: userProfile,
                    targetUserId: user.uid,
                });
            }
        } catch (err) {
            console.error('[TOGGLE_FOLLOW_ERROR]', err);
        } finally {
            setTogglingUid(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            {/* Modal Container */}
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg flex flex-col max-h-[85vh] shadow-2xl font-mono text-zinc-300">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                            // NETWORK_RELATIONSHIPS
                        </span>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                            {targetUserName}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                        title="Close"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="grid grid-cols-3 border-b border-zinc-800 bg-[#09090b] text-xs">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('connections');
                            setSearchQuery('');
                        }}
                        className={`py-3 px-2 text-center transition-colors border-b-2 font-bold uppercase tracking-wider ${
                            activeTab === 'connections'
                                ? 'border-emerald-500 text-white bg-[#121315]'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                        }`}
                    >
                        Connections <span className="ml-1 text-[11px] text-emerald-400">({counts.connectionCount})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('following');
                            setSearchQuery('');
                        }}
                        className={`py-3 px-2 text-center transition-colors border-b-2 font-bold uppercase tracking-wider ${
                            activeTab === 'following'
                                ? 'border-white text-white bg-[#121315]'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                        }`}
                    >
                        Following <span className="ml-1 text-[11px] text-zinc-400">({counts.followingCount})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('followers');
                            setSearchQuery('');
                        }}
                        className={`py-3 px-2 text-center transition-colors border-b-2 font-bold uppercase tracking-wider ${
                            activeTab === 'followers'
                                ? 'border-white text-white bg-[#121315]'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                        }`}
                    >
                        Followers <span className="ml-1 text-[11px] text-zinc-400">({counts.followerCount})</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-zinc-800 bg-[#09090b]">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`// SEARCH_${activeTab.toUpperCase()}...`}
                            className="w-full bg-[#121315] border border-zinc-800 p-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Profiles List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-900/80">
                    {loadingProfiles ? (
                        <div className="p-8 text-center text-zinc-500 text-xs">
                            <span className="block animate-pulse">// LOADING_NETWORK_DATA...</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-xs">
                            {searchQuery ? (
                                <>
                                    <div className="font-bold text-zinc-400 mb-1 tracking-wider uppercase">
                                        // NO_MATCHES_FOUND
                                    </div>
                                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                                        No {activeTab} match &ldquo;{searchQuery}&rdquo;.
                                    </p>
                                </>
                            ) : activeTab === 'connections' ? (
                                <>
                                    <div className="font-bold text-zinc-400 mb-1 tracking-wider uppercase">
                                        // NO_CONNECTIONS_YET
                                    </div>
                                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                                        A connection is formed when two members mutually follow each other.
                                        Follow creators back to establish mutual connection.
                                    </p>
                                </>
                            ) : activeTab === 'following' ? (
                                <>
                                    <div className="font-bold text-zinc-400 mb-1 tracking-wider uppercase">
                                        // NOT_FOLLOWING_ANYONE
                                    </div>
                                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                                        This user is not currently following any creators.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="font-bold text-zinc-400 mb-1 tracking-wider uppercase">
                                        // NO_FOLLOWERS_YET
                                    </div>
                                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                                        This user does not have any followers yet.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        filteredUsers.map((user) => {
                            const isCurrentUser = currentUser?.uid === user.uid;
                            const isMutual = counts.connectionIds.has(user.uid);

                            return (
                                <div
                                    key={user.uid}
                                    onClick={() => handleProfileClick(user)}
                                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-zinc-900/70 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer group"
                                >
                                    {/* User Avatar + Info */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {user.photoURL ? (
                                                <img
                                                    src={user.photoURL}
                                                    alt={user.displayName || 'Member'}
                                                    onError={handleImageError}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ProfileIcon className="w-5 h-5 text-zinc-600" />
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-xs text-white truncate group-hover:text-emerald-400 transition-colors">
                                                    {user.displayName || 'Invox Member'}
                                                </span>
                                                {isMutual && (
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 uppercase tracking-widest font-bold">
                                                        Mutual
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-500 truncate">
                                                @{user.username || 'member'}
                                            </p>
                                            {user.headline && (
                                                <p className="text-[10px] text-zinc-400 truncate mt-0.5 max-w-xs">
                                                    {user.headline}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {!isCurrentUser && currentUser && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleToggleFollow(e, user)}
                                                disabled={togglingUid === user.uid}
                                                className={`text-[10px] uppercase tracking-wider px-2.5 py-1 border font-bold transition-colors ${
                                                    counts.followingIds.has(user.uid)
                                                        ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-rose-700 hover:text-rose-400 hover:bg-rose-950/30'
                                                        : 'bg-white text-black border-white hover:bg-zinc-200'
                                                }`}
                                            >
                                                {togglingUid === user.uid
                                                    ? '...'
                                                    : counts.followingIds.has(user.uid)
                                                    ? 'Following'
                                                    : 'Follow'}
                                            </button>
                                        )}
                                        <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-xs">
                                            →
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between text-[11px] text-zinc-500">
                    <span>// {counts.connectionCount} MUTUAL CONNECTIONS</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
                    >
                        // CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
};
