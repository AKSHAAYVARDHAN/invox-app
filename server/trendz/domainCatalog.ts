import type { TrendzDomainSlug } from '../../utils/trendzDomains';

export interface ServerDomainMeta {
  slug: TrendzDomainSlug;
  name: string;
  aliases: readonly string[];
  /** Verified Unsplash editorial fallback visuals used only when source OG & AI thumbnails are unavailable */
  fallbackImageUrl: string;
  fallbackAttribution: string;
}

export const SERVER_TRENDZ_DOMAINS: readonly ServerDomainMeta[] = [
  {
    slug: 'technology',
    name: 'Technology',
    aliases: ['tech', 'ai', 'artificial intelligence', 'software', 'computing', 'hardware', 'cybersecurity'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Technology',
  },
  {
    slug: 'health-care',
    name: 'Health Care',
    aliases: ['healthcare', 'health', 'medicine', 'medtech', 'biotech', 'medical', 'clinical'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Health Care',
  },
  {
    slug: 'trading',
    name: 'Trading',
    aliases: ['markets', 'algo trading', 'quant', 'commodities', 'forex', 'derivatives', 'crypto'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Trading',
  },
  {
    slug: 'stock-market',
    name: 'Stock Market',
    aliases: ['stocks', 'equities', 'wall street', 'stockmarket', 'stock_market', 'nasdaq', 'nyse'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Stock Market',
  },
  {
    slug: 'design',
    name: 'Design',
    aliases: ['ui', 'ux', 'product design', 'industrial design', 'architecture', 'typography'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Design',
  },
  {
    slug: 'finance',
    name: 'Finance',
    aliases: ['fintech', 'banking', 'economics', 'economy', 'venture capital', 'macroeconomics'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Finance',
  },
  {
    slug: 'science',
    name: 'Science',
    aliases: ['research', 'physics', 'biology', 'chemistry', 'climate', 'neuroscience'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Science',
  },
  {
    slug: 'gaming',
    name: 'Gaming',
    aliases: ['games', 'esports', 'game dev', 'interactive entertainment', 'video games'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Gaming',
  },
  {
    slug: 'art',
    name: 'Art',
    aliases: ['arts', 'culture', 'media', 'creative', 'film', 'visual arts'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Art',
  },
  {
    slug: 'automotive',
    name: 'Automotive',
    aliases: ['auto', 'ev', 'electric vehicles', 'mobility', 'autonomous vehicles', 'transport'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Automotive',
  },
  {
    slug: 'space',
    name: 'Space',
    aliases: ['aerospace', 'astronomy', 'spaceflight', 'satellites', 'astrophysics', 'nasa'],
    fallbackImageUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
    fallbackAttribution: 'INVOX Domain Visual // Space',
  },
] as const;

export const SERVER_TRENDZ_DOMAIN_SLUGS: readonly TrendzDomainSlug[] = SERVER_TRENDZ_DOMAINS.map(
  (d) => d.slug
);

const BY_SLUG = new Map<TrendzDomainSlug, ServerDomainMeta>(
  SERVER_TRENDZ_DOMAINS.map((d) => [d.slug, d])
);

const LOOKUP = new Map<string, TrendzDomainSlug>();

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/[^a-z0-9 -]/g, '');
}

for (const meta of SERVER_TRENDZ_DOMAINS) {
  LOOKUP.set(meta.slug, meta.slug);
  const nameKey = normalizeKey(meta.name);
  LOOKUP.set(nameKey, meta.slug);
  LOOKUP.set(nameKey.replace(/\s+/g, '-'), meta.slug);
  LOOKUP.set(nameKey.replace(/\s+/g, ''), meta.slug);
  for (const alias of meta.aliases) {
    const aliasKey = normalizeKey(alias);
    LOOKUP.set(aliasKey, meta.slug);
    LOOKUP.set(aliasKey.replace(/\s+/g, '-'), meta.slug);
  }
}

export function normalizeServerDomainSlug(input?: string | null): TrendzDomainSlug | null {
  if (!input || typeof input !== 'string') return null;
  const key = normalizeKey(input);
  if (!key) return null;
  return (
    LOOKUP.get(key) ??
    LOOKUP.get(key.replace(/\s+/g, '-')) ??
    LOOKUP.get(key.replace(/-/g, ' ')) ??
    null
  );
}

export function getServerDomainMeta(slugOrName?: string | null): ServerDomainMeta {
  const normalized = normalizeServerDomainSlug(slugOrName) ?? 'technology';
  return BY_SLUG.get(normalized)!;
}
