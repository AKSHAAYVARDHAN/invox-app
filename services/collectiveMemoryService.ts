import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, sanitizeForFirestore } from './firestoreService';
import type {
    CollectiveMemory,
    CreateCollectiveMemoryInput,
    UpdateCollectiveMemoryInput,
    MemoryCategory,
    MemoryStatus,
    RelatedConclaveSummary,
} from './collectiveMemoryTypes';
import type { Community, CommunityRole } from '../types';
import type { ConclaveEvent } from './conclaveTypes';
import { isCommunityOwner, isCommunityAdmin, isCommunityManager } from './communityService';

/**
 * Format helper: Extracts year and month from a date string (YYYY-MM-DD)
 */
export const extractYearAndMonth = (dateStr: string): { year: number; month: number } => {
    try {
        const parts = dateStr.split('-');
        if (parts.length >= 2) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            if (!isNaN(year) && !isNaN(month)) {
                return { year, month };
            }
        }
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
        }
    } catch {
        // Fallback
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Check if the user is authorized to create a memory in this community.
 * By default: Community Owner, Administrators, and verified members (if permitted by community settings).
 */
export const canUserCreateMemory = (
    community: Community | null | undefined,
    currentUser: { uid: string } | null | undefined,
    isMember: boolean
): boolean => {
    if (!community || !currentUser) return false;
    if (isCommunityOwner(community, currentUser) || isCommunityAdmin(community, currentUser)) {
        return true;
    }
    // Check if community governance grants memory recording to all active members
    const memoryPolicy = (community as any)?.memoryCreationPermission || 'ALL_MEMBERS';
    if (memoryPolicy === 'ALL_MEMBERS' && isMember) {
        return true;
    }
    return false;
};

/**
 * Check if the user is authorized to edit, archive, or delete a specific memory.
 */
export const canUserManageMemory = (
    memory: CollectiveMemory,
    community: Community | null | undefined,
    currentUser: { uid: string } | null | undefined
): boolean => {
    if (!currentUser) return false;
    if (community && (isCommunityOwner(community, currentUser) || isCommunityAdmin(community, currentUser))) {
        return true;
    }
    // Original creator can edit/manage their own entry
    if (memory.creatorUid === currentUser.uid) {
        return true;
    }
    return false;
};

/**
 * Real-time subscription to a community's collective memories.
 * Falls back to high-fidelity in-memory demo records if Firestore collection is empty,
 * ensuring seamless demonstration without polluting production collections.
 */
export const subscribeCommunityMemories = (
    communityId: string,
    callback: (memories: CollectiveMemory[]) => void
): (() => void) => {
    if (!communityId) {
        callback([]);
        return () => {};
    }

    try {
        const memRef = collection(db, COLLECTIONS.collectiveMemories);
        const q = query(
            memRef,
            where('communityId', '==', communityId)
        );

        return onSnapshot(
            q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const realMemories: CollectiveMemory[] = snapshot.docs.map((d) => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            date: data.date || new Date().toISOString().split('T')[0],
                            year: data.year || extractYearAndMonth(data.date || '').year,
                            month: data.month || extractYearAndMonth(data.date || '').month,
                            status: data.status || 'published',
                            significance: data.significance || 'standard',
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
                            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || undefined),
                        } as CollectiveMemory;
                    });
                    // Sort descending by date
                    realMemories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    callback(realMemories);
                } else {
                    // Fall back to clean demo memories if empty in Firestore
                    const demoList = getDemoCollectiveMemories(communityId);
                    callback(demoList);
                }
            },
            (error) => {
                console.warn('[COLLECTIVE_MEMORIES_SUBSCRIPTION_WARN]', error);
                // On error or permission issues, provide demo records
                callback(getDemoCollectiveMemories(communityId));
            }
        );
    } catch (err) {
        console.warn('[COLLECTIVE_MEMORIES_SUBSCRIBE_ERR]', err);
        callback(getDemoCollectiveMemories(communityId));
        return () => {};
    }
};

/**
 * Creates a new Collective Memory record in Firestore.
 */
export const createCollectiveMemory = async (
    input: CreateCollectiveMemoryInput,
    currentUser: { uid: string; displayName?: string | null; photoURL?: string | null; email?: string | null }
): Promise<string> => {
    if (!input.communityId) {
        throw new Error('Community ID is required.');
    }
    if (!input.title?.trim()) {
        throw new Error('Memory title is required.');
    }
    if (!input.description?.trim()) {
        throw new Error('Memory description is required.');
    }
    if (!input.date) {
        throw new Error('Date of occurrence is required.');
    }

    const { year, month } = extractYearAndMonth(input.date);
    const newDocRef = doc(collection(db, COLLECTIONS.collectiveMemories));

    const record: Omit<CollectiveMemory, 'id'> = {
        communityId: input.communityId,
        communityName: input.communityName || '',
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        date: input.date,
        year,
        month,
        significance: input.significance || 'standard',
        status: input.status || 'published',
        isFeatured: Boolean(input.isFeatured),
        coverImageUrl: input.coverImageUrl || '',
        attachments: input.attachments || [],
        contributors: input.contributors || [],
        relatedConclave: input.relatedConclave || undefined,
        relatedConclaveId: input.relatedConclaveId || input.relatedConclave?.id || undefined,
        creatorUid: currentUser.uid,
        creatorInfo: {
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Collective Member',
            avatarUrl: currentUser.photoURL || '',
            role: 'Contributor',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const sanitized = sanitizeForFirestore(record);
    await setDoc(newDocRef, sanitized);
    return newDocRef.id;
};

/**
 * Updates an existing Collective Memory record in Firestore.
 */
export const updateCollectiveMemory = async (
    memoryId: string,
    updates: Partial<CreateCollectiveMemoryInput>
): Promise<void> => {
    if (!memoryId) throw new Error('Memory ID is required for update.');

    const docRef = doc(db, COLLECTIONS.collectiveMemories, memoryId);
    const patchData: Record<string, any> = {
        ...updates,
        updatedAt: serverTimestamp(),
    };

    if (updates.date) {
        const { year, month } = extractYearAndMonth(updates.date);
        patchData.year = year;
        patchData.month = month;
    }

    const sanitized = sanitizeForFirestore(patchData);
    await setDoc(docRef, sanitized, { merge: true });
};

/**
 * Deletes a Collective Memory record from Firestore.
 */
export const deleteCollectiveMemory = async (memoryId: string): Promise<void> => {
    if (!memoryId) throw new Error('Memory ID is required for deletion.');
    const docRef = doc(db, COLLECTIONS.collectiveMemories, memoryId);
    await deleteDoc(docRef);
};

/**
 * Archives a completed Conclave Gathering as a historical Collective Memory.
 * Bridges the Conclave event system with Collective Memory.
 */
export const archiveConclaveToMemory = async (
    conclave: ConclaveEvent,
    options: {
        title?: string;
        historicalContext?: string;
        significance?: 'standard' | 'major' | 'pivotal';
        isFeatured?: boolean;
        keyOutcomes?: string[];
        contributors?: { uid?: string; name: string; avatarUrl?: string; role?: string }[];
    },
    currentUser: { uid: string; displayName?: string | null; photoURL?: string | null; email?: string | null }
): Promise<string> => {
    const memoryTitle = options.title?.trim() || `Conclave: ${conclave.title}`;
    
    // Construct rich historical narrative
    let description = options.historicalContext?.trim() || conclave.description || '';
    if (options.keyOutcomes && options.keyOutcomes.length > 0) {
        description += `\n\n### Key Outcomes & Highlights\n` + options.keyOutcomes.map(o => `• ${o}`).join('\n');
    }

    const venueOrPlatform = conclave.eventType === 'ONSITE'
        ? `${conclave.onSite?.venueName || 'On-Site Venue'} (${conclave.onSite?.city || ''})`
        : `${conclave.virtual?.platform || 'Virtual Meeting Platform'}`;

    const relatedConclave: RelatedConclaveSummary = {
        id: conclave.id,
        title: conclave.title,
        eventType: conclave.eventType,
        startDate: conclave.startDate,
        venueOrPlatform,
        attendeeCount: conclave.registeredCount,
        organizerName: conclave.organizerInfo?.displayName || 'Event Organizer',
    };

    const memoryContributors = options.contributors && options.contributors.length > 0
        ? options.contributors
        : [
            {
                uid: conclave.organizerUid,
                name: conclave.organizerInfo?.displayName || 'Conclave Organizer',
                avatarUrl: conclave.organizerInfo?.avatarUrl || '',
                role: 'Host / Organizer',
            }
        ];

    return createCollectiveMemory({
        communityId: conclave.communityId,
        communityName: conclave.communityName,
        title: memoryTitle,
        description,
        category: 'gatherings',
        date: conclave.startDate || new Date().toISOString().split('T')[0],
        significance: options.significance || 'major',
        status: 'published',
        isFeatured: Boolean(options.isFeatured),
        coverImageUrl: conclave.coverImageUrl || '',
        relatedConclave,
        relatedConclaveId: conclave.id,
        contributors: memoryContributors,
    }, currentUser);
};

/**
 * Calculates metrics across memory records.
 */
export interface MemoryStats {
    total: number;
    milestones: number;
    achievements: number;
    gatherings: number;
    decisions: number;
    traditions: number;
    contributions: number;
}

export const calculateMemoryStats = (memories: CollectiveMemory[]): MemoryStats => {
    const published = memories.filter((m) => m.status === 'published');
    return {
        total: published.length,
        milestones: published.filter((m) => m.category === 'milestones').length,
        achievements: published.filter((m) => m.category === 'achievements').length,
        gatherings: published.filter((m) => m.category === 'gatherings').length,
        decisions: published.filter((m) => m.category === 'decisions').length,
        traditions: published.filter((m) => m.category === 'traditions').length,
        contributions: published.filter((m) => m.category === 'contributions').length,
    };
};

/**
 * Identifies the featured memory for prominent showcase.
 * Strictly returns ONLY a published memory explicitly pinned as featured (isFeatured === true).
 * If no memory is pinned, returns null so the Featured Memory section is completely hidden.
 */
export const getFeaturedMemory = (memories: CollectiveMemory[]): CollectiveMemory | null => {
    const published = memories.filter((m) => m.status === 'published');
    if (published.length === 0) return null;

    // Only return an explicitly pinned featured memory
    const pinned = published.find((m) => m.isFeatured === true);
    return pinned || null;
};

/**
 * Atomically pins a memory as featured for a community:
 * - Unpins any previously featured memory in the community.
 * - Pins the target memory record (isFeatured: true).
 * - Updates the community document with featuredMemoryId.
 */
export const pinMemoryAsFeatured = async (
    communityId: string,
    memoryId: string,
    existingMemories?: CollectiveMemory[]
): Promise<void> => {
    if (!communityId) throw new Error('Community identifier is required.');
    if (!memoryId) throw new Error('Memory identifier is required.');

    const targetMem = existingMemories?.find((m) => m.id === memoryId);

    // Build comprehensive memory payload so that unpersisted demo records are saved safely
    const targetPayload: Record<string, any> = targetMem
        ? {
              communityId: targetMem.communityId || communityId,
              communityName: targetMem.communityName || '',
              title: targetMem.title,
              description: targetMem.description,
              category: targetMem.category,
              date: targetMem.date,
              year: targetMem.year || extractYearAndMonth(targetMem.date).year,
              month: targetMem.month || extractYearAndMonth(targetMem.date).month,
              significance: targetMem.significance || 'standard',
              status: targetMem.status || 'published',
              isFeatured: true,
              coverImageUrl: targetMem.coverImageUrl || '',
              attachments: targetMem.attachments || [],
              contributors: targetMem.contributors || [],
              relatedConclave: targetMem.relatedConclave || null,
              creatorUid: targetMem.creatorUid || 'community-manager',
              creatorInfo: targetMem.creatorInfo || {
                  uid: 'community-manager',
                  displayName: 'Community Steward',
                  role: 'Steward',
              },
              updatedAt: serverTimestamp(),
          }
        : {
              isFeatured: true,
              updatedAt: serverTimestamp(),
          };

    try {
        const batch = writeBatch(db);

        // 1. Identify and unpin any currently featured memory for this community
        const prevFeaturedIds = new Set<string>();

        if (existingMemories && existingMemories.length > 0) {
            existingMemories
                .filter((m) => m.communityId === communityId && m.isFeatured && m.id !== memoryId)
                .forEach((m) => prevFeaturedIds.add(m.id));
        }

        try {
            const q = query(
                collection(db, COLLECTIONS.collectiveMemories),
                where('communityId', '==', communityId),
                where('isFeatured', '==', true)
            );
            const snap = await getDocs(q);
            snap.docs.forEach((docSnap) => {
                if (docSnap.id !== memoryId) {
                    prevFeaturedIds.add(docSnap.id);
                }
            });
        } catch (queryErr) {
            console.warn('[PIN_PREV_FEATURED_QUERY_FALLBACK]', queryErr);
        }

        prevFeaturedIds.forEach((prevId) => {
            const prevRef = doc(db, COLLECTIONS.collectiveMemories, prevId);
            batch.set(
                prevRef,
                sanitizeForFirestore({
                    isFeatured: false,
                    updatedAt: serverTimestamp(),
                }),
                { merge: true }
            );
        });

        // 2. Pin target memory (using set with merge so it never errors on unpersisted demo records)
        const targetRef = doc(db, COLLECTIONS.collectiveMemories, memoryId);
        batch.set(targetRef, sanitizeForFirestore(targetPayload), { merge: true });

        // 3. Atomically update community-level pointer
        const communityRef = doc(db, 'communities', communityId);
        batch.set(
            communityRef,
            sanitizeForFirestore({
                featuredMemoryId: memoryId,
                updatedAt: serverTimestamp(),
            }),
            { merge: true }
        );

        await batch.commit();
    } catch (batchErr) {
        console.warn('[PIN_BATCH_FALLBACK_DIRECT_UPDATE]', batchErr);
        try {
            const targetRef = doc(db, COLLECTIONS.collectiveMemories, memoryId);
            await setDoc(targetRef, sanitizeForFirestore(targetPayload), { merge: true });
        } catch (directErr) {
            console.warn('[PIN_DIRECT_FALLBACK_ERR]', directErr);
            // Non-blocking fallback: component optimistic state continues smoothly
        }
    }
};

/**
 * Unpins a memory from featured status.
 * Reverts the memory to regular chronological archive standing without modifying other attributes.
 */
export const unpinFeaturedMemory = async (
    communityId: string,
    memoryId: string,
    existingMemories?: CollectiveMemory[]
): Promise<void> => {
    if (!communityId) throw new Error('Community identifier is required.');
    if (!memoryId) throw new Error('Memory identifier is required.');

    try {
        const batch = writeBatch(db);

        // 1. Unpin target memory
        const targetRef = doc(db, COLLECTIONS.collectiveMemories, memoryId);
        batch.set(
            targetRef,
            sanitizeForFirestore({
                isFeatured: false,
                updatedAt: serverTimestamp(),
            }),
            { merge: true }
        );

        // 2. Also unpin any other memory that might be flagged as featured
        if (existingMemories) {
            existingMemories
                .filter((m) => m.communityId === communityId && m.isFeatured && m.id !== memoryId)
                .forEach((other) => {
                    batch.set(
                        doc(db, COLLECTIONS.collectiveMemories, other.id),
                        sanitizeForFirestore({
                            isFeatured: false,
                            updatedAt: serverTimestamp(),
                        }),
                        { merge: true }
                    );
                });
        }

        // 3. Clear community-level reference
        const communityRef = doc(db, 'communities', communityId);
        batch.set(
            communityRef,
            sanitizeForFirestore({
                featuredMemoryId: null,
                updatedAt: serverTimestamp(),
            }),
            { merge: true }
        );

        await batch.commit();
    } catch (batchErr) {
        console.warn('[UNPIN_BATCH_FALLBACK_DIRECT_UPDATE]', batchErr);
        try {
            const targetRef = doc(db, COLLECTIONS.collectiveMemories, memoryId);
            await setDoc(
                targetRef,
                sanitizeForFirestore({
                    isFeatured: false,
                    updatedAt: serverTimestamp(),
                }),
                { merge: true }
            );
        } catch (directErr) {
            console.warn('[UNPIN_DIRECT_FALLBACK_ERR]', directErr);
        }
    }
};

/**
 * Groups memories chronologically into a hierarchical timeline structure:
 * Year -> Month -> Memory List
 */
export interface TimelineMonthGroup {
    year: number;
    month: number;
    monthName: string;
    label: string;
    memories: CollectiveMemory[];
}

export interface TimelineYearGroup {
    year: number;
    months: TimelineMonthGroup[];
    totalCount: number;
}

export const groupMemoriesByTimeline = (
    memories: CollectiveMemory[],
    sortOrder: 'desc' | 'asc' = 'desc'
): TimelineYearGroup[] => {
    const yearMap = new Map<number, Map<number, CollectiveMemory[]>>();

    for (const mem of memories) {
        const { year, month } = extractYearAndMonth(mem.date);
        if (!yearMap.has(year)) {
            yearMap.set(year, new Map());
        }
        const monthMap = yearMap.get(year)!;
        if (!monthMap.has(month)) {
            monthMap.set(month, []);
        }
        monthMap.get(month)!.push(mem);
    }

    const yearKeys = Array.from(yearMap.keys()).sort((a, b) =>
        sortOrder === 'desc' ? b - a : a - b
    );

    const result: TimelineYearGroup[] = [];

    for (const y of yearKeys) {
        const monthMap = yearMap.get(y)!;
        const monthKeys = Array.from(monthMap.keys()).sort((a, b) =>
            sortOrder === 'desc' ? b - a : a - b
        );

        let totalYearMemories = 0;
        const monthsList: TimelineMonthGroup[] = [];

        for (const m of monthKeys) {
            const list = monthMap.get(m)!;
            // Sort items inside month
            list.sort((a, b) => {
                const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
                return sortOrder === 'desc' ? diff : -diff;
            });

            totalYearMemories += list.length;
            monthsList.push({
                year: y,
                month: m,
                monthName: MONTH_NAMES[m - 1] || `Month ${m}`,
                label: `${MONTH_NAMES[m - 1] || `Month ${m}`} ${y}`,
                memories: list,
            });
        }

        result.push({
            year: y,
            months: monthsList,
            totalCount: totalYearMemories,
        });
    }

    return result;
};

/**
 * High-fidelity demonstration memory archives for mock communities.
 * Used exclusively in-memory when no real records have yet been committed.
 */
export const getDemoCollectiveMemories = (communityId: string): CollectiveMemory[] => {
    const isTech = communityId.includes('tech') || communityId === 'mock-comm-tech-enthusiasts';
    const isAI = communityId.includes('ai') || communityId === 'mock-comm-ai-researchers';
    const isCyber = communityId.includes('cyber') || communityId === 'mock-comm-cybersec-guild';

    const baseYear = 2026;

    if (isAI) {
        return [
            {
                id: 'mem-ai-1',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Collective Genesis: Sovereign Model Evaluation Charter',
                description: 'Foundational summit establishing our community-led open evaluation protocol for multi-modal frontier models. Over 180 researchers ratified the verification charter to ensure transparent safety benchmarks without proprietary capture.',
                category: 'milestones',
                date: `${baseYear}-10-24`,
                year: baseYear,
                month: 10,
                significance: 'pivotal',
                status: 'published',
                isFeatured: true,
                coverImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
                contributors: [
                    { name: 'Dr. Elena Rostova', role: 'Lead Architect', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&h=100&auto=format&fit=crop' },
                    { name: 'Marcus Vance', role: 'Governance Steward' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Dr. Elena Rostova', role: 'Lead Architect' },
                createdAt: new Date(`${baseYear}-10-24T10:00:00Z`),
            },
            {
                id: 'mem-ai-2',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Conclave: Multi-Agent Consensus Architecture Summit',
                description: 'Completed our premier technical gathering with 420 simultaneous participating researchers. Demonstrated zero-latency agentic handoffs and unified schema negotiation across distributed LLM clusters.',
                category: 'gatherings',
                date: `${baseYear}-10-18`,
                year: baseYear,
                month: 10,
                significance: 'major',
                status: 'published',
                coverImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
                relatedConclave: {
                    id: 'conclave-ai-summit-2026',
                    title: 'Multi-Agent Consensus Architecture Summit',
                    eventType: 'VIRTUAL',
                    startDate: `${baseYear}-10-18`,
                    venueOrPlatform: 'Virtual Conclave Room #1',
                    attendeeCount: 420,
                    organizerName: 'Dr. Elena Rostova',
                },
                contributors: [
                    { name: 'Dr. Elena Rostova', role: 'Summit Host' },
                    { name: 'Kaelen Thorne', role: 'Protocol Lead' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Marcus Vance', role: 'Organizer' },
                createdAt: new Date(`${baseYear}-10-18T18:00:00Z`),
            },
            {
                id: 'mem-ai-3',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'NeurIPS Open Science Distinction',
                description: 'The collective was recognized with the prestigious Open Science Commendation for publishing our reproducible dataset containing 500,000 empirical alignment evaluations.',
                category: 'achievements',
                date: `${baseYear}-05-20`,
                year: baseYear,
                month: 5,
                significance: 'major',
                status: 'published',
                coverImageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1200&auto=format&fit=crop',
                contributors: [
                    { name: 'Research Working Group #4', role: 'Collaborative Authors' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Dr. Elena Rostova' },
                createdAt: new Date(`${baseYear}-05-20T14:00:00Z`),
            },
            {
                id: 'mem-ai-4',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Universal Safety Benchmark Dataset Release',
                description: 'Public release of the v2.4 evaluation suite across 14 frontier languages, cited by over 80 independent laboratory groups.',
                category: 'contributions',
                date: `${baseYear}-05-12`,
                year: baseYear,
                month: 5,
                significance: 'standard',
                status: 'published',
                coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
                contributors: [
                    { name: 'Kaelen Thorne', role: 'Benchmark Lead' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Kaelen Thorne' },
                createdAt: new Date(`${baseYear}-05-12T11:00:00Z`),
            },
            {
                id: 'mem-ai-5',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Ratification of Zero-Closed-Weights Decision',
                description: 'After 14 days of decentralized voting, 92% of the collective approved the binding policy: all collective-sponsored research code must be released under permissive open-source licenses.',
                category: 'decisions',
                date: `${baseYear - 1}-11-20`,
                year: baseYear - 1,
                month: 11,
                significance: 'standard',
                status: 'published',
                contributors: [
                    { name: 'Governance Council', role: 'Policy Drafting' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Marcus Vance' },
                createdAt: new Date(`${baseYear - 1}-11-20T09:00:00Z`),
            },
            {
                id: 'mem-ai-6',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Global AI Safety Fellowship Inception',
                description: 'Established the inaugural cohort of 24 sovereign researchers receiving non-dilutive computational grants to study interpretability mechanics.',
                category: 'milestones',
                date: `${baseYear - 1}-11-08`,
                year: baseYear - 1,
                month: 11,
                significance: 'major',
                status: 'published',
                coverImageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop',
                contributors: [
                    { name: 'Steward Board', role: 'Fellowship Committee' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Dr. Elena Rostova' },
                createdAt: new Date(`${baseYear - 1}-11-08T15:30:00Z`),
            },
            {
                id: 'mem-ai-7',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Biannual Quantization Hackathon Tradition',
                description: 'Our established semi-annual tradition where engineers assemble around the globe to compress state-of-the-art vision and language models onto edge devices.',
                category: 'traditions',
                date: `${baseYear - 1}-04-18`,
                year: baseYear - 1,
                month: 4,
                significance: 'standard',
                status: 'published',
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Kaelen Thorne' },
                createdAt: new Date(`${baseYear - 1}-04-18T12:00:00Z`),
            },
            {
                id: 'mem-ai-8',
                communityId,
                communityName: 'Global AI Alliance',
                title: 'Open Source Neural Compiler Core Library',
                description: 'Community maintainers released an ultra-compact fused kernel library enabling sub-millisecond attention execution on local consumer silicon.',
                category: 'contributions',
                date: `${baseYear - 1}-04-05`,
                year: baseYear - 1,
                month: 4,
                significance: 'major',
                status: 'published',
                coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
                contributors: [
                    { name: 'Kernel Optimization Guild', role: 'Maintainers' }
                ],
                creatorUid: 'demo-steward',
                creatorInfo: { uid: 'demo-steward', displayName: 'Marcus Vance' },
                createdAt: new Date(`${baseYear - 1}-04-05T09:30:00Z`),
            },
        ];
    }

    // Default Tech Enthusiasts & General Communities
    return [
        {
            id: 'mem-gen-1',
            communityId,
            communityName: 'Collective Archive',
            title: 'Founding Charter and Sovereign Collective Enclave',
            description: 'Inaugural moment marking the official genesis of this collective. Founding members drafted and ratified our collective mission, core principles, and established the sovereign community enclave.',
            category: 'milestones',
            date: `${baseYear}-10-25`,
            year: baseYear,
            month: 10,
            significance: 'pivotal',
            status: 'published',
            isFeatured: true,
            coverImageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
            contributors: [
                { name: 'Founding Stewards', role: 'Founders' },
                { name: 'Alex Mercer', role: 'Architect' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Alex Mercer', role: 'Founder' },
            createdAt: new Date(`${baseYear}-10-25T10:00:00Z`),
        },
        {
            id: 'mem-gen-2',
            communityId,
            communityName: 'Collective Archive',
            title: 'Conclave: Distributed Systems & Edge Protocols',
            description: 'Concluded our intensive 2-day physical gathering. 160 engineers reviewed multi-node consistency models, verified memory-mapped storage benchmarks, and demonstrated real-time telemetry streaming.',
            category: 'gatherings',
            date: `${baseYear}-10-12`,
            year: baseYear,
            month: 10,
            significance: 'major',
            status: 'published',
            coverImageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop',
            relatedConclave: {
                id: 'conclave-dist-sys-2026',
                title: 'Distributed Systems & Edge Protocols Gathering',
                eventType: 'ONSITE',
                startDate: `${baseYear}-10-12`,
                venueOrPlatform: 'Tech Pavilion (San Francisco)',
                attendeeCount: 160,
                organizerName: 'Alex Mercer',
            },
            contributors: [
                { name: 'Alex Mercer', role: 'Lead Organizer' },
                { name: 'Sora Chen', role: 'Technical Host' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Alex Mercer' },
            createdAt: new Date(`${baseYear}-10-12T16:00:00Z`),
        },
        {
            id: 'mem-gen-3',
            communityId,
            communityName: 'Collective Archive',
            title: 'Surpassing 2,500 Active Verified Contributors',
            description: 'Our community achieved an unprecedented milestone of 2,500 active verified engineering contributors without compromising on quality or discourse depth.',
            category: 'achievements',
            date: `${baseYear}-05-28`,
            year: baseYear,
            month: 5,
            significance: 'major',
            status: 'published',
            coverImageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
            contributors: [
                { name: 'Entire Community Membership', role: 'Members' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Sora Chen' },
            createdAt: new Date(`${baseYear}-05-28T11:00:00Z`),
        },
        {
            id: 'mem-gen-4',
            communityId,
            communityName: 'Collective Archive',
            title: 'Collective Infrastructure Micro-Grant Allocation',
            description: 'Disbursed $45,000 in peer-funded compute credits across six member-led open-source protocol projects with zero platform commission.',
            category: 'contributions',
            date: `${baseYear}-05-14`,
            year: baseYear,
            month: 5,
            significance: 'standard',
            status: 'published',
            coverImageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1200&auto=format&fit=crop',
            contributors: [
                { name: 'Grant Allocation Committee', role: 'Treasury' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Alex Mercer' },
            createdAt: new Date(`${baseYear}-05-14T14:00:00Z`),
        },
        {
            id: 'mem-gen-5',
            communityId,
            communityName: 'Collective Archive',
            title: 'Protocol Decision: Zero Tracking and Monospaced Architecture',
            description: 'Unanimous community resolution mandating zero telemetry tracking and prioritizing monospaced clarity for all internal engineering dashboards and tools.',
            category: 'decisions',
            date: `${baseYear - 1}-11-22`,
            year: baseYear - 1,
            month: 11,
            significance: 'standard',
            status: 'published',
            contributors: [
                { name: 'Standards Committee', role: 'Authors' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Alex Mercer' },
            createdAt: new Date(`${baseYear - 1}-11-22T08:30:00Z`),
        },
        {
            id: 'mem-gen-6',
            communityId,
            communityName: 'Collective Archive',
            title: 'Friday Code Audit Tradition Established',
            description: 'Initiated our weekly community tradition where senior maintainers and contributors collaborate in an open sandbox to audit peer proposals and verify test suites.',
            category: 'traditions',
            date: `${baseYear - 1}-11-04`,
            year: baseYear - 1,
            month: 11,
            significance: 'standard',
            status: 'published',
            contributors: [
                { name: 'Maintainer Circle', role: 'Coordinators' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Sora Chen' },
            createdAt: new Date(`${baseYear - 1}-11-04T17:00:00Z`),
        },
        {
            id: 'mem-gen-7',
            communityId,
            communityName: 'Collective Archive',
            title: 'Open Source Rust Microkernel Framework',
            description: 'Collective members open-sourced a high-throughput, low-latency microkernel networking framework, which received over 1,200 GitHub stars within its first 48 hours.',
            category: 'contributions',
            date: `${baseYear - 1}-02-28`,
            year: baseYear - 1,
            month: 2,
            significance: 'major',
            status: 'published',
            coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
            contributors: [
                { name: 'Kernel Core Team', role: 'Core Developers' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Alex Mercer' },
            createdAt: new Date(`${baseYear - 1}-02-28T12:00:00Z`),
        },
        {
            id: 'mem-gen-8',
            communityId,
            communityName: 'Collective Archive',
            title: 'Global Consensus Node Verification Milestone',
            description: 'Crossed the threshold of 500 independently hosted relay nodes operating the INVOX cryptographic verification layer worldwide.',
            category: 'milestones',
            date: `${baseYear - 1}-02-14`,
            year: baseYear - 1,
            month: 2,
            significance: 'standard',
            status: 'published',
            contributors: [
                { name: 'Node Operator Guild', role: 'Operators' }
            ],
            creatorUid: 'demo-founder',
            creatorInfo: { uid: 'demo-founder', displayName: 'Sora Chen' },
            createdAt: new Date(`${baseYear - 1}-02-14T10:00:00Z`),
        },
    ];
};
