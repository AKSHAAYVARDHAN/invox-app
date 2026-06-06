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

const buildUserProfile = (user: FirebaseUser, overrides: Partial<InvoxUser> = {}) => ({
    uid: user.uid,
    email: user.email,
    username: overrides.username ?? user.email?.split('@')[0] ?? 'user' + Date.now().toString().slice(-4),
    displayName: overrides.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? 'Invox User',
    photoURL: overrides.photoURL ?? user.photoURL,
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

export const ensureUserProfile = async (user: FirebaseUser, overrides: Partial<InvoxUser> = {}) => {
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        await setDoc(userRef, buildUserProfile(user, overrides));
        return;
    }

    // On subsequent logins, only sync fields that Firestore doesn't own yet.
    // Never overwrite displayName or photoURL that the user has explicitly saved —
    // the Firestore document is the source of truth for profile data.
    const existing = snapshot.data();
    await updateDoc(userRef, {
        email: user.email,
        // Prefer the stored displayName; only fall back to Auth if Firestore has nothing
        displayName: existing.displayName || user.displayName || existing.displayName,
        // Prefer stored photoURL; only use Auth photoURL if Firestore has nothing
        photoURL: existing.photoURL || user.photoURL || null,
        emailVerified: user.emailVerified,
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
    });
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

export const subscribeUserProfile = (
    uid: string,
    onChange: (profile: InvoxUser | null) => void,
    onError?: (error: Error) => void,
) => {
    return onSnapshot(
        doc(db, 'users', uid),
        snapshot => onChange(snapshot.exists() ? snapshot.data() as InvoxUser : null),
        error => onError?.(error),
    );
};

export const updateUserEmail = async (user: FirebaseUser, newEmail: string) => {
    await updateFirebaseEmail(user, newEmail);
    // Sync to Firestore
    await updateDoc(doc(db, 'users', user.uid), { email: newEmail });
};

export const updateUserPassword = async (user: FirebaseUser, newPassword: string) => {
    await updateFirebasePassword(user, newPassword);
};
