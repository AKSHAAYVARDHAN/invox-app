import {
    doc,
    getDoc,
    getDocs,
    collection,
    runTransaction,
    serverTimestamp,
    limit,
    query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import type { InvoxIdLookupResult, InvoxUser } from '../types';

/**
 * Prefix for all public human-readable INVOX IDs.
 */
export const INVOX_ID_PREFIX = 'IVX-';

/**
 * 32-character Crockford Base32-inspired alphabet.
 * Excludes confusing characters '0', 'O', '1', 'I' to prevent reading/typing mistakes.
 * 32^6 = 1,073,741,824 unique IDs in 6 characters.
 */
export const INVOX_ID_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const INVOX_ID_BODY_LENGTH = 6;

/**
 * Strict regex for validated INVOX ID format.
 */
export const INVOX_ID_REGEX = /^IVX-[2-9A-HJ-NP-Z]{6}$/;

/**
 * Generates a candidate INVOX ID using uniform random selection over the unambiguous charset.
 * Format: IVX-XXXXXX (e.g. IVX-7K9P2M)
 */
export const generateCandidateInvoxId = (): string => {
    let result = '';
    const charsetLength = INVOX_ID_CHARSET.length;

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const randomValues = new Uint8Array(INVOX_ID_BODY_LENGTH);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < INVOX_ID_BODY_LENGTH; i++) {
            result += INVOX_ID_CHARSET[randomValues[i] % charsetLength];
        }
    } else {
        for (let i = 0; i < INVOX_ID_BODY_LENGTH; i++) {
            const randomIndex = Math.floor(Math.random() * charsetLength);
            result += INVOX_ID_CHARSET[randomIndex];
        }
    }

    return `${INVOX_ID_PREFIX}${result}`;
};

/**
 * Normalizes user input into canonical IVX-XXXXXX format.
 * Tolerates:
 * - Leading/trailing spaces
 * - Lowercase letters (converts to uppercase)
 * - Missing 'IVX-' prefix (e.g. '7k9p2m' -> 'IVX-7K9P2M')
 * - Spaces or dashes (e.g. 'IVX 7K9P2M', 'ivx-7k9p2m')
 *
 * Returns the normalized ID if valid, or null if invalid format.
 */
export const normalizeInvoxId = (rawInput?: string | null): string | null => {
    if (!rawInput || typeof rawInput !== 'string') return null;

    // Trim and uppercase
    let cleaned = rawInput.trim().toUpperCase();

    // Replace internal spaces, underscores, colons with empty string
    cleaned = cleaned.replace(/[\s_:]/g, '');

    // Strip IVX- or IVX prefix if present
    if (cleaned.startsWith('IVX-')) {
        cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('IVX')) {
        cleaned = cleaned.slice(3);
    }

    // Strip any remaining leading/trailing dashes
    cleaned = cleaned.replace(/^-+|-+$/g, '');

    // The body must be exactly 6 characters from the allowed charset
    if (cleaned.length !== INVOX_ID_BODY_LENGTH) {
        return null;
    }

    // Check if every character is in the allowed charset
    for (let i = 0; i < cleaned.length; i++) {
        if (!INVOX_ID_CHARSET.includes(cleaned[i])) {
            return null;
        }
    }

    const canonical = `${INVOX_ID_PREFIX}${cleaned}`;
    return INVOX_ID_REGEX.test(canonical) ? canonical : null;
};

/**
 * Validates whether an ID string strictly matches the canonical format IVX-XXXXXX.
 */
export const isValidInvoxIdFormat = (id?: string | null): boolean => {
    if (!id || typeof id !== 'string') return false;
    return INVOX_ID_REGEX.test(id.trim());
};

/**
 * Atomically allocates a permanent, unique INVOX ID for a given user UID using a Firestore transaction.
 *
 * Guarantees:
 * 1. Idempotency: If the user already has an INVOX ID, returns the existing ID without modifying it.
 * 2. Uniqueness: Checks the global `invoxIds/{id}` registry inside the transaction. If a collision
 *    occurs, retries with a new random candidate.
 * 3. Atomic reservation: Sets `invoxIds/{id}` and updates `users/{uid}` in the same transaction.
 * 4. Permanence: Once assigned, the ID is never altered.
 */
export const allocateInvoxIdForUser = async (uid: string, maxAttempts = 5): Promise<string> => {
    if (!uid) {
        throw new Error('User UID is required for INVOX ID allocation.');
    }

    const userDocRef = doc(db, COLLECTIONS.users, uid);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const allocatedId = await runTransaction(db, async (transaction) => {
                const userSnapshot = await transaction.get(userDocRef);

                if (!userSnapshot.exists()) {
                    throw new Error(`Cannot allocate INVOX ID: User profile users/${uid} does not exist.`);
                }

                const userData = userSnapshot.data();

                // Idempotent check: Return existing ID if already provisioned
                if (userData.invoxId && isValidInvoxIdFormat(userData.invoxId)) {
                    console.log(`[INVOX_ID] User ${uid} already has assigned ID: ${userData.invoxId}`);
                    return userData.invoxId as string;
                }

                // Generate a candidate ID
                const candidateId = generateCandidateInvoxId();
                const invoxIdDocRef = doc(db, COLLECTIONS.invoxIds, candidateId);
                const invoxIdSnapshot = await transaction.get(invoxIdDocRef);

                if (invoxIdSnapshot.exists()) {
                    // Collision detected! Throw to trigger retry
                    console.warn(`[INVOX_ID] Collision on candidate ${candidateId}, retrying attempt ${attempt}...`);
                    throw new Error(`COLLISION:${candidateId}`);
                }

                // Atomic writes:
                // 1. Reserve the public ID in the global registry
                transaction.set(invoxIdDocRef, {
                    invoxId: candidateId,
                    uid: uid,
                    createdAt: serverTimestamp(),
                });

                // 2. Attach the permanent ID to the user document
                transaction.update(userDocRef, {
                    invoxId: candidateId,
                    updatedAt: serverTimestamp(),
                });

                return candidateId;
            });

            console.log(`[INVOX_ID] Successfully allocated ${allocatedId} for user ${uid}`);
            return allocatedId;
        } catch (err: any) {
            const isCollision = err?.message?.startsWith('COLLISION:');
            if (isCollision && attempt < maxAttempts) {
                // Short backoff before next attempt
                await new Promise((res) => setTimeout(res, 50 * attempt));
                continue;
            }

            console.error(`[INVOX_ID_ERROR] Allocation failed for user ${uid} (attempt ${attempt}/${maxAttempts}):`, err);
            throw err;
        }
    }

    throw new Error('Failed to allocate unique INVOX ID after maximum attempts.');
};

/**
 * Ensures a user has an INVOX ID. Safe to call on profile load.
 */
export const ensureUserInvoxId = async (uid: string): Promise<string | null> => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, COLLECTIONS.users, uid);
        const snapshot = await getDoc(userDocRef);

        if (!snapshot.exists()) return null;

        const data = snapshot.data();
        if (data.invoxId && isValidInvoxIdFormat(data.invoxId)) {
            return data.invoxId;
        }

        // Allocate missing ID
        return await allocateInvoxIdForUser(uid);
    } catch (err) {
        console.warn(`[INVOX_ID_WARN] ensureUserInvoxId non-fatal error for ${uid}:`, err);
        return null;
    }
};

/**
 * Looks up a user by their INVOX ID.
 * Performs direct, O(1) single-document read against the `invoxIds` collection,
 * then fetches the canonical profile from `users/{uid}`.
 *
 * Strictly sanitizes private fields (email, phone, etc.) to protect privacy.
 */
export const lookupUserByInvoxId = async (rawInput: string): Promise<InvoxIdLookupResult> => {
    const normalizedId = normalizeInvoxId(rawInput);

    if (!normalizedId) {
        return {
            success: false,
            error: 'INVALID_FORMAT',
            message: 'Please enter a valid INVOX ID (e.g. IVX-7K9P2M). 6 alphanumeric characters required.',
        };
    }

    try {
        console.log(`[INVOX_ID_LOOKUP] Querying global registry for ID: ${normalizedId}`);
        const invoxIdDocRef = doc(db, COLLECTIONS.invoxIds, normalizedId);
        const invoxIdSnap = await getDoc(invoxIdDocRef);

        if (!invoxIdSnap.exists()) {
            return {
                success: false,
                invoxId: normalizedId,
                error: 'NOT_FOUND',
                message: `No INVOX member found with ID "${normalizedId}". Please verify the ID and try again.`,
            };
        }

        const mapping = invoxIdSnap.data();
        const targetUid = mapping.uid;

        if (!targetUid || typeof targetUid !== 'string') {
            return {
                success: false,
                invoxId: normalizedId,
                error: 'ACCOUNT_UNAVAILABLE',
                message: 'This INVOX ID is not currently linked to an active account.',
            };
        }

        console.log(`[INVOX_ID_LOOKUP] Resolved ${normalizedId} -> UID: ${targetUid}`);
        const userDocRef = doc(db, COLLECTIONS.users, targetUid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            return {
                success: false,
                invoxId: normalizedId,
                uid: targetUid,
                error: 'ACCOUNT_UNAVAILABLE',
                message: 'The account associated with this INVOX ID has been removed or is unavailable.',
            };
        }

        const rawUserData = userSnap.data() as InvoxUser;

        // Privacy defense: strictly whitelist public fields only
        const sanitizedUser: Partial<InvoxUser> & { uid: string; invoxId: string } = {
            uid: targetUid,
            invoxId: normalizedId,
            username: rawUserData.username || 'member',
            displayName: rawUserData.displayName || 'Invox Member',
            headline: rawUserData.headline || '',
            bio: rawUserData.bio || '',
            photoURL: rawUserData.photoURL || null,
            coverPhotoURL: rawUserData.coverPhotoURL || null,
            skills: Array.isArray(rawUserData.skills) ? rawUserData.skills : [],
            interests: Array.isArray(rawUserData.interests) ? rawUserData.interests : [],
            location: rawUserData.location || '',
            website: rawUserData.website || '',
            portfolioURL: rawUserData.portfolioURL || '',
            followerCount: typeof rawUserData.followerCount === 'number' ? rawUserData.followerCount : 0,
            followingCount: typeof rawUserData.followingCount === 'number' ? rawUserData.followingCount : 0,
            reputation: rawUserData.reputation || { knowledge: 0, contribution: 0, innovation: 0, collaboration: 0 },
            role: rawUserData.role || 'user',
            profileCompletion: rawUserData.profileCompletion || 0,
            createdAt: rawUserData.createdAt,
        };

        return {
            success: true,
            invoxId: normalizedId,
            uid: targetUid,
            user: sanitizedUser,
        };
    } catch (err: any) {
        console.error(`[INVOX_ID_LOOKUP_ERROR] Lookup failed for ${normalizedId}:`, err);
        return {
            success: false,
            invoxId: normalizedId,
            error: 'LOOKUP_FAILED',
            message: 'Unable to complete search due to a network or service issue. Please try again.',
        };
    }
};

/**
 * Migration helper: Scans users collection and safely backfills missing INVOX IDs.
 * Safe to rerun repeatedly; never overwrites existing IDs.
 */
export const migrateUsersWithoutInvoxId = async (
    batchLimit = 50
): Promise<{ checked: number; allocated: number; alreadyHadId: number; errors: number }> => {
    console.log('[INVOX_ID_MIGRATION] Starting idempotent INVOX ID migration...');
    const usersColRef = collection(db, COLLECTIONS.users);
    const usersSnapshot = await getDocs(query(usersColRef, limit(batchLimit)));

    let checked = 0;
    let allocated = 0;
    let alreadyHadId = 0;
    let errors = 0;

    for (const userDoc of usersSnapshot.docs) {
        checked++;
        const userData = userDoc.data();
        const uid = userDoc.id;

        if (userData.invoxId && isValidInvoxIdFormat(userData.invoxId)) {
            alreadyHadId++;
            // Check if mapping in invoxIds exists; if not, backfill mapping
            try {
                const mappingRef = doc(db, COLLECTIONS.invoxIds, userData.invoxId);
                const mappingSnap = await getDoc(mappingRef);
                if (!mappingSnap.exists()) {
                    console.log(`[INVOX_ID_MIGRATION] Backfilling missing mapping for ${userData.invoxId}`);
                    await runTransaction(db, async (tx) => {
                        tx.set(mappingRef, {
                            invoxId: userData.invoxId,
                            uid: uid,
                            createdAt: serverTimestamp(),
                        });
                    });
                }
            } catch (mappingErr) {
                console.warn('[INVOX_ID_MIGRATION] Mapping check error:', mappingErr);
            }
            continue;
        }

        try {
            console.log(`[INVOX_ID_MIGRATION] Allocating missing ID for user ${uid}...`);
            await allocateInvoxIdForUser(uid);
            allocated++;
        } catch (err) {
            console.error(`[INVOX_ID_MIGRATION] Failed to allocate ID for user ${uid}:`, err);
            errors++;
        }
    }

    console.log('[INVOX_ID_MIGRATION] Migration complete:', { checked, allocated, alreadyHadId, errors });
    return { checked, allocated, alreadyHadId, errors };
};
