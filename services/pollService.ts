import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    where,
    Timestamp,
    deleteDoc,
    setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, createDocument } from './firestoreService';
import { uploadFile, getStoragePath } from './storageService';
import { Poll, PollOption, CreatePollInput, PostType, PollDuration } from '../types';

export const normalizeFirestorePoll = (id: string, data: any): Poll => {
    let createdAtDate = new Date();
    if (data.createdAt) {
        if (typeof data.createdAt.toDate === 'function') {
            createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
            createdAtDate = data.createdAt;
        } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
            createdAtDate = new Date(data.createdAt);
        }
    }

    let expiresAtDate: Date | null = null;
    if (data.expiresAt) {
        if (typeof data.expiresAt.toDate === 'function') {
            expiresAtDate = data.expiresAt.toDate();
        } else if (data.expiresAt instanceof Date) {
            expiresAtDate = data.expiresAt;
        } else if (typeof data.expiresAt === 'string' || typeof data.expiresAt === 'number') {
            expiresAtDate = new Date(data.expiresAt);
        }
    }

    const isExpired = expiresAtDate ? expiresAtDate.getTime() <= Date.now() : false;
    const status: 'active' | 'expired' = isExpired ? 'expired' : 'active';

    const rawOptions: any[] = Array.isArray(data.options) ? data.options : [];
    const options: PollOption[] = rawOptions.map((opt, index) => ({
        id: opt.id || `opt-${index}`,
        text: opt.text || '',
        voteCount: Number(opt.voteCount) || 0,
    }));

    const calculatedTotal = options.reduce((sum, opt) => sum + opt.voteCount, 0);
    const totalVotes = Math.max(calculatedTotal, Number(data.totalVotes) || 0);

    return {
        id,
        authorId: data.authorId || '',
        author: {
            name: data.author?.name || 'Invox Member',
            avatarUrl: data.author?.avatarUrl || `https://picsum.photos/seed/${data.authorId || id}/200`,
            username: data.author?.username || undefined,
            isVerified: Boolean(data.author?.isVerified),
        },
        question: data.question || '',
        description: data.description || '',
        options,
        createdAt: createdAtDate,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined,
        expiresAt: expiresAtDate,
        duration: data.duration as PollDuration,
        totalVotes,
        status,
        category: data.category || 'General',
        mediaUrl: data.mediaUrl || undefined,
        mediaType: data.mediaType || undefined,
        stats: {
            likes: Number(data.stats?.likes ?? data.likeCount ?? 0),
            views: Number(data.stats?.views ?? data.viewCount ?? 0),
            comments: Number(data.stats?.comments ?? data.commentCount ?? 0),
        },
        likeCount: Number(data.likeCount ?? data.stats?.likes ?? 0),
        viewCount: Number(data.viewCount ?? data.stats?.views ?? 0),
        commentCount: Number(data.commentCount ?? data.stats?.comments ?? 0),
        type: PostType.Poll,
    };
};

/**
 * Creates a new Poll in Firestore, uploading any attached media file.
 */
export const createPoll = async (
    input: CreatePollInput,
    onUploadProgress?: (progress: number) => void
): Promise<Poll> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Authentication required: You must be logged in to create a poll.');
    }

    const trimmedQuestion = (input.question || '').trim();
    if (!trimmedQuestion) {
        throw new Error('Poll question cannot be empty.');
    }
    if (trimmedQuestion.length > 280) {
        throw new Error('Poll question exceeds 280 character limit.');
    }

    // Validate options
    const rawOptions = (input.options || []).map(o => o.trim()).filter(Boolean);
    if (rawOptions.length < 2) {
        throw new Error('A poll requires a minimum of 2 options.');
    }
    if (rawOptions.length > 6) {
        throw new Error('A poll allows a maximum of 6 options.');
    }

    // Check for duplicates
    const uniqueOptions = new Set(rawOptions.map(o => o.toLowerCase()));
    if (uniqueOptions.size !== rawOptions.length) {
        throw new Error('Poll options must be unique.');
    }

    // Check character length for options
    for (const opt of rawOptions) {
        if (opt.length > 100) {
            throw new Error(`Option "${opt.slice(0, 20)}..." exceeds 100 character limit.`);
        }
    }

    // Handle media file upload if provided
    let uploadedMediaUrl: string | undefined = input.mediaUrl || undefined;
    let detectedMediaType: 'image' | 'video' | undefined = undefined;

    if (input.mediaFile) {
        const file = input.mediaFile;
        const storagePath = getStoragePath('pollMedia', currentUser.uid, file.name);
        const uploaded = await uploadFile(storagePath, file, {
            onProgress: (progress) => onUploadProgress?.(progress),
        });
        uploadedMediaUrl = uploaded.url;
        detectedMediaType = file.type.startsWith('video') ? 'video' : 'image';
    }

    // Calculate expiration date
    let expiresAt: Timestamp | null = null;
    const now = new Date();
    if (input.duration === '1d') {
        expiresAt = Timestamp.fromDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    } else if (input.duration === '3d') {
        expiresAt = Timestamp.fromDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));
    } else if (input.duration === '7d') {
        expiresAt = Timestamp.fromDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    } else if (input.duration === '30d') {
        expiresAt = Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
    } else {
        expiresAt = null; // 'never'
    }

    const pollOptions: PollOption[] = rawOptions.map((text, idx) => ({
        id: `opt-${idx + 1}-${Date.now()}`,
        text,
        voteCount: 0,
    }));

    const pollPayload = {
        authorId: currentUser.uid,
        author: {
            name: input.authorProfile?.displayName || currentUser.displayName || 'Invox Member',
            avatarUrl: input.authorProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
            username: input.authorProfile?.username || '',
            isVerified: input.authorProfile?.role === 'admin' || input.authorProfile?.role === 'moderator' || false,
        },
        question: trimmedQuestion,
        description: (input.description || '').trim(),
        options: pollOptions,
        duration: input.duration || '7d',
        expiresAt,
        totalVotes: 0,
        status: 'active',
        category: input.category || 'Technology',
        mediaUrl: uploadedMediaUrl || null,
        mediaType: detectedMediaType || null,
        stats: {
            likes: 0,
            views: 0,
            comments: 0,
        },
        likeCount: 0,
        viewCount: 0,
        commentCount: 0,
        type: PostType.Poll,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    console.log(`[POLL_CREATION] Creating new poll in Firestore:`, trimmedQuestion);
    const newDocId = await createDocument(COLLECTIONS.polls, pollPayload);
    console.log(`[POLL_CREATION_SUCCESS] Created poll with id: ${newDocId}`);

    return normalizeFirestorePoll(newDocId, {
        ...pollPayload,
        createdAt: new Date(),
        expiresAt: expiresAt ? expiresAt.toDate() : null,
    });
};

/**
 * Real-time subscription to all Polls (for Explore Discover)
 */
export const subscribeToPolls = (
    callback: (polls: Poll[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    const q = query(collection(db, COLLECTIONS.polls), orderBy('createdAt', 'desc'));

    return onSnapshot(
        q,
        (snapshot) => {
            const polls = snapshot.docs.map(docSnap => normalizeFirestorePoll(docSnap.id, docSnap.data()));
            callback(polls);
        },
        (err) => {
            console.error('[SUBSCRIBE_POLLS_ERROR]', err);
            // Fallback without orderBy in case composite index is not yet built
            const fallbackQuery = collection(db, COLLECTIONS.polls);
            const unsubFallback = onSnapshot(
                fallbackQuery,
                (snapshot) => {
                    const polls = snapshot.docs.map(docSnap => normalizeFirestorePoll(docSnap.id, docSnap.data()));
                    polls.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                    callback(polls);
                },
                (fallbackErr) => {
                    console.error('[SUBSCRIBE_POLLS_FALLBACK_ERROR]', fallbackErr);
                    onError?.(fallbackErr);
                }
            );
            return () => unsubFallback();
        }
    );
};

/**
 * Real-time subscription to Polls created by a specific user (for My Space -> Discover -> Polls)
 */
export const subscribeToUserPolls = (
    userId: string,
    callback: (polls: Poll[]) => void,
    onError?: (err: any) => void
): (() => void) => {
    const q = query(
        collection(db, COLLECTIONS.polls),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const polls = snapshot.docs.map(docSnap => normalizeFirestorePoll(docSnap.id, docSnap.data()));
            callback(polls);
        },
        (err) => {
            console.warn('[SUBSCRIBE_USER_POLLS_FALLBACK]', err);
            // Fallback without ordering
            const fallbackQuery = query(
                collection(db, COLLECTIONS.polls),
                where('authorId', '==', userId)
            );
            return onSnapshot(
                fallbackQuery,
                (snapshot) => {
                    const polls = snapshot.docs.map(docSnap => normalizeFirestorePoll(docSnap.id, docSnap.data()));
                    polls.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                    callback(polls);
                },
                (fallbackErr) => {
                    console.error('[SUBSCRIBE_USER_POLLS_ERROR]', fallbackErr);
                    onError?.(fallbackErr);
                }
            );
        }
    );
};

/**
 * Submits or updates a vote on a poll using a Firestore transaction.
 * Supports:
 * - Voting for an option (First vote)
 * - Changing vote to a different option (Removes old vote, adds new vote, updates counts)
 * - Selecting the same option (No-op, retains existing state)
 * - Atomic 1-user-1-vote enforcement via doc id `currentUser.uid`
 */
export const voteOnPoll = async (
    pollId: string,
    optionId: string,
    fallbackPoll?: Poll
): Promise<{ success: boolean; totalVotes: number; options: PollOption[]; selectedOptionId: string }> => {
    const currentUser = auth.currentUser;
    const voterId = currentUser?.uid || (typeof localStorage !== 'undefined' ? (localStorage.getItem('invox_guest_voter_id') || 'guest_voter') : 'guest_voter');

    // If it's a mock poll or if no authenticated user is present in preview, process vote locally
    const isMock = pollId.startsWith('mock-') || !currentUser;
    if (isMock) {
        const previousVoteLocal = typeof localStorage !== 'undefined' ? (
            localStorage.getItem(`poll_vote_${voterId}_${pollId}`) ||
            localStorage.getItem(`poll_vote_${pollId}`) ||
            null
        ) : null;

        const currentOptions: PollOption[] = fallbackPoll?.options ? fallbackPoll.options.map(o => ({ ...o })) : [];
        
        if (previousVoteLocal === optionId) {
            return {
                success: true,
                totalVotes: fallbackPoll?.totalVotes || currentOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0),
                options: currentOptions,
                selectedOptionId: optionId
            };
        }

        const updatedOptions = currentOptions.map(opt => {
            let count = Number(opt.voteCount) || 0;
            if (previousVoteLocal && opt.id === previousVoteLocal) {
                count = Math.max(0, count - 1);
            }
            if (opt.id === optionId) {
                count = count + 1;
            }
            return { ...opt, voteCount: count };
        });

        const calculatedTotal = updatedOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0);
        const newTotalVotes = previousVoteLocal 
            ? Math.max(calculatedTotal, Number(fallbackPoll?.totalVotes) || 0)
            : Math.max(calculatedTotal, (Number(fallbackPoll?.totalVotes) || 0) + 1);

        try {
            localStorage.setItem(`poll_vote_${voterId}_${pollId}`, optionId);
            localStorage.setItem(`poll_vote_${pollId}`, optionId);
            localStorage.setItem(`poll_options_${pollId}`, JSON.stringify(updatedOptions));
            localStorage.setItem(`poll_total_${pollId}`, String(newTotalVotes));
        } catch {}

        return {
            success: true,
            totalVotes: newTotalVotes,
            options: updatedOptions,
            selectedOptionId: optionId
        };
    }

    const pollRef = doc(db, COLLECTIONS.polls, pollId);
    const voteRef = doc(db, COLLECTIONS.polls, pollId, 'votes', currentUser.uid);

    // Save immediate local preference backup
    try {
        localStorage.setItem(`poll_vote_${currentUser.uid}_${pollId}`, optionId);
        localStorage.setItem(`poll_vote_${pollId}`, optionId);
    } catch {}

    try {
        return await runTransaction(db, async (transaction) => {
            const [pollDoc, voteDoc] = await Promise.all([
                transaction.get(pollRef),
                transaction.get(voteRef)
            ]);

            if (!pollDoc.exists()) {
                // If the poll document does not exist in Firestore yet (e.g. baseline explore poll)
                const currentOptions: PollOption[] = fallbackPoll?.options ? fallbackPoll.options.map(o => ({ ...o })) : [];
                const previousVoteLocal = localStorage.getItem(`poll_vote_${currentUser.uid}_${pollId}`) || null;

                if (previousVoteLocal === optionId) {
                    return {
                        success: true,
                        totalVotes: fallbackPoll?.totalVotes || currentOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0),
                        options: currentOptions,
                        selectedOptionId: optionId
                    };
                }

                let updatedOptions = currentOptions;
                if (currentOptions.length > 0) {
                    updatedOptions = currentOptions.map(opt => {
                        let count = Number(opt.voteCount) || 0;
                        if (previousVoteLocal && opt.id === previousVoteLocal) {
                            count = Math.max(0, count - 1);
                        }
                        if (opt.id === optionId) {
                            count = count + 1;
                        }
                        return { ...opt, voteCount: count };
                    });
                }
                const newTotal = updatedOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0);
                try {
                    localStorage.setItem(`poll_vote_${currentUser.uid}_${pollId}`, optionId);
                    localStorage.setItem(`poll_vote_${pollId}`, optionId);
                    localStorage.setItem(`poll_options_${pollId}`, JSON.stringify(updatedOptions));
                    localStorage.setItem(`poll_total_${pollId}`, String(newTotal));
                } catch {}

                return {
                    success: true,
                    totalVotes: newTotal,
                    options: updatedOptions,
                    selectedOptionId: optionId
                };
            }

            const pollData = pollDoc.data();

            // Expiration check
            if (pollData.expiresAt) {
                let expMillis = 0;
                if (typeof pollData.expiresAt.toMillis === 'function') {
                    expMillis = pollData.expiresAt.toMillis();
                } else if (pollData.expiresAt instanceof Date) {
                    expMillis = pollData.expiresAt.getTime();
                } else if (typeof pollData.expiresAt === 'string' || typeof pollData.expiresAt === 'number') {
                    expMillis = new Date(pollData.expiresAt).getTime();
                }
                if (expMillis > 0 && Date.now() > expMillis) {
                    throw new Error('This poll has ended. Voting is closed.');
                }
            }

            const currentOptions: PollOption[] = Array.isArray(pollData.options) ? pollData.options : [];
            const targetOptionIndex = currentOptions.findIndex(o => o.id === optionId);
            if (targetOptionIndex === -1) {
                throw new Error('Invalid option selected.');
            }

            const existingVoteData = voteDoc.exists() ? voteDoc.data() : null;
            const previousOptionId = existingVoteData?.optionId || null;

            // CASE 2: User has already voted and selected the exact same option again
            if (previousOptionId === optionId) {
                const totalVotes = Number(pollData.totalVotes) || currentOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0);
                return {
                    success: true,
                    totalVotes,
                    options: currentOptions,
                    selectedOptionId: optionId
                };
            }

            let updatedOptions: PollOption[];
            let newTotalVotes: number;

            if (previousOptionId) {
                // CASE 3: Changing vote from previousOptionId to optionId
                // Deduct from previous option, increment new option
                updatedOptions = currentOptions.map((opt) => {
                    let count = Number(opt.voteCount) || 0;
                    if (opt.id === previousOptionId) {
                        count = Math.max(0, count - 1);
                    }
                    if (opt.id === optionId) {
                        count = count + 1;
                    }
                    return { ...opt, voteCount: count };
                });

                // When changing choice, total net votes remains constant
                const calculatedTotal = updatedOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0);
                newTotalVotes = Math.max(calculatedTotal, Number(pollData.totalVotes) || 0);
            } else {
                // CASE 1: First time voting on this poll
                updatedOptions = currentOptions.map((opt, idx) => {
                    if (idx === targetOptionIndex) {
                        return { ...opt, voteCount: (Number(opt.voteCount) || 0) + 1 };
                    }
                    return opt;
                });

                const calculatedTotal = updatedOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0);
                newTotalVotes = Math.max(calculatedTotal, (Number(pollData.totalVotes) || 0) + 1);
            }

            // Write or overwrite the vote record with deterministic voter ID
            transaction.set(voteRef, {
                userId: currentUser.uid,
                pollId,
                optionId,
                previousOptionId: previousOptionId || null,
                votedAt: existingVoteData?.votedAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Update poll aggregate statistics
            transaction.update(pollRef, {
                options: updatedOptions,
                totalVotes: newTotalVotes,
                updatedAt: serverTimestamp(),
            });

            try {
                localStorage.setItem(`poll_vote_${currentUser.uid}_${pollId}`, optionId);
                localStorage.setItem(`poll_vote_${currentUser.uid}_${pollId}_prev`, optionId);
                localStorage.setItem(`poll_options_${pollId}`, JSON.stringify(updatedOptions));
                localStorage.setItem(`poll_total_${pollId}`, String(newTotalVotes));
            } catch {}

            return {
                success: true,
                totalVotes: newTotalVotes,
                options: updatedOptions,
                selectedOptionId: optionId
            };
        });
    } catch (err: any) {
        if (fallbackPoll) {
            console.warn('[VOTE_FALLBACK_APPLIED] Using local fallback persistence:', err?.message || err);
            const voterKey = currentUser?.uid || (typeof localStorage !== 'undefined' ? (localStorage.getItem('invox_guest_voter_id') || 'guest_voter') : 'guest_voter');
            const currentOptions: PollOption[] = fallbackPoll?.options ? fallbackPoll.options.map(o => ({ ...o })) : [];
            const previousVoteLocal = typeof localStorage !== 'undefined' ? (
                localStorage.getItem(`poll_vote_${voterKey}_${pollId}`) ||
                localStorage.getItem(`poll_vote_${pollId}`) ||
                null
            ) : null;

            let updatedOptions = currentOptions;
            if (currentOptions.length > 0) {
                updatedOptions = currentOptions.map(opt => {
                    let count = Number(opt.voteCount) || 0;
                    if (previousVoteLocal && opt.id === previousVoteLocal) {
                        count = Math.max(0, count - 1);
                    }
                    if (opt.id === optionId) {
                        count = count + 1;
                    }
                    return { ...opt, voteCount: count };
                });
            }
            const calculatedTotal = updatedOptions.reduce((s, o) => s + (Number(o.voteCount) || 0), 0);
            const newTotal = previousVoteLocal
                ? Math.max(calculatedTotal, Number(fallbackPoll?.totalVotes) || 0)
                : Math.max(calculatedTotal, (Number(fallbackPoll?.totalVotes) || 0) + 1);

            try {
                localStorage.setItem(`poll_vote_${voterKey}_${pollId}`, optionId);
                localStorage.setItem(`poll_vote_${pollId}`, optionId);
                localStorage.setItem(`poll_options_${pollId}`, JSON.stringify(updatedOptions));
                localStorage.setItem(`poll_total_${pollId}`, String(newTotal));
            } catch {}

            return {
                success: true,
                totalVotes: newTotal,
                options: updatedOptions,
                selectedOptionId: optionId
            };
        }
        throw err;
    }
};

/**
 * Checks if a specific user has voted on a poll and returns the optionId they selected.
 */
export const getUserPollVote = async (pollId: string, userId: string): Promise<string | null> => {
    try {
        const voteRef = doc(db, COLLECTIONS.polls, pollId, 'votes', userId);
        const snap = await getDoc(voteRef);
        if (snap.exists() && snap.data().optionId) {
            const optId = snap.data().optionId;
            try {
                localStorage.setItem(`poll_vote_${userId}_${pollId}`, optId);
            } catch {}
            return optId;
        }
    } catch (e) {
        console.warn(`[GET_USER_POLL_VOTE_WARN] ${pollId}/${userId}:`, e);
    }
    try {
        const local = localStorage.getItem(`poll_vote_${userId}_${pollId}`);
        if (local) return local;
    } catch {}
    return null;
};

/**
 * Checks which polls the user has participated in from a list of polls.
 * Inspects both Firestore vote subcollections and fast local cache.
 * Returns a dictionary of pollId -> selectedOptionId.
 */
export const getUserVotedPolls = async (userId: string, polls: Poll[]): Promise<Record<string, string>> => {
    const votes: Record<string, string> = {};
    if (!userId || !Array.isArray(polls) || polls.length === 0) {
        return votes;
    }

    // 1. Initial check from fast cache or existing poll object properties
    polls.forEach(p => {
        if (p.userVotedOptionId) {
            votes[p.id] = p.userVotedOptionId;
        } else {
            try {
                const cached = localStorage.getItem(`poll_vote_${userId}_${p.id}`) ||
                               localStorage.getItem(`poll_vote_${p.id}`);
                if (cached) {
                    votes[p.id] = cached;
                }
            } catch {}
        }
    });

    // 2. Fetch fresh vote state from Firestore votes subcollections in parallel
    try {
        const fetchTasks = polls.map(async (p) => {
            try {
                const voteRef = doc(db, COLLECTIONS.polls, p.id, 'votes', userId);
                const snap = await getDoc(voteRef);
                if (snap.exists() && snap.data()?.optionId) {
                    const optId = snap.data().optionId;
                    votes[p.id] = optId;
                    try {
                        localStorage.setItem(`poll_vote_${userId}_${p.id}`, optId);
                    } catch {}
                }
            } catch (err) {
                // Non-blocking for individual poll
            }
        });

        await Promise.allSettled(fetchTasks);
    } catch (e) {
        console.warn('[GET_USER_VOTED_POLLS_WARN]', e);
    }

    return votes;
};

/**
 * Deletes a poll from Firestore with full ownership verification.
 */
export const deletePoll = async (pollId: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Authentication required: You must be logged in to delete a poll.');
    }

    console.log(`[FIRESTORE_DELETE] Initiating deletion targeting poll: polls/${pollId}`);
    const pollRef = doc(db, COLLECTIONS.polls, pollId);
    const pollSnap = await getDoc(pollRef);

    if (!pollSnap.exists()) {
        console.warn(`[POLL_DELETE_WARN] Poll document not found: ${pollId}. Treating as deleted.`);
        return;
    }

    const pollData = pollSnap.data();
    if (pollData.authorId && pollData.authorId !== currentUser.uid) {
        throw new Error('Permission denied: You can only delete your own polls.');
    }

    await deleteDoc(pollRef);
    console.log(`[FIRESTORE_DELETE_SUCCESS] Successfully purged poll document: polls/${pollId}`);
};

/**
 * Increments view count for a poll lazily
 */
export const incrementPollView = async (pollId: string): Promise<void> => {
    try {
        const pollRef = doc(db, COLLECTIONS.polls, pollId);
        await runTransaction(db, async (t) => {
            const snap = await t.get(pollRef);
            if (snap.exists()) {
                const currentViews = Number(snap.data().viewCount || snap.data().stats?.views || 0);
                t.update(pollRef, {
                    viewCount: currentViews + 1,
                    'stats.views': currentViews + 1,
                });
            }
        });
    } catch {
        // Silently ignore view increment failures
    }
};

/**
 * Toggle like on a poll
 */
export const toggleLikePoll = async (pollId: string): Promise<{ liked: boolean; likeCount: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be signed in to like a poll.');

    const likeId = `${currentUser.uid}_${pollId}`;
    const likeRef = doc(db, COLLECTIONS.likes, likeId);
    const pollRef = doc(db, COLLECTIONS.polls, pollId);

    return await runTransaction(db, async (t) => {
        const [likeDoc, pollDoc] = await Promise.all([t.get(likeRef), t.get(pollRef)]);
        const currentLikes = Number(pollDoc.data()?.likeCount || pollDoc.data()?.stats?.likes || 0);

        if (likeDoc.exists()) {
            t.delete(likeRef);
            const newCount = Math.max(0, currentLikes - 1);
            t.update(pollRef, { likeCount: newCount, 'stats.likes': newCount });
            return { liked: false, likeCount: newCount };
        } else {
            t.set(likeRef, {
                userId: currentUser.uid,
                targetId: pollId,
                type: 'poll',
                createdAt: serverTimestamp(),
            });
            const newCount = currentLikes + 1;
            t.update(pollRef, { likeCount: newCount, 'stats.likes': newCount });
            return { liked: true, likeCount: newCount };
        }
    });
};

/**
 * Toggle bookmark / save on a poll
 */
export const toggleBookmarkPoll = async (pollId: string): Promise<{ saved: boolean }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Must be signed in to bookmark a poll.');

    const bookmarkId = `${currentUser.uid}_${pollId}`;
    const bookmarkRef = doc(db, COLLECTIONS.bookmarks, bookmarkId);

    const bookmarkSnap = await getDoc(bookmarkRef);
    if (bookmarkSnap.exists()) {
        await deleteDoc(bookmarkRef);
        return { saved: false };
    } else {
        await setDoc(bookmarkRef, {
            userId: currentUser.uid,
            postId: pollId,
            targetId: pollId,
            type: 'poll',
            createdAt: serverTimestamp(),
        });
        return { saved: true };
    }
};

