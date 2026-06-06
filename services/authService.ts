import {
    GoogleAuthProvider,
    User as FirebaseUser,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    updateEmail as updateFirebaseEmail,
    updatePassword as updateFirebasePassword,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { InvoxUser } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const emptyReputation = {
    knowledge: 0,
    contribution: 0,
    innovation: 0,
    collaboration: 0,
};

/** Build a complete, safe profile document for a new user. */
const buildUserProfile = (user: FirebaseUser, overrides: Partial<InvoxUser> = {}) => ({
    uid: user.uid,
    email: user.email,
    username: overrides.username ?? user.email?.split('@')[0] ?? 'user' + Date.now().toString().slice(-4),
    displayName: overrides.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? 'Invox User',
    photoURL: overrides.photoURL ?? user.photoURL ?? null,
    role: overrides.role ?? 'user',
    emailVerified: user.emailVerified,
    headline: overrides.headline ?? '',
    bio: overrides.bio ?? '',
    coverPhotoURL: overrides.coverPhotoURL ?? null,
    skills: overrides.skills ?? [],
    interests: overrides.interests ?? [],
    links: overrides.links ?? [],
    location: overrides.location ?? '',
    website: overrides.website ?? '',
    portfolioURL: overrides.portfolioURL ?? '',
    followerCount: overrides.followerCount ?? 0,
    followingCount: overrides.followingCount ?? 0,
    savedPostCount: overrides.savedPostCount ?? 0,
    savedProjectCount: overrides.savedProjectCount ?? 0,
    savedOpportunityCount: overrides.savedOpportunityCount ?? 0,
    reputation: overrides.reputation ?? emptyReputation,
    onboardingCompleted: overrides.onboardingCompleted ?? false,
    profileCompletion: overrides.profileCompletion ?? 0,
    createdAt: overrides.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
});

export const initializeAuthPersistence = () => setPersistence(auth, browserLocalPersistence);

/**
 * Ensure a Firestore document exists at users/{uid}.
 *
 * - If it doesn't exist: creates it with all required fields.
 * - If it exists: only syncs auth-owned fields (email, emailVerified, lastSeenAt).
 *   Never overwrites profile data the user has explicitly set.
 *
 * Includes retry logic for transient "client is offline" errors that
 * occur while Firestore is still initialising after being newly enabled.
 */
export const ensureUserProfile = async (
    user: FirebaseUser,
    overrides: Partial<InvoxUser> = {},
    retries = 3,
): Promise<void> => {
    const userRef = doc(db, 'users', user.uid);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[PROFILE_LOAD] Reading users/${user.uid} (attempt ${attempt}/${retries})`);
            const snapshot = await getDoc(userRef);

            if (!snapshot.exists()) {
                // ── NEW USER ────────────────────────────────────────────────
                const profile = buildUserProfile(user, overrides);
                console.log(`[PROFILE_CREATE] Document not found. Creating users/${user.uid}`, {
                    email: profile.email,
                    displayName: profile.displayName,
                    username: profile.username,
                });
                await setDoc(userRef, profile);
                console.log(`[PROFILE_CREATE] users/${user.uid} created successfully.`);
                return;
            }

            // ── RETURNING USER ──────────────────────────────────────────────
            // Firestore is the source of truth for profile data.
            // Only sync fields owned by Firebase Auth; never overwrite user edits.
            const existing = snapshot.data();
            console.log(`[PROFILE_LOAD] users/${user.uid} found. Syncing auth fields.`);

            await updateDoc(userRef, {
                email: user.email,
                emailVerified: user.emailVerified,
                // Prefer stored displayName; fall back to Auth only if empty
                displayName: existing.displayName || user.displayName || '',
                // Prefer stored photoURL; fall back to Auth only if empty
                photoURL: existing.photoURL || user.photoURL || null,
                updatedAt: serverTimestamp(),
                lastSeenAt: serverTimestamp(),
            });
            console.log(`[PROFILE_LOAD] users/${user.uid} synced successfully.`);
            return;

        } catch (err: any) {
            const isOffline =
                err?.code === 'unavailable' ||
                err?.message?.includes('client is offline') ||
                err?.message?.includes('Failed to get document');

            if (isOffline && attempt < retries) {
                const delay = attempt * 1500; // 1.5s, 3s
                console.warn(
                    `[PROFILE_LOAD] Firestore offline (attempt ${attempt}/${retries}). Retrying in ${delay}ms…`,
                    err.message,
                );
                await new Promise(res => setTimeout(res, delay));
                continue;
            }

            // Propagate non-recoverable errors (permissions, etc.)
            console.error(`[PROFILE_LOAD] Failed after ${attempt} attempt(s):`, err);
            throw err;
        }
    }
};

export const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
        await updateProfile(credential.user, { displayName });
    }

    await ensureUserProfile(credential.user, { displayName });
    await sendEmailVerification(credential.user);
    return credential.user;
};

export const loginWithEmail = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(credential.user);
    return credential.user;
};

export const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(credential.user);
    return credential.user;
};

export const sendResetPasswordEmail = (email: string) => sendPasswordResetEmail(auth, email);

export const logout = () => signOut(auth);

/**
 * Subscribe to real-time updates on users/{uid}.
 * On every Firestore change, `onChange` is called with the latest profile.
 * Returns an unsubscribe function.
 */
export const subscribeUserProfile = (
    uid: string,
    onChange: (profile: InvoxUser | null) => void,
    onError?: (error: Error) => void,
) => {
    console.log(`[FIRESTORE_READ] Subscribing to real-time updates: users/${uid}`);
    return onSnapshot(
        doc(db, 'users', uid),
        snapshot => {
            if (snapshot.exists()) {
                const profile = snapshot.data() as InvoxUser;
                console.log(`[PROFILE_UPDATE] Context refreshed for users/${uid}:`, {
                    displayName: profile.displayName,
                    headline: profile.headline,
                    coverPhotoURL: profile.coverPhotoURL,
                    photoURL: profile.photoURL,
                    skills: profile.skills?.length ?? 0,
                    profileCompletion: profile.profileCompletion,
                });
                onChange(profile);
            } else {
                console.warn(`[PROFILE_UPDATE] Snapshot for users/${uid} does not exist.`);
                onChange(null);
            }
        },
        error => {
            console.error(`[FIRESTORE_READ] Snapshot error for users/${uid}:`, error);
            onError?.(error);
        },
    );
};

export const updateUserEmail = async (user: FirebaseUser, newEmail: string) => {
    await updateFirebaseEmail(user, newEmail);
    await updateDoc(doc(db, 'users', user.uid), { email: newEmail, updatedAt: serverTimestamp() });
};

export const updateUserPassword = async (user: FirebaseUser, newPassword: string) => {
    await updateFirebasePassword(user, newPassword);
};
