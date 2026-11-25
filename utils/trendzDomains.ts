import React from 'react';
import {
    ShieldCheckIcon,
    CodeBracketIcon,
    PresentationChartBarIcon,
    PencilSquareIcon,
    CurrencyDollarIcon,
    AcademicCapIcon,
    CubeIcon,
    PencilIcon,
    WrenchScrewdriverIcon,
    GlobeAltIcon,
} from '../components/ui/Icons';

export type TrendzDomainSlug =
    | 'technology'
    | 'health-care'
    | 'trading'
    | 'stock-market'
    | 'design'
    | 'finance'
    | 'science'
    | 'gaming'
    | 'art'
    | 'automotive'
    | 'space';

export type TrendzDomainIconKey =
    | 'code-bracket'
    | 'shield-check'
    | 'presentation-chart-bar'
    | 'pencil-square'
    | 'currency-dollar'
    | 'academic-cap'
    | 'cube'
    | 'pencil'
    | 'wrench-screwdriver'
    | 'globe-alt';

export interface TrendzDomainDefinition {
    slug: TrendzDomainSlug;
    name: string;
    iconKey: TrendzDomainIconKey;
    icon: React.FC<{ className?: string }>;
    aliases: readonly string[];
}

export const TRENDZ_DOMAINS: readonly TrendzDomainDefinition[] = [
    {
        slug: 'technology',
        name: 'Technology',
        iconKey: 'code-bracket',
        icon: CodeBracketIcon,
        aliases: ['tech', 'ai', 'artificial intelligence', 'software', 'computing'],
    },
    {
        slug: 'health-care',
        name: 'Health Care',
        iconKey: 'shield-check',
        icon: ShieldCheckIcon,
        aliases: ['healthcare', 'health', 'medicine', 'medtech', 'biotech', 'medical'],
    },
    {
        slug: 'trading',
        name: 'Trading',
        iconKey: 'presentation-chart-bar',
        icon: PresentationChartBarIcon,
        aliases: ['markets', 'algo trading', 'quant', 'commodities', 'forex'],
    },
    {
        slug: 'stock-market',
        name: 'Stock Market',
        iconKey: 'presentation-chart-bar',
        icon: PresentationChartBarIcon,
        aliases: ['stocks', 'equities', 'wall street', 'stockmarket', 'stock_market'],
    },
    {
        slug: 'design',
        name: 'Design',
        iconKey: 'pencil-square',
        icon: PencilSquareIcon,
        aliases: ['ui', 'ux', 'product design', 'industrial design', 'architecture'],
    },
    {
        slug: 'finance',
        name: 'Finance',
        iconKey: 'currency-dollar',
        icon: CurrencyDollarIcon,
        aliases: ['fintech', 'banking', 'economics', 'economy', 'venture capital'],
    },
    {
        slug: 'science',
        name: 'Science',
        iconKey: 'academic-cap',
        icon: AcademicCapIcon,
        aliases: ['research', 'physics', 'biology', 'chemistry', 'climate'],
    },
    {
        slug: 'gaming',
        name: 'Gaming',
        iconKey: 'cube',
        icon: CubeIcon,
        aliases: ['games', 'esports', 'game dev', 'interactive entertainment'],
    },
    {
        slug: 'art',
        name: 'Art',
        iconKey: 'pencil',
        icon: PencilIcon,
        aliases: ['arts', 'culture', 'media', 'creative', 'film'],
    },
    {
        slug: 'automotive',
        name: 'Automotive',
        iconKey: 'wrench-screwdriver',
        icon: WrenchScrewdriverIcon,
        aliases: ['auto', 'ev', 'electric vehicles', 'mobility', 'autonomous vehicles'],
    },
    {
        slug: 'space',
        name: 'Space',
        iconKey: 'globe-alt',
        icon: GlobeAltIcon,
        aliases: ['aerospace', 'astronomy', 'spaceflight', 'satellites', 'astrophysics'],
    },
] as const;

export const TRENDZ_DOMAIN_SLUGS: readonly TrendzDomainSlug[] = TRENDZ_DOMAINS.map(
    (domain) => domain.slug
);

export const TRENDZ_CATEGORY_FILTERS: readonly string[] = [
    'All',
    ...TRENDZ_DOMAINS.map((domain) => domain.name),
];

export const TRENDZ_DOMAIN_FILTER_OPTIONS: Array<{
    name: string;
    icon: React.FC<{ className?: string }>;
}> = TRENDZ_DOMAINS.map(({ name, icon }) => ({ name, icon }));

const DEFAULT_DOMAIN_ICON: React.FC<{ className?: string }> = GlobeAltIcon;

const DOMAIN_BY_SLUG = new Map<TrendzDomainSlug, TrendzDomainDefinition>(
    TRENDZ_DOMAINS.map((domain) => [domain.slug, domain])
);

const LOOKUP_TO_SLUG = new Map<string, TrendzDomainSlug>();

function normalizeKey(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, ' ')
        .replace(/[^a-z0-9 -]/g, '');
}

for (const domain of TRENDZ_DOMAINS) {
    LOOKUP_TO_SLUG.set(domain.slug, domain.slug);
    LOOKUP_TO_SLUG.set(normalizeKey(domain.name), domain.slug);
    LOOKUP_TO_SLUG.set(normalizeKey(domain.name).replace(/\s+/g, '-'), domain.slug);
    LOOKUP_TO_SLUG.set(normalizeKey(domain.name).replace(/\s+/g, ''), domain.slug);
    for (const alias of domain.aliases) {
        const normalizedAlias = normalizeKey(alias);
        LOOKUP_TO_SLUG.set(normalizedAlias, domain.slug);
        LOOKUP_TO_SLUG.set(normalizedAlias.replace(/\s+/g, '-'), domain.slug);
    }
}

/**
 * Normalizes any domain display name, slug, or alias into a canonical TrendzDomainSlug.
 * Returns null if the value does not map to a registered Trendz domain.
 */
export function normalizeTrendzDomainSlug(input?: string | null): TrendzDomainSlug | null {
    if (!input || typeof input !== 'string') {
        return null;
    }
    const normalized = normalizeKey(input);
    if (!normalized) {
        return null;
    }
    return (
        LOOKUP_TO_SLUG.get(normalized) ??
        LOOKUP_TO_SLUG.get(normalized.replace(/\s+/g, '-')) ??
        LOOKUP_TO_SLUG.get(normalized.replace(/-/g, ' ')) ??
        null
    );
}

/**
 * Looks up a canonical TrendzDomainDefinition by slug.
 */
export function getTrendzDomainBySlug(slug?: string | null): TrendzDomainDefinition | undefined {
    const normalized = normalizeTrendzDomainSlug(slug);
    return normalized ? DOMAIN_BY_SLUG.get(normalized) : undefined;
}

/**
 * Looks up a canonical TrendzDomainDefinition by display name, slug, or alias.
 */
export function getTrendzDomain(nameOrSlug?: string | null): TrendzDomainDefinition | undefined {
    return getTrendzDomainBySlug(nameOrSlug);
}

/**
 * Resolves the React icon component for a Trendz domain slug or name.
 * Falls back to GlobeAltIcon for unknown domains so UI never breaks.
 */
export function resolveTrendzDomainIcon(nameOrSlug?: string | null): React.FC<{ className?: string }> {
    return getTrendzDomain(nameOrSlug)?.icon ?? DEFAULT_DOMAIN_ICON;
}

/**
 * Returns the canonical display name for a domain slug or alias.
 */
export function formatTrendzDomainName(nameOrSlug?: string | null): string {
    const match = getTrendzDomain(nameOrSlug);
    if (match) {
        return match.name;
    }
    return typeof nameOrSlug === 'string' && nameOrSlug.trim() ? nameOrSlug.trim() : 'General';
}

/**
 * Returns true if the provided slug or display name belongs to the canonical Trendz domain registry.
 */
export function isValidTrendzDomain(nameOrSlug?: string | null): boolean {
    return normalizeTrendzDomainSlug(nameOrSlug) !== null;
}
