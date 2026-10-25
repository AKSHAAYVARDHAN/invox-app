import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import type { InvoxUser } from '../types';

/**
 * Checks whether an InvoxUser is currently considered "Recently Active".
 * 
 * Rules:
 * 1. User must exist.
 * 2. User's privacy settings must not have disabled online telemetry (showOnlineStatus !== false).
 * 3. User's lastSeenAt timestamp must be within maxAgeMinutes (default: 20 minutes).
 * 4. Stale presence or missing timestamp returns false.
 */
export const isUserRecentlyActive = (
    user: InvoxUser | null | undefined,
    maxAgeMinutes = 20
): boolean => {
    if (!user) return false;

    // Check privacy preference
    const privacy = (user as any).privacySettings;
    if (privacy && privacy.showOnlineStatus === false) {
        return false;
    }

    const ts = (user as any).lastSeenAt;
    if (!ts) return false;

    let millis = 0;
    if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof ts.toMillis === 'function') {
        millis = ts.toMillis();
    } else if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof ts.toDate === 'function') {
        millis = ts.toDate().getTime();
    } else if (typeof ts === 'number') {
        millis = ts;
    } else if (typeof ts === 'string') {
        millis = new Date(ts).getTime();
    }

    if (!millis || isNaN(millis)) return false;

    const elapsedMinutes = (Date.now() - millis) / (1000 * 60);
    return elapsedMinutes >= 0 && elapsedMinutes <= maxAgeMinutes;
};

/**
 * Formats a relative activity string for display on the node telemetry card.
 */
export const formatLastActiveString = (lastSeenAt: any): string => {
    if (!lastSeenAt) return 'OFFLINE // NO TELEMETRY';

    let millis = 0;
    if (typeof lastSeenAt === 'object' && lastSeenAt !== null && 'toMillis' in lastSeenAt && typeof lastSeenAt.toMillis === 'function') {
        millis = lastSeenAt.toMillis();
    } else if (typeof lastSeenAt === 'object' && lastSeenAt !== null && 'toDate' in lastSeenAt && typeof lastSeenAt.toDate === 'function') {
        millis = lastSeenAt.toDate().getTime();
    } else if (typeof lastSeenAt === 'number') {
        millis = lastSeenAt;
    } else if (typeof lastSeenAt === 'string') {
        millis = new Date(lastSeenAt).getTime();
    }

    if (!millis || isNaN(millis)) return 'OFFLINE';

    const diffMinutes = Math.floor((Date.now() - millis) / (1000 * 60));
    if (diffMinutes < 3) return 'ACTIVE NOW';
    if (diffMinutes < 60) return `ACTIVE ${diffMinutes}M AGO`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `ACTIVE ${diffHours}H AGO`;
    const diffDays = Math.floor(diffHours / 24);
    return `ACTIVE ${diffDays}D AGO`;
};

/**
 * Updates the user's presence timestamp in Firestore.
 */
export const touchUserPresence = async (uid: string): Promise<void> => {
    if (!uid) return;
    try {
        const userRef = doc(db, COLLECTIONS.users, uid);
        await updateDoc(userRef, {
            lastSeenAt: serverTimestamp(),
        });
    } catch (e) {
        // Non-blocking warning (transient offline or security rule)
        console.warn('[PRESENCE] Non-blocking presence update warning:', e);
    }
};
