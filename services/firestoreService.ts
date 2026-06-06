import {
    QueryConstraint,
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export const COLLECTIONS = {
    users: 'users',
    posts: 'posts',
    likes: 'likes',
    comments: 'comments',
    bookmarks: 'bookmarks',
    follows: 'follows',
    trendz: 'trendz',
    projects: 'projects',
    communities: 'communities',
    communityMemberships: 'communityMemberships',
    messages: 'messages',
    notifications: 'notifications',
    applications: 'applications',
    savedOpportunities: 'savedOpportunities',
    reports: 'reports',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
export type FirestoreRecord<T> = T & { id: string };

const withCreateTimestamps = <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
});

const withUpdateTimestamp = <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    updatedAt: serverTimestamp(),
});

// ─── CRUD ────────────────────────────────────────────────────────────────────

export const getDocument = async <T>(collectionName: CollectionName, id: string): Promise<FirestoreRecord<T> | null> => {
    console.log(`[FIRESTORE_READ] getDocument: ${collectionName}/${id}`);
    const snapshot = await getDoc(doc(db, collectionName, id));

    if (!snapshot.exists()) {
        console.log(`[FIRESTORE_READ] Document not found: ${collectionName}/${id}`);
        return null;
    }

    console.log(`[FIRESTORE_READ] Document loaded: ${collectionName}/${id}`);
    return { id: snapshot.id, ...snapshot.data() } as FirestoreRecord<T>;
};

export const setDocument = async <T extends Record<string, unknown>>(
    collectionName: CollectionName,
    id: string,
    data: T,
    merge = true,
) => {
    console.log(`[FIRESTORE_WRITE] setDocument (merge=${merge}): ${collectionName}/${id}`, data);
    try {
        await setDoc(doc(db, collectionName, id), withUpdateTimestamp(data), { merge });
        console.log(`[PROFILE_SAVE_SUCCESS] setDocument success: ${collectionName}/${id}`);
    } catch (err) {
        console.error(`[PROFILE_SAVE_ERROR] setDocument failed: ${collectionName}/${id}`, err);
        throw err;
    }
};

export const createDocument = async <T extends Record<string, unknown>>(collectionName: CollectionName, data: T) => {
    console.log(`[FIRESTORE_WRITE] createDocument: ${collectionName}`, data);
    try {
        const ref = await addDoc(collection(db, collectionName), withCreateTimestamps(data));
        console.log(`[PROFILE_SAVE_SUCCESS] createDocument success: ${collectionName}/${ref.id}`);
        return ref.id;
    } catch (err) {
        console.error(`[PROFILE_SAVE_ERROR] createDocument failed: ${collectionName}`, err);
        throw err;
    }
};

/**
 * Update an existing Firestore document.
 * Automatically appends updatedAt: serverTimestamp().
 */
export const updateDocument = async <T extends Record<string, unknown>>(
    collectionName: CollectionName,
    id: string,
    data: T,
) => {
    const payload = withUpdateTimestamp(data);
    console.log(`[FIRESTORE_WRITE] updateDocument: ${collectionName}/${id}`, data);
    try {
        await updateDoc(doc(db, collectionName, id), payload);
        console.log(`[PROFILE_SAVE_SUCCESS] updateDocument success: ${collectionName}/${id}`);
    } catch (err) {
        console.error(`[PROFILE_SAVE_ERROR] updateDocument failed: ${collectionName}/${id}`, err);
        throw err;
    }
};

export const deleteDocument = async (collectionName: CollectionName, id: string) => {
    console.log(`[FIRESTORE_WRITE] deleteDocument: ${collectionName}/${id}`);
    await deleteDoc(doc(db, collectionName, id));
};

export const listDocuments = async <T>(
    collectionName: CollectionName,
    constraints: QueryConstraint[] = [],
): Promise<Array<FirestoreRecord<T>>> => {
    console.log(`[FIRESTORE_READ] listDocuments: ${collectionName}`);
    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as FirestoreRecord<T>));
};

// ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────

export const subscribeToDocument = <T>(
    collectionName: CollectionName,
    id: string,
    onChange: (record: FirestoreRecord<T> | null) => void,
    onError?: (error: Error) => void,
) => {
    console.log(`[FIRESTORE_READ] subscribeToDocument: ${collectionName}/${id}`);
    return onSnapshot(
        doc(db, collectionName, id),
        snapshot => onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as FirestoreRecord<T>) : null),
        error => onError?.(error),
    );
};

export const subscribeToQuery = <T>(
    collectionName: CollectionName,
    constraints: QueryConstraint[],
    onChange: (records: Array<FirestoreRecord<T>>) => void,
    onError?: (error: Error) => void,
) => {
    console.log(`[FIRESTORE_READ] subscribeToQuery: ${collectionName}`);
    return onSnapshot(
        query(collection(db, collectionName), ...constraints),
        snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as FirestoreRecord<T>))),
        error => onError?.(error),
    );
};

export const runBatch = async (operations: (batch: ReturnType<typeof writeBatch>) => void) => {
    const batch = writeBatch(db);
    operations(batch);
    await batch.commit();
};
