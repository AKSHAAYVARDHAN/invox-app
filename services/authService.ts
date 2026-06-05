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
    displayName: overrides.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? 'Invox User',
    photoURL: overrides.photoURL ?? user.photoURL,
    role: overrides.role ?? 'user',
    emailVerified: user.emailVerified,
    bio: overrides.bio ?? '',
    coverPhotoURL: overrides.coverPhotoURL ?? null,
    skills: overrides.skills ?? [],
    interests: overrides.interests ?? [],
    links: overrides.links ?? [],
    followerCount: overrides.followerCount ?? 0,
    followingCount: overrides.followingCount ?? 0,
    savedPostCount: overrides.savedPostCount ?? 0,
    savedProjectCount: overrides.savedProjectCount ?? 0,
    savedOpportunityCount: overrides.savedOpportunityCount ?? 0,
    reputation: overrides.reputation ?? emptyReputation,
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

    await updateDoc(userRef, {
        email: user.email,
        displayName: user.displayName ?? snapshot.data().displayName,
        photoURL: user.photoURL ?? snapshot.data().photoURL ?? null,
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
