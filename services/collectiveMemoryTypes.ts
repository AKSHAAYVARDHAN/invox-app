import type { Timestamp } from 'firebase/firestore';

/**
 * 6 Core Categories of Collective Memory
 */
export type MemoryCategory =
    | 'milestones'
    | 'achievements'
    | 'gatherings'
    | 'decisions'
    | 'traditions'
    | 'contributions';

export type MemoryStatus = 'published' | 'draft' | 'archived';

export type MemorySignificance = 'standard' | 'major' | 'pivotal';

export interface MemoryContributor {
    uid?: string;
    name: string;
    avatarUrl?: string;
    role?: string;
}

export interface MemoryAttachment {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video' | 'document';
    size?: number;
}

export interface RelatedConclaveSummary {
    id: string;
    title: string;
    eventType: 'ONSITE' | 'VIRTUAL' | string;
    startDate: string;
    venueOrPlatform?: string;
    attendeeCount?: number;
    organizerName?: string;
}

export interface CollectiveMemory {
    id: string;
    communityId: string;
    communityName?: string;
    title: string;
    description: string;
    category: MemoryCategory;
    date: string; // ISO string YYYY-MM-DD
    year: number;
    month: number; // 1 - 12
    significance: MemorySignificance;
    status: MemoryStatus;
    isFeatured?: boolean;
    coverImageUrl?: string;
    attachments?: MemoryAttachment[];
    contributors?: MemoryContributor[];
    relatedConclave?: RelatedConclaveSummary;
    relatedConclaveId?: string;
    creatorUid: string;
    creatorInfo: {
        uid: string;
        displayName: string;
        avatarUrl?: string;
        role?: string;
    };
    createdAt: Date | Timestamp | any;
    updatedAt?: Date | Timestamp | any;
}

export interface CreateCollectiveMemoryInput {
    communityId: string;
    communityName?: string;
    title: string;
    description: string;
    category: MemoryCategory;
    date: string;
    significance?: MemorySignificance;
    status?: MemoryStatus;
    isFeatured?: boolean;
    coverImageUrl?: string;
    attachments?: MemoryAttachment[];
    contributors?: MemoryContributor[];
    relatedConclave?: RelatedConclaveSummary;
    relatedConclaveId?: string;
}

export interface UpdateCollectiveMemoryInput extends Partial<CreateCollectiveMemoryInput> {
    id: string;
}

export interface MemoryCategoryMeta {
    id: MemoryCategory;
    label: string;
    shortLabel: string;
    tagline: string;
    color: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    accentHex: string;
}

export const MEMORY_CATEGORIES: Record<MemoryCategory, MemoryCategoryMeta> = {
    milestones: {
        id: 'milestones',
        label: 'Milestones',
        shortLabel: 'MILESTONE',
        tagline: 'Important moments and turning points in the collective journey',
        color: 'amber',
        badgeBg: 'bg-amber-950/40',
        badgeBorder: 'border-amber-500/40',
        badgeText: 'text-amber-300',
        accentHex: '#f59e0b',
    },
    achievements: {
        id: 'achievements',
        label: 'Achievements',
        shortLabel: 'ACHIEVEMENT',
        tagline: 'Awards, recognitions, accomplishments, and successful initiatives',
        color: 'indigo',
        badgeBg: 'bg-indigo-950/40',
        badgeBorder: 'border-indigo-500/40',
        badgeText: 'text-indigo-300',
        accentHex: '#6366f1',
    },
    gatherings: {
        id: 'gatherings',
        label: 'Gatherings',
        shortLabel: 'GATHERING',
        tagline: 'Records of completed Conclaves, meetups, workshops, and summits',
        color: 'emerald',
        badgeBg: 'bg-emerald-950/40',
        badgeBorder: 'border-emerald-500/40',
        badgeText: 'text-emerald-300',
        accentHex: '#10b981',
    },
    decisions: {
        id: 'decisions',
        label: 'Decisions',
        shortLabel: 'DECISION',
        tagline: 'Important collective decisions, charters, and governance resolutions',
        color: 'cyan',
        badgeBg: 'bg-cyan-950/40',
        badgeBorder: 'border-cyan-500/40',
        badgeText: 'text-cyan-300',
        accentHex: '#06b6d4',
    },
    traditions: {
        id: 'traditions',
        label: 'Traditions',
        shortLabel: 'TRADITION',
        tagline: 'Recurring activities, rituals, hack days, and established customs',
        color: 'purple',
        badgeBg: 'bg-purple-950/40',
        badgeBorder: 'border-purple-500/40',
        badgeText: 'text-purple-300',
        accentHex: '#a855f7',
    },
    contributions: {
        id: 'contributions',
        label: 'Contributions',
        shortLabel: 'CONTRIBUTION',
        tagline: 'Significant projects, architectures, and open-source contributions',
        color: 'rose',
        badgeBg: 'bg-rose-950/40',
        badgeBorder: 'border-rose-500/40',
        badgeText: 'text-rose-300',
        accentHex: '#f43f5e',
    },
};
