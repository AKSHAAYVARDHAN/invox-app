import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    runTransaction,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Community } from '../types';
import type {
    ConclaveEvent,
    ConclaveEventType,
    ConclaveEventStatus,
    ConclaveRegistrationStatus,
    ConclaveUserRegistrationStatus,
    ConclaveAttendanceStatus,
    ConclaveRegistration,
    ConclaveAttendanceRecord,
    ConclaveProtectedAccess,
    CreateConclaveEventInput,
    UpdateConclaveEventInput,
    ConclaveValidationResult,
    ConclaveGathering,
    ConclaveCreationPermission,
} from './conclaveTypes';
import { MOCK_COMMUNITY_EVENTS } from './communitiesDemoData';
import { isCommunityOwner, isCommunityAdmin, isCommunityManager } from './communityService';
import { sanitizeForFirestore } from './firestoreService';

/**
 * Firestore Collection Names
 */
export const CONCLAVE_COLLECTIONS = {
    events: 'conclaveEvents',
    registrations: 'conclaveRegistrations',
    attendance: 'conclaveAttendance',
    protected: 'protected',
} as const;

/**
 * Valid Conclave Event Lifecycle Transitions
 * Defines strictly allowed state transitions:
 * - DRAFT -> PUBLISHED, CANCELLED
 * - PUBLISHED -> REGISTRATION_CLOSED, ONGOING, CANCELLED
 * - REGISTRATION_CLOSED -> PUBLISHED, ONGOING, CANCELLED
 * - ONGOING -> COMPLETED, CANCELLED
 * - COMPLETED -> (terminal)
 * - CANCELLED -> (terminal)
 */
export const CONCLAVE_LIFECYCLE_TRANSITIONS: Record<ConclaveEventStatus, ConclaveEventStatus[]> = {
    DRAFT: ['PUBLISHED', 'CANCELLED'],
    PUBLISHED: ['REGISTRATION_CLOSED', 'ONGOING', 'CANCELLED'],
    REGISTRATION_CLOSED: ['PUBLISHED', 'ONGOING', 'CANCELLED'],
    ONGOING: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
};

/**
 * Validates whether a proposed status transition is permitted
 */
export const isValidConclaveStatusTransition = (
    currentStatus: ConclaveEventStatus,
    targetStatus: ConclaveEventStatus
): boolean => {
    if (currentStatus === targetStatus) return true;
    const allowed = CONCLAVE_LIFECYCLE_TRANSITIONS[currentStatus];
    return Array.isArray(allowed) && allowed.includes(targetStatus);
};

/**
 * Determines whether an event is open and eligible to accept participant registrations
 */
export const isConclaveRegistrationAvailable = (
    event: ConclaveEvent
): { eligible: boolean; reason?: string } => {
    if (event.eventStatus === 'CANCELLED') {
        return { eligible: false, reason: 'This gathering has been cancelled.' };
    }
    if (event.eventStatus === 'COMPLETED') {
        return { eligible: false, reason: 'This gathering has already concluded.' };
    }
    if (event.eventStatus === 'DRAFT') {
        return { eligible: false, reason: 'This gathering is an unpublished draft.' };
    }
    if (event.eventStatus === 'REGISTRATION_CLOSED' || event.registrationStatus === 'CLOSED') {
        return { eligible: false, reason: 'Registration for this gathering is closed.' };
    }
    if (event.registrationStatus === 'CANCELLED') {
        return { eligible: false, reason: 'Registration has been cancelled.' };
    }
    if (event.capacity > 0 && event.registeredCount >= event.capacity) {
        return { eligible: false, reason: 'Registration capacity has been reached.' };
    }
    return { eligible: true };
};

/**
 * Resolves the Conclave creation permission policy for a community.
 * Default for all newly created and unconfigured communities is 'ADMINS_ONLY'.
 */
export const getCommunityConclaveCreationPolicy = (
    community: Community | null | undefined
): ConclaveCreationPermission => {
    if (!community) return 'ADMINS_ONLY';
    if (community.conclaveCreationPermission === 'ALL_MEMBERS') return 'ALL_MEMBERS';
    if (community.conclaveCreationPermission === 'ADMINS_ONLY') return 'ADMINS_ONLY';
    // Backward compatibility with legacy gatheringPermission
    if (community.gatheringPermission === 'all') return 'ALL_MEMBERS';
    return 'ADMINS_ONLY';
};

/**
 * Checks whether an authenticated user is permitted to create Conclaves in a given community.
 * - Community Owner & Appointed Administrators can always create Conclaves.
 * - Non-members can NEVER create Conclaves under any policy.
 * - Regular active community members can create Conclaves only if community policy is 'ALL_MEMBERS'.
 */
export const canUserCreateConclave = (
    community: Community | null | undefined,
    uid: string | null | undefined,
    isMember: boolean
): boolean => {
    if (!uid || !community) return false;
    // Owner and Administrators retain sovereign creation & management authority
    if (isCommunityManager(community, uid)) return true;
    // Non-members can never create Conclaves under any policy
    if (!isMember) return false;
    // Regular members can create if community governance allows ALL_MEMBERS
    return getCommunityConclaveCreationPolicy(community) === 'ALL_MEMBERS';
};

/**
 * Permission check: Can user manage/edit this Conclave event?
 * True if user is community owner, community admin, or the designated event organizer.
 */
export const canUserManageConclave = (
    community: Community | null | undefined,
    event: ConclaveEvent | null | undefined,
    uid: string | null | undefined
): boolean => {
    if (!uid) return false;
    if (community && isCommunityManager(community, uid)) return true;
    if (event && (event.organizerUid === uid || event.hostId === uid)) return true;
    return false;
};

/**
 * Permission check: Is user eligible to register for this Conclave?
 * For private communities: user must have verified membership or administrative rights.
 */
export const canUserRegisterForConclave = (
    community: Community | null | undefined,
    isMember: boolean,
    uid: string | null | undefined
): boolean => {
    if (!uid) return false;
    if (!community) return true;
    if (community.visibility === 'private') {
        return isMember || isCommunityManager(community, uid);
    }
    return true;
};

/**
 * Backward-Compatible Adapter: Maps a legacy ConclaveGathering into the unified ConclaveEvent model.
 * Guarantees zero regressions for existing UI and mock demonstration data.
 */
export const adaptLegacyGatheringToConclaveEvent = (
    gathering: ConclaveGathering
): ConclaveEvent => {
    const isVirtual = gathering.format === 'online' || Boolean(gathering.virtualUrl);
    const eventType: ConclaveEventType = isVirtual ? 'VIRTUAL' : 'ONSITE';

    // Map legacy status strings to canonical lifecycle status
    let eventStatus: ConclaveEventStatus = 'PUBLISHED';
    if (gathering.status === 'live') eventStatus = 'ONGOING';
    else if (gathering.status === 'completed') eventStatus = 'COMPLETED';
    else if (gathering.status === 'cancelled') eventStatus = 'CANCELLED';
    else if (gathering.status === 'scheduled') eventStatus = 'PUBLISHED';

    const registeredCount = gathering.attendeeCount ?? (gathering.attendeeIds?.length || 0);
    const capacity = gathering.capacity || 100;
    const registrationStatus: ConclaveRegistrationStatus =
        eventStatus === 'CANCELLED' ? 'CANCELLED'
        : eventStatus === 'COMPLETED' ? 'CLOSED'
        : (capacity > 0 && registeredCount >= capacity) ? 'CLOSED'
        : 'OPEN';

    return {
        id: gathering.id,
        communityId: gathering.communityId,
        communityName: gathering.communityName,
        communityAvatarUrl: gathering.communityAvatarUrl,
        title: gathering.title,
        description: gathering.description,
        eventType,
        organizerUid: gathering.hostId || 'community_organizer',
        organizerInfo: {
            uid: gathering.hostId || 'community_organizer',
            displayName: gathering.hostName || 'Collective Council',
            avatarUrl: gathering.communityAvatarUrl,
            role: 'Organizer',
        },
        startDate: gathering.date || 'TBD',
        startTime: gathering.time || 'TBD',
        startTimestamp: Date.now(),
        timezone: gathering.timezone || 'UTC',
        capacity,
        registeredCount,
        eventStatus,
        registrationStatus,
        createdAt: gathering.createdAt || new Date(),
        updatedAt: new Date(),

        // Format-specific models
        ...(isVirtual ? {
            virtual: {
                platform: 'Google Meet',
                meetingUrl: gathering.virtualUrl || '',
                accessInstructions: 'Authorized Conclave session link for verified community members.',
                requiresProtectedAccess: false,
            }
        } : {
            onSite: {
                venueName: gathering.location || 'Community Venue',
                address: gathering.location || 'Check collective communications for exact venue location.',
                city: 'Global',
                venueInstructions: 'Present your INVOX collective membership credential upon entry.',
            }
        }),

        // Preserve flat legacy properties for full backward compatibility
        format: gathering.format,
        date: gathering.date,
        time: gathering.time,
        location: gathering.location,
        virtualUrl: gathering.virtualUrl,
        hostId: gathering.hostId,
        hostName: gathering.hostName,
        attendeeCount: registeredCount,
        attendeeIds: gathering.attendeeIds || [],
        status: gathering.status,
    };
};

/**
 * Backward-Compatible Adapter: Maps a ConclaveEvent into legacy ConclaveGathering format.
 */
export const adaptConclaveEventToGathering = (
    event: ConclaveEvent
): ConclaveGathering => {
    return {
        id: event.id,
        communityId: event.communityId,
        communityName: event.communityName,
        communityAvatarUrl: event.communityAvatarUrl,
        title: event.title,
        description: event.description,
        format: event.eventType === 'VIRTUAL' ? 'online' : 'in-person',
        date: event.startDate || event.date || 'TBD',
        time: event.startTime || event.time || 'TBD',
        timezone: event.timezone,
        location: event.onSite?.venueName || event.location,
        virtualUrl: event.virtual?.meetingUrl || event.virtualUrl,
        hostId: event.organizerUid || event.hostId || '',
        hostName: event.organizerInfo?.displayName || event.hostName || 'Council',
        capacity: event.capacity,
        attendeeCount: event.registeredCount,
        attendeeIds: event.attendeeIds || [],
        status: event.eventStatus === 'ONGOING' ? 'live'
            : event.eventStatus === 'COMPLETED' ? 'completed'
            : event.eventStatus === 'CANCELLED' ? 'cancelled'
            : 'scheduled',
        createdAt: event.createdAt,
    };
};

/**
 * Returns default demonstration Conclave gatherings for a collective,
 * ensuring both On-Site and Virtual formats are present.
 */
export const getDefaultDemoConclaveEvents = (
    communityId: string,
    communityName?: string
): ConclaveEvent[] => {
    const rawMocks = MOCK_COMMUNITY_EVENTS.filter(e => e.communityId === communityId);
    if (rawMocks.length > 0) {
        return rawMocks.map(adaptLegacyGatheringToConclaveEvent);
    }

    const name = communityName || 'Collective';
    return [
        {
            id: `conclave-${communityId}-onsite-demo`,
            communityId,
            communityName: name,
            title: `${name} Physical Working Group & Technical Summit`,
            description: `On-site gathering for ${name} engineers, builders, and researchers. Hands-on architectural whiteboard sessions, live demonstrations, and collaborative roadmap reviews.`,
            eventType: 'ONSITE',
            eventStatus: 'PUBLISHED',
            visibility: 'COLLECTIVE',
            registrationStatus: 'OPEN',
            startDate: '2026-11-20',
            startTime: '14:00',
            endTime: '18:00',
            timezone: 'UTC',
            capacity: 45,
            registeredCount: 18,
            attendeeIds: [],
            organizerId: 'org-council',
            organizerInfo: {
                uid: 'org-council',
                displayName: `${name} Council`,
                role: 'Administrator',
            },
            onSite: {
                venueName: 'Metropolitan Tech Foundry, Hall B',
                address: '450 Innovation Way, Suite 300',
                city: 'San Francisco, CA',
                postalCode: '94105',
                country: 'USA',
                specialInstructions: 'Check in at the security desk in the north lobby with an active member ID.',
            },
            createdAt: new Date(),
            // Legacy mirror fields
            format: 'in-person',
            date: 'NOV 20, 14:00',
            time: '14:00 - 18:00 UTC',
            location: 'Metropolitan Tech Foundry, Hall B',
            hostName: `${name} Council`,
            attendeeCount: 18,
            status: 'scheduled',
        },
        {
            id: `conclave-${communityId}-virtual-demo`,
            communityId,
            communityName: name,
            title: `${name} Global Virtual Assembly & Open Engineering Sync`,
            description: `Interactive online gathering for decentralized members across timezones. Includes live stream presentation, member breakout sessions, and open technical discourse.`,
            eventType: 'VIRTUAL',
            eventStatus: 'PUBLISHED',
            visibility: 'COLLECTIVE',
            registrationStatus: 'OPEN',
            startDate: '2026-11-25',
            startTime: '18:00',
            endTime: '19:30',
            timezone: 'UTC',
            capacity: 150,
            registeredCount: 42,
            attendeeIds: [],
            organizerId: 'org-council',
            organizerInfo: {
                uid: 'org-council',
                displayName: `${name} Council`,
                role: 'Administrator',
            },
            virtual: {
                platform: 'Google Meet',
                meetingUrl: `https://meet.google.com/invox-${communityId}-sync`,
                accessInstructions: 'Direct link unlocked upon confirmed registration. Audio/video enabled for Q&A.',
            },
            createdAt: new Date(),
            // Legacy mirror fields
            format: 'online',
            date: 'NOV 25, 18:00',
            time: '18:00 - 19:30 UTC',
            location: 'Google Meet Virtual Room',
            virtualUrl: `https://meet.google.com/invox-${communityId}-sync`,
            hostName: `${name} Council`,
            attendeeCount: 42,
            status: 'scheduled',
        },
    ];
};

/**
 * Subscribes to Conclave gatherings for a community.
 * Integrates real Firestore events with fallback demonstration mock events.
 */
export const subscribeCommunityConclaveEvents = (
    communityId: string,
    onUpdate: (events: ConclaveEvent[]) => void,
    onError?: (err: any) => void,
    viewerUid?: string,
    canManage?: boolean
): (() => void) => {
    // 1. Prepare demonstration events for fallback
    const mockEvents: ConclaveEvent[] = getDefaultDemoConclaveEvents(communityId);

    try {
        const q = query(
            collection(db, CONCLAVE_COLLECTIONS.events),
            where('communityId', '==', communityId)
        );

        return onSnapshot(
            q,
            (snap) => {
                if (snap.empty) {
                    onUpdate(mockEvents);
                    return;
                }

                const firestoreEvents: ConclaveEvent[] = snap.docs.map((d) => {
                    const data = d.data() as any;
                    // If stored in legacy shape, adapt to modern ConclaveEvent
                    if (!data.eventType && data.format) {
                        return adaptLegacyGatheringToConclaveEvent({ id: d.id, ...data });
                    }
                    return {
                        id: d.id,
                        ...data,
                        // Ensure legacy fields are populated for existing UI
                        format: data.eventType === 'VIRTUAL' ? 'online' : 'in-person',
                        date: data.startDate || data.date,
                        time: data.startTime || data.time,
                        location: data.onSite?.venueName || data.location,
                        virtualUrl: data.virtual?.meetingUrl || data.virtualUrl,
                        hostName: data.organizerInfo?.displayName || data.hostName,
                        attendeeCount: data.registeredCount ?? data.attendeeCount ?? 0,
                    } as ConclaveEvent;
                });

                // Deduplicate with mock events (Firestore takes precedence)
                const seen = new Set<string>();
                const merged: ConclaveEvent[] = [];

                for (const item of firestoreEvents) {
                    seen.add(item.id);
                    // Filter out draft events for non-managers unless they are the author
                    if (item.eventStatus === 'DRAFT' && !canManage && item.organizerUid !== viewerUid) {
                        continue;
                    }
                    merged.push(item);
                }
                for (const item of mockEvents) {
                    if (!seen.has(item.id)) {
                        seen.add(item.id);
                        merged.push(item);
                    }
                }

                onUpdate(merged);
            },
            (err) => {
                console.warn('[CONCLAVE_EVENTS_SNAPSHOT_FALLBACK]', err);
                onUpdate(mockEvents);
                onError?.(err);
            }
        );
    } catch (err) {
        console.warn('[CONCLAVE_EVENTS_SUBSCRIBE_ERR]', err);
        onUpdate(mockEvents);
        return () => {};
    }
};

/**
 * Fetches a single Conclave event by ID
 */
export const getConclaveEventById = async (
    eventId: string
): Promise<ConclaveEvent | null> => {
    try {
        const ref = doc(db, CONCLAVE_COLLECTIONS.events, eventId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as any;
            if (!data.eventType && data.format) {
                return adaptLegacyGatheringToConclaveEvent({ id: snap.id, ...data });
            }
            return { id: snap.id, ...data } as ConclaveEvent;
        }

        // Check fallback mock events
        const mockMatch = MOCK_COMMUNITY_EVENTS.find(e => e.id === eventId);
        if (mockMatch) {
            return adaptLegacyGatheringToConclaveEvent(mockMatch);
        }

        return null;
    } catch (err) {
        console.warn('[GET_CONCLAVE_EVENT_ERR]', err);
        return null;
    }
};

/**
 * Comprehensive Conclave event validation supporting draft and published criteria
 */
export const validateConclaveEventInput = (
    input: Partial<CreateConclaveEventInput | UpdateConclaveEventInput>,
    isPublishing: boolean = false,
    existingEvent?: ConclaveEvent | null
): ConclaveValidationResult => {
    const errors: string[] = [];

    // Title validation
    if (!input.title || input.title.trim().length < 3) {
        errors.push('Event title must be at least 3 characters long.');
    }

    // Description validation
    if (!input.description || input.description.trim().length < 10) {
        errors.push('Event description must be at least 10 characters long.');
    }

    // Start date and time validation
    if (!input.startDate || !input.startDate.trim()) {
        errors.push('Start date is required.');
    }
    if (!input.startTime || !input.startTime.trim()) {
        errors.push('Start time is required.');
    }

    // End date & time validation (if provided)
    if (input.startDate && input.startTime && input.endTime) {
        const startDateStr = input.startDate;
        const endDateStr = input.endDate || input.startDate;
        if (startDateStr === endDateStr && input.startTime >= input.endTime) {
            errors.push('End time must be later than start time.');
        }
    }

    // Timezone validation
    if (!input.timezone || !input.timezone.trim()) {
        errors.push('Time zone is required.');
    }

    // Capacity validation
    if (input.capacity === undefined || input.capacity === null || Number.isNaN(Number(input.capacity))) {
        errors.push('Registration capacity must be specified.');
    } else {
        const cap = Number(input.capacity);
        if (cap <= 0) {
            errors.push('Registration capacity must be a positive integer.');
        }
        if (existingEvent && existingEvent.registeredCount && cap < existingEvent.registeredCount) {
            errors.push(`Registration capacity cannot be set lower than the current registration count (${existingEvent.registeredCount}).`);
        }
    }

    // Format-specific validations for Publishing or when specified
    const type = input.eventType || existingEvent?.eventType || 'ONSITE';

    if (type === 'ONSITE') {
        const onSite = input.onSite || existingEvent?.onSite;
        if (isPublishing) {
            if (!onSite?.venueName || !onSite.venueName.trim()) {
                errors.push('On-Site Conclave requires a venue name to publish.');
            }
            if (!onSite?.address || !onSite.address.trim()) {
                errors.push('On-Site Conclave requires a street address to publish.');
            }
            if (!onSite?.city || !onSite.city.trim()) {
                errors.push('On-Site Conclave requires a city to publish.');
            }
        }
    } else if (type === 'VIRTUAL') {
        const virtual = input.virtual || existingEvent?.virtual;
        if (isPublishing) {
            if (!virtual?.platform || !virtual.platform.trim()) {
                errors.push('Virtual Conclave requires a meeting platform.');
            }
            if (!virtual?.meetingUrl || !virtual.meetingUrl.trim()) {
                errors.push('Virtual Conclave requires a meeting URL or room reference to publish.');
            } else {
                try {
                    new URL(virtual.meetingUrl.startsWith('http') ? virtual.meetingUrl : `https://${virtual.meetingUrl}`);
                } catch {
                    errors.push('Virtual Conclave meeting URL must be a valid link.');
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Creates a new Conclave event in Firestore (defaulting to DRAFT unless explicitly requested)
 */
export const createConclaveEvent = async (
    input: CreateConclaveEventInput,
    user: { uid: string; displayName?: string | null; photoURL?: string | null },
    community: Community,
    isMember = false
): Promise<{ success: boolean; event?: ConclaveEvent; errors?: string[] }> => {
    try {
        if (!canUserCreateConclave(community, user.uid, isMember)) {
            return {
                success: false,
                errors: ['UNAUTHORIZED: You do not possess authorization to create Conclaves in this collective.']
            };
        }

        const isPublishing = input.eventStatus === 'PUBLISHED';
        const validation = validateConclaveEventInput(input, isPublishing);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        const targetStatus: ConclaveEventStatus = input.eventStatus || 'DRAFT';
        const newId = `conclave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, newId);

        const organizerRole = isCommunityOwner(community, user.uid)
            ? 'Owner'
            : isCommunityAdmin(community, user.uid)
            ? 'Admin'
            : 'Member';

        const eventData: ConclaveEvent = {
            id: newId,
            communityId: input.communityId,
            communityName: input.communityName || community.name,
            communityAvatarUrl: input.communityAvatarUrl || community.avatarUrl,
            title: input.title.trim(),
            description: input.description.trim(),
            eventType: input.eventType,
            organizerUid: user.uid,
            organizerInfo: {
                uid: user.uid,
                displayName: user.displayName || 'Council Organizer',
                avatarUrl: user.photoURL || community.avatarUrl,
                role: organizerRole,
            },
            startDate: input.startDate,
            startTime: input.startTime,
            startTimestamp: input.startTimestamp || Date.now(),
            endDate: input.endDate,
            endTime: input.endTime,
            endTimestamp: input.endTimestamp,
            timezone: input.timezone || 'UTC',
            capacity: Number(input.capacity) || 100,
            registeredCount: 0,
            eventStatus: targetStatus,
            registrationStatus: targetStatus === 'PUBLISHED' ? 'OPEN' : 'CLOSED',
            coverImageUrl: input.coverImageUrl,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(input.eventType === 'ONSITE' ? { onSite: input.onSite } : { virtual: input.virtual }),

            // Legacy mirror fields
            format: input.eventType === 'VIRTUAL' ? 'online' : 'in-person',
            date: input.startDate,
            time: input.startTime,
            location: input.onSite?.venueName,
            virtualUrl: input.virtual?.meetingUrl,
            hostId: user.uid,
            hostName: user.displayName || 'Council Organizer',
            attendeeCount: 0,
            attendeeIds: [],
            status: targetStatus === 'PUBLISHED' ? 'scheduled' : 'draft',
        };

        await setDoc(eventRef, sanitizeForFirestore(eventData));

        // If protected credentials provided, write to secure subdocument
        if (input.protectedAccess && Object.keys(input.protectedAccess).length > 0) {
            const protectedRef = doc(db, CONCLAVE_COLLECTIONS.events, newId, CONCLAVE_COLLECTIONS.protected, 'access');
            await setDoc(protectedRef, sanitizeForFirestore({
                ...input.protectedAccess,
                updatedAt: serverTimestamp(),
            }));
        }

        return { success: true, event: eventData };
    } catch (err: any) {
        console.error('[CREATE_CONCLAVE_EVENT_ERR]', err);
        return { success: false, errors: [err.message || 'CREATE_FAILED'] };
    }
};

/**
 * Updates an existing Conclave event in Firestore with significant change tracking
 */
export const updateConclaveEvent = async (
    eventId: string,
    input: UpdateConclaveEventInput,
    userUid: string,
    community: Community
): Promise<{ success: boolean; event?: ConclaveEvent; errors?: string[] }> => {
    try {
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);
        const snap = await getDoc(eventRef);
        if (!snap.exists()) {
            return { success: false, errors: ['EVENT_NOT_FOUND'] };
        }

        const currentData = snap.data() as ConclaveEvent;
        if (!canUserManageConclave(community, currentData, userUid)) {
            return { success: false, errors: ['UNAUTHORIZED: You do not have permission to manage this Conclave.'] };
        }

        const isPublishing = input.eventStatus === 'PUBLISHED' && currentData.eventStatus === 'DRAFT';
        const validation = validateConclaveEventInput(
            input,
            isPublishing || currentData.eventStatus === 'PUBLISHED',
            currentData
        );
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Significant change detection for notifications
        const significantChanges: string[] = [];
        if (input.startDate && input.startDate !== currentData.startDate) significantChanges.push('START_DATE');
        if (input.startTime && input.startTime !== currentData.startTime) significantChanges.push('START_TIME');
        if (input.timezone && input.timezone !== currentData.timezone) significantChanges.push('TIMEZONE');
        if (input.onSite?.venueName && input.onSite.venueName !== currentData.onSite?.venueName) significantChanges.push('VENUE_NAME');
        if (input.onSite?.address && input.onSite.address !== currentData.onSite?.address) significantChanges.push('VENUE_ADDRESS');
        if (input.virtual?.meetingUrl && input.virtual.meetingUrl !== currentData.virtual?.meetingUrl) significantChanges.push('VIRTUAL_URL');

        const hasSignificant = significantChanges.length > 0;

        const nextStatus = input.eventStatus || currentData.eventStatus;
        const nextRegStatus = nextStatus === 'PUBLISHED'
            ? (currentData.registrationStatus === 'CLOSED' ? 'OPEN' : currentData.registrationStatus)
            : nextStatus === 'CANCELLED'
            ? 'CANCELLED'
            : currentData.registrationStatus;

        const updates: Partial<ConclaveEvent> = {
            title: input.title !== undefined ? input.title.trim() : currentData.title,
            description: input.description !== undefined ? input.description.trim() : currentData.description,
            eventType: input.eventType ?? currentData.eventType,
            startDate: input.startDate ?? currentData.startDate,
            startTime: input.startTime ?? currentData.startTime,
            startTimestamp: input.startTimestamp ?? currentData.startTimestamp,
            endDate: input.endDate ?? currentData.endDate,
            endTime: input.endTime ?? currentData.endTime,
            endTimestamp: input.endTimestamp ?? currentData.endTimestamp,
            timezone: input.timezone ?? currentData.timezone,
            capacity: input.capacity !== undefined ? Number(input.capacity) : currentData.capacity,
            coverImageUrl: input.coverImageUrl ?? currentData.coverImageUrl,
            eventStatus: nextStatus,
            registrationStatus: nextRegStatus,
            updatedAt: serverTimestamp(),
            ...(hasSignificant ? {
                hasSignificantUpdate: true,
                lastSignificantUpdateAt: serverTimestamp(),
                significantChanges,
            } : {}),
            ...(input.eventType === 'ONSITE' || currentData.eventType === 'ONSITE' ? {
                onSite: input.onSite ? { ...currentData.onSite, ...input.onSite } : currentData.onSite,
            } : {}),
            ...(input.eventType === 'VIRTUAL' || currentData.eventType === 'VIRTUAL' ? {
                virtual: input.virtual ? { ...currentData.virtual, ...input.virtual } : currentData.virtual,
            } : {}),
            // Legacy mirror fields
            format: (input.eventType ?? currentData.eventType) === 'VIRTUAL' ? 'online' : 'in-person',
            date: input.startDate ?? currentData.startDate,
            time: input.startTime ?? currentData.startTime,
            location: input.onSite?.venueName ?? currentData.onSite?.venueName,
            virtualUrl: input.virtual?.meetingUrl ?? currentData.virtual?.meetingUrl,
            status: nextStatus === 'PUBLISHED' ? 'scheduled' : nextStatus === 'CANCELLED' ? 'cancelled' : 'draft',
        };

        await updateDoc(eventRef, sanitizeForFirestore(updates));

        if (input.protectedAccess && Object.keys(input.protectedAccess).length > 0) {
            const protectedRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId, CONCLAVE_COLLECTIONS.protected, 'access');
            await setDoc(protectedRef, sanitizeForFirestore({
                ...input.protectedAccess,
                updatedAt: serverTimestamp(),
            }), { merge: true });
        }

        const mergedUpdated: ConclaveEvent = {
            ...currentData,
            ...updates,
            id: eventId,
        };

        return { success: true, event: mergedUpdated };
    } catch (err: any) {
        console.error('[UPDATE_CONCLAVE_EVENT_ERR]', err);
        return { success: false, errors: [err.message || 'UPDATE_FAILED'] };
    }
};

/**
 * Publishes a DRAFT Conclave event to make it discoverable and open for registration
 */
export const publishDraftConclaveEvent = async (
    eventId: string,
    userUid: string,
    community: Community
): Promise<{ success: boolean; event?: ConclaveEvent; errors?: string[] }> => {
    try {
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);
        const snap = await getDoc(eventRef);
        if (!snap.exists()) {
            return { success: false, errors: ['EVENT_NOT_FOUND'] };
        }

        const currentData = snap.data() as ConclaveEvent;
        if (!canUserManageConclave(community, currentData, userUid)) {
            return { success: false, errors: ['UNAUTHORIZED'] };
        }

        if (currentData.eventStatus !== 'DRAFT') {
            return { success: false, errors: ['Only draft events can be published.'] };
        }

        const validation = validateConclaveEventInput(currentData, true);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        const updates: Partial<ConclaveEvent> = {
            eventStatus: 'PUBLISHED',
            registrationStatus: 'OPEN',
            status: 'scheduled',
            updatedAt: serverTimestamp(),
        };

        await updateDoc(eventRef, sanitizeForFirestore(updates));
        return { success: true, event: { ...currentData, ...updates } };
    } catch (err: any) {
        console.error('[PUBLISH_DRAFT_CONCLAVE_ERR]', err);
        return { success: false, errors: [err.message || 'PUBLISH_FAILED'] };
    }
};

/**
 * Cancels a Conclave gathering with reason, preserving all registrations and historical record
 */
export const cancelConclaveEvent = async (
    eventId: string,
    userUid: string,
    community: Community,
    reason?: string
): Promise<{ success: boolean; event?: ConclaveEvent; errors?: string[] }> => {
    try {
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);
        const snap = await getDoc(eventRef);
        if (!snap.exists()) {
            return { success: false, errors: ['EVENT_NOT_FOUND'] };
        }

        const currentData = snap.data() as ConclaveEvent;
        if (!canUserManageConclave(community, currentData, userUid)) {
            return { success: false, errors: ['UNAUTHORIZED'] };
        }

        if (currentData.eventStatus === 'CANCELLED') {
            return { success: true, event: currentData };
        }

        const updates: Partial<ConclaveEvent> = {
            eventStatus: 'CANCELLED',
            registrationStatus: 'CANCELLED',
            status: 'cancelled',
            cancellationReason: reason?.trim() || 'Cancelled by event organizer.',
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await updateDoc(eventRef, sanitizeForFirestore(updates));
        return { success: true, event: { ...currentData, ...updates } };
    } catch (err: any) {
        console.error('[CANCEL_CONCLAVE_EVENT_ERR]', err);
        return { success: false, errors: [err.message || 'CANCEL_FAILED'] };
    }
};

/**
 * Deletes a draft event (only permitted for DRAFT events; published events cannot be deleted)
 */
export const deleteDraftConclaveEvent = async (
    eventId: string,
    userUid: string,
    community: Community
): Promise<{ success: boolean; error?: string }> => {
    try {
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);
        const snap = await getDoc(eventRef);
        if (!snap.exists()) {
            return { success: false, error: 'EVENT_NOT_FOUND' };
        }

        const currentData = snap.data() as ConclaveEvent;
        if (!canUserManageConclave(community, currentData, userUid)) {
            return { success: false, error: 'UNAUTHORIZED' };
        }

        if (currentData.eventStatus !== 'DRAFT') {
            return { success: false, error: 'Only draft events can be deleted. Published events must be cancelled.' };
        }

        await deleteDoc(eventRef);
        return { success: true };
    } catch (err: any) {
        console.error('[DELETE_DRAFT_CONCLAVE_ERR]', err);
        return { success: false, error: err.message || 'DELETE_FAILED' };
    }
};

/**
 * Transitions event lifecycle status with strict transition validation
 */
export const transitionConclaveEventStatus = async (
    eventId: string,
    targetStatus: ConclaveEventStatus,
    userUid: string,
    community: Community
): Promise<{ success: boolean; error?: string }> => {
    try {
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);
        const snap = await getDoc(eventRef);
        if (!snap.exists()) {
            return { success: false, error: 'EVENT_NOT_FOUND' };
        }

        const currentData = snap.data() as ConclaveEvent;
        if (!canUserManageConclave(community, currentData, userUid)) {
            return { success: false, error: 'UNAUTHORIZED' };
        }

        const currentStatus = currentData.eventStatus || 'PUBLISHED';
        if (!isValidConclaveStatusTransition(currentStatus, targetStatus)) {
            return {
                success: false,
                error: `INVALID_TRANSITION: Cannot transition from ${currentStatus} to ${targetStatus}.`,
            };
        }

        // Automatic registration status alignment
        const updates: Partial<ConclaveEvent> = {
            eventStatus: targetStatus,
            updatedAt: serverTimestamp(),
        };

        if (targetStatus === 'CANCELLED') {
            updates.registrationStatus = 'CANCELLED';
            updates.status = 'cancelled';
        } else if (targetStatus === 'COMPLETED') {
            updates.registrationStatus = 'CLOSED';
            updates.status = 'completed';
        } else if (targetStatus === 'REGISTRATION_CLOSED') {
            updates.registrationStatus = 'CLOSED';
        } else if (targetStatus === 'PUBLISHED') {
            updates.registrationStatus = 'OPEN';
            updates.status = 'scheduled';
        } else if (targetStatus === 'ONGOING') {
            updates.status = 'live';
        }

        await updateDoc(eventRef, sanitizeForFirestore(updates));
        return { success: true };
    } catch (err: any) {
        console.error('[TRANSITION_CONCLAVE_STATUS_ERR]', err);
        return { success: false, error: err.message || 'STATUS_TRANSITION_FAILED' };
    }
};

/**
 * Registers an authenticated user for a Conclave gathering.
 * Prevents race conditions and overbooking using an atomic Firestore transaction.
 */
export const registerUserForConclave = async (
    eventId: string,
    user: { uid: string; displayName?: string; photoURL?: string; email?: string; handle?: string },
    community: Community,
    isMember: boolean
): Promise<{ success: boolean; registration?: ConclaveRegistration; error?: string }> => {
    try {
        if (!user.uid) {
            return { success: false, error: 'AUTHENTICATION_REQUIRED' };
        }

        // Permission check
        if (!canUserRegisterForConclave(community, isMember, user.uid)) {
            return {
                success: false,
                error: 'MEMBERSHIP_REQUIRED: Only active members of this collective can register for internal Conclaves.',
            };
        }

        const registrationId = `${eventId}_${user.uid}`;
        const registrationRef = doc(db, CONCLAVE_COLLECTIONS.registrations, registrationId);
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);

        let finalRegistration: ConclaveRegistration | undefined;

        await runTransaction(db, async (transaction) => {
            const [eventSnap, regSnap] = await Promise.all([
                transaction.get(eventRef),
                transaction.get(registrationRef),
            ]);

            if (!eventSnap.exists()) {
                throw new Error('EVENT_NOT_FOUND');
            }

            const eventData = eventSnap.data() as ConclaveEvent;

            // Validate event registration eligibility
            const avail = isConclaveRegistrationAvailable(eventData);
            if (!avail.eligible) {
                throw new Error(avail.reason || 'REGISTRATION_NOT_AVAILABLE');
            }

            // Check if already registered
            if (regSnap.exists()) {
                const existing = regSnap.data() as ConclaveRegistration;
                if (existing.status === 'CONFIRMED') {
                    throw new Error('ALREADY_REGISTERED: You are already registered for this Conclave gathering.');
                }
            }

            // Check capacity limit
            const currentCount = eventData.registeredCount ?? (eventData.attendeeCount || 0);
            if (eventData.capacity > 0 && currentCount >= eventData.capacity) {
                throw new Error('CAPACITY_EXCEEDED: This gathering has reached maximum registration capacity.');
            }

            const registrationData: ConclaveRegistration = {
                id: registrationId,
                eventId,
                communityId: eventData.communityId,
                userId: user.uid,
                userInfo: {
                    uid: user.uid,
                    displayName: user.displayName || 'Community Member',
                    avatarUrl: user.photoURL || undefined,
                    email: user.email || undefined,
                    handle: user.handle || undefined,
                },
                registeredAt: serverTimestamp(),
                status: 'CONFIRMED',
                attendanceStatus: 'REGISTERED',
            };

            // Write registration document
            transaction.set(registrationRef, sanitizeForFirestore(registrationData));

            // Atomically increment registered count on event doc
            const attendeeIds = Array.isArray(eventData.attendeeIds) ? [...eventData.attendeeIds] : [];
            if (!attendeeIds.includes(user.uid)) {
                attendeeIds.push(user.uid);
            }

            transaction.update(eventRef, {
                registeredCount: currentCount + 1,
                attendeeCount: currentCount + 1,
                attendeeIds,
                updatedAt: serverTimestamp(),
            });

            finalRegistration = registrationData;
        });

        return { success: true, registration: finalRegistration };
    } catch (err: any) {
        console.warn('[REGISTER_CONCLAVE_ERR]', err);
        return { success: false, error: err.message || 'REGISTRATION_FAILED' };
    }
};

/**
 * Cancels a user's registration for a Conclave gathering.
 * Atomically decrements the event's registration count in a Firestore transaction.
 */
export const cancelUserConclaveRegistration = async (
    eventId: string,
    userUid: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const registrationId = `${eventId}_${userUid}`;
        const registrationRef = doc(db, CONCLAVE_COLLECTIONS.registrations, registrationId);
        const eventRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId);

        await runTransaction(db, async (transaction) => {
            const [regSnap, eventSnap] = await Promise.all([
                transaction.get(registrationRef),
                transaction.get(eventRef),
            ]);

            if (!regSnap.exists()) {
                throw new Error('REGISTRATION_NOT_FOUND');
            }

            const regData = regSnap.data() as ConclaveRegistration;
            if (regData.status === 'CANCELLED') {
                return; // Already cancelled
            }

            transaction.update(registrationRef, {
                status: 'CANCELLED',
                cancelledAt: serverTimestamp(),
                cancellationReason: reason || 'User cancelled',
            });

            if (eventSnap.exists()) {
                const eventData = eventSnap.data() as ConclaveEvent;
                const currentCount = eventData.registeredCount ?? (eventData.attendeeCount || 1);
                const nextCount = Math.max(0, currentCount - 1);
                const attendeeIds = (eventData.attendeeIds || []).filter(id => id !== userUid);

                transaction.update(eventRef, {
                    registeredCount: nextCount,
                    attendeeCount: nextCount,
                    attendeeIds,
                    updatedAt: serverTimestamp(),
                });
            }
        });

        return { success: true };
    } catch (err: any) {
        console.error('[CANCEL_CONCLAVE_REGISTRATION_ERR]', err);
        return { success: false, error: err.message || 'CANCELLATION_FAILED' };
    }
};

/**
 * Checks if a user has an active registration for an event
 */
export const getUserConclaveRegistration = async (
    eventId: string,
    userUid: string
): Promise<ConclaveRegistration | null> => {
    try {
        const registrationId = `${eventId}_${userUid}`;
        const ref = doc(db, CONCLAVE_COLLECTIONS.registrations, registrationId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data() as ConclaveRegistration;
        }
        return null;
    } catch (err) {
        console.warn('[GET_USER_REGISTRATION_ERR]', err);
        return null;
    }
};

/**
 * Subscribes in real-time to an authenticated user's registrations across all Conclaves
 */
export const subscribeUserConclaveRegistrations = (
    userUid: string,
    onUpdate: (registrations: ConclaveRegistration[]) => void
): (() => void) => {
    if (!userUid) {
        onUpdate([]);
        return () => {};
    }

    try {
        const q = query(
            collection(db, CONCLAVE_COLLECTIONS.registrations),
            where('userId', '==', userUid),
            where('status', '==', 'CONFIRMED')
        );

        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ConclaveRegistration));
                onUpdate(list);
            },
            (err) => {
                console.warn('[SUBSCRIBE_USER_REGISTRATIONS_ERR]', err);
                onUpdate([]);
            }
        );
    } catch (err) {
        console.warn('[SUBSCRIBE_USER_REGISTRATIONS_INIT_ERR]', err);
        onUpdate([]);
        return () => {};
    }
};

/**
 * Retrieves protected virtual meeting credentials for confirmed participants or organizers
 */
export const getProtectedVirtualAccess = async (
    eventId: string,
    userUid: string,
    community: Community
): Promise<ConclaveProtectedAccess | null> => {
    try {
        if (!userUid) return null;

        // Verify authorization: either community manager or registered participant
        const isManager = canUserManageConclave(community, null, userUid);
        if (!isManager) {
            const reg = await getUserConclaveRegistration(eventId, userUid);
            if (!reg || reg.status !== 'CONFIRMED') {
                return null;
            }
        }

        const protectedRef = doc(db, CONCLAVE_COLLECTIONS.events, eventId, CONCLAVE_COLLECTIONS.protected, 'access');
        const snap = await getDoc(protectedRef);
        if (snap.exists()) {
            return snap.data() as ConclaveProtectedAccess;
        }
        return null;
    } catch (err) {
        console.warn('[GET_PROTECTED_VIRTUAL_ACCESS_ERR]', err);
        return null;
    }
};
