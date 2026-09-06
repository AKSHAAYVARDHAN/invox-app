import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { SectionId, SectionConfig, PlatformSectionsConfig } from '../types';

export const SECTION_KEYS: SectionId[] = ['explore', 'trendz', 'spotlight', 'communities', 'hub', 'mySpace'];

export const DEFAULT_SECTIONS_CONFIG: PlatformSectionsConfig = {
    explore: {
        id: 'explore',
        name: 'Explore',
        enabled: true,
        visibleToUsers: true,
        status: 'live',
        path: '/explore',
        description: 'Intellectual feed, research queries, threads, and consensus metrics.',
    },
    trendz: {
        id: 'trendz',
        name: 'Trendz',
        enabled: true,
        visibleToUsers: true,
        status: 'development',
        path: '/trendz',
        description: 'Breakthrough ideas and velocity-tracked debate streams.',
    },
    spotlight: {
        id: 'spotlight',
        name: 'Spotlight',
        enabled: true,
        visibleToUsers: true,
        status: 'coming_soon',
        path: '/spotlight',
        description: 'Opportunity board for research grants, fellowships, and collaborations.',
    },
    communities: {
        id: 'communities',
        name: 'Communities',
        enabled: true,
        visibleToUsers: true,
        status: 'development',
        path: '/communities',
        description: 'Specialized domain guilds and focused collaborative research circles.',
    },
    hub: {
        id: 'hub',
        name: 'Hub',
        enabled: true,
        visibleToUsers: true,
        status: 'live',
        path: '/hub',
        description: 'Real-time global 3D network, direct messaging and collaboration squads.',
    },
    mySpace: {
        id: 'mySpace',
        name: 'My Space',
        enabled: true,
        visibleToUsers: true,
        status: 'live',
        path: '/myspace',
        description: 'Personal knowledge repository of authored research and saved opportunities.',
    },
};

const CONFIG_DOC_PATH = 'platformConfig/sections';

/**
 * Merge raw Firestore document data with default configuration to ensure complete, valid section records.
 */
export function normalizeSectionsConfig(data?: any): PlatformSectionsConfig {
    if (!data || typeof data !== 'object') {
        return { ...DEFAULT_SECTIONS_CONFIG };
    }

    const rawSections = data.sections || data;
    const result: PlatformSectionsConfig = { ...DEFAULT_SECTIONS_CONFIG };

    for (const key of SECTION_KEYS) {
        const rawSection = rawSections[key] || rawSections[key.toLowerCase()];
        if (rawSection && typeof rawSection === 'object') {
            result[key] = {
                ...DEFAULT_SECTIONS_CONFIG[key],
                ...rawSection,
                id: key, // preserve canonical ID
                name: rawSection.name || DEFAULT_SECTIONS_CONFIG[key].name,
                enabled: typeof rawSection.enabled === 'boolean' ? rawSection.enabled : true,
                visibleToUsers: typeof rawSection.visibleToUsers === 'boolean' ? rawSection.visibleToUsers : true,
                status: ['live', 'development', 'coming_soon', 'disabled'].includes(rawSection.status)
                    ? rawSection.status
                    : DEFAULT_SECTIONS_CONFIG[key].status,
                path: DEFAULT_SECTIONS_CONFIG[key].path,
            };
        }
    }

    return result;
}

/**
 * Real-time subscription to platform section configuration.
 * Automatically falls back to defaults if missing or network issue.
 */
export function subscribePlatformSections(
    onUpdate: (config: PlatformSectionsConfig) => void,
    onError?: (error: Error) => void
): () => void {
    const configDocRef = doc(db, 'platformConfig', 'sections');

    const unsubscribe = onSnapshot(
        configDocRef,
        (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const normalized = normalizeSectionsConfig(data);
                onUpdate(normalized);
            } else {
                // If document does not exist yet in Firestore, deliver defaults
                onUpdate({ ...DEFAULT_SECTIONS_CONFIG });
            }
        },
        (err) => {
            console.warn('[PLATFORM_CONFIG] Real-time subscription notice (using resilient defaults):', err.message);
            onUpdate({ ...DEFAULT_SECTIONS_CONFIG });
            onError?.(err);
        }
    );

    return unsubscribe;
}

/**
 * Fetch platform sections configuration once.
 */
export async function getPlatformSections(): Promise<PlatformSectionsConfig> {
    try {
        const configDocRef = doc(db, 'platformConfig', 'sections');
        const snapshot = await getDoc(configDocRef);
        if (snapshot.exists()) {
            return normalizeSectionsConfig(snapshot.data());
        }
        return { ...DEFAULT_SECTIONS_CONFIG };
    } catch (err: any) {
        console.warn('[PLATFORM_CONFIG] Failed to get sections doc (using defaults):', err.message);
        return { ...DEFAULT_SECTIONS_CONFIG };
    }
}

/**
 * Persist the entire sections configuration to Firestore.
 * Requires administrator role in Firestore rules.
 */
export async function savePlatformSections(
    sections: PlatformSectionsConfig,
    userUid?: string
): Promise<void> {
    const configDocRef = doc(db, 'platformConfig', 'sections');
    await setDoc(
        configDocRef,
        {
            sections,
            updatedAt: serverTimestamp(),
            updatedBy: userUid || 'admin',
        },
        { merge: true }
    );
    console.log('[PLATFORM_CONFIG] Successfully synced platform configuration to Firestore.');
}

/**
 * Update a single section configuration.
 */
export async function updateSingleSection(
    sectionId: SectionId,
    updates: Partial<SectionConfig>,
    userUid?: string
): Promise<void> {
    const current = await getPlatformSections();
    const updated = {
        ...current,
        [sectionId]: {
            ...current[sectionId],
            ...updates,
            id: sectionId,
        },
    };
    await savePlatformSections(updated, userUid);
}
