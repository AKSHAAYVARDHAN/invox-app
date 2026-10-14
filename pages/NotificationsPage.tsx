import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { formatRelativeTime } from '../utils/dateUtils';
import { handleImageError } from '../components/utils/imageUtils';
import {
    BellIcon,
    ChatBubbleBottomCenterTextIcon,
    UsersIcon,
    BriefcaseIcon,
    ProfileIcon,
    CheckIcon,
    TrashIcon,
    GlobeAltIcon,
    SparklesIcon,
    ArrowLeftIcon,
    ArrowUpIcon,
} from '../components/ui/Icons';
import type { InvoxNotification } from '../types';

export const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
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
    } = useNotifications();

    const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MESSAGES' | 'TEAMS' | 'COLLABS' | 'CONNECTIONS'>('ALL');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Filter notifications by category in memory
    const displayedNotifications = useMemo(() => {
        let list = notifications;

        if (filter === 'unread') {
            list = list.filter((n) => !n.read);
        }

        if (categoryFilter === 'MESSAGES') {
            list = list.filter((n) =>
                n.type.includes('message') || n.targetType === 'message'
            );
        } else if (categoryFilter === 'TEAMS') {
            list = list.filter((n) =>
                n.type.includes('team') || n.targetType === 'team'
            );
        } else if (categoryFilter === 'COLLABS') {
            list = list.filter((n) =>
                n.type.includes('collab') || n.targetType === 'application' || n.targetType === 'collab'
            );
        } else if (categoryFilter === 'CONNECTIONS') {
            list = list.filter((n) =>
                n.type.includes('connection') || n.targetType === 'profile'
            );
        }

        return list;
    }, [notifications, filter, categoryFilter]);

    // Handle clicking a notification to mark as read and navigate
    const handleNotificationClick = async (notif: InvoxNotification, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
        }

        // 1. Mark as read immediately
        if (!notif.read) {
            markAsRead(notif.id).catch(() => {});
        }

        // 2. Navigate based on target type and metadata
        const type = notif.type;
        const targetType = notif.targetType;
        const meta = notif.metadata || {};

        if (targetType === 'message' || type === 'message_direct' || type === 'collab_message') {
            const convId = meta.conversationId || notif.targetId;
            if (convId) {
                navigate(`/spotlight?tab=Collabs&collabView=messages&conversationId=${encodeURIComponent(convId)}`);
                return;
            }
            navigate('/spotlight?tab=Collabs&collabView=messages');
            return;
        }

        if (type === 'team_invite_received') {
            const teamId = meta.teamId || notif.targetId;
            const inviteToken = meta.inviteToken || '';
            if (teamId && inviteToken) {
                navigate(`/spotlight?tab=Collabs&collabView=teams&teamId=${encodeURIComponent(teamId)}&invite=${encodeURIComponent(inviteToken)}`);
                return;
            }
            if (teamId) {
                navigate(`/spotlight?tab=Collabs&collabView=teams&teamId=${encodeURIComponent(teamId)}`);
                return;
            }
            navigate('/spotlight?tab=Collabs&collabView=teams');
            return;
        }

        if (targetType === 'team' || type === 'message_team' || type === 'team_member_joined' || type === 'team_invite_accepted') {
            const teamId = meta.teamId || notif.targetId;
            if (teamId) {
                navigate(`/spotlight?tab=Collabs&collabView=teams&teamId=${encodeURIComponent(teamId)}`);
                return;
            }
            navigate('/spotlight?tab=Collabs&collabView=teams');
            return;
        }

        if (type === 'collab_application') {
            navigate('/spotlight?tab=Collabs&collabView=applications');
            return;
        }

        if (type === 'collab_accepted' || type === 'collab_declined') {
            navigate('/applications');
            return;
        }

        if (targetType === 'profile' || type === 'connection_request' || type === 'connection_accepted') {
            const targetUid = meta.userId || notif.actorId || notif.targetId;
            if (targetUid) {
                navigate(`/profile/${encodeURIComponent(targetUid)}`);
                return;
            }
            navigate('/profile');
            return;
        }

        if (meta.url) {
            navigate(meta.url);
            return;
        }

        // Generic fallback to explore
        navigate('/explore');
    };

    // Render type-specific icon and accent
    const renderTypeIcon = (notif: InvoxNotification) => {
        const type = notif.type;
        const targetType = notif.targetType;

        if (targetType === 'message' || type.includes('message')) {
            return (
                <div className="w-8 h-8 rounded-none bg-cyan-950/40 border border-cyan-800/80 text-cyan-400 flex items-center justify-center shrink-0">
                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                </div>
            );
        }

        if (targetType === 'team' || type.includes('team')) {
            return (
                <div className="w-8 h-8 rounded-none bg-emerald-950/40 border border-emerald-800/80 text-emerald-400 flex items-center justify-center shrink-0">
                    <UsersIcon className="w-4 h-4" />
                </div>
            );
        }

        if (type.includes('collab') || targetType === 'application') {
            return (
                <div className="w-8 h-8 rounded-none bg-amber-950/40 border border-amber-800/80 text-amber-400 flex items-center justify-center shrink-0">
                    <BriefcaseIcon className="w-4 h-4" />
                </div>
            );
        }

        if (type.includes('connection') || targetType === 'profile') {
            return (
                <div className="w-8 h-8 rounded-none bg-purple-950/40 border border-purple-800/80 text-purple-400 flex items-center justify-center shrink-0">
                    <GlobeAltIcon className="w-4 h-4" />
                </div>
            );
        }

        return (
            <div className="w-8 h-8 rounded-none bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-center justify-center shrink-0">
                <BellIcon className="w-4 h-4" />
            </div>
        );
    };

    // Action button label
    const getActionLabel = (notif: InvoxNotification): string => {
        const type = notif.type;
        const targetType = notif.targetType;

        if (targetType === 'message' || type.includes('message')) return 'OPEN CHAT';
        if (targetType === 'team' || type.includes('team')) return 'VIEW TEAM';
        if (type === 'collab_application') return 'VIEW APPS';
        if (type === 'collab_accepted' || type === 'collab_declined') return 'MY STATUS';
        if (type.includes('connection') || targetType === 'profile') return 'VIEW PROFILE';
        return 'VIEW';
    };

    return (
        <div className="font-mono text-zinc-200 space-y-6 pb-12 animate-fadeIn max-w-4xl mx-auto">
            {/* Top Header */}
            <div className="bg-[#0c0c0e] border border-zinc-800/90 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 bg-rose-500"></span>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">// TELEMETRY_FEED</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                            <span>NOTIFICATIONS</span>
                            {unreadCount > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 tabular-nums">
                                    {unreadCount} UNREAD
                                </span>
                            )}
                        </h1>
                    </div>

                    {/* Global Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsRead()}
                                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 transition-colors flex items-center gap-1.5"
                                title="Mark all notifications as read"
                            >
                                <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                                <span>MARK ALL AS READ</span>
                            </button>
                        )}
                        <button
                            onClick={() => clearAllRead()}
                            className="px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5"
                            title="Clear all read signals"
                        >
                            <TrashIcon className="w-3.5 h-3.5" />
                            <span>CLEAR READ</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* All vs Unread Tabs */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${
                                filter === 'all'
                                    ? 'bg-zinc-800 text-white border-zinc-600'
                                    : 'bg-zinc-950/60 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                            }`}
                        >
                            ALL ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 ${
                                filter === 'unread'
                                    ? 'bg-zinc-800 text-white border-zinc-600'
                                    : 'bg-zinc-950/60 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                            }`}
                        >
                            <span>UNREAD</span>
                            {unreadCount > 0 && (
                                <span className="w-1.5 h-1.5 bg-rose-500"></span>
                            )}
                            <span className="tabular-nums">({unreadCount})</span>
                        </button>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {(['ALL', 'MESSAGES', 'TEAMS', 'COLLABS', 'CONNECTIONS'] as const).map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-2.5 py-1 border uppercase tracking-wider transition-colors ${
                                    categoryFilter === cat
                                        ? 'bg-white text-black border-white font-bold'
                                        : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-rose-950/20 border border-rose-900/60 p-4 text-xs text-rose-300 flex items-center justify-between gap-4">
                    <span>{error}</span>
                    <button
                        onClick={refresh}
                        className="px-3 py-1 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shrink-0"
                    >
                        // RETRY_STREAM
                    </button>
                </div>
            )}

            {/* Loading State Skeleton */}
            {loading && notifications.length === 0 && (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((idx) => (
                        <div
                            key={idx}
                            className="bg-[#0c0c0e] border border-zinc-800/80 p-4 animate-pulse flex items-start gap-3.5"
                        >
                            <div className="w-8 h-8 bg-zinc-800 shrink-0"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-1/4 bg-zinc-800"></div>
                                <div className="h-4 w-3/4 bg-zinc-800"></div>
                                <div className="h-3 w-1/2 bg-zinc-900"></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && displayedNotifications.length === 0 && (
                <div className="bg-[#0c0c0e] border border-zinc-800/80 p-12 text-center space-y-4">
                    <div className="w-12 h-12 mx-auto bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <BellIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
                            {filter === 'unread'
                                ? '// ALL_CAUGHT_UP // NO UNREAD SIGNALS'
                                : '// RADAR_SILENT // NO NOTIFICATIONS FOUND'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                            {filter === 'unread'
                                ? 'All transmission signals have been acknowledged. Check back when new messages or team activities arrive.'
                                : 'Incoming direct messages, team invites, collab status updates, and comrade connection requests will appear here.'}
                        </p>
                    </div>
                    {filter === 'unread' && notifications.length > 0 && (
                        <button
                            onClick={() => setFilter('all')}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold uppercase tracking-wider text-white transition-colors"
                        >
                            VIEW ALL ARCHIVED SIGNALS
                        </button>
                    )}
                </div>
            )}

            {/* Notification Items List */}
            {displayedNotifications.length > 0 && (
                <div className="space-y-2.5">
                    {displayedNotifications.map((notif) => {
                        const isUnread = !notif.read;
                        const actionLabel = getActionLabel(notif);

                        return (
                            <div
                                key={notif.id}
                                onClick={(e) => handleNotificationClick(notif, e)}
                                className={`group relative bg-[#0c0c0e] border transition-all duration-150 p-4 cursor-pointer hover:border-zinc-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                    isUnread
                                        ? 'border-zinc-700 bg-zinc-900/30'
                                        : 'border-zinc-800/80 hover:bg-zinc-900/20'
                                }`}
                            >
                                {/* Left indicator bar for unread signals */}
                                {isUnread && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" title="Unread signal"></div>
                                )}

                                {/* Main Content */}
                                <div className="flex items-start gap-3.5 min-w-0 flex-1 pl-1">
                                    {/* Actor photo or Type Icon */}
                                    {notif.actorAvatar ? (
                                        <div className="relative shrink-0">
                                            <img
                                                src={notif.actorAvatar}
                                                onError={handleImageError}
                                                alt={notif.actorName || 'Actor'}
                                                className="w-9 h-9 object-cover border border-zinc-700"
                                            />
                                            {isUnread && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 border border-black"></span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative shrink-0">
                                            {renderTypeIcon(notif)}
                                            {isUnread && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 border border-black"></span>
                                            )}
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                                            <span className="text-zinc-400 font-bold">
                                                {notif.actorName ? `// ${notif.actorName.toUpperCase()}` : `// SIGNAL`}
                                            </span>
                                            <span>•</span>
                                            <span>{formatRelativeTime(notif.createdAt)}</span>
                                            {isUnread && (
                                                <span className="text-rose-400 font-bold tracking-widest">[NEW]</span>
                                            )}
                                        </div>

                                        <h3 className={`text-xs font-bold tracking-tight truncate ${isUnread ? 'text-white' : 'text-zinc-300'}`}>
                                            {notif.title}
                                        </h3>

                                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed break-words font-mono">
                                            {notif.body || notif.message}
                                        </p>
                                    </div>
                                </div>

                                {/* Right Actions */}
                                <div
                                    className="flex items-center gap-2 self-end sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/80 w-full sm:w-auto justify-between sm:justify-end"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Contextual Action Button */}
                                    <button
                                        onClick={(e) => handleNotificationClick(notif, e)}
                                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-[11px] font-bold text-white transition-colors uppercase tracking-wider"
                                    >
                                        [{actionLabel} →]
                                    </button>

                                    {/* Mark as read button */}
                                    {isUnread && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await markAsRead(notif.id);
                                            }}
                                            className="p-1.5 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-emerald-400 transition-colors"
                                            title="Mark as read"
                                            aria-label="Mark as read"
                                        >
                                            <CheckIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}

                                    {/* Dismiss / Delete button */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await deleteNotification(notif.id);
                                        }}
                                        className="p-1.5 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-rose-400 transition-colors"
                                        title="Dismiss notification"
                                        aria-label="Dismiss notification"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Load More Pagination */}
            {hasMore && !loading && (
                <div className="pt-4 text-center">
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-white uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                        {loadingMore ? '// FETCHING TELEMETRY...' : '// LOAD MORE ARCHIVED SIGNALS'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
