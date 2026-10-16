import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import type { SummaryMessageItem } from '../components/spotlight/ConversationSummaryModal';

export type SummaryPreset =
    | 'LAST_HOUR'
    | 'LAST_24_HOURS'
    | 'LAST_7_DAYS'
    | 'LAST_30_DAYS'
    | 'ALL_MESSAGES'
    | 'CUSTOM_RANGE';

export interface DateRangeValidationResult {
    isValid: boolean;
    error: string | null;
    startDate: Date | null;
    endDate: Date | null;
}

/**
 * Format a Date object to local 'YYYY-MM-DDTHH:mm' string for datetime-local inputs
 */
export const toLocalDatetimeString = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${y}-${m}-${d}T${h}:${min}`;
};

/**
 * Parse a 'YYYY-MM-DDTHH:mm' string into a local Date
 */
export const parseLocalDatetimeString = (val: string): Date | null => {
    if (!val || typeof val !== 'string') return null;
    const parts = val.split('T');
    if (parts.length !== 2) return null;
    const [datePart, timePart] = parts;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    if (
        isNaN(year) ||
        isNaN(month) ||
        isNaN(day) ||
        isNaN(hours) ||
        isNaN(minutes)
    ) {
        return null;
    }

    const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Format a Date for display in UI, e.g. "OCT 10, 2026, 09:00"
 */
export const formatDisplayDate = (date: Date): string => {
    const months = [
        'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ];
    const mon = months[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${mon} ${day}, ${year}, ${hours}:${mins}`;
};

/**
 * Generate formatted range description string
 */
export const formatPeriodDisplayString = (
    preset: SummaryPreset,
    startDate: Date | null,
    endDate: Date | null
): string => {
    if (preset === 'ALL_MESSAGES') {
        return 'ALL MESSAGES (FULL HISTORY)';
    }

    if (!startDate || !endDate) {
        return 'CUSTOM RANGE';
    }

    const startStr = formatDisplayDate(startDate);
    const endStr = formatDisplayDate(endDate);

    switch (preset) {
        case 'LAST_HOUR':
            return `LAST HOUR (${startStr} — ${endStr})`;
        case 'LAST_24_HOURS':
            return `LAST 24 HOURS (${startStr} — ${endStr})`;
        case 'LAST_7_DAYS':
            return `LAST 7 DAYS (${startStr} — ${endStr})`;
        case 'LAST_30_DAYS':
            return `LAST 30 DAYS (${startStr} — ${endStr})`;
        case 'CUSTOM_RANGE':
        default:
            return `${startStr} — ${endStr}`;
    }
};

/**
 * Calculate start and end date boundaries for a given preset
 */
export const calculatePresetDates = (preset: SummaryPreset): { startDate: Date; endDate: Date } => {
    const now = new Date();
    // Zero out seconds and milliseconds for clean minute-level input alignment
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

    switch (preset) {
        case 'LAST_HOUR': {
            const startDate = new Date(endDate.getTime() - 60 * 60 * 1000);
            return { startDate, endDate };
        }
        case 'LAST_24_HOURS': {
            const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
            return { startDate, endDate };
        }
        case 'LAST_7_DAYS': {
            const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { startDate, endDate };
        }
        case 'LAST_30_DAYS': {
            const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { startDate, endDate };
        }
        case 'ALL_MESSAGES': {
            const startDate = new Date(0);
            return { startDate, endDate };
        }
        case 'CUSTOM_RANGE':
        default: {
            const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
            return { startDate, endDate };
        }
    }
};

/**
 * Validates selected start and end dates according to business logic:
 * - Both start and end values must be present and valid.
 * - Start must be earlier than or equal to end (never silently swapped).
 * - Future end times are rejected.
 */
export const validateDateRange = (
    preset: SummaryPreset,
    startStr: string,
    endStr: string
): DateRangeValidationResult => {
    if (preset === 'ALL_MESSAGES') {
        return {
            isValid: true,
            error: null,
            startDate: new Date(0),
            endDate: new Date(),
        };
    }

    if (!startStr || !startStr.trim()) {
        return {
            isValid: false,
            error: 'START DATE AND TIME IS REQUIRED.',
            startDate: null,
            endDate: null,
        };
    }

    if (!endStr || !endStr.trim()) {
        return {
            isValid: false,
            error: 'END DATE AND TIME IS REQUIRED.',
            startDate: null,
            endDate: null,
        };
    }

    const startDate = parseLocalDatetimeString(startStr);
    const endDate = parseLocalDatetimeString(endStr);

    if (!startDate || isNaN(startDate.getTime())) {
        return {
            isValid: false,
            error: 'START DATE VALUE IS INVALID.',
            startDate: null,
            endDate: null,
        };
    }

    if (!endDate || isNaN(endDate.getTime())) {
        return {
            isValid: false,
            error: 'END DATE VALUE IS INVALID.',
            startDate: null,
            endDate: null,
        };
    }

    // Start must be earlier than end
    if (startDate.getTime() > endDate.getTime()) {
        return {
            isValid: false,
            error: 'START TIME MUST BE EARLIER THAN OR EQUAL TO END TIME.',
            startDate,
            endDate,
        };
    }

    // Prevent future end times (allow up to 2-minute buffer for client clock skew)
    const nowMs = Date.now() + 2 * 60 * 1000;
    if (endDate.getTime() > nowMs) {
        return {
            isValid: false,
            error: 'END TIME CANNOT BE IN THE FUTURE.',
            startDate,
            endDate,
        };
    }

    return {
        isValid: true,
        error: null,
        startDate,
        endDate,
    };
};

/**
 * Extracts a normalized epoch millisecond timestamp from various Firestore / Date formats
 */
export const getMessageTimestampMs = (createdAt: any): number => {
    if (!createdAt) return 0;
    if (typeof createdAt.toMillis === 'function') {
        return createdAt.toMillis();
    }
    if (typeof createdAt.toDate === 'function') {
        return createdAt.toDate().getTime();
    }
    if (createdAt instanceof Date) {
        return createdAt.getTime();
    }
    if (typeof createdAt === 'number') {
        return createdAt;
    }
    if (typeof createdAt === 'string') {
        const parsed = Date.parse(createdAt);
        return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof createdAt.seconds === 'number') {
        return createdAt.seconds * 1000 + (createdAt.nanoseconds ? Math.floor(createdAt.nanoseconds / 1000000) : 0);
    }
    return 0;
};

/**
 * Retrieve authorized messages for a conversation and filter strictly by date range
 */
export const fetchAuthorizedMessagesForRange = async ({
    conversationId,
    conversationType,
    userId,
    preset,
    startDate,
    endDate,
    fallbackMessages,
}: {
    conversationId: string;
    conversationType: 'inbox' | 'team';
    userId?: string;
    preset: SummaryPreset;
    startDate: Date | null;
    endDate: Date | null;
    fallbackMessages?: SummaryMessageItem[];
}): Promise<{ messages: SummaryMessageItem[]; totalInConversation: number }> => {
    let rawMessages: SummaryMessageItem[] = [];

    const withTimeout = <T>(promise: Promise<T>, ms = 3500): Promise<T> =>
        Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore operation timed out')), ms)),
        ]);

    // Attempt authoritative database retrieval with strict authorization enforcement
    try {
        if (conversationType === 'inbox') {
            // Verify conversation exists and user is an authorized participant
            const convDocRef = doc(db, COLLECTIONS.messages, conversationId);
            const convSnap = await withTimeout(getDoc(convDocRef));
            if (convSnap.exists()) {
                const convData = convSnap.data();
                const participants: string[] = Array.isArray(convData.participants) ? convData.participants : [];
                if (userId && !participants.includes(userId)) {
                    throw new Error('Unauthorized: You are not a participant in this direct collaboration conversation.');
                }
            }

            // Retrieve messages subcollection
            const msgsSubcollectionRef = collection(db, COLLECTIONS.messages, conversationId, 'messages');
            const q = query(msgsSubcollectionRef, orderBy('createdAt', 'asc'));
            const msgsSnap = await withTimeout(getDocs(q));

            rawMessages = msgsSnap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));
        } else {
            // Verify team exists and user is a member or owner
            const teamDocRef = doc(db, COLLECTIONS.teams, conversationId);
            const teamSnap = await withTimeout(getDoc(teamDocRef));
            if (teamSnap.exists()) {
                const teamData = teamSnap.data();
                const isMember =
                    (Array.isArray(teamData.memberIds) && userId && teamData.memberIds.includes(userId)) ||
                    (userId && teamData.ownerId === userId);
                if (userId && !isMember) {
                    throw new Error('Unauthorized: You are not an authorized member of this team workspace.');
                }
            }

            // Retrieve team messages subcollection
            const msgsSubcollectionRef = collection(db, COLLECTIONS.teams, conversationId, 'messages');
            const q = query(msgsSubcollectionRef, orderBy('createdAt', 'asc'));
            const msgsSnap = await withTimeout(getDocs(q));

            rawMessages = msgsSnap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));
        }
    } catch (fetchErr: any) {
        console.warn('[CONVERSATION_SUMMARY_FETCH_WARN] Using provided conversation messages:', fetchErr?.message || fetchErr);
        if (fetchErr?.message?.includes('Unauthorized')) {
            throw fetchErr;
        }
        // Fallback to currently loaded conversation messages
        rawMessages = fallbackMessages ? [...fallbackMessages] : [];
    }

    // Merge fallback messages if Firestore returned fewer (e.g., local state has newest unindexed messages)
    if (fallbackMessages && fallbackMessages.length > 0) {
        const existingIds = new Set(rawMessages.map((m) => m.id));
        for (const fbMsg of fallbackMessages) {
            if (!existingIds.has(fbMsg.id)) {
                rawMessages.push(fbMsg);
                existingIds.add(fbMsg.id);
            }
        }
    }

    // Filter valid text messages
    const validMessages = rawMessages.filter(
        (m) => m && typeof m.text === 'string' && m.text.trim().length > 0
    );

    // Sort chronologically ascending
    validMessages.sort((a, b) => {
        const timeA = getMessageTimestampMs(a.createdAt);
        const timeB = getMessageTimestampMs(b.createdAt);
        return timeA - timeB;
    });

    const totalInConversation = validMessages.length;

    // Filter by timestamp range
    if (preset === 'ALL_MESSAGES') {
        return { messages: validMessages, totalInConversation };
    }

    if (!startDate || !endDate) {
        return { messages: validMessages, totalInConversation };
    }

    // Inclusive start and end boundaries
    const startMs = startDate.getTime();
    // Include the entire minute of the end boundary (end of that minute)
    const endMs = endDate.getTime() + 59999;

    const filtered = validMessages.filter((m) => {
        const time = getMessageTimestampMs(m.createdAt);
        if (time === 0) return true; // Include messages with pending/optimistic timestamps
        return time >= startMs && time <= endMs;
    });

    return { messages: filtered, totalInConversation };
};
