import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    addDoc,
    orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import type { CollabApplication, CollabApplicationStatus, CollabRole, InvoxUser, Project, User } from '../types';

/**
 * Calculates real-time role capacity and status given a role and existing applications.
 */
export const getRoleCapacity = (role: CollabRole, applications: CollabApplication[] = []) => {
    const total = Math.max(1, Number(role.count) || 1);
    const acceptedApps = applications.filter(a => a.roleId === role.id && a.status === 'ACCEPTED');
    const pendingApps = applications.filter(a => a.roleId === role.id && a.status === 'PENDING');
    const acceptedCount = acceptedApps.length;
    const remaining = Math.max(0, total - acceptedCount);
    const isFilled = remaining === 0;

    return {
        total,
        acceptedCount,
        pendingCount: pendingApps.length,
        remaining,
        isFilled,
        acceptedApps,
        pendingApps,
    };
};

/**
 * Submits an application for a specific role in a Collab project.
 */
export const submitCollabApplication = async ({
    collab,
    role,
    applicantUser,
    applicantProfile,
    message,
    supportingDocument,
}: {
    collab: Project;
    role: CollabRole;
    applicantUser: User;
    applicantProfile: InvoxUser | null;
    message?: string;
    supportingDocument?: {
        name: string;
        url: string;
        size?: number;
        type?: string;
        uploadedAt?: string;
    };
}): Promise<CollabApplication> => {
    if (!applicantUser?.uid) {
        throw new Error('Authentication required: You must be logged in to apply.');
    }

    const creatorId = collab.authorId || '';
    if (applicantUser.uid === creatorId) {
        throw new Error('Cannot apply: You are the creator of this collaboration project.');
    }

    // Check if role has existing applications to determine filled state
    const appsRef = collection(db, COLLECTIONS.applications);
    const roleAppsQuery = query(
        appsRef,
        where('collabId', '==', collab.id),
        where('roleId', '==', role.id)
    );
    const roleSnapshot = await getDocs(roleAppsQuery);
    const existingApps: CollabApplication[] = roleSnapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as any),
    }));

    const capacity = getRoleCapacity(role, existingApps);
    if (capacity.isFilled) {
        throw new Error('This role has already been filled. No further applications are accepted.');
    }

    // Check for duplicate active application by this user for the same role
    const userApp = existingApps.find(
        a => a.applicantId === applicantUser.uid && (a.status === 'PENDING' || a.status === 'ACCEPTED')
    );
    if (userApp) {
        throw new Error(`You have already submitted an active application (${userApp.status}) for this role.`);
    }

    // Generate deterministic application ID to prevent duplicate concurrent writes
    const applicationId = `app_${collab.id}_${role.id}_${applicantUser.uid}`;
    const appDocRef = doc(db, COLLECTIONS.applications, applicationId);

    const displayName = applicantProfile?.displayName || applicantUser.displayName || 'Anonymous Applicant';
    const username = applicantProfile?.username || applicantUser.email?.split('@')[0] || 'applicant';
    const photoURL = applicantProfile?.photoURL || applicantUser.photoURL || null;
    const headline = applicantProfile?.headline || '';
    const bio = applicantProfile?.bio || '';
    const skills = Array.isArray(applicantProfile?.skills) ? applicantProfile.skills : [];
    const location = applicantProfile?.location || '';
    const portfolioURL = applicantProfile?.portfolioURL || applicantProfile?.website || '';
    const website = applicantProfile?.website || '';
    const email = applicantProfile?.email || applicantUser.email || null;

    const collabTitle = collab.aiSummary || collab.oneLine || 'Collaboration Project';
    const collabDomain = collab.domain || collab.category || 'Technology';
    const collabOverview = collab.description || '';
    const collabCreatorName = collab.author?.name || 'Creator';
    const collabCreatorAvatar = collab.author?.avatarUrl || '';

    const newApplicationData: Omit<CollabApplication, 'id'> = {
        collabId: collab.id,
        creatorId,
        ownerId: creatorId, // Matches firestore security rules
        applicantId: applicantUser.uid,
        roleId: role.id,
        roleTitle: role.title,
        applicant: {
            uid: applicantUser.uid,
            displayName,
            username,
            photoURL,
            headline,
            bio,
            skills,
            location,
            portfolioURL,
            website,
            email,
        },
        collabTitle,
        collabDomain,
        collabOverview,
        collabCreatorName,
        collabCreatorAvatar,
        message: message?.trim() || '',
        ...(supportingDocument ? { supportingDocument } : {}),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const sanitized = sanitizeForFirestore(newApplicationData);
    await setDoc(appDocRef, sanitized);

    // Create notification for creator
    if (creatorId) {
        try {
            await addDoc(collection(db, COLLECTIONS.notifications), sanitizeForFirestore({
                recipientId: creatorId,
                senderId: applicantUser.uid,
                type: 'collab_application',
                title: 'New Collab Application',
                message: `${displayName} applied for "${role.title}" on "${collabTitle}".`,
                collabId: collab.id,
                roleId: role.id,
                applicationId,
                read: false,
                createdAt: serverTimestamp(),
            }));
        } catch (notifErr) {
            console.warn('[NOTIF_CREATION_WARN] Could not write creator notification:', notifErr);
        }
    }

    return {
        id: applicationId,
        ...newApplicationData,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
};

/**
 * Real-time subscription to applications submitted BY the user.
 */
export const subscribeToUserCollabApplications = (
    userId: string,
    onUpdate: (apps: CollabApplication[]) => void,
    onError?: (err: any) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.applications),
        where('applicantId', '==', userId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const apps: CollabApplication[] = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
                } as CollabApplication;
            });
            // Sort by most recent
            apps.sort((a, b) => {
                const timeA = new Date(a.createdAt).getTime();
                const timeB = new Date(b.createdAt).getTime();
                return timeB - timeA;
            });
            onUpdate(apps);
        },
        (error) => {
            console.error('[SUBSCRIBE_USER_APPLICATIONS_ERROR]', error);
            if (onError) onError(error);
        }
    );
};

/**
 * Real-time subscription to applications received FOR collabs owned by the user.
 */
export const subscribeToCreatorCollabApplications = (
    creatorId: string,
    onUpdate: (apps: CollabApplication[]) => void,
    onError?: (err: any) => void
) => {
    // Both ownerId and creatorId point to creator
    const q = query(
        collection(db, COLLECTIONS.applications),
        where('ownerId', '==', creatorId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const apps: CollabApplication[] = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
                } as CollabApplication;
            });
            apps.sort((a, b) => {
                const timeA = new Date(a.createdAt).getTime();
                const timeB = new Date(b.createdAt).getTime();
                return timeB - timeA;
            });
            onUpdate(apps);
        },
        (error) => {
            console.error('[SUBSCRIBE_CREATOR_APPLICATIONS_ERROR]', error);
            if (onError) onError(error);
        }
    );
};

/**
 * Real-time subscription to all applications for a given collab.
 */
export const subscribeToCollabApplications = (
    collabId: string,
    onUpdate: (apps: CollabApplication[]) => void,
    onError?: (err: any) => void
) => {
    const q = query(
        collection(db, COLLECTIONS.applications),
        where('collabId', '==', collabId)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const apps: CollabApplication[] = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
                } as CollabApplication;
            });
            onUpdate(apps);
        },
        (error) => {
            console.error('[SUBSCRIBE_COLLAB_APPLICATIONS_ERROR]', error);
            if (onError) onError(error);
        }
    );
};

/**
 * Accept a collaboration application.
 */
export const acceptCollabApplication = async ({
    application,
    maxPositions,
}: {
    application: CollabApplication;
    maxPositions: number;
}): Promise<void> => {
    // Check current accepted count for this role
    const appsRef = collection(db, COLLECTIONS.applications);
    const roleAppsQuery = query(
        appsRef,
        where('collabId', '==', application.collabId),
        where('roleId', '==', application.roleId),
        where('status', '==', 'ACCEPTED')
    );
    const snapshot = await getDocs(roleAppsQuery);
    if (snapshot.docs.length >= maxPositions) {
        throw new Error(`Cannot accept applicant: All ${maxPositions} positions for "${application.roleTitle}" have already been filled.`);
    }

    const appRef = doc(db, COLLECTIONS.applications, application.id);
    await updateDoc(appRef, {
        status: 'ACCEPTED',
        updatedAt: serverTimestamp(),
    });

    // Notify applicant
    try {
        await addDoc(collection(db, COLLECTIONS.notifications), sanitizeForFirestore({
            recipientId: application.applicantId,
            senderId: application.creatorId,
            type: 'collab_accepted',
            title: 'Application Accepted!',
            message: `Congratulations! Your application for "${application.roleTitle}" on "${application.collabTitle}" was accepted.`,
            collabId: application.collabId,
            roleId: application.roleId,
            applicationId: application.id,
            read: false,
            createdAt: serverTimestamp(),
        }));
    } catch (notifErr) {
        console.warn('[NOTIF_ACCEPTED_WARN]', notifErr);
    }
};

/**
 * Decline a collaboration application. Preserves history.
 */
export const declineCollabApplication = async (application: CollabApplication): Promise<void> => {
    const appRef = doc(db, COLLECTIONS.applications, application.id);
    await updateDoc(appRef, {
        status: 'DECLINED',
        updatedAt: serverTimestamp(),
    });

    // Notify applicant
    try {
        await addDoc(collection(db, COLLECTIONS.notifications), sanitizeForFirestore({
            recipientId: application.applicantId,
            senderId: application.creatorId,
            type: 'collab_declined',
            title: 'Application Update',
            message: `Your application for "${application.roleTitle}" on "${application.collabTitle}" was declined.`,
            collabId: application.collabId,
            roleId: application.roleId,
            applicationId: application.id,
            read: false,
            createdAt: serverTimestamp(),
        }));
    } catch (notifErr) {
        console.warn('[NOTIF_DECLINED_WARN]', notifErr);
    }
};

/**
 * Withdraw an application submitted by the applicant.
 */
export const withdrawCollabApplication = async (applicationId: string, applicantId: string): Promise<void> => {
    const appRef = doc(db, COLLECTIONS.applications, applicationId);
    const docSnap = await getDoc(appRef);
    if (!docSnap.exists()) {
        throw new Error('Application not found');
    }
    const data = docSnap.data() as CollabApplication;
    if (data.applicantId !== applicantId) {
        throw new Error('Unauthorized: You can only withdraw your own applications.');
    }
    if (data.status !== 'PENDING') {
        throw new Error(`Cannot withdraw: Application is already ${data.status.toLowerCase()}.`);
    }

    await updateDoc(appRef, {
        status: 'WITHDRAWN',
        updatedAt: serverTimestamp(),
    });
};
