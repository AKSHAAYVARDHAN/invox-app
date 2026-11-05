import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
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
    TrashIcon,
    EyeIcon,
    AlertTriangleIcon,
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
import { CreateConclaveModal } from './CreateConclaveModal';

// Inline Icons for specific Conclave actions
const EllipsisIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true" focusable="false">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
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

    // Deep-linking: auto-open gathering dossier if navigated with eventId
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const eventIdParam = searchParams.get('eventId');
    const handledEventIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (eventIdParam && events.length > 0 && !previewEvent) {
            if (handledEventIdRef.current !== eventIdParam) {
                const match = events.find(e => e.id === eventIdParam);
                if (match) {
                    handledEventIdRef.current = eventIdParam;
                    setPreviewEvent(match);
                }
            }
        }
    }, [eventIdParam, events, previewEvent]);

    // Deep-linking: auto-launch Create Conclave workflow if navigated with create=true
    const createParam = searchParams.get('create');
    const handledCreateParamRef = useRef<boolean>(false);

    useEffect(() => {
        if ((createParam === 'true' || createParam === '1') && canCreate && !handledCreateParamRef.current) {
            handledCreateParamRef.current = true;
            setEditingEvent(null);
            setIsFormModalOpen(true);
        }
    }, [createParam, canCreate]);

    const handleCloseFormModal = useCallback(() => {
        setIsFormModalOpen(false);
        setEditingEvent(null);
        setSearchParams(prev => {
            if (prev.has('create')) {
                const next = new URLSearchParams(prev);
                next.delete('create');
                return next;
            }
            return prev;
        }, { replace: true });
    }, [setSearchParams]);

    const handleSavedFormModal = useCallback((savedEvent: ConclaveEvent) => {
        setEvents(prev => {
            const exists = prev.some(e => e.id === savedEvent.id);
            if (exists) {
                return prev.map(e => e.id === savedEvent.id ? savedEvent : e);
            }
            return [savedEvent, ...prev];
        });
        setIsFormModalOpen(false);
        setEditingEvent(null);
        setSearchParams(prev => {
            if (prev.has('create')) {
                const next = new URLSearchParams(prev);
                next.delete('create');
                return next;
            }
            return prev;
        }, { replace: true });
        setActionFeedback({
            type: 'success',
            message: savedEvent.eventStatus === 'DRAFT'
                ? `Saved draft "${savedEvent.title}". You can preview, edit, or publish it anytime.`
                : `Conclave "${savedEvent.title}" is published!`
        });
    }, [setSearchParams]);

    const handleClosePreviewModal = useCallback(() => {
        setPreviewEvent(null);
        setSearchParams(prev => {
            if (prev.has('eventId')) {
                const next = new URLSearchParams(prev);
                next.delete('eventId');
                return next;
            }
            return prev;
        }, { replace: true });
    }, [setSearchParams]);

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

                <div className="flex flex-col items-start md:items-end justify-center gap-2.5 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap">
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
                                className={`p-5 sm:p-6 bg-[#0c0c0e] border transition-colors space-y-4 font-mono ${
                                    isDraft
                                        ? 'border-purple-800/80 bg-purple-950/10'
                                        : isCancelled
                                        ? 'border-rose-950/70 bg-[#0c0c0e]/80 opacity-80'
                                        : 'border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                {/* A. Event Header Row: Format, Status, Date/Time & Actions Menu */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-850/80 pb-3.5">
                                    {/* Left: Format & Status Badges */}
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        {/* Format Indicator */}
                                        {isOnsite ? (
                                            <span className="px-2.5 py-1 bg-amber-950/40 border border-amber-600/70 text-amber-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                                <MapPinIcon className="w-3.5 h-3.5 text-amber-400" />
                                                <span>ON-SITE CONCLAVE</span>
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-cyan-950/40 border border-cyan-600/70 text-cyan-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                                <GlobeAltIcon className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>VIRTUAL CONCLAVE</span>
                                            </span>
                                        )}

                                        {/* Lifecycle Status Badge */}
                                        {isDraft ? (
                                            <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-500/80 text-purple-300 text-[10px] uppercase font-bold tracking-wider shrink-0">
                                                // DRAFT
                                            </span>
                                        ) : isOngoing ? (
                                            <span className="px-2 py-0.5 bg-green-950/60 border border-green-500 text-green-300 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 shrink-0">
                                                <span className="w-1.5 h-1.5 bg-green-400 rounded-none animate-pulse" />
                                                <span>LIVE NOW</span>
                                            </span>
                                        ) : isCancelled ? (
                                            <span className="px-2 py-0.5 bg-rose-950/60 border border-rose-800 text-rose-400 text-[10px] uppercase font-bold tracking-wider shrink-0">
                                                CANCELLED
                                            </span>
                                        ) : isCompleted ? (
                                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider shrink-0">
                                                COMPLETED
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 text-[10px] uppercase font-bold tracking-wider shrink-0">
                                                SCHEDULED
                                            </span>
                                        )}

                                        {/* Category if present */}
                                        {event.category && (
                                            <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                                                · {event.category}
                                            </span>
                                        )}

                                        {/* Significant Update Badge */}
                                        {event.hasSignificantUpdate && !isCancelled && !isDraft && (
                                            <span className="px-2 py-0.5 bg-amber-950/40 border border-amber-600/70 text-amber-300 text-[10px] uppercase font-bold flex items-center gap-1 shrink-0">
                                                <AlertTriangleIcon className="w-3 h-3 text-amber-400" />
                                                <span>UPDATED</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Date & Time + Header Actions Menu Anchor */}
                                    <div className="flex items-center justify-between md:justify-end gap-2.5 flex-wrap shrink-0">
                                        {/* Date & Time */}
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-black/50 px-2.5 py-1 border border-zinc-850">
                                            <CalendarDaysIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                            <span className="font-semibold text-zinc-200">{event.startDate || event.date}</span>
                                            <span className="text-zinc-600 mx-0.5">//</span>
                                            <ClockIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                            <span>{event.startTime || event.time} {event.timezone ? `(${event.timezone})` : ''}</span>
                                        </div>

                                        {/* Actions Menu (Authorized Organizers Only, neatly anchored in header) */}
                                        {isEventOrganizer && (
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
                                        )}
                                    </div>
                                </div>

                                {/* Cover Image Banner (if available) */}
                                {event.coverImageUrl && (
                                    <div className="relative aspect-video max-h-44 w-full overflow-hidden bg-black border border-zinc-850">
                                        <img
                                            src={event.coverImageUrl}
                                            alt={event.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}

                                {/* B. Event Information: Title & Description */}
                                <div className="space-y-1.5">
                                    <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide leading-snug break-words">
                                        {event.title}
                                    </h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed max-w-4xl break-words">
                                        {event.description}
                                    </p>
                                </div>

                                {/* C. Location / Meeting Information Section */}
                                <div className="bg-black/60 border border-zinc-850 p-3.5 text-xs space-y-2">
                                    {isOnsite ? (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-amber-300 font-bold uppercase tracking-wide">
                                                <MapPinIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                                <span className="text-[10px] text-zinc-500 font-normal">VENUE:</span>
                                                <span className="text-white font-bold">{venueDisplay || 'Physical Community Venue'}</span>
                                            </div>
                                            {(addressDisplay || cityDisplay) && (
                                                <div className="pl-6 text-[11px] text-zinc-300 flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-zinc-500 uppercase text-[10px]">ADDRESS:</span>
                                                    <span>{addressDisplay || ''}</span>
                                                    {cityDisplay && <span className="text-zinc-400">· {cityDisplay}</span>}
                                                </div>
                                            )}
                                            {event.onSite?.venueInstructions && (
                                                <div className="pl-6 pt-1 text-[11px] text-zinc-400 border-l border-amber-500/30 ml-6 pl-2.5 space-y-0.5">
                                                    <span className="text-amber-400/90 text-[10px] uppercase font-bold block">INSTRUCTIONS:</span>
                                                    <p className="leading-relaxed text-zinc-300">{event.onSite.venueInstructions}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-cyan-300 font-bold uppercase tracking-wide">
                                                <GlobeAltIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                                <span className="text-[10px] text-zinc-500 font-normal">PLATFORM:</span>
                                                <span className="text-white font-bold">{platformDisplay}</span>
                                            </div>
                                            <div className="pl-6 text-[11px] text-zinc-400 space-y-1">
                                                {isUserRegistered || isEventOrganizer ? (
                                                    <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                                                        <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                                        <span>ACCESS AUTHORIZED: Secure virtual room link is active in the footer below.</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
                                                        <LockClosedIcon className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
                                                        <span>ACCESS RESTRICTED: Direct meeting room link unlocks upon confirmed registration.</span>
                                                    </div>
                                                )}
                                                {event.virtual?.accessInstructions && (
                                                    <p className="text-zinc-400 text-[11px] pt-0.5">
                                                        <span className="text-zinc-500 uppercase text-[10px]">SESSION INSTRUCTIONS:</span> {event.virtual.accessInstructions}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cancellation Notice if cancelled */}
                                    {isCancelled && event.cancellationReason && (
                                        <div className="mt-2 pt-2 border-t border-rose-900/40 text-rose-300 text-[11px] flex items-start gap-1.5">
                                            <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="text-rose-400 uppercase">CANCELLATION REASON:</strong>{' '}
                                                <span>{event.cancellationReason}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* D. Registration Information & Capacity Progress */}
                                {!isDraft && (
                                    <div className="space-y-1.5 bg-black/40 border border-zinc-850 p-3 text-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-zinc-400">
                                                <UsersIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                                <span className="uppercase text-[10px] text-zinc-500">ATTENDEES:</span>
                                                <strong className="text-white font-bold">{registeredCount}</strong>
                                                <span className="text-zinc-600">/</span>
                                                <span className="text-zinc-400">{capacity}</span>
                                                <span className="text-zinc-500 text-[10px]">({capacityPercentage}%)</span>
                                            </div>
                                            <div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                    isCancelled
                                                        ? 'text-zinc-500'
                                                        : registeredCount >= capacity
                                                        ? 'text-rose-400'
                                                        : capacityPercentage >= 80
                                                        ? 'text-amber-400'
                                                        : 'text-emerald-400'
                                                }`}>
                                                    {isCancelled
                                                        ? 'REGISTRATIONS FROZEN'
                                                        : registeredCount >= capacity
                                                        ? 'CAPACITY REACHED (WAITLIST)'
                                                        : `${capacity - registeredCount} SPOTS REMAINING`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-zinc-900 h-1.5 overflow-hidden border border-zinc-800">
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

                                {/* E. Event Footer: Organizer Information (Left) & Contextual Actions (Right) */}
                                <div className="pt-3.5 border-t border-zinc-850 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                                    {/* Left: Organizer Info */}
                                    <div className="flex items-center gap-2 text-xs min-w-0">
                                        <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider shrink-0">ORGANIZER:</span>
                                        <strong className="text-zinc-200 uppercase font-semibold truncate">
                                            {event.organizerInfo?.displayName || event.hostName || 'Collective Council'}
                                        </strong>
                                        {event.organizerInfo?.role && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase shrink-0">
                                                {event.organizerInfo.role}
                                            </span>
                                        )}
                                        {isDraft && (
                                            <span className="text-purple-400 font-bold text-[10px] uppercase tracking-wider shrink-0">
                                                [UNPUBLISHED DRAFT]
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Contextual Event Actions */}
                                    <div className="flex items-center gap-2.5 flex-wrap justify-start md:justify-end">
                                        {/* Draft Quick Actions (for Organizer) */}
                                        {isDraft && isEventOrganizer && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewEvent(event)}
                                                    className="h-8 px-3.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white uppercase font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                                                >
                                                    <EyeIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                    <span>PREVIEW</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePublishDraft(event)}
                                                    disabled={isActionLoading}
                                                    className="h-8 px-4 bg-purple-500 hover:bg-purple-400 text-black font-bold uppercase text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                                >
                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                    <span>{isActionLoading ? 'PUBLISHING...' : 'PUBLISH CONCLAVE'}</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Published Event Actions (for Non-Drafts) */}
                                        {!isDraft && (
                                            <>
                                                {/* Virtual Conclave Link Button */}
                                                {isVirtual && meetingLink && !isCancelled && (
                                                    isUserRegistered || isEventOrganizer ? (
                                                        <a
                                                            href={meetingLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="h-8 px-3.5 bg-cyan-950/80 border border-cyan-500/70 hover:border-cyan-400 text-cyan-200 hover:text-white font-bold uppercase text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <PlayIcon className="w-3.5 h-3.5 text-cyan-400" />
                                                            <span>JOIN VIRTUAL ROOM</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-500 font-mono uppercase italic px-2 py-1">
                                                            [LINK RESERVED FOR PARTICIPANTS]
                                                        </span>
                                                    )
                                                )}

                                                {/* Registration Status / Action */}
                                                {isUserRegistered ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-8 px-3 bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-bold uppercase flex items-center gap-1.5">
                                                            <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>REGISTERED</span>
                                                        </span>
                                                        {isPublished && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCancelRegistration(event)}
                                                                disabled={isActionLoading}
                                                                className="h-8 px-2.5 text-xs text-zinc-400 hover:text-rose-400 border border-zinc-850 hover:border-rose-900/60 bg-black/40 hover:bg-rose-950/20 transition-colors uppercase font-bold cursor-pointer disabled:opacity-50"
                                                                title="Cancel my registration"
                                                            >
                                                                {isActionLoading ? '...' : 'CANCEL REGISTRATION'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : !canRegister ? (
                                                    isPrivateCommunity && !isMember && !canManage ? (
                                                        <button
                                                            type="button"
                                                            onClick={onJoinCommunity}
                                                            className="h-8 px-4 bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-200 hover:text-white uppercase font-bold text-xs transition-colors cursor-pointer shadow-sm"
                                                        >
                                                            JOIN COLLECTIVE TO REGISTER
                                                        </button>
                                                    ) : (
                                                        <span className="h-8 px-3.5 bg-zinc-900/80 border border-zinc-800 text-zinc-500 uppercase font-bold text-xs flex items-center justify-center">
                                                            {isCompleted ? 'GATHERING CONCLUDED' : isCancelled ? 'EVENT CANCELLED' : 'REGISTRATION CLOSED'}
                                                        </span>
                                                    )
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRegister(event)}
                                                        disabled={isActionLoading}
                                                        className="h-8 px-4 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <span>{isActionLoading ? 'REGISTERING...' : 'REGISTER FOR CONCLAVE'}</span>
                                                    </button>
                                                )}
                                            </>
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
                <CreateConclaveModal
                    isOpen={isFormModalOpen}
                    community={community}
                    isMember={isMember}
                    initialEvent={editingEvent}
                    onClose={handleCloseFormModal}
                    onSaved={handleSavedFormModal}
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
                    onClose={handleClosePreviewModal}
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

    // Do not display organizer management actions to unauthorized users
    if (!isOrganizer) return null;

    const isDraft = event.eventStatus === 'DRAFT';
    const isCancelled = event.eventStatus === 'CANCELLED';
    const isOngoing = event.eventStatus === 'ONGOING';
    const isPublished = event.eventStatus === 'PUBLISHED' || (!event.eventStatus && event.status !== 'cancelled' && event.status !== 'completed');

    return (
        <div className="relative shrink-0" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`h-7 px-2.5 text-zinc-300 hover:text-white bg-black/60 hover:bg-zinc-900 border transition-colors cursor-pointer flex items-center gap-1.5 text-[10px] font-bold tracking-wider ${
                    isOpen ? 'border-zinc-400 text-white bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700'
                }`}
                title="Organizer Actions"
            >
                <EllipsisIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span className="uppercase font-bold tracking-wider">// ACTIONS</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs">
                    <div className="px-3 py-1.5 text-[9px] uppercase text-zinc-500 font-bold border-b border-zinc-850">
                        // ORGANIZER CONTROLS
                    </div>

                    {/* Preview */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            onPreview();
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                        <EyeIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>PREVIEW DOSSIER</span>
                    </button>

                    {/* Edit Action */}
                    {!isCancelled && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                onEdit();
                            }}
                            className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                            <PencilIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isDraft ? 'EDIT DRAFT' : 'EDIT CONCLAVE'}</span>
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
                            className="w-full text-left px-3 py-2 text-purple-300 hover:text-white hover:bg-purple-950/40 flex items-center gap-2 cursor-pointer font-bold transition-colors"
                        >
                            <CheckIcon className="w-3.5 h-3.5 text-purple-400" />
                            <span>PUBLISH CONCLAVE</span>
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
                            className="w-full text-left px-3 py-2 text-green-300 hover:text-white hover:bg-green-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                            <PlayIcon className="w-3.5 h-3.5 text-green-400" />
                            <span>START SESSION (LIVE)</span>
                        </button>
                    )}

                    {isOngoing && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                onTransitionStatus('COMPLETED');
                            }}
                            className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                            <CheckIcon className="w-3.5 h-3.5 text-zinc-400" />
                            <span>CONCLUDE SESSION</span>
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
                            className="w-full text-left px-3 py-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors border-t border-zinc-850"
                        >
                            <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-400" />
                            <span>CANCEL CONCLAVE</span>
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
                            className="w-full text-left px-3 py-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors border-t border-zinc-850"
                        >
                            <TrashIcon className="w-3.5 h-3.5 text-rose-400" />
                            <span>DELETE DRAFT</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Note: Conclave Event Creation & Editing is handled by CreateConclaveModal in ./CreateConclaveModal.tsx
 */

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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                            CONCLAVE EVENT PREVIEW DOSSIER
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

                    {/* Cover image if available */}
                    {event.coverImageUrl && (
                        <div className="relative aspect-video max-h-52 w-full overflow-hidden bg-black border border-zinc-800">
                            <img
                                src={event.coverImageUrl}
                                alt={event.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    {/* Format and Status Row */}
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 text-xs font-bold uppercase ${
                                isOnsite
                                    ? 'bg-amber-950/40 border border-amber-500 text-amber-300'
                                    : 'bg-cyan-950/40 border border-cyan-500 text-cyan-300'
                            }`}>
                                {isOnsite ? 'ON-SITE CONCLAVE' : 'VIRTUAL CONCLAVE'}
                            </span>
                            {event.category && (
                                <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] uppercase">
                                    {event.category}
                                </span>
                            )}
                        </div>
                        <div className="text-zinc-300 font-bold">
                            {event.startDate || event.date} · {event.startTime || event.time} ({event.timezone || 'UTC'})
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

                    {/* Video Teaser if provided */}
                    {event.promoVideoUrl && (
                        <div className="p-3 bg-black border border-zinc-850 space-y-1">
                            <p className="text-[10px] text-zinc-400 uppercase font-bold">VIDEO TEASER:</p>
                            <div className="aspect-video max-h-44 overflow-hidden bg-black">
                                <video src={event.promoVideoUrl} controls className="w-full h-full object-contain" />
                            </div>
                        </div>
                    )}

                    {/* Specifics */}
                    <div className="p-3 bg-black border border-zinc-850 space-y-2">
                        {isOnsite ? (
                            <div className="space-y-1">
                                <p className="text-amber-300 font-bold">VENUE: {event.onSite?.venueName || event.location || 'Pending Venue Specification'}</p>
                                {event.onSite?.address && (
                                    <p className="text-zinc-400">
                                        ADDRESS: {event.onSite.address} {event.onSite.city ? `(${event.onSite.city})` : ''}
                                    </p>
                                )}
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
                            <span>
                                CAPACITY: <strong>{event.capacity === 0 || event.capacity === -1 ? 'UNLIMITED' : (event.capacity || 100)}</strong> PARTICIPANTS
                            </span>
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
