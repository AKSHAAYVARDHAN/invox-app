import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    userProfile: null,
    role: null,
    isModerator: false,
    isAdmin: false,
    loading: true,
});

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<InvoxUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        initializeAuthPersistence().catch(error => {
            console.error('Failed to initialize auth persistence', error);
        });

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribeProfile?.();
            unsubscribeProfile = null;
            setCurrentUser(user);

            if (!user) {
                setUserProfile(null);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                await ensureUserProfile(user);
                unsubscribeProfile = subscribeUserProfile(
                    user.uid,
                    profile => {
                        setUserProfile(profile);
                        setLoading(false);
                    },
                    error => {
                        console.error('Failed to subscribe to user profile', error);
                        setLoading(false);
                    },
                );
            } catch (error) {
                console.error('Failed to prepare user profile', error);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeProfile?.();
            unsubscribe();
        };
    }, []);

    const role = userProfile?.role ?? null;

    const value = {
        currentUser,
        userProfile,
        role,
        isModerator: role === 'moderator' || role === 'admin',
        isAdmin: role === 'admin',
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
