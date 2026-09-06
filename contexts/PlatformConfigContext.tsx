import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
    PlatformSectionsConfig,
    SectionConfig,
    SectionId,
} from '../types';
import {
    DEFAULT_SECTIONS_CONFIG,
    subscribePlatformSections,
    savePlatformSections,
    updateSingleSection,
} from '../services/platformConfigService';
import { useAuth } from './AuthContext';

interface PlatformConfigContextType {
    sections: PlatformSectionsConfig;
    loading: boolean;
    error: string | null;
    /** Whether this section is visible in platform navigation for all users (no admin override). */
    isSectionVisible: (sectionId: SectionId | string) => boolean;
    /** Whether this section route is accessible for all users (no admin override). */
    isSectionAccessible: (sectionId: SectionId | string) => boolean;
    /** Returns the first available section path for graceful redirects. */
    getDefaultRoute: () => string;
    /** Save all section configurations to Firestore. */
    saveSections: (config: PlatformSectionsConfig) => Promise<void>;
    /** Update a single section configuration. */
    updateSection: (sectionId: SectionId, updates: Partial<SectionConfig>) => Promise<void>;
    /** Reset local & cloud configuration to default schema. */
    resetToDefaults: () => Promise<void>;
}

const PlatformConfigContext = createContext<PlatformConfigContextType>({
    sections: DEFAULT_SECTIONS_CONFIG,
    loading: true,
    error: null,
    isSectionVisible: () => true,
    isSectionAccessible: () => true,
    getDefaultRoute: () => '/explore',
    saveSections: async () => {},
    updateSection: async () => {},
    resetToDefaults: async () => {},
});

export const usePlatformConfig = () => useContext(PlatformConfigContext);

const PREFERRED_ROUTE_ORDER: SectionId[] = ['explore', 'communities', 'hub', 'trendz', 'spotlight', 'mySpace'];

export const PlatformConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [sections, setSections] = useState<PlatformSectionsConfig>(DEFAULT_SECTIONS_CONFIG);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribePlatformSections(
            (updatedConfig) => {
                setSections(updatedConfig);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.warn('[PLATFORM_CONFIG] Subscription warning, loaded fallback config:', err.message);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const isSectionVisible = useCallback(
        (sectionId: SectionId | string): boolean => {
            const normalizedId = sectionId === 'myspace' ? 'mySpace' : (sectionId as SectionId);
            const section = sections[normalizedId];
            if (!section) return true;
            return section.enabled && section.visibleToUsers && section.status !== 'disabled';
        },
        [sections]
    );

    const isSectionAccessible = useCallback(
        (sectionId: SectionId | string): boolean => {
            const normalizedId = sectionId === 'myspace' ? 'mySpace' : (sectionId as SectionId);
            const section = sections[normalizedId];
            if (!section) return true;

            // Strict platformConfig visibility & accessibility for ALL users, including admin (no override)
            return section.enabled && section.visibleToUsers && section.status !== 'disabled';
        },
        [sections]
    );

    const getDefaultRoute = useCallback((): string => {
        for (const key of PREFERRED_ROUTE_ORDER) {
            const section = sections[key];
            if (section && isSectionAccessible(key)) {
                return section.path;
            }
        }
        // If all 6 major sections are disabled for normal users, fallback to user profile
        return '/profile';
    }, [sections, isSectionAccessible]);

    const saveSections = useCallback(
        async (newConfig: PlatformSectionsConfig): Promise<void> => {
            setError(null);
            try {
                await savePlatformSections(newConfig, currentUser?.uid);
                setSections(newConfig);
            } catch (err: any) {
                console.error('[PLATFORM_CONFIG] Save error:', err);
                setError(err.message || 'Failed to save configuration');
                throw err;
            }
        },
        [currentUser]
    );

    const updateSection = useCallback(
        async (sectionId: SectionId, updates: Partial<SectionConfig>): Promise<void> => {
            setError(null);
            try {
                await updateSingleSection(sectionId, updates, currentUser?.uid);
                setSections((prev) => ({
                    ...prev,
                    [sectionId]: {
                        ...prev[sectionId],
                        ...updates,
                    },
                }));
            } catch (err: any) {
                console.error('[PLATFORM_CONFIG] Update section error:', err);
                setError(err.message || 'Failed to update section');
                throw err;
            }
        },
        [currentUser]
    );

    const resetToDefaults = useCallback(async (): Promise<void> => {
        await saveSections(DEFAULT_SECTIONS_CONFIG);
    }, [saveSections]);

    const contextValue = useMemo<PlatformConfigContextType>(
        () => ({
            sections,
            loading,
            error,
            isSectionVisible,
            isSectionAccessible,
            getDefaultRoute,
            saveSections,
            updateSection,
            resetToDefaults,
        }),
        [
            sections,
            loading,
            error,
            isSectionVisible,
            isSectionAccessible,
            getDefaultRoute,
            saveSections,
            updateSection,
            resetToDefaults,
        ]
    );

    return (
        <PlatformConfigContext.Provider value={contextValue}>
            {children}
        </PlatformConfigContext.Provider>
    );
};
