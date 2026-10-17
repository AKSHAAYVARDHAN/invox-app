import {
    doc,
    getDoc,
    collection,
    query,
    where,
    limit,
    getDocs,
    runTransaction,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import type { InvoxUser } from '../types';

export const USERNAMES_COLLECTION = 'usernames';

export const RESERVED_USERNAMES = new Set([
    'admin',
    'administrator',
    'support',
    'invox',
    'invoxapp',
    'official',
    'moderator',
    'mod',
    'security',
    'system',
    'root',
    'help',
    'staff',
    'team',
    'billing',
    'contact',
    'developer',
    'explore',
    'trendz',
    'spotlight',
    'communities',
    'hub',
    'myspace',
    'settings',
    'profile',
    'notifications',
    'auth',
    'login',
    'signup',
    'logout',
    'api',
]);

/**
 * Valid username rule:
 * - 3–24 characters
 * - lowercase letters, numbers, and underscores
 * - No spaces
 * - No leading or trailing underscore
 */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,22}[a-z0-9]$/;

export type UsernameValidationStatus =
    | 'idle'
    | 'checking'
    | 'available'
    | 'taken'
    | 'reserved'
    | 'invalid_format'
    | 'unchanged';

export interface UsernameCheckResult {
    normalized: string;
    isValid: boolean;
    status: UsernameValidationStatus;
    message: string;
    isCurrent: boolean;
}

/**
 * Normalizes a username:
 * - strips leading '@'
 * - trims whitespace
 * - converts to lowercase
 */
export const normalizeUsername = (raw: string): string => {
    if (!raw) return '';
    let val = raw.trim().toLowerCase();
    if (val.startsWith('@')) {
        val = val.slice(1);
    }
    return val.trim();
};

/**
 * Validates a username against length, character, and structure rules.
 */
export const validateUsernameFormat = (raw: string): { isValid: boolean; error?: string } => {
    const normalized = normalizeUsername(raw);

    if (!normalized) {
        return { isValid: false, error: 'Username cannot be empty.' };
    }

    if (normalized.length < 3) {
        return { isValid: false, error: 'Username must be at least 3 characters.' };
    }

    if (normalized.length > 24) {
        return { isValid: false, error: 'Username cannot exceed 24 characters.' };
    }

    if (normalized.startsWith('_') || normalized.endsWith('_')) {
        return { isValid: false, error: 'Username cannot start or end with an underscore.' };
    }

    if (/\s/.test(normalized)) {
        return { isValid: false, error: 'Username cannot contain spaces.' };
    }

    if (!/^[a-z0-9_]+$/.test(normalized)) {
        return { isValid: false, error: 'Only lowercase letters, numbers, and underscores are allowed.' };
    }

    if (!USERNAME_REGEX.test(normalized)) {
        return { isValid: false, error: 'Invalid username format.' };
    }

    return { isValid: true };
};

/**
 * Checks if a username is in the reserved list.
 */
export const isUsernameReserved = (raw: string): boolean => {
    const normalized = normalizeUsername(raw);
    return RESERVED_USERNAMES.has(normalized);
};

/**
 * Checks live availability of a proposed username.
 * Returns detailed status, including whether it's already the current user's username.
 */
export const checkUsernameAvailability = async (
    rawUsername: string,
    currentUserId?: string | null,
    currentUserExistingUsername?: string | null,
): Promise<UsernameCheckResult> => {
    const normalized = normalizeUsername(rawUsername);
    const normalizedExisting = currentUserExistingUsername ? normalizeUsername(currentUserExistingUsername) : null;

    if (!normalized) {
        return {
            normalized: '',
            isValid: false,
            status: 'invalid_format',
            message: 'Username cannot be empty',
            isCurrent: false,
        };
    }

    // Check if unchanged for current user
    if (normalizedExisting && normalized === normalizedExisting) {
        return {
            normalized,
            isValid: true,
            status: 'unchanged',
            message: 'Current username',
            isCurrent: true,
        };
    }

    // Validate format
    const formatCheck = validateUsernameFormat(normalized);
    if (!formatCheck.isValid) {
        return {
            normalized,
            isValid: false,
            status: 'invalid_format',
            message: formatCheck.error || 'Invalid username format',
            isCurrent: false,
        };
    }

    // Check reserved
    if (isUsernameReserved(normalized)) {
        return {
            normalized,
            isValid: false,
            status: 'reserved',
            message: 'This username is reserved',
            isCurrent: false,
        };
    }

    try {
        const usernameRef = doc(db, USERNAMES_COLLECTION, normalized);
        const snap = await getDoc(usernameRef);

        if (!snap.exists()) {
            return {
                normalized,
                isValid: true,
                status: 'available',
                message: 'Username available',
                isCurrent: false,
            };
        }

        const data = snap.data();
        if (currentUserId && data?.uid === currentUserId) {
            return {
                normalized,
                isValid: true,
                status: 'unchanged',
                message: 'Current username',
                isCurrent: true,
            };
        }

        return {
            normalized,
            isValid: false,
            status: 'taken',
            message: 'Username already taken',
            isCurrent: false,
        };
    } catch (err) {
        console.warn('[USERNAME_CHECK_ERROR]', err);
        // Fallback: check users collection
        try {
            const q = query(
                collection(db, COLLECTIONS.users),
                where('username', '==', normalized),
                limit(1),
            );
            const userDocs = await getDocs(q);
            if (userDocs.empty) {
                return {
                    normalized,
                    isValid: true,
                    status: 'available',
                    message: 'Username available',
                    isCurrent: false,
                };
            }
            const foundUser = userDocs.docs[0];
            if (currentUserId && foundUser.id === currentUserId) {
                return {
                    normalized,
                    isValid: true,
                    status: 'unchanged',
                    message: 'Current username',
                    isCurrent: true,
                };
            }
            return {
                normalized,
                isValid: false,
                status: 'taken',
                message: 'Username already taken',
                isCurrent: false,
            };
        } catch (fallbackErr) {
            console.error('[USERNAME_CHECK_FALLBACK_ERROR]', fallbackErr);
            return {
                normalized,
                isValid: false,
                status: 'invalid_format',
                message: 'Unable to check availability at this time',
                isCurrent: false,
            };
        }
    }
};

/**
 * Generates verified available alternative usernames based on a preferred username.
 * Every alternative returned is guaranteed to have passed format and availability checks.
 */
export const suggestAlternativeUsernames = async (
    preferredRaw: string,
    targetCount = 4,
): Promise<string[]> => {
    let base = normalizeUsername(preferredRaw).replace(/[^a-z0-9_]/g, '');
    if (!base) base = 'invox_dev';
    // Trim leading/trailing underscores from base
    base = base.replace(/^_+|_+$/g, '');
    if (base.length < 3) base = `${base}user`;
    if (base.length > 18) base = base.slice(0, 18);

    const candidateGenerators: (() => string)[] = [
        () => `${base}_${Math.floor(Math.random() * 90) + 10}`,
        () => `${base}${Math.floor(Math.random() * 9) + 1}`,
        () => `the_${base}`,
        () => `the${base}`,
        () => `${base}_dev`,
        () => `${base}_hq`,
        () => `${base}_01`,
        () => `${base}_7`,
        () => `iam_${base}`,
        () => `${base}_pro`,
        () => `${base}_x`,
        () => `${base}_real`,
    ];

    const candidates = new Set<string>();

    for (const gen of candidateGenerators) {
        if (candidates.size >= targetCount * 3) break;
        const cand = normalizeUsername(gen());
        if (validateUsernameFormat(cand).isValid && !isUsernameReserved(cand)) {
            candidates.add(cand);
        }
    }

    const availableSuggestions: string[] = [];

    // Verify availability in parallel batches
    for (const candidate of candidates) {
        if (availableSuggestions.length >= targetCount) break;
        try {
            const check = await checkUsernameAvailability(candidate);
            if (check.status === 'available') {
                availableSuggestions.push(candidate);
            }
        } catch {
            // Ignore failure on candidate check
        }
    }

    // If still short, generate fallback timestamps
    let attempt = 1;
    while (availableSuggestions.length < targetCount && attempt <= 5) {
        const fallback = `${base.slice(0, 15)}_${Date.now().toString().slice(-4)}`;
        if (validateUsernameFormat(fallback).isValid && !availableSuggestions.includes(fallback)) {
            const check = await checkUsernameAvailability(fallback);
            if (check.status === 'available') {
                availableSuggestions.push(fallback);
            }
        }
        attempt++;
    }

    return availableSuggestions.slice(0, targetCount);
};

/**
 * Claims a username atomically in Firestore via runTransaction.
 * - Atomically claims `usernames/{newNormalizedUsername}`
 * - Updates `users/{uid}` with `username` and any other user fields
 * - Releases old `usernames/{oldNormalizedUsername}` if changing
 * - Fails safely if username is taken by another account
 */
export const claimUsername = async (
    uid: string,
    rawUsername: string,
    additionalUserFields: Record<string, any> = {},
): Promise<{ success: boolean; username: string }> => {
    if (!uid) {
        throw new Error('Authentication required to claim a username.');
    }

    const newNormalized = normalizeUsername(rawUsername);

    const validation = validateUsernameFormat(newNormalized);
    if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid username format.');
    }

    if (isUsernameReserved(newNormalized)) {
        throw new Error(`The username '${newNormalized}' is reserved and cannot be claimed.`);
    }

    const userRef = doc(db, COLLECTIONS.users, uid);
    const newUsernameRef = doc(db, USERNAMES_COLLECTION, newNormalized);

    await runTransaction(db, async transaction => {
        // 1. Read existing user profile
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data() as InvoxUser | undefined;
        const oldRaw = userData?.username;
        const oldNormalized = oldRaw ? normalizeUsername(oldRaw) : null;

        // If username is identical to what user already has, just update additional fields
        if (oldNormalized && oldNormalized === newNormalized) {
            // Ensure username doc exists for user
            const currentUsernameSnap = await transaction.get(newUsernameRef);
            if (!currentUsernameSnap.exists()) {
                transaction.set(newUsernameRef, {
                    uid,
                    username: newNormalized,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
            transaction.update(userRef, {
                ...additionalUserFields,
                username: newNormalized,
                updatedAt: serverTimestamp(),
            });
            return;
        }

        // 2. Read new proposed username doc
        const newUsernameSnap = await transaction.get(newUsernameRef);
        if (newUsernameSnap.exists()) {
            const existingMapping = newUsernameSnap.data();
            if (existingMapping?.uid !== uid) {
                throw new Error(`This username is already taken. Please choose another username.`);
            }
        }

        // 3. Read old username doc if it existed
        let oldUsernameRef: any = null;
        let oldUsernameSnap: any = null;
        if (oldNormalized && oldNormalized !== newNormalized) {
            oldUsernameRef = doc(db, USERNAMES_COLLECTION, oldNormalized);
            oldUsernameSnap = await transaction.get(oldUsernameRef);
        }

        // 4. Perform atomic writes
        // Claim new username
        transaction.set(newUsernameRef, {
            uid,
            username: newNormalized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Release old username if it belongs to current user
        if (oldUsernameRef && oldUsernameSnap && oldUsernameSnap.exists()) {
            const oldData = oldUsernameSnap.data();
            if (oldData?.uid === uid) {
                transaction.delete(oldUsernameRef);
            }
        }

        // Update user profile
        transaction.update(userRef, {
            ...additionalUserFields,
            username: newNormalized,
            updatedAt: serverTimestamp(),
        });
    });

    console.log(`[USERNAME_CLAIM_SUCCESS] Successfully claimed username '${newNormalized}' for user ${uid}`);
    return { success: true, username: newNormalized };
};

/**
 * Ensures a valid, unique username mapping for a user.
 * Used during user onboarding / profile creation.
 */
export const ensureUserUsernameMapping = async (
    uid: string,
    desiredRaw?: string | null,
    userEmail?: string | null,
): Promise<string> => {
    let candidate = desiredRaw ? normalizeUsername(desiredRaw) : '';
    if (!candidate && userEmail) {
        candidate = normalizeUsername(userEmail.split('@')[0]);
    }
    if (!candidate) {
        candidate = `user_${uid.slice(0, 6).toLowerCase()}`;
    }

    // Clean characters
    candidate = candidate.replace(/[^a-z0-9_]/g, '');
    candidate = candidate.replace(/^_+|_+$/g, '');
    if (candidate.length < 3) candidate = `${candidate}123`;
    if (candidate.length > 20) candidate = candidate.slice(0, 20);

    // Try claiming preferred candidate, if taken append suffix
    let currentAttempt = candidate;
    let suffix = 1;

    while (suffix <= 25) {
        try {
            const availability = await checkUsernameAvailability(currentAttempt, uid);
            if (availability.status === 'available' || availability.status === 'unchanged') {
                const usernameRef = doc(db, USERNAMES_COLLECTION, currentAttempt);
                await setDoc(
                    usernameRef,
                    {
                        uid,
                        username: currentAttempt,
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true },
                );
                return currentAttempt;
            }
        } catch {
            // continue trying
        }

        currentAttempt = `${candidate.slice(0, 18)}_${suffix}`;
        suffix++;
    }

    // Fallback safe timestamp
    const fallback = `user_${Date.now().toString().slice(-6)}`;
    await setDoc(doc(db, USERNAMES_COLLECTION, fallback), {
        uid,
        username: fallback,
        updatedAt: serverTimestamp(),
    });
    return fallback;
};

/**
 * Resolves a username or handle to a canonical Firebase User UID.
 */
export const resolveUsernameToUid = async (rawInput: string): Promise<string | null> => {
    if (!rawInput) return null;
    const normalized = normalizeUsername(rawInput);
    if (!normalized) return null;

    try {
        // 1. Direct O(1) lookup in usernames collection
        const usernameRef = doc(db, USERNAMES_COLLECTION, normalized);
        const snap = await getDoc(usernameRef);
        if (snap.exists() && snap.data()?.uid) {
            return snap.data().uid;
        }

        // 2. Fallback: check users collection
        const q = query(
            collection(db, COLLECTIONS.users),
            where('username', '==', normalized),
            limit(1),
        );
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            const foundUid = querySnap.docs[0].id;
            // Backfill mapping in background for performance
            setDoc(
                usernameRef,
                {
                    uid: foundUid,
                    username: normalized,
                    updatedAt: serverTimestamp(),
                },
                { merge: true },
            ).catch(console.warn);

            return foundUid;
        }
    } catch (e) {
        console.warn('[RESOLVE_USERNAME_ERROR]', e);
    }

    return null;
};

/**
 * Searches users by username prefix or exact match.
 */
export const searchUsersByUsername = async (
    searchQuery: string,
    limitCount = 10,
): Promise<Array<{ uid: string; username: string; displayName?: string; photoURL?: string | null; headline?: string }>> => {
    const normalized = normalizeUsername(searchQuery);
    if (!normalized || normalized.length < 2) return [];

    try {
        // Search in users collection
        const q = query(
            collection(db, COLLECTIONS.users),
            where('username', '>=', normalized),
            where('username', '<=', normalized + '\uf8ff'),
            limit(limitCount),
        );

        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data() as InvoxUser;
            return {
                uid: d.id,
                username: data.username || d.id,
                displayName: data.displayName || 'Invox Member',
                photoURL: data.photoURL || null,
                headline: data.headline || '',
            };
        });
    } catch (err) {
        console.warn('[SEARCH_USERS_BY_USERNAME_WARN]', err);
        return [];
    }
};

/**
 * Migration helper: inspects existing users and safely initializes username mappings.
 * Safe to retry, non-destructive, does not overwrite existing valid usernames.
 */
export const migrateExistingUsernames = async (): Promise<{ scanned: number; mapped: number; errors: number }> => {
    let scanned = 0;
    let mapped = 0;
    let errors = 0;

    try {
        const usersSnap = await getDocs(collection(db, COLLECTIONS.users));
        scanned = usersSnap.size;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data() as InvoxUser;
            const uid = userDoc.id;
            let rawUsername = userData.username;

            if (!rawUsername) {
                rawUsername = userData.email?.split('@')[0] || `user_${uid.slice(0, 6)}`;
            }

            const normalized = normalizeUsername(rawUsername);
            if (!normalized) continue;

            try {
                const usernameRef = doc(db, USERNAMES_COLLECTION, normalized);
                const existingSnap = await getDoc(usernameRef);

                if (!existingSnap.exists()) {
                    await setDoc(usernameRef, {
                        uid,
                        username: normalized,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                    mapped++;
                } else if (existingSnap.data()?.uid === uid) {
                    // Already properly mapped
                } else {
                    // Conflicting duplicate: assign a unique suffix to this account without deleting user data
                    const uniqueSuffixUsername = `${normalized.slice(0, 18)}_${Date.now().toString().slice(-4)}`;
                    await setDoc(doc(db, USERNAMES_COLLECTION, uniqueSuffixUsername), {
                        uid,
                        username: uniqueSuffixUsername,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                    await setDoc(userDoc.ref, { username: uniqueSuffixUsername }, { merge: true });
                    mapped++;
                }
            } catch (docErr) {
                console.error(`[MIGRATE_USER_ERROR] ${uid}:`, docErr);
                errors++;
            }
        }
    } catch (e) {
        console.error('[MIGRATE_EXISTING_USERNAMES_ERROR]', e);
    }

    return { scanned, mapped, errors };
};
