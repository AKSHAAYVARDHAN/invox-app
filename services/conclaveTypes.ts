import type { Timestamp } from 'firebase/firestore';

/**
 * Conclave Primary Event Formats
 * Conclave supports exactly two event formats:
 * - ONSITE: Physical gatherings with real-world location
 * - VIRTUAL: Online gatherings with remote participation
 */
export type ConclaveEventType = 'ONSITE' | 'VIRTUAL';

/**
 * Conclave Creation Permission Policy
 * Configured per-community under Governance.
 * - ADMINS_ONLY: Only community administrators and owner can create Conclaves (Default)
 * - ALL_MEMBERS: Any verified community member can create Conclaves
 */
export type ConclaveCreationPermission = 'ADMINS_ONLY' | 'ALL_MEMBERS';


/**
 * Conclave Event Lifecycle Statuses
 */
export type ConclaveEventStatus =
    | 'DRAFT'
    | 'PUBLISHED'
    | 'REGISTRATION_CLOSED'
    | 'ONGOING'
    | 'COMPLETED'
    | 'CANCELLED';

/**
 * Conclave Event Registration Availability
 */
export type ConclaveRegistrationStatus =
    | 'OPEN'
    | 'CLOSED'
    | 'WAITLIST'
    | 'CANCELLED';

/**
 * Participant Registration Status
 */
export type ConclaveUserRegistrationStatus =
    | 'CONFIRMED'
    | 'WAITLISTED'
    | 'CANCELLED';

/**
 * Participant Attendance Status
 */
export type ConclaveAttendanceStatus =
    | 'REGISTERED'
    | 'ATTENDED'
    | 'NO_SHOW'
    | 'EXCUSED';

/**
 * Physical coordinates for on-site venues
 */
export interface ConclaveCoordinates {
    lat: number;
    lng: number;
}

/**
 * Supported or custom virtual meeting platforms
 */
export type ConclaveVirtualPlatform =
    | 'Google Meet'
    | 'Zoom'
    | 'Discord'
    | 'Microsoft Teams'
    | 'Custom'
    | string;

/**
 * Format-specific metadata for On-Site Conclaves
 */
export interface ConclaveOnSiteDetails {
    venueName: string;
    address: string;
    city: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: ConclaveCoordinates;
    venueInstructions?: string;
    specialInstructions?: string;
}

/**
 * Format-specific metadata for Virtual Conclaves
 */
export interface ConclaveVirtualDetails {
    platform: ConclaveVirtualPlatform;
    meetingUrl: string;
    accessInstructions?: string;
    requiresProtectedAccess?: boolean;
}

/**
 * Protected access credentials stored in conclaveEvents/{eventId}/protected/access
 * Exposed exclusively to confirmed participants and event organizers.
 */
export interface ConclaveProtectedAccess {
    meetingPassword?: string;
    privateMeetingUrl?: string;
    accessCode?: string;
    dialInPin?: string;
    hostKey?: string;
    updatedAt?: Date | Timestamp | any;
}

/**
 * Organizer identity snapshot stored with the event
 */
export interface ConclaveOrganizerInfo {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    handle?: string;
    role?: string;
}

/**
 * Shared Conclave Event Model
 * Unified foundation supporting both On-Site and Virtual gatherings.
 */
export interface ConclaveEvent {
    id: string;
    communityId: string;
    communityName: string;
    communityAvatarUrl?: string;
    title: string;
    description: string;
    category?: string;
    eventType: ConclaveEventType;
    organizerUid: string;
    organizerInfo: ConclaveOrganizerInfo;
    
    // Timing & Schedule
    startDate: string; // ISO YYYY-MM-DD or display date
    startTime: string; // HH:mm format
    startTimestamp: number | Timestamp | any;
    endDate?: string;
    endTime?: string;
    endTimestamp?: number | Timestamp | any;
    timezone: string;

    // Capacity & Registrations
    capacity: number; // 0 or -1 indicates unlimited capacity
    registeredCount: number;

    // Lifecycle & Registration Status
    eventStatus: ConclaveEventStatus;
    registrationStatus: ConclaveRegistrationStatus;

    // Access & Participation
    accessPolicy?: 'ALL_MEMBERS' | 'ADMINS_ONLY' | 'PUBLIC' | string;
    participationInstructions?: string;

    // Visual Media
    coverImageUrl?: string;
    promoVideoUrl?: string;

    // Audit timestamps
    createdAt: Date | Timestamp | any;
    updatedAt?: Date | Timestamp | any;

    // Significant update tracking for participant notifications
    hasSignificantUpdate?: boolean;
    lastSignificantUpdateAt?: Date | Timestamp | any;
    significantChanges?: string[];

    // Cancellation audit
    cancellationReason?: string;
    cancelledAt?: Date | Timestamp | any;

    // Format-Specific Sub-objects
    onSite?: ConclaveOnSiteDetails;
    virtual?: ConclaveVirtualDetails;

    // Backward-Compatibility mappings with legacy ConclaveGathering interface
    format?: 'online' | 'in-person' | 'hybrid' | string;
    date?: string;
    time?: string;
    location?: string;
    virtualUrl?: string;
    hostId?: string;
    hostName?: string;
    attendeeCount?: number;
    attendeeIds?: string[];
    status?: 'scheduled' | 'live' | 'completed' | 'cancelled' | string;
}

/**
 * Input schema for creating a new Conclave event
 */
export interface CreateConclaveEventInput {
    communityId: string;
    communityName: string;
    communityAvatarUrl?: string;
    title: string;
    description: string;
    category?: string;
    eventType: ConclaveEventType;
    startDate: string;
    startTime: string;
    startTimestamp: number;
    endDate?: string;
    endTime?: string;
    endTimestamp?: number;
    timezone: string;
    capacity: number;
    coverImageUrl?: string;
    promoVideoUrl?: string;
    accessPolicy?: 'ALL_MEMBERS' | 'ADMINS_ONLY' | 'PUBLIC' | string;
    participationInstructions?: string;
    eventStatus?: ConclaveEventStatus;
    onSite?: ConclaveOnSiteDetails;
    virtual?: ConclaveVirtualDetails;
    protectedAccess?: ConclaveProtectedAccess;
}

/**
 * Input schema for editing an existing Conclave event
 */
export interface UpdateConclaveEventInput {
    title?: string;
    description?: string;
    category?: string;
    eventType?: ConclaveEventType;
    startDate?: string;
    startTime?: string;
    startTimestamp?: number;
    endDate?: string;
    endTime?: string;
    endTimestamp?: number;
    timezone?: string;
    capacity?: number;
    coverImageUrl?: string;
    promoVideoUrl?: string;
    accessPolicy?: 'ALL_MEMBERS' | 'ADMINS_ONLY' | 'PUBLIC' | string;
    participationInstructions?: string;
    eventStatus?: ConclaveEventStatus;
    registrationStatus?: ConclaveRegistrationStatus;
    onSite?: ConclaveOnSiteDetails;
    virtual?: ConclaveVirtualDetails;
    protectedAccess?: ConclaveProtectedAccess;
}

/**
 * Validation result for Conclave event input
 */
export interface ConclaveValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Participant Registration Document
 * Stored at: conclaveRegistrations/{eventId}_{userId}
 */
export interface ConclaveRegistration {
    id: string; // composite key: `${eventId}_${userId}`
    eventId: string;
    communityId: string;
    userId: string;
    userInfo: {
        uid: string;
        displayName: string;
        avatarUrl?: string;
        handle?: string;
        email?: string;
    };
    registeredAt: Date | Timestamp | any;
    status: ConclaveUserRegistrationStatus;
    attendanceStatus: ConclaveAttendanceStatus;
    cancelledAt?: Date | Timestamp | any;
    cancellationReason?: string;
}

/**
 * Attendance Verification Record
 * Stored at: conclaveAttendance/{eventId}_{userId}
 */
export interface ConclaveAttendanceRecord {
    id: string;
    eventId: string;
    communityId: string;
    userId: string;
    attendanceStatus: ConclaveAttendanceStatus;
    markedAt: Date | Timestamp | any;
    markedByUid: string;
    notes?: string;
}
