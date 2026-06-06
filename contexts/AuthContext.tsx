import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { ensureUserProfile, initializeAuthPersistence, subscribeUserProfile } from '../services/authService';
import type { InvoxUser, UserRole } from '../types';

interface AuthContextType {
    currentUser: FirebaseUser | null;
    userProfile: InvoxUser | null;
    role: UserRole | null;
    isModerator: boolean;
    isAdmin: boolean;
    loading: boolean;
    /** Call this to manually force a re-subscribe to the profile snapshot. */
    refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    userProfile: null,
    role: null,
    isModerator: false,
    isAdmin: false,
    loading: true,
    refreshProfile: () => {},
});

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<InvoxUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileKey, setProfileKey] = useState(0); // increment to force re-subscribe

    /** Exposed to consumers who need to manually trigger a profile refresh. */
    const refreshProfile = useCallback(() => {
        console.log('[PROFILE_UPDATE] Manual refresh requested.');
        setProfileKey(k => k + 1);
    }, []);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        initializeAuthPersistence().catch(error => {
            // Non-fatal — IndexedDB may be unavailable in private mode
            console.warn('[AUTH] Could not initialise auth persistence:', error.message);
        });

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            // Tear down any existing profile subscription before handling the new auth state
            unsubscribeProfile?.();
            unsubscribeProfile = null;

            setCurrentUser(user);

            if (!user) {
                console.log('[PROFILE_LOAD] User signed out. Clearing profile.');
                setUserProfile(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            console.log(`[PROFILE_LOAD] Auth state change — uid: ${user.uid}`);

            try {
                // Ensure the Firestore document exists (creates it if new, syncs if returning).
                // This call has built-in retry logic for transient "client is offline" errors.
                await ensureUserProfile(user);
            } catch (err: any) {
                // ensureUserProfile failed after all retries.
                // Do NOT block the UI — show the app with whatever Auth data we have.
                console.error('[PROFILE_LOAD] ensureUserProfile failed (non-fatal):', err.message);
            }

            // Subscribe to the real-time Firestore snapshot regardless of whether
            // ensureUserProfile succeeded — the snapshot itself will resolve once
            // Firestore comes online if it was temporarily unavailable.
            console.log(`[FIRESTORE_READ] Setting up onSnapshot listener: users/${user.uid}`);
            unsubscribeProfile = subscribeUserProfile(
                user.uid,
                profile => {
                    if (profile) {
                        console.log('[PROFILE_UPDATE] Profile loaded into AuthContext:', {
                            displayName: profile.displayName,
                            headline: profile.headline,
                            bio: profile.bio,
                            skills: profile.skills?.length ?? 0,
                            interests: profile.interests?.length ?? 0,
                            location: (profile as any).location,
                            website: (profile as any).website,
                            portfolioURL: (profile as any).portfolioURL,
                            photoURL: profile.photoURL,
                            coverPhotoURL: profile.coverPhotoURL,
                            profileCompletion: profile.profileCompletion,
                        });
                    } else {
                        // Document missing — attempt silent creation then re-subscribe
                        console.warn('[PROFILE_UPDATE] Snapshot returned null — document missing. Attempting creation…');
                        ensureUserProfile(user).catch(e =>
                            console.error('[PROFILE_CREATE] Silent creation failed:', e.message)
                        );
                    }
                    setUserProfile(profile);
                    setLoading(false);
                },
                error => {
                    console.error('[FIRESTORE_READ] Profile subscription error:', error);
                    // Still stop the loading spinner so the UI doesn't hang
                    setLoading(false);
                },
            );
        });

        return () => {
            unsubscribeProfile?.();
            unsubscribeAuth();
        };
    // profileKey allows external callers to force a full re-subscribe cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileKey]);

    const role = userProfile?.role ?? null;

    const value: AuthContextType = {
        currentUser,
        userProfile,
        role,
        isModerator: role === 'moderator' || role === 'admin',
        isAdmin: role === 'admin',
        loading,
        refreshProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
