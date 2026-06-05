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

export const getDocument = async <T>(collectionName: CollectionName, id: string): Promise<FirestoreRecord<T> | null> => {
    const snapshot = await getDoc(doc(db, collectionName, id));

    if (!snapshot.exists()) {
        return null;
    }

    return { id: snapshot.id, ...snapshot.data() } as FirestoreRecord<T>;
};

export const setDocument = async <T extends Record<string, unknown>>(
    collectionName: CollectionName,
    id: string,
    data: T,
    merge = true,
) => {
    await setDoc(doc(db, collectionName, id), withUpdateTimestamp(data), { merge });
};

export const createDocument = async <T extends Record<string, unknown>>(collectionName: CollectionName, data: T) => {
    const ref = await addDoc(collection(db, collectionName), withCreateTimestamps(data));
    return ref.id;
};

export const updateDocument = async <T extends Record<string, unknown>>(collectionName: CollectionName, id: string, data: T) => {
    await updateDoc(doc(db, collectionName, id), withUpdateTimestamp(data));
};

export const deleteDocument = async (collectionName: CollectionName, id: string) => {
    await deleteDoc(doc(db, collectionName, id));
};

export const listDocuments = async <T>(
    collectionName: CollectionName,
    constraints: QueryConstraint[] = [],
): Promise<Array<FirestoreRecord<T>>> => {
    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as FirestoreRecord<T>));
};

export const subscribeToDocument = <T>(
    collectionName: CollectionName,
    id: string,
    onChange: (record: FirestoreRecord<T> | null) => void,
    onError?: (error: Error) => void,
) => {
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
