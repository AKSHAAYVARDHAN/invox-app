import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Community } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
    MapPinIcon,
    GlobeAltIcon,
    PlayIcon,
    PlusIcon,
    CloseIcon,
    CheckIcon,
    CalendarDaysIcon,
    ClockIcon,
    UsersIcon,
    ShieldCheckIcon,
    PencilIcon,
    LockClosedIcon,
} from '../ui/Icons';
import {
    subscribeCommunityConclaveEvents,
    getDefaultDemoConclaveEvents,
    createConclaveEvent,
    updateConclaveEvent,
    publishDraftConclaveEvent,
    cancelConclaveEvent,
    deleteDraftConclaveEvent,
    registerUserForConclave,
    cancelUserConclaveRegistration,
    getUserConclaveRegistration,
    transitionConclaveEventStatus,
    isConclaveRegistrationAvailable,
    validateConclaveEventInput,
    canUserCreateConclave,
} from '../../services/conclaveService';
import type {
    ConclaveEvent,
    ConclaveEventType,
    ConclaveEventStatus,
    CreateConclaveEventInput,
    UpdateConclaveEventInput,
    ConclaveRegistration,
    ConclaveProtectedAccess,
} from '../../services/conclaveTypes';

// Inline Icons for specific Conclave actions
const EllipsisIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true" focusable="false">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true" focusable="false">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const EyeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true" focusable="false">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const AlertTriangleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true" focusable="false">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

interface ConclaveGatheringsViewProps {
    community: Community;
    isMember: boolean;
    onJoinCommunity?: () => void;
    canManage: boolean;
}

type ConclaveViewFilter = 'UPCOMING' | 'DRAFTS' | 'MY_EVENTS' | 'ALL';

export const ConclaveGatheringsView: React.FC<ConclaveGatheringsViewProps> = ({
    community,
    isMember,
    onJoinCommunity,
    canManage,
}) => {
    const { currentUser, userProfile } = useAuth();
    const canCreate = canUserCreateConclave(community, currentUser?.uid, isMember);
    const hasAuthoringRights = canManage || canCreate;
    const [events, setEvents] = useState<ConclaveEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [formatFilter, setFormatFilter] = useState<'ALL' | 'ONSITE' | 'VIRTUAL'>('ALL');
    const [viewFilter, setViewFilter] = useState<ConclaveViewFilter>('UPCOMING');

    // Registration tracking for current user
    const [userRegistrations, setUserRegistrations] = useState<Record<string, ConclaveRegistration | null>>({});
    const [actionLoadingEventId, setActionLoadingEventId] = useState<string | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<ConclaveEvent | null>(null);
    const [previewEvent, setPreviewEvent] = useState<ConclaveEvent | null>(null);
    const [cancellingEvent, setCancellingEvent] = useState<ConclaveEvent | null>(null);

    // Real-time synchronization of Conclave gatherings for this collective
    useEffect(() => {
        if (!community?.id) return;
        setLoading(true);

        const unsubscribe = subscribeCommunityConclaveEvents(
            community.id,
            (list) => {
                if (list.length === 0) {
                    setEvents(getDefaultDemoConclaveEvents(community.id, community.name));
                } else {
                    setEvents(list);
                }
                setLoading(false);
            },
            () => {
                setEvents(getDefaultDemoConclaveEvents(community.id, community.name));
                setLoading(false);
            },
            currentUser?.uid,
            canManage
        );

        return () => unsubscribe();
    }, [community?.id, community?.name, currentUser?.uid, canManage]);

    // Check user registrations for active events
    useEffect(() => {
        if (!currentUser?.uid || events.length === 0) return;

        const checkRegistrations = async () => {
            const results: Record<string, ConclaveRegistration | null> = {};
            for (const ev of events) {
                if (ev.attendeeIds?.includes(currentUser.uid)) {
                    results[ev.id] = {
                        id: `${ev.id}_${currentUser.uid}`,
                        eventId: ev.id,
                        communityId: ev.communityId,
                        userId: currentUser.uid,
                        userInfo: {
                            uid: currentUser.uid,
                            displayName: currentUser.displayName || 'Member',
                        },
                        registeredAt: new Date(),
                        status: 'CONFIRMED',
                        attendanceStatus: 'REGISTERED',
                    };
                } else {
                    const reg = await getUserConclaveRegistration(ev.id, currentUser.uid);
                    if (reg) {
                        results[ev.id] = reg;
                    }
                }
            }
            setUserRegistrations(results);
        };

        checkRegistrations();
    }, [events, currentUser?.uid]);

    // Handle user registration
    const handleRegister = async (event: ConclaveEvent) => {
        if (!currentUser?.uid) return;
        setActionFeedback(null);
        setActionLoadingEventId(event.id);

        const res = await registerUserForConclave(
            event.id,
            {
                uid: currentUser.uid,
                displayName: currentUser.displayName || userProfile?.displayName || 'Member',
                photoURL: currentUser.photoURL || undefined,
                email: currentUser.email || undefined,
            },
            community,
            isMember
        );

        if (res.success && res.registration) {
            setUserRegistrations(prev => ({
                ...prev,
                [event.id]: res.registration || null,
            }));
            setEvents(prev => prev.map(ev => {
                if (ev.id === event.id) {
                    const nextCount = (ev.registeredCount ?? 0) + 1;
                    const nextAttendees = [...(ev.attendeeIds || []), currentUser.uid];
                    return {
                        ...ev,
                        registeredCount: nextCount,
                        attendeeCount: nextCount,
                        attendeeIds: nextAttendees,
                    };
                }
                return ev;
            }));
            setActionFeedback({ type: 'success', message: `Confirmed registration for "${event.title}".` });
        } else {
            setActionFeedback({ type: 'error', message: res.error || 'Failed to complete registration.' });
        }

        setActionLoadingEventId(null);
    };

    // Handle user registration cancellation
    const handleCancelRegistration = async (event: ConclaveEvent) => {
        if (!currentUser?.uid) return;
        setActionFeedback(null);
        setActionLoadingEventId(event.id);

        const res = await cancelUserConclaveRegistration(event.id, currentUser.uid);
        if (res.success) {
            setUserRegistrations(prev => ({
                ...prev,
                [event.id]: null,
            }));
            setEvents(prev => prev.map(ev => {
                if (ev.id === event.id) {
                    const nextCount = Math.max(0, (ev.registeredCount ?? 1) - 1);
                    const nextAttendees = (ev.attendeeIds || []).filter(id => id !== currentUser.uid);
                    return {
                        ...ev,
                        registeredCount: nextCount,
                        attendeeCount: nextCount,
                        attendeeIds: nextAttendees,
                    };
                }
                return ev;
            }));
            setActionFeedback({ type: 'success', message: `Cancelled registration for "${event.title}".` });
        } else {
            setActionFeedback({ type: 'error', message: res.error || 'Failed to cancel registration.' });
        }

        setActionLoadingEventId(null);
    };

    // Organizer Action: Publish Draft Event
    const handlePublishDraft = async (event: ConclaveEvent) => {
        if (!currentUser?.uid) return;
        setActionFeedback(null);
        setActionLoadingEventId(event.id);

        const res = await publishDraftConclaveEvent(event.id, currentUser.uid, community);
        if (res.success && res.event) {
            setEvents(prev => prev.map(ev => ev.id === event.id ? (res.event as ConclaveEvent) : ev));
            setActionFeedback({ type: 'success', message: `Conclave "${event.title}" is now PUBLISHED and open for registrations.` });
        } else {
            setActionFeedback({
                type: 'error',
                message: res.errors?.join(' ') || 'Failed to publish draft event.'
            });
        }
        setActionLoadingEventId(null);
    };

    // Organizer Action: Delete Draft Event
    const handleDeleteDraft = async (event: ConclaveEvent) => {
        if (!currentUser?.uid) return;
        if (event.eventStatus !== 'DRAFT') {
            setActionFeedback({ type: 'error', message: 'Only draft events can be deleted. Published events must be cancelled.' });
            return;
        }

        const confirmed = window.confirm(`Permanently delete draft "${event.title}"? This cannot be undone.`);
        if (!confirmed) return;

        setActionLoadingEventId(event.id);
        const res = await deleteDraftConclaveEvent(event.id, currentUser.uid, community);
        if (res.success) {
            setEvents(prev => prev.filter(ev => ev.id !== event.id));
            setActionFeedback({ type: 'success', message: `Draft "${event.title}" has been deleted.` });
        } else {
            setActionFeedback({ type: 'error', message: res.error || 'Failed to delete draft.' });
        }
        setActionLoadingEventId(null);
    };

    // Organizer Action: Transition Status (Ongoing, Completed)
    const handleStatusTransition = async (event: ConclaveEvent, newStatus: ConclaveEventStatus) => {
        if (!currentUser?.uid) return;
        setActionLoadingEventId(event.id);
        const res = await transitionConclaveEventStatus(event.id, newStatus, currentUser.uid, community);
        if (res.success) {
            setEvents(prev => prev.map(ev => {
                if (ev.id === event.id) {
                    return { ...ev, eventStatus: newStatus };
                }
                return ev;
            }));
            setActionFeedback({ type: 'success', message: `Event status transitioned to ${newStatus}.` });
        } else {
            setActionFeedback({ type: 'error', message: res.error || 'Status transition failed.' });
        }
        setActionLoadingEventId(null);
    };

    // Counts for format and status tabs
    const onsiteCount = useMemo(() => events.filter(e => e.eventType === 'ONSITE' || e.format === 'in-person').length, [events]);
    const virtualCount = useMemo(() => events.filter(e => e.eventType === 'VIRTUAL' || e.format === 'online').length, [events]);
    const draftCount = useMemo(() => events.filter(e => e.eventStatus === 'DRAFT').length, [events]);
    const myEventsCount = useMemo(() => currentUser?.uid ? events.filter(e => e.organizerUid === currentUser.uid).length : 0, [events, currentUser?.uid]);

    // Filtered events
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            const isEventOnsite = event.eventType === 'ONSITE' || event.format === 'in-person';
            const isEventVirtual = event.eventType === 'VIRTUAL' || event.format === 'online';

            if (formatFilter === 'ONSITE' && !isEventOnsite) return false;
            if (formatFilter === 'VIRTUAL' && !isEventVirtual) return false;

            if (viewFilter === 'UPCOMING') {
                // Upcoming: Published or Ongoing, not drafts, not completed/cancelled
                return event.eventStatus === 'PUBLISHED' || event.eventStatus === 'ONGOING' || (!event.eventStatus && event.status !== 'cancelled' && event.status !== 'completed');
            }
            if (viewFilter === 'DRAFTS') {
                return event.eventStatus === 'DRAFT';
            }
            if (viewFilter === 'MY_EVENTS') {
                return currentUser?.uid && event.organizerUid === currentUser.uid;
            }
            if (viewFilter === 'ALL') {
                return true;
            }

            return true;
        });
    }, [events, formatFilter, viewFilter, currentUser?.uid]);

    return (
        <div className="space-y-6 w-full min-w-0 font-mono">
            {/* Conclave Header & Action Bar */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-400 rounded-none animate-pulse" />
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                            // 02. CONCLAVE // EVENT_&_GATHERING_ENGINE
                        </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                        COLLECTIVE GATHERINGS
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                        Physical on-site meetups and remote virtual sessions organized for {community.name}.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold">
                        <span className="px-2 py-1 bg-amber-950/40 border border-amber-800/60 text-amber-400">
                            {onsiteCount} ON-SITE
                        </span>
                        <span className="px-2 py-1 bg-cyan-950/40 border border-cyan-800/60 text-cyan-400">
                            {virtualCount} VIRTUAL
                        </span>
                        {hasAuthoringRights && draftCount > 0 && (
                            <span className="px-2 py-1 bg-purple-950/40 border border-purple-800/60 text-purple-300">
                                {draftCount} DRAFT{draftCount > 1 ? 'S' : ''}
                            </span>
                        )}
                    </div>

                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingEvent(null);
                                setIsFormModalOpen(true);
                            }}
                            className="px-4 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>CREATE CONCLAVE</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Notification / Feedback Banner */}
            {actionFeedback && (
                <div
                    className={`p-3 text-xs flex items-center justify-between border ${
                        actionFeedback.type === 'error'
                            ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                            : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {actionFeedback.type === 'error' ? (
                            <AlertTriangleIcon className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        ) : (
                            <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                        <span>{actionFeedback.message}</span>
                    </div>
                    <button
                        onClick={() => setActionFeedback(null)}
                        className="text-zinc-400 hover:text-white p-1"
                    >
                        <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Filter Toolbar */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                {/* Format Filter */}
                <div className="flex items-center gap-1 text-xs flex-wrap">
                    <button
                        type="button"
                        onClick={() => setFormatFilter('ALL')}
                        className={`px-3 py-1.5 border uppercase tracking-wider text-xs transition-colors cursor-pointer ${
                            formatFilter === 'ALL'
                                ? 'bg-zinc-900 border-white text-white font-bold'
                                : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        ALL FORMATS ({events.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormatFilter('ONSITE')}
                        className={`px-3 py-1.5 border uppercase tracking-wider text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                            formatFilter === 'ONSITE'
                                ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold'
                                : 'bg-black border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-zinc-700'
                        }`}
                    >
                        <MapPinIcon className="w-3.5 h-3.5" />
                        <span>ON-SITE ({onsiteCount})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormatFilter('VIRTUAL')}
                        className={`px-3 py-1.5 border uppercase tracking-wider text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                            formatFilter === 'VIRTUAL'
                                ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 font-bold'
                                : 'bg-black border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-zinc-700'
                        }`}
                    >
                        <GlobeAltIcon className="w-3.5 h-3.5" />
                        <span>VIRTUAL ({virtualCount})</span>
                    </button>
                </div>

                {/* View / Status Filter */}
                <div className="inline-flex bg-black p-0.5 border border-zinc-800 space-x-1 text-xs flex-wrap">
                    <button
                        type="button"
                        onClick={() => setViewFilter('UPCOMING')}
                        className={`px-3 py-1 uppercase font-bold transition-colors cursor-pointer text-xs ${
                            viewFilter === 'UPCOMING' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        UPCOMING
                    </button>

                    {hasAuthoringRights && (
                        <button
                            type="button"
                            onClick={() => setViewFilter('DRAFTS')}
                            className={`px-3 py-1 uppercase font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5 ${
                                viewFilter === 'DRAFTS'
                                    ? 'bg-purple-500 text-black'
                                    : 'text-purple-300 hover:text-white'
                            }`}
                        >
                            <span>DRAFTS</span>
                            {draftCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-none ${
                                    viewFilter === 'DRAFTS' ? 'bg-black text-purple-300' : 'bg-purple-950 border border-purple-800 text-purple-300'
                                }`}>
                                    {draftCount}
                                </span>
                            )}
                        </button>
                    )}

                    {hasAuthoringRights && (
                        <button
                            type="button"
                            onClick={() => setViewFilter('MY_EVENTS')}
                            className={`px-3 py-1 uppercase font-bold transition-colors cursor-pointer text-xs ${
                                viewFilter === 'MY_EVENTS' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            MY CREATED ({myEventsCount})
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setViewFilter('ALL')}
                        className={`px-3 py-1 uppercase font-bold transition-colors cursor-pointer text-xs ${
                            viewFilter === 'ALL' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        ARCHIVE / ALL
                    </button>
                </div>
            </div>

            {/* Conclave Event Cards Stream */}
            <div className="space-y-4">
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-[#0c0c0e] border border-dashed border-zinc-800 space-y-3">
                        <div className="w-10 h-10 mx-auto bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                            <CalendarDaysIcon className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                            // NO_CONCLAVE_GATHERINGS_FOUND
                        </p>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                            {viewFilter === 'DRAFTS'
                                ? 'No drafts currently saved. Use "+ CREATE CONCLAVE" to author a new draft gathering.'
                                : 'No gatherings currently scheduled under the selected filter criteria.'}
                        </p>
                        {canManage && viewFilter === 'DRAFTS' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingEvent(null);
                                    setIsFormModalOpen(true);
                                }}
                                className="px-4 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer mt-2"
                            >
                                Create First Draft
                            </button>
                        )}
                    </div>
                ) : (
                    filteredEvents.map((event) => {
                        const isVirtual = event.eventType === 'VIRTUAL' || event.format === 'online';
                        const isOnsite = event.eventType === 'ONSITE' || event.format === 'in-person';
                        const isDraft = event.eventStatus === 'DRAFT';
                        const isCancelled = event.eventStatus === 'CANCELLED';
                        const isCompleted = event.eventStatus === 'COMPLETED';
                        const isOngoing = event.eventStatus === 'ONGOING';
                        const isPublished = event.eventStatus === 'PUBLISHED' || (!event.eventStatus && event.status !== 'cancelled' && event.status !== 'completed');

                        const registration = userRegistrations[event.id];
                        const isUserRegistered = registration && registration.status === 'CONFIRMED';
                        const isActionLoading = actionLoadingEventId === event.id;

                        const registeredCount = event.registeredCount ?? event.attendeeCount ?? 0;
                        const capacity = event.capacity || 100;
                        const capacityPercentage = Math.min(100, Math.round((registeredCount / capacity) * 100));

                        const venueDisplay = event.onSite?.venueName || event.location;
                        const addressDisplay = event.onSite?.address;
                        const cityDisplay = event.onSite?.city;
                        const meetingLink = event.virtual?.meetingUrl || event.virtualUrl;
                        const platformDisplay = event.virtual?.platform || 'Virtual Meeting Platform';

                        const registrationAvailability = isConclaveRegistrationAvailable(event);
                        const isPrivateCommunity = community.visibility === 'private';
                        const canRegister = isPublished && registrationAvailability.eligible && (!isPrivateCommunity || isMember || canManage);

                        // Organizer check for this specific event
                        const isEventOrganizer = canManage || (currentUser?.uid && event.organizerUid === currentUser.uid);

                        return (
                            <div
                                key={event.id}
                                className={`p-5 bg-[#0c0c0e] border transition-colors space-y-4 ${
                                    isDraft
                                        ? 'border-purple-800/80 bg-purple-950/10'
                                        : isCancelled
                                        ? 'border-rose-950/70 opacity-80'
                                        : 'border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                {/* Event Header Row */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-850 pb-3">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        {/* Format Badge */}
                                        {isOnsite ? (
                                            <span className="px-2.5 py-1 bg-amber-950/40 border border-amber-600/70 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                <MapPinIcon className="w-3.5 h-3.5" />
                                                <span>ON-SITE CONCLAVE</span>
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-cyan-950/40 border border-cyan-600/70 text-cyan-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                <GlobeAltIcon className="w-3.5 h-3.5" />
                                                <span>VIRTUAL CONCLAVE</span>
                                            </span>
                                        )}

                                        {/* Lifecycle Status Badge */}
                                        {isDraft ? (
                                            <span className="px-2.5 py-0.5 bg-purple-950 border border-purple-500 text-purple-300 text-[10px] uppercase font-bold tracking-wider">
                                                // DRAFT // UNPUBLISHED
                                            </span>
                                        ) : isOngoing ? (
                                            <span className="px-2 py-0.5 bg-green-950/60 border border-green-500 text-green-300 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                                <span>LIVE NOW</span>
                                            </span>
                                        ) : isCancelled ? (
                                            <span className="px-2 py-0.5 bg-rose-950/60 border border-rose-800 text-rose-400 text-[10px] uppercase font-bold">
                                                CANCELLED
                                            </span>
                                        ) : isCompleted ? (
                                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] uppercase">
                                                COMPLETED
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-emerald-950/30 border border-emerald-500/40 text-emerald-400 text-[10px] uppercase font-bold">
                                                SCHEDULED
                                            </span>
                                        )}

                                        {/* Significant Update Badge if date/venue changed */}
                                        {event.hasSignificantUpdate && !isCancelled && !isDraft && (
                                            <span className="px-2 py-0.5 bg-amber-950/40 border border-amber-600/60 text-amber-300 text-[10px] uppercase font-bold flex items-center gap-1">
                                                <AlertTriangleIcon className="w-3 h-3 text-amber-400" />
                                                <span>SCHEDULE/VENUE UPDATED</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Date & Time */}
                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                                        <CalendarDaysIcon className="w-4 h-4 text-zinc-500" />
                                        <span>{event.startDate || event.date}</span>
                                        <span className="text-zinc-600">//</span>
                                        <ClockIcon className="w-4 h-4 text-zinc-500" />
                                        <span>{event.startTime || event.time} {event.timezone ? `(${event.timezone})` : ''}</span>
                                    </div>
                                </div>

                                {/* Title & Description */}
                                <div className="space-y-1.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                                            {event.title}
                                        </h3>

                                        {/* Event Actions Menu */}
                                        <ConclaveEventActionsMenu
                                            event={event}
                                            isOrganizer={Boolean(isEventOrganizer)}
                                            onPreview={() => setPreviewEvent(event)}
                                            onEdit={() => {
                                                setEditingEvent(event);
                                                setIsFormModalOpen(true);
                                            }}
                                            onPublish={() => handlePublishDraft(event)}
                                            onCancel={() => setCancellingEvent(event)}
                                            onDeleteDraft={() => handleDeleteDraft(event)}
                                            onTransitionStatus={(status) => handleStatusTransition(event, status)}
                                        />
                                    </div>

                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        {event.description}
                                    </p>
                                </div>

                                {/* Format Details Box (On-Site Venue vs Virtual Platform) */}
                                <div className="p-3 bg-black/60 border border-zinc-850 text-xs space-y-1.5">
                                    {isOnsite ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-amber-300 font-bold">
                                                <MapPinIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                <span>VENUE: {venueDisplay || 'Physical Community Venue'}</span>
                                            </div>
                                            {addressDisplay && (
                                                <p className="text-zinc-400 text-[11px] pl-5.5">
                                                    ADDRESS: {addressDisplay} {cityDisplay ? `• ${cityDisplay}` : ''}
                                                </p>
                                            )}
                                            {event.onSite?.venueInstructions && (
                                                <p className="text-zinc-500 text-[10px] pl-5.5 italic">
                                                    INSTRUCTIONS: {event.onSite.venueInstructions}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-cyan-300 font-bold">
                                                <GlobeAltIcon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                                <span>PLATFORM: {platformDisplay}</span>
                                            </div>
                                            {event.virtual?.accessInstructions && (
                                                <p className="text-zinc-400 text-[11px] pl-5.5">
                                                    INSTRUCTIONS: {event.virtual.accessInstructions}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Cancellation Reason if cancelled */}
                                    {isCancelled && event.cancellationReason && (
                                        <div className="pt-2 border-t border-zinc-850/70 text-rose-300 text-[11px]">
                                            <strong className="text-rose-400">CANCELLATION REASON:</strong> {event.cancellationReason}
                                        </div>
                                    )}
                                </div>

                                {/* Capacity & Registration Progress */}
                                {!isDraft && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-zinc-500 flex items-center gap-1.5">
                                                <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                <span>REGISTRATIONS: <strong className="text-white">{registeredCount}</strong> / {capacity}</span>
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase ${
                                                isCancelled
                                                    ? 'text-zinc-500'
                                                    : registeredCount >= capacity
                                                    ? 'text-rose-400'
                                                    : 'text-emerald-400'
                                            }`}>
                                                {isCancelled
                                                    ? 'REGISTRATIONS_FROZEN'
                                                    : registeredCount >= capacity
                                                    ? 'CAPACITY_REACHED'
                                                    : `${capacity - registeredCount} SPOTS REMAINING`}
                                            </span>
                                        </div>
                                        <div className="w-full bg-zinc-900 h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    isCancelled
                                                        ? 'bg-zinc-700'
                                                        : capacityPercentage >= 100
                                                        ? 'bg-rose-500'
                                                        : capacityPercentage >= 75
                                                        ? 'bg-amber-400'
                                                        : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${capacityPercentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Footer & Interactive Actions */}
                                <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="text-[10px] text-zinc-500">
                                        ORGANIZER: <strong className="text-zinc-300">{event.organizerInfo?.displayName || event.hostName || 'Collective Council'}</strong>
                                        {isDraft && <span className="ml-2 text-purple-400 font-bold">[DRAFT ONLY - NOT DISCOVERABLE]</span>}
                                    </div>

                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        {/* Draft Quick Action */}
                                        {isDraft && isEventOrganizer && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewEvent(event)}
                                                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white uppercase font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                                >
                                                    <EyeIcon className="w-3.5 h-3.5" />
                                                    <span>PREVIEW</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePublishDraft(event)}
                                                    disabled={isActionLoading}
                                                    className="px-4 py-1.5 bg-purple-500 hover:bg-purple-400 text-black font-bold uppercase text-xs transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {isActionLoading ? 'PUBLISHING...' : 'PUBLISH GATHERING'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Published Registration Action (for non-drafts) */}
                                        {!isDraft && (
                                            isUserRegistered ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                                                        <CheckIcon className="w-3.5 h-3.5" />
                                                        <span>REGISTERED</span>
                                                    </span>
                                                    {isPublished && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancelRegistration(event)}
                                                            disabled={isActionLoading}
                                                            className="px-2.5 py-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors uppercase cursor-pointer"
                                                        >
                                                            {isActionLoading ? '...' : 'Cancel'}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : !canRegister ? (
                                                isPrivateCommunity && !isMember && !canManage ? (
                                                    <button
                                                        type="button"
                                                        onClick={onJoinCommunity}
                                                        className="px-4 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-300 hover:text-white uppercase font-bold text-xs transition-colors cursor-pointer"
                                                    >
                                                        JOIN COLLECTIVE TO REGISTER
                                                    </button>
                                                ) : (
                                                    <span className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-600 uppercase font-bold text-xs">
                                                        {isCompleted ? 'GATHERING CONCLUDED' : isCancelled ? 'EVENT CANCELLED' : 'REGISTRATION CLOSED'}
                                                    </span>
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRegister(event)}
                                                    disabled={isActionLoading}
                                                    className="px-4 py-1.5 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {isActionLoading ? 'REGISTERING...' : 'REGISTER FOR CONCLAVE'}
                                                </button>
                                            )
                                        )}

                                        {/* Virtual Conclave Link */}
                                        {isVirtual && meetingLink && !isDraft && !isCancelled && (
                                            isUserRegistered || isEventOrganizer ? (
                                                <a
                                                    href={meetingLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3.5 py-1.5 bg-cyan-950 border border-cyan-500/60 text-cyan-300 hover:text-white hover:border-cyan-400 font-bold uppercase text-xs transition-colors flex items-center gap-1.5"
                                                >
                                                    <PlayIcon className="w-3 h-3 text-cyan-400" />
                                                    <span>JOIN VIRTUAL ROOM</span>
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-zinc-600 uppercase italic">
                                                    [REGISTER TO UNLOCK LINK]
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Event Form Modal (Creation & Editing) */}
            {isFormModalOpen && (
                <ConclaveEventFormModal
                    community={community}
                    isMember={isMember}
                    initialEvent={editingEvent}
                    onClose={() => {
                        setIsFormModalOpen(false);
                        setEditingEvent(null);
                    }}
                    onSaved={(savedEvent) => {
                        setEvents(prev => {
                            const exists = prev.some(e => e.id === savedEvent.id);
                            if (exists) {
                                return prev.map(e => e.id === savedEvent.id ? savedEvent : e);
                            }
                            return [savedEvent, ...prev];
                        });
                        setIsFormModalOpen(false);
                        setEditingEvent(null);
                        setActionFeedback({
                            type: 'success',
                            message: savedEvent.eventStatus === 'DRAFT'
                                ? `Saved draft "${savedEvent.title}". You can preview, edit, or publish it anytime.`
                                : `Conclave "${savedEvent.title}" is published!`
                        });
                    }}
                    onPreview={(draftData) => {
                        setPreviewEvent(draftData as ConclaveEvent);
                    }}
                />
            )}

            {/* Event Preview Modal */}
            {previewEvent && (
                <ConclaveEventPreviewModal
                    event={previewEvent}
                    community={community}
                    isOrganizer={canManage || previewEvent.organizerUid === currentUser?.uid}
                    onClose={() => setPreviewEvent(null)}
                    onEdit={() => {
                        setEditingEvent(previewEvent);
                        setPreviewEvent(null);
                        setIsFormModalOpen(true);
                    }}
                    onPublish={async () => {
                        await handlePublishDraft(previewEvent);
                        setPreviewEvent(null);
                    }}
                />
            )}

            {/* Event Cancellation Confirmation Modal */}
            {cancellingEvent && (
                <ConclaveCancelConfirmModal
                    event={cancellingEvent}
                    onClose={() => setCancellingEvent(null)}
                    onConfirm={async (reason) => {
                        if (!currentUser?.uid) return;
                        setActionLoadingEventId(cancellingEvent.id);
                        const res = await cancelConclaveEvent(cancellingEvent.id, currentUser.uid, community, reason);
                        if (res.success && res.event) {
                            setEvents(prev => prev.map(e => e.id === cancellingEvent.id ? (res.event as ConclaveEvent) : e));
                            setActionFeedback({
                                type: 'success',
                                message: `Event "${cancellingEvent.title}" was cancelled. Existing registrations remain preserved.`
                            });
                        } else {
                            setActionFeedback({
                                type: 'error',
                                message: res.errors?.join(' ') || 'Failed to cancel event.'
                            });
                        }
                        setActionLoadingEventId(null);
                        setCancellingEvent(null);
                    }}
                />
            )}
        </div>
    );
};

/**
 * Event Actions Menu Dropdown
 */
interface ConclaveEventActionsMenuProps {
    event: ConclaveEvent;
    isOrganizer: boolean;
    onPreview: () => void;
    onEdit: () => void;
    onPublish: () => void;
    onCancel: () => void;
    onDeleteDraft: () => void;
    onTransitionStatus: (status: ConclaveEventStatus) => void;
}

const ConclaveEventActionsMenu: React.FC<ConclaveEventActionsMenuProps> = ({
    event,
    isOrganizer,
    onPreview,
    onEdit,
    onPublish,
    onCancel,
    onDeleteDraft,
    onTransitionStatus,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isDraft = event.eventStatus === 'DRAFT';
    const isCancelled = event.eventStatus === 'CANCELLED';
    const isOngoing = event.eventStatus === 'ONGOING';
    const isPublished = event.eventStatus === 'PUBLISHED' || (!event.eventStatus && event.status !== 'cancelled' && event.status !== 'completed');

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                title="Conclave Actions"
            >
                <EllipsisIcon className="w-4 h-4" />
                <span className="hidden sm:inline uppercase text-[10px] font-bold">// ACTIONS</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs">
                    {/* Public or General Actions */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            onPreview();
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 cursor-pointer"
                    >
                        <EyeIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>PREVIEW_DOSSIER</span>
                    </button>

                    {/* Organizer Actions */}
                    {isOrganizer && (
                        <>
                            <div className="border-t border-zinc-850 my-1" />
                            <div className="px-3 py-1 text-[9px] uppercase text-zinc-500 font-bold">
                                // ORGANIZER_CONTROLS
                            </div>

                            {/* Edit Action */}
                            {!isCancelled && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onEdit();
                                    }}
                                    className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 cursor-pointer"
                                >
                                    <PencilIcon className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{isDraft ? 'EDIT_DRAFT' : 'EDIT_EVENT'}</span>
                                </button>
                            )}

                            {/* Publish Action for Drafts */}
                            {isDraft && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onPublish();
                                    }}
                                    className="w-full text-left px-3 py-2 text-purple-300 hover:text-white hover:bg-purple-950/40 flex items-center gap-2 cursor-pointer font-bold"
                                >
                                    <CheckIcon className="w-3.5 h-3.5 text-purple-400" />
                                    <span>PUBLISH_CONCLAVE</span>
                                </button>
                            )}

                            {/* Live Session Control */}
                            {isPublished && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onTransitionStatus('ONGOING');
                                    }}
                                    className="w-full text-left px-3 py-2 text-green-300 hover:text-white hover:bg-green-950/40 flex items-center gap-2 cursor-pointer"
                                >
                                    <PlayIcon className="w-3.5 h-3.5 text-green-400" />
                                    <span>START_SESSION (LIVE)</span>
                                </button>
                            )}

                            {isOngoing && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onTransitionStatus('COMPLETED');
                                    }}
                                    className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 cursor-pointer"
                                >
                                    <CheckIcon className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>CONCLUDE_SESSION</span>
                                </button>
                            )}

                            {/* Cancellation for Published/Ongoing */}
                            {!isDraft && !isCancelled && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onCancel();
                                    }}
                                    className="w-full text-left px-3 py-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                                >
                                    <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-400" />
                                    <span>CANCEL_CONCLAVE</span>
                                </button>
                            )}

                            {/* Delete Draft Action (only drafts can be deleted) */}
                            {isDraft && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onDeleteDraft();
                                    }}
                                    className="w-full text-left px-3 py-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                                >
                                    <TrashIcon className="w-3.5 h-3.5 text-rose-400" />
                                    <span>DELETE_DRAFT</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Modal to Create or Edit a Conclave Event with Draft and Publishing Support
 */
interface ConclaveEventFormModalProps {
    community: Community;
    isMember?: boolean;
    initialEvent?: ConclaveEvent | null;
    onClose: () => void;
    onSaved: (event: ConclaveEvent) => void;
    onPreview: (draftData: Partial<ConclaveEvent>) => void;
}

const ConclaveEventFormModal: React.FC<ConclaveEventFormModalProps> = ({
    community,
    isMember = false,
    initialEvent,
    onClose,
    onSaved,
    onPreview,
}) => {
    const { currentUser, userProfile } = useAuth();
    const isEditing = Boolean(initialEvent);

    // Form state initialized with initialEvent or defaults
    const [eventType, setEventType] = useState<ConclaveEventType>(initialEvent?.eventType || 'ONSITE');
    const [title, setTitle] = useState(initialEvent?.title || '');
    const [description, setDescription] = useState(initialEvent?.description || '');
    const [coverImageUrl, setCoverImageUrl] = useState(initialEvent?.coverImageUrl || '');
    const [startDate, setStartDate] = useState(initialEvent?.startDate || '');
    const [startTime, setStartTime] = useState(initialEvent?.startTime || '');
    const [endDate, setEndDate] = useState(initialEvent?.endDate || '');
    const [endTime, setEndTime] = useState(initialEvent?.endTime || '');
    const [timezone, setTimezone] = useState(initialEvent?.timezone || 'UTC');
    const [capacity, setCapacity] = useState<number>(initialEvent?.capacity ?? 80);

    // Onsite fields
    const [venueName, setVenueName] = useState(initialEvent?.onSite?.venueName || initialEvent?.location || '');
    const [address, setAddress] = useState(initialEvent?.onSite?.address || '');
    const [city, setCity] = useState(initialEvent?.onSite?.city || '');
    const [lat, setLat] = useState<string>(initialEvent?.onSite?.coordinates?.lat?.toString() || '');
    const [lng, setLng] = useState<string>(initialEvent?.onSite?.coordinates?.lng?.toString() || '');
    const [venueInstructions, setVenueInstructions] = useState(initialEvent?.onSite?.venueInstructions || '');

    // Virtual fields
    const [platform, setPlatform] = useState(initialEvent?.virtual?.platform || 'Google Meet');
    const [meetingUrl, setMeetingUrl] = useState(initialEvent?.virtual?.meetingUrl || initialEvent?.virtualUrl || '');
    const [accessInstructions, setAccessInstructions] = useState(initialEvent?.virtual?.accessInstructions || '');

    // Optional Protected Virtual Credentials
    const [requiresProtectedAccess, setRequiresProtectedAccess] = useState(Boolean(initialEvent?.virtual?.requiresProtectedAccess));
    const [meetingPassword, setMeetingPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Assemble current input payload
    const getPayload = (targetStatus: ConclaveEventStatus) => {
        const coords = lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))
            ? { lat: Number(lat), lng: Number(lng) }
            : undefined;

        const protectedAccess: ConclaveProtectedAccess | undefined = requiresProtectedAccess
            ? {
                meetingPassword: meetingPassword.trim() || undefined,
                accessCode: accessCode.trim() || undefined,
            }
            : undefined;

        return {
            communityId: community.id,
            communityName: community.name,
            communityAvatarUrl: community.avatarUrl,
            title: title.trim(),
            description: description.trim(),
            coverImageUrl: coverImageUrl.trim() || undefined,
            eventType,
            startDate: startDate.trim(),
            startTime: startTime.trim(),
            startTimestamp: Date.now(),
            endDate: endDate.trim() || undefined,
            endTime: endTime.trim() || undefined,
            timezone: timezone.trim() || 'UTC',
            capacity: Number(capacity) || 100,
            eventStatus: targetStatus,
            onSite: eventType === 'ONSITE' ? {
                venueName: venueName.trim(),
                address: address.trim(),
                city: city.trim(),
                coordinates: coords,
                venueInstructions: venueInstructions.trim() || undefined,
            } : undefined,
            virtual: eventType === 'VIRTUAL' ? {
                platform: platform.trim(),
                meetingUrl: meetingUrl.trim(),
                accessInstructions: accessInstructions.trim() || undefined,
                requiresProtectedAccess,
            } : undefined,
            protectedAccess,
        };
    };

    // Save as DRAFT
    const handleSaveDraft = async () => {
        if (!currentUser?.uid) return;
        setSubmitting(true);
        setValidationErrors([]);

        const payload = getPayload('DRAFT');
        const validation = validateConclaveEventInput(payload, false, initialEvent);
        if (!validation.valid) {
            setValidationErrors(validation.errors);
            setSubmitting(false);
            return;
        }

        if (isEditing && initialEvent) {
            const res = await updateConclaveEvent(initialEvent.id, payload as UpdateConclaveEventInput, currentUser.uid, community);
            if (res.success && res.event) {
                onSaved(res.event);
            } else {
                setValidationErrors(res.errors || ['Failed to update draft.']);
            }
        } else {
            const res = await createConclaveEvent(
                payload as CreateConclaveEventInput,
                {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || userProfile?.displayName || 'Council Organizer',
                    photoURL: currentUser.photoURL || undefined,
                },
                community,
                isMember
            );
            if (res.success && res.event) {
                onSaved(res.event);
            } else {
                setValidationErrors(res.errors || ['Failed to create draft.']);
            }
        }
        setSubmitting(false);
    };

    // PUBLISH Immediately
    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.uid) return;
        setSubmitting(true);
        setValidationErrors([]);

        const payload = getPayload('PUBLISHED');
        const validation = validateConclaveEventInput(payload, true, initialEvent);
        if (!validation.valid) {
            setValidationErrors(validation.errors);
            setSubmitting(false);
            return;
        }

        if (isEditing && initialEvent) {
            const res = await updateConclaveEvent(initialEvent.id, payload as UpdateConclaveEventInput, currentUser.uid, community);
            if (res.success && res.event) {
                onSaved(res.event);
            } else {
                setValidationErrors(res.errors || ['Failed to update Conclave event.']);
            }
        } else {
            const res = await createConclaveEvent(
                payload as CreateConclaveEventInput,
                {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || userProfile?.displayName || 'Council Organizer',
                    photoURL: currentUser.photoURL || undefined,
                },
                community,
                isMember
            );
            if (res.success && res.event) {
                onSaved(res.event);
            } else {
                setValidationErrors(res.errors || ['Failed to publish Conclave event.']);
            }
        }
        setSubmitting(false);
    };

    // Preview
    const handlePreviewClick = () => {
        const payload = getPayload(initialEvent?.eventStatus || 'DRAFT');
        onPreview({
            id: initialEvent?.id || 'preview-temp-id',
            organizerUid: currentUser?.uid || 'temp-organizer',
            organizerInfo: {
                uid: currentUser?.uid || 'temp-organizer',
                displayName: currentUser?.displayName || 'Council Organizer',
            },
            registeredCount: initialEvent?.registeredCount || 0,
            attendeeIds: initialEvent?.attendeeIds || [],
            createdAt: new Date(),
            ...payload,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
                {/* Modal Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                            // 02. CONCLAVE EVENT ARCHITECT
                        </span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                            {isEditing ? `EDIT CONCLAVE: ${initialEvent?.title}` : 'SCHEDULE NEW CONCLAVE GATHERING'}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handlePublish} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 space-y-1">
                            <div className="font-bold uppercase text-[11px] flex items-center gap-1.5">
                                <AlertTriangleIcon className="w-4 h-4 text-rose-400" />
                                <span>VALIDATION_ERRORS_DETECTED</span>
                            </div>
                            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-300">
                                {validationErrors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Format Selector Toggle */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                            PRIMARY EVENT FORMAT *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setEventType('ONSITE')}
                                className={`p-3 border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                                    eventType === 'ONSITE'
                                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold'
                                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                <MapPinIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <div>
                                    <p className="uppercase text-xs">ON-SITE CONCLAVE</p>
                                    <p className="text-[10px] text-zinc-500">Physical venue gathering</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEventType('VIRTUAL')}
                                className={`p-3 border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                                    eventType === 'VIRTUAL'
                                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 font-bold'
                                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                <GlobeAltIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                <div>
                                    <p className="uppercase text-xs">VIRTUAL CONCLAVE</p>
                                    <p className="text-[10px] text-zinc-500">Remote online session</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                            GATHERING TITLE *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Decentralized Computing Lightning Demos & Assembly"
                            required
                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                            DESCRIPTION & AGENDA *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Outline the agenda, topics, speaker schedule, and preparation guidelines..."
                            rows={3}
                            required
                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                        />
                    </div>

                    {/* Cover Image URL */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                            COVER IMAGE URL (OPTIONAL)
                        </label>
                        <input
                            type="url"
                            value={coverImageUrl}
                            onChange={(e) => setCoverImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs"
                        />
                    </div>

                    {/* Timing & Schedule */}
                    <div className="p-3 bg-zinc-950 border border-zinc-850 space-y-3">
                        <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">// SCHEDULE & TIMEZONE</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 uppercase block">START DATE *</label>
                                <input
                                    type="text"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    placeholder="2026-11-28 or FRI, NOV 28"
                                    required
                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 uppercase block">START TIME *</label>
                                <input
                                    type="text"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    placeholder="18:30"
                                    required
                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 uppercase block">END DATE (OPTIONAL)</label>
                                <input
                                    type="text"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    placeholder="2026-11-28 or same day"
                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 uppercase block">END TIME (OPTIONAL)</label>
                                <input
                                    type="text"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    placeholder="20:00"
                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 uppercase block">TIME ZONE *</label>
                                <input
                                    type="text"
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    placeholder="UTC, PST, CET, EST..."
                                    required
                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 uppercase block">
                                    REGISTRATION CAPACITY * {isEditing && initialEvent?.registeredCount ? `(min: ${initialEvent.registeredCount})` : ''}
                                </label>
                                <input
                                    type="number"
                                    value={capacity}
                                    onChange={(e) => setCapacity(Number(e.target.value))}
                                    min={isEditing ? (initialEvent?.registeredCount || 1) : 1}
                                    max={2000}
                                    required
                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Format-Specific Fields */}
                    {eventType === 'ONSITE' ? (
                        <div className="p-3 bg-amber-950/20 border border-amber-900/40 space-y-3">
                            <p className="text-[11px] font-bold text-amber-300 uppercase">// ON-SITE VENUE SPECIFICATION</p>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase block">VENUE NAME *</label>
                                    <input
                                        type="text"
                                        value={venueName}
                                        onChange={(e) => setVenueName(e.target.value)}
                                        placeholder="e.g. The Innovation Center, Hall A"
                                        className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-zinc-400 uppercase block">FULL STREET ADDRESS *</label>
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="550 Howard St, Suite 400"
                                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-400 uppercase block">CITY *</label>
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            placeholder="San Francisco, CA"
                                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-zinc-400 uppercase block">LATITUDE (OPTIONAL)</label>
                                        <input
                                            type="text"
                                            value={lat}
                                            onChange={(e) => setLat(e.target.value)}
                                            placeholder="37.7749"
                                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-400 uppercase block">LONGITUDE (OPTIONAL)</label>
                                        <input
                                            type="text"
                                            value={lng}
                                            onChange={(e) => setLng(e.target.value)}
                                            placeholder="-122.4194"
                                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase block">ADDITIONAL VENUE INSTRUCTIONS</label>
                                    <input
                                        type="text"
                                        value={venueInstructions}
                                        onChange={(e) => setVenueInstructions(e.target.value)}
                                        placeholder="e.g. Check in at northern lobby reception with INVOX member badge"
                                        className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 space-y-3">
                            <p className="text-[11px] font-bold text-cyan-300 uppercase">// VIRTUAL SESSION SPECIFICATION</p>
                            <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-zinc-400 uppercase block">MEETING PLATFORM *</label>
                                        <select
                                            value={platform}
                                            onChange={(e) => setPlatform(e.target.value)}
                                            className="w-full bg-black border border-zinc-800 p-2 text-white focus:outline-none focus:border-zinc-500"
                                        >
                                            <option value="Google Meet">Google Meet</option>
                                            <option value="Zoom">Zoom</option>
                                            <option value="Discord">Discord</option>
                                            <option value="Microsoft Teams">Microsoft Teams</option>
                                            <option value="Custom Stream">Custom Stream</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-400 uppercase block">MEETING URL OR ROOM REFERENCE *</label>
                                        <input
                                            type="url"
                                            value={meetingUrl}
                                            onChange={(e) => setMeetingUrl(e.target.value)}
                                            placeholder="https://meet.google.com/..."
                                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase block">MEETING ACCESS INSTRUCTIONS</label>
                                    <input
                                        type="text"
                                        value={accessInstructions}
                                        onChange={(e) => setAccessInstructions(e.target.value)}
                                        placeholder="Direct link unlocked for confirmed registrants; audio/video enabled for Q&A"
                                        className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                    />
                                </div>

                                {/* Protected Virtual Meeting Credentials */}
                                <div className="pt-2 border-t border-cyan-900/40 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-cyan-200">
                                        <input
                                            type="checkbox"
                                            checked={requiresProtectedAccess}
                                            onChange={(e) => setRequiresProtectedAccess(e.target.checked)}
                                            className="accent-cyan-500"
                                        />
                                        <span className="text-[11px] font-bold">ENABLE PROTECTED MEETING CREDENTIALS</span>
                                    </label>
                                    {requiresProtectedAccess && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">ROOM PASSWORD</label>
                                                <input
                                                    type="text"
                                                    value={meetingPassword}
                                                    onChange={(e) => setMeetingPassword(e.target.value)}
                                                    placeholder="Optional Password"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">ACCESS CODE / PIN</label>
                                                <input
                                                    type="text"
                                                    value={accessCode}
                                                    onChange={(e) => setAccessCode(e.target.value)}
                                                    placeholder="Optional PIN"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal Footer with Actions */}
                    <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handlePreviewClick}
                                className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white uppercase font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <EyeIcon className="w-3.5 h-3.5" />
                                <span>PREVIEW</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2.5 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold text-xs transition-colors cursor-pointer"
                            >
                                CANCEL
                            </button>

                            {/* Save Draft Action */}
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={submitting}
                                className="px-4 py-2 bg-purple-950/60 border border-purple-600 text-purple-200 hover:bg-purple-900 font-bold uppercase text-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? 'SAVING...' : isEditing && initialEvent?.eventStatus !== 'DRAFT' ? 'SAVE EDITS' : 'SAVE AS DRAFT'}
                            </button>

                            {/* Publish Action */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? 'PROCESSING...' : isEditing && initialEvent?.eventStatus === 'PUBLISHED' ? 'UPDATE EVENT' : 'PUBLISH CONCLAVE'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

/**
 * Conclave Event Preview Modal
 */
interface ConclaveEventPreviewModalProps {
    event: ConclaveEvent;
    community: Community;
    isOrganizer: boolean;
    onClose: () => void;
    onEdit: () => void;
    onPublish: () => void;
}

const ConclaveEventPreviewModal: React.FC<ConclaveEventPreviewModalProps> = ({
    event,
    community,
    isOrganizer,
    onClose,
    onEdit,
    onPublish,
}) => {
    const isOnsite = event.eventType === 'ONSITE' || event.format === 'in-person';
    const isDraft = event.eventStatus === 'DRAFT';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                            // CONCLAVE EVENT PREVIEW
                        </span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                            {isDraft ? '[DRAFT PREVIEW - UNPUBLISHED]' : '[EVENT DOSSIER]'}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    {/* Draft Banner */}
                    {isDraft && (
                        <div className="p-3 bg-purple-950/40 border border-purple-800 text-purple-300 flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-400 rounded-none animate-pulse" />
                            <span>This gathering is currently a draft and will only become public once published.</span>
                        </div>
                    )}

                    {/* Format and Status Row */}
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2 flex-wrap gap-2">
                        <span className={`px-2.5 py-1 text-xs font-bold uppercase ${
                            isOnsite
                                ? 'bg-amber-950/40 border border-amber-500 text-amber-300'
                                : 'bg-cyan-950/40 border border-cyan-500 text-cyan-300'
                        }`}>
                            {isOnsite ? 'ON-SITE CONCLAVE' : 'VIRTUAL CONCLAVE'}
                        </span>
                        <div className="text-zinc-300 font-bold">
                            {event.startDate} // {event.startTime} ({event.timezone || 'UTC'})
                        </div>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                        <h2 className="text-base font-bold text-white uppercase">
                            {event.title}
                        </h2>
                        <p className="text-zinc-300 leading-relaxed break-words whitespace-pre-wrap">
                            {event.description}
                        </p>
                    </div>

                    {/* Specifics */}
                    <div className="p-3 bg-black border border-zinc-850 space-y-2">
                        {isOnsite ? (
                            <div className="space-y-1">
                                <p className="text-amber-300 font-bold">VENUE: {event.onSite?.venueName || event.location || 'Pending Venue Specification'}</p>
                                {event.onSite?.address && <p className="text-zinc-400">ADDRESS: {event.onSite.address} ({event.onSite.city})</p>}
                                {event.onSite?.venueInstructions && <p className="text-zinc-500 italic">NOTE: {event.onSite.venueInstructions}</p>}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-cyan-300 font-bold">PLATFORM: {event.virtual?.platform || 'Virtual Meeting'}</p>
                                <p className="text-zinc-400">MEETING URL: {event.virtual?.meetingUrl || '[Available upon publication & registration]'}</p>
                                {event.virtual?.accessInstructions && <p className="text-zinc-500 italic">INSTRUCTIONS: {event.virtual.accessInstructions}</p>}
                            </div>
                        )}
                    </div>

                    {/* Capacity Indicator */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span>CAPACITY: <strong>{event.capacity || 100}</strong> MAXIMUM PARTICIPANTS</span>
                            <span className="text-emerald-400 uppercase font-bold">REGISTRATION OPEN ONCE PUBLISHED</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-850 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold text-xs"
                    >
                        CLOSE PREVIEW
                    </button>
                    {isOrganizer && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onEdit}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-700 text-white font-bold uppercase text-xs hover:border-white"
                            >
                                EDIT DETAILS
                            </button>
                            {isDraft && (
                                <button
                                    type="button"
                                    onClick={onPublish}
                                    className="px-5 py-2 bg-purple-500 hover:bg-purple-400 text-black font-bold uppercase text-xs"
                                >
                                    PUBLISH CONCLAVE NOW
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Conclave Event Cancellation Confirmation Modal
 */
interface ConclaveCancelConfirmModalProps {
    event: ConclaveEvent;
    onClose: () => void;
    onConfirm: (reason?: string) => void;
}

const ConclaveCancelConfirmModal: React.FC<ConclaveCancelConfirmModalProps> = ({
    event,
    onClose,
    onConfirm,
}) => {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        onConfirm(reason.trim());
    };

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto font-mono">
            <div className="bg-[#0c0c0e] border border-rose-900/80 w-full max-w-lg shadow-2xl">
                <div className="p-4 border-b border-rose-950 flex items-center justify-between bg-rose-950/20">
                    <div className="flex items-center gap-2 text-rose-400">
                        <AlertTriangleIcon className="w-5 h-5 text-rose-400" />
                        <h3 className="text-sm font-bold uppercase tracking-wide">
                            CONFIRM CONCLAVE CANCELLATION
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                    <div className="p-3 bg-rose-950/20 border border-rose-900/50 text-rose-300 space-y-2">
                        <p className="font-bold uppercase">// ATTENTION ORGANIZER:</p>
                        <p className="leading-relaxed">
                            You are about to cancel <strong className="text-white">"{event.title}"</strong>.
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400 pt-1">
                            <li>Event status will permanently update to <strong className="text-rose-400">CANCELLED</strong>.</li>
                            <li>New registrations will be immediately prevented.</li>
                            <li>Existing registration records ({event.registeredCount || 0} participants) will be preserved for history.</li>
                            <li>The event information will remain in the collective archive and will not be deleted.</li>
                        </ul>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                            CANCELLATION REASON (DISCLOSED TO REGISTRANTS)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Rescheduled due to unforeseen speaker conflict / venue maintenance..."
                            rows={2}
                            className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500 resize-none"
                        />
                    </div>

                    <div className="pt-3 border-t border-zinc-850 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold text-xs"
                        >
                            KEEP GATHERING
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase text-xs transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'CANCELLING...' : 'CONFIRM CANCELLATION'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
